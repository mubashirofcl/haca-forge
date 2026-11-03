import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export const SetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [targetAccount, setTargetAccount] = useState<{ email: string; name: string } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isMatching = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && isMatching;

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      return;
    }

    let isMounted = true;
    apiFetch<{ valid: boolean; email: string; name: string }>(`/auth/verify-token?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (isMounted) {
          setTargetAccount({ email: data.email, name: data.name });
          setSuccessEmail(data.email);
          setIsVerifying(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setVerifyError(err.message || 'Activation link is invalid or has expired.');
          setIsVerifying(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Activation token is missing from the URL.');
      return;
    }

    if (!hasMinLength) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!hasUppercase) {
      setError('Password must contain at least one uppercase letter (A-Z).');
      return;
    }

    if (!hasNumber) {
      setError('Password must contain at least one number (0-9).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiFetch<{ success: boolean; email: string }>('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccessEmail(res.email || targetAccount?.email || '');
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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-[440px] z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src="/haca-forge-logo.png"
            alt="HACA Marketing OS"
            className="h-8 sm:h-9 w-auto object-contain drop-shadow-xs transition-transform duration-200 hover:scale-[1.02] mb-3"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Set Account Password
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Establish your credentials to access HACA Marketing OS
          </p>
        </div>

        <div className="glass-modal p-8 shadow-modal-glass border border-white">
          {isVerifying ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-8 h-8 border-2 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Verifying security token...</p>
            </div>
          ) : !token || verifyError ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Invalid or Expired Link</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {verifyError || 'This reset link does not contain a valid security token. Please request a new password reset link from the sign-in page.'}
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
              <h2 className="text-base font-bold text-slate-900">Password Established!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Password successfully updated for <strong className="text-slate-900">{successEmail}</strong>. You can now sign in with your work email and new password.
              </p>
              <button
                onClick={() =>
                  navigate('/login', {
                    state: { email: successEmail, passwordSet: true },
                  })
                }
                className="w-full mt-4 py-3 bg-[#0d0e12] hover:bg-black text-white font-bold text-xs rounded-full shadow-pill flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {targetAccount && (
                <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl text-xs text-purple-900 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="leading-tight">
                    <span className="font-semibold block text-slate-800">{targetAccount.name}</span>
                    <span className="text-[11px] text-purple-700">{targetAccount.email}</span>
                  </div>
                </div>
              )}

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
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new secure password"
                    className="w-full pl-11 pr-11 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-11 pr-11 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 text-[11px] space-y-1.5">
                <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    ✓
                  </div>
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-2 ${hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasUppercase ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    ✓
                  </div>
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    ✓
                  </div>
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`flex items-center gap-2 ${isMatching ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${isMatching ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    ✓
                  </div>
                  <span>Passwords match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full mt-2 py-3 px-4 bg-[#0d0e12] hover:bg-black text-white font-bold text-xs rounded-full shadow-pill flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {isLoading ? 'Establishing...' : 'Save Password & Proceed'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
