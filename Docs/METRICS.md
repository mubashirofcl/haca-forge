# Marketing Portal (MMP) - System Metrics & Key Performance Indicators (KPIs)

This document provides formal definitions, mathematical formulas, data sources, and operational benchmarks for all metrics used across reporting, dashboards, and background analytics jobs in the MMP platform.

---

## 1. Metric Catalog

### 1.1 On-Time Delivery Rate
- **Definition**: The percentage of deliverables, tasks, or content items finished on or prior to the agreed target deadline.
- **Formula**:
  $$\text{On-Time Rate} = \left( \frac{\text{Count of items where } \text{completionDate} \le \text{deadline}}{\text{Total completed items in period}} \right) \times 100$$
- **Edge Cases**:
  - If total completed items $= 0$, the default score is **100.0%**.
  - If no deadline was specified on the item, it is treated as **on-time**.
  - Reopened tasks: If a task was reopened after previous completion, the final completion date is evaluated against the deadline.
- **Target Benchmark**: $\ge 95.0\%$

---

### 1.2 First-Pass Approval Rate
- **Definition**: The percentage of production deliverables, tasks, or content items that receive approval on their very first submission without requiring changes or entering a revision cycle.
- **Formula**:
  $$\text{First-Pass Rate} = \left( \frac{\text{Count of approved items with } \text{revisionCount} = 0}{\text{Total approved items in period}} \right) \times 100$$
- **Edge Cases**:
  - If total reviewed items $= 0$, default is **100.0%**.
  - Items that transitioned to `changes_requested` or `reshoot_needed` even once are disqualified from first-pass approval.
- **Target Benchmark**: $\ge 85.0\%$

---

### 1.3 Speed vs. Estimate Score
- **Definition**: Evaluates worker delivery speed and adherence to estimated task durations.
- **Formula**:
  $$\text{Speed Score} = \min\left(100.0, \; \frac{\sum \text{Estimated Hours}}{\max\left(\sum \text{Actual Logged Hours}, \; 0.1\right)} \times 100\right)$$
- **Behavior**:
  - When $\text{Actual} \le \text{Estimate}$, worker achieves a maximum score of **100.0%**.
  - When $\text{Actual} > \text{Estimate}$, the score scales downward proportionally.
  - If unestimated tasks are logged, the estimate defaults to actual hours so workers are not unfairly penalized.
- **Target Benchmark**: $\ge 90.0\%$

---

### 1.4 Volume & Capacity Utilization
- **Definition**: Ratio of hours logged on production tasks to the net available work capacity of a worker or team.
- **Formula**:
  $$\text{Net Capacity Hours} = \text{Base Capacity Hours (e.g. 40h/week)} - (\text{Approved Leave Days} \times 8)$$
  $$\text{Utilization Rate} = \left( \frac{\text{Total Logged Task Hours in Period}}{\max(\text{Net Capacity Hours}, 1)} \right) \times 100$$
  $$\text{Volume Score} = \min(100.0, \; \text{Utilization Rate})$$
- **Target Benchmark**: $80.0\% - 95.0\%$

---

### 1.5 Worker Efficiency Score
- **Definition**: A unified composite index reflecting overall worker effectiveness, balancing timeliness, quality, speed, and output volume.
- **Formula**:
  $$\text{Score} = (W_{\text{onTime}} \times \text{OnTimeRate}) + (W_{\text{firstPass}} \times \text{FirstPassRate}) + (W_{\text{speed}} \times \text{SpeedScore}) + (W_{\text{volume}} \times \text{VolumeScore})$$
- **Configurable Weights (System Settings)**:
  - $W_{\text{onTime}} = 0.40$ (40%)
  - $W_{\text{firstPass}} = 0.30$ (30%)
  - $W_{\text{speed}} = 0.20$ (20%)
  - $W_{\text{volume}} = 0.10$ (10%)
  - $\sum W = 1.00$ (Weights are configurable by Admin at `/admin/settings`).
- **Scale**: $0.0 - 100.0$ (Rounded to 1 decimal place).

---

### 1.6 Turnaround Time (TAT)
- **Definition**: Total elapsed time from item initiation (request accepted or task assigned) to delivery or publishing.
- **Formula**:
  $$\text{Turnaround (Days)} = \frac{\text{Delivered Timestamp} - \text{Initiated Timestamp}}{1000 \times 60 \times 60 \times 24}$$
- **Target Benchmark**:
  - Tier 1 (Social Static / Carousel): $\le 2.0\text{ days}$
  - Tier 2 (Short-Form Video / Reels): $\le 3.5\text{ days}$
  - Tier 3 (Long-Form / Campaign Production): $\le 7.0\text{ days}$

---

### 1.7 Queue Time vs. Work Time
- **Queue Time (Latency)**: Duration an item remains in an idle or waiting state before active execution begins (e.g., from `assigned` $\to$ `in_progress`, or stage handoff wait).
- **Work Time**: Time spent in active production (`in_progress` or sum of logged minutes in `TimeEntry`).
- **Queue Efficiency**: $\frac{\text{Work Time}}{\text{Work Time} + \text{Queue Time}} \times 100$

---

### 1.8 Aging Buckets
Open requests and pending tasks are categorized into four standard operational aging bands:
1. **Under 3 Days**: Normal queue processing.
2. **3 to 7 Days**: Active progress / standard pipeline.
3. **7 to 14 Days**: Attention required / aging risk.
4. **Over 14 Days**: Critical escalation / overdue review.

---

### 1.9 Handoff Delay
- **Definition**: The elapsed latency between when stage $N$ of a pipeline is approved and when the assignee of stage $N+1$ transitions their task from `assigned` to `in_progress`.
- **Target Benchmark**: $\le 4.0\text{ business hours}$
