# Individual Tracking and Timing Specification

## 1. Overview & Core Philosophy

HACA Marketing OS enforces individual work tracking measured exclusively from each worker's own start. Common, shared timing indicators (such as shared countdown clocks, time-of-day publish deadlines, and arbitrary hour-based escalation timers) are completely removed from worker views.

Each team member and every deliverable step is tracked individually with full fidelity across revision rounds and non-working intervals (Blocked and Pending).

---

## 2. Timestamps Recorded Per Step and Round

Every stage in a content piece records exact timestamps:
1. `unlockedAt`: When preceding pipeline stages finished and this step became unblocked/actionable.
2. `assignedAt`: When the owner was assigned to this step.
3. `startedAt`: When the assigned worker explicitly began work (transitioned from `Not Started` to `In Progress`).
4. `submittedAt`: When the worker submitted work for Creative Head review.
5. `decisionAt`: When the Creative Head made a decision (`approved` or `changes_requested`).
6. `changesRequestedAt`: Recorded when a revision is requested (marks the start of the next round).
7. `resubmittedAt`: When the worker submits revised work for the subsequent round.
8. `approvedAt`: When Creative Head approved the step.
9. `postedAt`: When the Posting Owner marked live publication.

### 2.1 Interval Logs for Blocked and Pending
Whenever work is paused due to a Blocker (e.g. Waiting for Content, Client Approval) or placed in Pending, an interval record is logged:
- `kind`: `'blocked'` | `'pending'`
- `startedAt`: Timestamp when state entered Blocked or Pending
- `endedAt`: Timestamp when work resumed to `In Progress`
- `reason`: Standard blocker reason
- `note`: Explanatory context

### 2.2 Strict Sequential Work Enforcement
A worker **cannot submit work without having started**. Submitting directly from `Not Started` is strictly rejected by the API (`MUST_START_BEFORE_SUBMIT`).

---

## 3. Metric Calculations (Display Only)

> [!NOTE]
> All duration measures are display and auditing indicators only. No automated job, penalty, or escalation occurs based on elapsed hours.

### 3.1 Waiting to Start
Time elapsed between when a task became available and when the worker actually started:
$$\text{Waiting to Start} = \text{startedAt} - \text{unlockedAt}$$

### 3.2 Work Time (Net Creative Craftsmanship)
For each round $r$, work time measures actual active effort, strictly deducting time spent in paused intervals:
$$\text{Round Work Time}_r = (\text{roundEnd}_r - \text{roundStart}_r) - \sum \text{Intervals}_{\text{blocked/pending}}$$
- First round starts at `startedAt`.
- Subsequent rounds start at `changesRequestedAt`.
- Total Work Time is the sum of active net work times across all rounds:
$$\text{Total Work Time} = \sum_{r=1}^{N} \text{Round Work Time}_r$$

### 3.3 Approval Wait
Time elapsed from worker submission until Creative Head review decision:
$$\text{Approval Wait} = \text{decisionAt} - \text{submittedAt}$$
If currently under review in `Feedback`: $\text{now} - \text{submittedAt}$.

### 3.4 Late By
Measures calendar days between submission and the step's due date (evaluated date-only at local midnight):
$$\text{Late By (days)} = \text{date}(\text{submissionDate}) - \text{date}(\text{dueDate})$$
- If unsubmitted and past due date: $\text{date}(\text{today}) - \text{date}(\text{dueDate})$.
- If completed on or before the due date: `0` (formatted as `"On time"`).

### 3.5 Display Formatting & Missing Data
- Durations are formatted compactly via `formatDuration`:
  - Days + Hours: `'1d 4h'`
  - Hours + Minutes: `'3h 20m'`
  - Minutes only: `'45m'`
- Old records or unstarted tasks without timestamps display a clean dash (`'—'`).

### 3.6 8-Week Load History & Capacity Trend
For each calendar week $W$:
$$\text{Load}_W = \left(\frac{\sum_{i \in \text{AssignedSteps}_W} \text{DefaultStageHours}(i)}{\text{WeeklyCapacityHours}}\right) \times 100\%$$
- $\text{AssignedSteps}_W$: Steps assigned to the person on or before the end of week $W$ and not yet submitted prior to the start of week $W$.
- Default stage hours: 4 hours (or step `estimatedEffortHrs`).
- Capacity Bands:
  - **Healthy:** $\text{Load} < 65\%$
  - **High:** $65\% \le \text{Load} \le 85\%$
  - **Overloaded:** $\text{Load} > 85\%$

---

## 4. Worker Screens vs. Leadership Views

### 4.1 Worker Experience (My Work & Specialised Workspaces)
- **Zero Shared Timers:** Workers never see shared countdowns, publish hour deadlines, or other workers' clocks.
- **Due Date Only:** Workers see only their step's due **DATE** (e.g. `Nov 5, 2026`).
- **Individual Work Timer:** After clicking Start, the worker sees their own elapsed active work time (`Working for 2h 15m`), automatically pausing when Blocked or Pending.
- **Post-Submission:** Shows their completed work time and approval wait.

### 4.2 Leadership & Audit Views (Admin, Creative Head, SM Manager, Executive)
- **Per-Person Work View:** Dedicated drawer and page accessible from Team Load and Tracker chips. Displays:
  1. **Now:** Tasks in progress, changes requested, waiting for approval, blocked.
  2. **Next:** Locked and not started tasks with step due dates.
  3. **Done:** Last 30 completed tasks with full individual timings.
  4. **Timeline Per Step:** Audit trace of rounds, intervals, and timestamps.
  5. **Summary:** Completion count, on-time rate, average work time per step type, average approval wait.
- **Content Flow Tracker:** Displays columns for **Waiting**, **Work time**, **Approval wait**, and **Late by** with an interactive timeline drawer.

---

## 5. Anti-Ranking and Privacy Rules

- **Strictly No Performance Ranking:** No screen, endpoint, or report ranks, sorts, or compares workers by speed or turnaround.
- **Alphabetical or Load Listing:** Team members are listed strictly alphabetically by name or by current open capacity/load.
- **Craftsmanship First:** Turnaround and work time metrics are operational visibility tools, never evaluative metrics.

