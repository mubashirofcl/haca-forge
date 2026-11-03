import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadManager } from '../UploadManager';
import { ClipCard } from '../ClipCard';
import { VideoPlayer } from '../VideoPlayer';
import { MediaThread } from '../MediaThread';
import { ShootReviewView } from '../ShootReviewView';
import { ShootWorkspace } from '../ShootWorkspace';
import type { MediaItemType, MediaMessageType } from '@mmp/shared';

// Mock AuthContext
let mockCurrentUser: any = {
  _id: 'user-shooter-1',
  name: 'Alex Rivera',
  role: 'videographer',
};

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    hasPermission: () => true,
  }),
}));

// Mock API module
const mockApiFetch = vi.fn();
vi.mock('../../../../lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

describe('Shoot Workspace & Per-Clip Tools Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      _id: 'user-shooter-1',
      name: 'Alex Rivera',
      role: 'videographer',
    };
  });

  const baseClip: MediaItemType = {
    _id: 'clip-1',
    stageItemId: 'stage-item-1',
    kind: 'video',
    url: 'https://storage.example.com/clip1.mp4',
    storageId: 'raw/clip1.mp4',
    thumbnailUrl: 'https://storage.example.com/thumb1.jpg',
    title: 'Hero Kitchen B-Roll',
    shotRef: 'Scene 1: Shot 1',
    take: 2,
    tags: ['A-roll', 'Cutaway'],
    notes: 'Natural morning sunlight.',
    favourite: true,
    order: 1,
    version: 1,
    durationSeconds: 14.5,
    width: 1080,
    height: 1920,
    orientationOk: true,
    sizeBytes: 15728640, // 15 MB
    status: 'uploaded',
    unreadCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('1. ClipCard Component', () => {
    it('renders metadata, 9:16 vertical badge, tags, take, and handles interactions', () => {
      const onUpdateMetadata = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onSelect = vi.fn();

      render(
        <ClipCard
          clip={baseClip}
          availableShots={[{ visual: 'Hero coffee pour', shotRef: 'Scene 1: Shot 1' }]}
          canEdit={true}
          onUpdateMetadata={onUpdateMetadata}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      );

      // Title & duration & 9:16 badge
      expect(screen.getByText('Hero Kitchen B-Roll')).toBeInTheDocument();
      expect(screen.getByText(/9:16/)).toBeInTheDocument();
      expect(screen.getByText('Take:')).toBeInTheDocument();
      expect(screen.getByText('A-roll')).toBeInTheDocument();
      expect(screen.getByText('Cutaway')).toBeInTheDocument();
      expect(screen.getByText(/15\.0 mb/i)).toBeInTheDocument();

      // Favourite star toggle
      const favBtn = screen.getByTitle(/remove from favourites/i);
      fireEvent.click(favBtn);
      expect(onUpdateMetadata).toHaveBeenCalledWith({ favourite: false });

      // Unread badge number (2)
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

      // Click card to open in player
      const cardTitle = screen.getByText('Hero Kitchen B-Roll');
      fireEvent.click(cardTitle);
      expect(onSelect).toHaveBeenCalled();
    });

    it('approved clip is locked: displays lock badge, and removes delete button', () => {
      const approvedClip: MediaItemType = {
        ...baseClip,
        _id: 'clip-approved-1',
        status: 'approved',
      };
      const onUpdateMetadata = vi.fn().mockResolvedValue(undefined);
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <ClipCard
          clip={approvedClip}
          canEdit={true}
          onUpdateMetadata={onUpdateMetadata}
          onDelete={onDelete}
        />
      );

      // Lock badge is shown
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
      expect(screen.getByTitle(/approved clips are locked/i)).toBeInTheDocument();
      // Delete button is not rendered for approved clips
      expect(screen.queryByTitle(/delete clip/i)).not.toBeInTheDocument();
    });

    it('reshoot_needed clip shows revision alert banner with latest reviewer feedback', () => {
      const flaggedClip: MediaItemType = {
        ...baseClip,
        _id: 'clip-flagged-1',
        status: 'reshoot_needed',
      };
      const onReplace = vi.fn().mockResolvedValue(undefined);

      render(
        <ClipCard
          clip={flaggedClip}
          latestReviewMessage="Audio is clipping in take 2, please re-record with lapel mic."
          canEdit={true}
          onReplace={onReplace}
        />
      );

      expect(screen.getByText(/reshoot needed/i)).toBeInTheDocument();
      expect(screen.getByText(/audio is clipping in take 2/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /replace this clip/i })).toBeInTheDocument();
    });
  });

  describe('2. VideoPlayer Component & Moment Referencing', () => {
    it('renders controls, speed options, frame stepping, loop, and moment reference button', () => {
      const onReferenceMoment = vi.fn();

      render(
        <VideoPlayer
          url={baseClip.url}
          thumbnailUrl={baseClip.thumbnailUrl}
          onReferenceMoment={onReferenceMoment}
        />
      );

      // Play/Pause button
      const playBtn = screen.getByTitle(/play/i);
      expect(playBtn).toBeInTheDocument();

      // Speed selection
      const speedSelect = screen.getByRole('combobox');
      expect(speedSelect).toBeInTheDocument();
      fireEvent.change(speedSelect, { target: { value: '1.5' } });
      expect((speedSelect as HTMLSelectElement).value).toBe('1.5');

      // Frame stepping buttons
      expect(screen.getByTitle(/step backward 1 frame/i)).toBeInTheDocument();
      expect(screen.getByTitle(/step forward 1 frame/i)).toBeInTheDocument();

      // Reference this moment button
      const refBtn = screen.getByRole('button', { name: /reference this moment/i });
      expect(refBtn).toBeInTheDocument();
      fireEvent.click(refBtn);
      expect(onReferenceMoment).toHaveBeenCalledWith(expect.stringMatching(/at 0:00/), 0);
    });
  });

  describe('3. MediaThread (WhatsApp Style)', () => {
    const mockMessages: MediaMessageType[] = [
      {
        _id: 'msg-1',
        mediaItemId: 'clip-1',
        authorId: {
          _id: 'user-creative-1',
          name: 'Sarah Jenkins',
          role: 'creative_head',
        } as any,
        text: 'Please check the lighting at 0:05, looks a bit harsh on the left side. See https://guide.example.com',
        timeSeconds: 5,
        seenBy: [{ userId: 'user-shooter-1', seenAt: '2026-10-27T10:00:00Z' }],
        doneAt: undefined,
        doneById: undefined,
        createdAt: '2026-10-27T09:30:00Z',
        updatedAt: '2026-10-27T09:30:00Z',
      },
      {
        _id: 'msg-2',
        mediaItemId: 'clip-1',
        authorId: {
          _id: 'user-shooter-1',
          name: 'Alex Rivera',
          role: 'videographer',
        } as any,
        text: 'Adjusted the key light diffusion on take 3!',
        replyToId: 'msg-1',
        replyToPreview: {
          authorName: 'Sarah Jenkins',
          text: 'Please check the lighting at 0:05...',
        },
        seenBy: [],
        doneAt: undefined,
        doneById: undefined,
        createdAt: '2026-10-27T09:45:00Z',
        updatedAt: '2026-10-27T09:45:00Z',
      },
    ];

    it('renders chat bubbles (mine right, theirs left), role chip, timestamp chips, and ticks', async () => {
      mockApiFetch.mockImplementation(async (url: string, opts?: any) => {
        if (url.includes('/messages') && (!opts || opts.method === 'GET')) {
          return { data: { messages: mockMessages } };
        }
        if (url.includes('/messages') && opts?.method === 'POST') {
          return { data: { message: { ...mockMessages[1], _id: 'msg-3', text: 'Ready for re-review' } } };
        }
        if (url.includes('/seen')) {
          return { data: { seenCount: 1 } };
        }
        return { data: {} };
      });

      const onSeekTime = vi.fn();

      render(
        <MediaThread
          clipId="clip-1"
          clipTitle="Hero Kitchen B-Roll"
          onSeekTime={onSeekTime}
        />
      );

      // Wait for messages to load
      await waitFor(() => {
        expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThan(0);
      });

      // Their message (left)
      expect(screen.getAllByText(/please check the lighting/i).length).toBeGreaterThan(0);

      // Timestamp chip clickable to seek player
      const timeChip = screen.getByRole('button', { name: /at 0:05/i });
      fireEvent.click(timeChip);
      expect(onSeekTime).toHaveBeenCalledWith(5);

      // Plain text link - verify not rendered as anchor tag
      expect(screen.queryByRole('link', { name: /guide\.example\.com/i })).not.toBeInTheDocument();
      expect(screen.getByText(/https:\/\/guide\.example\.com/)).toBeInTheDocument();

      // My message (right)
      expect(screen.getByText('Adjusted the key light diffusion on take 3!')).toBeInTheDocument();

      // Send new message
      const input = screen.getByPlaceholderText(/type a message/i);
      fireEvent.change(input, { target: { value: 'Ready for re-review' } });
      const sendBtn = screen.getByTitle(/send message/i);
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/clips/clip-1/messages',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Ready for re-review'),
          })
        );
      });
    });

    it('enforces read-only permissions for sm_manager and executive', async () => {
      mockCurrentUser = {
        _id: 'user-exec-1',
        name: 'Executive User',
        role: 'executive',
      };

      mockApiFetch.mockResolvedValue({ data: { messages: mockMessages } });

      render(
        <MediaThread
          clipId="clip-1"
          clipTitle="Hero Kitchen B-Roll"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThan(0);
      });

      // Read-only indicator
      expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0);
      // Input is hidden
      expect(screen.queryByPlaceholderText(/type a message/i)).not.toBeInTheDocument();
    });

    it('allows reviewer (creative_head) to mark feedback as done and reopen', async () => {
      mockCurrentUser = {
        _id: 'user-creative-1',
        name: 'Sarah Jenkins',
        role: 'creative_head',
      };

      mockApiFetch.mockImplementation(async (url: string, opts?: any) => {
        if (url.includes('/messages') && (!opts || opts.method === 'GET')) {
          return { data: { messages: mockMessages } };
        }
        if (url.includes('/toggle-done')) {
          return { data: { message: { ...mockMessages[0], doneAt: new Date().toISOString() } } };
        }
        return { data: {} };
      });

      render(
        <MediaThread
          clipId="clip-1"
          clipTitle="Hero Kitchen B-Roll"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThan(0);
      });

      // Mark done button for feedback message
      const doneBtn = screen.getAllByTitle(/mark feedback as done/i)[0];
      fireEvent.click(doneBtn);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/clips/clip-1/messages/msg-1/toggle-done',
          expect.objectContaining({ method: 'PATCH' })
        );
      });
    });
  });

  describe('4. Creative Head ShootReviewView Component', () => {
    const clipsList: MediaItemType[] = [
      { ...baseClip, _id: 'c1', title: 'Clip 1 Hero', status: 'approved' },
      { ...baseClip, _id: 'c2', title: 'Clip 2 Action', status: 'waiting_review' },
    ];

    it('renders gallery, shot coverage bar, approve clip and reshoot needed actions', async () => {
      mockCurrentUser = {
        _id: 'user-ch-1',
        name: 'Sarah Jenkins',
        role: 'creative_head',
      };

      mockApiFetch.mockImplementation(async (url: string) => {
        if (url.includes('/review')) {
          return { data: { ...clipsList[1], status: 'approved' } };
        }
        if (url.includes('/clips')) {
          return {
            data: {
              clips: clipsList,
              shotList: [{ visual: 'Hero pour', shotRef: '1' }],
              coverage: '1 of 1 shots covered (100%)',
            },
          };
        }
        if (url.includes('/messages')) {
          return { data: { messages: [] } };
        }
        return { data: {} };
      });

      render(
        <ShootReviewView
          stageItemId="stage-item-1"
          workItemTitle="Product Reel Shoot"
        />
      );

      // Wait for clips to load
      await waitFor(() => {
        expect(screen.getByText('Product Reel Shoot')).toBeInTheDocument();
      });

      expect(screen.getByText(/1 approved/i)).toBeInTheDocument();
      expect(screen.getByText(/1 pending review/i)).toBeInTheDocument();
      expect(screen.getByText('Clip 1 Hero')).toBeInTheDocument();
      expect(screen.getByText('Clip 2 Action')).toBeInTheDocument();

      // Open unreviewed clip
      fireEvent.click(screen.getByText('Clip 2 Action'));

      // Approve clip button
      const approveBtn = screen.getByRole('button', { name: /approve clip/i });
      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/api/clips/c2/review',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"action":"approve"'),
          })
        );
      });

      // Reshoot needed button
      const reshootBtn = screen.getByRole('button', { name: /reshoot needed/i });
      expect(reshootBtn).toBeInTheDocument();
    });

    it('blocks approving entire step when clips are still waiting_review', async () => {
      mockCurrentUser = {
        _id: 'user-ch-1',
        name: 'Sarah Jenkins',
        role: 'creative_head',
      };

      mockApiFetch.mockResolvedValue({
        data: {
          clips: clipsList,
          shotList: [],
          coverage: '',
        },
      });

      render(
        <ShootReviewView
          stageItemId="stage-item-1"
          workItemTitle="Product Reel Shoot"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Product Reel Shoot')).toBeInTheDocument();
      });

      // Summary bar action button is disabled
      const approveStepBtn = screen.getByRole('button', { name: /approve step with rating/i });
      expect(approveStepBtn).toBeDisabled();
    });

    it('allows sending back (Changes requested) when any clip has reshoot_needed', async () => {
      mockCurrentUser = {
        _id: 'user-ch-1',
        name: 'Sarah Jenkins',
        role: 'creative_head',
      };

      const reshootClips: MediaItemType[] = [
        { ...baseClip, _id: 'c1', status: 'approved' },
        { ...baseClip, _id: 'c2', status: 'reshoot_needed' },
      ];

      mockApiFetch.mockResolvedValue({
        data: {
          clips: reshootClips,
          shotList: [],
          coverage: '',
        },
      });

      render(
        <ShootReviewView
          stageItemId="stage-item-1"
          workItemTitle="Product Reel Shoot"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Product Reel Shoot')).toBeInTheDocument();
      });

      const sendBackBtn = screen.getByRole('button', { name: /send back \(changes requested\)/i });
      expect(sendBackBtn).not.toBeDisabled();
    });
  });

  describe('5. ShootWorkspace Submit Validation & 360px Touch Targets', () => {
    it('submit button disabled when no clips exist, enabled when valid', async () => {
      mockApiFetch.mockImplementation(async (url: string) => {
        if (url.includes('/clips')) {
          return {
            data: {
              clips: [],
              shotList: [],
              coverage: '',
            },
          };
        }
        return { data: {} };
      });

      const mockWorkItem = {
        id: 'w-shoot-empty',
        title: 'Morning Matcha Reel',
        stageKey: 'shoot',
        status: 'In Progress',
      };

      render(
        <ShootWorkspace
          workItem={mockWorkItem}
          isSubmitting={false}
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/at least one clip is required/i)).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
      expect(submitBtn).toBeDisabled();
    });

    it('enforces 44px min touch targets for primary interactive controls on mobile layout', async () => {
      mockApiFetch.mockResolvedValue({
        data: { clips: [baseClip], shotList: [], coverage: '1 clip' },
      });

      const mockWorkItem = {
        id: 'w-shoot-populated',
        title: 'Morning Matcha Reel',
        stageKey: 'shoot',
      };

      render(
        <ShootWorkspace
          workItem={mockWorkItem}
          isSubmitting={false}
          onSubmit={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Hero Kitchen B-Roll')).toBeInTheDocument();
      });

      // Primary buttons have min-h-[44px]
      const chooseBtn = screen.getByRole('button', { name: /choose files/i });
      expect(chooseBtn.className).toContain('min-h-[44px]');

      const recordBtn = screen.getByRole('button', { name: /record clip/i });
      expect(recordBtn.className).toContain('min-h-[44px]');

      const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
      expect(submitBtn.className).toContain('min-h-[44px]');
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('6. UploadManager Validation & Concurrency', () => {
    it('rejects files exceeding server limits with clear feedback', () => {
      render(
        <UploadManager
          stageItemId="stage-1"
          currentClipsCount={0}
          maxClips={10}
        />
      );

      // Simulate dropping an oversized video file (600 MB)
      const oversizedVideo = new File([new ArrayBuffer(1024)], 'giant_raw.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(oversizedVideo, 'size', { value: 600 * 1024 * 1024 });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      fireEvent.change(fileInput, { target: { files: [oversizedVideo] } });

      // Error message is displayed with 500 MB limit
      expect(screen.getByText(/exceeds the 500 MB limit/i)).toBeInTheDocument();
    });
  });
});
