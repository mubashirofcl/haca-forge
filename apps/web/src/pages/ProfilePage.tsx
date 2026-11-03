import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProfileView, ProfileData } from '../components/ProfileView';
import { apiFetch } from '../lib/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: ProfileData }>('/api/me/profile');
      setProfile(res.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse py-6">
        <div className="h-44 bg-slate-200/70 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200/70 rounded-3xl" />
          <div className="h-80 bg-slate-200/70 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to load profile</h2>
        <p className="text-xs text-slate-500">{error || 'User profile data could not be retrieved.'}</p>
        <button
          type="button"
          onClick={fetchProfile}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      <ProfileView
        profile={profile}
        isSelf={true}
        readOnly={false}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          refreshUser();
        }}
      />
    </div>
  );
};
export default ProfilePage;
