const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { streamAchievementReport } = require('../utils/excelExport');

const router = express.Router();

// GET /api/reports/achievement
router.get('/achievement', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { cycle_id, department, quarter, employee_id } = req.query;

    let query = `
      SELECT
        u.name AS employee_name, u.email, u.department,
        m.name AS manager_name,
        g.thrust_area, g.title, g.uom_type, g.target_value, g.target_date,
        g.weightage, g.status AS goal_status, g.is_shared,
        qa.quarter, qa.actual_value, qa.actual_date,
        qa.progress_status, qa.progress_score, qa.momentum_flag,
        qa.employee_notes, qa.manager_comment, qa.checkin_completed_at,
        c.name AS cycle_name
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      LEFT JOIN users m ON m.id = u.manager_id
      JOIN goal_cycles c ON c.id = g.cycle_id
      LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
      WHERE g.status = 'APPROVED'
    `;
    const params = [];

    if (cycle_id)    { params.push(cycle_id);    query += ` AND g.cycle_id = $${params.length}`; }
    if (department)  { params.push(department);  query += ` AND u.department = $${params.length}`; }
    if (quarter)     { params.push(quarter);     query += ` AND qa.quarter = $${params.length}`; }
    if (employee_id) { params.push(employee_id); query += ` AND g.employee_id = $${params.length}`; }

    // For managers, restrict to their team
    if (req.user.role === 'manager') {
      const teamRes = await pool.query(
        'SELECT id FROM users WHERE manager_id = $1',
        [req.user.id]
      );
      const teamIds = teamRes.rows.map(r => r.id);
      if (teamIds.length === 0) return res.json([]);
      params.push(teamIds);
      query += ` AND g.employee_id = ANY($${params.length}::uuid[])`;
    }

    query += ' ORDER BY u.name, g.thrust_area, qa.quarter';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/completion — which employees completed check-ins this quarter
router.get('/completion', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { quarter, department, cycle_id } = req.query;

    // Default to active cycle
    let activeCycleId = cycle_id;
    if (!activeCycleId) {
      const cycleRes = await pool.query('SELECT id FROM goal_cycles WHERE is_active = true LIMIT 1');
      activeCycleId = cycleRes.rows[0]?.id;
    }

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.email, u.department,
        m.name AS manager_name,
        COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'APPROVED') AS approved_goals,
        COUNT(DISTINCT qa.goal_id) FILTER (WHERE qa.quarter = $1 AND qa.checkin_completed_at IS NOT NULL) AS checkins_done,
        CASE
          WHEN COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'APPROVED') = 0 THEN 'NO_GOALS'
          WHEN COUNT(DISTINCT qa.goal_id) FILTER (WHERE qa.quarter = $1 AND qa.checkin_completed_at IS NOT NULL)
               >= COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'APPROVED') THEN 'COMPLETED'
          WHEN COUNT(DISTINCT qa.goal_id) FILTER (WHERE qa.quarter = $1 AND qa.checkin_completed_at IS NOT NULL) > 0 THEN 'PARTIAL'
          ELSE 'PENDING'
        END AS completion_status
       FROM users u
       LEFT JOIN users m ON m.id = u.manager_id
       LEFT JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $2
       LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
       WHERE u.role = 'employee'
       ${department ? `AND u.department = $3` : ''}
       GROUP BY u.id, u.name, u.email, u.department, m.name
       ORDER BY u.name`,
      department ? [quarter || 'Q1', activeCycleId, department] : [quarter || 'Q1', activeCycleId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/export — streams Excel
router.get('/export', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { cycle_id, department, quarter, employee_id } = req.query;

    let query = `
      SELECT
        u.name AS employee_name, u.department,
        m.name AS manager_name,
        g.thrust_area, g.title, g.uom_type, g.target_value, g.target_date,
        g.weightage, g.status AS goal_status,
        qa.quarter, qa.actual_value, qa.actual_date,
        qa.progress_status, qa.progress_score, qa.momentum_flag
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      LEFT JOIN users m ON m.id = u.manager_id
      JOIN goal_cycles c ON c.id = g.cycle_id
      LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
      WHERE g.status = 'APPROVED'
    `;
    const params = [];
    if (cycle_id)    { params.push(cycle_id);    query += ` AND g.cycle_id = $${params.length}`; }
    if (department)  { params.push(department);  query += ` AND u.department = $${params.length}`; }
    if (quarter)     { params.push(quarter);     query += ` AND qa.quarter = $${params.length}`; }
    if (employee_id) { params.push(employee_id); query += ` AND g.employee_id = $${params.length}`; }

    if (req.user.role === 'manager') {
      const teamRes = await pool.query('SELECT id FROM users WHERE manager_id = $1', [req.user.id]);
      const teamIds = teamRes.rows.map(r => r.id);
      params.push(teamIds);
      query += ` AND g.employee_id = ANY($${params.length}::uuid[])`;
    }

    query += ' ORDER BY u.name, g.thrust_area, qa.quarter';

    const result = await pool.query(query, params);
    await streamAchievementReport(res, result.rows, 'coresync_achievement_report');
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/analytics — chart data for admin analytics page
router.get('/analytics', authenticateToken, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const cycleRes = await pool.query('SELECT id FROM goal_cycles WHERE is_active = true LIMIT 1');
    const cycleId = cycleRes.rows[0]?.id;
    if (!cycleId) return res.json({ qoq: [], heatmap: [], distribution: [], managerEffectiveness: [] });

    // QoQ Achievement Trend by department
    const qoqRes = await pool.query(`
      SELECT u.department, qa.quarter,
             AVG(qa.progress_score) AS avg_score,
             COUNT(qa.id) AS count
      FROM quarterly_achievements qa
      JOIN goals g ON g.id = qa.goal_id
      JOIN users u ON u.id = g.employee_id
      WHERE g.cycle_id = $1
      GROUP BY u.department, qa.quarter
      ORDER BY u.department, qa.quarter
    `, [cycleId]);

    // Goal Distribution
    const distRes = await pool.query(`
      SELECT uom_type, status, thrust_area, COUNT(*) AS count
      FROM goals WHERE cycle_id = $1
      GROUP BY uom_type, status, thrust_area
    `, [cycleId]);

    // Manager Effectiveness
    const mgrRes = await pool.query(`
      SELECT m.id, m.name AS manager_name, qa.quarter,
             COUNT(DISTINCT u.id) AS team_size,
             COUNT(DISTINCT qa.goal_id) FILTER (WHERE qa.checkin_completed_at IS NOT NULL) AS completed_checkins
      FROM users m
      JOIN users u ON u.manager_id = m.id
      JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $1 AND g.status = 'APPROVED'
      LEFT JOIN quarterly_achievements qa ON qa.goal_id = g.id
      WHERE m.role IN ('manager', 'admin')
      GROUP BY m.id, m.name, qa.quarter
      ORDER BY m.name, qa.quarter
    `, [cycleId]);

    res.json({
      qoq: qoqRes.rows,
      distribution: distRes.rows,
      managerEffectiveness: mgrRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
