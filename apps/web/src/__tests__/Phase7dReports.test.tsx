import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const calls: string[] = [];
const responses: Record<string, unknown> = {};
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    calls.push(url);
    const path = url.split('?')[0];
    if (path in responses) return { data: responses[path] };
    const err = Object.assign(new Error('Project not found'), { statusCode: 404 });
    throw err;
  }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', role: 'creative_head' }, hasPermission: () => true }) }));
// Charts render their own SVG; the figures under test are in the tables.
vi.mock('recharts', async () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Stub, LineChart: Stub, BarChart: Stub, Line: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null };
});

import { ReportsPage } from '../pages/reports/ReportsPage';
import { ProjectKpiPage } from '../pages/reports/ProjectKpiPage';
import { toCsv, csvCell, type ReportColumn } from '../lib/reportExport';

const overdue = {
  openOverdue: [
    { id: 'p1', topic: 'Reel A', project: 'Reel A', calendarName: 'SM', stepId: 's1', stepType: 'Design', owner: 'Asha', dueDate: '2026-11-03T00:00:00.000Z', daysOverdue: 5, labels: ['Overdue by 5 days', 'Blocked 2 days'] },
  ],
  doneLate: [
    { id: 'p2', topic: 'Reel, "B"', project: 'Reel, "B"', calendarName: 'Ads', stepId: 's2', stepType: 'Edit', owner: null, dueDate: '2026-11-01T00:00:00.000Z', firstSubmitted: '2026-11-04T05:00:00.000Z', fromHistory: true, daysLate: 3, labels: ['Done 3 days late'] },
  ],
  blockers: [],
  byCalendar: [{ calendar: 'SM', overdue: 1, doneLate: 0 }, { calendar: 'Ads', overdue: 0, doneLate: 1 }],
  byStepType: [{ stepType: 'Design', overdue: 1, doneLate: 0 }, { stepType: 'Edit', overdue: 0, doneLate: 1 }],
};

let captured: { name: string; text: string }[] = [];
beforeEach(() => {
  calls.length = 0;
  captured = [];
  for (const k of Object.keys(responses)) delete responses[k];
  responses['/api/reports/overdue'] = overdue;
  // Capture the CSV the page would download.
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

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r') continue;
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  return rows;
};

describe('Reports page', () => {
  const open = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('loads the live report with the month, calendar and step filters', async () => {
    open('/reports?report=overdue&month=2026-11&calendar=sm&stepType=Design');
    await screen.findByTestId('table-open-overdue');
    expect(calls[0]).toBe('/api/reports/overdue?month=2026-11&calendar=sm&stepType=Design');
    expect(screen.getByTestId('report-print')).toHaveAttribute('href', '/reports/print?report=overdue&month=2026-11&calendar=sm&stepType=Design');
  });

  it('a CSV export has the same figures as the table on screen', async () => {
    open('/reports?report=overdue&month=2026-11');
    const table = await screen.findByTestId('table-done-late');
    const screenRows = within(table)
      .getAllByRole('row')
      .map((tr) => within(tr).queryAllByRole('columnheader').concat(within(tr).queryAllByRole('cell')).map((c) => c.textContent));
    within(table).getByTestId('table-done-late-csv').click();
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('haca_overdue_done-late_2026-11.csv');
    expect(parseCsv(captured[0].text)).toEqual(screenRows);
    expect(screenRows[1]).toEqual(['Reel, "B"', 'Ads', 'Edit', 'Unassigned', '2026-11-01', '2026-11-04 (from history)', '3', 'Done 3 days late']);
  });

  it('shows no person totals: owners appear only on list rows', async () => {
    open('/reports?report=overdue&month=2026-11');
    const byCal = await screen.findByTestId('table-overdue-by-calendar');
    expect(within(byCal).queryByText('Asha')).toBeNull();
    expect(within(screen.getByTestId('table-open-overdue')).getAllByText('Asha')).toHaveLength(2); // table and phone card
    expect(screen.queryByText(/leaderboard|ranking|top performer/i)).toBeNull();
  });

  it('has no automation, scheduling or HTML preview on the page', async () => {
    open('/reports?report=overdue&month=2026-11');
    await screen.findByTestId('table-open-overdue');
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.queryByText(/automation|schedule|generate|copy html/i)).toBeNull();
    expect(calls.some((u) => u.includes('/api/automation') || u.includes('/definitions'))).toBe(false);
  });
});

