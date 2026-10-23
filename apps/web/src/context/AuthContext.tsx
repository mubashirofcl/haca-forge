import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import type { UserRole, PermissionKey } from '@mmp/shared';

export interface User {
  id: string;
  _id?: string;
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  departmentId?: string;
  teamId?: string;
  team?: string;
  skills: string[];
  capacity: number;
  attendance: string;
  jobRole?: string;
  profileAccess?: string[];
  lastProfileId?: string;
  workPreferences?: string[];
}

interface AuthContextType {
  user: User | null;
  permissions: PermissionKey[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User; role: UserRole; permissions: PermissionKey[] }>('/auth/me');
      setUser(data.user);
      setPermissions(data.permissions || []);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ user: User; permissions: PermissionKey[] }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setUser(data.user);
      setPermissions(data.permissions || []);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function usePermission(permission: PermissionKey) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
