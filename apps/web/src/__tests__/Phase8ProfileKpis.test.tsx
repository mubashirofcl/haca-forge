import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

let response: { status: number; data?: unknown } = { status: 200 };
const calls: string[] = [];
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    calls.push(url);
    if (response.status !== 200) throw Object.assign(new Error('nope'), { statusCode: response.status });
    return { data: response.data };
  }),
}));
vi.mock('recharts', async () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Stub, LineChart: Stub, BarChart: Stub, Line: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null };
});

import { WorkerCards, ReviewerCards, DownloadReport } from '../pages/team/ProfileKpiViews';
import { workerFigureRows, FIGURE_COLUMNS, type WorkerKpis, type ReviewerKpis, type ProfileKpiData } from '../pages/team/profileFigures';
import { ProfileReportPage } from '../pages/team/ProfileReportPage';

const worker: WorkerKpis = {
  cards: {
    assigned: 6, completed: 5, inProgress: 1, openOverdue: 1, blocked: 1,
    onTime: { rate: 75, onTime: 3, total: 4, delayedByEarlier: 1, delayedText: '1 step delayed by earlier steps' },
    late: { rate: 25, late: 1, total: 4, doneLateCount: 2 },
    changesRequested: { rate: 25, withChangeRequest: 1, reviewed: 4 },
    rework: { rounds: 2, rate: 0.5, reviewed: 4 },
    firstPass: { label: 'Reviewed steps approved first time', rate: 0, approvedFirstTime: 0, total: 4 },
    rating: { count: 2, average: null, text: 'Collecting baseline' },
    workTime: { label: 'Elapsed work time', totalMs: 51 * 3600000, totalText: '2d 3h', byStepType: [{ stepType: 'Edit', ms: 24 * 3600000, text: '1d' }], steps: 3, fromHistory: 1, partial: true, note: '1 of 3 steps from history' },
  },
  lastPeriod: { period: { from: '2025-04-01', to: '2025-04-30', label: 'April' }, completed: 1, onTimeRate: 82, lateRate: 18, changesRequestedRate: null, reworkRate: null, firstPassRate: 100, ratingText: 'Collecting baseline' },
  charts: { monthlyTrend: [], ratingDistribution: [], rootCauses: [], classifiedRevisions: 0, byStepType: [], byCalendar: [] },
  steps: [
    { id: 's1', project: 'Reel A', stepType: 'Script', status: 'Approved', dueDate: '2025-05-05', firstSubmitted: '2025-05-04', firstSubmittedFromHistory: false, labels: ['Done on time'], elapsedMs: 3 * 3600000, elapsedFromHistory: false, rating: 5 },
  ],
};
const ch: ReviewerKpis = {
  cards: {
    reviews: 4, approvals: 3, changesRequested: 1,
    avgApprovalWait: { ms: 4.5 * 3600000, text: '4h 30m', basedOn: 4 },
    queue: { label: 'Oldest item in the team review queue', waiting: 2, oldestMs: 86400000, text: '1d', oldestSince: '2025-05-20' },
    planApprovals: 1, legacyApprovals: 1, legacyNote: '1 earlier approvals have no review record and are not counted.',
  },
  charts: { reviewsPerWeek: [], ratingsGiven: [], rootCausesUsed: [] },
};
const data: ProfileKpiData = {
  person: { _id: 'p1', name: 'Asha Worker', preferredName: '', role: 'team_member', jobRole: 'Editor', department: 'Video', status: 'active' },
  period: { kind: 'custom', from: '2025-05-01', to: '2025-05-31', label: '2025-05-01 to 2025-05-31' },
  worker,
  creativeHead: ch,
  canDownload: true,
  note: 'For coaching only.',
};

