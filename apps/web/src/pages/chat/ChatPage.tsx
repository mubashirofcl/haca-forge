import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDialogFocus } from '../../lib/useDialogFocus';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Hash,
  Search,
  Plus,
  Paperclip,
  Smile,
  Send,
  Pin,
  BellOff,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowDown,
  Edit2,
  Trash2,
  Reply,
  FileText,
  Image as ImageIcon,
  Film,
  UserPlus,
  LogOut,
  PanelRight,
  Settings2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { EmojiPicker, QuickReactionsBar } from './EmojiPicker';
import { MediaCardPlayer } from './MediaCardPlayer';
import { GroupModal } from './GroupModal';
import { safeUrl } from '../../lib/safeUrl';
import {
  ChatChannelTypeDetail,
  ChatMessageType,
  ChannelMemberType,
  ChatReactionEmoji,
} from '@mmp/shared';

const ENTER_TO_SEND_KEY = 'haca.chat.enterToSend';
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

// ── Formatting helpers ────────────────────────────────────────────────────────
const idOf = (x: { _id?: string; id?: string } | null | undefined) => (x?._id || x?.id || '') as string;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatListTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return formatTime(iso);
  const diffDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatDayLabel(d: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function readEnterToSend() {
  try {
    return localStorage.getItem(ENTER_TO_SEND_KEY) !== '0';
  } catch {
    return true;
  }
}

// ── Small presentational pieces ───────────────────────────────────────────────
function ChannelAvatar({ channel, size = 'md' }: { channel: ChatChannelTypeDetail; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  if (channel.type === 'dm') {
    const other = channel.otherUser;
    return (
      <Avatar
        url={other?.avatarUrl}
        name={other?.preferredName || other?.name || channel.name}
        userId={other?._id}
        size={size}
      />
    );
  }
  if (channel.type === 'team') {
    return (
      <div className={`${box} shrink-0 rounded-xl bg-ui-ink text-white flex items-center justify-center`}>
        <Hash className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
      </div>
    );
  }
  return (
    <div
      className={`${box} shrink-0 rounded-xl bg-white/70 text-ui-ink font-semibold flex items-center justify-center`}
      aria-hidden="true"
    >
      {initialsOf(channel.name)}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2 ${
        checked ? 'bg-ui-ink' : 'bg-ui-muted/50'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h4 className="text-xs font-semibold text-ui-muted">{children}</h4>
      {action}
    </div>
  );
}

const iconButton =
  'inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-ui-muted hover:text-ui-ink hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { channelId: routeChannelId } = useParams<{ channelId?: string }>();
  const [searchParams] = useSearchParams();
  const highlightMessageId = searchParams.get('m');
  const navigate = useNavigate();

  const { user } = useAuth();
  const socket = useSocket();
  const myId = (user?._id || user?.id || '') as string;

  const activeChannelId = routeChannelId || null;
  const isConversationOpen = !!activeChannelId;

  // Channels & active channel
  const [channels, setChannels] = useState<ChatChannelTypeDetail[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannelTypeDetail | null>(null);
  const [members, setMembers] = useState<ChannelMemberType[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessageType[]>([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Details panel
  const [panelOpen, setPanelOpen] = useState(true); // inline panel (xl+)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false); // overlay panel (< xl)
  // Info drawer keyboard behaviour: focus in on open, Escape closes, Tab stays inside, focus returns.
  const mobilePanelRef = useRef<HTMLElement>(null);
  useDialogFocus(mobilePanelRef, mobilePanelOpen, () => setMobilePanelOpen(false));
  const [panelTab, setPanelTab] = useState<'details' | 'settings'>('details');

  // Messages
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightMessageId);

  // Composer
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessageType | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessageType | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [enterToSend, setEnterToSend] = useState<boolean>(readEnterToSend);

  // Mentions & typing
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<any>(null);

  // Modals & message search
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ChatChannelTypeDetail | null>(null);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessageType[]>([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const detailsRequestRef = useRef(0);

  const canCreateGroup = !!user && ['admin', 'creative_head', 'sm_manager'].includes(user.role);
  const isExecutive = user?.role === 'executive';
  const isAdmin = user?.role === 'admin';

  const myMembership = members.find((m) => String(m.userId ?? m.user?._id ?? '') === String(myId));
  const isGroupOwner = myMembership?.role === 'owner';

  // ── Data loading ────────────────────────────────────────────────────────────
  async function loadChannels() {
    try {
      const res = await apiFetch<{ channels: ChatChannelTypeDetail[] }>('/api/chat/channels');
      setChannels(res.channels || []);
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  }

  async function loadChannelDetails(channelId: string) {
    const requestId = ++detailsRequestRef.current;
    setReplyingTo(null);
    setEditingMessage(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchBox(false);
    setTypingUsers({});
    setActiveReactionMsgId(null);

    try {
      setLoadingMessages(true);
      const details = await apiFetch<{
        channel: ChatChannelTypeDetail;
        members: ChannelMemberType[];
        pinnedMessages: ChatMessageType[];
      }>(`/api/chat/channels/${channelId}`);
      if (requestId !== detailsRequestRef.current) return;

      setActiveChannel(details.channel);
      // The API populates the member profile into `userId`; expose it as `user` with a plain id.
      setMembers(
        (details.members || []).map((m: any) => {
          const profile = m.user ?? (m.userId && typeof m.userId === 'object' ? m.userId : undefined);
          return { ...m, user: profile, userId: profile?._id ?? m.userId };
        })
      );
      setPinnedMessages(details.pinnedMessages || []);

      const msgsRes = await apiFetch<{
        messages: ChatMessageType[];
        hasMore: boolean;
        nextCursor: string | null;
      }>(
        `/api/chat/channels/${channelId}/messages${
          highlightMessageId ? `?aroundMessageId=${highlightMessageId}` : ''
        }`
      );
      if (requestId !== detailsRequestRef.current) return;

      const list = msgsRes.messages || [];
      setMessages(list);
      setHasMore(msgsRes.hasMore || false);
      setNextCursor(msgsRes.nextCursor || null);
      setChannels((prev) => prev.map((c) => (idOf(c) === channelId ? { ...c, unreadCount: 0 } : c)));

      const lastMsg = list[list.length - 1];
      if (lastMsg) {
        apiFetch(`/api/chat/channels/${channelId}/read`, {
          method: 'POST',
          body: JSON.stringify({ messageId: idOf(lastMsg) }),
        }).catch(() => {});
      }

      setTimeout(() => {
        if (highlightMessageId) {
          document.getElementById(`msg-${highlightMessageId}`)?.scrollIntoView({ block: 'center' });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      }, 50);
    } catch (err) {
      console.error('Failed to load channel details:', err);
    } finally {
      if (requestId === detailsRequestRef.current) setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (!myId) return;
    loadChannels();
  }, [myId]);

  // The URL is the source of truth for the open conversation
  useEffect(() => {
    if (!myId) return;
    if (activeChannelId) {
      loadChannelDetails(activeChannelId);
    } else {
      detailsRequestRef.current++;
      setActiveChannel(null);
      setMessages([]);
      setMembers([]);
      setPinnedMessages([]);
    }
  }, [activeChannelId, myId]);

  useEffect(() => {
    setActiveHighlightId(highlightMessageId);
  }, [highlightMessageId]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket.isConnected || !activeChannelId) return;
    socket.joinChannel(activeChannelId);

    const unsubNew = socket.on('chat:message:new', (msg: ChatMessageType) => {
      const snippet = (msg.content || '').slice(0, 80);
      if (msg.channelId === activeChannelId) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
        setChannels((prev) =>
          prev.map((c) =>
            idOf(c) === msg.channelId ? { ...c, lastMessageSnippet: snippet, lastMessageAt: msg.createdAt } : c
          )
        );
        apiFetch(`/api/chat/channels/${activeChannelId}/read`, {
          method: 'POST',
          body: JSON.stringify({ messageId: idOf(msg) }),
        }).catch(() => {});
      } else {
        setChannels((prev) =>
          prev.map((c) =>
            idOf(c) === msg.channelId
              ? {
                  ...c,
                  unreadCount: (c.unreadCount || 0) + 1,
                  lastMessageSnippet: snippet,
                  lastMessageAt: msg.createdAt,
                }
              : c
          )
        );
      }
    });

    const unsubEdit = socket.on('chat:message:edited', (msg: ChatMessageType) => {
      if (msg.channelId === activeChannelId) {
        setMessages((prev) => prev.map((m) => (idOf(m) === idOf(msg) ? msg : m)));
      }
    });

    const unsubDel = socket.on('chat:message:deleted', (payload: { messageId: string; content: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          idOf(m) === payload.messageId ? { ...m, isDeleted: true, content: payload.content, attachments: [] } : m
        )
      );
    });

    const unsubReact = socket.on('chat:reaction:toggled', (payload: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => (idOf(m) === payload.messageId ? { ...m, reactions: payload.reactions } : m)));
    });

    const unsubPin = socket.on('chat:pin:toggled', (payload: { messageId: string; isPinned: boolean }) => {
      setMessages((prev) => prev.map((m) => (idOf(m) === payload.messageId ? { ...m, isPinned: payload.isPinned } : m)));
      apiFetch<any>(`/api/chat/channels/${activeChannelId}`)
        .then((d) => setPinnedMessages(d.pinnedMessages || []))
        .catch(() => {});
    });

    const unsubTyping = socket.on(
      'chat:typing',
      (data: { channelId: string; userId: string; userName: string; isTyping: boolean }) => {
        if (data.channelId === activeChannelId && data.userId !== myId) {
          setTypingUsers((prev) => {
            const updated = { ...prev };
            if (data.isTyping) updated[data.userId] = data.userName;
            else delete updated[data.userId];
            return updated;
          });
        }
      }
    );

    return () => {
      unsubNew();
      unsubEdit();
      unsubDel();
      unsubReact();
      unsubPin();
      unsubTyping();
      socket.leaveChannel(activeChannelId);
    };
  }, [socket.isConnected, activeChannelId, myId]);

  // ── Scrolling ───────────────────────────────────────────────────────────────
  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToMessage(messageId: string) {
    setActiveHighlightId(messageId);
    setMobilePanelOpen(false);
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 150);
    if (scrollTop === 0 && hasMore && nextCursor && !loadingMessages && activeChannelId) {
      loadMoreMessages();
    }
  }

  async function loadMoreMessages() {
    if (!activeChannelId || !nextCursor) return;
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const msgsRes = await apiFetch<{
        messages: ChatMessageType[];
        hasMore: boolean;
        nextCursor: string | null;
      }>(`/api/chat/channels/${activeChannelId}/messages?cursor=${encodeURIComponent(nextCursor)}`);
      setMessages((prev) => [...(msgsRes.messages || []), ...prev]);
      setHasMore(msgsRes.hasMore || false);
      setNextCursor(msgsRes.nextCursor || null);
      // Keep the reader's position after older messages are prepended
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousHeight;
      });
    } catch (err) {
      console.error('Failed to load older messages:', err);
    }
  }

  // ── Composer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [inputText]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isExecutive || !activeChannelId) return;
    if (!inputText.trim() && pendingFiles.length === 0) return;

    if (editingMessage) {
      try {
        await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${idOf(editingMessage)}`, {
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

    let uploadedAttachments: any[] = [];
    if (pendingFiles.length > 0) {
      try {
        setUploadingFiles(true);
        const formData = new FormData();
        pendingFiles.forEach((file) => formData.append('files', file));
        formData.append('channelId', activeChannelId);
        const uploadData = await apiFetch<{ attachments?: any[] }>(
          `/api/chat/upload?channelId=${encodeURIComponent(activeChannelId)}`,
          { method: 'POST', body: formData }
        );
        if (uploadData.attachments) uploadedAttachments = uploadData.attachments;
      } catch (err: any) {
        console.error('Upload error:', err);
        alert(err?.message || 'Failed to upload attachments.');
        setUploadingFiles(false);
        return;
      } finally {
        setUploadingFiles(false);
      }
    }

    const payload = {
      content: inputText.trim(),
      replyToId: replyingTo ? idOf(replyingTo) : null,
      attachments: uploadedAttachments,
    };

    setInputText('');
    setReplyingTo(null);
    setPendingFiles([]);
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

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1 && !textBeforeCursor.slice(lastAtIdx).includes(' ')) {
      setMentionQuery(textBeforeCursor.slice(lastAtIdx + 1).toLowerCase());
      setMentionPosition(lastAtIdx);
    } else {
      setMentionQuery(null);
    }

    if (activeChannelId) {
      socket.emitTyping(activeChannelId, true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emitTyping(activeChannelId, false), 2500);
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    const shouldSend = enterToSend ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (shouldSend) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function selectMention(mentionText: string) {
    const before = inputText.slice(0, mentionPosition);
    const after = inputText.slice(textareaRef.current?.selectionStart || mentionPosition);
    setInputText(`${before}@${mentionText} ${after}`);
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  // ── Message actions ─────────────────────────────────────────────────────────
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
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${messageId}/pin`, { method: 'POST' });
    } catch (err: any) {
      alert(err.message || 'Failed to pin message.');
    }
  }

  async function deleteMessage(messageId: string) {
    if (!activeChannelId || !confirm('Are you sure you want to delete this message?')) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/messages/${messageId}`, { method: 'DELETE' });
    } catch (err: any) {
      alert(err.message || 'Failed to delete message.');
    }
  }

  // ── Chat settings actions ───────────────────────────────────────────────────
  async function toggleMute() {
    if (!activeChannel || !activeChannelId) return;
    const newMute = !activeChannel.isMuted;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/mute`, {
        method: 'POST',
        body: JSON.stringify({ isMuted: newMute }),
      });
      setActiveChannel((prev) => (prev ? { ...prev, isMuted: newMute } : null));
      setChannels((prev) => prev.map((c) => (idOf(c) === activeChannelId ? { ...c, isMuted: newMute } : c)));
    } catch (err: any) {
      alert(err.message || 'Failed to update notifications.');
    }
  }

  function toggleEnterToSend() {
    setEnterToSend((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ENTER_TO_SEND_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable: keep in-memory preference */
      }
      return next;
    });
  }

  async function archiveGroup() {
    if (!activeChannelId || !confirm('Archive this group? It becomes read-only for everyone.')) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/archive`, { method: 'POST' });
      await Promise.all([loadChannels(), loadChannelDetails(activeChannelId)]);
    } catch (err: any) {
      alert(err.message || 'Failed to archive group.');
    }
  }

  async function unarchiveGroup() {
    if (!activeChannelId) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/unarchive`, { method: 'POST' });
      await Promise.all([loadChannels(), loadChannelDetails(activeChannelId)]);
    } catch (err: any) {
      alert(err.message || 'Failed to unarchive group.');
    }
  }

  async function leaveGroup() {
    if (!activeChannelId || !myId || !confirm('Leave this group? You will stop receiving its messages.')) return;
    try {
      await apiFetch(`/api/chat/channels/${activeChannelId}/members/${myId}`, { method: 'DELETE' });
      await loadChannels();
      navigate('/chat');
    } catch (err: any) {
      alert(err.message || 'Failed to leave group.');
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await apiFetch<{ results: ChatMessageType[] }>(`/api/chat/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }

  function closeSearch() {
    setShowSearchBox(false);
    setSearchResults([]);
    setSearchQuery('');
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  const openChannel = (channelId: string, messageId?: string) =>
    navigate(`/chat/${channelId}${messageId ? `?m=${messageId}` : ''}`);

  const toggleDetails = () => {
    const isWide = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1280px)').matches;
    if (isWide) setPanelOpen((v) => !v);
    else setMobilePanelOpen(true);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const list: Array<{ label: string; sub?: string }> = [];
    if (canCreateGroup && 'everyone'.startsWith(mentionQuery)) {
      list.push({ label: 'everyone', sub: 'Notify everyone in this chat' });
    }
    members.forEach((m) => {
      const u = m.user;
      if (u && (u.preferredName?.toLowerCase().includes(mentionQuery) || u.name.toLowerCase().includes(mentionQuery))) {
        list.push({ label: u.preferredName || u.name, sub: u.jobRole || u.role });
      }
    });
    return list.slice(0, 5);
  }, [mentionQuery, members, canCreateGroup]);

  const filteredChannels = useMemo(
    () => channels.filter((c) => c.name.toLowerCase().includes(channelFilter.toLowerCase())),
    [channels, channelFilter]
  );
  const teamChannels = filteredChannels.filter((c) => c.type === 'team');
  const groupChannels = filteredChannels.filter((c) => c.type === 'group' && !c.isArchived);
  const dmChannels = filteredChannels.filter((c) => c.type === 'dm');
  const archivedChannels = filteredChannels.filter((c) => c.isArchived);

  const media = useMemo(() => {
    const photos: Array<{ url: string; name: string; messageId: string }> = [];
    const files: Array<{ url: string; name: string; messageId: string; isVideo: boolean }> = [];
    const shared: Array<{ messageId: string; card: NonNullable<ChatMessageType['sharedMedia']> }> = [];
    messages.forEach((m) => {
      const mid = idOf(m);
      (m.attachments || []).forEach((att) => {
        if (att.mimeType.startsWith('image/')) photos.push({ url: att.storageUrl, name: att.fileName, messageId: mid });
        else files.push({ url: att.storageUrl, name: att.fileName, messageId: mid, isVideo: att.mimeType.startsWith('video/') });
      });
      if (m.sharedMedia && !m.sharedMedia.isRevoked) shared.push({ messageId: mid, card: m.sharedMedia });
    });
    return { photos, files, shared };
  }, [messages]);

  const typingNames = Object.values(typingUsers);

  // ── Renderers ───────────────────────────────────────────────────────────────
  const renderChannelRow = (c: ChatChannelTypeDetail) => {
    const id = idOf(c);
    const isSelected = id === activeChannelId;
    const unread = c.unreadCount || 0;
    const preview =
      c.lastMessageSnippet ||
      (c.type === 'dm' ? c.otherUser?.jobRole || 'Direct message' : c.description || 'No messages yet');
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => openChannel(id)}
          aria-current={isSelected ? 'true' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink ${
            isSelected ? 'bg-white/70' : 'hover:bg-white/70'
          } ${c.isArchived ? 'opacity-70' : ''}`}
        >
          <ChannelAvatar channel={c} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${unread > 0 && !isSelected ? 'font-bold text-ui-ink' : 'font-semibold text-ui-text'}`}>
                {c.type === 'dm' ? c.otherUser?.preferredName || c.otherUser?.name || c.name : c.name}
              </span>
              <span className="text-[11px] text-ui-muted shrink-0">{formatListTime(c.lastMessageAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs text-ui-muted truncate">{preview}</span>
              <span className="flex items-center gap-1 shrink-0">
                {c.isMuted && <BellOff className="w-3.5 h-3.5 text-ui-muted" aria-label="Muted" />}
                {unread > 0 && !isSelected && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-ui-ink text-white text-[11px] font-semibold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </span>
            </div>
          </div>
        </button>
      </li>
    );
  };

  const renderMessages = () => {
    const rows: React.ReactNode[] = [];
    messages.forEach((msg, index) => {
      const id = idOf(msg);
      const prev = messages[index - 1];
      const createdAt = new Date(msg.createdAt);
      const showDate = !prev || !isSameDay(new Date(prev.createdAt), createdAt);
      const authorKey = idOf(msg.authorId);
      const grouped =
        !showDate &&
        !!prev &&
        idOf(prev.authorId) === authorKey &&
        createdAt.getTime() - new Date(prev.createdAt).getTime() < GROUPING_WINDOW_MS;
      const isMine = !!authorKey && authorKey === myId;
      const authorName = msg.authorId?.preferredName || msg.authorId?.name || 'Unknown';
      const isHighlighted = activeHighlightId === id;
      const hasBubble = !!(msg.content || msg.replyPreview || msg.isDeleted || (msg.attachments && msg.attachments.length > 0));
      const showName = !isMine && !grouped && activeChannel?.type !== 'dm';

      if (showDate) {
        rows.push(
          <div key={`day-${id}`} className="flex items-center gap-3 my-5 first:mt-0" role="separator">
            <span className="h-px flex-1 bg-ui-line" />
            <span className="text-[11px] font-medium text-ui-muted px-2.5 py-0.5 rounded-full bg-white border border-ui-line">
              {formatDayLabel(createdAt)}
            </span>
            <span className="h-px flex-1 bg-ui-line" />
          </div>
        );
      }

      rows.push(
        <div
          key={id}
          id={`msg-${id}`}
          className={`group relative flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-1' : 'mt-4'}`}
        >
          {!isMine &&
            (grouped ? (
              <div className="w-7 shrink-0" aria-hidden="true" />
            ) : (
              <Avatar url={msg.authorId?.avatarUrl} name={authorName} userId={authorKey} size="sm" />
            ))}

          <div className={`flex flex-col min-w-0 max-w-[85%] md:max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
            {!hasBubble && showName && <span className="text-xs font-semibold text-ui-ink mb-1 px-1">{authorName}</span>}

            {hasBubble && (
              <div
                className={`rounded-2xl px-3.5 py-2 shadow-sm transition-shadow ${
                  isMine
                    ? `bg-ui-ink text-white ${grouped ? '' : 'rounded-tr-md'}`
                    : `bg-white text-ui-text border border-ui-line ${grouped ? '' : 'rounded-tl-md'}`
                } ${isHighlighted ? 'ring-2 ring-ui-ink ring-offset-2 ring-offset-white' : ''}`}
              >
                {showName && <div className="text-xs font-semibold text-ui-ink mb-0.5">{authorName}</div>}

                {msg.replyPreview && (
                  <div
                    className={`mb-1.5 pl-2.5 py-0.5 border-l-2 text-xs ${
                      isMine ? 'border-white/60 text-white/80' : 'border-ui-line text-ui-muted'
                    }`}
                  >
                    <span className="font-semibold">{msg.replyPreview.authorName}</span>
                    <span className="block line-clamp-2">{msg.replyPreview.content}</span>
                  </div>
                )}

                {msg.content && (
                  <p
                    className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.isDeleted ? `italic ${isMine ? 'text-white/70' : 'text-ui-muted'}` : ''
                    }`}
                  >
                    {msg.content}
                  </p>
                )}

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.attachments.map((att, attIdx) =>
                      att.mimeType.startsWith('image/') ? (
                        <a
                          key={attIdx}
                          href={safeUrl(att.storageUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl overflow-hidden"
                        >
                          <img src={safeUrl(att.storageUrl)} alt={att.fileName} className="max-h-60 max-w-full object-cover rounded-xl" />
                        </a>
                      ) : (
                        <a
                          key={attIdx}
                          href={safeUrl(att.storageUrl)}
                          download={att.fileName}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            isMine ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white/60 hover:bg-white/70 text-ui-text border border-ui-line'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate max-w-[220px]">{att.fileName}</span>
                        </a>
                      )
                    )}
                  </div>
                )}

                <div
                  className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${isMine ? 'text-white/70' : 'text-ui-muted'}`}
                >
                  {msg.isPinned && <Pin className="w-3 h-3" aria-label="Pinned" />}
                  {msg.isEdited && <span>edited</span>}
                  <time dateTime={msg.createdAt}>{formatTime(msg.createdAt)}</time>
                </div>
              </div>
            )}

            {msg.sharedMedia && (
              <div className="mt-1.5 w-full max-w-md">
                <MediaCardPlayer
                  card={msg.sharedMedia}
                  onRevoked={(grantId) => {
                    setMessages((prevMsgs) =>
                      prevMsgs.map((m) =>
                        m.sharedMedia?.grantId === grantId ? { ...m, sharedMedia: { ...m.sharedMedia, isRevoked: true } } : m
                      )
                    );
                  }}
                />
              </div>
            )}

            {msg.reactions && msg.reactions.length > 0 && (
              <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? 'justify-end' : ''}`}>
                {msg.reactions.map((r, rIdx) => {
                  const hasReacted = r.userIds.some((uid) => uid.toString() === myId.toString());
                  return (
                    <button
                      key={rIdx}
                      type="button"
                      onClick={() => toggleReaction(id, r.emoji)}
                      disabled={isExecutive}
                      className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs border transition-colors ${
                        hasReacted
                          ? 'bg-white/70 text-ui-ink border-ui-line font-semibold'
                          : 'bg-white text-ui-text border-ui-line hover:bg-white/70'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="text-[11px]">{r.userIds.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hover actions */}
          {!isExecutive && !msg.isDeleted && (
            <div
              className={`absolute -top-3 ${isMine ? 'right-2' : 'left-11'} hidden group-hover:flex group-focus-within:flex items-center gap-0.5 bg-white border border-ui-line shadow-md rounded-xl p-0.5 z-10`}
            >
              <button
                type="button"
                onClick={() => setActiveReactionMsgId(activeReactionMsgId === id ? null : id)}
                className="ui-icon-btn border-transparent"
                title="React"
                aria-label="React"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(msg);
                  textareaRef.current?.focus();
                }}
                className="ui-icon-btn border-transparent"
                title="Reply"
                aria-label="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
              {(canCreateGroup || activeChannel?.type === 'group') && (
                <button
                  type="button"
                  onClick={() => togglePin(id)}
                  className="ui-icon-btn border-transparent"
                  title={msg.isPinned ? 'Unpin' : 'Pin'}
                  aria-label={msg.isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {isMine && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(msg);
                    setInputText(msg.content);
                    textareaRef.current?.focus();
                  }}
                  className="ui-icon-btn border-transparent"
                  title="Edit"
                  aria-label="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {(isMine || isAdmin) && (
                <button
                  type="button"
                  onClick={() => deleteMessage(id)}
                  className="ui-icon-btn border-transparent"
                  title="Delete"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {activeReactionMsgId === id && (
            <div className={`absolute top-6 ${isMine ? 'right-2' : 'left-11'} z-30`}>
              <QuickReactionsBar
                onReact={(emoji) => toggleReaction(id, emoji)}
                onClose={() => setActiveReactionMsgId(null)}
                currentReactions={
                  msg.reactions
                    ?.filter((r) => r.userIds.some((uid) => uid.toString() === myId.toString()))
                    .map((r) => r.emoji) || []
                }
              />
            </div>
          )}
        </div>
      );
    });
    return rows;
  };

  const renderDetailsPanel = (onClose: () => void) => {
    if (!activeChannel) return null;
    const isGroup = activeChannel.type === 'group';
    const canEditGroup = isGroup && canCreateGroup && !activeChannel.isArchived;
    const canArchive = isGroup && !activeChannel.isArchived && (isGroupOwner || isAdmin);
    const canUnarchive = isGroup && activeChannel.isArchived && isAdmin;
    const canLeave = isGroup && !activeChannel.isArchived && !!myMembership;

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="h-16 px-5 flex items-center justify-between border-b border-ui-line shrink-0">
          <h3 className="text-[15px] font-semibold text-ui-ink">Chat info</h3>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close chat info" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 shrink-0" role="tablist" aria-label="Chat info sections">
          <div className="ui-tabs grid grid-cols-2 w-full">
            {(['details', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={panelTab === tab}
                onClick={() => setPanelTab(tab)}
                className="ui-tab justify-center"
              >
                {tab === 'details' ? 'Details' : 'Settings'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6" role="tabpanel">
          {panelTab === 'details' ? (
            <>
              {/* Overview */}
              <div className="flex items-center gap-3">
                <ChannelAvatar channel={activeChannel} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ui-ink truncate">{activeChannel.name}</p>
                  <p className="text-xs text-ui-muted">Created {new Date(activeChannel.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {activeChannel.description && <p className="text-xs text-ui-text leading-relaxed -mt-3">{activeChannel.description}</p>}

              {/* Media & files */}
              <section>
                <SectionTitle>Media & files</SectionTitle>
                <div className="rounded-xl border border-ui-line divide-y divide-slate-100">
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-sm text-ui-text">
                      <ImageIcon className="w-4 h-4 text-ui-muted" />
                      <span className="flex-1">Photos</span>
                      <span className="text-xs text-ui-muted">{media.photos.length}</span>
                    </div>
                    {media.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                        {media.photos.slice(0, 6).map((p, i) => (
                          <button
                            key={`${p.messageId}-${i}`}
                            type="button"
                            onClick={() => scrollToMessage(p.messageId)}
                            className="aspect-square rounded-lg overflow-hidden bg-ui-canvas"
                            title={p.name}
                          >
                            <img src={safeUrl(p.url)} alt={p.name} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-sm text-ui-text">
                      <FileText className="w-4 h-4 text-ui-muted" />
                      <span className="flex-1">Files</span>
                      <span className="text-xs text-ui-muted">{media.files.length}</span>
                    </div>
                    {media.files.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {media.files.slice(0, 5).map((f, i) => (
                          <li key={`${f.messageId}-${i}`}>
                            <a
                              href={safeUrl(f.url)}
                              download={f.name}
                              className="flex items-center gap-2 text-xs text-ui-text hover:text-ui-ink truncate"
                            >
                              {f.isVideo ? <Film className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{f.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 text-sm text-ui-text">
                      <Film className="w-4 h-4 text-ui-muted" />
                      <span className="flex-1">Shared deliverables</span>
                      <span className="text-xs text-ui-muted">{media.shared.length}</span>
                    </div>
                    {media.shared.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {media.shared.slice(0, 5).map(({ messageId, card }, i) => (
                          <li key={card.grantId || i}>
                            <button
                              type="button"
                              onClick={() => scrollToMessage(messageId)}
                              className="w-full text-left text-xs text-ui-text hover:text-ui-ink"
                            >
                              <span className="block font-medium truncate">{card.title}</span>
                              <span className="block text-[11px] text-ui-muted truncate">
                                {card.contentPieceTitle} • {card.stageKey}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {/* Pinned */}
              <section>
                <SectionTitle>Pinned messages ({pinnedMessages.length})</SectionTitle>
                {pinnedMessages.length === 0 ? (
                  <p className="text-xs text-ui-muted">Nothing pinned yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {pinnedMessages.map((pm) => (
                      <li key={idOf(pm)}>
                        <button
                          type="button"
                          onClick={() => scrollToMessage(idOf(pm))}
                          className="w-full text-left p-2.5 rounded-xl bg-white/60 hover:bg-white border border-ui-line transition-colors"
                        >
                          <span className="block text-[11px] text-ui-muted">{pm.authorId?.preferredName || pm.authorId?.name}</span>
                          <span className="block text-xs text-ui-text line-clamp-2">{pm.content || pm.sharedMedia?.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Members */}
              <section>
                <SectionTitle
                  action={
                    canEditGroup ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup(activeChannel);
                          setShowGroupModal(true);
                        }}
                        className="inline-flex items-center gap-1 min-h-[44px] px-3 -mr-3 rounded-full text-xs font-semibold text-ui-ink hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    ) : undefined
                  }
                >
                  Members ({members.length})
                </SectionTitle>
                <ul className="space-y-1">
                  {members.map((m) => {
                    const u = m.user;
                    if (!u) return null;
                    return (
                      <li key={m._id} className="flex items-center gap-2.5 py-1.5">
                        <Avatar url={u.avatarUrl} name={u.preferredName || u.name} userId={u._id} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ui-text truncate">{u.preferredName || u.name}</p>
                          <p className="text-[11px] text-ui-muted truncate">{u.jobRole || u.role}</p>
                        </div>
                        {m.role === 'owner' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/70 text-ui-ink">Owner</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : (
            <>
              <section>
                <SectionTitle>Notifications</SectionTitle>
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-ui-line">
                  <div>
                    <p className="text-sm font-medium text-ui-text">Mute this chat</p>
                    <p className="text-xs text-ui-muted mt-0.5">Stop notifications for new messages here.</p>
                  </div>
                  <Switch checked={!!activeChannel.isMuted} onChange={toggleMute} label="Mute this chat" />
                </div>
              </section>

              <section>
                <SectionTitle>Messaging</SectionTitle>
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-ui-line">
                  <div>
                    <p className="text-sm font-medium text-ui-text">Press Enter to send</p>
                    <p className="text-xs text-ui-muted mt-0.5">
                      {enterToSend ? 'Shift + Enter adds a new line.' : 'Use Ctrl + Enter to send.'} Saved on this device.
                    </p>
                  </div>
                  <Switch checked={enterToSend} onChange={toggleEnterToSend} label="Press Enter to send" />
                </div>
              </section>

              {isGroup && (canEditGroup || canArchive || canUnarchive || canLeave) && (
                <section>
                  <SectionTitle>Group</SectionTitle>
                  <div className="rounded-xl border border-ui-line divide-y divide-slate-100 overflow-hidden">
                    {canEditGroup && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup(activeChannel);
                          setShowGroupModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 text-sm text-ui-text hover:bg-white/70 text-left"
                      >
                        <Settings2 className="w-4 h-4 text-ui-muted" />
                        Edit group details & members
                      </button>
                    )}
                    {canArchive && (
                      <button
                        type="button"
                        onClick={archiveGroup}
                        className="w-full flex items-center gap-3 px-3 py-3 text-sm text-ui-text hover:bg-white/70 text-left"
                      >
                        <Archive className="w-4 h-4" />
                        Archive group
                      </button>
                    )}
                    {canUnarchive && (
                      <button
                        type="button"
                        onClick={unarchiveGroup}
                        className="w-full flex items-center gap-3 px-3 py-3 text-sm text-ui-text hover:bg-white/70 text-left"
                      >
                        <ArchiveRestore className="w-4 h-4 text-ui-muted" />
                        Unarchive group
                      </button>
                    )}
                    {canLeave && (
                      <button
                        type="button"
                        onClick={leaveGroup}
                        className="w-full flex items-center gap-3 px-3 py-3 text-sm text-ui-text hover:bg-white/70 text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Leave group
                      </button>
                    )}
                  </div>
                </section>
              )}

              <p className="text-[11px] text-ui-muted">Mute and Enter-to-send apply only to you.</p>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Layout ──────────────────────────────────────────────────────────────────
  const card = 'glass-card overflow-hidden';

  return (
    <div
      className="flex gap-3 font-sans h-[calc(100vh-136px)] min-h-[520px]"
      data-testid="chat-page-root"
    >
      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <aside
        className={`${isConversationOpen ? 'hidden lg:flex' : 'flex'} ${card} flex-col w-full lg:w-80 xl:w-[340px] shrink-0`}
        aria-label="Conversations"
      >
        <div className="px-4 pt-4 pb-3 border-b border-ui-line space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ui-ink tracking-tight">Team Chat</h2>
            {canCreateGroup && (
              <button
                type="button"
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                title="New group"
                aria-label="New group"
                className={iconButton}
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
            <input
              type="search"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="ui-input w-full pl-9 pr-3"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4" aria-label="Chat list">
          {teamChannels.length > 0 && (
            <div>
              <h3 className="px-3 pb-1 text-[11px] font-semibold text-ui-muted">Team</h3>
              <ul className="space-y-0.5">{teamChannels.map(renderChannelRow)}</ul>
            </div>
          )}

          <div>
            <h3 className="px-3 pb-1 text-[11px] font-semibold text-ui-muted">
              Groups ({groupChannels.length})
            </h3>
            {groupChannels.length === 0 ? (
              <p className="px-3 py-1 text-xs text-ui-muted">No groups yet</p>
            ) : (
              <ul className="space-y-0.5">{groupChannels.map(renderChannelRow)}</ul>
            )}
          </div>

          <div>
            <h3 className="px-3 pb-1 text-[11px] font-semibold text-ui-muted">Direct Messages</h3>
            {dmChannels.length === 0 ? (
              <p className="px-3 py-1 text-xs text-ui-muted">No direct messages yet</p>
            ) : (
              <ul className="space-y-0.5">{dmChannels.map(renderChannelRow)}</ul>
            )}
          </div>

          {archivedChannels.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                aria-expanded={showArchived}
                className="w-full px-3 pb-1 flex items-center justify-between text-xs font-semibold text-ui-muted hover:text-ui-ink min-h-[44px]"
              >
                <span>Archived ({archivedChannels.length})</span>
                {showArchived ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {showArchived && <ul className="space-y-0.5">{archivedChannels.map(renderChannelRow)}</ul>}
            </div>
          )}
        </nav>
      </aside>

      {/* ── Conversation ──────────────────────────────────────────────────── */}
      <section
        className={`${isConversationOpen ? 'flex' : 'hidden lg:flex'} ${card} flex-1 min-w-0 flex-col relative`}
        aria-label="Conversation"
      >
        {!isConversationOpen ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div className="max-w-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/70 text-ui-ink flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-ui-ink">Select a conversation</p>
              <p className="text-sm text-ui-muted mt-1">Pick a chat from the list to start messaging.</p>
            </div>
          </div>
        ) : !activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ui-muted">Loading conversation…</div>
        ) : (
          <>
            {/* Header */}
            <header className="h-16 px-3 sm:px-4 flex items-center gap-3 border-b border-ui-line shrink-0">
              <button
                type="button"
                onClick={() => navigate('/chat')}
                className={`${iconButton} lg:hidden`}
                title="Back to all chats"
                aria-label="Back to all chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <ChannelAvatar channel={activeChannel} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-[15px] font-semibold text-ui-ink truncate">{activeChannel.name}</h3>
                  {activeChannel.isMuted && <BellOff className="w-3.5 h-3.5 text-ui-muted shrink-0" aria-label="Muted" />}
                  {activeChannel.isArchived && (
                    <span className="status-chip status-waiting text-[11px] font-semibold px-1.5 py-0.5 shrink-0">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-xs text-ui-muted truncate">
                  {activeChannel.type === 'dm'
                    ? activeChannel.otherUser?.jobRole || activeChannel.otherUser?.role
                    : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => (showSearchBox ? closeSearch() : setShowSearchBox(true))}
                  className={`${iconButton} ${showSearchBox ? 'bg-white/70 text-ui-ink' : ''}`}
                  title="Search messages"
                  aria-label="Search messages"
                  aria-pressed={showSearchBox}
                >
                  <Search className="w-[18px] h-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={toggleDetails}
                  className={`${iconButton} ${panelOpen ? 'xl:bg-white xl:text-ui-ink' : ''}`}
                  title="Chat info"
                  aria-label="Chat info"
                >
                  <PanelRight className="w-[18px] h-[18px]" />
                </button>
              </div>
            </header>

            {/* Message search */}
            {showSearchBox && (
              <div className="px-4 py-3 border-b border-ui-line bg-white">
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted" />
                    <input
                      type="search"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages in your chats"
                      aria-label="Search messages"
                      className="ui-input w-full pl-9 pr-3"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="h-9 px-4 text-sm font-semibold text-white bg-ui-ink hover:bg-ui-ink/85 rounded-xl disabled:opacity-50"
                  >
                    {searching ? 'Searching…' : 'Search'}
                  </button>
                </form>
                {searchResults.length > 0 && (
                  <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5">
                    <p className="text-xs text-ui-muted">{searchResults.length} results</p>
                    {searchResults.map((sm) => (
                      <button
                        key={idOf(sm)}
                        type="button"
                        onClick={() => {
                          closeSearch();
                          if (sm.channelId === activeChannelId) scrollToMessage(idOf(sm));
                          else openChannel(sm.channelId, idOf(sm));
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-ui-line hover:border-ui-ink/30 hover:bg-white transition-colors"
                      >
                        <span className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-ui-text truncate">
                            {sm.authorId?.preferredName || sm.authorId?.name}
                          </span>
                          <span className="text-ui-muted shrink-0">{new Date(sm.createdAt).toLocaleString()}</span>
                        </span>
                        <span className="block text-sm text-ui-text truncate mt-0.5">{sm.content}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pinned ribbon */}
            {pinnedMessages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToMessage(idOf(pinnedMessages[0]))}
                className="px-4 py-2 flex items-center gap-2.5 border-b border-ui-line bg-white/70 hover:bg-white text-left transition-colors"
              >
                <Pin className="w-4 h-4 text-ui-ink shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold text-ui-ink">
                    Pinned message{pinnedMessages.length > 1 ? ` (${pinnedMessages.length})` : ''}
                  </span>
                  <span className="block text-xs text-ui-text truncate">
                    {pinnedMessages[0].content || pinnedMessages[0].sharedMedia?.title || 'Announcement'}
                  </span>
                </span>
              </button>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-5"
              data-testid="chat-message-stream"
            >
              {loadingMessages ? (
                <div className="text-center py-10 text-sm text-ui-muted">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-ui-muted">
                  <div>
                    <MessageSquare className="w-10 h-10 mx-auto text-ui-muted/60 mb-2" aria-hidden="true" />
                    <p className="text-sm font-medium text-ui-text">No messages yet</p>
                    <p className="text-xs mt-1">Say hello to start the conversation.</p>
                  </div>
                </div>
              ) : (
                renderMessages()
              )}
              <div ref={messagesEndRef} />
            </div>

            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-28 right-6 w-11 h-11 rounded-full bg-white text-ui-ink shadow-ui-card border border-ui-line flex items-center justify-center hover:bg-ui-card-hover z-20"
                title="Jump to latest"
                aria-label="Jump to latest messages"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}

            {/* Composer */}
            <div className="relative px-3 sm:px-4 pt-2 pb-3 sm:pb-4 border-t border-ui-line bg-white shrink-0">
              {typingNames.length > 0 && (
                <p className="px-1 pb-1.5 text-xs text-ui-muted">
                  {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
                </p>
              )}

              {isExecutive ? (
                <div className="p-3 rounded-xl bg-white/60 text-center text-sm text-ui-muted">
                  Executives have read-only access in team channels.
                </div>
              ) : activeChannel.isArchived ? (
                <div className="p-3 rounded-xl status-tint status-waiting text-center text-sm">
                  This group is archived and read-only.
                </div>
              ) : (
                <>
                  {(replyingTo || editingMessage) && (
                    <div className="mb-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/60 text-xs">
                      {replyingTo ? (
                        <Reply className="w-4 h-4 text-ui-ink shrink-0" />
                      ) : (
                        <Edit2 className="w-4 h-4 text-ui-ink shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-ui-text">
                        {replyingTo ? (
                          <>
                            Replying to{' '}
                            <strong className="text-ui-ink">
                              {replyingTo.authorId?.preferredName || replyingTo.authorId?.name}
                            </strong>
                            : {replyingTo.content}
                          </>
                        ) : (
                          'Editing message'
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingMessage) setInputText('');
                          setReplyingTo(null);
                          setEditingMessage(null);
                        }}
                        className="ui-icon-btn border-transparent"
                        aria-label="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {pendingFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingFiles.map((file, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-white text-xs text-ui-text border border-ui-line"
                        >
                          <FileText className="w-3.5 h-3.5 text-ui-muted" />
                          <span className="truncate max-w-[160px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== fIdx))}
                            className="p-0.5 rounded text-ui-muted hover:text-ui-ink"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-64 max-h-52 overflow-y-auto bg-white border border-ui-line shadow-xl rounded-xl p-1 z-40">
                      {mentionSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectMention(s.label)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white text-sm flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-ui-ink truncate">@{s.label}</span>
                          {s.sub && <span className="text-[11px] text-ui-muted shrink-0">{s.sub}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {showEmojiPicker && (
                    <EmojiPicker
                      onSelect={(emoji) => setInputText((prev) => prev + emoji)}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-end gap-1 rounded-ui-card border border-ui-line bg-white px-1.5 py-1.5 focus-within:ring-2 focus-within:ring-ui-ink transition-shadow"
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
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach files (images, docs, video)"
                      aria-label="Attach files"
                      className={iconButton}
                    >
                      <Paperclip className="w-[18px] h-[18px]" />
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleTypingChange}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={`Message ${activeChannel.name}`}
                      aria-label="Message"
                      rows={1}
                      className="flex-1 min-w-0 self-center resize-none max-h-40 bg-transparent px-2 py-2.5 text-[15px] leading-6 text-ui-text placeholder:text-ui-muted focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      title="Add emoji"
                      aria-label="Add emoji"
                      className={iconButton}
                    >
                      <Smile className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingFiles || (!inputText.trim() && pendingFiles.length === 0)}
                      className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-ui-ink hover:bg-ui-ink/85 text-white disabled:opacity-40 disabled:hover:bg-ui-ink transition-colors shrink-0"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="hidden sm:block px-1 pt-1.5 text-[11px] text-ui-muted">
                    {enterToSend ? 'Enter to send · Shift + Enter for a new line' : 'Ctrl + Enter to send'}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Chat info (inline on wide screens) ────────────────────────────── */}
      {isConversationOpen && activeChannel && panelOpen && (
        <aside className={`hidden xl:flex ${card} flex-col w-80 shrink-0`} aria-label="Chat info">
          {renderDetailsPanel(() => setPanelOpen(false))}
        </aside>
      )}

      {/* ── Chat info (overlay on smaller screens) ────────────────────────── */}
      {isConversationOpen && activeChannel && mobilePanelOpen && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 ui-scrim" onClick={() => setMobilePanelOpen(false)} aria-hidden="true" />
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Chat info"
            className="absolute inset-y-0 right-0 w-full max-w-sm ui-drawer rounded-l-ui-panel overflow-hidden flex flex-col"
          >
            {renderDetailsPanel(() => setMobilePanelOpen(false))}
          </aside>
        </div>
      )}

      {showGroupModal && (
        <GroupModal
          channelToEdit={editingGroup}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSuccess={(newChan) => {
            const newId = idOf(newChan);
            loadChannels();
            if (editingGroup && activeChannelId) loadChannelDetails(activeChannelId);
            else if (newId) openChannel(newId);
          }}
        />
      )}
    </div>
  );
}
