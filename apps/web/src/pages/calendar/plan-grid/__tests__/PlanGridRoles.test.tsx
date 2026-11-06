import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PLAN_GRID_DISPLAY_COLUMNS, DELIVERABLE_TYPE_KEYS, PLAN_GRID_COLUMNS } from '@mmp/shared';
import { PlanGrid } from '../PlanGrid';
import { PlansApprovalTab } from '../../../feedback/PlansApprovalTab';
import type { GridData, GridRow } from '../types';

const calls: { url: string; method: string; body: any }[] = [];
let gridResponse: GridData;
let saveHandler: (body: any) => any;
let role = 'creative_head';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', role, name: 'User' }, hasPermission: () => true }) }));
vi.mock('../../../../lib/api', async () => {
  class ApiError extends Error {
    code: string;
    constructor(message: string, code = 'X') {
      super(message);
      this.code = code;
    }
  }
  return {
    ApiError,
    apiFetch: vi.fn(async (url: string, opts: any = {}) => {
      const method = opts.method || 'GET';
      const body = opts.body instanceof FormData ? Object.fromEntries(opts.body.entries()) : opts.body ? JSON.parse(opts.body) : undefined;
      calls.push({ url, method, body });
      if (url.startsWith('/api/calendar-plans/grid?')) return { data: gridResponse };
      if (url === '/api/calendar-plans/grid/rows') return { data: saveHandler(body) };
      if (url === '/api/calendar-plans') return { data: approvalPlans };
      if (url.startsWith('/api/calendar-plans/plan1') && method === 'GET') return { data: { ...approvalPlans[0], rows: [] } };
      if (url.endsWith('/autofill')) return { data: { stages: [] } };
      return { data: {} };
    }),
  };
});

let approvalPlans: any[] = [];
const monthlyApprovalPlans = [
  { _id: 'plan1', code: 'PLAN-2031-11-001', title: 'SM November 2031', kind: 'monthly', calendar: 'sm', periodStart: '2031-11-01T00:00:00.000Z', periodEnd: '2031-11-30T23:59:59.999Z', status: 'Submitted', createdAt: '2031-10-01T00:00:00.000Z', rowCount: 2, submittedRowCount: 1, approvedRowCount: 0 },
];
const individualApprovalPlans = [
  { ...monthlyApprovalPlans[0], kind: 'individual', title: 'Sales one-off', code: 'PLAN-2031-11-002' },
];

const people = [
  { _id: 'p-writer', name: 'Asha Writer', role: 'team_member', workPreferences: ['Script', 'Content'] },
  { _id: 'p-editor', name: 'Ravi Editor', role: 'team_member', workPreferences: ['Edit'] },
  { _id: 'p-designer', name: 'Dia Designer', role: 'team_member', workPreferences: ['Design'] },
];
const base: GridRow = {
  rowId: 'r1', rowStatus: 'submitted', editable: true, postingDate: '2031-11-12', topic: 'Founder reel', type: 'Reel',
  scriptStatus: '', scriptDoneDate: '', scriptOwner: 'Asha Writer', shootStatus: '', shootDoneDate: '', shootOwner: '',
  editStatus: '', editDoneDate: '', editOwner: 'Ravi Editor', approvalStatus: '', approvalDate: '', publishedDate: '',
  postingOwner: '', turnaroundDays: null, remarks: '', brief: 'Brief', publishTime: '18:00', contentLink: '',
  reviewFeedback: '', stepDeadlines: { Script: '2031-11-04', Shoot: '2031-11-07', Edit: '2031-11-10', Post: '2031-11-12' },
  ownerSources: {}, ownerIds: { Script: 'p-writer', Edit: 'p-editor' }, contentOwner: '', designOwner: '', contentStatus: 'N/A', designStatus: 'N/A',
  needsScript: true, needsShoot: true, programOrEvent: '', referenceLink: '', priority: 'Normal', sourceVideoLink: '', pipeline: 'reel_a',
  stages: ['Script', 'Shoot', 'Edit', 'Post'],
};
const draftRow: GridRow = { ...base, rowId: 'r2', rowStatus: 'changes_requested', topic: 'Campus tour', reviewFeedback: 'Shorter hook, please.' };

