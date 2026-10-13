import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AccessRequestsPage } from './pages/admin/AccessRequestsPage';
import { UsersPage } from './pages/admin/UsersPage';

import { LeadDashboard } from './pages/lead/LeadDashboard';
import { WorkerDashboard } from './pages/worker/WorkerDashboard';
import { RequesterDashboard } from './pages/requester/RequesterDashboard';
import { ReportsPage } from './pages/reports/ReportsPage';

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
  );
};

export default App;
