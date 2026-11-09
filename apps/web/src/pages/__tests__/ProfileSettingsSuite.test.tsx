import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Avatar } from '../../components/Avatar';
import { UserMenuDropdown } from '../../components/UserMenuDropdown';
import { ProfileView, ProfileData } from '../../components/ProfileView';
import { SettingsPage } from '../SettingsPage';
import { WelcomePage } from '../WelcomePage';

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/api';

// Mock AuthContext
let mockUser: any = {
  id: 'user-12345',
  _id: 'user-12345',
  name: 'Dev Admin',
  preferredName: 'Alfie',
  email: 'admin@marketingos.com',
  role: 'admin',
  department: 'Marketing',
  skills: ['React', 'Leadership'],
  capacity: 40,
  attendance: 'present',
  profileCompletedAt: '2026-01-01T00:00:00.000Z',
};

const mockRefreshUser = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
    hasPermission: () => true,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const makeMockProfile = (role: string, overrides: Partial<ProfileData> = {}): ProfileData => ({
  id: 'mock-user-1',
  _id: 'mock-user-1',
  name: 'Taylor Swift',
  preferredName: 'Tay',
  email: 'taylor@marketingos.com',
  role,
  jobRole: 'Creative Director',
  department: 'Creative Dept',
  departmentId: 'dept-1',
  status: 'active',
  avatarUrl: null,
  avatarStorageId: null,
  phone: '+15551234567',
  whatsappNumber: '+15551234567',
  languages: ['English', 'Spanish'],
  about: 'Crafting premium campaigns.',
  skills: ['Direction', 'Storytelling'],
  weeklyCapacityHours: 40,
  workPreferences: ['Content', 'Script'],
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: '2026-10-29T10:00:00.000Z',
  rolePanelData: null,
  ...overrides,
});

