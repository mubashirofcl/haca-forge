/**
 * Dashboard service for HACA Marketing OS
 * Rebuilt in Phase 6 to provide the 9-section Team Dashboard.
 */

export async function getDashboardSummaryByRole(role, user) {
  return {
    role: role || user?.role,
    summary: {
      planned: 0,
      completed: 0,
      inProgress: 0,
      atRisk: 0,
      blocked: 0,
      pendingFeedback: 0,
      overdue: 0,
    },
    message: 'Dashboard metrics will be populated in Phase 6',
  };
}
