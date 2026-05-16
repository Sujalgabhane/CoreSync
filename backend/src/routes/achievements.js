const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { computeProgressScore, computeMomentum } = require('../utils/scoreEngine');

const router = express.Router();

const achievementSchema = z.object({
  goal_id: z.string().uuid(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  actual_value: z.number().nullable().optional(),
  actual_date: z.string().nullable().optional(),
  progress_status: z.enum(['NOT_STARTED', 'ON_TRACK', 'COMPLETED']),
  employee_notes: z.string().optional(),
});

// GET /api/achievements/:goalId — all quarters for a goal
router.get('/:goalId', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quarterly_achievements
       WHERE goal_id = $1 ORDER BY quarter ASC`,
      [req.params.goalId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/achievements — employee logs quarterly actual
router.post('/', authenticateToken, validate(achievementSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { goal_id, quarter, actual_value, actual_date, progress_status, employee_notes } = req.body;

    // Verify goal is APPROVED and belongs to this employee
    const goalRes = await client.query(
      'SELECT * FROM goals WHERE id = $1',
      [goal_id]
    );
    const goal = goalRes.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' });
    if (goal.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    if (goal.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Can only log achievement for APPROVED goals', code: 'GOAL_NOT_APPROVED' });
    }

    // Verify active cycle and check-in window
    const cycleRes = await client.query('SELECT * FROM goal_cycles WHERE id = $1', [goal.cycle_id]);
    const cycle = cycleRes.rows[0];
    const now = new Date();

    const windowOpen = {
      Q1: cycle.q1_open,
      Q2: cycle.q2_open,
      Q3: cycle.q3_open,
      Q4: cycle.q4_open,
    }[quarter];

    if (!windowOpen || now < new Date(windowOpen)) {
      return res.status(400).json({
        error: `${quarter} check-in window is not open yet`,
        code: 'CHECKIN_WINDOW_CLOSED',
      });
    }

    // Get previous quarter score for momentum calculation
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const prevQuarter = quarters[quarters.indexOf(quarter) - 1];
    let previousScore = null;

    if (prevQuarter) {
      const prevRes = await client.query(
        'SELECT progress_score FROM quarterly_achievements WHERE goal_id = $1 AND quarter = $2',
        [goal_id, prevQuarter]
      );
      if (prevRes.rows[0]) previousScore = parseFloat(prevRes.rows[0].progress_score);
    }

    // Compute score
    const score = computeProgressScore({
      uomType: goal.uom_type,
      actualValue: actual_value,
      targetValue: goal.target_value,
      actualDate: actual_date,
      targetDate: goal.target_date,
    });

    const momentum = computeMomentum(score, previousScore);

    // Upsert achievement
    const result = await client.query(
      `INSERT INTO quarterly_achievements
         (goal_id, quarter, actual_value, actual_date, progress_status,
          progress_score, momentum_flag, employee_notes, checkin_completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (goal_id, quarter)
       DO UPDATE SET
         actual_value = EXCLUDED.actual_value,
         actual_date = EXCLUDED.actual_date,
         progress_status = EXCLUDED.progress_status,
         progress_score = EXCLUDED.progress_score,
         momentum_flag = EXCLUDED.momentum_flag,
         employee_notes = EXCLUDED.employee_notes,
         checkin_completed_at = NOW()
       RETURNING *`,
      [goal_id, quarter, actual_value || null, actual_date || null,
       progress_status, score, momentum, employee_notes || null]
    );

    // If this is a shared goal, sync actual to all linked instances
    if (goal.shared_from_goal_id || !goal.is_shared) {
      // Find all shared copies of this goal (or the original)
      const sourceId = goal.shared_from_goal_id || goal.id;
      const linkedRes = await client.query(
        'SELECT id FROM goals WHERE shared_from_goal_id = $1 AND id != $2',
        [sourceId, goal_id]
      );

      for (const linked of linkedRes.rows) {
        await client.query(
          `INSERT INTO quarterly_achievements
             (goal_id, quarter, actual_value, actual_date, progress_status,
              progress_score, momentum_flag, checkin_completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (goal_id, quarter)
           DO UPDATE SET
             actual_value = EXCLUDED.actual_value,
             actual_date = EXCLUDED.actual_date,
             progress_score = EXCLUDED.progress_score,
             checkin_completed_at = NOW()`,
          [linked.id, quarter, actual_value || null, actual_date || null,
           progress_status, score, momentum]
        );
      }
    }

    // Resolve CHECKIN_OVERDUE escalations
    await client.query(
      `UPDATE escalations SET resolved_at = NOW()
       WHERE user_id = $1 AND type = 'CHECKIN_OVERDUE' AND resolved_at IS NULL`,
      [req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...result.rows[0], computed_score: score, momentum });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/achievements/:id/comment — manager adds check-in comment
router.patch('/:id/comment', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment is required', code: 'COMMENT_REQUIRED' });
    }

    const result = await pool.query(
      `UPDATE quarterly_achievements SET manager_comment = $1 WHERE id = $2 RETURNING *`,
      [comment.trim(), req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Achievement not found', code: 'NOT_FOUND' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
