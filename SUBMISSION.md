# CoreSync — Hackathon Submission Details

## 1. Live Hosted Demo URL
**[Insert Your Vercel URL Here]** *(e.g., https://coresync.vercel.app)*

## 2. Source Code Repository
**[https://github.com/Sujalgabhane/CoreSync](https://github.com/Sujalgabhane/CoreSync)**

## 3. Architecture Diagram
*(You can view this diagram on GitHub, or copy the code block below into [Mermaid Live Editor](https://mermaid.live/) to instantly download it as a PNG or PDF!)*

```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#38bdf8,stroke:#0284c7,stroke-width:2px,color:#fff,font-weight:bold
    classDef backend fill:#22c55e,stroke:#166534,stroke-width:2px,color:#fff,font-weight:bold
    classDef database fill:#6366f1,stroke:#4338ca,stroke-width:2px,color:#fff,font-weight:bold
    classDef cache fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff,font-weight:bold
    classDef external fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff,font-weight:bold
    classDef worker fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff,font-weight:bold

    %% Nodes
    User(("🧑‍💼 Users\n(Admin/Manager/Employee)"))
    
    subgraph "Frontend Layer (Vercel)"
        UI["React 18 + Vite UI"]:::frontend
        State["Zustand (State Management)"]:::frontend
        Charts["D3.js & Recharts (Data Viz)"]:::frontend
    end

    subgraph "Backend Layer (Render Web Service)"
        API["Node.js + Express API"]:::backend
        Auth["JWT Auth Middleware"]:::backend
        Validator["Zod Validation"]:::backend
        Cron["Node-Cron (Escalation Engine)"]:::worker
        Export["ExcelJS (In-Memory Stream)"]:::backend
    end

    subgraph "Data Layer (Cloud)"
        DB[("Supabase\n(PostgreSQL)")]:::database
        Redis[("Upstash Redis\n(REST API)")]:::cache
    end

    SMTP["Gmail SMTP\n(Nodemailer)"]:::external

    %% Relationships
    User -- "HTTPS / JWT" --> UI
    UI <--> State
    UI <--> Charts
    UI -- "REST API Calls" --> Auth
    Auth --> Validator
    Validator --> API
    
    API -- "pg pool (Port 6543)" --> DB
    API -- "HTTP REST" --> Redis
    
    Cron -- "Triggers Daily" --> API
    Cron -- "Escalation Alerts" --> SMTP
    
    API -- "Download Reports" --> UI
```

## 4. Role-Based Login Credentials
*Our login page features "Demo Credentials" buttons that automatically fill these in so you don't have to type them!*

| Role | Email | Password | What to evaluate |
|------|-------|----------|------------------|
| **Admin** | `admin@align.demo` | `Admin@123` | D3.js Cascade Tree, Analytics Charts, Escalation Logs, Audit Trail, Excel Export |
| **Manager** | `manager1@align.demo` | `Manager@123` | Approving/Returning goals, Team Momentum Dashboard, Check-in Reviews |
| **Employee** | `emp1@align.demo` | `Employee@123` | Creating goals, live 100% weightage validation, logging quarterly achievements |
