# CoreSync — Implementation Plan
## In-House Goal Setting & Tracking Portal

This plan covers building the complete CoreSync application from scratch, targeting a hackathon demo with zero infrastructure cost and a clear path to production.

---

## User Review Required

> [!IMPORTANT]
> **App Name Conflict**: The prompt refers to both "CoreSync" (project title) and "ALIGN" (top-bar branding). This plan uses **CoreSync** as the primary brand name throughout. Please confirm if you want the sidebar/top-bar to say "ALIGN" instead.

> [!IMPORTANT]
> **Backend DB Connection**: The spec calls for Supabase (PostgreSQL), Upstash (Redis), and Railway/Render (API). Since this is built locally first, the backend will use `.env` files for all connection strings — you'll need to supply your own Supabase, Upstash, and SMTP credentials before deploying. The app will ship with a local SQLite fallback for demo purposes if those aren't configured.

> [!WARNING]
> **Scope & Timeline**: This is a very large application (~40+ components, 25+ API routes, complex business logic). I'll build it in prioritized phases so the core demo flows work first, then layer in advanced features.

---

## Open Questions

> [!IMPORTANT]
> 1. Should the top bar/brand say **"CoreSync"** or **"ALIGN"** as specified in Section 6?
> 2. Do you have Supabase, Upstash, and SMTP credentials ready, or should I configure the app to run **fully locally** with SQLite + in-memory session store for the hackathon demo?
> 3. Should I include a **Docker Compose** file for local development (runs Postgres + Redis containers automatically)?

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND  (React 18 + Vite + Tailwind)             │
│  /frontend  →  Vercel deploy                        │
├─────────────────────────────────────────────────────┤
│  BACKEND   (Node.js + Express)                      │
│  /backend  →  Railway / Render deploy               │
├─────────────────────────────────────────────────────┤
│  DATABASE                                           │
│  PostgreSQL on Supabase (or local pg for dev)       │
│  Redis on Upstash (or local redis for dev)          │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1 — Project Scaffolding & Foundation

