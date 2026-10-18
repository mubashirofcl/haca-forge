# Open Questions & Architectural Decisions

This document records key design decisions and recommended defaults for the Marketing Workflow and Content Management Portal.

---

### Decision 1: Team Leads per Production Team
- **Question**: Does each production team (Content, Graphics, Cinematography, Editor) have its own dedicated team lead, or does the Marketing Lead manage all teams?
- **Decision / Default**: **Hybrid / Configurable**. The Marketing Manager (`lead`) oversees all production workflows and retains final approval authority by default. However, each team can optionally have a `team_lead` assigned. When a `team_lead` is assigned, they gain scoped permissions to manage their team's queue, internal assignments, workload, and timesheets.

---

### Decision 2: Requester Visibility into Worker Identity
- **Question**: Can department requesters see assigned workers' names, or only the status and the Marketing Lead?
- **Decision / Default**: **Protected by default, configurable in Settings**. Requesters see the overall status, stages, deadlines, and the Marketing Lead. By default, individual worker names are masked to prevent requesters from bypassing triage and directly pressurizing production staff. Admin can toggle `requesterCanSeeWorkerName` in System Settings if transparency is preferred.

---

### Decision 3: Ad Performance Feedback
- **Question**: Should the Performance (Ads) team's ad results (e.g., winning creative variants, ROAS) be recorded back against each creative?
- **Decision / Default**: **Yes, via optional metrics and creative refresh requests**. Creatives have lifecycle statuses (`Live`, `Paused`, `Retired`), and Performance managers can attach post-launch metrics (CTR, CPA, ROAS, conversions) and trigger linked "Creative Refresh" requests when ad fatigue sets in.

---

### Decision 4: Social Media Post Metrics Scope
- **Question**: Is post performance (reach, views, engagement) in scope now, or only publication tracking?
- **Decision / Default**: **Publication tracking is core; post metrics are optional fields**. When an item is marked `Published`, the Social Media Manager enters the published URL and timestamp. Optional metric fields (reach, views, likes, shares, comments) can be recorded manually or updated later without blocking publishing workflows.

---

### Decision 5: Email Provider Strategy & Render Limitations
- **Question**: Render blocks outbound SMTP ports (25, 465, 587) on free instances. How should email delivery be architected?
- **Decision / Default**: **Unified mail adapter (`lib/mailer.js`) supporting three providers**:
  1. `console`: Default for local development and CI testing (prints formatted emails to terminal logs with preview links).
  2. `resend`: Recommended for Render deployments (uses HTTPS REST API over port 443, unaffected by SMTP port blocks).
  3. `smtp`: Nodemailer for standard SMTP servers when deployed on paid instances or custom servers.
