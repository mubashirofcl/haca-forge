import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { PermissionKey, UserRole } from '@mmp/shared';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionKey;
  allowedRoles?: UserRole[];
  /** Roles sent elsewhere instead of shown this page, e.g. { executive: '/dashboard' }. */
  redirectRoles?: Partial<Record<UserRole, string>>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  allowedRoles,
  redirectRoles,
}) => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-modal p-8 shadow-modal-glass flex flex-col items-center gap-4 border border-white">
          <div className="w-10 h-10 border-4 border-ui-ink border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-700">Verifying security credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const redirectTo = redirectRoles?.[user.role];
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
