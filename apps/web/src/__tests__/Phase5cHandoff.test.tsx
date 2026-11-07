import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { isDriveLink, DRIVE_LINK_HINT } from '@mmp/shared';
import { DriveLinkInput, driveLinkError } from '../components/DriveLinkInput';
import { AssetLinks, assetKind } from '../components/AssetLinks';
import { PostWorkspace } from '../pages/work/workspaces/PostWorkspace';
import { VideoPlayer } from '../pages/work/workspaces/VideoPlayer';
import { ReviewStudioPage } from '../pages/feedback/review-studio/ReviewStudioPage';
import * as authContext from '../context/AuthContext';
import * as apiModule from '../lib/api';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => ({ on: () => () => {}, emit: vi.fn() }) }));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const DOCS = 'https://docs.google.com/document/d/xyz/edit';

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { _id: 'head-1', role: 'creative_head', name: 'Head' }, hasPermission: () => true });
});

describe('DriveLinkInput uses the shared rule', () => {
  it('accepts exactly what the shared isDriveLink accepts', () => {
    const samples = [DRIVE, DOCS, 'http://drive.google.com/x', 'https://drive.google.com.evil.example/x', 'https://dropbox.com/s/x', 'javascript:alert(1)', 'https://drive.google.com:8443/x', '/uploads/a.mp4'];
    for (const s of samples) expect(driveLinkError(s) === null).toBe(isDriveLink(s));
  });

  it('shows the sharing reminder, and an error for other links', () => {
    const { rerender } = render(<DriveLinkInput id="t" label="Link" value="" onChange={() => {}} />);
    expect(screen.getByText(DRIVE_LINK_HINT)).toBeInTheDocument();
    rerender(<DriveLinkInput id="t" label="Link" value="https://dropbox.com/s/x" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/drive\.google\.com or docs\.google\.com/);
  });
});

describe('AssetLinks', () => {
  it('downloads uploads, opens Drive links in Drive, opens older links as links, and drops unsafe ones', () => {
    render(
      <AssetLinks
        items={[
          { url: '/uploads/cut.mp4', name: 'cut.mp4' },
          { url: DRIVE },
          { url: 'https://cdn.example.com/legacy.mp4' },
          { url: 'javascript:alert(1)' },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: /^download$/i })).toHaveAttribute('href', '/uploads/cut.mp4');
    expect(screen.getByRole('link', { name: /^download$/i })).toHaveAttribute('download');
    expect(screen.getByRole('link', { name: /open in drive/i })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /open link/i })).toHaveAttribute('href', 'https://cdn.example.com/legacy.mp4');
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(assetKind(DOCS)).toBe('drive');
  });
});

describe('Post workspace receives the handed-over assets', () => {
  it('lists every approved design file with the right action, plus the approved caption', () => {
    render(
      <PostWorkspace
        workItem={{ id: 'p1', title: 'Post step', stageKey: 'Post' }}
        finalAssets={[{ url: '/uploads/slide-1.png', name: 'slide 1', kind: 'upload' }, { url: DRIVE, name: 'slide 2', kind: 'drive' }]}
        captionsAndHashtags={{ caption: 'Approved caption', hashtags: '#approved' }}
        onMarkAsPosted={vi.fn()}
      />
    );
    const list = screen.getByTestId('post-final-assets');
    expect(within(list).getByRole('link', { name: /^download$/i })).toHaveAttribute('href', '/uploads/slide-1.png');
    expect(within(list).getByRole('link', { name: /open in drive/i })).toHaveAttribute('href', DRIVE);
    expect(screen.getByText('Approved caption')).toBeInTheDocument();
    expect(screen.getByText('#approved')).toBeInTheDocument();
  });

  it('says the final file is not approved yet when nothing has been handed over', () => {
    render(<PostWorkspace workItem={{ id: 'p2', title: 'Post step', stageKey: 'Post' }} onMarkAsPosted={vi.fn()} />);
    expect(screen.getByText(/will appear here once it is approved/i)).toBeInTheDocument();
  });

  it('a Drive clip shows an Open in Drive card instead of a player', () => {
    render(<VideoPlayer url={DRIVE} />);
    expect(screen.getByTestId('drive-video-card')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in drive/i })).toHaveAttribute('href', DRIVE);
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('Review Studio with Drive links', () => {
  const owner = { _id: 'owner-1', name: 'Owner' };
  const open = async (sub: any) => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/submissions/review-queue') return [sub];
      if (url.includes(`/api/submissions/${sub._id}`)) return sub;
      return [];
    });
    render(<MemoryRouter initialEntries={['/feedback/review-studio']}><ReviewStudioPage /></MemoryRouter>);
    await waitFor(() => expect(document.body.textContent).toContain(`Step: ${sub.workItemId.stageKey}`));
  };

  it('document text plus a Drive link: the document stays in view and the link is listed beside it', async () => {
    await open({
      id: 'sd', _id: 'sd', version: 1, kind: 'document', status: 'submitted',
      document: { htmlSnapshot: '<p>SCRIPT BODY TEXT</p>' },
      linkUrl: DOCS,
      workItemId: { _id: 'w1', title: 'Script step', stageKey: 'Script', ownerId: owner },
    });
    expect(screen.getAllByText(/SCRIPT BODY TEXT/).length).toBeGreaterThan(0);
    const panel = screen.getByTestId('review-links-panel');
    expect(within(panel).getByRole('link', { name: /open in drive/i })).toHaveAttribute('href', DOCS);
    expect(screen.queryByRole('link', { name: /open in new tab/i })).not.toBeInTheDocument();
  });

  it('a Drive link alone opens in the link viewer, with general comments and no pins', async () => {
    await open({
      id: 'sl', _id: 'sl', version: 1, kind: 'video', status: 'submitted',
      files: [{ url: DRIVE }],
      workItemId: { _id: 'w2', title: 'Edit step', stageKey: 'Edit', ownerId: owner },
    });
    expect(screen.getByRole('link', { name: /open in new tab/i })).toHaveAttribute('href', DRIVE);
    expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comment @/i })).not.toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('a design with an upload and a Drive slide previews the upload and lists the Drive slide', async () => {
    await open({
      id: 'si', _id: 'si', version: 1, kind: 'image', status: 'submitted',
      files: [{ url: '/uploads/slide-1.png' }, { url: DRIVE }],
      workItemId: { _id: 'w3', title: 'Design step', stageKey: 'Design', ownerId: owner },
    });
    expect(screen.getByAltText('Slide 1')).toHaveAttribute('src', '/uploads/slide-1.png');
    expect(screen.queryByAltText('Slide 2')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('review-links-panel')).getByRole('link', { name: /open in drive/i })).toHaveAttribute('href', DRIVE);
  });
});
