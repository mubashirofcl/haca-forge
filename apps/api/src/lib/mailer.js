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
      subject: 'Welcome to HACA Marketing OS - Set Your Password',
      text: `Hello ${name},\n\nYour access request for HACA Marketing OS has been approved. Please set your password using the link below (valid for 48 hours):\n${setPasswordUrl}\n\nBest regards,\nHACA Marketing Operations Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="display: inline-block; padding: 6px 12px; background-color: #ede9fe; color: #6d28d9; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
              HACA Marketing OS
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Welcome to the Team, ${name}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Your access request has been approved by the Administrator. You have been provisioned access to your team workspace in HACA Marketing OS.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Please click the button below to set your account password and activate your workspace. This single-use link is valid for <strong>48 hours</strong>.
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${setPasswordUrl}" style="background-color: #0f172a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 9999px; font-size: 13px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);">
                Set Password & Activate Account
              </a>
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              If the button does not work, copy and paste this secure link into your browser:<br>
              <a href="${setPasswordUrl}" style="color: #6366f1; word-break: break-all;">${setPasswordUrl}</a>
            </p>
          </div>
        </div>
      `,
    }),
    accessRequestSubmitted: ({ name, email, department, jobRole, requestedRole, brands = [] }) => ({
      subject: `[Marketing OS] New Access Request: ${name} (${department || 'General'})`,
      text: `A new access request has been submitted by ${name} (${email}).\nDepartment: ${department}\nJob Role: ${jobRole || 'Not specified'}\nRequested Role: ${requestedRole}\nBrands: ${brands.join(', ') || 'None'}\n\nPlease review it in the Marketing OS Admin Console.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
            <div style="display: inline-block; padding: 6px 12px; background-color: #fef3c7; color: #b45309; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
              Pending Review
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">New Access Request Submitted</h2>
            <p style="font-size: 14px; color: #475569;">A new user has submitted details for review:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 35%;">Name</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email</td>
                <td style="padding: 8px 0; color: #0f172a;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Department</td>
                <td style="padding: 8px 0; color: #0f172a;">${department}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Job Role</td>
                <td style="padding: 8px 0; color: #0f172a;">${jobRole || 'Unspecified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Requested Role</td>
                <td style="padding: 8px 0; color: #6366f1; font-weight: 700;">${requestedRole}</td>
              </tr>
              ${brands.length > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Brands</td>
                <td style="padding: 8px 0; color: #0f172a;">${brands.join(', ')}</td>
              </tr>` : ''}
            </table>
            <p style="font-size: 13px; color: #475569;">
              Log in to the Marketing OS Admin Console to confirm final role, brand access, reports-to and capacity.
            </p>
          </div>
        </div>
      `,
    }),
    requestRejected: ({ name, reason }) => ({
      subject: 'Update Regarding Your HACA Marketing OS Access Request',
      text: `Hello ${name},\n\nYour request to access HACA Marketing OS could not be approved at this time.\nReason: ${reason || 'Administrative decision'}\n\nIf you believe this was in error, please coordinate with your administrator.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">Access Request Update</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Your request for access to HACA Marketing OS was reviewed by an administrator, but could not be approved at this time.
            </p>
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #991b1b;">
              <strong>Reason:</strong> ${reason || 'Administrative decision'}
            </div>
            <p style="font-size: 13px; color: #64748b;">
              If you have questions or believe this was in error, please reach out directly to your marketing administrator.
            </p>
          </div>
        </div>
      `,
    }),
    infoNeeded: ({ name, question }) => ({
      subject: 'Action Needed: Your HACA Marketing OS Access Request',
      text: `Hello ${name},\n\nThe administrator reviewing your HACA Marketing OS access request has requested more information:\n\n${question}\n\nPlease reply to this email or reach out to your administrator.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
            <div style="display: inline-block; padding: 6px 12px; background-color: #eff6ff; color: #2563eb; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
              Information Requested
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800;">Clarification Needed</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Before your Marketing OS access request can be completed, the administrator needs additional information:
            </p>
            <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #065f46;">
              ${question}
            </div>
            <p style="font-size: 13px; color: #64748b;">
              Please respond directly to this email or communicate the requested details to your administrator.
            </p>
          </div>
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
