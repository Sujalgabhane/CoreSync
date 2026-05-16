<div align="center">
  <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/svgs/solid/bullseye.svg" alt="CoreSync Logo" width="80" height="80">
  <br>
  <h1>CoreSync</h1>
  <p><b>Enterprise-Grade Goal Setting & Tracking Portal</b></p>
  <p><i>Built for the AtomBerg Hackathon 2025</i></p>

  <p>
    <img src="https://img.shields.io/badge/React-18.x-blue?style=for-the-badge&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=nodedotjs" alt="Node.js">
    <img src="https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis" alt="Redis">
    <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind">
  </p>
</div>

---

## 🌟 Overview

**CoreSync** is a production-ready web application designed to solve the complexities of organizational alignment. It enables enterprises to set, cascade, track, and analyze goals across all levels—from the CEO down to individual contributors. 

Built with a focus on **high information density, cinematic UI, and robust backend architecture**, CoreSync delivers a seamless experience for Employees, Managers, and System Administrators.

### ✨ Key Hackathon Highlights
- **Live Cloud Infrastructure:** Fully integrated with Supabase (PostgreSQL) and Upstash (Redis REST API).
- **Automated Escalation Engine:** Background cron jobs automatically detect overdue submissions/approvals and escalate them up the management chain.
- **Advanced Data Visualization:** Includes an interactive D3.js Organizational Cascade Tree (with zoom/pan) and Recharts-based Analytics Dashboards.
- **Dynamic Scoring Algorithms:** Real-time progress score computation handling 4 different Unit of Measure (UoM) types, complete with momentum velocity indicators.
- **In-Memory Excel Exports:** Generates fully styled, color-coded Excel reports streamed directly to the client without requiring cloud storage.

---

## 🚀 Live Demo & Quick Start

The application is configured to run out-of-the-box with cloud databases. No local database setup is required.

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd "AtomBerg Hackathon(CoreSync)"

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start the Application
You will need two terminal windows:

**Terminal 1: Backend API**
```bash
cd backend
npm run dev
# Starts on http://localhost:4000
```

**Terminal 2: Frontend Dashboard**
```bash
cd frontend
npm run dev
# Starts on http://localhost:5173
```

### 3. Access the Portal
Navigate to **http://localhost:5173** in your browser.

---

## 🔐 Role-Based Access (Demo Credentials)

The database is pre-seeded with demo data for the hackathon evaluation. **Click the "Demo Credentials" buttons on the login page** to automatically fill in these credentials:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Admin** | `admin@align.demo` | `Admin@123` | Cycle management, D3 Cascade View, Analytics, System Escalations, Audit Trail. |
| **Manager** | `manager1@align.demo` | `Manager@123` | Team approvals, goal delegation, check-in reviews, team progress dashboard. |
| **Employee** | `emp1@align.demo` | `Employee@123` | Personal goal sheet, weightage balancing, quarterly check-ins. |

---

## 🏗️ Technical Architecture

### Frontend (React + Vite)
- **State Management:** Zustand (persistent auth & cycle states).
- **Routing:** React Router v6 with strict Role-Based Guards.
- **Styling:** Vanilla CSS + Tailwind CSS (Custom Indigo/Emerald Design System).
- **Visualizations:** D3.js (Hierarchy Trees) & Recharts (Analytics Donuts/Lines).
- **Forms & Validation:** React Hook Form + Zod.
- **Networking:** Axios with automated JWT Refresh Token Interceptors and request queuing.

### Backend (Node.js + Express)
- **Database:** PostgreSQL (Supabase) accessed via `pg` connection pool.
- **Caching & Rate Limiting:** Redis (Upstash HTTP REST API to bypass ISP firewalls).
- **Authentication:** HttpOnly-equivalent JWT implementation with rotating refresh tokens.
- **Security:** Helmet, CORS, parameterized SQL queries, centralized error handling.
- **Background Jobs:** `node-cron` for daily escalation triggers and email reminders.

---

## 📊 Core Features Evaluator Checklist

### Employee Workflows
- [x] **Goal Drafting:** Create goals with live 100% weightage validation.
- [x] **Quarterly Check-ins:** Update progress with real-time score preview.
- [x] **Momentum Tracking:** System automatically flags progress as Accelerating, Stable, or Decelerating.

### Manager Workflows
- [x] **Approval Interface:** Accept or return goals with mandatory rework feedback.
- [x] **Goal Lock-in:** Approved goals are locked and changes are written to an immutable Audit Trail.
- [x] **Team Analytics:** View entire team progress with visual amber/red indicators for lagging goals.

### Administrator Workflows
- [x] **D3.js Cascade View:** Visually explore the entire organization's goal alignment in an interactive tree.
- [x] **Analytics Dashboard:** Recharts dashboards showing QoQ trends, Status Distribution, and Manager Check-in Effectiveness.
- [x] **Escalation Center:** Monitor system-generated escalations (Levels 1, 2, and 3).
- [x] **Audit Trail:** JSON-diff views tracking every CREATE, EDIT, APPROVE, and DELETE action.
- [x] **Excel Reporting:** One-click download of styled `.xlsx` achievement reports.

---

## 📂 Project Structure

```text
CoreSync/
├── backend/
│   ├── src/
│   │   ├── db/          # PostgreSQL schemas, pool config, Upstash Redis client
│   │   ├── middleware/  # JWT Auth, Zod Validation, Rate Limiter
│   │   ├── routes/      # REST API endpoints (Goals, Approvals, Admin, etc.)
│   │   ├── jobs/        # Background Cron jobs (Escalations)
│   │   └── utils/       # Score Computation Engine, ExcelJS Export, Mailer
│   └── .env             # Environment variables
│
└── frontend/
    ├── src/
    │   ├── api/         # Axios interceptors & Token refresh logic
    │   ├── stores/      # Zustand state management
    │   ├── components/  # Reusable UI (Badges, ProgressRings, SlideOvers)
    │   ├── pages/       # Role-specific Views (Admin, Manager, Employee)
    │   └── App.jsx      # Role-based React Router
    └── tailwind.config.js
```

---
<div align="center">
  <i>Designed and Engineered for the AtomBerg 2025 Hackathon</i>
</div>
