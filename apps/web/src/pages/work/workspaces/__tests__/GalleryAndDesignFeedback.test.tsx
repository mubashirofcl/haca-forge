import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShootReviewView } from '../ShootReviewView';
import { DesignWorkspace } from '../DesignWorkspace';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'u-ch', name: 'Head', role: 'creative_head' }, hasPermission: () => true }),
}));
const mockApiFetch = vi.fn();
vi.mock('../../../../lib/api', () => ({ apiFetch: (...args: any[]) => mockApiFetch(...args) }));
vi.mock('../../../../hooks/useSocket', () => ({
  useSocket: () => ({ isConnected: true, socket: null, joinTask: vi.fn(), leaveTask: vi.fn(), emitTyping: vi.fn(), on: vi.fn().mockReturnValue(() => {}) }),
}));

const clip = (id: string, title: string, status: string) => ({
  _id: id, stageItemId: 's1', kind: 'video', url: 'https://example.invalid/a.mp4', title, take: 1, status,
  durationSeconds: 10, sizeBytes: 1000, orientationOk: true, tags: [], notes: '', favourite: false, order: 0, version: 1,
});

beforeEach(() => mockApiFetch.mockReset());

describe('ShootReviewView clip gallery', () => {
  it('lists clips as buttons that can be selected from the keyboard', async () => {
    mockApiFetch.mockImplementation(async (raw?: string) => {
      const url = String(raw || '');
      if (url.includes('/clips')) return { data: { clips: [clip('c1', 'Clip One', 'waiting_review'), clip('c2', 'Clip Two', 'waiting_review')], shotList: [], coverage: '' } };
      if (url.includes('/messages')) return { data: { messages: [] } };
      return { data: {} };
    });
    render(<ShootReviewView stageItemId="s1" workItemTitle="Shoot" />);
    const second = await screen.findByRole('button', { name: /Clip Two/ });
    const first = screen.getByRole('button', { name: /Clip One/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');

    // A native button: Enter/Space activate it, which fires click.
    second.focus();
    expect(document.activeElement).toBe(second);
    fireEvent.click(second);
    await waitFor(() => expect(second).toHaveAttribute('aria-pressed', 'true'));
    expect(first).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('DesignWorkspace revision feedback', () => {
  const workItem = { id: 'w1', title: 'Carousel', stageKey: 'Design', status: 'In Progress' };

  it('shows the Creative Head revision feedback passed from the page', () => {
    render(
      <DesignWorkspace
        workItem={workItem}
        onSubmit={vi.fn()}
        revisionComments={[
          { id: 'r1', content: 'Increase headline contrast on slide 2.', authorName: 'Sarah', authorRole: 'creative_head', createdAt: '2026-11-01T10:00:00.000Z' },
          { id: 'r2', content: 'Done, uploaded v2.', authorName: 'Dev', authorRole: 'team_member', createdAt: '2026-11-01T11:00:00.000Z' },
        ]}
      />
    );
    const section = screen.getByRole('region', { name: /revision feedback \(1\)/i });
    expect(section).toHaveTextContent('Increase headline contrast on slide 2.');
    expect(section).toHaveTextContent('Sarah');
    expect(section).not.toHaveTextContent('Done, uploaded v2.');
  });

  it('shows nothing extra when there is no feedback', () => {
    render(<DesignWorkspace workItem={workItem} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('region', { name: /revision feedback/i })).not.toBeInTheDocument();
  });
});
