import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { PLAN_GRID_DISPLAY_COLUMNS, DELIVERABLE_TYPE_KEYS, PLAN_GRID_COLUMNS } from '@mmp/shared';
import { PlanGrid } from '../PlanGrid';
import { PLANNING_COLUMNS, PROGRESS_COLUMNS } from '../columns';
import { calculateDueDateString, buildDefaultSteps, applyPostingDateChange, setStepDueDate, validateRowSteps } from '../../planRowSteps';
import type { GridData, GridRow } from '../types';

const calls: { url: string; method: string; body: any }[] = [];
let gridResponse: GridData;
let saveHandler: (body: any) => any;
let autofillHandler: (body: any) => any = () => ({ stages: [] });

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
      if (url === '/api/calendar-plans/grid/rows' || url === '/api/calendar-plans/grid/upload') return { data: saveHandler(body) };
      if (url.endsWith('/autofill')) return { data: autofillHandler(body) };
      return { data: {} };
    }),
  };
});

const people = [
  { _id: 'p-writer', name: 'Asha Writer', role: 'team_member', workPreferences: ['Script', 'Content'] },
  { _id: 'p-editor', name: 'Ravi Editor', role: 'team_member', workPreferences: ['Edit'] },
  { _id: 'p-designer', name: 'Dia Designer', role: 'team_member', workPreferences: ['Design'] },
  { _id: 'p-poster', name: 'Pia Poster', role: 'team_member', workPreferences: ['Post'] },
];

const reel: GridRow = {
  rowId: 'r1', rowStatus: 'draft', editable: true, postingDate: '2031-11-12', topic: 'Founder reel', type: 'Reel',
  scriptStatus: '', scriptDoneDate: '', scriptOwner: 'Asha Writer', shootStatus: '', shootDoneDate: '', shootOwner: '',
  editStatus: '', editDoneDate: '', editOwner: 'Ravi Editor', approvalStatus: '', approvalDate: '', publishedDate: '',
  postingOwner: 'Pia Poster', turnaroundDays: null, remarks: 'Campus', brief: 'Brief text', publishTime: '18:00', contentLink: '',
  reviewFeedback: '', stepDeadlines: { Script: '2031-11-04', Shoot: '2031-11-07', Edit: '2031-11-10', Post: '2031-11-12' },
  ownerSources: { Script: { owner: 'manual', deadline: 'auto' }, Shoot: { owner: 'suggested', deadline: 'auto' }, Edit: { owner: 'suggested', deadline: 'manual' }, Post: { owner: 'suggested', deadline: 'auto' } },
  ownerIds: { Script: 'p-writer', Shoot: null, Edit: 'p-editor', Post: 'p-poster' },
  contentOwner: '', designOwner: '', contentStatus: 'N/A', designStatus: 'N/A', needsScript: true, needsShoot: true,
  programOrEvent: '', referenceLink: '', priority: 'Normal', sourceVideoLink: '', pipeline: 'reel_a', stages: ['Script', 'Shoot', 'Edit', 'Post'],
};
const staticRow: GridRow = {
  ...reel, rowId: 'r2', topic: 'Admissions post', type: 'Static Post', scriptOwner: '', editOwner: '', contentOwner: 'Asha Writer', designOwner: '',
  scriptStatus: 'N/A', shootStatus: 'N/A', editStatus: 'N/A', pipeline: 'design', stages: ['Content', 'Design', 'Post'],
  ownerIds: { Content: 'p-writer', Design: null, Post: 'p-poster' },
  ownerSources: { Content: { owner: 'manual', deadline: 'auto' }, Design: { owner: 'suggested', deadline: 'auto' }, Post: { owner: 'suggested', deadline: 'auto' } },
  stepDeadlines: { Content: '2031-11-11', Design: '2031-11-14', Post: '2031-11-16' }, postingDate: '2031-11-16',
};
const approvedRow: GridRow = { ...reel, rowId: 'r3', topic: 'Approved reel', rowStatus: 'approved', editable: false, scriptStatus: 'Approved', scriptDoneDate: '2031-11-03', turnaroundDays: 9 };

