import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface GlobalFilterState {
  profileId: string;
  departmentId: string;
  ownerId: string;
  month: string;
  status: string;
}

interface GlobalFilterContextType {
  filters: GlobalFilterState;
  setFilter: (key: keyof GlobalFilterState, value: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  queryParams: Record<string, string>;
}

export const defaultFilters: GlobalFilterState = {
  profileId: 'all',
  departmentId: 'all',
  ownerId: 'all',
  month: new Date().toISOString().slice(0, 7),
  status: 'all',
};

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

export const GlobalFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current filters from URL search params with defaults
  const filters: GlobalFilterState = useMemo(() => ({
    profileId: searchParams.get('profileId') || 'all',
    departmentId: searchParams.get('departmentId') || 'all',
    ownerId: searchParams.get('ownerId') || 'all',
    month: searchParams.get('month') || new Date().toISOString().slice(0, 7),
    status: searchParams.get('status') || 'all',
  }), [searchParams]);

  const setFilter = useCallback(
    (key: keyof GlobalFilterState, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === 'all') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('profileId');
        next.delete('departmentId');
        next.delete('ownerId');
        next.delete('month');
        next.delete('status');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.profileId !== 'all') count++;
    if (filters.departmentId !== 'all') count++;
    if (filters.ownerId !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.profileId !== 'all') params.profileId = filters.profileId;
    if (filters.departmentId !== 'all') params.departmentId = filters.departmentId;
    if (filters.ownerId !== 'all') params.ownerId = filters.ownerId;
    if (filters.month) params.month = filters.month;
    if (filters.status !== 'all') params.status = filters.status;
    return params;
  }, [filters]);

  return (
    <GlobalFilterContext.Provider
      value={{
        filters,
        setFilter,
        resetFilters,
        activeFilterCount,
        queryParams,
      }}
    >
      {children}
    </GlobalFilterContext.Provider>
  );
};

export const useGlobalFilter = () => {
  const context = useContext(GlobalFilterContext);
  if (!context) {
    throw new Error('useGlobalFilter must be used within a GlobalFilterProvider');
  }
  return context;
};