describe('CSV helper', () => {
  it('quotes commas, quotes and line breaks, and guards formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-3')).toBe('-3');
    const cols: ReportColumn<{ a: string }>[] = [{ key: 'a', header: 'A', text: (r) => r.a }];
    expect(toCsv(cols, [{ a: 'x' }, { a: 'y,z' }])).toBe('A\r\nx\r\n"y,z"\r\n');
  });
});

describe('Project KPI page', () => {
  const open = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/reports/projects/${id}`]}>
        <Routes>
          <Route path="/reports/projects/:id" element={<ProjectKpiPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('shows the KPIs and each step row with its owner and hours, history marked partial', async () => {
    responses['/api/reports/projects/p1'] = {
      project: { id: 'p1', topic: 'Reel A', calendarName: 'SM', contentType: 'Reel', publishDate: '2026-11-10T00:00:00.000Z', label: { kind: 'completed_late', text: 'Completed 2 days late' }, delivered: true, deliveredAt: '2026-11-12T05:00:00.000Z', deliveredVia: 'post' },
      kpis: {
        onTime: { onTime: 1, total: 3, rate: 33, delayedByEarlier: 1 },
        rating: { count: 2, average: null, text: 'Collecting baseline' },
        firstPass: { label: 'Reviewed steps approved first time', approvedFirstTime: 1, total: 2, rate: 50 },
        workTime: { label: 'Elapsed work time', totalMs: 45 * 3600000, steps: 2, fromHistory: 1, partial: true, note: '1 of 2 steps from history' },
      },
      steps: [
        { id: 's1', stepType: 'Script', status: 'Approved', isSkipped: false, owner: 'Asha', dueDate: '2026-11-05T00:00:00.000Z', firstSubmitted: '2026-11-04T05:00:00.000Z', firstSubmittedFromHistory: false, labels: [{ kind: 'done_on_time', text: 'Done on time' }], elapsedMs: 21 * 3600000, elapsedFromHistory: false, rating: 5 },
        { id: 's2', stepType: 'Edit', status: 'Approved', isSkipped: false, owner: 'Ravi', dueDate: '2026-11-06T00:00:00.000Z', firstSubmitted: '2026-11-08T05:00:00.000Z', firstSubmittedFromHistory: true, labels: [{ kind: 'done_late', text: 'Done 2 days late' }, { kind: 'late_earlier_step', text: 'Late: earlier step' }], elapsedMs: 24 * 3600000, elapsedFromHistory: true, rating: 4 },
      ],
    };
    open('p1');
    await screen.findByTestId('project-kpi-page');
    expect(screen.getByText('Completed 2 days late')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-rating')).toHaveTextContent('Collecting baseline');
    expect(screen.getByTestId('kpi-first-pass')).toHaveTextContent('Reviewed steps approved first time');
    expect(screen.getByTestId('kpi-work-time')).toHaveTextContent('45.0 h');
    expect(screen.getByTestId('kpi-work-time')).toHaveTextContent('Partial: 1 of 2 steps from history');
    expect(screen.getByTestId('kpi-on-time')).toHaveTextContent('1 step delayed by earlier steps');
    const rows = screen.getAllByTestId('kpi-step-row');
    expect(rows.map((r) => within(r).getByTestId('kpi-step-hours').textContent)).toEqual(['21.0 h', '24.0 h (partial, from history)']);
    expect(within(rows[0]).getByText('Asha')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sort/i })).toBeNull();
  });

  it('a 404 shows the not-found state', async () => {
    open('missing');
    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
  });
});