const baseGrid = (over: Partial<GridData> = {}): GridData => ({
  calendar: 'sm', month: '2031-11', columns: PLAN_GRID_COLUMNS, displayColumns: PLAN_GRID_DISPLAY_COLUMNS, types: [...DELIVERABLE_TYPE_KEYS],
  plans: [{ _id: 'plan1', code: 'PLAN-2031-11-001', title: 'SM November 2031', status: 'Draft', rowCount: 2, periodStart: '', periodEnd: '', periodIssue: null }],
  selectionRequired: false,
  plan: { _id: 'plan1', code: 'PLAN-2031-11-001', title: 'SM November 2031', status: 'Draft', rowCount: 2, periodStart: '', periodEnd: '', periodIssue: null },
  rows: [reel, staticRow],
  permissions: { canEdit: true, canReview: false, readOnly: false },
  people,
  ...over,
});
const okResponse = (results: any[], extra: any = {}) => ({
  calendar: 'sm', month: '2031-11', dryRun: false, planCreated: false, plan: baseGrid().plan, paste: null,
  counts: { total: results.length, saved: results.filter((r) => r.status === 'saved').length, valid: results.filter((r) => r.status === 'valid').length, invalid: results.filter((r) => r.status === 'invalid').length, locked: 0 },
  results, warnings: [], ...extra,
});
const gridCalls = () => calls.filter((c) => c.url === '/api/calendar-plans/grid/rows');

const renderGrid = async (over: Partial<GridData> = {}) => {
  gridResponse = baseGrid(over);
  render(<PlanGrid initialCalendar="sm" initialMonth="2031-11" onClose={vi.fn()} />);
  await screen.findByRole('table');
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
};

beforeEach(() => {
  calls.length = 0;
  saveHandler = () => okResponse([]);
  autofillHandler = () => ({ stages: [] });
});

describe('1. Default planning view and hidden Progress view', () => {
  it('shows the planning columns in order, without Content/Design owners or status columns', async () => {
    await renderGrid();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent || '');
    const expected = ['Posting Date', 'Topic', 'Type', 'Brief', 'Script Owner', 'Script Deadline', 'Shoot Owner', 'Shoot Deadline', 'Edit Owner', 'Edit Deadline', 'Posting Owner', 'Posting Deadline', 'Content Link', 'Remarks'];
    expect(PLANNING_COLUMNS.map((c) => c.header)).toEqual(expected);
    const positions = expected.map((h) => headers.indexOf(h));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const gone of ['Publish Time', 'Content Owner', 'Design Owner', 'Script Status', 'Approval Status', 'Turnaround (Days)']) expect(headers).not.toContain(gone);
    // No per-group hide controls.
    expect(screen.queryByRole('button', { name: /hide columns|collapsed/i })).not.toBeInTheDocument();
    // No approved rows yet, so no Progress view to offer.
    expect(screen.queryByRole('button', { name: /Show progress/ })).not.toBeInTheDocument();
  });

  it('keeps all Excel progress columns behind one Show progress button once rows are approved', async () => {
    await renderGrid({ rows: [reel, approvedRow] });
    const toggle = screen.getByRole('button', { name: 'Show progress' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('columnheader', { name: /Script Status/ })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide progress' })).toHaveAttribute('aria-pressed', 'true');
    for (const c of PROGRESS_COLUMNS) expect(screen.getByRole('columnheader', { name: new RegExp(`^${c.header.replace(/[()]/g, '\\$&')}`) })).toBeInTheDocument();
    expect(PROGRESS_COLUMNS).toHaveLength(10);
    expect(screen.getByRole('columnheader', { name: /Turnaround \(Days\).*row approval to publishing/ })).toBeInTheDocument();
  });

  it('marks steps a row does not have as N/A and flags missing step details as Needs attention', async () => {
    await renderGrid();
    // Static post: no Script/Shoot/Edit; its Design owner is missing.
    expect(screen.getAllByText(/Script Owner does not apply to this row/).length).toBeGreaterThan(0);
    expect(screen.getByRole('rowheader', { name: /Row 2: Admissions post.*Needs attention: Design owner/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Row 1: Founder reel.*Needs attention: Shoot owner/ })).toBeInTheDocument();
  });
});

