import React from 'react';
import { Avatar } from './Avatar';

export interface ChatPerson {
  _id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Props {
  people: ChatPerson[];
  /** Teammates in Team Chat beyond the faces shown (computed by the caller). */
  moreCount: number;
  /** The chat link is the current page (dark pill): rings match its background. */
  active?: boolean;
  max?: number;
}

/**
 * Overlapping faces: the people you chat with most recently, then Team Chat teammates
 * (photos first), with a "+N" chip for the rest of the team. Decorative inside the Team Chat link; the link's text carries the meaning
 * and a screen-reader line names who is shown.
 */
export const HeaderChatAvatars: React.FC<Props> = ({ people, moreCount, active = false, max = 4 }) => {
  const shown = people.slice(0, max);
  const extra = moreCount; // already counts everyone not shown
  if (shown.length === 0 && extra === 0) return null;
  const names = shown.map((p) => p.name);
  const summary = `Chat with ${names.join(', ')}${extra > 0 ? `${names.length ? ' and ' : ''}${extra} more teammates` : ''}`;

  return (
    <span className={`chat-stack hidden lg:flex items-center shrink-0 ${active ? 'is-active' : ''}`}>
      <span className="sr-only">{summary}</span>
      <span className="flex items-center" aria-hidden="true">
        {shown.map((p, i) => (
          <span key={p._id} className="chat-stack-item relative" style={{ zIndex: shown.length - i + 1 }}>
            <Avatar url={p.avatarUrl} name={p.name} userId={p._id} size="sm" alt="" />
          </span>
        ))}
        {extra > 0 && (
          <span className="chat-stack-item chat-stack-more relative" style={{ zIndex: 0 }}>
            +{extra > 99 ? '99' : extra}
          </span>
        )}
      </span>
    </span>
  );
};
