import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DecisionBar } from '../DecisionBar';
import { DocumentViewer } from '../DocumentViewer';
import { VideoPlayerViewer } from '../VideoPlayerViewer';
import { ImageViewer } from '../ImageViewer';
import { LinkOpenerViewer } from '../LinkOpenerViewer';
import { ReviewStudioSidebar } from '../ReviewStudioSidebar';
import { ReviewStudioPage } from '../ReviewStudioPage';

const mockApiFetch = vi.fn();
vi.mock('../../../../lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-ch-1', name: 'Creative Lead', role: 'creative_head' },
  }),
}));

describe('Review Studio Components & Decision Rules', () => {
  describe('DecisionBar Rules & Shortcuts', () => {
    it('disables Approve when no star rating (0) is selected and requires 1 to 5', () => {
      const onApprove = vi.fn();
      const onRequestRevision = vi.fn();

      render(
        <DecisionBar
          hasComments={false}
          commentCount={0}
          isSubmitting={false}
          onApprove={onApprove}
          onRequestRevision={onRequestRevision}
        />
      );

      // Initially rating is 0, so Approve button is disabled
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      expect(approveBtn).toBeDisabled();

      // Click star 4
      const star4 = screen.getByLabelText(/4 stars/i);
      fireEvent.click(star4);

      // Now Approve should be enabled
      expect(approveBtn).not.toBeDisabled();

      // Click Approve
      fireEvent.click(approveBtn);
      expect(onApprove).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 4,
        })
      );
    });

    it('disables Request Revision when there are no comments and no revision note', () => {
      const onApprove = vi.fn();
      const onRequestRevision = vi.fn();

      render(
        <DecisionBar
          hasComments={false}
          commentCount={0}
          isSubmitting={false}
          onApprove={onApprove}
          onRequestRevision={onRequestRevision}
        />
      );

      // Open revision dialog
      const openRevBtn = screen.getByRole('button', { name: /request revision/i });
      fireEvent.click(openRevBtn);

      // Submit Revision inside modal should be disabled because note is empty and hasComments=false
      const submitRevBtn = screen.getByRole('button', { name: /send revision request/i });
      expect(submitRevBtn).toBeDisabled();

      // Typing a note enables it
      const textarea = screen.getByPlaceholderText(/describe required changes/i);
      fireEvent.change(textarea, { target: { value: 'Fix the color grading in the intro' } });

      expect(submitRevBtn).not.toBeDisabled();
      fireEvent.click(submitRevBtn);

      expect(onRequestRevision).toHaveBeenCalledWith({
        note: 'Fix the color grading in the intro',
        rootCause: 'quality',
      });
    });

    it('enables Request Revision when there are anchored comments even with empty note', () => {
      const onApprove = vi.fn();
      const onRequestRevision = vi.fn();

      render(
        <DecisionBar
          hasComments={true}
          commentCount={2}
          isSubmitting={false}
          onApprove={onApprove}
          onRequestRevision={onRequestRevision}
        />
      );

      // Open revision dialog
      const openRevBtn = screen.getByRole('button', { name: /request revision/i });
      fireEvent.click(openRevBtn);

      // Submit Revision should already be enabled because hasComments is true
      const submitRevBtn = screen.getByRole('button', { name: /send revision request/i });
      expect(submitRevBtn).not.toBeDisabled();

      fireEvent.click(submitRevBtn);
      expect(onRequestRevision).toHaveBeenCalledWith({
        note: '',
        rootCause: 'quality',
      });
    });

    it('supports keyboard shortcuts for rating (1-5), A, R, [, and ]', () => {
      const onApprove = vi.fn();
      const onRequestRevision = vi.fn();
      const onPrevItem = vi.fn();
      const onNextItem = vi.fn();

      render(
        <DecisionBar
          hasComments={true}
          commentCount={1}
          isSubmitting={false}
          onApprove={onApprove}
          onRequestRevision={onRequestRevision}
          onPrevItem={onPrevItem}
          onNextItem={onNextItem}
        />
      );

      // Press '5' to rate 5 stars
      fireEvent.keyDown(window, { key: '5' });
      const approveBtn = screen.getByRole('button', { name: /approve/i });
      expect(approveBtn).not.toBeDisabled();

      // Press '[' to navigate to previous
      fireEvent.keyDown(window, { key: '[' });
      expect(onPrevItem).toHaveBeenCalledTimes(1);

      // Press ']' to navigate to next
      fireEvent.keyDown(window, { key: ']' });
      expect(onNextItem).toHaveBeenCalledTimes(1);

      // Press 'A' to trigger approve
      fireEvent.keyDown(window, { key: 'a' });
      expect(onApprove).toHaveBeenCalledWith(
        expect.objectContaining({
          rating: 5,
        })
      );
    });
  });

  describe('DocumentViewer', () => {
    it('renders text document and highlights word-level diffs in diff mode', () => {
      render(
        <DocumentViewer
          title="Episode 1 Script"
          content="This is the approved new script version."
          versionNumber={2}
          comments={[]}
          activeCommentId={null}
          onSelectComment={vi.fn()}
          onAddTextComment={vi.fn()}
          isDiffMode={true}
          diffBaseContent="This is the old draft version."
        />
      );

      expect(screen.getByText(/episode 1 script/i)).toBeInTheDocument();
      expect(screen.getByText(/version 2/i)).toBeInTheDocument();
      expect(screen.getByText(/diff compare mode/i)).toBeInTheDocument();

      // Check that deletions and additions are rendered
      expect(screen.getByText(/old/i)).toBeInTheDocument();
      expect(screen.getByText(/approved/i)).toBeInTheDocument();
    });
  });

  describe('VideoPlayerViewer', () => {
    it('renders native video player with speed control and pinned timecode comments', () => {
      const onSelectComment = vi.fn();
      const mockComments = [
        {
          id: 'c1',
          author: { id: 'u1', name: 'Director' },
          content: 'Lighting looks dim here',
          createdAt: new Date().toISOString(),
          anchor: { type: 'time', seconds: 12 },
        },
      ];

      render(
        <VideoPlayerViewer
          src="https://example.com/reel.mp4"
          title="Reel Final Cut"
          comments={mockComments}
          activeCommentId={null}
          onSelectComment={onSelectComment}
          onAddVideoComment={vi.fn()}
        />
      );

      expect(screen.getByText(/reel final cut/i)).toBeInTheDocument();
      // Speed button (1x)
      const speedBtn = screen.getByRole('button', { name: /1x/i });
      expect(speedBtn).toBeInTheDocument();

      // Pin indicator for 12s comment on the timeline
      const pin = screen.getByTitle(/director at 12s/i);
      expect(pin).toBeInTheDocument();

      fireEvent.click(pin);
      expect(onSelectComment).toHaveBeenCalledWith('c1');
    });
  });

  describe('ImageViewer', () => {
    it('renders image, zoom controls, and coordinate pins for point comments', () => {
      const onSelectComment = vi.fn();
      const mockComments = [
        {
          id: 'img-c1',
          author: { id: 'u2', name: 'Art Director' },
          content: 'Logo alignment is slightly off',
          createdAt: new Date().toISOString(),
          anchor: { type: 'point', x: 25, y: 30 },
        },
      ];

      render(
        <ImageViewer
          images={['https://example.com/banner.png']}
          comments={mockComments}
          activeCommentId={null}
          onSelectComment={onSelectComment}
          onAddPointComment={vi.fn()}
        />
      );

      // Zoom in button
      const zoomInBtn = screen.getByTitle(/zoom in/i);
      expect(zoomInBtn).toBeInTheDocument();
      fireEvent.click(zoomInBtn);
      expect(screen.getByText(/125%/i)).toBeInTheDocument();

      // Coordinate Pin
      const pin = screen.getByTitle(/art director/i);
      expect(pin).toBeInTheDocument();

      fireEvent.click(pin);
      expect(onSelectComment).toHaveBeenCalledWith('img-c1');
    });

    it('renders carousel gallery thumbnails for multi-slide images', () => {
      const slides = [
        'https://example.com/slide1.png',
        'https://example.com/slide2.png',
        'https://example.com/slide3.png',
      ];

      render(
        <ImageViewer
          images={slides}
          comments={[]}
          activeCommentId={null}
          onSelectComment={vi.fn()}
          onAddPointComment={vi.fn()}
        />
      );

      expect(screen.getByText(/slide 1 of 3/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slide 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slide 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slide 3/i })).toBeInTheDocument();

      // Click slide 2
      fireEvent.click(screen.getByRole('button', { name: /slide 2/i }));
      expect(screen.getByText(/slide 2 of 3/i)).toBeInTheDocument();
    });
  });

  describe('LinkOpenerViewer', () => {
    it('renders destination URL, title, and open in new tab action', () => {
      render(
        <LinkOpenerViewer
          url="https://figma.com/design/test-id"
          title="Figma Prototype Design"
          notes="Interactive prototype for review"
        />
      );

      expect(screen.getByText(/figma prototype design/i)).toBeInTheDocument();
      expect(screen.getByText(/https:\/\/figma\.com\/design\/test-id/i)).toBeInTheDocument();
      expect(screen.getByText(/interactive prototype for review/i)).toBeInTheDocument();

      const openLink = screen.getByRole('link', { name: /open in new tab/i });
      expect(openLink).toHaveAttribute('href', 'https://figma.com/design/test-id');
      expect(openLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('ReviewStudioSidebar', () => {
    it('switches between Comments, Brief, Earlier Outputs, and Versions tabs', () => {
      const mockComments = [
        {
          id: 'c1',
          author: { id: 'u1', name: 'Reviewer' },
          content: 'Check the tone in hook',
          createdAt: new Date().toISOString(),
          anchor: { type: 'timecode', timecode: 5 },
        },
      ];

      const mockEarlierOutputs = [
        {
          id: 'eo1',
          stageName: 'Script',
          workerName: 'Writer Alice',
          textContent: 'Hook: Stop scrolling right now!',
          updatedAt: new Date().toISOString(),
        },
      ];

      render(
        <ReviewStudioSidebar
          brief="Make a 60s reel promoting product launch"
          earlierOutputs={mockEarlierOutputs}
          versions={[
            { id: 'v1', versionNumber: 1, submittedAt: '2026-10-25' },
            { id: 'v2', versionNumber: 2, submittedAt: '2026-10-26' },
          ]}
          activeVersionId="v2"
          onSelectVersion={vi.fn()}
          comments={mockComments}
          activeCommentId="c1"
          onSelectComment={vi.fn()}
          onResolveComment={vi.fn()}
          onAddGeneralComment={vi.fn()}
          isDiffMode={false}
          onToggleDiffMode={vi.fn()}
        />
      );

      // Comments tab is active by default
      expect(screen.getByText(/check the tone in hook/i)).toBeInTheDocument();

      // Switch to Brief tab
      fireEvent.click(screen.getByRole('tab', { name: /brief/i }));
      expect(screen.getByText(/make a 60s reel promoting product launch/i)).toBeInTheDocument();

      // Switch to Earlier Outputs tab
      fireEvent.click(screen.getByRole('tab', { name: /outputs/i }));
      expect(screen.getByText(/writer alice/i)).toBeInTheDocument();
      expect(screen.getByText(/stop scrolling right now!/i)).toBeInTheDocument();

      // Switch to Versions tab
      fireEvent.click(screen.getByRole('tab', { name: /versions/i }));
      expect(screen.getByText(/version 1/i)).toBeInTheDocument();
      expect(screen.getByText(/version 2/i)).toBeInTheDocument();
    });
  });

  describe('ReviewStudioPage with Shoot Submissions', () => {
    it('renders ShootReviewView with uploaded clips gallery instead of fallback document text', async () => {
      const mockShootSubmission = {
        id: 'sub-shoot-101',
        _id: 'sub-shoot-101',
        version: 1,
        kind: 'video',
        deliverableType: 'video',
        notes: 'Clips submitted for review',
        files: [
          {
            name: 'car-front-b-roll',
            url: '/uploads/car-front.jpg',
            thumbnailUrl: '/uploads/car-front.jpg',
            mimeType: 'image/jpeg',
          },
        ],
        metadata: {
          totalClips: 1,
          clipIds: ['clip-car-1'],
        },
        workItemId: {
          _id: 'work-shoot-101',
          id: 'work-shoot-101',
          title: 'Behind the Scenes: Fall Tech Showcase 2026 - Shoot',
          stageKey: 'Shoot',
          step: 'Shoot',
          ownerId: {
            name: 'Test Shooter',
            role: 'team_member',
          },
        },
      };

      const mockClipsData = {
        clips: [
          {
            _id: 'clip-car-1',
            stageItemId: 'work-shoot-101',
            kind: 'image',
            title: 'car-front-b-roll',
            url: '/uploads/car-front.jpg',
            thumbnailUrl: '/uploads/car-front.jpg',
            take: 1,
            status: 'waiting_review',
            unreadCount: 0,
          },
        ],
        shotList: [],
        coverage: '1 of 1 shots covered',
      };

      mockApiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/submissions/review-queue') {
          return [mockShootSubmission];
        }
        if (url.includes('/api/submissions/sub-shoot-101')) {
          return mockShootSubmission;
        }
        if (url.includes('/api/work/work-shoot-101/clips')) {
          return mockClipsData;
        }
        if (url.includes('/api/submissions?workItemId=')) {
          return [mockShootSubmission];
        }
        if (url.includes('/messages')) {
          return [];
        }
        return {};
      });

      render(
        <MemoryRouter initialEntries={['/feedback/review-studio']}>
          <ReviewStudioPage />
        </MemoryRouter>
      );

      // Verify that the uploaded clips gallery is rendered, showing the clip title and coverage
      await waitFor(() => {
        expect(screen.getByText('Clips Gallery (1)')).toBeInTheDocument();
        expect(screen.getByText('car-front-b-roll')).toBeInTheDocument();
        expect(screen.getByText('1 of 1 shots covered')).toBeInTheDocument();
      });

      // Verify that the photo asset tag and review tools are visible
      expect(screen.getByText(/Photo \/ Still Asset/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve clip/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reshoot needed/i })).toBeInTheDocument();
    });
  });
});
