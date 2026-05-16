const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.created_at,
              m.name AS manager_name, m.email AS manager_email
       FROM users u
       LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/team — manager's direct reports
router.get('/team', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const managerId = req.user.role === 'manager' ? req.user.id : req.query.manager_id;
    const result = await pool.query(
      `SELECT id, name, email, department, created_at FROM users
       WHERE manager_id = $1 ORDER BY name`,
      [managerId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/org-tree — full org hierarchy for cascade view (admin only)
router.get('/org-tree', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const usersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.manager_id,
              (SELECT COUNT(*) FROM goals g WHERE g.employee_id = u.id
               AND g.status = 'APPROVED') AS approved_goals_count
       FROM users u ORDER BY u.role, u.name`
    );

    const users = usersResult.rows;
    // Build tree structure
    const map = {};
    users.forEach(u => { map[u.id] = { ...u, children: [] }; });

    const roots = [];
    users.forEach(u => {
      if (u.manager_id && map[u.manager_id]) {
        map[u.manager_id].children.push(map[u.id]);
      } else if (!u.manager_id) {
        roots.push(map[u.id]);
      }
    });

    res.json(roots);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — get any user by ID (admin/manager only)
router.get('/:id', authenticateToken, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.created_at,
              m.name AS manager_name
       FROM users u LEFT JOIN users m ON m.id = u.manager_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/users — list all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { department, role } = req.query;
    let query = `SELECT u.id, u.name, u.email, u.role, u.department,
                        m.name AS manager_name, u.created_at
                 FROM users u LEFT JOIN users m ON m.id = u.manager_id WHERE 1=1`;
    const params = [];
    if (department) { params.push(department); query += ` AND u.department = $${params.length}`; }
    if (role)       { params.push(role);       query += ` AND u.role = $${params.length}`; }
    query += ' ORDER BY u.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
