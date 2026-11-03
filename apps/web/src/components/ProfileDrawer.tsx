import React, { useState, useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { ProfileView, ProfileData } from './ProfileView';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string | null;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  personId,
}) => {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !personId) {
      setProfile(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch<{ data: ProfileData }>(`/api/people/${personId}/profile`)
      .then((res) => {
        if (isMounted) {
          setProfile(res.data);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError({
            message: err?.message || 'Failed to load profile details.',
            code: err?.code,
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, personId]);

  if (!isOpen) return null;

  const isSelf = Boolean(
    currentUser &&
      personId &&
      ((currentUser as any).id === personId || (currentUser as any)._id === personId)
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-2xl w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div className="w-full bg-slate-50/95 border-l border-white/80 shadow-2xl backdrop-blur-2xl pointer-events-auto flex flex-col h-full animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200/80 bg-white/70 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Teammate Profile</h2>
              <p className="text-xs text-slate-500">Read-only operational identity and craftsmanship details</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loading && (
              <div className="space-y-4 animate-pulse py-8">
                <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto" />
                <div className="h-6 w-48 bg-slate-200 rounded-xl mx-auto" />
                <div className="h-32 bg-slate-200 rounded-3xl" />
                <div className="h-32 bg-slate-200 rounded-3xl" />
              </div>
            )}

            {error && (
              <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3 text-center my-8">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold">Profile Access Restricted</h3>
                <p className="text-xs text-rose-600 max-w-md mx-auto">
                  {error.code === 'FORBIDDEN_TEAMMATE_OUTSIDE_SHARED_PIECE'
                    ? 'Teammate profile views are restricted to collaborators assigned to the same content piece.'
                    : error.message}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  Close Drawer
                </button>
              </div>
            )}

            {!loading && !error && profile && (
              <ProfileView
                profile={profile}
                isSelf={isSelf}
                readOnly={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
