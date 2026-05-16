require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  console.log('🌱 Seeding CoreSync database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Clear existing seed data ──────────────────────────────────────────
    await client.query(`
      DELETE FROM escalations;
      DELETE FROM audit_logs;
      DELETE FROM quarterly_achievements;
      DELETE FROM goals;
      DELETE FROM goal_cycles;
      DELETE FROM users WHERE email LIKE '%@align.demo';
    `);

    // ── Hash passwords ────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Admin@123', 12);
    const managerHash = await bcrypt.hash('Manager@123', 12);
    const employeeHash = await bcrypt.hash('Employee@123', 12);

    // ── Admin ─────────────────────────────────────────────────────────────
    const adminRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role, department)
      VALUES ('Admin User', 'admin@align.demo', $1, 'admin', 'Administration')
      RETURNING id
    `, [adminHash]);
    const adminId = adminRes.rows[0].id;

    // ── Managers ──────────────────────────────────────────────────────────
    const mgr1Res = await client.query(`
      INSERT INTO users (name, email, password_hash, role, department, manager_id)
      VALUES ('Priya Sharma', 'manager1@align.demo', $1, 'manager', 'Engineering', $2)
      RETURNING id
    `, [managerHash, adminId]);
    const mgr1Id = mgr1Res.rows[0].id;

    const mgr2Res = await client.query(`
      INSERT INTO users (name, email, password_hash, role, department, manager_id)
      VALUES ('Rahul Mehta', 'manager2@align.demo', $1, 'manager', 'Sales', $2)
      RETURNING id
    `, [managerHash, adminId]);
    const mgr2Id = mgr2Res.rows[0].id;

    // ── Employees ─────────────────────────────────────────────────────────
    const empData = [
      { name: 'Ananya Patel',  email: 'emp1@align.demo', dept: 'Engineering', mgr: mgr1Id },
      { name: 'Vikram Singh',  email: 'emp2@align.demo', dept: 'Engineering', mgr: mgr1Id },
      { name: 'Divya Nair',    email: 'emp3@align.demo', dept: 'Engineering', mgr: mgr1Id },
      { name: 'Arjun Kumar',   email: 'emp4@align.demo', dept: 'Sales',       mgr: mgr2Id },
      { name: 'Sneha Reddy',   email: 'emp5@align.demo', dept: 'Sales',       mgr: mgr2Id },
    ];

    const empIds = {};
    for (const emp of empData) {
      const res = await client.query(`
        INSERT INTO users (name, email, password_hash, role, department, manager_id)
        VALUES ($1, $2, $3, 'employee', $4, $5)
        RETURNING id
      `, [emp.name, emp.email, employeeHash, emp.dept, emp.mgr]);
      empIds[emp.email] = res.rows[0].id;
    }

    const emp1Id = empIds['emp1@align.demo'];

    // ── Active Goal Cycle ─────────────────────────────────────────────────
    const cycleRes = await client.query(`
      INSERT INTO goal_cycles (name, phase1_open, q1_open, q2_open, q3_open, q4_open, is_active)
      VALUES ('FY 2025-26', '2025-05-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-03-01', true)
      RETURNING id
    `);
    const cycleId = cycleRes.rows[0].id;

    // ── Goals for emp1 (fully approved, with achievements) ────────────────
    const goals = [
      {
        thrust_area: 'Product Development',
        title: 'Launch CoreSync v2.0 feature set',
        uom_type: 'TIMELINE',
        target_value: null,
        target_date: '2025-09-30',
        weightage: 30,
        description: 'Complete and ship the full CoreSync v2.0 feature set including analytics module',
      },
      {
        thrust_area: 'Performance',
        title: 'Reduce API response time to under 200ms',
        uom_type: 'MAX',
        target_value: 200,
        target_date: null,
        weightage: 20,
        description: 'Optimize all critical API endpoints to respond within 200ms P95',
      },
      {
        thrust_area: 'Quality',
        title: 'Achieve 90% unit test coverage',
        uom_type: 'MIN',
        target_value: 90,
        target_date: null,
        weightage: 20,
        description: 'Increase unit test coverage from current 60% to 90%',
      },
      {
        thrust_area: 'Process',
        title: 'Zero critical production bugs this quarter',
        uom_type: 'ZERO',
        target_value: 0,
        target_date: null,
        weightage: 10,
        description: 'Maintain zero Severity-1 production incidents',
      },
      {
        thrust_area: 'Learning',
        title: 'Complete AWS Solutions Architect certification',
        uom_type: 'TIMELINE',
        target_value: null,
        target_date: '2025-12-31',
        weightage: 20,
        description: 'Obtain AWS SAA-C03 certification by year end',
      },
    ];

    const goalIds = [];
    for (const g of goals) {
      const res = await client.query(`
        INSERT INTO goals (employee_id, cycle_id, thrust_area, title, description, uom_type,
                           target_value, target_date, weightage, status, locked_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', NOW())
        RETURNING id
      `, [emp1Id, cycleId, g.thrust_area, g.title, g.description, g.uom_type,
          g.target_value, g.target_date, g.weightage]);
      goalIds.push(res.rows[0].id);
    }

    // ── Quarterly Achievements for emp1 ───────────────────────────────────
    // Goal 0: TIMELINE (on track)
    await client.query(`
      INSERT INTO quarterly_achievements (goal_id, quarter, actual_date, progress_status, progress_score, momentum_flag, checkin_completed_at)
      VALUES ($1, 'Q1', '2025-09-15', 'ON_TRACK', 1.0, 'STABLE', NOW()),
             ($1, 'Q2', '2025-09-28', 'ON_TRACK', 1.0, 'STABLE', NOW())
    `, [goalIds[0]]);

    // Goal 1: MAX (actual < target = better)
    await client.query(`
      INSERT INTO quarterly_achievements (goal_id, quarter, actual_value, progress_status, progress_score, momentum_flag, checkin_completed_at)
      VALUES ($1, 'Q1', 250, 'ON_TRACK', 0.8, 'STABLE', NOW()),
             ($1, 'Q2', 185, 'ON_TRACK', 1.0, 'ACCELERATING', NOW())
    `, [goalIds[1]]);

    // Goal 2: MIN (actual >= target = better)
    await client.query(`
      INSERT INTO quarterly_achievements (goal_id, quarter, actual_value, progress_status, progress_score, momentum_flag, checkin_completed_at)
      VALUES ($1, 'Q1', 70, 'ON_TRACK', 0.78, 'STABLE', NOW()),
             ($1, 'Q2', 85, 'ON_TRACK', 0.94, 'ACCELERATING', NOW())
    `, [goalIds[2]]);

    // Goal 3: ZERO (0 bugs in Q1, 0 in Q2)
    await client.query(`
      INSERT INTO quarterly_achievements (goal_id, quarter, actual_value, progress_status, progress_score, momentum_flag, checkin_completed_at)
      VALUES ($1, 'Q1', 0, 'COMPLETED', 1.0, 'STABLE', NOW()),
             ($1, 'Q2', 0, 'COMPLETED', 1.0, 'STABLE', NOW())
    `, [goalIds[3]]);

    // Goal 4: TIMELINE (learning cert)
    await client.query(`
      INSERT INTO quarterly_achievements (goal_id, quarter, actual_date, progress_status, progress_score, momentum_flag, checkin_completed_at)
      VALUES ($1, 'Q1', NULL, 'NOT_STARTED', 0.0, 'STABLE', NOW()),
             ($1, 'Q2', NULL, 'ON_TRACK', 0.5, 'ACCELERATING', NOW())
    `, [goalIds[4]]);

    // ── Draft goals for emp2 (not yet submitted) ──────────────────────────
    const emp2Id = empIds['emp2@align.demo'];
    await client.query(`
      INSERT INTO goals (employee_id, cycle_id, thrust_area, title, uom_type, target_value, weightage, status)
      VALUES ($1, $2, 'Engineering', 'Build CI/CD pipeline', 'TIMELINE', NULL, 40, 'DRAFT'),
             ($1, $2, 'Quality', 'Reduce bug count by 50%', 'MAX', 50, 30, 'SUBMITTED'),
             ($1, $2, 'Learning', 'Complete Docker training', 'TIMELINE', NULL, 30, 'SUBMITTED')
    `, [emp2Id, cycleId]);

    await client.query('COMMIT');
    console.log('✅ Seed complete!');
    console.log('');
    console.log('Demo credentials:');
    console.log('  Admin:    admin@align.demo    / Admin@123');
    console.log('  Manager:  manager1@align.demo / Manager@123');
    console.log('  Employee: emp1@align.demo     / Employee@123');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
