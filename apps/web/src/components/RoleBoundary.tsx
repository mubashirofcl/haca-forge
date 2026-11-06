import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { UserRole } from '@mmp/shared';
import { useAuth } from '../context/AuthContext';

/** The same not-found state team members already get on `/team/:id`. It does not
 *  confirm the page exists. */
export const NotFoundState: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="glass-card max-w-xl mx-auto my-16 p-8 text-center space-y-4">
      <AlertTriangle className="w-10 h-10 text-ui-muted mx-auto" aria-hidden="true" />
      <h1 className="text-base font-bold text-ui-ink">Page Not Found</h1>
      <p className="text-xs text-ui-muted">The requested page is not accessible or does not exist.</p>
      <button type="button" onClick={() => navigate('/')} className="ui-btn ui-btn-primary h-11">
        Return Home
      </button>
    </div>
  );
};

/** Frontend boundary only: the page (and its data requests) never mounts for the
 *  listed roles. The API keeps its own checks. */
export const RoleBoundary: React.FC<{ hiddenFor: UserRole[]; children: React.ReactNode }> = ({
  hiddenFor,
  children,
}) => {
  const { user } = useAuth();
  if (user && hiddenFor.includes(user.role)) return <NotFoundState />;
  return <>{children}</>;
};
