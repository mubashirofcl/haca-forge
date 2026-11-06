import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TeamDirectoryPage } from '../TeamDirectoryPage';
import { WorkerProfilePage } from '../WorkerProfilePage';
import { AdminAccountActions } from '../AdminAccountActions';
import { InviteUserDialog } from '../InviteUserDialog';
import * as authContext from '../../../context/AuthContext';
import * as apiModule from '../../../lib/api';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

const apiFetch = apiModule.apiFetch as unknown as ReturnType<typeof vi.fn>;
const useAuth = authContext.useAuth as unknown as ReturnType<typeof vi.fn>;

const ACCOUNT_ACTIONS = ['Change role', 'Reset password', 'Force logout'];
const NON_ADMIN_ROLES = ['creative_head', 'sm_manager', 'executive', 'team_member'];

const profile = {
  _id: 'user-1',
  name: 'Test Writer One',
  role: 'team_member',
  jobRole: 'Writer',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  weeklyCapacityHours: 40,
  kpis: { loadPct: 45, capacityBand: 'Healthy', inProgressCount: 0, waitingApprovalCount: 0, lateCount: 0, onTimeRate: 90, averageRating: null, ratingCount: 0 },
};

const mockPagesApi = () =>
  apiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/team?')) return Promise.resolve({ success: true, data: { items: [], pagination: {} } });
    if (url.includes('/overview')) return Promise.resolve({ success: true, data: { rightNow: [], nextUp: [], loadTrend: [] } });
    return Promise.resolve({ success: true, data: profile });
  });

const renderProfile = (path = '/team/user-1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/team/:id" element={<WorkerProfilePage />} />
        <Route path="/profile" element={<WorkerProfilePage />} />
      </Routes>
    </MemoryRouter>
  );

const mutationCalls = () =>
  apiFetch.mock.calls.filter(([, opts]: any[]) => opts && opts.method && opts.method !== 'GET');