describe('Profile & Settings Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Universal Avatar Component', () => {
    it('renders initials and deterministic gradient when avatarUrl is absent', () => {
      const { container } = render(
        <Avatar name="Taylor Swift" userId="taylor-swift-id-99" size="md" />
      );

      expect(screen.getByText('TS')).toBeInTheDocument();
      const avatarDiv = container.querySelector('div');
      expect(avatarDiv).toHaveClass('rounded-full');
      expect(avatarDiv).toHaveClass('w-10'); // md is 40px (w-10)
    });

    it('renders image with alt text when avatarUrl is provided', () => {
      render(
        <Avatar
          url="/uploads/avatar.webp"
          name="Taylor Swift"
          userId="taylor-swift-id-99"
          size="lg"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/uploads/avatar.webp');
      expect(img).toHaveAttribute('alt', 'Taylor Swift');
    });

    it('supports sizes: xs, sm, md, lg, xl without presence dot', () => {
      const { container } = render(
        <div>
          <Avatar name="A" userId="1" size="xs" />
          <Avatar name="B" userId="2" size="sm" />
          <Avatar name="C" userId="3" size="md" />
          <Avatar name="D" userId="4" size="lg" />
          <Avatar name="E" userId="5" size="xl" />
        </div>
      );

      // Verify no emerald presence dot indicator
      expect(container.querySelector('.bg-emerald-500')).toBeNull();
      expect(container.querySelectorAll('.rounded-full').length).toBe(5);
    });
  });

  describe('2. UserMenuDropdown in Header Card', () => {
    it('renders user menu trigger and opens dropdown with View profile, Settings, Sign out', async () => {
      render(
        <MemoryRouter>
          <UserMenuDropdown />
        </MemoryRouter>
      );

      // Menu button exists
      const trigger = screen.getByLabelText('User navigation menu');
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('Alfie')).toBeInTheDocument();

      // Click to open popover
      fireEvent.click(trigger);

      expect(screen.getByText('View profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign out')).toBeInTheDocument();

      // Close on Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByText('View profile')).not.toBeInTheDocument();
      });
    });

    it('uses the standard neutral styles: no purple, a neutral role chip, menu items for each action', () => {
      const { container } = render(
        <MemoryRouter>
          <UserMenuDropdown />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByLabelText('User navigation menu'));
      expect(container.innerHTML).not.toMatch(/purple/);
      expect(screen.getByTestId('user-menu-role').className).toMatch(/status-chip status-not-started/);
      expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['View profile', 'Settings', 'Sign out']);
    });
  });

  describe('3. ProfileView - Header Card, About Form, Work Details & 5 Role Panels', () => {
    it('Admin profile renders admin role panel: pending access requests & users by role', () => {
      const profile = makeMockProfile('admin', {
        rolePanelData: {
          adminMetrics: {
            pendingAccessRequests: 7,
            usersByRole: { admin: 2, creative_head: 3, team_member: 12 },
          },
        },
      });

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      // Header card
      expect(screen.getByText(/Tay \(Taylor Swift\)/i)).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Admin role panel
      expect(screen.getByText(/Pending Access Requests/i)).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText(/Team Distribution by Role/i)).toBeInTheDocument();
    });

    it('Creative Head profile renders creative metrics: stages waiting approval & plans waiting', () => {
      const profile = makeMockProfile('creative_head', {
        rolePanelData: {
          creativeMetrics: {
            stagesWaitingApproval: 5,
            plansWaiting: 2,
          },
        },
      });

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Stages Waiting Review/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText(/Plans Awaiting Approval/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('Social Media Manager profile renders smMetrics: plan status, needs-owner, late items', () => {
      const profile = makeMockProfile('sm_manager', {
        rolePanelData: {
          smMetrics: {
            planStatus: 'Active',
            needsOwnerCount: 4,
            lateItemsCount: 1,
          },
        },
      });

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Content Pipeline Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Stages Needing Owner/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText(/Late Pipeline Items/i)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('Executive profile renders companySummary: active users & active deliverables', () => {
      const profile = makeMockProfile('executive', {
        rolePanelData: {
          companySummary: {
            activeUsersCount: 28,
            activeDeliverablesCount: 45,
          },
        },
      });

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Company Operational Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Team Members/i)).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText(/Active Deliverables/i)).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    it('Team Member profile renders memberMetrics: current steps, load & on-time rate', () => {
      const profile = makeMockProfile('team_member', {
        rolePanelData: {
          memberMetrics: {
            myCurrentStepsCount: 3,
            capacityBand: 'Balanced',
            onTimeRate: 98,
          },
        },
      });

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Active Deliverables in Flight/i)).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/Current Workload Band/i)).toBeInTheDocument();
      expect(screen.getByText('Balanced')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();
    });

    it('About form tracks character count, displays dirty warning, and cancels changes', () => {
      const profile = makeMockProfile('team_member');

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      const aboutTextarea = screen.getByPlaceholderText(/Write a short bio/i) as HTMLTextAreaElement;
      expect(screen.getByText(/27 \/ 200/)).toBeInTheDocument();

      // Change text to trigger dirty state
      fireEvent.change(aboutTextarea, { target: { value: 'Updated bio here' } });
      expect(screen.getByText(/You have unsaved changes to your profile/i)).toBeInTheDocument();

      // Discard changes
      const discardBtn = screen.getByRole('button', { name: /Discard/i });
      fireEvent.click(discardBtn);

      expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();
    });

    it('Work details is read-only and Request a change button opens modal', () => {
      const profile = makeMockProfile('team_member');

      render(
        <MemoryRouter>
          <ProfileView profile={profile} isSelf={true} readOnly={false} />
        </MemoryRouter>
      );

      expect(screen.getByText(/Official Organization Details/i)).toBeInTheDocument();
      expect(screen.getAllByText('Creative Dept').length).toBeGreaterThanOrEqual(1);

      // Request change button
      const changeBtn = screen.getByRole('button', { name: /Request a change/i });
      expect(changeBtn).toBeInTheDocument();

      fireEvent.click(changeBtn);
      expect(screen.getByText(/Request Work Details Update/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe the changes you need/i)).toBeInTheDocument();
    });

    it('Contact masking: hides contact info when fields are null (Worker / Executive viewing teammate)', () => {
      const maskedProfile = makeMockProfile('team_member', {
        email: null as any,
        phone: null as any,
        whatsappNumber: null as any,
      });

      render(
        <MemoryRouter>
          <ProfileView profile={maskedProfile} isSelf={false} readOnly={true} />
        </MemoryRouter>
      );

      // Masked indicator or hidden
      expect(screen.queryByText('taylor@marketingos.com')).not.toBeInTheDocument();
      expect(screen.queryByText('+15551234567')).not.toBeInTheDocument();
    });
  });

  describe('4. SettingsPage - Security, Notifications & Preferences', () => {
    it('switches between Security, Notifications, and Preferences sections', async () => {
      (apiFetch as any).mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: [] });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Security is active by default
      expect(screen.getByText(/Security & Devices/i)).toBeInTheDocument();
      expect(screen.getByText(/Change Password/i)).toBeInTheDocument();

      // Switch to Notifications tab
      const notifTab = screen.getByRole('button', { name: /Notifications/i });
      fireEvent.click(notifTab);
      expect(screen.getByText(/Notification Preferences/i)).toBeInTheDocument();
      expect(screen.getByText(/My steps and task handoffs/i)).toBeInTheDocument();

      // Switch to Preferences tab
      const prefsTab = screen.getByRole('button', { name: /Preferences/i });
      fireEvent.click(prefsTab);
      expect(screen.getByText(/Regional & Interface Preferences/i)).toBeInTheDocument();
      expect(screen.getByText(/Default Start Screen/i)).toBeInTheDocument();
    });

    it('validates password requirements dynamically', async () => {
      (apiFetch as any).mockResolvedValue({ data: [] });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const newPassInput = screen.getByLabelText(/^New Password$/i) as HTMLInputElement;

      // Type weak password
      fireEvent.change(newPassInput, { target: { value: 'short' } });
      const submitBtn = screen.getByRole('button', { name: /Update Password/i });
      expect(submitBtn).toBeDisabled();

      // Type strong password
      fireEvent.change(newPassInput, { target: { value: 'StrongPassword123!' } });
      expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
    });

    it('renders active sessions with This device badge', async () => {
      (apiFetch as any)
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'sess-1',
              deviceLabel: 'Chrome on Mac OS X',
              lastUsedAt: '2026-10-29T12:00:00.000Z',
              isCurrent: true,
            },
            {
              id: 'sess-2',
              deviceLabel: 'Safari on iPhone',
              lastUsedAt: '2026-10-28T12:00:00.000Z',
              isCurrent: false,
            },
          ],
        });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <SettingsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Chrome on Mac OS X')).toBeInTheDocument();
        expect(screen.getByText('This device')).toBeInTheDocument();
        expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
      });
    });
  });

  describe('5. WelcomePage - First-Login Experience', () => {
    it('disables proceed button until required name and phone are filled', () => {
      mockUser = { ...mockUser, profileCompletedAt: null, name: '', phone: '' };

      render(
        <MemoryRouter>
          <WelcomePage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Welcome Setup/i)).toBeInTheDocument();

      const proceedBtn = screen.getByRole('button', { name: /Complete & Continue/i });
      expect(proceedBtn).toBeDisabled();

      const nameInput = screen.getByPlaceholderText(/Jane Doe/i);
      const phoneInput = screen.getByPlaceholderText(/\+919876543210/i);

      fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
      expect(proceedBtn).toBeDisabled(); // Phone still missing

      fireEvent.change(phoneInput, { target: { value: '+15559876543' } });
      expect(proceedBtn).not.toBeDisabled();
    });
  });
});

