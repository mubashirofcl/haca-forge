import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const SetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Activation token is missing from the URL.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setIsSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err.message || 'Failed to set password. Token may have expired.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-[440px] z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7a6af6] to-[#4f46e5] shadow-lg shadow-[#7a6af6]/25 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Activate Account
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 font-medium">
            Establish your password to enter the Marketing Portal
          </p>
        </div>

        <div className="glass-modal p-8 shadow-modal-glass border border-white">
          {!token ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Invalid Activation Link</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                This activation link does not contain a valid security token. Please check the link from your invitation email or request access again.
              </p>
              <Link
                to="/login"
                className="inline-block mt-2 px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm"
              >
                Return to Sign In
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Account Activated!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your password has been successfully established. You can now sign in with your work email and new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-4 py-3 bg-[#0d0e12] hover:bg-black text-white font-bold text-xs rounded-full shadow-pill flex items-center justify-center gap-2"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters (1 uppercase, 1 number)"
                    className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-[#0d0e12] hover:bg-black text-white font-bold text-xs rounded-full shadow-pill flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {isLoading ? 'Activating...' : 'Set Password & Activate'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
