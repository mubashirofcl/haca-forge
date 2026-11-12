import { WORKSPACES_LOCKED } from '@mmp/shared';

/**
 * The workspace lock, read from the one switch in @mmp/shared (WORKSPACES_LOCKED).
 * While locked, workspace routes show the locked screen, no workspace buttons appear, and
 * steps are submitted with links from My Work and Work Detail.
 */
let testOverride: boolean | null = null;

export const workspacesLocked = (): boolean => (testOverride === null ? WORKSPACES_LOCKED : testOverride);

/** Tests only: render the unlocked workspace screens. Pass null to return to the switch. */
export function setWorkspacesLockedForTests(value: boolean | null): void {
  testOverride = value;
}
