import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30s
    },
  },
});

import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

// Lazy-loaded role dashboards and application pages for code splitting
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AccessRequestsPage = React.lazy(() => import('./pages/admin/AccessRequestsPage').then((m) => ({ default: m.AccessRequestsPage })));
const UsersPage = React.lazy(() => import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const TeamsDepartmentsPage = React.lazy(() => import('./pages/admin/TeamsDepartmentsPage').then((m) => ({ default: m.TeamsDepartmentsPage })));
const MasterDataPage = React.lazy(() => import('./pages/admin/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const AuditLogPage = React.lazy(() => import('./pages/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const SettingsPage = React.lazy(() => import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const LeadDashboard = React.lazy(() => import('./pages/lead/LeadDashboard').then((m) => ({ default: m.LeadDashboard })));
const ContentHubPage = React.lazy(() => import('./pages/lead/ContentHubPage').then((m) => ({ default: m.ContentHubPage })));
const WorkerDashboard = React.lazy(() => import('./pages/worker/WorkerDashboard').then((m) => ({ default: m.WorkerDashboard })));
const RequesterDashboard = React.lazy(() => import('./pages/requester/RequesterDashboard').then((m) => ({ default: m.RequesterDashboard })));
const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const CalendarPage = React.lazy(() => import('./pages/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const SmDashboard = React.lazy(() => import('./pages/calendar/SmDashboard').then((m) => ({ default: m.SmDashboard })));
const ShootPlannerPage = React.lazy(() => import('./pages/shoots/ShootPlannerPage').then((m) => ({ default: m.ShootPlannerPage })));
const TeamManagementPage = React.lazy(() => import('./pages/team/TeamManagementPage').then((m) => ({ default: m.TeamManagementPage })));
const TimesheetsPage = React.lazy(() => import('./pages/time/TimesheetsPage').then((m) => ({ default: m.TimesheetsPage })));
const LeadReviewQueuePage = React.lazy(() => import('./pages/lead/LeadReviewQueuePage').then((m) => ({ default: m.LeadReviewQueuePage })));
const PerformanceDashboard = React.lazy(() => import('./pages/performance/PerformanceDashboard').then((m) => ({ default: m.PerformanceDashboard })));
const FileLibraryPage = React.lazy(() => import('./pages/library/FileLibraryPage').then((m) => ({ default: m.FileLibraryPage })));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'head':
      return <Navigate to="/lead" replace />;
    case 'team_lead':
      return <Navigate to="/teams" replace />;
    case 'worker':
      return <Navigate to="/worker" replace />;
    case 'sm_manager':
      return <Navigate to="/calendar" replace />;
    case 'dept_lead':
    case 'dept_staff':
      return <Navigate to="/requester" replace />;
    case 'management':
      return <Navigate to="/reports" replace />;
    default:
      return <Navigate to="/requester" replace />;
  }
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <React.Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Root Role Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredPermission="user.manage">
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teams-departments"
            element={
              <ProtectedRoute requiredPermission="settings.manage">
                <Layout>
                  <TeamsDepartmentsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/master-data"
            element={
              <ProtectedRoute requiredPermission="settings.manage">
                <Layout>
                  <MasterDataPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute requiredPermission="audit.view">
                <Layout>
                  <AuditLogPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requiredPermission="settings.manage">
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Lead Routes */}
          <Route
            path="/lead"
            element={
              <ProtectedRoute allowedRoles={['head', 'admin']}>
                <Layout>
                  <LeadDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead/inbox"
            element={
              <ProtectedRoute requiredPermission="request.triage">
                <Layout>
                  <LeadDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead/content"
            element={
              <ProtectedRoute allowedRoles={['head', 'admin']}>
                <Layout>
                  <ContentHubPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead/reviews"
            element={
              <ProtectedRoute allowedRoles={['head', 'admin', 'team_lead']}>
                <Layout>
                  <LeadReviewQueuePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Worker Routes */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['worker', 'head', 'admin']}>
                <Layout>
                  <WorkerDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Requester Routes */}
          <Route
            path="/requester"
            element={
              <ProtectedRoute>
                <Layout>
                  <RequesterDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/requester/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <RequesterDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Content Calendar & SM Operations Routes */}
          <Route
            path="/calendar"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'sm_manager']}>
                <Layout>
                  <CalendarPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sm/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'sm_manager']}>
                <Layout>
                  <SmDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Phase 6 Routes: Shoots, Team Management & Timesheets */}
          <Route
            path="/shoots"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'team_lead', 'worker']}>
                <Layout>
                  <ShootPlannerPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'team_lead']}>
                <Layout>
                  <TeamManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timesheets"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'team_lead', 'worker']}>
                <Layout>
                  <TimesheetsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Phase 7 Routes: Review Studio, Performance Marketing & DAM Library */}
          <Route
            path="/performance"
            element={
              <ProtectedRoute allowedRoles={['admin', 'head', 'dept_lead']}>
                <Layout>
                  <PerformanceDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <Layout>
                  <FileLibraryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Reports Routes */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredPermission="report.view">
                <Layout>
                  <ReportsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Notifications Center Page */}
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
