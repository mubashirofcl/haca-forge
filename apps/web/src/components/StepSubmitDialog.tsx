import React, { useRef, useState } from 'react';
import { Globe, Plus, Send, Trash2, X } from 'lucide-react';
import {
  DRIVE_LINK_ERROR,
  DRIVE_LINK_HINT,
  LIVE_URL_ERROR,
  MAX_SUBMIT_LINKS,
  isDriveLink,
  isLivePostUrl,
  stepAllowsManyLinks,
} from '@mmp/shared';
import { apiFetch } from '../lib/api';
import { useDialogFocus } from '../lib/useDialogFocus';

export interface StepSubmitTarget {
  _id: string;
  title?: string;
  stageKey?: string | null;
  publishedUrl?: string;
}

interface StepSubmitDialogProps {
  step: StepSubmitTarget;
  /** True when this is a rework being sent again. */
  resubmit?: boolean;
  onClose: () => void;
  /** Called after the step was submitted or marked posted. */
  onDone: () => void | Promise<void>;
}

/**
 * The one submit dialog, used on My Work and Work Detail by the step owner.
 * - Script, Content, Shoot, Edit: one Google Drive link.
 * - Design: one or more Google Drive links (one per slide or file).
 * - Post: the live post link only, then the step is marked posted.
 */
export const StepSubmitDialog: React.FC<StepSubmitDialogProps> = ({ step, resubmit = false, onClose, onDone }) => {
  const isPost = step.stageKey === 'Post';
  const many = stepAllowsManyLinks(step.stageKey);
  const [links, setLinks] = useState<string[]>([isPost ? step.publishedUrl || '' : '']);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);

  const linkError = (value: string): string | null => {
    const v = value.trim();
    if (!v) return isPost ? LIVE_URL_ERROR : 'Enter a link.';
    if (isPost) return isLivePostUrl(v) ? null : LIVE_URL_ERROR;
    return isDriveLink(v) ? null : DRIVE_LINK_ERROR;
  };
  const filled = links.map((l) => l.trim()).filter(Boolean);
  // An empty extra row on a Design step is ignored; the first row is always needed.
  const rowsToCheck = links.filter((l, i) => i === 0 || l.trim());
  const invalid = rowsToCheck.some((l) => linkError(l));

  const setLink = (i: number, value: string) => setLinks((prev) => prev.map((l, idx) => (idx === i ? value : l)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setError(null);
    if (invalid) return;
    setBusy(true);
    try {
      if (isPost) {
        await apiFetch(`/api/work/${step._id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ toStatus: 'Published', publishedUrl: filled[0] }),
        });
      } else {
        await apiFetch(`/api/work/${step._id}/submit-link`, {
          method: 'POST',
          body: JSON.stringify({ links: filled, note: note.trim() || undefined }),
        });
      }
      await onDone();
    } catch (err: any) {
      setError(err?.message || (isPost ? 'Could not mark this as posted.' : 'Could not submit this step.'));
    } finally {
      setBusy(false);
    }
  };

  const title = isPost ? 'Mark as posted' : resubmit ? 'Resubmit link' : 'Submit link';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 ui-scrim">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-submit-title"
        data-testid="step-submit-dialog"
        className="glass-modal w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ui-line pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {isPost ? <Globe className="w-5 h-5 text-ui-ink shrink-0" aria-hidden="true" /> : <Send className="w-5 h-5 text-ui-ink shrink-0" aria-hidden="true" />}
            <div className="min-w-0">
              <h3 id="step-submit-title" className="text-base font-bold text-ui-ink">
                {title}
              </h3>
              {step.title && <p className="text-xs text-ui-muted truncate">{step.stageKey ? `${step.stageKey}: ` : ''}{step.title}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ui-icon-btn shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-3">
            {links.map((value, i) => {
              const id = `step-submit-link-${i}`;
              const rowError = showErrors && (i === 0 || value.trim()) ? linkError(value) : null;
              const label = isPost ? 'Live post link' : many ? `Google Drive link ${i + 1}` : 'Google Drive link';
              return (
                <div key={i} className="space-y-1.5">
                  <label htmlFor={id} className="block text-[13px] font-medium text-ui-muted">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={id}
                      type="url"
                      inputMode="url"
                      value={value}
                      onChange={(e) => setLink(i, e.target.value)}
                      placeholder={isPost ? 'https://www.instagram.com/reel/...' : 'https://drive.google.com/...'}
                      aria-invalid={Boolean(rowError)}
                      aria-describedby={rowError ? `${id}-error` : 'step-submit-hint'}
                      className="ui-input w-full min-w-0"
                    />
                    {many && links.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove link ${i + 1}`}
                        className="ui-icon-btn shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {rowError && (
                    <p id={`${id}-error`} role="alert" className="text-xs text-red-700">
                      {rowError}
                    </p>
                  )}
                </div>
              );
            })}
            {many && links.length < MAX_SUBMIT_LINKS && (
              <button type="button" onClick={() => setLinks((prev) => [...prev, ''])} className="ui-btn ui-btn-secondary h-11 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add another link
              </button>
            )}
            <p id="step-submit-hint" className="text-xs text-ui-muted">
              {isPost
                ? 'Paste the link of the published post. It must start with https://'
                : `${many ? 'One link per slide or file. ' : ''}${DRIVE_LINK_HINT}`}
            </p>
          </div>

          {!isPost && (
            <div>
              <label htmlFor="step-submit-note" className="block text-[13px] font-medium text-ui-muted mb-1.5">
                Note to the reviewer (optional)
              </label>
              <textarea
                id="step-submit-note"
                rows={3}
                maxLength={5000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="ui-input ui-textarea w-full"
              />
            </div>
          )}

          {error && (
            <p role="alert" data-testid="step-submit-error" className="p-3 rounded-xl status-tint status-changes text-xs font-semibold">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary h-11">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="ui-btn ui-btn-primary h-11 gap-1.5">
              {busy ? 'Sending...' : isPost ? 'Mark as posted' : resubmit ? 'Resubmit' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
