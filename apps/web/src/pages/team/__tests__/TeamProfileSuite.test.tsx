import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TeamDirectoryPage } from '../TeamDirectoryPage';
import { WorkerProfilePage } from '../WorkerProfilePage';
import * as authContext from '../../../context/AuthContext';
import * as apiModule from '../../../lib/api';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('Team Directory and Worker Profile Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Team Directory Page', () => {
    it('renders team directory with whitelist sorting and member cards', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: { _id: 'admin-1', role: 'admin', name: 'Admin User' },
      });

      (apiModule.apiFetch as any).mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              _id: 'user-1',
              name: 'Test Writer One',
              preferredName: 'Alex',
              role: 'team_member',
              jobRole: 'Writer',
              department: { _id: 'dept-1', name: 'SEO & Content' },
              status: 'active',
              weeklyCapacityHours: 40,
              loadPct: 45,
              capacityBand: 'Healthy',
              currentStep: {
                workItemId: 'work-1',
                title: 'Diwali Campaign Reel',
                stageKey: 'Content',
                status: 'In Progress',
                dueDate: '2026-11-05T00:00:00.000Z',
                isLate: false,
              },
              counts: {
                inProgress: 2,
                waitingApproval: 1,
                late: 0,
              },
            },
          ],
          pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
        },
      });

      render(
        <MemoryRouter initialEntries={['/team']}>
          <TeamDirectoryPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Team Directory')).toBeInTheDocument();
      expect(await screen.findByText('Alex (Test Writer One)')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Diwali Campaign Reel')).toBeInTheDocument();
      expect(screen.getByText('2 in prog')).toBeInTheDocument();

      // Check sorting options strictly whitelist
      const sortSelect = screen.getByDisplayValue('Name (A – Z)');
      expect(sortSelect).toBeInTheDocument();
      const sortText = sortSelect.textContent || '';
      expect(sortText).toContain('Name');
      expect(sortText).toContain('Department');
      expect(sortText).toContain('Job Role');
      expect(sortText).toContain('Load');
      expect(sortText).not.toContain('Rating');
      expect(sortText).not.toContain('Speed');
    });
  });

  describe('2. Worker Profile Page', () => {
    const mockWorkerProfile = {
      _id: 'user-1',
      name: 'Test Writer One',
      preferredName: 'Alex',
      role: 'team_member',
      jobRole: 'Writer',
      department: { _id: 'dept-1', name: 'SEO & Content' },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: '2026-11-02T10:00:00.000Z',
      weeklyCapacityHours: 40,
      email: 'writer1@demo.haca.local',
      phone: '9000000011',
      whatsappNumber: '9000000011',
      languages: ['English', 'Hindi'],
      skills: ['Copywriting'],
      workPreferences: ['Content', 'Script'],
      kpis: {
        loadPct: 45,
        capacityBand: 'Healthy',
        inProgressCount: 2,
        waitingApprovalCount: 1,
        lateCount: 0,
        onTimeRate: 95,
        averageRating: null, // Less than 3 ratings
        ratingCount: 1,
      },
    };

    it('renders worker profile header, KPI strip, and minimum 3-ratings confidentiality notice', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: { _id: 'head-1', role: 'creative_head', name: 'Creative Head' },
      });

      (apiModule.apiFetch as any).mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.resolve({
            success: true,
            data: { rightNow: [], nextUp: [], loadTrend: [] },
          });
        }
        return Promise.resolve({ success: true, data: mockWorkerProfile });
      });

      render(
        <MemoryRouter initialEntries={['/team/user-1']}>
          <Routes>
            <Route path="/team/:id" element={<WorkerProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Alex (Test Writer One)')).toBeInTheDocument();
      expect(screen.getByText('Writer')).toBeInTheDocument();
      expect(screen.getByText('SEO & Content')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      // Minimum 3 ratings rule
      expect(screen.getByText('< 3 ratings')).toBeInTheDocument();
      expect(screen.getByText('writer1@demo.haca.local')).toBeInTheDocument();
    });

    it('renders transparency notice when worker views their own profile at /profile', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: { _id: 'user-1', role: 'team_member', name: 'Test Writer One' },
      });

      (apiModule.apiFetch as any).mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.resolve({ success: true, data: { rightNow: [], nextUp: [], loadTrend: [] } });
        }
        return Promise.resolve({ success: true, data: mockWorkerProfile });
      });

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<WorkerProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(
        await screen.findByText(/Your work history, timings and ratings are visible to the Admin/i)
      ).toBeInTheDocument();
    });

    it('hides contact details when profile is viewed by executive role', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: { _id: 'exec-1', role: 'executive', name: 'Executive Viewer' },
      });

      const redactedProfile = {
        ...mockWorkerProfile,
        email: null,
        phone: null,
        whatsappNumber: null,
      };

      (apiModule.apiFetch as any).mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.resolve({ success: true, data: { rightNow: [], nextUp: [], loadTrend: [] } });
        }
        return Promise.resolve({ success: true, data: redactedProfile });
      });

      render(
        <MemoryRouter initialEntries={['/team/user-1']}>
          <Routes>
            <Route path="/team/:id" element={<WorkerProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Alex (Test Writer One)')).toBeInTheDocument();
      expect(screen.getByText('Contact details restricted')).toBeInTheDocument();
      expect(screen.queryByText('writer1@demo.haca.local')).not.toBeInTheDocument();
      expect(screen.queryByText('Reassign Steps')).not.toBeInTheDocument();
    });
  });
});