const grid = (over: Partial<GridData> = {}): GridData => ({
  calendar: 'sm', month: '2031-11', columns: PLAN_GRID_COLUMNS, displayColumns: PLAN_GRID_DISPLAY_COLUMNS, types: [...DELIVERABLE_TYPE_KEYS],
  plans: [{ _id: 'plan1', code: 'PLAN-2031-11-001', title: 'SM November 2031', status: 'Submitted', rowCount: 2, periodStart: '', periodEnd: '', periodIssue: null }],
  selectionRequired: false,
  plan: { _id: 'plan1', code: 'PLAN-2031-11-001', title: 'SM November 2031', status: 'Submitted', rowCount: 2, periodStart: '', periodEnd: '', periodIssue: null },
  rows: [base, draftRow],
  permissions: { canEdit: false, canReview: true, readOnly: false },
  people: [],
  ...over,
});

const show = async (over: Partial<GridData> = {}) => {
  gridResponse = grid(over);
  render(<PlanGrid initialCalendar="sm" initialMonth="2031-11" onClose={vi.fn()} />);
  await screen.findByText(/PLAN-2031-11-001 ·/);
};
const reviewCalls = () => calls.filter((c) => c.url === '/api/calendar-plans/plan1/review');

let mql: ((q: string) => boolean) | null = null;
beforeEach(() => {
  calls.length = 0;
  role = 'creative_head';
  saveHandler = () => ({ calendar: 'sm', month: '2031-11', dryRun: false, planCreated: false, plan: grid().plan, paste: null, counts: { total: 0, saved: 0, valid: 0, invalid: 0, locked: 0 }, results: [], warnings: [] });
  mql = null;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: mql ? mql(q) : false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});
afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia;
});

