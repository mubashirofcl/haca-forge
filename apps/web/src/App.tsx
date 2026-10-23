import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30s
    },
  },
});

// Lazy-loaded pages
const TeamDashboardPage = React.lazy(() =>
  import('./pages/dashboard/TeamDashboardPage').then((m) => ({ default: m.TeamDashboardPage }))
);
const AccessRequestsPage = React.lazy(() =>
  import('./pages/admin/AccessRequestsPage').then((m) => ({ default: m.AccessRequestsPage }))
);
const UsersPage = React.lazy(() =>
  import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const NotificationsPage = React.lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const CampaignsListPage = React.lazy(() =>
  import('./pages/campaigns/CampaignsListPage').then((m) => ({ default: m.CampaignsListPage }))
);
const CampaignDetailPage = React.lazy(() =>
  import('./pages/campaigns/CampaignDetailPage').then((m) => ({ default: m.CampaignDetailPage }))
);
const MyWorkPage = React.lazy(() =>
  import('./pages/work/MyWorkPage').then((m) => ({ default: m.MyWorkPage }))
);
const CalendarPage = React.lazy(() =>
  import('./pages/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const WorkListPage = React.lazy(() =>
  import('./pages/work/WorkListPage').then((m) => ({ default: m.WorkListPage }))
);
const WorkDetailPage = React.lazy(() =>
  import('./pages/work/WorkDetailPage').then((m) => ({ default: m.WorkDetailPage }))
);
const TodoPrioritiesPage = React.lazy(() =>
  import('./pages/todo/TodoPrioritiesPage').then((m) => ({ default: m.TodoPrioritiesPage }))
);
const TeamWorkloadPage = React.lazy(() =>
  import('./pages/workload/TeamWorkloadPage').then((m) => ({ default: m.TeamWorkloadPage }))
);
const FeedbackPage = React.lazy(() =>
  import('./pages/feedback/FeedbackPage').then((m) => ({ default: m.FeedbackPage }))
);
const IssuesBlockersPage = React.lazy(() =>
  import('./pages/issues/IssuesBlockersPage').then((m) => ({ default: m.IssuesBlockersPage }))
);
const ReportsPage = React.lazy(() =>
  import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const LeadFunnelPage = React.lazy(() =>
  import('./pages/leads/LeadFunnelPage').then((m) => ({ default: m.LeadFunnelPage }))
);
const DataCenterPage = React.lazy(() =>
  import('./pages/datacenter/DataCenterPage').then((m) => ({ default: m.DataCenterPage }))
);
const MyAccountPage = React.lazy(() =>
  import('./pages/MyAccountPage').then((m) => ({ default: m.MyAccountPage }))
);

/**
 * RootRedirect: Directs all authenticated users to /dashboard for Phase 0.
 * (Role-specific redirection: admin/head/TL to /dashboard, member to /my-work, active in Phase 1)
 */
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Phase 1 Role-specific Redirection
  if (user.role === 'team_member') {
    return <Navigate to="/my-work" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <GlobalFilterProvider>
            <ErrorBoundary>
              <React.Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/set-password" element={<SetPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Root Redirection */}
                <Route path="/" element={<RootRedirect />} />

                {/* Screen 2: Team Dashboard (Phase 6) */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <TeamDashboardPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 3: My Work (Phase 3) */}
                <Route
                  path="/my-work"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <MyWorkPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 4: Monthly Marketing Calendar (Phase 3) */}
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CalendarPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 5: Projects / Campaigns (Phase 2) */}
                <Route
                  path="/campaigns"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CampaignsListPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 6: Project Detail (Phase 2) */}
                <Route
                  path="/campaigns/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <CampaignDetailPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Work List (Phase 3) */}
                <Route
                  path="/work"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <WorkListPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 7: Single Work Detail (Phase 3) */}
                <Route
                  path="/work/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <WorkDetailPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 8: Feedback & Revision History (Phase 5) */}
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <FeedbackPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 9: Team Workload (Phase 4) */}
                <Route
                  path="/workload"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <TeamWorkloadPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 10: Todo and Priorities (Phase 3) */}
                <Route
                  path="/todo"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <TodoPrioritiesPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 11: Issues and Blockers (Phase 5) */}
                <Route
                  path="/issues"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <IssuesBlockersPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 12: Lead Funnel (Phase 8) */}
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <LeadFunnelPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 13: Data Center / LSQ (Phase 8) */}
                <Route
                  path="/data-center"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <DataCenterPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 14: Reports and Automation (Phase 7) */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ReportsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Enabler: People Setup (Phase 1, adapted UsersPage) */}
                <Route
                  path="/people"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UsersPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Legacy Admin Users route alias */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UsersPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Enabler: Access Requests (Phase 1, adapted AccessRequestsPage) */}
                <Route
                  path="/admin/access-requests"
                  element={
                    <ProtectedRoute requiredPermission="user.approve">
                      <Layout>
                        <AccessRequestsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* My Account & Work Preferences Enabler */}
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <MyAccountPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-account"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <MyAccountPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Notifications Page (Kept Infrastructure) */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <NotificationsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </GlobalFilterProvider>
      </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
export default App;
