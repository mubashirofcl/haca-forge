import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { POST_CAPTION_MAX } from '@mmp/shared';
import { PostWorkspace } from '../pages/work/workspaces/PostWorkspace';

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

const livePost = (onMarkAsPosted = vi.fn(), extra = {}) =>
  render(
    <PostWorkspace
      workItem={{ id: 'p1', title: 'Post step', stageKey: 'Post', status: 'In Progress', ...extra }}
      finalAssets={[{ url: '/uploads/cut.mp4', kind: 'upload' }]}
      onMarkAsPosted={onMarkAsPosted}
    />
  );

describe('Post caption and hashtags', () => {
  it('cannot be marked posted without a caption; hashtags are optional', () => {
    const onMarkAsPosted = vi.fn();
    livePost(onMarkAsPosted);
    fireEvent.change(screen.getByPlaceholderText(/instagram\.com\/p/i), { target: { value: 'https://instagram.com/p/x' } });
    const button = screen.getByRole('button', { name: /mark as posted/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/post caption/i), { target: { value: '   ' } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/post caption/i), { target: { value: 'We are live' } });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onMarkAsPosted).toHaveBeenCalledWith(expect.objectContaining({ caption: 'We are live', hashtags: '' }));
  });

  it('shows the Instagram and LinkedIn counters for caption and hashtags together', () => {
    livePost();
    fireEvent.change(screen.getByLabelText(/post caption/i), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/^hashtags/i), { target: { value: '#x' } });
    expect(screen.getByText('7 / 2,200')).toBeInTheDocument();
    expect(screen.getByText('7 / 3,000')).toBeInTheDocument();
  });

  it('copies what the poster wrote', () => {
    livePost();
    fireEvent.change(screen.getByLabelText(/post caption/i), { target: { value: 'Copy me' } });
    fireEvent.click(screen.getByRole('button', { name: /copy caption/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy me');
  });

  it(`cannot post when caption and hashtags together are over ${POST_CAPTION_MAX} characters`, () => {
    livePost();
    fireEvent.change(screen.getByPlaceholderText(/instagram\.com\/p/i), { target: { value: 'https://instagram.com/p/x' } });
    fireEvent.change(screen.getByLabelText(/post caption/i), { target: { value: 'a'.repeat(2000) } });
    fireEvent.change(screen.getByLabelText(/^hashtags/i), { target: { value: `#${'b'.repeat(1100)}` } });
    expect(screen.getByRole('button', { name: /mark as posted/i })).toBeDisabled();
  });

  it('after posting, shows the saved caption and hashtags read-only', () => {
    livePost(vi.fn(), { status: 'Published', postCaption: 'Saved caption', postHashtags: '#saved' });
    expect(screen.getByTestId('post-caption-saved')).toHaveTextContent('Saved caption');
    expect(screen.getByTestId('post-hashtags-saved')).toHaveTextContent('#saved');
    expect(document.querySelector('textarea#post-caption')).toBeNull();
    expect(document.querySelector('input#post-hashtags')).toBeNull();
    expect(screen.getByRole('button', { name: /mark as posted/i })).toBeDisabled();
  });
});