describe('Admin user-management actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Visibility by role', () => {
    it('shows Invite user on /team for admin', async () => {
      useAuth.mockReturnValue({ user: { _id: 'admin-1', role: 'admin' } });
      mockPagesApi();
      render(<MemoryRouter><TeamDirectoryPage /></MemoryRouter>);
      expect(await screen.findByRole('button', { name: 'Invite user' })).toBeInTheDocument();
    });

    it.each(NON_ADMIN_ROLES)('hides Invite user on /team for %s', async (role) => {
      useAuth.mockReturnValue({ user: { _id: 'u-9', role } });
      mockPagesApi();
      render(<MemoryRouter><TeamDirectoryPage /></MemoryRouter>);
      expect(await screen.findByText('Team Directory')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Invite user' })).not.toBeInTheDocument();
    });

    it("shows all three account actions on another person's profile for admin", async () => {
      useAuth.mockReturnValue({ user: { _id: 'admin-1', role: 'admin' } });
      mockPagesApi();
      renderProfile();
      expect(await screen.findByText('Test Writer One')).toBeInTheDocument();
      for (const name of ACCOUNT_ACTIONS) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }
    });

    it.each(NON_ADMIN_ROLES)('hides the account actions on /team/:id for %s', async (role) => {
      useAuth.mockReturnValue({ user: { _id: 'u-9', role } });
      mockPagesApi();
      renderProfile();
      expect(await screen.findByText('Test Writer One')).toBeInTheDocument();
      for (const name of ACCOUNT_ACTIONS) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });

    it("hides the account actions on the admin's own profile", async () => {
      useAuth.mockReturnValue({ user: { _id: 'user-1', role: 'admin' } });
      mockPagesApi();
      renderProfile('/profile');
      expect(await screen.findByText('Test Writer One')).toBeInTheDocument();
      for (const name of ACCOUNT_ACTIONS) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
      }
    });
  });

  describe('2. Account actions require confirmation', () => {
    const person = { _id: 'user-1', name: 'Test Writer One', role: 'team_member' };

    it('change role: shows current and new role and only saves after Confirm', async () => {
      const onDone = vi.fn();
      apiFetch.mockResolvedValue({ success: true });
      render(<AdminAccountActions person={person} onDone={onDone} />);

      fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
      const dialog = screen.getByRole('dialog', { name: /Change role/ });
      const review = within(dialog).getByRole('button', { name: 'Review change' });
      expect(review).toBeDisabled(); // same role: nothing to confirm

      fireEvent.change(within(dialog).getByLabelText('New role'), { target: { value: 'sm_manager' } });
      fireEvent.click(review);
      expect(apiFetch).not.toHaveBeenCalled();
      expect(within(dialog).getByText('Current role').nextSibling).toHaveTextContent('Team Member');
      expect(within(dialog).getByText('New role').nextSibling).toHaveTextContent('SM Manager');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm role change' }));
      await waitFor(() => expect(onDone).toHaveBeenCalledWith("Test Writer One's role is now SM Manager.", 'role'));
      expect(apiFetch).toHaveBeenCalledWith('/api/team/user-1', { method: 'PATCH', body: JSON.stringify({ role: 'sm_manager' }) });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['Reset password', 'Reset password', '/api/team/user-1/reset-password'],
      ['Force logout', 'Force logout', '/api/team/user-1/force-logout'],
    ])('%s: Cancel sends nothing; Confirm calls the API', async (opener, confirmLabel, endpoint) => {
      const onDone = vi.fn();
      apiFetch.mockResolvedValue({ success: true });
      render(<AdminAccountActions person={person} onDone={onDone} />);

      fireEvent.click(screen.getByRole('button', { name: opener }));
      let dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(apiFetch).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: opener }));
      dialog = screen.getByRole('dialog');
      expect(apiFetch).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel }));
      await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
      expect(apiFetch).toHaveBeenCalledWith(endpoint, { method: 'POST' });
    });

    it('change role: keyboard focus moves into the confirmation step and back to the select', () => {
      render(<AdminAccountActions person={person} onDone={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('New role'), { target: { value: 'executive' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review change' }));
      expect(document.activeElement).toBe(within(dialog).getByLabelText('Confirm the role change'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }));
      expect(document.activeElement).toBe(within(dialog).getByLabelText('New role'));
    });

    it('Escape closes a confirmation without sending anything', () => {
      render(<AdminAccountActions person={person} onDone={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Force logout' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(apiFetch).not.toHaveBeenCalled();
    });
  });

  describe('3. Failed requests show an error and no success', () => {
    const person = { _id: 'user-1', name: 'Test Writer One', role: 'team_member' };

    it.each(['Reset password', 'Force logout'])('%s failure keeps the dialog open with an error', async (label) => {
      const onDone = vi.fn();
      apiFetch.mockRejectedValue(new Error('Forbidden: Only Administrator can do this'));
      render(<AdminAccountActions person={person} onDone={onDone} />);

      fireEvent.click(screen.getByRole('button', { name: label }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: label }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Forbidden: Only Administrator can do this');
      expect(onDone).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('change role failure shows the error and no success', async () => {
      const onDone = vi.fn();
      apiFetch.mockRejectedValue(new Error('Person not found'));
      render(<AdminAccountActions person={person} onDone={onDone} />);
      fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('New role'), { target: { value: 'executive' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review change' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm role change' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Person not found');
      expect(onDone).not.toHaveBeenCalled();
    });

    it('a failed role change on the profile page shows no success message', async () => {
      useAuth.mockReturnValue({ user: { _id: 'admin-1', role: 'admin' } });
      apiFetch.mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'PATCH') return Promise.reject(new Error('Server error'));
        if (url.includes('/overview')) return Promise.resolve({ success: true, data: { rightNow: [], nextUp: [], loadTrend: [] } });
        return Promise.resolve({ success: true, data: profile });
      });
      renderProfile();
      fireEvent.click(await screen.findByRole('button', { name: 'Change role' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('New role'), { target: { value: 'executive' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Review change' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm role change' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Server error');
      expect(screen.queryByText(/role is now/)).not.toBeInTheDocument();
    });
  });

  describe('4. Invite user', () => {
    const fill = (name: string, email: string) => {
      fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } });
      fireEvent.change(screen.getByLabelText('Registered email'), { target: { value: email } });
    };

    it('creates the account through POST /api/people without a password', async () => {
      const onInvited = vi.fn();
      apiFetch.mockResolvedValue({ data: { _id: 'new-1' } });
      render(<InviteUserDialog onClose={vi.fn()} onInvited={onInvited} />);
      fill('  New Person ', 'New.Person@Example.com');
      fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'sm_manager' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => expect(onInvited).toHaveBeenCalledTimes(1));
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toBe('/api/people');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body).toEqual({ name: 'New Person', email: 'new.person@example.com', role: 'sm_manager' });
      expect(body).not.toHaveProperty('password');
    });

    it('blocks an invalid email without calling the API', () => {
      render(<InviteUserDialog onClose={vi.fn()} onInvited={vi.fn()} />);
      fill('New Person', 'not-an-email');
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('shows the API error (e.g. duplicate email) and no success', async () => {
      const onInvited = vi.fn();
      apiFetch.mockRejectedValue(new Error('A person with this email already exists'));
      render(<InviteUserDialog onClose={vi.fn()} onInvited={onInvited} />);
      fill('New Person', 'taken@example.com');
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('A person with this email already exists');
      expect(onInvited).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Invite user' })).toBeInTheDocument();
    });

    it('admin flow on /team: success message appears after the account is created', async () => {
      useAuth.mockReturnValue({ user: { _id: 'admin-1', role: 'admin' } });
      apiFetch.mockImplementation((_url: string, opts?: any) => {
        if (opts?.method === 'POST') return Promise.resolve({ data: { _id: 'new-1' } });
        return Promise.resolve({ success: true, data: { items: [], pagination: {} } });
      });
      render(<MemoryRouter><TeamDirectoryPage /></MemoryRouter>);
      fireEvent.click(await screen.findByRole('button', { name: 'Invite user' }));
      fill('New Person', 'new@example.com');
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText(/Account created for New Person/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mutationCalls()).toHaveLength(1);
    });
  });
});
