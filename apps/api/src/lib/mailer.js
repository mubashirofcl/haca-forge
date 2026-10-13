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
      text: `Hello ${name},\n\nYour access request could not be approved at this time.\nReason: ${reason || 'Not specified'}\n\nIf you have questions, please reach out to the Marketing Lead.`,
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
  };
}
