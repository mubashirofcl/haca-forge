import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShootWorkspace } from '../ShootWorkspace';
import { EditWorkspace } from '../EditWorkspace';
import { DesignWorkspace } from '../DesignWorkspace';
import { PostWorkspace } from '../PostWorkspace';
import { EarlierOutputsViewer } from '../EarlierOutputsViewer';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock API fetch
vi.mock('../../../../lib/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({ success: true, data: { clips: [] } }),
}));

// Mock AuthContext
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', name: 'Test User', role: 'team_member' },
    hasPermission: () => true,
  }),
}));

// Mock useSocket
vi.mock('../../../../hooks/useSocket', () => ({
  useSocket: () => ({
    isConnected: true,
    socket: null,
    joinTask: vi.fn(),
    leaveTask: vi.fn(),
    emitTyping: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
  }),
}));

describe('Media Workspaces WS3 Component Tests', () => {
  describe('ShootWorkspace (Videographer)', () => {
    const mockWorkItem = {
      id: 'w-shoot-1',
      title: 'Coffee Machine Launch Video',
      stageKey: 'shoot',
      brief: 'Capture 4K B-roll and talking head in the kitchen studio.',
      shootDate: '2026-10-30',
      scriptContent: 'Scene 1: Close-up of espresso dripping into glass.\nScene 2: Creator smiles and takes a sip.',
    };

    it('renders tabs for Script, Brief, and Shot list with upload zone', () => {
      const onSubmit = vi.fn();

      render(
        <ShootWorkspace
          workItem={mockWorkItem}
          isSubmitting={false}
          onSubmit={onSubmit}
        />
      );

      // Upload zone is visible on the left
      expect(screen.getByText(/drag & drop clips here/i)).toBeInTheDocument();
      expect(screen.getByText(/choose files/i)).toBeInTheDocument();

      // Switch to Brief tab
      const briefTab = screen.getByRole('button', { name: /^brief/i });
      fireEvent.click(briefTab);
      expect(screen.getByText(/coffee machine launch video/i)).toBeInTheDocument();
      expect(screen.getByText(/capture 4k b-roll/i)).toBeInTheDocument();

      // Switch to Script tab to view read-only script
      const scriptTab = screen.getByRole('button', { name: /^script/i });
      fireEvent.click(scriptTab);
      expect(screen.getByText(/close-up of espresso dripping/i)).toBeInTheDocument();

      // Switch to Shot list tab
      const shotsTab = screen.getByRole('button', { name: /shot list/i });
      fireEvent.click(shotsTab);
      expect(screen.getByText(/shot coverage checklist/i)).toBeInTheDocument();
    });
  });

  describe('EditWorkspace (Video Editor)', () => {
    const mockWorkItem = {
      id: 'w-edit-1',
      title: 'Product Reel Cut',
      stageKey: 'edit',
      brief: 'Edit 60s Instagram Reel with fast-paced cuts and sound effects.',
      rawFootageUrls: ['https://storage.example.com/raw1.mp4', 'https://storage.example.com/raw2.mp4'],
      scriptContent: 'Hook: You are brewing coffee wrong.\nBody: Here is how to do it in 3 steps.',
      revisionComments: [
        { id: 'rev-1', text: 'Trim 2 seconds off the intro' },
        { id: 'rev-2', text: 'Add captions in Brand Yellow font' },
      ],
    };

    it('renders raw footage links, script, and interactive revision checklist', () => {
      const onSubmit = vi.fn();

      render(
        <EditWorkspace
          workItem={mockWorkItem}
          isSubmitting={false}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText(/product reel cut/i)).toBeInTheDocument();

      // Switch to Raw Footage tab
      const footageTab = screen.getByRole('button', { name: /raw footage/i });
      fireEvent.click(footageTab);
      expect(screen.getByText(/clip 1/i)).toBeInTheDocument();

      // Switch to Script tab
      const scriptTab = screen.getByRole('button', { name: /script/i });
      fireEvent.click(scriptTab);
      expect(screen.getByText(/you are brewing coffee wrong/i)).toBeInTheDocument();

      // Switch back to upload tab to see revision checklist
      const uploadTab = screen.getByRole('button', { name: /master cut upload/i });
      fireEvent.click(uploadTab);

      // Revision comments checklist
      expect(screen.getByText(/revision checklist/i)).toBeInTheDocument();
      expect(screen.getByText(/trim 2 seconds off the intro/i)).toBeInTheDocument();
      expect(screen.getByText(/add captions in brand yellow font/i)).toBeInTheDocument();

      // Toggle checklist items
      const checkItems = screen.getAllByRole('checkbox');
      expect(checkItems).toHaveLength(2);
      fireEvent.click(checkItems[0]);
      expect(screen.getByText(/1 of 2 resolved/i)).toBeInTheDocument();
      fireEvent.click(checkItems[1]);
      expect(screen.getByText(/2 of 2 resolved/i)).toBeInTheDocument();
    });

    it('renders video player and live chat when activeVideoUrl or deliverableUrl is present', () => {
      const onSubmit = vi.fn();
      render(
        <EditWorkspace
          workItem={{
            ...mockWorkItem,
            status: 'Feedback',
            revisions: 1,
            deliverableUrl: 'https://storage.example.com/cut-v1.mp4',
          }}
          activeVideoUrl="https://storage.example.com/cut-v1.mp4"
          revisionComments={[
            {
              id: 'c-1',
              content: 'Please adjust background music at 0:15',
              authorName: 'Creative Head',
              authorRole: 'creative_head',
              timecode: 15,
            },
          ]}
          isSubmitting={false}
          onSubmit={onSubmit}
        />
      );

      // Video cut and player top meta
      expect(screen.getByText(/master cut v1/i)).toBeInTheDocument();
      expect(screen.getByText(/live discussion & feedback/i)).toBeInTheDocument();
      expect(screen.getByText(/please adjust background music at 0:15/i)).toBeInTheDocument();
      expect(screen.getByText(/@00:15/i)).toBeInTheDocument();

      // Revision requested banner
      expect(screen.getByText(/revision requested by creative head/i)).toBeInTheDocument();
    });

    it('renders in read-only mode without upload buttons when readOnly is true', () => {
      const onSubmit = vi.fn();
      render(
        <EditWorkspace
          workItem={{
            ...mockWorkItem,
            status: 'Pending',
            deliverableUrl: 'https://storage.example.com/cut-v1.mp4',
          }}
          activeVideoUrl="https://storage.example.com/cut-v1.mp4"
          isSubmitting={false}
          onSubmit={onSubmit}
          readOnly={true}
        />
      );

      // Cut player is still visible
      expect(screen.getByText(/master cut v1/i)).toBeInTheDocument();
      expect(screen.getByText(/live discussion & feedback/i)).toBeInTheDocument();

      // Read-only banner is displayed
      expect(screen.getByText(/deliverable is currently in/i)).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Separate upload tab is not rendered
      expect(screen.queryByRole('button', { name: /^upload cut/i })).not.toBeInTheDocument();
    });
  });

  describe('DesignWorkspace (Graphic Designer)', () => {
    const mockWorkItem = {
      id: 'w-design-1',
      title: 'Instagram Carousel Graphic',
      stageKey: 'design',
      approvedCopy: {
        headline: '5 Design Rules Every Creator Must Know',
        bodyText: '1. Embrace white space.\n2. Limit fonts to two.\n3. High contrast creates focus.',
        callToAction: 'Save this post and share with your team.',
      },
    };

    it('provides copy buttons for approved text and carousel slide reordering', () => {
      const onSubmit = vi.fn();

      render(
        <DesignWorkspace
          workItem={mockWorkItem}
          isSubmitting={false}
          onSubmit={onSubmit}
        />
      );

      // Copy headline
      expect(screen.getByText(/5 design rules every creator must know/i)).toBeInTheDocument();
      const copyBtns = screen.getAllByTitle(/copy/i);
      expect(copyBtns.length).toBeGreaterThanOrEqual(3);

      fireEvent.click(copyBtns[0]);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('5 Design Rules Every Creator Must Know');

      // Size guides are visible
      expect(screen.getByText(/feed square/i)).toBeInTheDocument();
      expect(screen.getByText(/story \/ reel/i)).toBeInTheDocument();
    });
  });

  describe('PostWorkspace (Posting & Publishing)', () => {
    const mockWorkItem = {
      id: 'w-post-1',
      title: 'Post to Instagram & TikTok',
      stageKey: 'post',
      deliverableUrl: 'https://storage.example.com/final-cut.mp4',
      caption: 'Stop brewing bitter coffee! ☕ Here are the 3 secrets the pros never tell you.',
      hashtags: '#coffee #espresso #barista #morningroutine #coffeetutorial',
    };

    it('provides deliverable download, pre-publish checklist, and mark as posted with the live link only', () => {
      const onMarkAsPosted = vi.fn();

      render(
        <PostWorkspace
          workItem={mockWorkItem}
          finalAssets={[{ url: '/uploads/final-cut.mp4', name: 'final-cut.mp4', kind: 'upload' }]}
          isPosting={false}
          onMarkAsPosted={onMarkAsPosted}
        />
      );

      expect(screen.getByText(/post to instagram & tiktok/i)).toBeInTheDocument();

      // The approved final cut handed over from Edit downloads from here
      const downloadBtn = screen.getByRole('link', { name: /^download$/i });
      expect(downloadBtn).toHaveAttribute('href', '/uploads/final-cut.mp4');

      // No caption or hashtag fields: the step is marked posted with its live link only
      expect(screen.queryByLabelText(/post caption/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^hashtags/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /copy caption/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /copy hashtags/i })).not.toBeInTheDocument();

      // Mark as posted should initially be disabled until live URL is entered
      const markPostedBtn = screen.getByRole('button', { name: /mark as posted/i });
      expect(markPostedBtn).toBeDisabled();

      // Enter published link
      const urlInput = screen.getByPlaceholderText(/instagram\.com\/p/i);
      fireEvent.change(urlInput, { target: { value: 'https://instagram.com/p/ABC123xyz' } });

      // Mark as posted should now be enabled
      expect(markPostedBtn).not.toBeDisabled();
      fireEvent.click(markPostedBtn);

      expect(onMarkAsPosted).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedUrl: 'https://instagram.com/p/ABC123xyz',
        })
      );
      expect(onMarkAsPosted.mock.calls[0][0]).not.toHaveProperty('caption');
    });

    it('allows SM Manager / worker to attach post file asset and submit with live social reference link', async () => {
      const onMarkAsPosted = vi.fn();

      render(
        <PostWorkspace
          workItem={{
            id: 'w-post-2',
            title: 'SM Manager Post Upload',
            stageKey: 'Post',
          }}
          isPosting={false}
          onMarkAsPosted={onMarkAsPosted}
        />
      );

      // Verify upload zone is present
      expect(screen.getByText(/upload post media \/ creative asset/i)).toBeInTheDocument();

      // Switch to manual asset link input
      const switchBtn = screen.getByRole('button', { name: /paste asset url instead/i });
      fireEvent.click(switchBtn);

      const assetInput = screen.getByPlaceholderText(/drive\.google\.com/i);
      const attachBtn = screen.getByRole('button', { name: /attach/i });

      // Only Google Drive links are accepted (the same shared rule as the API)
      fireEvent.change(assetInput, { target: { value: 'https://cdn.haca.com/final_post_graphic.png' } });
      expect(attachBtn).toBeDisabled();

      fireEvent.change(assetInput, { target: { value: 'https://drive.google.com/file/d/final_post_graphic' } });
      fireEvent.click(attachBtn);

      // Verify asset attached
      expect(screen.getByText(/attached post asset/i)).toBeInTheDocument();

      // Enter social reference link
      const liveUrlInput = screen.getByPlaceholderText(/instagram\.com\/p/i);
      fireEvent.change(liveUrlInput, { target: { value: 'https://instagram.com/reel/C89abcdef' } });

      // The live link is all that is needed to post
      const markPostedBtn = screen.getByRole('button', { name: /mark as posted/i });
      expect(markPostedBtn).not.toBeDisabled();
      fireEvent.click(markPostedBtn);

      expect(onMarkAsPosted).toHaveBeenCalledWith(
        expect.objectContaining({
          publishedUrl: 'https://instagram.com/reel/C89abcdef',
          deliverableUrl: 'https://drive.google.com/file/d/final_post_graphic',
        })
      );
    });
  });

  describe('EarlierOutputsViewer (Teammates Read-Only View)', () => {
    const mockOutputs = [
      {
        id: 'out-1',
        stageName: 'Script',
        workerName: 'David S.',
        textContent: 'Hook: The ultimate winter jacket.',
        updatedAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'out-2',
        stageName: 'Shoot',
        workerName: 'Elena V.',
        fileUrl: 'https://storage.example.com/raw-clip.mp4',
        updatedAt: '2026-10-26T14:30:00Z',
      },
    ];

    it('renders read-only cards of prior stages for non-owning team members', () => {
      render(
        <EarlierOutputsViewer
          outputs={mockOutputs}
          currentStageTitle="Edit Deliverable"
        />
      );

      expect(screen.getByText(/earlier outputs/i)).toBeInTheDocument();
      expect(screen.getByText(/david s\./i)).toBeInTheDocument();
      expect(screen.getByText(/hook: the ultimate winter jacket\./i)).toBeInTheDocument();
      expect(screen.getByText(/elena v\./i)).toBeInTheDocument();
      expect(screen.getByText(/download file/i)).toBeInTheDocument();
    });
  });
});
