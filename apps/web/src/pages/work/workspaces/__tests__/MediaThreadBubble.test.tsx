import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaThread } from '../MediaThread';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'u-me', name: 'Me', role: 'creative_head' }, hasPermission: () => true }),
}));
vi.mock('../../../../lib/api', () => ({
  apiFetch: async (raw?: string) => {
    const url = String(raw || '');
    if (url.endsWith('/messages')) {
      return {
        data: {
          messages: [
            { _id: 'm1', text: 'My own note on the intro', authorId: { _id: 'u-me', name: 'Me', role: 'creative_head' }, createdAt: '2026-11-01T10:00:00.000Z', seenBy: [] },
            { _id: 'm2', text: 'Their reply about the intro', authorId: { _id: 'u-other', name: 'Other', role: 'team_member' }, createdAt: '2026-11-01T10:05:00.000Z', seenBy: [] },
          ],
        },
      };
    }
    return { data: {} };
  },
}));

const bubbleOf = (el: HTMLElement) => el.closest('.rounded-2xl') as HTMLElement;

describe('MediaThread message bubbles', () => {
  it('renders own messages as dark text on a light bubble, never white on white', async () => {
    render(<MediaThread clipId="c1" clipTitle="Clip One" />);
    const mine = bubbleOf(await screen.findByText('My own note on the intro'));
    expect(mine).toBeTruthy();
    const cls = mine.className.split(/\s+/);
    expect(cls).toContain('text-ui-ink');
    expect(cls).not.toContain('text-white');
    expect(cls).toContain('border-ui-ink');

    const theirs = bubbleOf(screen.getByText('Their reply about the intro'));
    expect(theirs.className.split(/\s+/)).toContain('text-ui-ink');
  });

  it('gives Mark done and Reply 44px targets', async () => {
    render(<MediaThread clipId="c1" clipTitle="Clip One" />);
    await screen.findByText('My own note on the intro');
    for (const btn of [...screen.getAllByRole('button', { name: /mark done/i }), ...screen.getAllByRole('button', { name: /^reply$/i })]) {
      expect(btn.className).toContain('min-h-[44px]');
    }
  });
});
