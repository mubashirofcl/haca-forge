import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PipelineStepper, type PipelineStageItem } from '../PipelineStepper';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => mockNavigate }));

const shoot: PipelineStageItem = {
  _id: 's1', stageKey: 'Shoot', status: 'Approved', ownerId: { name: 'Test Shooter', jobRole: 'Videographer', avatarUrl: 'https://example.test/shooter.jpg' }, deadline: '2031-11-05T00:00:00.000Z',
  startedAt: '2031-11-01T04:30:00.000Z', submittedAt: '2031-11-03T10:54:00.000Z', approvedAt: '2031-11-04T06:00:00.000Z',
};
const edit: PipelineStageItem = {
  _id: 's2', stageKey: 'Edit', status: 'Feedback', ownerId: { name: 'Test Editor' }, deadline: '2031-11-08T00:00:00.000Z', revisions: 2,
  startedAt: '2031-11-04T07:00:00.000Z', submittedAt: '2031-11-06T07:00:00.000Z', resubmittedAt: '2031-11-07T07:00:00.000Z',
};
const post: PipelineStageItem = { _id: 's3', stageKey: 'Post', status: 'Not Started', isLocked: true, ownerId: null, deadline: '2031-11-10T00:00:00.000Z' };

const show = (stages: PipelineStageItem[], currentStageId = 's1', status = 'Approved') =>
  render(
    <MemoryRouter>
      <PipelineStepper stages={stages} currentStageId={currentStageId} status={status} />
    </MemoryRouter>
  );
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
const steps = () => within(screen.getByRole('list', { name: 'Workflow steps' })).getAllByRole('listitem');

