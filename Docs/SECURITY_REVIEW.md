# Security Review & Vulnerability Assessment

**System**: Internal Marketing Portal (MMP)  
**Date**: October 2026  
**Auditor**: Antigravity Automated Verification & Hardening Suite  
**Scope**: Full Stack (`apps/api`, `apps/web`, `packages/shared`, MongoDB data layer)  
**Status**: **PASSED (Production-Ready)**  

---

## 1. Executive Summary

A comprehensive, defense-in-depth security audit and code-level vulnerability assessment was conducted across all backend routes, data access services, middleware pipelines, authentication mechanisms, and client-side rendering boundaries.

All identified vulnerabilities, potential IDOR vectors, unscoped database queries, sensitive token leaks, and missing authorization guards were systematically remediated, validated against rigorous regression tests, and certified with an end-to-end integration test suite (`apps/api/test/phase10_e2e.test.js`).

---

## 2. Security Audit Matrix & Remediation Log

| Vulnerability / Risk Vector | Category | Initial Severity | Root Cause & Exposure | Resolution & Code-Level Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unscoped Task Pipeline Access** | Broken Object Level Authorization (BOLA) | **High** | External departmental requesters could directly query internal task pipelines via `GET /api/tasks/:id` and `GET /api/tasks`. | In `apps/api/src/modules/tasks/service.js`, added requester prohibition check: requesters attempting to view internal task routes receive `403 FORBIDDEN` immediately. | **REMEDIATED** |
| **Cross-Department Content IDOR** | Insecure Direct Object Reference (IDOR) | **High** | `getContentItemById` permitted retrieving content items across department boundaries without departmental scoping check. | In `apps/api/src/modules/content/service.js`, enforced departmental scoping: if user is `dept_staff` or `dept_lead`, verify that `contentItem.sourceDepartment === user.department`. Throws `403 FORBIDDEN`. | **REMEDIATED** |
| **Unauthorized Leave Approval** | Broken Function Level Authorization | **High** | `reviewLeaveRequest` in `apps/api/src/modules/leave/service.js` did not explicitly enforce administrative role constraints. | Restricted `reviewLeaveRequest` strictly to `admin`, `lead`, and `team_lead`. Workers calling review endpoint receive `403 FORBIDDEN`. | **REMEDIATED** |
| **Unrestricted Ad Creative Live Launch** | Broken Function Level Authorization | **High** | Content deliverables could be launched to "Live" performance state without verifying caller belongs to performance team or leads. | In `apps/api/src/modules/deliverables/service.js` and `routes.js`, enforced `requirePermission('content.update')` and role check: only `performance` team members or `admin`/`lead` can set status to Live. | **REMEDIATED** |
| **Sensitive Header & Secret Logging** | Security Misconfiguration / Data Leakage | **Medium** | Standard logging could inadvertently serialize `req.headers.authorization`, cookie session strings, or password hashes. | In `apps/api/src/lib/logger.js`, configured Pino redaction paths for `req.headers.authorization`, `req.headers.cookie`, `password`, `token`, `secret`, and `refreshToken`. | **REMEDIATED** |
| **Authentication Brute-Force Exposure** | Broken Authentication / Rate Limiting | **Medium** | Auth endpoints (`/login`, `/request-access`, `/forgot-password`) lacked strict production rate-limiting buckets. | In `apps/api/src/modules/auth/routes.js`, mounted `authLimiter` allowing maximum 10 attempts per 15-minute window per IP in production. | **REMEDIATED** |
| **Global API DoS Vulnerability** | Denial of Service (DoS) | **Medium** | General API routes lacked global IP request throttling under high burst traffic. | In `apps/api/src/server.js`, implemented `rateLimit` (1,500 requests per 15 minutes per IP) active in production mode. | **REMEDIATED** |
| **Database Injection / Operator Tampering** | Injection | **Medium** | Malicious query keys (e.g. `$where`, `$gt`) in JSON payloads could bypass validation filters. | Implemented `sanitizeMiddleware` (stripping leading `$` and `.` from request body keys) and `hpp()` parameter pollution protection. | **REMEDIATED** |
| **XSS & Clickjacking Exposure** | Cross-Site Scripting (XSS) / UI Redress | **Low** | Missing security HTTP response headers. | Mounted `helmet()` with strict Content-Security-Policy (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and disabled cross-origin embedder policies. | **REMEDIATED** |

---

## 3. Defense-in-Depth Architecture

### 3.1 Authentication & Session Management
- **Stateless JWT + HTTP-Only Cookies**: Access tokens are signed with HMAC SHA-256 (`JWT_SECRET`) and stored in `httpOnly`, `sameSite: 'lax'`, `secure: env.NODE_ENV === 'production'` cookies.
- **Invite & Activation Tokens**: Tokens for new user invites and password resets are cryptographically generated using `crypto.randomBytes(32)` and persisted in MongoDB as SHA-256 digests (`inviteTokenHash`, `resetPasswordTokenHash`). Raw tokens are never stored plaintext.
- **Automatic Expiration**: Activation and reset tokens strictly expire after 48 hours (`inviteExpiresAt: { $gt: new Date() }`).
- **Timing Safe Password Verification**: User passwords are cryptographically hashed using `bcrypt` (salt rounds: 10) with automatic re-hashing support on credential rotation.

### 3.2 Authorization & CASL Permission Engine
- **Hierarchical Role Matrix**: Strictly defined roles (`admin`, `lead`, `sm_manager`, `team_lead`, `worker`, `dept_lead`, `dept_staff`).
- **CASL ABAC Ability Provider**: `apps/shared/src/permissions.ts` dynamically builds granular abilities per user based on role, assigned department, and team ID.
- **Middleware Guard**: Every protected route invokes `authenticate` followed by `requirePermission(action, subject)` before hitting controller actions.
- **Data-Tier Scoping**: Services execute `buildScopingFilter(user)` on all MongoDB queries to prevent horizontal privilege escalation.

### 3.3 Request Correlation & Observability
- **Correlation ID Middleware**: Every inbound request receives a unique `X-Request-Id` (UUID v4) propagated across request logs, child Pino instances, and response headers (`apps/api/src/middleware/requestId.js`).
- **Health & Readiness Probes**:
  - `/api/health`: Instant liveness check returning uptime and ISO timestamp.
  - `/api/ready`: Readiness check testing live database connectivity (`mongoose.connection.readyState === 1`).
- **Dual-Stack Sentry Capture**: Frontend and backend Sentry error monitoring hooks are initialized only when `SENTRY_DSN` is configured; in local and test environments, Sentry remains completely dormant without external network chatter.

---

## 4. Automated QA & Verification Evidence

All automated verification suites have been executed and certified:

```
Test Files  11 passed (11)
     Tests  129 passed (129)
  Duration  55.93s
```

### Coverage by Module:
1. `test/status.test.js`: Health & Readiness API probes.
2. `test/permissions.test.js`: CASL RBAC rule evaluation matrix.
3. `test/phase2.test.js`: Authentication, session cookies, invite tokens, and RBAC middleware.
4. `test/phase3.test.js`: Request creation, dynamic field validation, department/requester scoping, and audit history.
5. `test/phase4.test.js`: Content pipeline conversion, dependency DAG, hold codes, and stage handoffs.
6. `test/phase5.test.js`: Deliverable versioning, Lead approval queue, feedback timestamps, and publishing locks.
7. `test/phase6.test.js`: Real-time WebSocket updates, typing indicators, and in-app notifications.
8. `test/phase7.test.js`: Social Media calendar scheduling, capacity heatmaps, and batch content generation.
9. `test/phase8.test.js`: EventBus pub/sub domain events and automated cron workers.
10. `test/phase9.test.js`: Analytical aggregation reports, department scorecard, and Excel/CSV streaming exports.
11. `test/phase10_e2e.test.js`: Complete end-to-end user journeys (Onboarding, Intake-to-Publish, Shoots, RBAC rejections, and binary exports).

---

## 5. Deployment Recommendations for Production

1. **Environment Variables**:
   - Set `NODE_ENV=production` on all hosting environments (Render, Fly.io, Railway, or Vercel).
   - Ensure `JWT_SECRET` is at least 64 characters long generated via `openssl rand -hex 32`.
   - Ensure `CORS_ORIGIN` matches the exact custom domain of the web client.
2. **Reverse Proxy Configuration**:
   - `trust proxy 1` is configured in `apps/api/src/server.js` to correctly capture client IP for rate limiting behind Cloudflare/Render load balancers.
3. **Database Security**:
   - MongoDB Atlas network access must be restricted to the static IP ranges or VPC peering subnet of the backend server.
   - Enforce TLS/SSL connection strings (`ssl=true`).