let captured: { name: string; text: string }[] = [];
beforeEach(() => {
  calls.length = 0;
  captured = [];
  response = { status: 200, data };
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  const RealBlob = Blob;
  vi.stubGlobal('Blob', class extends RealBlob {
    constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      captured.push({ name: '', text: parts.slice(1).join('') });
    }
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (captured.length) captured[captured.length - 1].name = this.download;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Profile KPI cards', () => {
  it('show 0% as 0%, "No data" when there is none, and the delayed note', () => {
    render(<WorkerCards worker={worker} />);
    expect(screen.getByTestId('kpi-firstPass-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('kpi-onTime')).toHaveTextContent('1 step delayed by earlier steps');
    expect(screen.getByTestId('kpi-rating-value')).toHaveTextContent('Collecting baseline');
    expect(screen.getByTestId('kpi-workTime')).toHaveTextContent('Partial: 1 of 3 steps from history');
  });

  it('the last period is plain text: no colour, arrows or better/worse wording', () => {
    render(<WorkerCards worker={worker} />);
    const last = screen.getByTestId('kpi-onTime-last');
    expect(last).toHaveTextContent('Last period: 82%');
    expect(last.className).not.toMatch(/status-|text-(red|green|ui-coral)|bg-/);
    expect(document.body.textContent).not.toMatch(/[↑↓▲▼]|better|worse|improved|declined/i);
    expect(screen.getByTestId('kpi-changesRequested-last')).toHaveTextContent('Last period: No data');
  });

  it('Creative Head cards: the queue label and the legacy note', () => {
    render(<ReviewerCards ch={ch} />);
    expect(screen.getByTestId('review-queue')).toHaveTextContent('Oldest item in the team review queue');
    expect(screen.getByTestId('review-legacy-note')).toHaveTextContent('1 earlier approvals have no review record and are not counted.');
  });
});

describe('Download report', () => {
  it('CSV figures match the cards on screen, and the step list is exported', async () => {
    render(
      <MemoryRouter>
        <WorkerCards worker={worker} />
        <DownloadReport targetId="p1" choice={{ period: 'custom', from: '2025-05-01', to: '2025-05-31' }} personName="Asha Worker" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('profile-download-pdf')).toHaveAttribute('href', '/team/p1/report?period=custom&from=2025-05-01&to=2025-05-31');
    fireEvent.click(screen.getByTestId('profile-download-csv'));
    await waitFor(() => expect(captured.length).toBe(2));
    expect(calls[0]).toBe('/api/team/p1/report?period=custom&from=2025-05-01&to=2025-05-31');
    expect(captured[0].name).toBe('haca_profile_asha-worker_figures_2025-05-01_2025-05-31.csv');
    const lines = captured[0].text.trim().split('\r\n');
    expect(lines[0]).toBe(FIGURE_COLUMNS.map((c) => c.header).join(','));
    for (const row of workerFigureRows(worker)) {
      const card = screen.getByTestId(`kpi-${row.key}-value`).textContent || '';
      expect(lines.some((l) => l.includes(card))).toBe(true);
    }
    expect(captured[1].name).toBe('haca_profile_asha-worker_steps_2025-05-01_2025-05-31.csv');
    // The Rework time column is empty for a step that was never sent back.
    expect(captured[1].text).toContain('Reel A,Script,Approved,2025-05-05,2025-05-04,Done on time,3.0 h,,5');
    expect(captured[1].text).toContain('Elapsed work time,Rework time,Rating');
    expect(captured.map((c) => c.text).join('')).not.toMatch(/@|\+91|phone|whatsapp/i);
  });
});

describe('Profile report (print layout)', () => {
  const open = () =>
    render(
      <MemoryRouter initialEntries={['/team/p1/report?period=custom&from=2025-05-01&to=2025-05-31&autoprint=0']}>
        <Routes>
          <Route path="/team/:id/report" element={<ProfileReportPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('header, period, figures, step list and the review section; no contact details', async () => {
    open();
    await screen.findByTestId('profile-report');
    expect(screen.getByTestId('profile-report-name')).toHaveTextContent('Asha Worker');
    expect(screen.getByText(/Team member · Editor · Video/)).toBeInTheDocument();
    expect(screen.getByText(/2025-05-01 to 2025-05-31, IST/)).toBeInTheDocument();
    expect(within(screen.getByTestId('profile-report-steps')).getByText('Reel A')).toBeInTheDocument();
    expect(screen.getByTestId('profile-report-review')).toHaveTextContent('Oldest item in the team review queue');
    expect(document.body.textContent).not.toMatch(/@|\+91|phone|whatsapp/i);
    expect(calls[0]).toBe('/api/team/p1/report?period=custom&from=2025-05-01&to=2025-05-31');
  });

  it('a role without download access sees a refusal', async () => {
    response = { status: 403 };
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Only admin, creative head and executive can download this report.');
  });
});
