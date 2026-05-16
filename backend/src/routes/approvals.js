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

const returnSchema = z.object({ reason: z.string().min(5).max(500) });

// GET /api/approvals/pending — goals awaiting review by this manager
router.get('/pending', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    // Get all employees under this manager
    const teamRes = await pool.query(
      'SELECT id FROM users WHERE manager_id = $1',
      [req.user.id]
    );
    const teamIds = teamRes.rows.map(r => r.id);
    if (teamIds.length === 0) return res.json([]);

    const result = await pool.query(
      `SELECT g.*, u.name AS employee_name, u.email AS employee_email,
              u.department, c.name AS cycle_name
       FROM goals g
       JOIN users u ON u.id = g.employee_id
       JOIN goal_cycles c ON c.id = g.cycle_id
       WHERE g.employee_id = ANY($1::uuid[])
         AND g.status = 'SUBMITTED'
       ORDER BY g.updated_at ASC`,
      [teamIds]
    );

    // Group by employee
    const byEmployee = {};
    result.rows.forEach(goal => {
      if (!byEmployee[goal.employee_id]) {
        byEmployee[goal.employee_id] = {
          employee_id: goal.employee_id,
          employee_name: goal.employee_name,
          employee_email: goal.employee_email,
          department: goal.department,
          goals: [],
        };
      }
      byEmployee[goal.employee_id].goals.push(goal);
    });

    res.json(Object.values(byEmployee));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/approvals/:goalId/approve
router.patch('/:goalId/approve', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query(
      `SELECT g.*, u.manager_id FROM goals g
       JOIN users u ON u.id = g.employee_id
       WHERE g.id = $1`,
      [req.params.goalId]
    );
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });
    if (goal.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Goal is not in SUBMITTED status', code: 'INVALID_STATUS' });
    }

    // Manager can only approve their direct reports' goals
    if (req.user.role === 'manager' && goal.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only approve your team\'s goals', code: 'FORBIDDEN' });
    }

    // Allow manager to update target/weightage before approving
    const { target_value, target_date, weightage } = req.body;
    let updateFields = `status = 'APPROVED', locked_at = NOW(), updated_at = NOW()`;
    const updateParams = [req.params.goalId];

    if (target_value !== undefined) {
      updateParams.push(target_value);
      updateFields += `, target_value = $${updateParams.length}`;
    }
    if (target_date !== undefined) {
      updateParams.push(target_date);
      updateFields += `, target_date = $${updateParams.length}`;
    }
    if (weightage !== undefined) {
      updateParams.push(weightage);
      updateFields += `, weightage = $${updateParams.length}`;
    }

    const result = await client.query(
      `UPDATE goals SET ${updateFields} WHERE id = $1 RETURNING *`,
      updateParams
    );

    await logAudit(client, {
      entityType: 'goal', entityId: goal.id,
      changedBy: req.user.id, changeType: 'APPROVE',
      oldValue: { status: 'SUBMITTED', target_value: goal.target_value, weightage: goal.weightage },
      newValue: { status: 'APPROVED', target_value: result.rows[0].target_value, weightage: result.rows[0].weightage },
    });

    // Resolve GOAL_NOT_APPROVED escalations
    await client.query(
      `UPDATE escalations SET resolved_at = NOW()
       WHERE user_id = $1 AND type = 'GOAL_NOT_APPROVED' AND resolved_at IS NULL`,
      [goal.employee_id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/approvals/:goalId/return — return goal for rework
router.patch('/:goalId/return', authenticateToken, requireRole('manager', 'admin'), validate(returnSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const goalRes = await client.query(
      `SELECT g.*, u.manager_id FROM goals g
       JOIN users u ON u.id = g.employee_id
       WHERE g.id = $1`,
      [req.params.goalId]
    );
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });
    if (goal.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Goal is not in SUBMITTED status', code: 'INVALID_STATUS' });
    }

    if (req.user.role === 'manager' && goal.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const result = await client.query(
      `UPDATE goals SET status = 'RETURNED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.goalId]
    );

    await logAudit(client, {
      entityType: 'goal', entityId: goal.id,
      changedBy: req.user.id, changeType: 'RETURN',
      oldValue: { status: 'SUBMITTED' },
      newValue: { status: 'RETURNED', reason: req.body.reason },
    });

    await client.query('COMMIT');
    res.json({ ...result.rows[0], return_reason: req.body.reason });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