describe('2. Deadline calculation and manual override', () => {
  it('uses the Add Row offsets, in UTC (no day lost in IST), and keeps manual deadlines when the date moves', () => {
    expect(calculateDueDateString('2031-11-12', 8)).toBe('2031-11-04');
    expect(calculateDueDateString('2031-03-01', 2)).toBe('2031-02-27');
    const steps = buildDefaultSteps('Reel', true, true, '2031-11-12', people);
    expect(steps.map((s) => `${s.stageKey}:${s.dueDate}:${s.dueDateSource}`)).toEqual([
      'Script:2031-11-04:auto', 'Shoot:2031-11-07:auto', 'Edit:2031-11-10:auto', 'Post:2031-11-12:auto',
    ]);
    const manual = setStepDueDate(steps, 'Edit', '2031-11-09');
    const moved = applyPostingDateChange(manual, '2031-11-20');
    expect(moved.map((s) => `${s.stageKey}:${s.dueDate}:${s.dueDateSource}`)).toEqual([
      'Script:2031-11-12:auto', 'Shoot:2031-11-15:auto', 'Edit:2031-11-09:manual', 'Post:2031-11-20:auto',
    ]);
  });

  it('shows "Set by you" on edited deadlines and saves a changed deadline', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: reel }]);
    await renderGrid();
    const edit = screen.getByLabelText('Edit Deadline, row 1, Founder reel, set by you');
    expect(edit).toHaveValue('2031-11-10');
    expect(screen.getByLabelText('Script Deadline, row 1, Founder reel, automatic')).toHaveValue('2031-11-04');
    expect(screen.getAllByText('Set by you').length).toBeGreaterThan(0);
    fireEvent.change(edit, { target: { value: '2031-11-09' } });
    fireEvent.blur(edit);
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    expect(gridCalls()[0].body.rows[0]).toEqual({ clientKey: 'r1', rowId: 'r1', cells: { deadlines: { Edit: '2031-11-09' } } });
  });
});

describe('3. Calendar date selection', () => {
  it('Posting Date and step deadlines are native date pickers that save the picked date', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: reel }]);
      await renderGrid();
      const date = screen.getByLabelText('Posting Date, row 1, Founder reel');
      expect(date).toHaveAttribute('type', 'date');
      expect(screen.getByLabelText('Posting Deadline, row 1, Founder reel, automatic')).toHaveAttribute('type', 'date');
      fireEvent.change(date, { target: { value: '2031-11-14' } }); // picked from the calendar, no blur
      await act(async () => {
        vi.advanceTimersByTime(800);
      });
      await waitFor(() => expect(gridCalls()).toHaveLength(1));
      expect(gridCalls()[0].body.rows[0].cells).toEqual({ postingDate: '2031-11-14' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a date pasted the Excel way into a date cell is read with the grid month', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: reel }]);
    await renderGrid();
    const date = screen.getByLabelText('Posting Date, row 1, Founder reel');
    await act(async () => {
      fireEvent.paste(date, { clipboardData: { getData: () => '05/11/2031' } });
    });
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    expect(gridCalls()[0].body.rows[0].cells).toEqual({ postingDate: '2031-11-05' });
  });

  it('keyboard: Enter in a date cell moves to the same column in the next row', async () => {
    await renderGrid();
    const first = screen.getByLabelText('Posting Date, row 1, Founder reel');
    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Posting Date, row 2, Admissions post'));
  });
});

