const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  SMTP not configured — emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * Send an email. Falls back to console.log if SMTP is not configured.
 */
async function sendEmail({ to, subject, html, text }) {
  const tp = getTransporter();

  if (!tp) {
    // Development fallback — log to console
    console.log(`\n📧 [EMAIL WOULD BE SENT]`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${text || subject}`);
    console.log();
    return { messageId: 'console-log-fallback' };
  }

  try {
    const result = await tp.sendMail({
      from: process.env.SMTP_FROM || `"CoreSync" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`📧 Email sent to ${to}: ${result.messageId}`);
    return result;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    throw err;
  }
}

// ── Template helpers ─────────────────────────────────────────────────────────

function emailTemplate(title, body) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'DM Sans', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; }
          .card { background: white; border-radius: 12px; padding: 32px; max-width: 560px; margin: 0 auto; box-shadow: 0 4px 24px rgba(79,70,229,0.08); }
          .brand { color: #4F46E5; font-size: 20px; font-weight: 700; margin-bottom: 24px; }
          h2 { color: #1E293B; font-size: 20px; margin: 0 0 16px; }
          p { color: #475569; line-height: 1.6; }
          .badge { display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }
          .cta { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
          .footer { color: #94A3B8; font-size: 12px; margin-top: 32px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="brand">⚡ CoreSync</div>
          <h2>${title}</h2>
          ${body}
          <div class="footer">This is an automated notification from CoreSync Goal Tracking System.</div>
        </div>
      </body>
    </html>
  `;
}

async function sendGoalReminderEmail({ to, name, type, daysOverdue, cycleId }) {
  const subjects = {
    GOAL_NOT_SUBMITTED: `Action Required: Submit your goals for FY 2025-26`,
    GOAL_NOT_APPROVED:  `Reminder: Your team's goals are awaiting approval`,
    CHECKIN_OVERDUE:    `Action Required: Complete your quarterly check-in`,
  };

  const bodies = {
    GOAL_NOT_SUBMITTED: `
      <p>Hi ${name},</p>
      <p>Your goals for this cycle are <strong>not yet submitted</strong> for approval.</p>
      <p><span class="badge">${daysOverdue} days overdue</span></p>
      <p>Please log in to CoreSync and submit your goals before the deadline to avoid further escalation.</p>
      <a href="${process.env.FRONTEND_URL}/goals" class="cta">Submit Goals Now →</a>
    `,
    GOAL_NOT_APPROVED: `
      <p>Hi ${name},</p>
      <p>Your team members have submitted goals that are <strong>awaiting your approval</strong> for ${daysOverdue} days.</p>
      <p>Please review and approve or return goals at your earliest convenience.</p>
      <a href="${process.env.FRONTEND_URL}/manager/approvals" class="cta">Review Approvals →</a>
    `,
    CHECKIN_OVERDUE: `
      <p>Hi ${name},</p>
      <p>Your quarterly check-in is <strong>${daysOverdue} days overdue</strong>. Please log your progress to keep your manager updated.</p>
      <a href="${process.env.FRONTEND_URL}/goals" class="cta">Log Check-in →</a>
    `,
  };

  return sendEmail({
    to,
    subject: subjects[type] || 'CoreSync Reminder',
    html: emailTemplate(subjects[type] || 'CoreSync Reminder', bodies[type] || '<p>Please take action in CoreSync.</p>'),
    text: `${subjects[type]} — Please log in to CoreSync: ${process.env.FRONTEND_URL}`,
  });
}

module.exports = { sendEmail, sendGoalReminderEmail };
