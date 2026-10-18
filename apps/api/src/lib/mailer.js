import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let transporter = null;

if (env.EMAIL_PROVIDER === 'smtp') {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export async function sendMail({ to, subject, html, text }) {
  const from = env.MAIL_FROM;

  if (env.EMAIL_PROVIDER === 'console') {
    logger.info(
      {
        to,
        from,
        subject,
      },
      `\n📨 [EMAIL (CONSOLE)]: To: ${to} | Subject: ${subject}\n---\n${text || html}\n---`
    );
    return { success: true, messageId: `console-${Date.now()}` };
  }

  if (env.EMAIL_PROVIDER === 'smtp') {
    if (!transporter) {
      throw new Error('SMTP transporter is not configured');
    }
    const info = await transporter.sendMail({ from, to, subject, html, text });
    return { success: true, messageId: info.messageId };
  }

  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    // Dynamic import to avoid hard dependency when not using Resend
    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);
    const result = await resend.emails.send({ from, to, subject, html, text });
    return { success: true, messageId: result.data?.id };
  }

  throw new Error(`Unknown EMAIL_PROVIDER: ${env.EMAIL_PROVIDER}`);
}

// Mail templates
export function templates() {
  return {
    invite: ({ name, setPasswordUrl }) => ({
      subject: 'Welcome to Marketing Portal - Set Your Password',
      text: `Hello ${name},\n\nYour access request has been approved. Please set your password using the link below (valid for 48 hours):\n${setPasswordUrl}\n\nBest regards,\nMarketing Operations Team`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f172a;">Welcome to the Marketing Portal</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your request to access the Marketing Workflow and Content Management Portal has been approved.</p>
          <p>Please click the button below to set your account password (link valid for 48 hours):</p>
          <p style="margin: 30px 0;">
            <a href="${setPasswordUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Set Password & Activate Account
            </a>
          </p>
          <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser: <br>${setPasswordUrl}</p>
        </div>
      `,
    }),
    accessRequestSubmitted: ({ name, email, department, requestedRole }) => ({
      subject: `New Access Request: ${name} (${department})`,
      text: `A new access request has been submitted by ${name} (${email}) for department ${department} with requested role ${requestedRole}. Please review it in the Admin dashboard.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>New Access Request Pending Review</h2>
          <p>A new user has requested access to the portal:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Department:</strong> ${department}</li>
            <li><strong>Requested Role:</strong> ${requestedRole}</li>
          </ul>
          <p>Please log in to the Admin Dashboard to review and assign their team and role.</p>
        </div>
      `,
    }),
    requestRejected: ({ name, reason }) => ({
      subject: 'Update Regarding Your Marketing Portal Access Request',
      text: `Hello ${name},\n\nYour access request could not be approved at this time.\nReason: ${reason || 'Not specified'}\n\nIf you have questions, please reach out to the Marketing Head.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>Access Request Update</h2>
          <p>Hello ${name},</p>
          <p>Your request to access the Marketing Workflow Portal was reviewed, but could not be approved at this time.</p>
          <div style="background-color: #f1f5f9; padding: 12px 16px; border-left: 4px solid #ef4444; margin: 16px 0;">
            <strong>Reason:</strong> ${reason || 'Administrative decision'}
          </div>
          <p>If you believe this was in error, please coordinate with your department lead.</p>
        </div>
      `,
    }),
    infoNeeded: ({ name, question }) => ({
      subject: 'Action Needed: Marketing Portal Access Request',
      text: `Hello ${name},\n\nThe administrator needs additional information before approving your access:\n\n${question}\n\nPlease reply or update your request.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>Additional Information Needed</h2>
          <p>Hello ${name},</p>
          <p>Before your access request can be completed, the administrator requested more information:</p>
          <div style="background-color: #f8fafc; padding: 14px; border-left: 4px solid #3b82f6; margin: 16px 0;">
            ${question}
          </div>
          <p>Please respond to this email with the requested details.</p>
        </div>
      `,
    }),
    taskAssigned: ({ name, taskTitle, taskId, dueDate, actionUrl }) => ({
      subject: `New Task Assigned: ${taskId} - ${taskTitle}`,
      text: `Hello ${name},\n\nYou have been assigned to task "${taskTitle}" (${taskId}).\nDue Date: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'Not set'}\n\nView task: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f172a;">New Task Assigned</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>You have been assigned to task <strong>${taskId} - ${taskTitle}</strong>.</p>
          <p><strong>Due Date:</strong> ${dueDate ? new Date(dueDate).toLocaleDateString() : 'Not specified'}</p>
          ${actionUrl ? `<p style="margin: 24px 0;"><a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Task</a></p>` : ''}
        </div>
      `,
    }),
    taskBlocked: ({ name, taskTitle, taskId, reason, actionUrl }) => ({
      subject: `Task Blocked: ${taskId} - ${taskTitle}`,
      text: `Hello ${name},\n\nTask "${taskTitle}" (${taskId}) has been marked as blocked.\nReason: ${reason || 'Hold'}\n\nView task: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626;">Task Blocked / On Hold</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Task <strong>${taskId} - ${taskTitle}</strong> was marked as blocked.</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0;">
            <strong>Reason:</strong> ${reason || 'Needs resolution'}
          </div>
          ${actionUrl ? `<p><a href="${actionUrl}" style="color: #4f46e5; font-weight: bold;">View Details & Resolution &rarr;</a></p>` : ''}
        </div>
      `,
    }),
    requestDecided: ({ name, requestTitle, requestId, decision, reason, actionUrl }) => ({
      subject: `Request ${decision.toUpperCase()}: ${requestId} - ${requestTitle}`,
      text: `Hello ${name},\n\nYour request "${requestTitle}" (${requestId}) has been ${decision}.\n${reason ? `Note: ${reason}\n` : ''}\nView request: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>Request Triage Decision: ${decision.toUpperCase()}</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your request <strong>${requestId} - ${requestTitle}</strong> has been marked as <strong>${decision}</strong>.</p>
          ${reason ? `<div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 12px 16px; margin: 16px 0;">${reason}</div>` : ''}
          ${actionUrl ? `<p><a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Request</a></p>` : ''}
        </div>
      `,
    }),
    reviewSubmitted: ({ name, deliverableTitle, version, actionUrl }) => ({
      subject: `Review Ready: ${deliverableTitle} (v${version})`,
      text: `Hello ${name},\n\nA deliverable "${deliverableTitle}" (v${version}) is ready for your review and approval.\n\nView: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>Deliverable Ready for Review</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>A new version of <strong>${deliverableTitle}</strong> (v${version}) has been submitted for review.</p>
          ${actionUrl ? `<p><a href="${actionUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Review</a></p>` : ''}
        </div>
      `,
    }),
    reviewDecided: ({ name, deliverableTitle, decision, feedback, actionUrl }) => ({
      subject: `Review Decision: ${deliverableTitle} - ${decision.replace('_', ' ').toUpperCase()}`,
      text: `Hello ${name},\n\nThe review for "${deliverableTitle}" has been completed with decision: ${decision}.\nFeedback: ${feedback || 'None'}\n\nView: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2>Review Decision: ${decision.replace('_', ' ').toUpperCase()}</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your deliverable <strong>${deliverableTitle}</strong> received a review decision of <strong>${decision}</strong>.</p>
          ${feedback ? `<div style="background-color: #f1f5f9; padding: 12px 16px; margin: 16px 0;">${feedback}</div>` : ''}
          ${actionUrl ? `<p><a href="${actionUrl}" style="color: #4f46e5; font-weight: bold;">View Deliverable</a></p>` : ''}
        </div>
      `,
    }),
    deadlineReminder: ({ name, title, type, dueDate, hoursLeft, actionUrl }) => ({
      subject: `Upcoming Deadline (in ~${hoursLeft || 24}h): ${title}`,
      text: `Hello ${name},\n\nThis is a reminder that ${type || 'item'} "${title}" is due soon on ${new Date(dueDate).toLocaleString()}.\n\nView: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #ea580c;">Upcoming Deadline Reminder</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>The following ${type || 'item'} is approaching its deadline in approximately <strong>${hoursLeft || 24} hours</strong>:</p>
          <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 16px 0;">
            <strong>${title}</strong><br>
            Due: ${new Date(dueDate).toLocaleString()}
          </div>
          ${actionUrl ? `<p><a href="${actionUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to ${type || 'Item'}</a></p>` : ''}
        </div>
      `,
    }),
    deadlineOverdue: ({ name, title, type, dueDate, actionUrl }) => ({
      subject: `OVERDUE ALERT: ${title}`,
      text: `Hello ${name},\n\nThe ${type || 'item'} "${title}" was due on ${new Date(dueDate).toLocaleDateString()} and is now overdue.\n\nView: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626;">Item Overdue Alert</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>The ${type || 'item'} <strong>${title}</strong> is past its scheduled deadline (${new Date(dueDate).toLocaleDateString()}).</p>
          ${actionUrl ? `<p><a href="${actionUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Take Action</a></p>` : ''}
        </div>
      `,
    }),
    dailyDigest: ({ name, pendingTriage = 0, blockedTasks = 0, pendingReviews = 0, overdueTasks = 0, actionUrl }) => ({
      subject: `Marketing Portal Daily Digest - ${new Date().toLocaleDateString()}`,
      text: `Hello ${name},\n\nHere is your daily operational summary:\n- Pending Triage: ${pendingTriage}\n- Blocked Tasks: ${blockedTasks}\n- Pending Reviews: ${pendingReviews}\n- Overdue Tasks: ${overdueTasks}\n\nOpen Portal: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f172a;">Marketing Portal Daily Digest</h2>
          <p>Hello <strong>${name}</strong>, here is today's operational summary:</p>
          <ul style="line-height: 1.8;">
            <li><strong>Requests Pending Triage:</strong> ${pendingTriage}</li>
            <li><strong>Tasks Blocked:</strong> ${blockedTasks}</li>
            <li><strong>Deliverables Awaiting Review:</strong> ${pendingReviews}</li>
            <li><strong>Overdue Items:</strong> ${overdueTasks}</li>
          </ul>
          ${actionUrl ? `<p style="margin: 24px 0;"><a href="${actionUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Dashboard</a></p>` : ''}
        </div>
      `,
    }),
    capacityGapAlert: ({ name, teamName, scheduledHours, capacityHours, actionUrl }) => ({
      subject: `Capacity Alert: Team ${teamName} Exceeding Workload`,
      text: `Hello ${name},\n\nTeam ${teamName} has ${scheduledHours} hours assigned vs ${capacityHours} hours of available capacity for the upcoming week.\n\nView: ${actionUrl || ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #d97706;">Team Capacity Warning</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Team <strong>${teamName}</strong> has scheduled workload exceeding available capacity for the upcoming week:</p>
          <p>Scheduled: <strong>${scheduledHours} hrs</strong> | Capacity: <strong>${capacityHours} hrs</strong> (${Math.round((scheduledHours / (capacityHours || 1)) * 100)}% utilization)</p>
          ${actionUrl ? `<p><a href="${actionUrl}" style="color: #4f46e5; font-weight: bold;">Review Team Workload</a></p>` : ''}
        </div>
      `,
    }),
  };
}