### Directory Structure
```
AtomBerg Hackathon(CoreSync)/
├── frontend/           ← Vite + React + Tailwind
│   ├── src/
│   │   ├── api/        ← Axios instance + interceptors
│   │   ├── components/ ← Shared UI components
│   │   ├── pages/      ← Route-level page components
│   │   │   ├── employee/
│   │   │   ├── manager/
│   │   │   └── admin/
│   │   ├── hooks/      ← Custom React hooks
│   │   ├── stores/     ← Zustand state (auth, cycle)
│   │   ├── utils/      ← Score calculators, formatters
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/     ← auth, users, goals, approvals...
│   │   ├── middleware/ ← auth, validation, rate-limit
│   │   ├── db/         ← pg pool, schema.sql, seed.js
│   │   ├── jobs/       ← escalation cron job
│   │   ├── utils/      ← score calc, email, excel export
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## Phase 2 — Backend Core

### [NEW] `backend/src/db/schema.sql`
Full PostgreSQL schema with all 6 tables, ENUMs, and indexes.

### [NEW] `backend/src/db/seed.js`
Inserts: 1 admin, 2 managers, 5 employees, 1 active cycle, pre-seeded goals + achievements for emp1.

### [NEW] `backend/src/db/pool.js`
pg Pool configured from `DATABASE_URL` env var.

### [NEW] `backend/src/server.js`
Express app bootstrap: CORS, JSON parsing, rate limiting (express-rate-limit + Redis store), route mounting, global error handler.

### [NEW] `backend/src/middleware/auth.js`
JWT verification middleware. Extracts role, userId from token.

### [NEW] `backend/src/middleware/validate.js`
Zod-based request body validation middleware factory.

### [NEW] `backend/src/routes/auth.js`
- `POST /api/auth/login` — bcrypt compare, issue access (15m) + refresh (7d) JWT, store refresh in Redis
- `POST /api/auth/refresh` — validate refresh from Redis, issue new access token
- `POST /api/auth/logout` — delete refresh from Redis

### [NEW] `backend/src/routes/users.js`
- `GET /api/users/me`
- `GET /api/users/team`
- `GET /api/users/org-tree`

### [NEW] `backend/src/routes/goals.js`
Full CRUD + submit + shared goal push.
Score computation on achievement POST (all 4 UoM types).
Momentum flag computation vs previous quarter.
Shared goal sync on achievement log.

### [NEW] `backend/src/routes/approvals.js`
Manager approval/return with audit logging.

### [NEW] `backend/src/routes/achievements.js`
POST with full score + momentum computation.

### [NEW] `backend/src/routes/reports.js`
Achievement report, completion report, Excel export stream.

### [NEW] `backend/src/routes/admin.js`
Cycles CRUD, goal unlock, audit logs, escalations.

### [NEW] `backend/src/jobs/escalation.cron.js`
node-cron daily 08:00 job running all 3 escalation checks.

### [NEW] `backend/src/utils/scoreEngine.js`
Pure functions: `computeProgressScore(uomType, actual, target)`, `computeMomentum(current, previous)`.

### [NEW] `backend/src/utils/mailer.js`
Nodemailer transporter configured from SMTP env vars.

### [NEW] `backend/src/utils/excelExport.js`
ExcelJS workbook builder, streams response directly.

---

## Phase 3 — Frontend Foundation

### [NEW] `frontend/src/api/axios.js`
Axios instance with:
- Base URL from env
- Request interceptor: attach access token
- Response interceptor: 401 → refresh → retry, 500 → toast

### [NEW] `frontend/src/stores/authStore.js`
Zustand store: user, tokens, login(), logout(), refreshToken()

### [NEW] `frontend/src/stores/cycleStore.js`
Zustand store: active cycle, current phase, loading state

### [NEW] `frontend/src/components/layout/`
- `Sidebar.jsx` — role-based nav links, collapsible
- `TopBar.jsx` — brand, user avatar, active cycle badge, notification bell
- `Layout.jsx` — composes sidebar + topbar + main content

### [NEW] `frontend/src/components/ui/`
- `Badge.jsx` — status badges (Draft/Submitted/Approved/Returned)
- `ProgressRing.jsx` — circular progress for admin dashboard
- `WeightageBar.jsx` — live-updating horizontal bar
- `SkeletonLoader.jsx` — pulse skeleton rows
- `EmptyState.jsx` — illustrated empty states
- `ConfirmDialog.jsx` — destructive action confirmation modal
- `SlideOver.jsx` — right-side drawer for goal form
- `MomentumBadge.jsx` — Accelerating/Stable/Decelerating

---

## Phase 4 — Employee Views

### [NEW] `frontend/src/pages/employee/Dashboard.jsx`
Phase indicator pill, goal health summary, status quick cards, CTAs.

### [NEW] `frontend/src/pages/employee/GoalSheet.jsx`
Goals table with inline weightage editor, live sum validator, Add Goal drawer, shared goal lock icons.

### [NEW] `frontend/src/pages/employee/CheckIn.jsx`
Single goal check-in form with live score preview and momentum badge.

---

## Phase 5 — Manager Views

### [NEW] `frontend/src/pages/manager/Approvals.jsx`
Pending submissions list, expandable goal sheets, inline edit, approve/return with reason.

### [NEW] `frontend/src/pages/manager/TeamDashboard.jsx`
Team member grid cards, progress bars, momentum flags, amber highlighting.

### [NEW] `frontend/src/pages/manager/CheckIns.jsx`
Check-in completion table, status colors, comment modal.

---

## Phase 6 — Admin Views

### [NEW] `frontend/src/pages/admin/Dashboard.jsx`
Completion rate cards with progress rings, department heatmap, escalation count.

### [NEW] `frontend/src/pages/admin/Cascade.jsx`
D3.js org tree, colored shared-goal edges, right-panel goal sheet on node click.

### [NEW] `frontend/src/pages/admin/Reports.jsx`
Filter panel, live preview table, Excel export button.

### [NEW] `frontend/src/pages/admin/Audit.jsx`
Paginated audit trail, date/user/entity filters, JSON diff expand.

### [NEW] `frontend/src/pages/admin/Cycles.jsx`
Cycle management, inline date editing, create new cycle form.

### [NEW] `frontend/src/pages/admin/Escalations.jsx`
Escalation log table, mark resolved button.

---

## Phase 7 — Analytics Module

### [NEW] `frontend/src/pages/admin/Analytics.jsx`
All 4 Recharts visualizations:
1. QoQ Achievement Trend (LineChart, one line per department)
2. Goal Completion Heatmap (custom grid component)
3. Goal Distribution (PieChart donuts: by UoM, by Thrust Area, by Status)
4. Manager Effectiveness (BarChart with amber highlighting < 60%)

---

## Phase 8 — Polish & Error Handling

- Error Boundary wrapper on all major routes
- Offline detection banner
- Form double-submit prevention
- All forms: blur-triggered inline validation
- Mobile responsive: sidebar → bottom tab bar on < 768px
- Accessibility: ARIA labels, keyboard navigation

---

## Verification Plan

### Automated Checks
- Run `npm run build` on frontend — must succeed with no errors
- Run `node src/db/seed.js` on backend — must complete cleanly
- Verify all 3 login credentials work and route to correct dashboards

### Demo Flow Verification (Browser)
1. Login as `emp1@align.demo` → see Dashboard → add 4 goals → submit
2. Login as `manager1@align.demo` → approve emp1's goals
3. Login as `emp1@align.demo` → log Q1 achievement → see score + momentum
4. Login as `admin@align.demo` → view Cascade, Reports, Audit, Analytics
5. Export to Excel from Reports page

### Manual Checks
- Weightage bar turns green at exactly 100%, red otherwise
- Submit button disabled until sum = 100%
- Shared goal title/target fields are read-only
- Excel file downloads correctly
- D3 org tree renders with colored edges

---

## Build Order (Execution Sequence)

1. Init both projects (Vite + Express)
2. Backend: DB schema → seed → auth routes → all other routes
3. Frontend: Axios + auth store → Layout → Employee pages
4. Frontend: Manager pages → Admin pages → Analytics
5. Integration testing → polish → README
