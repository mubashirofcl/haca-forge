import React, { useEffect, useRef, useState } from 'react';
import { ROLE_KEYS, ROLE_LABELS } from '@mmp/shared';
import { apiFetch } from '../../lib/api';
import { useDialogFocus } from '../../lib/useDialogFocus';

type Action = 'role' | 'reset' | 'logout';

interface AdminAccountActionsProps {
  person: { _id: string; name: string; role: string };
  /** Called after a successful action with a message for the page to announce. */
  onDone: (message: string, action: Action) => void;
}

const roleName = (role: string) => ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;

/** Modal shell shared by the three account actions. Mounted only while open. */
const ActionDialog: React.FC<{
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ titleId, title, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-modal w-full max-w-md max-h-[92vh] overflow-y-auto p-6 space-y-4"
      >
        <h3 id={titleId} className="text-base font-bold text-ui-ink">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
};

const ErrorNotice: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="status-tint status-changes rounded-ui-control px-3 py-2 text-[13px] font-medium">
      {message}
    </p>
  ) : null;

/**
 * Admin-only account controls for another person's profile: change role, reset password,
 * force logout. Each one asks for confirmation before it calls the API. The parent decides
 * who sees this (admin, viewing someone else).
 */
export const AdminAccountActions: React.FC<AdminAccountActionsProps> = ({ person, onDone }) => {
  const [open, setOpen] = useState<Action | null>(null);
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [newRole, setNewRole] = useState(person.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Switching between the two role steps replaces the focused button, so move focus
  // into the new step instead of letting it fall back to the page.
  const confirmStepRef = useRef<HTMLDivElement>(null);
  const roleSelectRef = useRef<HTMLSelectElement>(null);
  const stepChanged = useRef(false);
  useEffect(() => {
    if (open !== 'role' || !stepChanged.current) return;
    stepChanged.current = false;
    if (step === 'confirm') confirmStepRef.current?.focus();
    else roleSelectRef.current?.focus();
  }, [open, step]);
  const goToStep = (next: 'choose' | 'confirm') => {
    stepChanged.current = true;
    setError(null);
    setStep(next);
  };

  const openAction = (action: Action) => {
    setError(null);
    setBusy(false);
    setStep('choose');
    setNewRole(person.role);
    setOpen(action);
  };
  const close = () => {
    if (busy) return;
    setOpen(null);
  };

  const run = async (action: Action) => {
    // Confirm buttons use aria-disabled (a disabled button would drop keyboard focus), so guard here.
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'role') {
        await apiFetch(`/api/team/${person._id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
        onDone(`${person.name}'s role is now ${roleName(newRole)}.`, action);
      } else if (action === 'reset') {
        await apiFetch(`/api/team/${person._id}/reset-password`, { method: 'POST' });
        onDone(
          `Password reset for ${person.name}. They must set a new password with "Forgot password?" on the sign-in page before they can sign in.`,
          action
        );
      } else {
        await apiFetch(`/api/team/${person._id}/force-logout`, { method: 'POST' });
        onDone(`${person.name} has been signed out of all devices.`, action);
      }
      setBusy(false);
      setOpen(null);
    } catch (err: any) {
      setBusy(false);
      setError(err?.message || 'The request failed. Nothing was changed.');
    }
  };

  return (
    <>
      <button type="button" onClick={() => openAction('role')} className="ui-btn ui-btn-secondary h-11">
        Change role
      </button>
      <button type="button" onClick={() => openAction('reset')} className="ui-btn ui-btn-secondary h-11">
        Reset password
      </button>
      <button type="button" onClick={() => openAction('logout')} className="ui-btn ui-btn-secondary h-11">
        Force logout
      </button>

      {open === 'role' && (
        <ActionDialog titleId="admin-role-title" title={`Change role: ${person.name}`} onClose={close}>
          {step === 'choose' ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (newRole !== person.role) goToStep('confirm');
              }}
            >
              <p className="text-[13px] text-ui-muted">
                Current role: <span className="font-semibold text-ui-ink">{roleName(person.role)}</span>
              </p>
              <div className="space-y-1.5">
                <label htmlFor="admin-role-select" className="text-[13px] font-medium text-ui-muted block">
                  New role
                </label>
                <select
                  ref={roleSelectRef}
                  id="admin-role-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="ui-select w-full"
                >
                  {ROLE_KEYS.map((rk) => (
                    <option key={rk} value={rk}>
                      {roleName(rk)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="ui-btn ui-btn-secondary h-11">
                  Cancel
                </button>
                <button type="submit" disabled={newRole === person.role} className="ui-btn ui-btn-primary h-11">
                  Review change
                </button>
              </div>
            </form>
          ) : (
            <div
              ref={confirmStepRef}
              tabIndex={-1}
              aria-label="Confirm the role change"
              className="space-y-4 rounded-ui-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt className="text-ui-muted">Current role</dt>
                <dd className="font-semibold text-ui-ink">{roleName(person.role)}</dd>
                <dt className="text-ui-muted">New role</dt>
                <dd className="font-semibold text-ui-ink">{roleName(newRole)}</dd>
              </dl>
              <p className="text-[13px] text-ui-text">
                Their permissions change straight away, including which pages and data they can open.
              </p>
              <ErrorNotice message={error} />
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => goToStep('choose')} disabled={busy} className="ui-btn ui-btn-secondary h-11">
                  Back
                </button>
                <button type="button" onClick={() => run('role')} aria-disabled={busy} className="ui-btn ui-btn-primary h-11 aria-disabled:opacity-60 aria-disabled:cursor-wait">
                  {busy ? 'Saving…' : 'Confirm role change'}
                </button>
              </div>
            </div>
          )}
        </ActionDialog>
      )}

      {open === 'reset' && (
        <ActionDialog titleId="admin-reset-title" title={`Reset password for ${person.name}?`} onClose={close}>
          <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-ui-text">
            <li>They can't sign in until they set a new password.</li>
            <li>
              No email is sent by this action. They set a new password with "Forgot password?" on the sign-in
              page, which emails a link to their registered email.
            </li>
            <li>Devices they're already signed in on stay signed in. Use Force logout to end those sessions.</li>
          </ul>
          <ErrorNotice message={error} />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" onClick={close} disabled={busy} className="ui-btn ui-btn-secondary h-11">
              Cancel
            </button>
            <button type="button" onClick={() => run('reset')} aria-disabled={busy} className="ui-btn ui-btn-primary h-11 aria-disabled:opacity-60 aria-disabled:cursor-wait">
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </ActionDialog>
      )}

      {open === 'logout' && (
        <ActionDialog titleId="admin-logout-title" title={`Sign ${person.name} out everywhere?`} onClose={close}>
          <p className="text-[13px] text-ui-text">
            This ends all of their sessions, so they'll need to sign in again. A page they already have open can
            keep working for a few minutes until its access expires.
          </p>
          <ErrorNotice message={error} />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" onClick={close} disabled={busy} className="ui-btn ui-btn-secondary h-11">
              Cancel
            </button>
            <button type="button" onClick={() => run('logout')} aria-disabled={busy} className="ui-btn ui-btn-primary h-11 aria-disabled:opacity-60 aria-disabled:cursor-wait">
              {busy ? 'Signing out…' : 'Force logout'}
            </button>
          </div>
        </ActionDialog>
      )}
    </>
  );
};
