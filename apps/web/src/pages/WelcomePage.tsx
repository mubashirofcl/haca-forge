import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { AvatarCropModal } from '../components/AvatarCropModal';
import { apiFetch } from '../lib/api';

export const WelcomePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Phone validation
  const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
  const isPhoneValid = /^\+?[1-9]\d{6,14}$/.test(cleanedPhone);
  const isNameValid = name.trim().length >= 2;
  const canSubmit = isNameValid && isPhoneValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch('/api/me/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanedPhone,
          avatarUrl,
        }),
      });

      await refreshUser();

      // Navigate to user's home or start page
      if (user?.role === 'team_member') {
        navigate('/my-work');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ui-ink text-white relative">
      <div className="glass-modal max-w-lg w-full p-8 sm:p-10 rounded-3xl border border-white/20 shadow-2xl relative space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-white border border-white/20">
            Welcome Setup
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Welcome to Marketing OS
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Please complete your profile details before entering your workspace.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Upload (Optional) */}
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div className="relative group cursor-pointer" onClick={() => setIsCropModalOpen(true)}>
              <Avatar
                url={avatarUrl}
                name={name || 'User'}
                userId={user?._id}
                size="xl"
                className="ring-4 ring-white/30 shadow-2xl"
              />
              <div className="absolute inset-0 rounded-full bg-slate-950/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                <Camera className="w-6 h-6 text-white" />
                <span className="text-[10px] font-bold mt-1 text-white">Add Photo</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCropModalOpen(true)}
              className="text-xs font-semibold text-white underline hover:no-underline"
            >
              {avatarUrl ? 'Change Photo' : 'Upload Photo (Optional)'}
            </button>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Full Legal Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white min-h-[44px]"
            />
          </div>

          {/* Mobile Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Mobile Phone Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white min-h-[44px]"
            />
            {phone && !isPhoneValid && (
              <p className="text-xs text-rose-300 font-semibold mt-1">
                Please enter a valid phone number with country code (e.g. +919876543210).
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-ui-card disabled:opacity-40 disabled:hover:bg-white text-ui-ink font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
            >
              {submitting ? (
                <span>Setting up your workspace...</span>
              ) : (
                <>
                  <span>Complete & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <AvatarCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          currentAvatarUrl={avatarUrl}
          onAvatarUpdated={(newUrl) => setAvatarUrl(newUrl)}
        />
      </div>
    </div>
  );
};
export default WelcomePage;
