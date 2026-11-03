import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyWorkPage } from './MyWorkPage';
import * as authContext from '../../context/AuthContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/my-work')) {
      const now = new Date();
      const started = new Date(now.getTime() - 2 * 3600 * 1000 - 15 * 60 * 1000); // 2h 15m ago

      return Promise.resolve({
        data: {
          overdue: [],
          today: [
            {
              _id: 'work-1',
              title: 'Design Social Carousels',
              workType: 'Carousel Post',
              stageKey: 'Design',
              stageOrder: 1,
              status: 'In Progress',
              startedAt: started.toISOString(),
              deadline: '2026-11-05T00:00:00.000Z',
              dueDate: '2026-11-05T00:00:00.000Z',
              priority: 'Medium',
              revisions: 0,
              contentPieceId: {
                topic: 'Brand Principles Carousel',
                programOrEvent: 'HACA Awareness',
              },
            },
          ],
          thisWeek: [],
          upcoming: [],
          completed: [],
          stats: {
            activeCount: 1,
            overdueCount: 0,
            todayCount: 1,
            completedCount: 0,
            avgRevisions: 0,
          },
        },
      });
    }
    return Promise.resolve({ data: [] });
  }),
}));

describe('Worker Individual Timing Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authContext.useAuth as any).mockReturnValue({
      user: {
        _id: 'worker-1',
        name: 'Creative Worker',
        role: 'team_member',
      },
    });
  });

  it('displays individual elapsed work time from start ("Working for 2h 15m") and no countdown or clock', async () => {
    render(
      <MemoryRouter>
        <MyWorkPage />
      </MemoryRouter>
    );

    // Verify individual elapsed work time is rendered
    expect(await screen.findByText(/Working for 2h 15m/i)).toBeInTheDocument();

    // Verify step due DATE is shown (e.g. 11/5/2026 or Nov 5, 2026 depending on locale)
    const dueDateElements = await screen.findAllByText(/Due:/i);
    expect(dueDateElements.length).toBeGreaterThan(0);

    // Verify there are no countdown strings like "countdown", "ends in", "hours left"
    expect(screen.queryByText(/countdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ends in/i)).not.toBeInTheDocument();
  });
});
