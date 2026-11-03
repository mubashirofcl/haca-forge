import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatPage from '../chat/ChatPage';
import { EmojiPicker, QuickReactionsBar } from '../chat/EmojiPicker';
import { MediaCardPlayer } from '../chat/MediaCardPlayer';
import { ShareToChatModal } from '../chat/ShareToChatModal';
import { GroupModal } from '../chat/GroupModal';
import { Layout } from '../../components/Layout';
import { ChatChannelTypeDetail, ChatSharedMediaCard } from '@mmp/shared';

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/api';

// Mock useSocket
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({
    isConnected: true,
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
    emitTyping: vi.fn(),
    emitRead: vi.fn(),
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
  }),
}));

// Mock AuthContext
let mockCurrentUser: any = {
  id: 'user-admin-1',
  _id: 'user-admin-1',
  name: 'Dev Admin',
  preferredName: 'Admin',
  email: 'admin@marketingos.com',
  role: 'admin',
  department: 'Marketing',
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: (perm: string) => {
      if (mockCurrentUser.role === 'admin') return true;
      if (mockCurrentUser.role === 'executive') return perm === 'chat.read';
      return ['chat.use', 'chat.group.create'].includes(perm);
    },
    logout: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockChannels: ChatChannelTypeDetail[] = [
  {
    id: 'chan-team-1',
    _id: 'chan-team-1',
    name: 'Team Chat',
    type: 'team',
    isArchived: false,
    unreadCount: 3,
    lastMessageAt: '2026-10-29T10:00:00.000Z',
    lastMessageSnippet: 'Welcome to the team!',
    createdAt: '2026-10-29T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
  },
  {
    id: 'chan-group-1',
    _id: 'chan-group-1',
    name: 'Diwali Video Sprint',
    description: 'Planning & assets for Diwali campaign',
    type: 'group',
    isArchived: false,
    unreadCount: 0,
    createdById: 'user-admin-1',
    createdAt: '2026-10-29T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
  },
  {
    id: 'chan-dm-1',
    _id: 'chan-dm-1',
    name: 'Sarah Connor',
    type: 'dm',
    isArchived: false,
    unreadCount: 1,
    createdAt: '2026-10-29T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
    otherUser: {
      _id: 'user-sarah-2',
      name: 'Sarah Connor',
      role: 'team_member',
      jobRole: 'Video Editor',
    },
  },
];

describe('Team Chat Frontend Suite (Phase CH1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockCurrentUser = {
      id: 'user-admin-1',
      _id: 'user-admin-1',
      name: 'Dev Admin',
      preferredName: 'Admin',
      email: 'admin@marketingos.com',
      role: 'admin',
      department: 'Marketing',
    };
  });

  // ---------------------------------------------------------------------------
  // 1. Layout Top Bar Chat Button & Live Unread Badge
  // ---------------------------------------------------------------------------
  describe('1. Top Bar Chat Button & Unread Counter', () => {
    it('renders the top-bar chat button with link to /chat and displays unread badge', async () => {
      (apiFetch as any).mockImplementation((url: string) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({
            channels: [
              { id: 'c1', unreadCount: 4 },
              { id: 'c2', unreadCount: 2 },
            ],
          });
        }
        if (url.includes('/admin/access-requests')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout>
              <div>Dashboard Page Content</div>
            </Layout>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const chatBtn = screen.getByTestId('top-bar-chat-btn');
      expect(chatBtn).toBeInTheDocument();
      expect(chatBtn.getAttribute('href')).toBe('/chat');

      // Wait for channels fetch and unread calculation (4 + 2 = 6)
      await waitFor(() => {
        const badge = screen.getByTestId('chat-unread-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('6');
      });
    });

    it('caps unread badge at 99+ when total unread count exceeds 99', async () => {
      (apiFetch as any).mockImplementation((url: string) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({
            channels: [{ id: 'c1', unreadCount: 150 }],
          });
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout>
              <div>Dashboard Page Content</div>
            </Layout>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const badge = screen.getByTestId('chat-unread-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('99+');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. ChatPage Channel List & Selection
  // ---------------------------------------------------------------------------
  describe('2. ChatPage Channel Navigation & Stream', () => {
    it('renders Team Chat pinned on top, Groups, and Direct Messages', async () => {
      (apiFetch as any).mockImplementation((url: string) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({ channels: mockChannels });
        }
        if (url === '/api/chat/channels/chan-team-1') {
          return Promise.resolve({
            channel: mockChannels[0],
            members: [],
            pinnedMessages: [],
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ messages: [], nextCursor: null, hasMore: false });
        }
        if (url.includes('/members')) {
          return Promise.resolve({ members: [] });
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/chat']}>
            <ChatPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify channel categories appear
      expect(await screen.findByText('Team Chat')).toBeInTheDocument();
      expect(screen.getByText(/Groups \(\d+\)/i)).toBeInTheDocument();
      expect(screen.getByText('Diwali Video Sprint')).toBeInTheDocument();
      expect(screen.getByText('Direct Messages')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();

      // Unread count badge for non-active channel (Sarah Connor DM: 1)
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('loads messages and members when a channel is selected', async () => {
      const mockMessages = [
        {
          _id: 'msg-1',
          channelId: 'chan-team-1',
          senderId: 'user-admin-1',
          sender: { _id: 'user-admin-1', name: 'Dev Admin', role: 'admin' },
          content: 'Hello everyone in Team Chat!',
          reactions: [],
          attachments: [],
          createdAt: '2026-10-29T10:05:00.000Z',
        },
      ];

      (apiFetch as any).mockImplementation((url: string) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({ channels: mockChannels });
        }
        if (url === '/api/chat/channels/chan-team-1') {
          return Promise.resolve({
            channel: mockChannels[0],
            members: [
              {
                _id: 'm1',
                userId: 'user-admin-1',
                channelId: 'chan-team-1',
                role: 'admin',
                joinedAt: '2026-10-29T00:00:00.000Z',
                user: { _id: 'user-admin-1', name: 'Dev Admin', role: 'admin' },
              },
            ],
            pinnedMessages: [],
          });
        }
        if (url === '/api/chat/channels/chan-team-1/messages') {
          return Promise.resolve({ messages: mockMessages, nextCursor: null, hasMore: false });
        }
        if (url.includes('/read')) {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/chat/chan-team-1']}>
            <Routes>
              <Route path="/chat/:channelId" element={<ChatPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Wait for message to render in the stream
      expect(await screen.findByText('Hello everyone in Team Chat!')).toBeInTheDocument();
      expect(screen.getByText('Dev Admin')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Executive Read-Only Rule
  // ---------------------------------------------------------------------------
  describe('3. Executive Read-Only Mode', () => {
    it('displays read-only notice and disables composer for executive role', async () => {
      mockCurrentUser = {
        id: 'user-exec-1',
        _id: 'user-exec-1',
        name: 'Chief Executive',
        role: 'executive',
        email: 'ceo@marketingos.com',
      };

      (apiFetch as any).mockImplementation((url: string) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({ channels: [mockChannels[0]] }); // Team Chat only
        }
        if (url === '/api/chat/channels/chan-team-1') {
          return Promise.resolve({
            channel: mockChannels[0],
            members: [],
            pinnedMessages: [],
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ messages: [], nextCursor: null, hasMore: false });
        }
        return Promise.resolve({});
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/chat/chan-team-1']}>
            <Routes>
              <Route path="/chat/:channelId" element={<ChatPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify read-only notice is rendered instead of composer form
      expect(
        await screen.findByText('Executives have read-only access in team channels.')
      ).toBeInTheDocument();

      // Ensure send button and file attachments are absent
      expect(screen.queryByTitle('Send message')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Attach files (images, docs, video)')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Built-in Unicode EmojiPicker & Quick Reactions
  // ---------------------------------------------------------------------------
  describe('4. Native Unicode EmojiPicker & QuickReactionsBar', () => {
    it('renders categories in EmojiPicker and triggers onSelect on click', () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      render(<EmojiPicker onSelect={handleSelect} onClose={handleClose} />);

      expect(screen.getByTestId('chat-emoji-picker')).toBeInTheDocument();
      expect(screen.getByText('Smileys')).toBeInTheDocument();
      expect(screen.getByText('Gestures')).toBeInTheDocument();
      expect(screen.getByText('Hearts')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();

      // Click first emoji (e.g. 😀)
      const firstEmojiBtn = screen.getByText('😀');
      fireEvent.click(firstEmojiBtn);

      expect(handleSelect).toHaveBeenCalledWith('😀');
    });

    it('renders the 6 canonical reactions in QuickReactionsBar and triggers onReact', () => {
      const handleReact = vi.fn();
      const handleClose = vi.fn();

      render(<QuickReactionsBar onReact={handleReact} onClose={handleClose} />);

      expect(screen.getByTestId('chat-quick-reactions')).toBeInTheDocument();

      // Verify all 6 canonical emojis: 👍, ❤️, 😂, 🎉, 👀, ✅
      const thumbsUp = screen.getByTitle('👍');
      const heart = screen.getByTitle('❤️');
      const laugh = screen.getByTitle('😂');
      const party = screen.getByTitle('🎉');
      const eyes = screen.getByTitle('👀');
      const check = screen.getByTitle('✅');

      expect(thumbsUp).toBeInTheDocument();
      expect(heart).toBeInTheDocument();
      expect(laugh).toBeInTheDocument();
      expect(party).toBeInTheDocument();
      expect(eyes).toBeInTheDocument();
      expect(check).toBeInTheDocument();

      // Click party reaction
      fireEvent.click(party);
      expect(handleReact).toHaveBeenCalledWith('🎉');
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. MediaCardPlayer & Scoped ShareGrant State
  // ---------------------------------------------------------------------------
  describe('5. MediaCardPlayer & ShareGrant State', () => {
    it('renders approved media deliverable card with details and action buttons', () => {
      const mockCard: ChatSharedMediaCard = {
        grantId: 'grant-123',
        assetId: 'asset-456',
        assetType: 'clip',
        contentPieceId: 'cp-789',
        contentPieceTitle: 'Diwali Teaser Reel',
        stageKey: 'shoot',
        title: 'Scene 1 Cut A - Approved Hook',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        downloadUrl: 'https://cdn.example.com/video.mp4',
        owner: {
          _id: 'user-admin-1',
          name: 'Dev Admin',
        },
        isRevoked: false,
      };

      render(<MediaCardPlayer card={mockCard} />);

      expect(screen.getByTestId('shared-media-card')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText(/Diwali Teaser Reel • shoot/i)).toBeInTheDocument();
      expect(screen.getByText('Scene 1 Cut A - Approved Hook')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Watch/i })).toBeInTheDocument();
      expect(screen.getByTitle('Download asset')).toBeInTheDocument();
    });

    it('renders revoked state banner when ShareGrant has been revoked', () => {
      const revokedCard: ChatSharedMediaCard = {
        grantId: 'grant-revoked',
        assetId: 'asset-456',
        assetType: 'clip',
        contentPieceId: 'cp-789',
        contentPieceTitle: 'Diwali Teaser Reel',
        stageKey: 'shoot',
        title: 'Scene 1 Cut A - Revoked Asset',
        owner: {
          _id: 'user-admin-1',
          name: 'Dev Admin',
        },
        isRevoked: true,
      };

      render(<MediaCardPlayer card={revokedCard} />);

      expect(screen.getByTestId('shared-media-revoked')).toBeInTheDocument();
      expect(
        screen.getByText('This asset is no longer shared in this channel. Access was revoked.')
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. ShareToChatModal
  // ---------------------------------------------------------------------------
  describe('6. ShareToChatModal', () => {
    it('loads destination channels and submits share request with optional note', async () => {
      (apiFetch as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/api/chat/channels') {
          return Promise.resolve({ channels: mockChannels });
        }
        if (url === '/api/chat/share' && opts?.method === 'POST') {
          return Promise.resolve({
            grant: { id: 'grant-new-1', assetId: 'clip-101' },
            message: { id: 'msg-shared-1' },
          });
        }
        return Promise.resolve({});
      });

      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      render(
        <ShareToChatModal
          assetId="clip-101"
          assetType="clip"
          contentPieceId="cp-diwali"
          contentPieceTitle="Diwali Promo 2026"
          stageKey="edit"
          title="Final Cut Reel v2"
          thumbnailUrl="https://cdn.example.com/reel.jpg"
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      // Verify modal content
      expect(screen.getByRole('heading', { name: /Share to Chat/i })).toBeInTheDocument();
      expect(screen.getByText('Final Cut Reel v2')).toBeInTheDocument();
      expect(screen.getByText(/Diwali Promo 2026 • edit/i)).toBeInTheDocument();

      // Wait for channels to load into dropdown
      await waitFor(() => {
        expect(screen.getByLabelText(/Destination Channel/i)).toBeInTheDocument();
      });

      // Type an optional note
      const noteInput = screen.getByPlaceholderText(/e\.g\. Approved hook cut ready/i);
      fireEvent.change(noteInput, { target: { value: 'Approved final cut ready for feedback!' } });

      // Click Share to Chat submit button
      const shareSubmitBtn = screen.getByRole('button', { name: /Share to Chat/i });
      fireEvent.click(shareSubmitBtn);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/chat/share',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Approved final cut ready for feedback!'),
          })
        );
        expect(handleSuccess).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 7. GroupModal
  // ---------------------------------------------------------------------------
  describe('7. GroupModal (Creation & Member Selection)', () => {
    it('validates required fields, renders active users, and submits group creation', async () => {
      const mockPeople = [
        {
          _id: 'user-2',
          name: 'Jane Doe',
          preferredName: 'Jane',
          role: 'team_member',
          jobRole: 'Copywriter',
        },
        {
          _id: 'user-3',
          name: 'John Smith',
          role: 'sm_manager',
          jobRole: 'Social Lead',
        },
      ];

      (apiFetch as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/api/people?status=active') {
          return Promise.resolve({ people: mockPeople });
        }
        if (url === '/api/chat/channels/groups' && opts?.method === 'POST') {
          return Promise.resolve({
            channel: {
              _id: 'group-new-1',
              name: 'Q4 Product Launch',
              type: 'group',
            },
          });
        }
        return Promise.resolve({});
      });

      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      render(<GroupModal onClose={handleClose} onSuccess={handleSuccess} />);

      expect(screen.getByText('Create New Group')).toBeInTheDocument();

      // Button is initially disabled when name is empty
      const submitBtn = screen.getByRole('button', { name: /Create Group/i });
      expect(submitBtn).toBeDisabled();

      // Enter group name & description
      const nameInput = screen.getByPlaceholderText(/e\.g\. Video Sprint, Reel Cutters, Design Team/i);
      const descInput = screen.getByPlaceholderText(/Brief description of this group purpose\.\.\./i);
      fireEvent.change(nameInput, { target: { value: 'Q4 Product Launch' } });
      fireEvent.change(descInput, { target: { value: 'Assets and copy alignment' } });

      // Button should now be enabled
      expect(submitBtn).toBeEnabled();

      // Wait for users to load and select Jane Doe
      await waitFor(() => {
        expect(screen.getByText('Jane (Jane Doe)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Jane (Jane Doe)'));

      // Submit form
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/chat/channels/groups',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              name: 'Q4 Product Launch',
              description: 'Assets and copy alignment',
              memberIds: ['user-2'],
            }),
          })
        );
        expect(handleSuccess).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });
});
