import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Hash,
  Search,
  Plus,
  Paperclip,
  Smile,
  Send,
  Pin,
  Volume2,
  VolumeX,
  Archive,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowDown,
  Edit2,
  Trash2,
  Reply,
  Info,
  FileText,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { EmojiPicker, QuickReactionsBar } from './EmojiPicker';
import { MediaCardPlayer } from './MediaCardPlayer';
import { GroupModal } from './GroupModal';
import {
  ChatChannelTypeDetail,
  ChatMessageType,
  ChannelMemberType,
  ChatReactionEmoji,
} from '@mmp/shared';

export default function ChatPage() {
  const { channelId: routeChannelId } = useParams<{ channelId?: string }>();
  const [searchParams] = useSearchParams();
  const highlightMessageId = searchParams.get('m');

  const { user } = useAuth();
  const socket = useSocket();

  // Navigation & View state
  const [channels, setChannels] = useState<ChatChannelTypeDetail[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(routeChannelId || null);
  const [activeChannel, setActiveChannel] = useState<ChatChannelTypeDetail | null>(null);
  const [members, setMembers] = useState<ChannelMemberType[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessageType[]>([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Messages state
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Composer state
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessageType | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageType | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<number>(0);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<any>(null);

  // Modals & Search
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ChatChannelTypeDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessageType[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [rightDrawerTab, setRightDrawerTab] = useState<'members' | 'pinned' | 'media'>('members');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightMessageId);

  const sharedMediaCards = useMemo(() => {
    return messages
      .filter((m) => m.sharedMedia && !m.sharedMedia.isRevoked)
      .map((m) => ({
        messageId: (m._id || m.id) ?? '',
        card: m.sharedMedia!,
      }));
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canCreateGroup = user && ['admin', 'creative_head', 'sm_manager'].includes(user.role);
  const isExecutive = user?.role === 'executive';

  // 1. Load Channels
  async function loadChannels(selectChannelId?: string) {
    try {
      const res = await apiFetch<{ channels: ChatChannelTypeDetail[] }>('/api/chat/channels');
      setChannels(res.channels || []);

      if (res.channels.length > 0) {
        let targetId = selectChannelId || activeChannelId || routeChannelId;
        if (!targetId || !res.channels.some((c) => (c._id || c.id) === targetId)) {
          // Default to team chat
          const team = res.channels.find((c) => c.type === 'team');
          targetId = team ? (team._id || team.id) : (res.channels[0]._id || res.channels[0].id);
        }
        if (targetId) {
          selectChannel(targetId);
        }
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  }

  useEffect(() => {
    loadChannels();
  }, [user]);

  // 2. Select a Channel
  async function selectChannel(channelId: string) {
    if (activeChannelId && socket.isConnected) {
      socket.leaveChannel(activeChannelId);
    }

    setActiveChannelId(channelId);
    setMobileView('chat');
    setReplyingTo(null);
    setEditingMessage(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchBox(false);

    try {
      setLoadingMessages(true);
      const details = await apiFetch<{
        channel: ChatChannelTypeDetail;
        members: ChannelMemberType[];
        pinnedMessages: ChatMessageType[];
      }>(`/api/chat/channels/${channelId}`);

      setActiveChannel(details.channel);
      setMembers(details.members || []);
      setPinnedMessages(details.pinnedMessages || []);

      const msgsRes = await apiFetch<{
        messages: ChatMessageType[];
        hasMore: boolean;
        nextCursor: string | null;
      }>(`/api/chat/channels/${channelId}/messages${highlightMessageId ? `?aroundMessageId=${highlightMessageId}` : ''}`);

      setMessages(msgsRes.messages || []);
      setHasMore(msgsRes.hasMore || false);
      setNextCursor(msgsRes.nextCursor || null);

      if (socket.isConnected) {
        socket.joinChannel(channelId);
      }

      // Mark channel as read
      const lastMsg = msgsRes.messages[msgsRes.messages.length - 1];
      if (lastMsg) {
        apiFetch(`/api/chat/channels/${channelId}/read`, {
          method: 'POST',
          body: JSON.stringify({ messageId: lastMsg._id || lastMsg.id }),
        }).catch(() => {});
      }

      setTimeout(() => {
        scrollToBottom();
      }, 50);
    } catch (err) {
      console.error('Failed to load channel details:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  // 3. Socket Event Subscriptions
  useEffect(() => {
    if (!socket.isConnected || !activeChannelId) return;

    socket.joinChannel(activeChannelId);

    const unsubNew = socket.on('chat:message:new', (msg: ChatMessageType) => {
      if (msg.channelId === activeChannelId) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();

        // Mark as read immediately if window active
        apiFetch(`/api/chat/channels/${activeChannelId}/read`, {
          method: 'POST',
          body: JSON.stringify({ messageId: msg._id || msg.id }),
        }).catch(() => {});
      } else {
        // Increment unread on channel
        setChannels((prev) =>
          prev.map((c) =>
            (c._id || c.id) === msg.channelId
              ? { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMessageSnippet: msg.content.slice(0, 80) }
              : c
          )
        );
      }
    });

    const unsubEdit = socket.on('chat:message:edited', (msg: ChatMessageType) => {
      if (msg.channelId === activeChannelId) {
        setMessages((prev) =>
          prev.map((m) => ((m._id || m.id) === (msg._id || msg.id) ? msg : m))
        );
      }
    });

    const unsubDel = socket.on('chat:message:deleted', (payload: { messageId: string; content: string }) => {
      if (activeChannelId) {
        setMessages((prev) =>
          prev.map((m) =>
            (m._id || m.id) === payload.messageId
              ? { ...m, isDeleted: true, content: payload.content, attachments: [] }
              : m
          )
        );
      }
    });

    const unsubReact = socket.on('chat:reaction:toggled', (payload: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id) === payload.messageId ? { ...m, reactions: payload.reactions } : m
        )
      );
    });

    const unsubPin = socket.on('chat:pin:toggled', (payload: { messageId: string; isPinned: boolean }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id) === payload.messageId ? { ...m, isPinned: payload.isPinned } : m
        )
      );
      // Reload pinned list
      if (activeChannelId) {
        apiFetch<any>(`/api/chat/channels/${activeChannelId}`).then((d) => {
          setPinnedMessages(d.pinnedMessages || []);
        });
      }
    });

    const unsubTyping = socket.on('chat:typing', (data: { channelId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.channelId === activeChannelId && data.userId !== (user?._id || user?.id)) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          if (data.isTyping) {
            updated[data.userId] = data.userName;
          } else {
            delete updated[data.userId];
          }
          return updated;
        });
      }
    });

    return () => {
      unsubNew();
      unsubEdit();
      unsubDel();
      unsubReact();
      unsubPin();
      unsubTyping();
    };
  }, [socket.isConnected, activeChannelId, user]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);

    // Infinite scroll trigger at top
    if (scrollTop === 0 && hasMore && nextCursor && !loadingMessages && activeChannelId) {
      loadMoreMessages();
    }
  }

  async function loadMoreMessages() {
    if (!activeChannelId || !nextCursor) return;
    try {
      const msgsRes = await apiFetch<{
        messages: ChatMessageType[];
        hasMore: boolean;
        nextCursor: string | null;
      }>(`/api/chat/channels/${activeChannelId}/messages?cursor=${encodeURIComponent(nextCursor)}`);

      setMessages((prev) => [...(msgsRes.messages || []), ...prev]);
      setHasMore(msgsRes.hasMore || false);
      setNextCursor(msgsRes.nextCursor || null);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    }
  }

  // 4. Send or Edit Message
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isExecutive) return;
    if (!inputText.trim() && pendingFiles.length === 0) return;
    if (!activeChannelId) return;

    // Editing mode
    if (editingMessage) {
      try {
        const msgId = editingMessage._id || editingMessage.id;
        await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${msgId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: inputText.trim() }),
        });
        setEditingMessage(null);
        setInputText('');
      } catch (err: any) {
        alert(err.message || 'Failed to edit message.');
      }
      return;
    }

    // Upload pending attachments first if any
    let uploadedAttachments: any[] = [];
    if (pendingFiles.length > 0) {
      try {
        setUploadingFiles(true);
        const formData = new FormData();
        pendingFiles.forEach((file) => formData.append('files', file));
        formData.append('channelId', activeChannelId);

        const uploadRes = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        const uploadData = await uploadRes.json();
        if (uploadData.attachments) {
          uploadedAttachments = uploadData.attachments;
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('Failed to upload attachments.');
        setUploadingFiles(false);
        return;
      } finally {
        setUploadingFiles(false);
      }
    }

    const payload = {
      content: inputText.trim(),
      replyToId: replyingTo ? (replyingTo._id || replyingTo.id) : null,
      attachments: uploadedAttachments,
    };

    setInputText('');
    setReplyingTo(null);
    setPendingFiles([]);

    // Stop typing emit
    socket.emitTyping(activeChannelId, false);

    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      alert(err.message || 'Failed to send message.');
    }
  }

  function handleTypingChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInputText(val);

    // Detect @ mention
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && !textBeforeCursor.slice(lastAtIdx).includes(' ')) {
      const q = textBeforeCursor.slice(lastAtIdx + 1).toLowerCase();
      setMentionQuery(q);
      setMentionPosition(lastAtIdx);
    } else {
      setMentionQuery(null);
    }

    // Emit typing indicator
    if (activeChannelId) {
      socket.emitTyping(activeChannelId, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emitTyping(activeChannelId, false);
      }, 2500);
    }
  }

  function selectMention(mentionText: string) {
    if (mentionPosition === null) return;
    const before = inputText.slice(0, mentionPosition);
    const after = inputText.slice(textareaRef.current?.selectionStart || mentionPosition);
    const completed = `${before}@${mentionText} ${after}`;
    setInputText(completed);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  // 5. Reactions & Pins
  async function toggleReaction(messageId: string, emoji: ChatReactionEmoji) {
    if (isExecutive || !activeChannelId) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    } catch (err: any) {
      alert(err.message || 'Failed to react.');
    }
  }

  async function togglePin(messageId: string) {
    if (!activeChannelId) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${messageId}/pin`, {
        method: 'POST',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to pin message.');
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    if (!activeChannelId) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${messageId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to delete message.');
    }
  }

  async function toggleMute() {
    if (!activeChannel || !activeChannelId) return;
    const newMute = !activeChannel.isMuted;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/mute`, {
        method: 'POST',
        body: JSON.stringify({ isMuted: newMute }),
      });
      setActiveChannel((prev) => (prev ? { ...prev, isMuted: newMute } : null));
      setChannels((prev) =>
        prev.map((c) => ((c._id || c.id) === activeChannelId ? { ...c, isMuted: newMute } : c))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to mute channel.');
    }
  }

  // 6. Search inside channel or across channels
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await apiFetch<{ results: ChatMessageType[] }>(
        `/api/chat/search?q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(res.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  // Mention Suggestions list
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const list: Array<{ label: string; sub?: string }> = [];

    // Leaders & Admin can mention @everyone
    if (canCreateGroup && 'everyone'.startsWith(mentionQuery)) {
      list.push({ label: 'everyone', sub: 'Notify everyone in channel' });
    }

    members.forEach((m) => {
      const u = m.user;
      if (u) {
        const nameMatch = u.preferredName?.toLowerCase().includes(mentionQuery) || u.name.toLowerCase().includes(mentionQuery);
        if (nameMatch) {
          list.push({
            label: u.preferredName || u.name,
            sub: u.jobRole || u.role,
          });
        }
      }
    });

    return list.slice(0, 5);
  }, [mentionQuery, members, canCreateGroup]);

  // Group channels into categories
  const filteredChannels = useMemo(() => {
    return channels.filter((c) =>
      c.name.toLowerCase().includes(channelFilter.toLowerCase())
    );
  }, [channels, channelFilter]);

  const teamChannels = filteredChannels.filter((c) => c.type === 'team');
  const groupChannels = filteredChannels.filter((c) => c.type === 'group' && !c.isArchived);
  const dmChannels = filteredChannels.filter((c) => c.type === 'dm');
  const archivedChannels = filteredChannels.filter((c) => c.isArchived);

  return (
    <div
      className="h-[calc(100vh-64px)] flex bg-slate-50/60 overflow-hidden font-sans"
      data-testid="chat-page-root"
    >
      {/* =========================================================================
          LEFT PANE: Channel List (Desktop: always visible, Mobile: screen 1)
         ========================================================================= */}
      <div
        className={`${
          mobileView === 'list' ? 'flex' : 'hidden'
        } lg:flex flex-col w-full lg:w-72 xl:w-80 shrink-0 bg-white border-r border-slate-200/80 z-20`}
      >
        {/* Pane Header */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Team Chat</h2>
              <p className="text-[10px] text-slate-400">Marketing OS Live Studio</p>
            </div>
          </div>

          {canCreateGroup && (
            <button
              type="button"
              onClick={() => {
                setEditingGroup(null);
                setShowGroupModal(true);
              }}
              title="Create new group"
              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Group</span>
            </button>
          )}
        </div>

        {/* Filter Input */}
        <div className="p-2.5 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              placeholder="Search conversations..."
              className="w-full text-xs rounded-xl bg-slate-50 pl-8 pr-3 py-1.5 border border-slate-200/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Channel List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50/50 p-2 space-y-3">
          {/* TEAM CHAT */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Team Channel
            </div>
            {teamChannels.map((c) => {
              const id = (c._id || c.id) ?? '';
              const isSelected = id === activeChannelId;
              return (
                <button
                  key={id}
                  onClick={() => selectChannel(id)}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-xs truncate">{c.name}</span>
                  </div>
                  {(c.unreadCount || 0) > 0 && !isSelected && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* GROUPS */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Groups ({groupChannels.length})</span>
            </div>
            {groupChannels.length === 0 ? (
              <p className="px-3 py-1 text-[11px] text-slate-400 italic">No groups yet</p>
            ) : (
              groupChannels.map((c) => {
                const id = (c._id || c.id) ?? '';
                const isSelected = id === activeChannelId;
                return (
                  <button
                    key={id}
                    onClick={() => selectChannel(id)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                      <span className="text-xs truncate">{c.name}</span>
                    </div>
                    {(c.unreadCount || 0) > 0 && !isSelected && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* DIRECT MESSAGES */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Direct Messages
            </div>
            {dmChannels.length === 0 ? (
              <p className="px-3 py-1 text-[11px] text-slate-400 italic">No DMs yet</p>
            ) : (
              dmChannels.map((c) => {
                const id = (c._id || c.id) ?? '';
                const isSelected = id === activeChannelId;
                const other = c.otherUser;
                return (
                  <button
                    key={id}
                    onClick={() => selectChannel(id)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        url={other?.avatarUrl}
                        name={other?.preferredName || other?.name || c.name}
                        size="xs"
                      />
                      <span className="text-xs truncate">
                        {other?.preferredName || other?.name || c.name}
                      </span>
                    </div>
                    {(c.unreadCount || 0) > 0 && !isSelected && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* ARCHIVED GROUPS */}
          {archivedChannels.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="w-full text-left px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
              >
                <span>Archived ({archivedChannels.length})</span>
                {showArchived ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {showArchived && (
                <div className="mt-1 space-y-1">
                  {archivedChannels.map((c) => {
                    const id = (c._id || c.id) ?? '';
                    const isSelected = id === activeChannelId;
                    return (
                      <button
                        key={id}
                        onClick={() => selectChannel(id)}
                        className={`w-full text-left px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs opacity-75 ${
                          isSelected ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <Archive className="w-3 h-3" />
                        <span className="truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER PANE: Message Stream & Composer (Desktop: flex-1, Mobile: screen 2)
         ========================================================================= */}
      <div
        className={`${
          mobileView === 'chat' ? 'flex' : 'hidden'
        } lg:flex flex-col flex-1 h-full bg-slate-50/40 relative overflow-hidden`}
      >
        {activeChannel ? (
          <>
            {/* Active Channel Header */}
            <div className="h-14 px-4 bg-white/95 border-b border-slate-200/80 flex items-center justify-between shrink-0 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  title="Back to channel list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {activeChannel.type === 'team' ? (
                      <Hash className="w-4 h-4 text-slate-400" />
                    ) : activeChannel.type === 'group' ? (
                      <Users className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Avatar
                        url={activeChannel.otherUser?.avatarUrl}
                        name={activeChannel.name}
                        size="xs"
                      />
                    )}
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {activeChannel.name}
                    </h3>
                    {activeChannel.isArchived && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {activeChannel.type === 'dm'
                      ? activeChannel.otherUser?.jobRole || activeChannel.otherUser?.role
                      : `${members.length} members ${activeChannel.description ? `• ${activeChannel.description}` : ''}`}
                  </p>
                </div>
              </div>

              {/* Header Action Cluster */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSearchBox(!showSearchBox)}
                  className={`p-2 rounded-xl transition-colors ${
                    showSearchBox ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Search messages"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-2 rounded-xl transition-colors ${
                    activeChannel.isMuted ? 'text-amber-600 bg-amber-50' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title={activeChannel.isMuted ? 'Unmute channel' : 'Mute channel'}
                >
                  {activeChannel.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRightDrawer(!showRightDrawer)}
                  className={`p-2 rounded-xl transition-colors ${
                    showRightDrawer ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Channel details"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* In-channel Search Box */}
            {showSearchBox && (
              <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-2 animate-in slide-in-from-top-2">
                <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages across your channels..."
                      className="w-full text-xs rounded-xl bg-slate-50 pl-8 pr-3 py-1.5 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchBox(false);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Search Results Drawer */}
            {searchResults.length > 0 && (
              <div className="bg-slate-100/90 border-b border-slate-200 p-3 max-h-48 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Found {searchResults.length} matching messages</span>
                  <button onClick={() => setSearchResults([])} className="text-[11px] text-indigo-600 hover:underline">
                    Clear results
                  </button>
                </div>
                {searchResults.map((sm) => (
                  <div
                    key={sm._id || sm.id}
                    onClick={() => {
                      if (sm.channelId !== activeChannelId) {
                        selectChannel(sm.channelId);
                      }
                    }}
                    className="p-2 bg-white rounded-xl shadow-xs text-xs cursor-pointer hover:border-indigo-300 border border-transparent"
                  >
                    <p className="font-semibold text-slate-800">
                      {sm.authorId?.preferredName || sm.authorId?.name} •{' '}
                      <span className="text-[10px] text-slate-400">
                        {new Date(sm.createdAt).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-slate-600 text-xs truncate mt-0.5">{sm.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Pinned Messages Top Ribbon */}
            {pinnedMessages.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Pin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-indigo-900 truncate">
                    Pinned: {pinnedMessages[0].content || pinnedMessages[0].sharedMedia?.title || 'Announcement'}
                  </span>
                </div>
                {pinnedMessages.length > 1 && (
                  <span className="text-[10px] font-bold text-indigo-600 shrink-0 ml-2">
                    +{pinnedMessages.length - 1} more
                  </span>
                )}
              </div>
            )}

            {/* Message Stream */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
              data-testid="chat-message-stream"
            >
              {loadingMessages ? (
                <div className="text-center py-8 text-xs text-slate-400 animate-pulse">
                  Loading conversation history...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium">No messages in this channel yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Start the conversation by typing below!
                  </p>
                </div>
              ) : (
                messages.map((msg, _index) => {
                  const id = (msg._id || msg.id) ?? '';
                  const isAuthor = (msg.authorId?._id || msg.authorId?.id) === (user?._id || user?.id);
                  const isHighlighted = (activeHighlightId || highlightMessageId) === id;

                  return (
                    <div
                      key={id}
                      className={`flex gap-3 group relative transition-colors ${
                        isHighlighted ? 'bg-indigo-50/80 p-2 rounded-2xl border border-indigo-200' : ''
                      }`}
                    >
                      <Avatar
                        url={msg.authorId?.avatarUrl}
                        name={msg.authorId?.preferredName || msg.authorId?.name || 'User'}
                        size="sm"
                      />

                      <div className="flex-1 min-w-0">
                        {/* Header: Author Name, Role, Timestamp */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {msg.authorId?.preferredName || msg.authorId?.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600">
                            {msg.authorId?.role}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.isEdited && (
                            <span className="text-[10px] text-slate-400 italic">[edited]</span>
                          )}
                          {msg.isPinned && (
                            <Pin className="w-3 h-3 text-indigo-500 fill-indigo-500 inline" />
                          )}
                        </div>

                        {/* Reply Quote Banner */}
                        {msg.replyPreview && (
                          <div className="mt-1 p-2 rounded-xl bg-slate-100/80 border-l-2 border-indigo-500 text-[11px] text-slate-600 mb-1 max-w-lg">
                            <span className="font-semibold text-slate-800">
                              {msg.replyPreview.authorName}:
                            </span>{' '}
                            {msg.replyPreview.content}
                          </div>
                        )}

                        {/* Message Content */}
                        <p className={`text-xs mt-0.5 leading-relaxed break-words max-w-2xl ${
                          msg.isDeleted ? 'italic text-slate-400' : 'text-slate-800'
                        }`}>
                          {msg.content}
                        </p>

                        {/* Shared Media Card */}
                        {msg.sharedMedia && (
                          <MediaCardPlayer
                            card={msg.sharedMedia}
                            onRevoked={(grantId) => {
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.sharedMedia?.grantId === grantId
                                    ? { ...m, sharedMedia: { ...m.sharedMedia, isRevoked: true } }
                                    : m
                                )
                              );
                            }}
                          />
                        )}

                        {/* File Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.attachments.map((att, attIdx) => {
                              const isImg = att.mimeType.startsWith('image/');
                              return isImg ? (
                                <a
                                  key={attIdx}
                                  href={att.storageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors"
                                >
                                  <img
                                    src={att.storageUrl}
                                    alt={att.fileName}
                                    className="max-h-48 object-cover rounded-xl"
                                  />
                                </a>
                              ) : (
                                <a
                                  key={attIdx}
                                  href={att.storageUrl}
                                  download={att.fileName}
                                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  <span className="truncate max-w-xs">{att.fileName}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        {/* Reactions Pills */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {msg.reactions.map((r, rIdx) => {
                              const hasReacted = r.userIds.some(
                                (uid) => uid.toString() === (user?._id || user?.id)?.toString()
                              );
                              return (
                                <button
                                  key={rIdx}
                                  onClick={() => toggleReaction(id, r.emoji)}
                                  disabled={isExecutive}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                    hasReacted
                                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 font-semibold'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="text-[10px]">{r.userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Hover Actions Bar */}
                      {!isExecutive && !msg.isDeleted && (
                        <div className="absolute right-2 top-0 hidden group-hover:flex items-center gap-1 bg-white border border-slate-200 shadow-md rounded-xl p-1 z-10 animate-in fade-in duration-100">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReactionMsgId(activeReactionMsgId === id ? null : id)
                            }
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs"
                            title="React"
                          >
                            <Smile className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setReplyingTo(msg)}
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs"
                            title="Reply"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          {(canCreateGroup || activeChannel.type === 'group') && (
                            <button
                              type="button"
                              onClick={() => togglePin(id)}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs"
                              title={msg.isPinned ? 'Unpin' : 'Pin'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAuthor && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessage(msg);
                                setInputText(msg.content);
                                textareaRef.current?.focus();
                              }}
                              className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(isAuthor || user?.role === 'admin') && (
                            <button
                              type="button"
                              onClick={() => deleteMessage(id)}
                              className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quick Reactions Popover */}
                      {activeReactionMsgId === id && (
                        <div className="absolute right-2 top-8 z-30">
                          <QuickReactionsBar
                            onReact={(emoji) => toggleReaction(id, emoji)}
                            onClose={() => setActiveReactionMsgId(null)}
                            currentReactions={
                              msg.reactions
                                ?.filter((r) =>
                                  r.userIds.some((uid) => uid.toString() === (user?._id || user?.id)?.toString())
                                )
                                .map((r) => r.emoji) || []
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Jump-to-latest button */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-24 right-8 p-2.5 rounded-full bg-white text-indigo-600 shadow-xl border border-slate-200 hover:scale-110 active:scale-95 transition-all z-20"
                title="Jump to latest messages"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}

            {/* Typing Indicator Bar */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="px-5 py-1 text-[11px] text-slate-500 italic animate-pulse">
                {Object.values(typingUsers).join(', ')} is typing...
              </div>
            )}

            {/* Replying Context Banner */}
            {replyingTo && (
              <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Reply className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-slate-600 truncate">
                    Replying to{' '}
                    <strong className="text-slate-900">
                      {replyingTo.authorId?.preferredName || replyingTo.authorId?.name}
                    </strong>
                    : {replyingTo.content}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Editing Context Banner */}
            {editingMessage && (
              <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-800">
                <span>Editing message</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setInputText('');
                  }}
                  className="text-amber-600 hover:text-amber-900 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Pending Files Attachment Chips */}
            {pendingFiles.length > 0 && (
              <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-2">
                {pendingFiles.map((file, fIdx) => (
                  <div
                    key={fIdx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-xs text-slate-700 border border-slate-200"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== fIdx))}
                      className="text-slate-400 hover:text-slate-700 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Mention Suggestions Popup */}
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-20 left-6 bg-white border border-slate-200 shadow-2xl rounded-2xl p-1.5 z-40 w-64 max-h-48 overflow-y-auto animate-in fade-in">
                {mentionSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectMention(s.label)}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-indigo-50 text-xs flex items-center justify-between transition-colors"
                  >
                    <span className="font-semibold text-slate-900">@{s.label}</span>
                    {s.sub && <span className="text-[10px] text-slate-400">{s.sub}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => setInputText((prev) => prev + emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Composer Bar */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200/80">
              {isExecutive ? (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 font-medium">
                  Executives have read-only access in team channels.
                </div>
              ) : activeChannel.isArchived ? (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-800 font-medium">
                  This channel is archived and read-only.
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-end gap-2 bg-slate-50 rounded-2xl border border-slate-200 p-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500 transition-all"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length + pendingFiles.length > 5) {
                        alert('Maximum 5 attachments permitted per message.');
                        return;
                      }
                      setPendingFiles((prev) => [...prev, ...files]);
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach files (images, docs, video)"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Add Emoji"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors shrink-0"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleTypingChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Message ${activeChannel.name}...`}
                    rows={1}
                    className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none py-2 px-1 max-h-32"
                  />

                  <button
                    type="submit"
                    disabled={uploadingFiles || (!inputText.trim() && pendingFiles.length === 0)}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-all shadow-sm shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-slate-400 p-8">
            <div>
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Select a conversation</p>
              <p className="text-xs text-slate-400 mt-1">
                Choose a channel or direct message from the left to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          RIGHT PANE: Channel Details (Desktop: toggleable drawer)
         ========================================================================= */}
      {showRightDrawer && activeChannel && (
        <div className="hidden xl:flex flex-col w-72 shrink-0 bg-white border-l border-slate-200/80 p-4 overflow-y-auto space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Channel Details
            </h4>
            <button
              onClick={() => setShowRightDrawer(false)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Overview */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">{activeChannel.name}</h3>
            {activeChannel.description && (
              <p className="text-xs text-slate-500">{activeChannel.description}</p>
            )}
            <p className="text-[10px] text-slate-400">
              Created {new Date(activeChannel.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Mute Toggle */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeChannel.isMuted ? (
                <VolumeX className="w-4 h-4 text-amber-600" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-600" />
              )}
              <span className="text-xs font-medium text-slate-700">Mute Notifications</span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                activeChannel.isMuted ? 'bg-amber-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  activeChannel.isMuted ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Drawer Tab Switcher */}
          <div className="flex border-b border-slate-200" data-testid="right-panel-tabs">
            <button
              type="button"
              onClick={() => setRightDrawerTab('members')}
              className={`flex-1 pb-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                rightDrawerTab === 'members'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Members ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setRightDrawerTab('pinned')}
              className={`flex-1 pb-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                rightDrawerTab === 'pinned'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Pinned ({pinnedMessages.length})
            </button>
            <button
              type="button"
              onClick={() => setRightDrawerTab('media')}
              className={`flex-1 pb-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                rightDrawerTab === 'media'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              data-testid="shared-media-tab"
            >
              Shared media ({sharedMediaCards.length})
            </button>
          </div>

          {/* Tab 1: Members List */}
          {rightDrawerTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">
                  Channel Members
                </span>
                {canCreateGroup && activeChannel.type === 'group' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroup(activeChannel);
                      setShowGroupModal(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite
                  </button>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {members.map((m) => {
                  const u = m.user;
                  if (!u) return null;
                  return (
                    <div key={m._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar url={u.avatarUrl} name={u.preferredName || u.name} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {u.preferredName || u.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{u.jobRole || u.role}</p>
                        </div>
                      </div>
                      {m.role === 'owner' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                          Owner
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Pinned Messages */}
          {rightDrawerTab === 'pinned' && (
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-2">
                Pinned Messages ({pinnedMessages.length})
              </span>
              {pinnedMessages.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 text-center">No pinned messages in this channel.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pinnedMessages.map((pm) => (
                    <div
                      key={pm._id || pm.id}
                      onClick={() => {
                        const mid = (pm._id || pm.id) ?? '';
                        setActiveHighlightId(mid);
                        const el = document.getElementById(`msg-${mid}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-200 transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{pm.authorId?.preferredName || pm.authorId?.name}</span>
                        <Pin className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                      </div>
                      <p className="text-slate-700 line-clamp-2">{pm.content || pm.sharedMedia?.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Shared Media */}
          {rightDrawerTab === 'media' && (
            <div data-testid="shared-media-tab-content">
              <span className="text-xs font-bold text-slate-900 block mb-2">
                Shared Media ({sharedMediaCards.length})
              </span>
              {sharedMediaCards.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-4 text-center">
                  No shared media in this channel yet.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {sharedMediaCards.map(({ messageId, card }, idx) => (
                    <div
                      key={card.grantId || idx}
                      onClick={() => {
                        setActiveHighlightId(messageId);
                        const el = document.getElementById(`msg-${messageId}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 cursor-pointer transition-all flex items-center gap-3"
                    >
                      {card.thumbnailUrl ? (
                        <img
                          src={card.thumbnailUrl}
                          alt={card.title}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-semibold text-slate-900 truncate">{card.title}</h5>
                        <p className="text-[10px] text-slate-500 truncate">{card.contentPieceTitle} • {card.stageKey}</p>
                        <p className="text-[10px] text-indigo-600 mt-0.5 truncate">
                          Shared by {card.owner?.preferredName || card.owner?.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group Creation & Settings Modal */}
      {showGroupModal && (
        <GroupModal
          channelToEdit={editingGroup}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSuccess={(newChan) => {
            loadChannels(newChan._id || newChan.id);
          }}
        />
      )}
    </div>
  );
}

