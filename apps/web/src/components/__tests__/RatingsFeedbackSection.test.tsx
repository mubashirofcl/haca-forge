import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RatingsFeedbackSection, type RatingsSummaryData } from '../RatingsFeedbackSection';
import * as apiModule from '../../lib/api';

describe('WS4: RatingsFeedbackSection Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockBelowThresholdData: RatingsSummaryData = {
    personId: 'user-writer-1',
    thresholdMet: false,
    message: 'Not enough ratings yet',
    count: 2,
    averageAllTime: null,
    average30Days: null,
    average90Days: null,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    monthlyTrend: [],
    averagePerStepType: {},
    recentFeedback: [],
  };

  const mockFullData: RatingsSummaryData = {
    personId: 'user-writer-1',
    thresholdMet: true,
    count: 4,
    averageAllTime: 4.25,
    average30Days: 4.5,
    average90Days: 4.0,
    distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
    monthlyTrend: [
      { month: '2026-09', count: 1, average: 4.0 },
      { month: '2026-10', count: 3, average: 4.33 },
    ],
    averagePerStepType: {
      Script: 4.5,
      Copywriting: 4.0,
    },
    recentFeedback: [
      {
        ratingId: 'r-1',
        score: 5,
        feedback: 'Outstanding dialogue and cinematic scene structure.',
        tags: ['Great hook'],
        stageKey: 'Script',
        deliverableTitle: 'Masterclass Promo Reel Script',
        workItemId: 'w-1',
        date: '2026-10-25T10:00:00Z',
        seenAt: null,
        raterName: 'Creative Head Maya',
      },
      {
        ratingId: 'r-2',
        score: 4,
        feedback: 'Clean copy, adheres to brand guidelines.',
        tags: ['Clear message'],
        stageKey: 'Copywriting',
        deliverableTitle: 'Newsletter Launch Copy',
        workItemId: 'w-2',
        date: '2026-10-20T14:00:00Z',
        seenAt: '2026-10-21T09:00:00Z',
        raterName: 'Creative Head Maya',
        editedLog: [
          {
            editedBy: { name: 'Creative Head Maya', role: 'creative_head' },
            editedAt: '2026-10-21T08:00:00Z',
            oldScore: 3,
            newScore: 4,
            reason: 'Re-reviewed after secondary edits were merged',
          },
        ],
      },
    ],
  };

  it('renders loading state initially', () => {
    vi.spyOn(apiModule, 'apiFetch').mockImplementation(() => new Promise(() => {}));
    render(<RatingsFeedbackSection personId="user-writer-1" />);
    expect(screen.getByText(/loading quality ratings and feedback/i)).toBeInTheDocument();
  });

  it('renders 403 access error with privacy guardrail messaging', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockRejectedValue({
      statusCode: 403,
      code: 'FORBIDDEN_RATINGS_ACCESS',
      message: 'Forbidden',
    });

    render(<RatingsFeedbackSection personId="other-user" isOwnProfile={false} />);

    await waitFor(() => {
      expect(
        screen.getByText(/workers are permitted to inspect only their own quality ratings/i)
      ).toBeInTheDocument();
    });
  });

  it('renders "Not enough ratings yet" when fewer than 3 ratings exist', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      data: mockBelowThresholdData,
    });

    render(
      <RatingsFeedbackSection
        personId="user-writer-1"
        personName="Alex Writer"
        isOwnProfile={true}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Not enough ratings yet').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2 of 3 ratings recorded/i)).toBeInTheDocument();
    });

    // Guardrail notice explaining ratings are for quality & coaching, not pay/incentives
    expect(
      screen.getByText(/ratings evaluate the craftsmanship and creative quality of approved work for coaching and growth/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/strictly decoupled from compensation, pay, or financial incentives/i)
    ).toBeInTheDocument();
  });

  it('renders full stats, distribution bars, monthly trend, and feedback when >= 3 ratings exist', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      data: mockFullData,
    });

    render(
      <RatingsFeedbackSection
        personId="user-writer-1"
        personName="Alex Writer"
        isOwnProfile={true}
        canEditRating={true}
      />
    );

    await waitFor(() => {
      // 4 Metric cards
      expect(screen.getByText('All-Time Average')).toBeInTheDocument();
      expect(screen.getByText('4.25')).toBeInTheDocument();
      expect(screen.getByText('30-Day Average')).toBeInTheDocument();
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText('90-Day Average')).toBeInTheDocument();
      expect(screen.getByText('Total Rated')).toBeInTheDocument();
    });

    // Monthly trend
    expect(screen.getByText(/Monthly Trend \(Last 6 Months\)/i)).toBeInTheDocument();
    expect(screen.getByText('09')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    // Distribution
    expect(screen.getByText('Score Distribution')).toBeInTheDocument();

    // Average per step type
    expect(screen.getByText('Average Rating per Step Type')).toBeInTheDocument();
    expect(screen.getAllByText('Script').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Copywriting').length).toBeGreaterThanOrEqual(1);

    // Recent feedback list
    expect(screen.getByText(/Recent Creative Feedback/i)).toBeInTheDocument();
    expect(screen.getByText('Masterclass Promo Reel Script')).toBeInTheDocument();
    expect(screen.getByText('"Outstanding dialogue and cinematic scene structure."')).toBeInTheDocument();
    expect(screen.getByText('+Great hook')).toBeInTheDocument();
  });

  it('allows worker to mark feedback as seen on their own profile', async () => {
    window.alert = vi.fn();
    const testData: RatingsSummaryData = {
      ...mockFullData,
      recentFeedback: [
        { ...mockFullData.recentFeedback[0], seenAt: null },
        { ...mockFullData.recentFeedback[1] },
      ],
    };

    const apiSpy = vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (url: string) => {
      if (url.includes('/seen')) {
        return { data: { seenAt: new Date().toISOString() } };
      }
      return { data: testData };
    });

    render(
      <RatingsFeedbackSection
        personId="user-writer-1"
        isOwnProfile={true}
      />
    );

    const markSeenBtn = await screen.findByRole('button', { name: /mark as seen/i });
    expect(markSeenBtn).toBeInTheDocument();

    fireEvent.click(markSeenBtn);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith(
        expect.stringContaining('/seen'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark as seen/i })).not.toBeInTheDocument();
      expect(screen.getAllByText('Seen')).toHaveLength(2);
    });
  });

  it('shows audit trail log for edited ratings', async () => {
    vi.spyOn(apiModule, 'apiFetch').mockResolvedValue({
      data: mockFullData,
    });

    render(
      <RatingsFeedbackSection
        personId="user-writer-1"
        isOwnProfile={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/adjusted rating to 4★ on/i)).toBeInTheDocument();
      expect(screen.getByText(/"Re-reviewed after secondary edits were merged"/i)).toBeInTheDocument();
    });
  });

  it('opens edit modal and requires reason when Creative Head edits rating', async () => {
    const apiFetchSpy = vi.spyOn(apiModule, 'apiFetch').mockImplementation(async (_url: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        return {
          data: {
            ...mockFullData.recentFeedback[0],
            score: 4,
            feedback: 'Updated feedback',
          },
        };
      }
      return { data: mockFullData };
    });

    render(
      <RatingsFeedbackSection
        personId="user-writer-1"
        canEditRating={true}
        isOwnProfile={false}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTitle(/Edit Rating/i)).toHaveLength(2);
    });

    // Click edit on the first item
    fireEvent.click(screen.getAllByTitle(/Edit Rating/i)[0]);

    // Modal opens
    expect(screen.getByText('Edit Quality Rating')).toBeInTheDocument();
    const reasonInput = screen.getByLabelText(/Reason for Correction/i);
    expect(reasonInput).toBeInTheDocument();

    // Save button is disabled without reason
    const saveBtn = screen.getByText('Save & Log Correction');
    expect(saveBtn).toBeDisabled();

    // Enter reason and submit
    fireEvent.change(reasonInput, { target: { value: 'Adjusted after review of secondary script draft' } });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/submissions/ratings/r-1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('Adjusted after review of secondary script draft'),
        })
      );
    });
  });
});