describe('PipelineStepper workflow diagram', () => {
  it('marks where the flow starts and ends', () => {
    show([shoot, edit, post]);
    const [first, , last] = steps();
    expect(within(first).getByText('Start')).toBeInTheDocument();
    expect(within(last).getByText('End')).toBeInTheDocument();
  });

  it('shows owner, deadline, started, submitted and approved on each step', () => {
    show([shoot, edit, post]);
    const [first, second, third] = steps();
    expect(within(first).getByText('Test Shooter')).toBeInTheDocument();
    expect(within(first).getByText(when(shoot.startedAt!))).toBeInTheDocument();
    expect(within(first).getByText(when(shoot.submittedAt!))).toBeInTheDocument();
    expect(within(first).getByText(when(shoot.approvedAt!))).toBeInTheDocument();
    // A resubmitted step shows the latest submit time, labelled as such.
    expect(within(second).getByText('Resubmitted')).toBeInTheDocument();
    expect(within(second).getByText(when(edit.resubmittedAt!))).toBeInTheDocument();
    expect(within(within(second).getByText('Revisions').parentElement!).getByText('2')).toBeInTheDocument();
    // The Post step is posted, not submitted; empty times read as a dash.
    expect(within(third).queryByText('Submitted')).not.toBeInTheDocument();
    expect(within(third).getByText('Posted')).toBeInTheDocument();
    expect(within(third).getByText('Unassigned')).toBeInTheDocument();
    expect(within(third).getAllByText('–').length).toBe(2);
  });

  it('shows the worker photo, falling back to initials, or a placeholder when unassigned', () => {
    show([shoot, edit, post]);
    const [first, second, third] = steps();
    expect(first.querySelector('img')).toHaveAttribute('src', 'https://example.test/shooter.jpg');
    expect(within(first).getByText('Videographer')).toBeInTheDocument();
    expect(second.querySelector('img')).toBeNull();
    expect(within(second).getByText('TE')).toBeInTheDocument();
    expect(third.querySelector('img')).toBeNull();
    expect(within(third).getByText('Unassigned')).toBeInTheDocument();
  });

  it('colours each step by its own status, including the step being viewed', () => {
    show([shoot, edit, post]);
    const [first, second, third] = steps();
    expect(within(first).getByText('Approved', { selector: '[data-step-status]' })).toBeInTheDocument();
    expect(first.querySelector('.flow-node')).toHaveClass('status-approved');
    expect(within(first).getByText('Viewing')).toBeInTheDocument();
    expect(second.querySelector('.flow-node')).toHaveClass('status-changes');
    expect(third.querySelector('.flow-node')).toHaveClass('status-locked');
    const key = within(screen.getByRole('list', { name: 'Colour key' }));
    for (const label of ['Published', 'Done', 'In progress', 'Waiting for approval', 'Changes requested or blocked', 'Not started']) {
      expect(key.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a submitted step that is not yet reviewed as waiting for approval', () => {
    show([shoot, { ...edit, awaitingReview: true }, post]);
    const [, second] = steps();
    expect(within(second).getByText('Waiting for approval', { selector: '[data-step-status]' })).toBeInTheDocument();
    expect(second.querySelector('.flow-node')).toHaveClass('status-waiting');
    expect(second.querySelector('svg[data-edge]')).toHaveAttribute('data-edge', 'active');
  });

  it('colours each connecting line by the hand-off it shows', () => {
    const edgeOf = (li: HTMLElement) => li.querySelector('svg[data-edge]')!;
    const { unmount } = show([shoot, { ...edit, status: 'In Progress' }, post]);
    let [, second, third] = steps();
    expect(edgeOf(second)).toHaveAttribute('data-edge', 'active');
    expect(edgeOf(second)).toHaveClass('status-in-progress');
    expect(edgeOf(third)).toHaveAttribute('data-edge', 'idle');
    unmount();
    const r2 = show([shoot, { ...edit, status: 'Approved' }, post]);
    [, second] = steps();
    expect(edgeOf(second)).toHaveAttribute('data-edge', 'done');
    expect(edgeOf(second)).toHaveClass('status-approved');
    r2.unmount();
    show([shoot, edit, post]);
    [, second] = steps();
    expect(edgeOf(second)).toHaveAttribute('data-edge', 'attention');
    expect(edgeOf(second)).toHaveClass('status-changes');
  });

  it('summarises progress, the overall start and the finish', () => {
    const { unmount } = show([shoot, edit, post]);
    expect(screen.getByText('1 of 3 steps done')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Steps finished' })).toHaveAttribute('aria-valuenow', '1');
    const startedDd = screen.getByText('Started', { selector: 'dt' }).nextElementSibling!;
    expect(startedDd).toHaveTextContent(when(shoot.startedAt!));
    expect(screen.getByText('Not finished')).toBeInTheDocument();
    unmount();
    const postedAt = '2031-11-10T12:00:00.000Z';
    show([shoot, { ...edit, status: 'Approved', approvedAt: '2031-11-08T06:00:00.000Z' }, { ...post, status: 'Published', isLocked: false, postedAt }]);
    expect(screen.getByText('Finished', { selector: 'dt' }).nextElementSibling).toHaveTextContent(when(postedAt));
  });

  it('says a time was not recorded rather than that work never began', () => {
    show([{ ...shoot, startedAt: null, approvedAt: null }]);
    expect(screen.getByText('1 of 1 steps done')).toBeInTheDocument();
    expect(screen.getByText('Started', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Not recorded');
    expect(screen.getByText('Finished', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Not recorded');
    expect(screen.queryByText('Not finished')).not.toBeInTheDocument();
  });

  it('other steps open when clicked; the viewed step is not a link', () => {
    show([shoot, edit, post]);
    const [first, second] = steps();
    expect(within(first).queryByRole('button')).not.toBeInTheDocument();
    expect(first.querySelector('[aria-current="step"]')).toBeInTheDocument();
    fireEvent.click(within(second).getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/work/s2');
  });

  it('flags a step past its deadline with the number of days', () => {
    show([{ ...edit, status: 'In Progress', deadline: new Date(Date.now() - 3 * 86400000).toISOString() }], 's2', 'In Progress');
    expect(screen.getByText('3 days late')).toBeInTheDocument();
  });
});
