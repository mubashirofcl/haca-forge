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

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AccessRequestsPage } from './pages/admin/AccessRequestsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { TeamsDepartmentsPage } from './pages/admin/TeamsDepartmentsPage';
import { MasterDataPage } from './pages/admin/MasterDataPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { SettingsPage } from './pages/admin/SettingsPage';

import { LeadDashboard } from './pages/lead/LeadDashboard';
import { ContentHubPage } from './pages/lead/ContentHubPage';
import { WorkerDashboard } from './pages/worker/WorkerDashboard';
import { RequesterDashboard } from './pages/requester/RequesterDashboard';
import { ReportsPage } from './pages/reports/ReportsPage';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { SmDashboard } from './pages/calendar/SmDashboard';
import { ShootPlannerPage } from './pages/shoots/ShootPlannerPage';
import { TeamManagementPage } from './pages/team/TeamManagementPage';
import { TimesheetsPage } from './pages/time/TimesheetsPage';

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
    case 'lead':
      return <Navigate to="/lead" replace />;
    case 'worker':
      return <Navigate to="/worker" replace />;
    case 'sm_manager':
      return <Navigate to="/calendar" replace />;
    case 'dept_lead':
    case 'dept_staff':
      return <Navigate to="/requester" replace />;
    case 'viewer':
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
              <ProtectedRoute allowedRoles={['lead', 'admin']}>
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
              <ProtectedRoute allowedRoles={['lead', 'admin']}>
                <Layout>
                  <ContentHubPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Worker Routes */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['worker', 'lead', 'admin']}>
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
              <ProtectedRoute allowedRoles={['admin', 'lead', 'sm_manager']}>
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
              <ProtectedRoute allowedRoles={['admin', 'lead', 'team_lead', 'worker']}>
                <Layout>
                  <ShootPlannerPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute allowedRoles={['admin', 'lead', 'team_lead']}>
                <Layout>
                  <TeamManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timesheets"
            element={
              <ProtectedRoute allowedRoles={['admin', 'lead', 'team_lead', 'worker']}>
                <Layout>
                  <TimesheetsPage />
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
  );
};

export default App;