describe('4. Content and Design owners in the row panel', () => {
  it('shows Content, Design and Posting steps for a design row, flags the missing Design owner, and saves the choice', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r2', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: staticRow }]);
    await renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Row details: Admissions post' }));
    const panel = await screen.findByRole('dialog', { name: 'Admissions post' });
    const steps = within(panel).getByRole('group', { name: /Steps & Deadlines/ });
    expect(within(steps).getByText('Needs attention')).toBeInTheDocument();
    expect(within(steps).getByText(/Missing: Design owner/)).toBeInTheDocument();
    expect(within(steps).getByLabelText('Content owner')).toHaveValue('p-writer');
    expect(within(steps).getByLabelText('Design deadline')).toHaveValue('2031-11-14');
    expect(within(steps).queryByLabelText('Script owner')).not.toBeInTheDocument();
    fireEvent.change(within(steps).getByLabelText('Design owner'), { target: { value: 'p-designer' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    expect(gridCalls()[0].body.rows[0]).toEqual({ clientKey: 'r2', rowId: 'r2', cells: { designOwnerId: 'p-designer' } });
  });
});

describe('5. Add Row parity', () => {
  it('Add row opens the full row form with the Add Row steps, suggestions from the same autofill endpoint, and the same checks', async () => {
    autofillHandler = (body) => ({
      stages:
        body.type === 'Reel'
          ? [
              { stageKey: 'Script', ownerId: 'p-writer', ownerName: 'Asha Writer', dueDate: '2031-11-12', reason: 'Lowest workload' },
              { stageKey: 'Edit', ownerId: 'p-editor', ownerName: 'Ravi Editor', dueDate: '2031-11-18', reason: 'Lowest workload' },
            ]
          : [],
    });
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r9', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: { ...reel, rowId: 'r9', topic: 'New reel' } }]);
    await renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    const panel = await screen.findByRole('dialog', { name: 'New row' });
    // Same required checks as the Add Row form.
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    expect(within(panel).getByText('Posting date is required.')).toBeInTheDocument();
    expect(gridCalls()).toHaveLength(0);
    // No publish time: nothing uses it (the server keeps its 18:00 default).
    expect(within(panel).queryByLabelText(/publish time/i)).toBeNull();

    fireEvent.change(within(panel).getByLabelText('Posting date'), { target: { value: '2031-11-20' } });
    fireEvent.change(within(panel).getByLabelText('Topic'), { target: { value: 'New reel' } });
    fireEvent.change(within(panel).getByLabelText('Type'), { target: { value: 'Reel' } });
    await waitFor(() => expect(calls.some((c) => c.url === '/api/calendar-plans/plan1/rows/autofill')).toBe(true));
    const af = calls.find((c) => c.url === '/api/calendar-plans/plan1/rows/autofill')!.body;
    expect(af).toEqual({ type: 'Reel', postingDate: '2031-11-20', needsScript: true, needsShoot: true });
    // Steps and automatic deadlines exactly as the Add Row form builds them.
    expect(within(panel).getByLabelText('Shoot deadline')).toHaveValue('2031-11-15');
    expect(within(panel).getByLabelText('Posting deadline')).toHaveValue('2031-11-20');
    await waitFor(() => expect(within(panel).getByLabelText('Script owner')).toHaveValue('p-writer'));

    // The Add Row form's deadline rule: a step after the publish date blocks saving.
    fireEvent.change(within(panel).getByLabelText('Edit deadline'), { target: { value: '2031-11-22' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    expect(within(panel).getByText('Deadline cannot be after publish date')).toBeInTheDocument();
    expect(gridCalls()).toHaveLength(0);

    fireEvent.change(within(panel).getByLabelText('Edit deadline'), { target: { value: '2031-11-17' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save row' }));
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    const sent = gridCalls()[0].body.rows[0];
    expect(sent.rowId).toBeNull();
    // Only what the user set is sent; suggestions and automatic dates are recalculated by the same rules on save.
    expect(sent.cells).toMatchObject({ postingDate: '2031-11-20', topic: 'New reel', type: 'Reel', typeExact: true, deadlines: { Edit: '2031-11-17' } });
    expect(sent.cells.scriptOwnerId).toBeUndefined();
    expect(sent.cells.publishTime).toBeUndefined();
  });

  it('the shared checks are the Add Row form checks', () => {
    const steps = setStepDueDate(buildDefaultSteps('Reel', true, true, '2031-11-20', people), 'Script', '2031-11-16');
    const { errors } = validateRowSteps({ steps, postingDate: '2031-11-20', type: 'Reel', needsShoot: true, sourceVideoLink: '', members: people });
    expect(errors.Script).toBe('Script must be before Shoot deadline');
    const noShoot = validateRowSteps({ steps: buildDefaultSteps('Reel', false, false, '2031-11-20', people), postingDate: '2031-11-20', type: 'Reel', needsShoot: false, sourceVideoLink: '', members: people });
    expect(noShoot.errors.sourceVideoLink).toMatch(/Source video link is required/);
  });

  it('a row typed straight into the grid saves once date, topic and type are filled', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r3', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: { ...staticRow, rowId: 'r3', topic: 'New post' } }]);
    await renderGrid();
    const date = screen.getByLabelText('Posting Date, row 3');
    fireEvent.change(date, { target: { value: '2031-11-20' } });
    fireEvent.blur(date);
    const topic = screen.getByLabelText('Topic, row 3');
    fireEvent.change(topic, { target: { value: 'New post' } });
    fireEvent.blur(topic);
    expect(gridCalls()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Type, row 3'), { target: { value: 'Poster' } });
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    expect(gridCalls()[0].body.rows[0].cells).toMatchObject({ postingDate: '2031-11-20', topic: 'New post', type: 'Poster', typeExact: true });
  });
});

describe('6. Paste after the UI changes', () => {
  const pasteResult = (body: any) =>
    okResponse(
      body.rows.map((r: any, i: number) =>
        i === 0
          ? { clientKey: r.clientKey, rowId: null, status: body.dryRun ? 'valid' : 'saved', cellErrors: {}, warnings: [], ignoredCells: ['scriptStatus'], resolved: { postingDate: { input: '05/11/2031', value: '2031-11-05', byMonth: true }, type: { input: 'Poster', value: 'Static Post' } }, row: body.dryRun ? undefined : { ...staticRow, rowId: 'r9', topic: 'Pasted one' } }
          : { clientKey: r.clientKey, rowId: null, status: 'invalid', cellErrors: { editOwner: ['No active person is named exactly "Nobody".'] }, warnings: [], ignoredCells: [] }
      ),
      { dryRun: Boolean(body.dryRun) }
    );

  it('Paste from Excel is its own action: paste, check, then save', async () => {
    saveHandler = pasteResult;
    await renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Paste from Excel' }));
    const dlg = await screen.findByRole('dialog', { name: 'Paste from Excel' });
    expect(document.activeElement).toBe(within(dlg).getByLabelText('Excel rows'));
    fireEvent.change(within(dlg).getByLabelText('Excel rows'), {
      target: { value: 'Posting Date\tTopic\tType\tScript Status\r\n05/11/2031\tPasted one\tPoster\tDone\r\n20 Nov, 2031\tPasted two\tReel\t' },
    });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Check rows' }));
    const preview = await screen.findByRole('dialog', { name: 'Check pasted rows' });
    expect(gridCalls()[0].body.dryRun).toBe(true);
    expect(gridCalls()[0].body.rows[0].cells).toMatchObject({ postingDate: '05/11/2031', topic: 'Pasted one', type: 'Poster', scriptStatus: 'Done' });
    expect(within(preview).getByText(/from “05\/11\/2031”, read using the grid month/)).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole('button', { name: 'Save 1 row' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(gridCalls().pop()!.body.dryRun).toBeUndefined();
    expect(await screen.findByText(/1 row saved\. 1 need fixing/)).toBeInTheDocument();
  });

  it('several Excel rows pasted on Topic are placed from that column', async () => {
    saveHandler = pasteResult;
    await renderGrid();
    await act(async () => {
      fireEvent.paste(screen.getByLabelText('Topic, row 3'), { clipboardData: { getData: () => 'Pasted one\tPoster\r\nPasted two\tReel' } });
    });
    await screen.findByRole('dialog', { name: 'Check pasted rows' });
    expect(gridCalls()[0].body.rows.map((r: any) => r.cells)).toEqual([{ topic: 'Pasted one', type: 'Poster' }, { topic: 'Pasted two', type: 'Reel' }]);
  });

  it('several rows pasted on a non-Excel column point to Paste from Excel', async () => {
    await renderGrid();
    await act(async () => {
      fireEvent.paste(screen.getByLabelText('Brief, row 1, Founder reel'), { clipboardData: { getData: () => 'a\tb\r\nc\td' } });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/use “Paste from Excel”/);
    expect(gridCalls()).toHaveLength(0);
  });
});

describe('Grid basics kept from PG-2', () => {
  it('shows a cell error on the cell, named for screen readers', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'invalid', cellErrors: { topic: ['Topic is required.'] }, warnings: [], ignoredCells: [] }]);
    await renderGrid();
    const topic = screen.getByLabelText('Topic, row 1, Founder reel');
    fireEvent.change(topic, { target: { value: '' } });
    fireEvent.blur(topic);
    await waitFor(() => expect(screen.getByLabelText('Topic, row 1, Founder reel')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByLabelText('Topic, row 1, Founder reel')).toHaveAccessibleDescription(/Topic is required/);
  });

  it('a month with several plans asks for a choice and does not allow editing until one is chosen', async () => {
    const p = baseGrid().plans[0];
    await renderGrid({ plans: [p, { ...p, _id: 'plan2', code: 'PLAN-2031-11-002' }], plan: null, rows: [], selectionRequired: true });
    expect(screen.getByLabelText('Plan for this month')).toBeInTheDocument();
    expect(screen.queryByLabelText('Posting Date, row 1')).not.toBeInTheDocument();
  });

  it('owner picked from the list is sent by id; "Auto-assign" clears it back to autofill', async () => {
    saveHandler = (body) => okResponse([{ clientKey: body.rows[0].clientKey, rowId: 'r1', status: 'saved', cellErrors: {}, warnings: [], ignoredCells: [], row: reel }]);
    await renderGrid();
    fireEvent.change(screen.getByLabelText('Edit Owner, row 1, Founder reel'), { target: { value: 'p-editor' } });
    await waitFor(() => expect(gridCalls()).toHaveLength(1));
    expect(gridCalls()[0].body.rows[0]).toMatchObject({ rowId: 'r1', cells: { editOwnerId: 'p-editor' } });
    fireEvent.change(screen.getByLabelText('Edit Owner, row 1, Founder reel'), { target: { value: '' } });
    await waitFor(() => expect(gridCalls()).toHaveLength(2));
    expect(gridCalls()[1].body.rows[0].cells).toEqual({ editOwner: '' });
  });

  it('upload sends the file for a preview first', async () => {
    saveHandler = () => okResponse([{ clientKey: 'file-row-2', rowId: null, status: 'valid', cellErrors: {}, warnings: [], ignoredCells: [], input: { topic: 'From file', postingDate: '2 Dec, 2031', type: 'Reel' } }], { dryRun: true, upload: { layout: 'grid', rowCount: 1 } });
    await renderGrid();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Upload an Excel or CSV plan file'), { target: { files: [new File(['x'], 'plan.xlsx')] } });
    });
    const dialog = await screen.findByRole('dialog', { name: 'Check uploaded rows' });
    expect(within(dialog).getByText('From file')).toBeInTheDocument();
    expect(calls.find((c) => c.url === '/api/calendar-plans/grid/upload')!.body).toMatchObject({ calendar: 'sm', month: '2031-11', planId: 'plan1', dryRun: 'true' });
  });

  it('approved rows are locked: plain text, no inputs', async () => {
    await renderGrid({ rows: [approvedRow] });
    expect(screen.queryByLabelText('Topic, row 1, Approved reel')).not.toBeInTheDocument();
    expect(screen.getAllByText('Approved reel').length).toBeGreaterThan(0);
  });

  it('the row panel can submit a single draft row (the plan detail used to)', async () => {
    await renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Row details: Founder reel' }));
    const panel = await screen.findByRole('dialog', { name: 'Founder reel' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Submit row' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/calendar-plans/plan1/rows/r1/submit' && c.method === 'POST')).toBe(true));
  });
});
