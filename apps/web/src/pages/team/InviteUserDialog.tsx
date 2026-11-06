import React, { useRef, useState } from 'react';
import { ROLE_KEYS, ROLE_LABELS, JOB_ROLES } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { useDialogFocus } from '../../lib/useDialogFocus';

interface InviteUserDialogProps {
  onClose: () => void;
  /** Called after the account is created, with a message for the page to announce. */
  onInvited: (message: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Admin-only "Invite user" dialog for /team. Creates the account through POST /api/people
 * without a password, so the person sets their own password; no password is typed,
 * shown or logged here. Mounted only while open.
 */
export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({ onClose, onInvited }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'team_member', jobRole: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (!busy) onClose();
  };
  useDialogFocus(dialogRef, true, close);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The submit button uses aria-disabled (a disabled button would drop keyboard focus), so guard here.
    if (busy) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) return setError('Enter their full name.');
    if (!EMAIL_PATTERN.test(email)) return setError('Enter a valid email address.');

    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/people', {
        method: 'POST',
        body: JSON.stringify({ name, email, role: form.role, ...(form.jobRole ? { jobRole: form.jobRole } : {}) }),
      });
      setBusy(false);
      onInvited(
        `Account created for ${name}. Ask them to set a password with "Forgot password?" on the sign-in page, using ${email}.`
      );
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || 'The account could not be created. Nothing was saved.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-user-title"
        aria-describedby="invite-user-desc"
        className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-4"
      >
        <h3 id="invite-user-title" className="text-base font-bold text-ui-ink">
          Invite user
        </h3>
        <p id="invite-user-desc" className="text-[13px] text-ui-muted">
          This creates their account. No email is sent automatically: they set their password with
          "Forgot password?" on the sign-in page, using the email below.
        </p>

        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="invite-name" className="text-[13px] font-medium text-ui-muted block">
              Full name
            </label>
            <input
              id="invite-name"
              type="text"
              autoComplete="off"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="ui-input w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-[13px] font-medium text-ui-muted block">
              Registered email
            </label>
            <input
              id="invite-email"
              type="email"
              autoComplete="off"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="ui-input w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-[13px] font-medium text-ui-muted block">
              Role
            </label>
            <select
              id="invite-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="ui-select w-full"
            >
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {ROLE_LABELS[rk]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-job-role" className="text-[13px] font-medium text-ui-muted block">
              Job role (optional)
            </label>
            <select
              id="invite-job-role"
              value={form.jobRole}
              onChange={(e) => setForm({ ...form, jobRole: e.target.value })}
              className="ui-select w-full"
            >
              <option value="">None</option>
              {JOB_ROLES.map((jr) => (
                <option key={jr} value={jr}>
                  {jr}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-[13px] font-medium">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" onClick={close} disabled={busy} className="ui-btn ui-btn-secondary h-11">
              Cancel
            </button>
            <button type="submit" aria-disabled={busy} className="ui-btn ui-btn-primary h-11 aria-disabled:opacity-60 aria-disabled:cursor-wait">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
