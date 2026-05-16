const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

async function logAudit(client, { entityType, entityId, changedBy, changeType, oldValue, newValue }) {
  await client.query(
    `INSERT INTO audit_logs (entity_type, entity_id, changed_by, change_type, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, changedBy, changeType, JSON.stringify(oldValue), JSON.stringify(newValue)]
  );
}

const cycleSchema = z.object({
  name: z.string().min(1).max(100),
  phase1_open: z.string().optional(),
  q1_open: z.string().optional(),
  q2_open: z.string().optional(),
  q3_open: z.string().optional(),
  q4_open: z.string().optional(),
  is_active: z.boolean().optional(),
});

// ── Cycles ─────────────────────────────────────────────────────────────────

// POST /api/admin/cycles
router.post('/cycles', authenticateToken, requireRole('admin'), validate(cycleSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { name, phase1_open, q1_open, q2_open, q3_open, q4_open, is_active } = req.body;

    // If setting this cycle active, deactivate others
    if (is_active) {
      await client.query('UPDATE goal_cycles SET is_active = false');
    }

    const result = await client.query(
      `INSERT INTO goal_cycles (name, phase1_open, q1_open, q2_open, q3_open, q4_open, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phase1_open || null, q1_open || null, q2_open || null,
       q3_open || null, q4_open || null, is_active || false]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/admin/cycles
router.get('/cycles', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM goal_cycles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/cycles/:id
router.patch('/cycles/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT * FROM goal_cycles WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });

    const { name, phase1_open, q1_open, q2_open, q3_open, q4_open, is_active } = req.body;

    if (is_active) {
      await client.query('UPDATE goal_cycles SET is_active = false WHERE id != $1', [req.params.id]);
    }

    const result = await client.query(
      `UPDATE goal_cycles SET
         name = COALESCE($1, name),
         phase1_open = COALESCE($2, phase1_open),
         q1_open = COALESCE($3, q1_open),
         q2_open = COALESCE($4, q2_open),
         q3_open = COALESCE($5, q3_open),
         q4_open = COALESCE($6, q4_open),
         is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *`,
      [name, phase1_open, q1_open, q2_open, q3_open, q4_open, is_active, req.params.id]
    );

    await logAudit(client, {
      entityType: 'cycle', entityId: req.params.id,
      changedBy: req.user.id, changeType: 'EDIT',
      oldValue: current.rows[0], newValue: result.rows[0],
    });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── Goal Unlock ─────────────────────────────────────────────────────────────

// POST /api/admin/goals/:id/unlock
router.post('/goals/:id/unlock', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [req.params.id]);
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });

    const result = await client.query(
      `UPDATE goals SET status = 'DRAFT', locked_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit(client, {
      entityType: 'goal', entityId: goal.id,
      changedBy: req.user.id, changeType: 'UNLOCK',
      oldValue: { status: goal.status, locked_at: goal.locked_at },
      newValue: { status: 'DRAFT', locked_at: null, unlock_reason: req.body.reason },
    });

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── Audit Logs ──────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { entity_type, user_id, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT al.*, u.name AS changed_by_name, u.email AS changed_by_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.changed_by
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) { params.push(entity_type); query += ` AND al.entity_type = $${params.length}`; }
    if (user_id)     { params.push(user_id);     query += ` AND al.changed_by = $${params.length}`; }
    if (from_date)   { params.push(from_date);   query += ` AND al.changed_at >= $${params.length}`; }
    if (to_date)     { params.push(to_date);     query += ` AND al.changed_at <= $${params.length}`; }

    const countRes = await pool.query(
      query.replace('SELECT al.*, u.name AS changed_by_name, u.email AS changed_by_email', 'SELECT COUNT(*)'),
      params
    );

    params.push(parseInt(limit));
    params.push(offset);
    query += ` ORDER BY al.changed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({
      data: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
});

// ── Escalations ─────────────────────────────────────────────────────────────

// GET /api/admin/escalations
router.get('/escalations', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { resolved, type } = req.query;

    let query = `
      SELECT e.*, u.name AS user_name, u.email AS user_email, u.department
      FROM escalations e
      JOIN users u ON u.id = e.user_id
      WHERE 1=1
    `;
    const params = [];

    if (resolved === 'false') { query += ' AND e.resolved_at IS NULL'; }
    if (resolved === 'true')  { query += ' AND e.resolved_at IS NOT NULL'; }
    if (type) { params.push(type); query += ` AND e.type = $${params.length}`; }

    query += ' ORDER BY e.triggered_at DESC LIMIT 200';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/escalations/:id/resolve
router.patch('/escalations/:id/resolve', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE escalations SET resolved_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Escalation not found', code: 'NOT_FOUND' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Admin Dashboard Stats ───────────────────────────────────────────────────

router.get('/dashboard-stats', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const cycleRes = await pool.query('SELECT * FROM goal_cycles WHERE is_active = true LIMIT 1');
    const cycle = cycleRes.rows[0];
    if (!cycle) return res.json({});

    const [employeeCount, submittedCount, approvedCount, escalationCount] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'employee'"),
      pool.query("SELECT COUNT(DISTINCT employee_id) FROM goals WHERE cycle_id = $1 AND status IN ('SUBMITTED','UNDER_REVIEW','APPROVED')", [cycle.id]),
      pool.query("SELECT COUNT(DISTINCT employee_id) FROM goals WHERE cycle_id = $1 AND status = 'APPROVED'", [cycle.id]),
      pool.query("SELECT COUNT(*) FROM escalations WHERE resolved_at IS NULL"),
    ]);

    // Department-level completion heatmap
    const heatmapRes = await pool.query(`
      SELECT u.department, qa.quarter,
             COUNT(DISTINCT u.id) AS total_employees,
             COUNT(DISTINCT qa.goal_id) FILTER (WHERE qa.checkin_completed_at IS NOT NULL) AS completed
      FROM users u
      JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $1 AND g.status = 'APPROVED'
      LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
      WHERE u.role = 'employee'
      GROUP BY u.department, qa.quarter
      ORDER BY u.department, qa.quarter
    `, [cycle.id]);

    res.json({
      cycle,
      employees: parseInt(employeeCount.rows[0].count),
      submitted: parseInt(submittedCount.rows[0].count),
      approved: parseInt(approvedCount.rows[0].count),
      activeEscalations: parseInt(escalationCount.rows[0].count),
      heatmap: heatmapRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
