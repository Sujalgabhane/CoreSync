-- CoreSync PostgreSQL Schema
-- Run: psql $DATABASE_URL -f schema.sql

-- ─── EXTENSIONS ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uom_type AS ENUM ('MIN', 'MAX', 'TIMELINE', 'ZERO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quarter_enum AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE progress_status_enum AS ENUM ('NOT_STARTED', 'ON_TRACK', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE momentum_enum AS ENUM ('ACCELERATING', 'STABLE', 'DECELERATING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escalation_type AS ENUM ('GOAL_NOT_SUBMITTED', 'GOAL_NOT_APPROVED', 'CHECKIN_OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phase1_open DATE,
  q1_open DATE,
  q2_open DATE,
  q3_open DATE,
  q4_open DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES goal_cycles(id) ON DELETE CASCADE,
  thrust_area VARCHAR(150),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  uom_type uom_type NOT NULL,
  target_value NUMERIC,
  target_date DATE,
  weightage NUMERIC NOT NULL CHECK (weightage >= 10),
  status goal_status DEFAULT 'DRAFT',
  is_shared BOOLEAN DEFAULT false,
  shared_from_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quarterly_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  quarter quarter_enum NOT NULL,
  actual_value NUMERIC,
  actual_date DATE,
  progress_status progress_status_enum,
  progress_score NUMERIC,
  momentum_flag momentum_enum,
  employee_notes TEXT,
  manager_comment TEXT,
  checkin_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(goal_id, quarter)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50),
  entity_id UUID,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  change_type VARCHAR(50),
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type escalation_type,
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  notified_levels INTEGER DEFAULT 1
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_cycle ON goals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_achievements_goal ON quarterly_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_escalations_user ON escalations(user_id);
