import { WORKSPACES_LOCKED } from '@mmp/shared';

/**
 * The workspace lock, read from the one switch in @mmp/shared (WORKSPACES_LOCKED).
 * While locked, workspace-only writes (draft save, clip upload and edits, submit-clips) are
 * refused and steps are submitted with links. Reads and every review route stay open.
 */
let testOverride = null;

export const workspacesLocked = () => (testOverride === null ? WORKSPACES_LOCKED : testOverride);

/** Tests only: run the unlocked workspace code. Pass null to return to the switch. */
export function setWorkspacesLockedForTests(value) {
  if (process.env.NODE_ENV !== 'test') throw new Error('The workspace lock can only be overridden in tests');
  testOverride = value;
}

export function workspacesLockedError() {
  const error = new Error('This workspace is locked for now. Submit this step with a link.');
  error.statusCode = 423;
  error.code = 'WORKSPACES_LOCKED';
  return error;
}

/** Route guard for workspace-only writes. */
export function refuseWhenWorkspacesLocked(_req, _res, next) {
  next(workspacesLocked() ? workspacesLockedError() : undefined);
}
