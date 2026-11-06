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
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-white hover:bg-white text-ui-ink font-mono text-xs font-semibold border border-ui-ink transition-colors"
          >
            <Clock className="w-3 h-3 text-ui-ink" />
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
    <div className="flex flex-col h-full bg-white/60 rounded-2xl border border-ui-line overflow-hidden">
      {/* Header */}
      <div className="p-3.5 bg-white/60 border-b border-ui-line flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white text-ui-ink flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-ui-ink truncate">
              Thread: {clipTitle}
            </h4>
            <p className="text-[11px] text-ui-muted">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isApproved && user && (['admin', 'creative_head', 'sm_manager'].includes(user.role) || !isReadOnlyRole) && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="status-tint status-approved px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              title="Share approved clip to chat"
              data-testid="thread-share-to-chat-btn"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to chat</span>
            </button>
          )}
          {isReadOnlyRole && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 text-[11px] text-ui-text font-medium">
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
          <div className="h-full flex items-center justify-center text-ui-muted text-xs">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-ui-muted text-xs gap-2 p-6 text-center">
            <MessageSquare className="w-8 h-8 text-ui-muted" />
            <p>No feedback yet on this clip.</p>
            <p className="text-[11px] text-ui-muted">
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
                      ? 'bg-white border border-ui-ink text-ui-ink rounded-tr-none'
                      : 'bg-white/60 border border-ui-line text-ui-ink rounded-tl-none'
                  } ${isDone ? 'opacity-80' : ''}`}
                >
                  {/* Quoted reply banner if present */}
                  {msg.replyToId && (
                    <div
                      className={`mb-2 p-2 rounded-lg text-[11px] border-l-2 ${
                        isMine
                          ? 'bg-white border-ui-ink text-ui-ink'
                          : 'bg-white/60 border-ui-ink text-ui-text'
                      }`}
                    >
                      <span className="font-semibold text-ui-ink">
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
                        className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                          isMine ? 'bg-white text-ui-ink' : 'bg-white/60 text-ui-muted'
                        }`}
                      >
                        {authorRole}
                      </span>
                    )}
                  </div>

                  {/* Message body (links not clickable by default) */}
                  <div
                    className={`text-xs leading-relaxed break-words whitespace-pre-wrap select-text ${
                      isDone ? 'line-through text-ui-muted' : ''
                    }`}
                  >
                    {renderMessageContent(msg.text)}
                  </div>

                  {/* Footer: Done status, Reply button & Ticks */}
                  <div className="flex items-center justify-between gap-3 mt-2 pt-1 border-t border-ui-line text-[11px]">
                    {/* Done / Reopen controls */}
                    <div className="flex items-center gap-1.5">
                      {isDone ? (
                        <div className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                          {isReviewer && (
                            <button
                              type="button"
                              onClick={() => handleToggleDone(msg, false)}
                              className="ml-1 min-h-[44px] px-2 text-[11px] text-amber-800 hover:underline flex items-center gap-0.5"
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
                          className="min-h-[44px] px-2 rounded hover:bg-ui-card-hover text-ui-text hover:text-ui-ink flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark done</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-ui-muted ml-auto">
                      {!isReadOnlyRole && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(msg);
                            inputRef.current?.focus();
                          }}
                          className="min-h-[44px] px-2 rounded hover:bg-ui-card-hover text-ui-text hover:text-ui-ink flex items-center gap-0.5 transition-colors"
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
                            <CheckCheck className="w-3.5 h-3.5 text-ui-ink inline" />
                          ) : (
                            <Check className="w-3 h-3 text-ui-text inline" />
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
          className="absolute bottom-20 right-4 z-10 px-3 py-1.5 rounded-full bg-ui-ink hover:bg-black text-white text-xs font-semibold shadow-lg flex items-center gap-1 transition-all active:scale-95"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Latest</span>
        </button>
      )}

      {/* Reply Quote Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-white/60 border-t border-ui-line flex items-center justify-between text-xs text-ui-text">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-ui-ink flex-shrink-0" />
            <span className="truncate">
              Replying to{' '}
              <strong className="text-ui-ink">
                {(replyingTo.authorId as any)?.name || 'User'}
              </strong>
              : {replyingTo.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-white rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-ui-muted" />
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      {!isReadOnlyRole ? (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white/60 border-t border-ui-line flex items-end gap-2 flex-shrink-0"
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
            aria-label="Message"
            className="ui-input ui-textarea flex-1 resize-none max-h-24 min-h-[44px]"
          />

          <button
            type="submit"
            title="Send message"
            aria-label="Send message"
            disabled={!inputText.trim() || isSubmitting}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-ui-ink hover:bg-black disabled:opacity-40 text-white flex items-center justify-center transition-all active:scale-95 shadow-md flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="p-3 bg-white/60 border-t border-ui-line text-center text-xs text-ui-muted flex-shrink-0">
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
