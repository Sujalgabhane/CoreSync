const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const goalSchema = z.object({
  thrust_area: z.string().min(1).max(150),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  uom_type: z.enum(['MIN', 'MAX', 'TIMELINE', 'ZERO']),
  target_value: z.number().nullable().optional(),
  target_date: z.string().nullable().optional(),
  weightage: z.number().min(10).max(100),
  cycle_id: z.string().uuid().optional(),
});

const sharedGoalSchema = z.object({
  goal_id: z.string().uuid(),
  employee_ids: z.array(z.string().uuid()).min(1),
});

// ── Helper: get active cycle ─────────────────────────────────────────────────
async function getActiveCycle(client) {
  const res = await client.query(
    'SELECT * FROM goal_cycles WHERE is_active = true LIMIT 1'
  );
  return res.rows[0] || null;
}

// ── Helper: log audit entry ──────────────────────────────────────────────────
async function logAudit(client, { entityType, entityId, changedBy, changeType, oldValue, newValue }) {
  await client.query(
    `INSERT INTO audit_logs (entity_type, entity_id, changed_by, change_type, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, changedBy, changeType, JSON.stringify(oldValue), JSON.stringify(newValue)]
  );
}

// GET /api/goals — list goals for current user (or employee_id if manager/admin)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { employee_id, cycle_id, status } = req.query;

    let targetId = req.user.id;
    if ((req.user.role === 'manager' || req.user.role === 'admin') && employee_id) {
      targetId = employee_id;
    }

    let query = `
      SELECT g.*, u.name AS employee_name, u.department,
             sg.title AS shared_from_title
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      LEFT JOIN goals sg ON sg.id = g.shared_from_goal_id
      WHERE g.employee_id = $1
    `;
    const params = [targetId];

    if (cycle_id) { params.push(cycle_id); query += ` AND g.cycle_id = $${params.length}`; }
    if (status)   { params.push(status);   query += ` AND g.status = $${params.length}`; }
    query += ' ORDER BY g.created_at ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/goals/:id
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.name AS employee_name, u.email AS employee_email, u.department,
              c.name AS cycle_name
       FROM goals g
       JOIN users u ON u.id = g.employee_id
       JOIN goal_cycles c ON c.id = g.cycle_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    const goal = result.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });

    // Employees can only view their own goals
    if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    res.json(goal);
  } catch (err) {
    next(err);
  }
});

// POST /api/goals — create goal
router.post('/', authenticateToken, validate(goalSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cycle = await getActiveCycle(client);
    if (!cycle) {
      return res.status(400).json({ error: 'No active goal cycle', code: 'NO_ACTIVE_CYCLE' });
    }

    // Count existing goals
    const countRes = await client.query(
      'SELECT COUNT(*) FROM goals WHERE employee_id = $1 AND cycle_id = $2',
      [req.user.id, cycle.id]
    );
    if (parseInt(countRes.rows[0].count) >= 8) {
      return res.status(400).json({ error: 'Maximum 8 goals allowed per cycle', code: 'MAX_GOALS_REACHED' });
    }

    const { thrust_area, title, description, uom_type, target_value, target_date, weightage } = req.body;

    const result = await client.query(
      `INSERT INTO goals (employee_id, cycle_id, thrust_area, title, description, uom_type,
                          target_value, target_date, weightage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, cycle.id, thrust_area, title, description, uom_type,
       target_value || null, target_date || null, weightage]
    );

    await logAudit(client, {
      entityType: 'goal', entityId: result.rows[0].id,
      changedBy: req.user.id, changeType: 'CREATE',
      oldValue: null, newValue: result.rows[0],
    });

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/goals/:id — update goal (only DRAFT or RETURNED status)
router.patch('/:id', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [req.params.id]);
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });

    // Only owner can edit, and only when DRAFT or RETURNED
    if (goal.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (!['DRAFT', 'RETURNED'].includes(goal.status)) {
      return res.status(400).json({ error: 'Goal can only be edited when in DRAFT or RETURNED status', code: 'GOAL_LOCKED' });
    }

    // Shared goal: can only edit weightage
    const { thrust_area, title, description, uom_type, target_value, target_date, weightage } = req.body;
    let updates, values;

    if (goal.is_shared) {
      updates = 'weightage = $1, updated_at = NOW()';
      values = [weightage, req.params.id];
    } else {
      updates = `thrust_area = $1, title = $2, description = $3, uom_type = $4,
                 target_value = $5, target_date = $6, weightage = $7, updated_at = NOW()`;
      values = [thrust_area, title, description, uom_type, target_value || null, target_date || null, weightage, req.params.id];
    }

    const result = await client.query(
      `UPDATE goals SET ${updates} WHERE id = $${values.length} RETURNING *`,
      values
    );

    await logAudit(client, {
      entityType: 'goal', entityId: goal.id,
      changedBy: req.user.id, changeType: 'EDIT',
      oldValue: goal, newValue: result.rows[0],
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

// DELETE /api/goals/:id — delete goal (only DRAFT)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query('SELECT * FROM goals WHERE id = $1', [req.params.id]);
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });
    if (goal.employee_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    if (goal.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT goals can be deleted', code: 'GOAL_NOT_DRAFT' });

    await client.query('DELETE FROM goals WHERE id = $1', [req.params.id]);
    await logAudit(client, {
      entityType: 'goal', entityId: goal.id,
      changedBy: req.user.id, changeType: 'DELETE',
      oldValue: goal, newValue: null,
    });

    await client.query('COMMIT');
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/goals/submit — submit all DRAFT goals for approval
router.post('/submit', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cycle = await getActiveCycle(client);
    if (!cycle) return res.status(400).json({ error: 'No active cycle', code: 'NO_ACTIVE_CYCLE' });

    const goalsRes = await client.query(
      `SELECT * FROM goals WHERE employee_id = $1 AND cycle_id = $2 AND status IN ('DRAFT', 'RETURNED')`,
      [req.user.id, cycle.id]
    );
    const goals = goalsRes.rows;

    // Validation
    if (goals.length === 0) return res.status(400).json({ error: 'No goals to submit', code: 'NO_GOALS' });
    if (goals.length > 8)   return res.status(400).json({ error: 'Maximum 8 goals allowed', code: 'TOO_MANY_GOALS' });

    const totalWeightage = goals.reduce((sum, g) => sum + parseFloat(g.weightage), 0);
    if (Math.abs(totalWeightage - 100) > 0.01) {
      return res.status(400).json({
        error: `Total weightage must be exactly 100%. Current total: ${totalWeightage}%`,
        code: 'WEIGHTAGE_INVALID',
      });
    }

    // Update all to SUBMITTED
    for (const goal of goals) {
      await client.query(
        `UPDATE goals SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1`,
        [goal.id]
      );
      await logAudit(client, {
        entityType: 'goal', entityId: goal.id,
        changedBy: req.user.id, changeType: 'SUBMIT',
        oldValue: { status: goal.status }, newValue: { status: 'SUBMITTED' },
      });
    }

    // Resolve any GOAL_NOT_SUBMITTED escalations for this user
    await client.query(
      `UPDATE escalations SET resolved_at = NOW()
       WHERE user_id = $1 AND type = 'GOAL_NOT_SUBMITTED' AND resolved_at IS NULL`,
      [req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: `${goals.length} goals submitted for approval` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/goals/shared — admin/manager pushes shared goal to employees
router.post('/shared', authenticateToken, requireRole('admin', 'manager'), validate(sharedGoalSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { goal_id, employee_ids } = req.body;
    const sourceRes = await client.query('SELECT * FROM goals WHERE id = $1', [goal_id]);
    const source = sourceRes.rows[0];
    if (!source) return res.status(404).json({ error: 'Source goal not found', code: 'NOT_FOUND' });

    const cycle = await getActiveCycle(client);
    const created = [];

    for (const empId of employee_ids) {
      const result = await client.query(
        `INSERT INTO goals (employee_id, cycle_id, thrust_area, title, description, uom_type,
                            target_value, target_date, weightage, is_shared, shared_from_goal_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10, true, $9)
         RETURNING *`,
        [empId, cycle.id, source.thrust_area, source.title, source.description,
         source.uom_type, source.target_value, source.target_date, goal_id]
      );
      created.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: `Shared goal pushed to ${created.length} employees`, goals: created });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
