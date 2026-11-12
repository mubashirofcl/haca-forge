import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { workspacesLocked } from '../../../lib/workspaceLock';

/** A padlock drawn in the app's own ink and line colours. Decorative. */
const LockIllustration: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="mx-auto text-ui-ink">
    <circle cx="60" cy="60" r="56" className="fill-white/70 stroke-ui-line" strokeWidth="2" />
    <path d="M42 54V44a18 18 0 0 1 36 0v10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <rect x="34" y="54" width="52" height="38" rx="10" fill="currentColor" />
    <circle cx="60" cy="70" r="5" fill="white" />
    <path d="M60 74v8" stroke="white" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/**
 * Shown on every workspace route while the workspaces are locked. The step is submitted
 * with a link instead, from the submit dialog on Work Detail.
 */
export const WorkspaceLockedPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6" data-testid="workspace-locked">
      <div className="glass-card w-full max-w-md p-6 sm:p-8 text-center space-y-5">
        <LockIllustration />
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-ui-ink">This workspace is locked for now</h1>
          <p className="text-sm text-ui-muted">Submit this step with a Google Drive link instead.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
          <button type="button" onClick={() => navigate(`/work/${id}?submit=1`)} className="ui-btn ui-btn-primary h-11 gap-1.5">
            <Send className="w-3.5 h-3.5" />
            Submit with a link
          </button>
          <button type="button" onClick={() => navigate(`/work/${id}`)} className="ui-btn ui-btn-secondary h-11 gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to the step
          </button>
        </div>
      </div>
    </main>
  );
};

/** A workspace route: the locked screen while locked, the workspace itself otherwise. */
export const WorkspaceRoute: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  workspacesLocked() ? <WorkspaceLockedPage /> : <>{children}</>;