describe('Creative Head review in the grid', () => {
  it('shows only submitted rows by default, with no editing controls', async () => {
    await show();
    expect(screen.getByLabelText(/Only rows waiting for review \(1\)/)).toBeChecked();
    expect(screen.getAllByText('Founder reel').length).toBeGreaterThan(0);
    expect(screen.queryByText('Campus tour')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Type, row/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit for review/ })).not.toBeInTheDocument();
  });

  it('approves selected rows with the existing approve_selected rule', async () => {
    await show();
    fireEvent.click(screen.getByLabelText('Select Founder reel for approval'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve selected (1)' }));
    await waitFor(() => expect(reviewCalls()).toHaveLength(1));
    expect(reviewCalls()[0].body).toEqual({ action: 'approve_selected', approvedRowIds: ['r1'] });
  });

  it('approves one row or requests changes from the row panel; a note is required', async () => {
    await show();
    fireEvent.click(screen.getByRole('button', { name: 'Review row: Founder reel' }));
    const panel = await screen.findByRole('dialog', { name: 'Founder reel' });
    expect(panel.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Request changes' }));
    expect(within(panel).getByText('Say what needs to change before sending the row back.')).toBeInTheDocument();
    expect(within(panel).getByLabelText('What needs to change')).toHaveAttribute('aria-invalid', 'true');
    expect(reviewCalls()).toHaveLength(0);
    fireEvent.change(within(panel).getByLabelText('What needs to change'), { target: { value: 'Use the new logo.' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Request changes' }));
    await waitFor(() => expect(reviewCalls()).toHaveLength(1));
    expect(reviewCalls()[0].body).toEqual({ action: 'request_changes', changes: [{ rowId: 'r1', comment: 'Use the new logo.' }] });

    fireEvent.click(await screen.findByRole('button', { name: 'Review row: Founder reel' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Founder reel' })).getByRole('button', { name: 'Approve row' }));
    await waitFor(() => expect(reviewCalls()).toHaveLength(2));
    expect(reviewCalls()[1].body).toEqual({ action: 'approve_selected', approvedRowIds: ['r1'] });
  });

  it('keeps review feedback visible in the row panel', async () => {
    await show();
    fireEvent.click(screen.getByLabelText(/Only rows waiting for review/));
    fireEvent.click(screen.getByRole('button', { name: 'Row details: Campus tour' }));
    const panel = await screen.findByRole('dialog', { name: 'Campus tour' });
    expect(within(panel).getByRole('region', { name: 'Review feedback' })).toHaveTextContent('Shorter hook, please.');
    expect(within(panel).queryByRole('button', { name: 'Approve row' })).not.toBeInTheDocument(); // not submitted
  });

  it('whole-plan approval is offered only when every open row is submitted, and asks first', async () => {
    await show();
    expect(screen.getByRole('button', { name: 'Approve whole plan' })).toBeDisabled(); // a row was sent back
  });

  it('whole-plan approval uses approve_all after confirmation', async () => {
    await show({ rows: [base, { ...base, rowId: 'r3', topic: 'Old approved', rowStatus: 'approved', editable: false }] });
    fireEvent.click(screen.getByRole('button', { name: 'Approve whole plan' }));
    const dlg = await screen.findByRole('alertdialog', { name: 'Approve the whole plan?' });
    expect(dlg.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Approve whole plan' }));
    await waitFor(() => expect(reviewCalls()).toHaveLength(1));
    expect(reviewCalls()[0].body).toEqual({ action: 'approve_all' });
  });
});

describe('Executive read-only grid', () => {
  it('hides editing, paste, delete, submit and review actions', async () => {
    role = 'executive';
    await show({ permissions: { canEdit: false, canReview: false, readOnly: true } });
    expect(screen.getByText('Read-only view. Contact details are not shown.')).toBeInTheDocument();
    for (const name of [/Download Template/, /^Upload$/, /Submit for review/, /Approve selected/, /Approve whole plan/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: /Download Template/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Select .* for approval/)).not.toBeInTheDocument();

    // Paste does nothing.
    const table = screen.getByRole('table');
    await act(async () => {
      fireEvent.paste(table, { clipboardData: { getData: () => 'a\tb\r\nc\td' } });
    });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // Row panel opens read-only: no save or delete.
    fireEvent.click(screen.getByRole('button', { name: 'Row details: Founder reel' }));
    const panel = await screen.findByRole('dialog', { name: 'Founder reel' });
    expect(within(panel).queryByRole('button', { name: /Save row|Delete row|Approve row|Request changes/ })).not.toBeInTheDocument();
  });
});

describe('Phone view (360px)', () => {
  beforeEach(() => {
    role = 'sm_manager';
    mql = (q) => q.includes('639px') || q.includes('1023px');
  });

  it('shows rows as cards, adds a row through the row panel, and explains paste', async () => {
    saveHandler = (body) => ({
      calendar: 'sm', month: '2031-11', dryRun: false, planCreated: false, plan: grid().plan, paste: null,
      counts: { total: 1, saved: 1, valid: 0, invalid: 0, locked: 0 },
      results: [{ clientKey: body.rows[0].clientKey, rowId: 'r9', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: { ...base, rowId: 'r9', rowStatus: 'draft', topic: 'Phone post', type: 'Static Post', stages: ['Content', 'Design', 'Post'] } }],
      warnings: [],
    });
    await show({ permissions: { canEdit: true, canReview: false, readOnly: false }, people, rows: [{ ...base, rowStatus: 'draft' }] });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/Paste from Excel works on a tablet or computer/)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /Rows for SM, 2031-11/ });
    expect(within(list).getByText('Founder reel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit for review/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    const panel = await screen.findByRole('dialog', { name: 'New row' });
    fireEvent.change(within(panel).getByLabelText('Posting date'), { target: { value: '2031-11-20' } });
    fireEvent.change(within(panel).getByLabelText('Topic'), { target: { value: 'Phone post' } });
    fireEvent.change(within(panel).getByLabelText('Type'), { target: { value: 'Static Post' } });
    fireEvent.change(within(panel).getByLabelText('Design owner'), { target: { value: 'p-designer' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/calendar-plans/grid/rows')).toBe(true));
    const sent = calls.find((c) => c.url === '/api/calendar-plans/grid/rows')!.body.rows[0];
    expect(sent.rowId).toBeNull();
    expect(sent.cells).toMatchObject({ postingDate: '2031-11-20', topic: 'Phone post', type: 'Static Post', typeExact: true, designOwnerId: 'p-designer' });
    expect(await screen.findByText('Phone post')).toBeInTheDocument();
  });

  it('edits an existing row from its card', async () => {
    saveHandler = (body) => ({
      calendar: 'sm', month: '2031-11', dryRun: false, planCreated: false, plan: grid().plan, paste: null,
      counts: { total: 1, saved: 0, valid: 0, invalid: 1, locked: 0 },
      results: [{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'invalid', cellErrors: { postingDate: ['"03/04/2031" could be 3 Apr 2031 or 4 Mar 2031.'] }, warnings: [], ignoredCells: [] }],
      warnings: [],
    });
    await show({ permissions: { canEdit: true, canReview: false, readOnly: false }, people, rows: [{ ...base, rowStatus: 'draft' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Edit row: Founder reel' }));
    const panel = await screen.findByRole('dialog', { name: 'Founder reel' });
    fireEvent.change(within(panel).getByLabelText('Topic'), { target: { value: 'Founder reel v2' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/calendar-plans/grid/rows')).toBe(true));
    expect(calls.find((c) => c.url === '/api/calendar-plans/grid/rows')!.body.rows[0]).toEqual({ clientKey: 'r1', rowId: 'r1', cells: { topic: 'Founder reel v2' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    // The card shows the problem in words.
    expect(await screen.findByRole('list', { name: 'Problems in row 1' })).toHaveTextContent(/Posting Date: .*could be 3 Apr 2031/);
  });
});

describe('Accessible names and cell errors', () => {
  it('names the table, each row and each cell; failed cells show a visible, linked error', async () => {
    role = 'sm_manager';
    saveHandler = (body) => ({
      calendar: 'sm', month: '2031-11', dryRun: false, planCreated: false, plan: grid().plan, paste: null,
      counts: { total: 1, saved: 0, valid: 0, invalid: 1, locked: 0 },
      results: [{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'invalid', cellErrors: { editOwner: ['No active person is named exactly "Nobody".'] }, warnings: [], ignoredCells: [] }],
      warnings: [],
    });
    await show({ permissions: { canEdit: true, canReview: false, readOnly: false }, people, rows: [{ ...base, rowStatus: 'draft' }] });
    expect(screen.getByRole('table', { name: 'Plan grid for SM, 2031-11' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Row 1: Founder reel/ })).toBeInTheDocument();
    const edit = screen.getByRole('combobox', { name: 'Edit Owner, row 1, Founder reel' });
    fireEvent.change(edit, { target: { value: 'p-editor' } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Edit Owner, row 1, Founder reel' })).toHaveAttribute('aria-invalid', 'true'));
    const cell = screen.getByRole('combobox', { name: 'Edit Owner, row 1, Founder reel' });
    expect(cell).toHaveAccessibleDescription(/No active person is named exactly "Nobody"/);
    const visible = document.getElementById(cell.getAttribute('aria-describedby')!)!;
    expect(visible).toBeVisible();
    expect(visible.className).not.toMatch(/sr-only/);
  });
});

describe('Plans waiting for approval (Feedback page)', () => {

  it('monthly plans: admin and Creative Head get the plan grid link, and no review buttons here', async () => {
    approvalPlans = monthlyApprovalPlans;
    for (const r of ['admin', 'creative_head']) {
      role = r;
      const { unmount } = render(
        <MemoryRouter>
          <PlansApprovalTab />
        </MemoryRouter>
      );
      await screen.findByRole('button', { name: /PLAN-2031-11-001/ });
      expect(await screen.findByRole('button', { name: r === 'admin' ? 'View in plan grid' : 'Review in plan grid' })).toBeInTheDocument();
      expect(screen.getByText('Monthly plans are reviewed row by row in the plan grid.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve All Rows|Approve Selected|Request Changes/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('individual plans (not in the grid) keep their review here, for the Creative Head only', async () => {
    approvalPlans = individualApprovalPlans;
    role = 'creative_head';
    const { unmount } = render(
      <MemoryRouter>
        <PlansApprovalTab />
      </MemoryRouter>
    );
    await screen.findByRole('button', { name: /PLAN-2031-11-002/ });
    expect(await screen.findByRole('button', { name: 'Approve All Rows' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /in plan grid/ })).not.toBeInTheDocument();
    unmount();
    role = 'admin';
    render(
      <MemoryRouter>
        <PlansApprovalTab />
      </MemoryRouter>
    );
    await screen.findByRole('button', { name: /PLAN-2031-11-002/ });
    expect(await screen.findByText('Only the Creative Head can approve or return plan rows.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve All Rows' })).not.toBeInTheDocument();
  });
});
