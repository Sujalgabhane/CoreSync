const cron = require('node-cron');
const pool = require('../db/pool');
const { sendGoalReminderEmail } = require('../utils/mailer');

/**
 * Escalation Engine — Runs daily at 08:00 server time.
 * Implements all 3 escalation checks from Section 7 of the spec.
 */

async function runEscalationChecks() {
  console.log(`🔔 [${new Date().toISOString()}] Running escalation checks...`);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cycleRes = await client.query('SELECT * FROM goal_cycles WHERE is_active = true LIMIT 1');
    const cycle = cycleRes.rows[0];
    if (!cycle) {
      console.log('   No active cycle — skipping escalations');
      await client.query('ROLLBACK');
      return;
    }

    const now = new Date();

    // ── Check 1: Goal Not Submitted ─────────────────────────────────────
    if (cycle.phase1_open) {
      const phase1Date = new Date(cycle.phase1_open);
      const daysSinceOpen = Math.floor((now - phase1Date) / (1000 * 60 * 60 * 24));

      if (daysSinceOpen >= 7) {
        // Employees who have no submitted goals
        const empRes = await client.query(`
          SELECT u.id, u.name, u.email,
                 m.id AS manager_id, m.name AS manager_name, m.email AS manager_email
          FROM users u
          LEFT JOIN users m ON m.id = u.manager_id
          WHERE u.role = 'employee'
          AND u.id NOT IN (
            SELECT DISTINCT employee_id FROM goals
            WHERE cycle_id = $1 AND status IN ('SUBMITTED','UNDER_REVIEW','APPROVED')
          )
        `, [cycle.id]);

        for (const emp of empRes.rows) {
          const level = daysSinceOpen >= 21 ? 3 : daysSinceOpen >= 14 ? 2 : 1;

          // Log escalation
          await client.query(`
            INSERT INTO escalations (user_id, type, notified_levels)
            VALUES ($1, 'GOAL_NOT_SUBMITTED', $2)
          `, [emp.id, level]);

          // Send emails based on level
          if (level >= 1) {
            await sendGoalReminderEmail({ to: emp.email, name: emp.name, type: 'GOAL_NOT_SUBMITTED', daysOverdue: daysSinceOpen });
          }
          if (level >= 2 && emp.manager_email) {
            await sendGoalReminderEmail({ to: emp.manager_email, name: emp.manager_name, type: 'GOAL_NOT_SUBMITTED', daysOverdue: daysSinceOpen });
          }
          // Level 3: notify HR/Admin
          if (level >= 3) {
            const adminRes = await client.query("SELECT email, name FROM users WHERE role = 'admin' LIMIT 1");
            if (adminRes.rows[0]) {
              await sendGoalReminderEmail({ to: adminRes.rows[0].email, name: adminRes.rows[0].name, type: 'GOAL_NOT_SUBMITTED', daysOverdue: daysSinceOpen });
            }
          }
        }

        console.log(`   Check 1 (Goal Not Submitted): ${empRes.rows.length} employees, day ${daysSinceOpen}`);
      }
    }

    // ── Check 2: Goal Not Approved ──────────────────────────────────────
    const pendingGoalsRes = await client.query(`
      SELECT g.employee_id, g.updated_at,
             u.name AS emp_name, u.email AS emp_email,
             m.id AS manager_id, m.name AS mgr_name, m.email AS mgr_email
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      LEFT JOIN users m ON m.id = u.manager_id
      WHERE g.status = 'SUBMITTED' AND g.cycle_id = $1
      GROUP BY g.employee_id, g.updated_at, u.name, u.email, m.id, m.name, m.email
      HAVING MIN(g.updated_at) < NOW() - INTERVAL '5 days'
    `, [cycle.id]);

    for (const row of pendingGoalsRes.rows) {
      const daysPending = Math.floor((now - new Date(row.updated_at)) / (1000 * 60 * 60 * 24));
      const level = daysPending >= 10 ? 2 : 1;

      await client.query(`
        INSERT INTO escalations (user_id, type, notified_levels)
        VALUES ($1, 'GOAL_NOT_APPROVED', $2)
      `, [row.manager_id || row.employee_id, level]);

      if (row.mgr_email) {
        await sendGoalReminderEmail({ to: row.mgr_email, name: row.mgr_name, type: 'GOAL_NOT_APPROVED', daysOverdue: daysPending });
      }
      if (level >= 2) {
        const adminRes = await client.query("SELECT email, name FROM users WHERE role = 'admin' LIMIT 1");
        if (adminRes.rows[0]) {
          await sendGoalReminderEmail({ to: adminRes.rows[0].email, name: adminRes.rows[0].name, type: 'GOAL_NOT_APPROVED', daysOverdue: daysPending });
        }
      }
    }

    console.log(`   Check 2 (Goal Not Approved): ${pendingGoalsRes.rows.length} managers`);

    // ── Check 3: Check-in Overdue ────────────────────────────────────────
    const quarters = [
      { name: 'Q1', open: cycle.q1_open },
      { name: 'Q2', open: cycle.q2_open },
      { name: 'Q3', open: cycle.q3_open },
      { name: 'Q4', open: cycle.q4_open },
    ];

    for (const q of quarters) {
      if (!q.open) continue;
      const qDate = new Date(q.open);
      if (now < qDate) continue; // Window not open yet

      const daysIntoWindow = Math.floor((now - qDate) / (1000 * 60 * 60 * 24));
      if (daysIntoWindow < 10) continue; // Only escalate after 10 days

      // Employees with approved goals but no check-in for this quarter
      const overdueRes = await client.query(`
        SELECT DISTINCT u.id, u.name, u.email,
               m.id AS manager_id, m.name AS mgr_name, m.email AS mgr_email
        FROM goals g
        JOIN users u ON u.id = g.employee_id
        LEFT JOIN users m ON m.id = u.manager_id
        WHERE g.status = 'APPROVED' AND g.cycle_id = $1
        AND g.id NOT IN (
          SELECT goal_id FROM quarterly_achievements WHERE quarter = $2
          AND checkin_completed_at IS NOT NULL
        )
      `, [cycle.id, q.name]);

      for (const emp of overdueRes.rows) {
        const level = daysIntoWindow >= 24 ? 3 : daysIntoWindow >= 17 ? 2 : 1;

        // Check if already escalated at this level today
        const existing = await client.query(`
          SELECT id FROM escalations
          WHERE user_id = $1 AND type = 'CHECKIN_OVERDUE'
          AND triggered_at > NOW() - INTERVAL '6 hours'
          AND resolved_at IS NULL
        `, [emp.id]);

        if (existing.rows.length > 0) continue;

        await client.query(`
          INSERT INTO escalations (user_id, type, notified_levels)
          VALUES ($1, 'CHECKIN_OVERDUE', $2)
        `, [emp.id, level]);

        if (level >= 1) await sendGoalReminderEmail({ to: emp.email, name: emp.name, type: 'CHECKIN_OVERDUE', daysOverdue: daysIntoWindow });
        if (level >= 2 && emp.mgr_email) await sendGoalReminderEmail({ to: emp.mgr_email, name: emp.mgr_name, type: 'CHECKIN_OVERDUE', daysOverdue: daysIntoWindow });
        if (level >= 3) {
          const adminRes = await client.query("SELECT email, name FROM users WHERE role = 'admin' LIMIT 1");
          if (adminRes.rows[0]) await sendGoalReminderEmail({ to: adminRes.rows[0].email, name: adminRes.rows[0].name, type: 'CHECKIN_OVERDUE', daysOverdue: daysIntoWindow });
        }
      }

      console.log(`   Check 3 (${q.name} Check-in Overdue): ${overdueRes.rows.length} employees, day ${daysIntoWindow}`);
    }

    await client.query('COMMIT');
    console.log('✅ Escalation checks complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Escalation check failed:', err.message);
  } finally {
    client.release();
  }
}

function startEscalationCron() {
  // Run daily at 08:00
  cron.schedule('0 8 * * *', runEscalationChecks, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  console.log('⏰ Escalation cron scheduled (daily 08:00 IST)');
}

module.exports = { startEscalationCron, runEscalationChecks };
