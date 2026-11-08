import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleBoundary } from './components/RoleBoundary';
import type { UserRole } from '@mmp/shared';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Pages team members must not see. They get the not-found state, as on /team/:id.
const TEAM_MEMBER_HIDDEN: UserRole[] = ['team_member'];

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
const NotificationsPage = React.lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const MyWorkPage = React.lazy(() =>
  import('./pages/work/MyWorkPage').then((m) => ({ default: m.MyWorkPage }))
);
const CalendarPage = React.lazy(() =>
  import('./pages/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const PlanGridPage = React.lazy(() =>
  import('./pages/calendar/PlanGridPage').then((m) => ({ default: m.PlanGridPage }))
);
const WorkListPage = React.lazy(() =>
  import('./pages/work/WorkListPage').then((m) => ({ default: m.WorkListPage }))
);
const WorkDetailPage = React.lazy(() =>
  import('./pages/work/WorkDetailPage').then((m) => ({ default: m.WorkDetailPage }))
);
const WritingStudioPage = React.lazy(() =>
  import('./pages/work/writing-studio/WritingStudioPage').then((m) => ({ default: m.WritingStudioPage }))
);
const ReviewStudioPage = React.lazy(() =>
  import('./pages/feedback/review-studio/ReviewStudioPage').then((m) => ({ default: m.ReviewStudioPage }))
);
const MediaWorkspacePage = React.lazy(() =>
  import('./pages/work/workspaces/MediaWorkspacePage').then((m) => ({ default: m.MediaWorkspacePage }))
);
const TeamWorkloadPage = React.lazy(() =>
  import('./pages/workload/TeamWorkloadPage').then((m) => ({ default: m.TeamWorkloadPage }))
);
const TeamDirectoryPage = React.lazy(() =>
  import('./pages/team/TeamDirectoryPage').then((m) => ({ default: m.TeamDirectoryPage }))
);
const WorkerProfilePage = React.lazy(() =>
  import('./pages/team/WorkerProfilePage').then((m) => ({ default: m.WorkerProfilePage }))
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
const ReportPrintPage = React.lazy(() =>
  import('./pages/reports/ReportPrintPage').then((m) => ({ default: m.ReportPrintPage }))
);
const ProfileReportPage = React.lazy(() =>
  import('./pages/team/ProfileReportPage').then((m) => ({ default: m.ProfileReportPage }))
);
const ProjectKpiPage = React.lazy(() =>
  import('./pages/reports/ProjectKpiPage').then((m) => ({ default: m.ProjectKpiPage }))
);
const SettingsPage = React.lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ChatPage = React.lazy(() => import('./pages/chat/ChatPage'));

/**
 * RootRedirect: Directs authenticated users according to completion and preferences:
 * 1. If profileCompletedAt is missing/empty -> /welcome
 * 2. If preferences.startPage is set -> 'Home' | 'My Work' | 'Calendar'
 * 3. Default fallback: team_member -> /my-work, all other roles -> /dashboard
 */
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-ui-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Preference-based start page
  const startPage = user.preferences?.startPage;
  if (startPage === 'My Work') {
    return <Navigate to="/my-work" replace />;
  }
  if (startPage === 'Calendar') {
    return <Navigate to="/calendar" replace />;
  }
  if (startPage === 'Home') {
    return <Navigate to={user.role === 'team_member' ? '/my-work' : '/dashboard'} replace />;
  }

  // Role default fallback
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
                    // Executives have no work queue: My Work by URL goes to the dashboard (Phase 6).
                    <ProtectedRoute redirectRoles={{ executive: '/dashboard' }}>
                      <Layout>
                        <MyWorkPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 4: Creative Calendar (Phase 3) */}
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

                {/* Full-screen plan grid: header kept, sidebar hidden. Team members get not-found (API 404s too). */}
                <Route
                  path="/calendar/plan-grid"
                  element={
                    <ProtectedRoute>
                      <Layout focusMode>
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <PlanGridPage />
                        </RoleBoundary>
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

                {/* Writing Studio Workspace (WS2) */}
                <Route
                  path="/work/:id/writing-studio"
                  element={
                    <ProtectedRoute>
                      <WritingStudioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/write"
                  element={
                    <ProtectedRoute>
                      <WritingStudioPage />
                    </ProtectedRoute>
                  }
                />

                {/* Media Workspaces (WS3: Shoot, Edit, Design, Post) */}
                <Route
                  path="/work/:id/workspace"
                  element={
                    <ProtectedRoute>
                      <MediaWorkspacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/shoot"
                  element={
                    <ProtectedRoute>
                      <MediaWorkspacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/edit"
                  element={
                    <ProtectedRoute>
                      <MediaWorkspacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/design"
                  element={
                    <ProtectedRoute>
                      <MediaWorkspacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/post"
                  element={
                    <ProtectedRoute>
                      <MediaWorkspacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work/:id/review"
                  element={
                    <ProtectedRoute>
                      <ReviewStudioPage />
                    </ProtectedRoute>
                  }
                />

                {/* Review Studio Workspace (WS3: Review Cockpit) */}
                <Route
                  path="/feedback/review-studio"
                  element={
                    <ProtectedRoute>
                      <ReviewStudioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/feedback/review"
                  element={
                    <ProtectedRoute>
                      <ReviewStudioPage />
                    </ProtectedRoute>
                  }
                />

                {/* Screen 8: Feedback & Revision History (Phase 5) */}
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <FeedbackPage />
                        </RoleBoundary>
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
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <TeamWorkloadPage />
                        </RoleBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Team Directory & Worker Profiles */}
                <Route
                  path="/team"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <TeamDirectoryPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                {/* Phase 8: a person's report, print layout (admin, creative_head, executive; the API enforces it). */}
                <Route
                  path="/team/:id/report"
                  element={
                    <ProtectedRoute>
                      <ProfileReportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/team/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <WorkerProfilePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Legacy route redirects to /team */}
                <Route
                  path="/team/members/:id/work"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/team" replace />
                    </ProtectedRoute>
                  }
                />

                {/* Screen 10: Todo and Priorities - Merged into /my-work (UX Spec §3) */}
                <Route
                  path="/todo"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/my-work" replace />
                    </ProtectedRoute>
                  }
                />

                {/* Screen 11: Issues and Blockers (Phase 5) */}
                <Route
                  path="/issues"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <IssuesBlockersPage />
                        </RoleBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 14: Reports (Phase 7: live reports, print layout, Project KPI page) */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <ReportsPage />
                        </RoleBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports/print"
                  element={
                    <ProtectedRoute>
                      <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                        <ReportPrintPage />
                      </RoleBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports/projects/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <RoleBoundary hiddenFor={TEAM_MEMBER_HIDDEN}>
                          <ProjectKpiPage />
                        </RoleBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* People Setup -> Redirect to /team */}
                <Route
                  path="/people"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/team" replace />
                    </ProtectedRoute>
                  }
                />

                {/* Legacy Admin Users route alias -> Redirect to /team */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/team" replace />
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

                {/* Legacy First-Login Welcome Screen (Redirected to Profile) */}
                <Route
                  path="/welcome"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/profile" replace />
                    </ProtectedRoute>
                  }
                />

                {/* Profile Page (Polymorphic Worker Profile for Self) */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <WorkerProfilePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Settings Page */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <SettingsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Team Chat Platform */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ChatPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat/:channelId"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ChatPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Legacy /account and /my-account Redirects to /profile */}
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/profile" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-account"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/profile" replace />
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
