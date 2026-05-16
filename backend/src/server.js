require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { limiter } = require('./middleware/rateLimiter');
const { startEscalationCron } = require('./jobs/escalation.cron');

// Routes
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const goalRoutes         = require('./routes/goals');
const approvalRoutes     = require('./routes/approvals');
const achievementRoutes  = require('./routes/achievements');
const reportRoutes       = require('./routes/reports');
const adminRoutes        = require('./routes/admin');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// ── Parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use('/api', limiter);

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CoreSync API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/approvals',    approvalRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/admin',        adminRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' });
});

// ── Global Error Handler ──────────────────────────────────────────────────
// IMPORTANT: Never expose stack traces to client
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`❌ [${new Date().toISOString()}] ${err.stack || err.message}`);

  res.status(statusCode).json({
    error: statusCode === 500
      ? 'An internal server error occurred'
      : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(isDev && statusCode === 500 ? { detail: err.message } : {}),
  });
});

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000');

app.listen(PORT, () => {
  console.log(`\n🚀 CoreSync API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);

  // Start scheduled jobs
  if (process.env.NODE_ENV !== 'test') {
    startEscalationCron();
  }
});

module.exports = app;
