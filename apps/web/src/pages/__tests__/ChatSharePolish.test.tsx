import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ShareToChatModal } from '../chat/ShareToChatModal';
import { MediaCardPlayer } from '../chat/MediaCardPlayer';
import { AuthContext } from '../../context/AuthContext';

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/api';

describe('Share to Chat & Chat Polish Frontend Suite', () => {
  const mockUserAdmin = {
    id: 'user-admin',
    _id: 'user-admin',
    name: 'Admin Boss',
    role: 'admin',
    email: 'admin@haca.test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithAuth = (ui: React.ReactElement, user: any = mockUserAdmin) => {
    return render(
      <AuthContext.Provider
        value={{
          user,
          permissions: ['chat.use', 'chat.read', 'chat.group.create', 'chat.moderate'],
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: vi.fn().mockReturnValue(true),
          refreshUser: vi.fn(),
          isAuthenticated: true,
          isLoading: false,
        }}
      >
        {ui}
      </AuthContext.Provider>
    );
  };

  describe('1. ShareToChatModal Component', () => {
    it('loads accessible channels and selects default Team Chat', async () => {
      (apiFetch as any).mockResolvedValueOnce({
        channels: [
          { _id: 'team-1', id: 'team-1', name: 'Team Chat', type: 'team', isArchived: false },
          { _id: 'grp-2', id: 'grp-2', name: 'Design Sync', type: 'group', isArchived: false },
        ],
      });

      renderWithAuth(
        <ShareToChatModal
          assetId="clip-123"
          assetType="clip"
          contentPieceId="cp-456"
          contentPieceTitle="Spring Campaign"
          stageKey="Shoot"
          title="Scene 1 Master"
          thumbnailUrl="/thumbs/scene1.jpg"
          onClose={vi.fn()}
        />
      );

      // Modal container should be in the document
      expect(screen.getByTestId('share-to-chat-modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Share to Chat/i })).toBeInTheDocument();

      // Verify channel options are populated after load
      await waitFor(() => {
        expect(screen.getByText('# Team Chat (Everyone)')).toBeInTheDocument();
      });

      // Verify asset snapshot preview
      expect(screen.getByText('Scene 1 Master')).toBeInTheDocument();
      expect(screen.getByText(/Spring Campaign/)).toBeInTheDocument();
      expect(screen.getByText(/Shoot/)).toBeInTheDocument();
    });

    it('submits share payload with selected channel and custom note', async () => {
      (apiFetch as any)
        .mockResolvedValueOnce({
          channels: [
            { _id: 'team-1', id: 'team-1', name: 'Team Chat', type: 'team', isArchived: false },
          ],
        })
        .mockResolvedValueOnce({ success: true });

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithAuth(
        <ShareToChatModal
          assetId="clip-123"
          assetType="clip"
          contentPieceId="cp-456"
          contentPieceTitle="Spring Campaign"
          stageKey="Shoot"
          title="Scene 1 Master"
          thumbnailUrl="/thumbs/scene1.jpg"
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Destination Channel/i)).toBeInTheDocument();
      });

      // Enter a note
      const noteInput = screen.getByPlaceholderText(/Approved hook cut/i);
      fireEvent.change(noteInput, { target: { value: 'Approved for editing, take 1 selected!' } });

      // Click Share to Chat submit button
      const shareButton = screen.getByRole('button', { name: /Share to Chat/i });
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/chat/share',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Approved for editing, take 1 selected!'),
          })
        );
      });

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('2. MediaCardPlayer Component', () => {
    const mockSharedMedia = {
      grantId: 'grant-789',
      assetId: 'asset-101',
      assetType: 'clip',
      contentPieceId: 'cp-456',
      contentPieceTitle: 'Spring Campaign Launch',
      stageKey: 'Shoot',
      title: 'Interview With Founder',
      thumbnailUrl: '/thumbs/founder.jpg',
      previewUrl: 'https://cdn.example.com/founder.mp4',
      downloadUrl: '/api/chat/shared-asset/grant-789?download=1',
      owner: {
        _id: 'user-worker',
        name: 'Alice Video',
        avatarUrl: '/avatars/alice.png',
      },
      note: 'Here is the approved cut ready for sound mixing',
      isRevoked: false,
    };

    it('renders media card with play trigger, badge, owner and download link', () => {
      renderWithAuth(<MediaCardPlayer card={mockSharedMedia as any} />);

      expect(screen.getByTestId('shared-media-card')).toBeInTheDocument();
      expect(screen.getByText('Interview With Founder')).toBeInTheDocument();
      expect(screen.getByText(/Spring Campaign Launch/)).toBeInTheDocument();
      expect(screen.getByText(/Shoot/)).toBeInTheDocument();
      expect(screen.getByText('Alice Video')).toBeInTheDocument();
      expect(screen.getByText(/Here is the approved cut ready for sound mixing/)).toBeInTheDocument();

      // Download button
      const downloadBtn = screen.getByTitle(/Download asset/i);
      expect(downloadBtn).toBeInTheDocument();
      expect(downloadBtn.closest('a')).toHaveAttribute('href', expect.stringContaining('/api/chat/shared-asset/grant-789?download=1'));

      // Play button opens player
      const playBtn = screen.getByTitle(/Play Video/i);
      fireEvent.click(playBtn);
      expect(screen.getByTestId('inline-video-player')).toBeInTheDocument();
    });

    it('displays unshare button for privileged users and transitions to revoked state on click', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      (apiFetch as any).mockResolvedValueOnce({ success: true });
      const onRevokedMock = vi.fn();

      renderWithAuth(
        <MediaCardPlayer card={mockSharedMedia as any} onRevoked={onRevokedMock} />,
        mockUserAdmin
      );

      // Admin can see unshare button
      const unshareBtn = screen.getByTestId('unshare-btn');
      expect(unshareBtn).toBeInTheDocument();

      fireEvent.click(unshareBtn);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/chat/share/grant-789/revoke',
          expect.objectContaining({ method: 'POST' })
        );
        expect(onRevokedMock).toHaveBeenCalledWith('grant-789');
      });

      // Card should now render the revoked banner
      expect(screen.getByTestId('shared-media-revoked')).toBeInTheDocument();
      expect(screen.getByText(/No longer shared/i)).toBeInTheDocument();
    });

    it('renders revoked alert immediately when isRevoked: true', () => {
      renderWithAuth(
        <MediaCardPlayer
          card={{
            ...mockSharedMedia,
            isRevoked: true,
          } as any}
        />
      );

      expect(screen.getByTestId('shared-media-revoked')).toBeInTheDocument();
      expect(screen.getByText(/No longer shared/i)).toBeInTheDocument();
      expect(screen.queryByTitle(/Play Video/i)).not.toBeInTheDocument();
    });
  });
});
