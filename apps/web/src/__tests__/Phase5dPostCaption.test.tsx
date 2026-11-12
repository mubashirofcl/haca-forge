import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LIVE_URL_ERROR } from '@mmp/shared';
import { PostWorkspace } from '../pages/work/workspaces/PostWorkspace';

// Phase 5d asked the poster for a caption. A Post step is now marked posted with its live
// link only, so the Post workspace has no caption or hashtag fields at all.

const livePost = (onMarkAsPosted = vi.fn(), extra = {}) =>
  render(
    <PostWorkspace
      workItem={{ id: 'p1', title: 'Post step', stageKey: 'Post', status: 'In Progress', ...extra }}
      finalAssets={[{ url: '/uploads/cut.mp4', kind: 'upload' }]}
      onMarkAsPosted={onMarkAsPosted}
    />
  );

describe('Post workspace: the live link only', () => {
  it('has no caption or hashtag fields', () => {
    livePost();
    expect(screen.queryByLabelText(/caption/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hashtags/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/caption/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hashtag/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('post-caption-fields')).not.toBeInTheDocument();
  });

  it('is marked posted with only the live link', () => {
    const onMarkAsPosted = vi.fn();
    livePost(onMarkAsPosted);
    const button = screen.getByRole('button', { name: /mark as posted/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/instagram\.com\/p/i), { target: { value: 'https://instagram.com/p/x' } });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onMarkAsPosted).toHaveBeenCalledTimes(1);
    const sent = onMarkAsPosted.mock.calls[0][0];
    expect(sent.publishedUrl).toBe('https://instagram.com/p/x');
    expect(sent).not.toHaveProperty('caption');
    expect(sent).not.toHaveProperty('hashtags');
  });

  it('rejects a live link that is not https, with the shared message', () => {
    for (const bad of ['http://instagram.com/p/x', 'javascript:alert(1)', 'data:text/html,x', 'instagram.com/p/x']) {
      const onMarkAsPosted = vi.fn();
      const { unmount } = livePost(onMarkAsPosted);
      fireEvent.change(screen.getByPlaceholderText(/instagram\.com\/p/i), { target: { value: bad } });
      fireEvent.submit(screen.getByRole('button', { name: /mark as posted/i }).closest('form')!);
      expect(onMarkAsPosted).not.toHaveBeenCalled();
      expect(screen.getByText(LIVE_URL_ERROR)).toBeInTheDocument();
      unmount();
    }
  });

  it('a posted step shows no saved caption either', () => {
    livePost(vi.fn(), { status: 'Published', postCaption: 'Saved caption', postHashtags: '#saved' });
    expect(screen.queryByText('Saved caption')).not.toBeInTheDocument();
    expect(screen.queryByText('#saved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as posted/i })).toBeDisabled();
  });
});
