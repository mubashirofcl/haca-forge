import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Reply,
  Check,
  CheckCheck,
  CheckCircle2,
  RotateCcw,
  Clock,
  ArrowDown,
  X,
  MessageSquare,
  Lock,
  Share2,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Avatar } from '../../../components/Avatar';
import { MediaMessageType } from '@mmp/shared';
import { ShareToChatModal } from '../../chat/ShareToChatModal';

interface MediaThreadProps {
  clipId: string;
  clipTitle: string;
  onSeekTime?: (seconds: number) => void;
  externalTimestamp?: string | null;
  onClearTimestamp?: () => void;
  readOnly?: boolean;
  isApproved?: boolean;
  contentPieceId?: string;
}

export const MediaThread: React.FC<MediaThreadProps> = ({
  clipId,
  clipTitle,
  onSeekTime,
  externalTimestamp,
  onClearTimestamp,
  readOnly = false,
  isApproved = false,
  contentPieceId = '',
}) => {
  const { user } = useAuth();
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [messages, setMessages] = useState<MediaMessageType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<MediaMessageType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showJumpButton, setShowJumpButton] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = user?._id || (user as any)?.id || (user as any)?.userId;
  const isReviewer = user?.role === 'creative_head' || user?.role === 'admin';
  const isReadOnlyRole = user?.role === 'sm_manager' || user?.role === 'executive' || readOnly;

  // Sync external timestamp from player "Reference this moment"
  useEffect(() => {
    if (externalTimestamp) {
      setInputText((prev) => (prev ? `${prev} ${externalTimestamp} ` : `${externalTimestamp} `));
      if (inputRef.current) {
        inputRef.current.focus();
      }
      if (onClearTimestamp) onClearTimestamp();
    }
  }, [externalTimestamp, onClearTimestamp]);

  // Fetch messages and mark as seen
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>(`/api/clips/${clipId}/messages`);
      const data = res?.data || res;
      const list = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
      setMessages(list);

      // Mark seen
      await apiFetch(`/api/clips/${clipId}/messages/seen`, { method: 'POST' }).catch(() => {});
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clipId) {
      fetchMessages();
    }
  }, [clipId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!showJumpButton && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, showJumpButton]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 120;
    setShowJumpButton(isUp);
  };

  const jumpToLatest = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setShowJumpButton(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSubmitting || isReadOnlyRole) return;

    // Detect time reference e.g. "at 0:12" or "0:12"
    let timeSeconds: number | null = null;
    const timeMatch = inputText.match(/(?:at\s+|@\s*)?(\d+):([0-5]\d)/i);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      timeSeconds = minutes * 60 + seconds;
    }

    try {
      setIsSubmitting(true);
      const res = await apiFetch<any>(`/api/clips/${clipId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          text: inputText.trim(),
          timeSeconds,
          replyToId: replyingTo ? replyingTo._id : null,
        }),
      });

      const newMsg = res?.data || res;
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setReplyingTo(null);
      setTimeout(() => jumpToLatest(), 100);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDone = async (message: MediaMessageType, done: boolean) => {
    try {
      const res = await apiFetch<any>(
        `/api/clips/${clipId}/messages/${message._id}/toggle-done`,
        {
          method: 'PATCH',
          body: JSON.stringify({ done }),
        }
      );
      const updated = res?.data || res;
      setMessages((prev) =>
        prev.map((m) => (m._id === message._id ? { ...m, ...updated } : m))
      );
    } catch (err: any) {
      alert(err.message || 'Action not permitted');
    }
  };

  // Parses text to extract timestamps into clickable seeking chips
  const renderMessageContent = (text?: string) => {
    if (!text) return null;
    const timeRegex = /((?:at\s+|@\s*)?\b\d+:[0-5]\d\b)/gi;
    const parts = text.split(timeRegex);

    return parts.map((part, index) => {
      const match = part.match(/(?:at\s+|@\s*)?(\d+):([0-5]\d)/i);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const totalSecs = minutes * 60 + seconds;

        return (
          <button
            key={`btn-time-${index}-${totalSecs}`}
            type="button"
            onClick={() => onSeekTime && onSeekTime(totalSecs)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-mono text-xs font-semibold border border-indigo-500/30 transition-colors"
          >
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{part.trim()}</span>
          </button>
        );
      }
      return <span key={`text-span-${index}`}>{part}</span>;
    });
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 rounded-2xl border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 truncate">
              Thread: {clipTitle}
            </h4>
            <p className="text-[11px] text-slate-400">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isApproved && user && (['admin', 'creative_head', 'sm_manager'].includes(user.role) || !isReadOnlyRole) && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors"
              title="Share approved clip to chat"
              data-testid="thread-share-to-chat-btn"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to chat</span>
            </button>
          )}
          {isReadOnlyRole && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-300 font-medium">
              <Lock className="w-3 h-3" />
              <span>Read-only</span>
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
            <MessageSquare className="w-8 h-8 text-slate-600" />
            <p>No feedback yet on this clip.</p>
            <p className="text-[11px] text-slate-400">
              Use "Reference this moment" while playing to pin timecodes.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const author = msg.authorId;
            const authorIdStr = typeof author === 'string' ? author : author?._id;
            const isMine = Boolean(currentUserId && authorIdStr === currentUserId.toString());
            const authorName = typeof author === 'string' ? 'User' : author?.name || 'User';
            const authorRole = typeof author === 'string' ? '' : author?.jobRole || author?.role;

            const isDone = Boolean(msg.doneAt);
            const isSeenByOther = (msg.seenBy || []).some(
              (s: any) => s.userId && s.userId.toString() !== currentUserId?.toString()
            );

            return (
              <div
                key={msg._id ? `msg-id-${msg._id}` : `msg-idx-${idx}`}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-md relative group transition-all ${
                    isMine
                      ? 'bg-indigo-600/90 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-white/15 text-slate-100 rounded-tl-none'
                  } ${isDone ? 'opacity-80' : ''}`}
                >
                  {/* Quoted reply banner if present */}
                  {msg.replyToId && (
                    <div
                      className={`mb-2 p-2 rounded-lg text-[11px] border-l-2 ${
                        isMine
                          ? 'bg-indigo-950/40 border-indigo-300 text-indigo-100'
                          : 'bg-white/5 border-indigo-400 text-slate-300'
                      }`}
                    >
                      <span className="font-semibold text-indigo-300">
                        {msg.replyToPreview?.authorName ||
                          (typeof msg.replyToId === 'object' && (msg.replyToId as any).authorId?.name
                            ? (msg.replyToId as any).authorId.name
                            : 'Replied to')}
                      </span>
                      <p className="truncate italic">
                        {msg.replyToPreview?.text ||
                          (typeof msg.replyToId === 'object' ? (msg.replyToId as any).text : 'Message')}
                      </p>
                    </div>
                  )}

                  {/* Author meta row */}
                  <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                    <Avatar
                      url={typeof author === 'object' ? (author as any)?.avatarUrl : null}
                      name={authorName}
                      userId={authorIdStr}
                      size="xs"
                    />
                    <span className="font-semibold">{authorName}</span>
                    {authorRole && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold ${
                          isMine ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {authorRole}
                      </span>
                    )}
                  </div>

                  {/* Message body (links not clickable by default) */}
                  <div
                    className={`text-xs leading-relaxed break-words whitespace-pre-wrap select-text ${
                      isDone ? 'line-through text-slate-400' : ''
                    }`}
                  >
                    {renderMessageContent(msg.text)}
                  </div>

                  {/* Footer: Done status, Reply button & Ticks */}
                  <div className="flex items-center justify-between gap-3 mt-2 pt-1 border-t border-white/10 text-[10px]">
                    {/* Done / Reopen controls */}
                    <div className="flex items-center gap-1.5">
                      {isDone ? (
                        <div className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                          {isReviewer && (
                            <button
                              type="button"
                              onClick={() => handleToggleDone(msg, false)}
                              className="ml-1 text-[9px] text-amber-300 hover:underline flex items-center gap-0.5"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Reopen</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleDone(msg, true)}
                          title="Mark feedback as done"
                          className="min-h-[28px] px-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark done</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 ml-auto">
                      {!isReadOnlyRole && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(msg);
                            inputRef.current?.focus();
                          }}
                          className="min-h-[28px] px-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-0.5 transition-colors"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                      )}

                      <span>{formatMessageTime(msg.createdAt)}</span>

                      {/* Sent & Seen ticks (only for my messages) */}
                      {isMine && (
                        <span title={isSeenByOther ? 'Seen' : 'Sent'}>
                          {isSeenByOther ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-300 inline" />
                          ) : (
                            <Check className="w-3 h-3 text-slate-300 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Jump to latest button */}
      {showJumpButton && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-20 right-4 z-10 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg flex items-center gap-1 transition-all active:scale-95"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Latest</span>
        </button>
      )}

      {/* Reply Quote Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-900 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="truncate">
              Replying to{' '}
              <strong className="text-indigo-300">
                {(replyingTo.authorId as any)?.name || 'User'}
              </strong>
              : {replyingTo.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      {!isReadOnlyRole ? (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-slate-900/90 border-t border-white/10 flex items-end gap-2 flex-shrink-0"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message or reference time (e.g. at 0:12)..."
            className="flex-1 bg-white/5 border border-white/15 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 resize-none max-h-24 focus:outline-none min-h-[44px]"
          />

          <button
            type="submit"
            title="Send message"
            disabled={!inputText.trim() || isSubmitting}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center justify-center transition-all active:scale-95 shadow-md flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="p-3 bg-slate-900/60 border-t border-white/10 text-center text-xs text-slate-400 flex-shrink-0">
          Thread is read-only for your current role.
        </div>
      )}

      {showShareModal && (
        <ShareToChatModal
          assetId={clipId}
          assetType="clip"
          contentPieceId={contentPieceId || ''}
          contentPieceTitle={clipTitle}
          stageKey="Shoot"
          title={clipTitle}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};
