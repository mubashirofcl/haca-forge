# Marketing Workflow and Content Management Portal

A decoupled enterprise web application for managing marketing operations, request triage, content calendar planning, multi-team production pipelines, review loops, and analytics.

---

## Architecture & Monorepo Structure

```
marketing-portal/
├── apps/
│   ├── api/             # Express 5 (Node 22 LTS ESM) API & Socket.io server
│   └── web/             # React 18 + Vite + TypeScript + Tailwind CSS
├── packages/
│   └── shared/          # TypeScript Zod schemas, role definitions & permission matrix
├── docs/                # Architecture specifications, build plans, and progress logs
├── docker-compose.yml   # MongoDB & Redis containers for local development
└── .nvmrc               # Node.js 22 LTS
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: v22 LTS (or compatible Node runtime)
- **Docker**: For running MongoDB and Redis locally (or use local installations / MongoDB Atlas)

### 2. Start Services
Start MongoDB and Redis containers:
```bash
docker-compose up -d
```

### 3. Install Dependencies
From the repository root:
```bash
npm install
```

### 4. Build Shared Types & Schemas
```bash
npm run build -w packages/shared
```

### 5. Seed Initial Administrator Account
```bash
npm run seed:admin
```
This creates the initial admin user from `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` in `apps/api/.env`.

### 6. Start Development Servers
Run API and Web frontend concurrently:
```bash
npm run dev
```
- API server runs at: `http://localhost:8080` (health route: `http://localhost:8080/api/status`)
- Web portal runs at: `http://localhost:5173`

---

## Running Quality Checks

- **Linting**: `npm run lint`
- **Type Checking**: `npm run typecheck`
- **Tests**: `npm run test`
