import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import {
  DEPARTMENTS,
  JOB_ROLES,
  requestAccessSchema,
  type RequestableRole,
} from '@mmp/shared';
import {
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  X,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { DevQuickLogin, parseQuickLogins, type QuickLoginAccount } from '../components/DevQuickLogin';

// Vite replaces DEV with false in a production build, so this list and its passwords are left out of the bundle.
const QUICK_LOGINS: QuickLoginAccount[] =
  import.meta.env.DEV && import.meta.env.MODE !== 'test' ? parseQuickLogins(import.meta.env.VITE_QUICK_LOGINS) : [];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: string; message: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Pre-fill email and notice if navigated from SetPasswordPage
  useEffect(() => {
    const state = location.state as { email?: string; passwordSet?: boolean } | null;
    if (state?.email) {
      setEmail(state.email);
    }
    if (state?.passwordSet) {
      setSuccessNotice('Password updated successfully! Please sign in with your new password.');
    }
  }, [location.state]);

  // Request Access modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqDept, setReqDept] = useState<string>(DEPARTMENTS[0].name);
  const [reqJobRole, setReqJobRole] = useState<string>(JOB_ROLES[0]);
  const [reqRole, setReqRole] = useState<RequestableRole>('team_member');
  const [reqReason, setReqReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotResetLink, setForgotResetLink] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForgot(true);
    setForgotError(null);
    setForgotSuccess(null);
    setForgotResetLink(null);

    try {
      const cleanForgotEmail = forgotEmail.trim().toLowerCase();
      const res = await apiFetch<{ message?: string; resetLink?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanForgotEmail }),
      });
      setForgotSuccess(res.message || 'If an active account exists with this email address, a password reset link has been dispatched.');
      if (res.resetLink) {
        setForgotResetLink(res.resetLink);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to submit reset request. Please check email address.');
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    return signIn(email, password);
  };

  const signIn = async (signInEmail: string, signInPassword: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    setSuccessNotice(null);

    const cleanEmail = signInEmail.trim().toLowerCase();

    try {
      const loggedUser = await login({ email: cleanEmail, password: signInPassword });
      if (loggedUser.role === 'team_member') {
        navigate('/my-work');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setLoginError({ code: err.code, message: err.message });
      } else {
        setLoginError({ message: err.message || 'Login failed. Please check credentials.' });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReq(true);
    setReqError(null);
    setReqSuccess(null);
    setFieldErrors({});

    const validation = requestAccessSchema.safeParse({
      name: reqName,
      email: reqEmail,
      phone: reqPhone,
      department: reqDept,
      jobRole: reqJobRole,
      requestedRole: reqRole,
      reason: reqReason,
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as string;
        if (fieldName && !errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      });
      setFieldErrors(errors);
      setReqError(validation.error.issues[0]?.message || 'Please check the required fields.');
      setIsSubmittingReq(false);
      return;
    }

    try {
      const res = await apiFetch<{ message?: string }>('/auth/request-access', {
        method: 'POST',
        body: JSON.stringify(validation.data),
      });

      setReqSuccess(res.message || 'Request sent. You will get an email when it is reviewed.');
      setReqName('');
      setReqEmail('');
      setReqPhone('');
      setReqReason('');
      setFieldErrors({});
    } catch (err: any) {
      if (
        err?.code === 'DUPLICATE_PENDING_REQUEST' ||
        (err?.message && err.message.toLowerCase().includes('already pending'))
      ) {
        setReqError('A request for this email is already pending.');
      } else if (
        err?.code === 'USER_EXISTS' ||
        (err?.message && err.message.toLowerCase().includes('already exists'))
      ) {
        setReqError('An account already exists with this email address. Please log in.');
      } else {
        setReqError(err?.message || 'Failed to submit request. Please try again.');
      }
    } finally {
      setIsSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-[440px] z-10">
        {/* Branding header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <img
            src="/haca-forge-logo.png"
            alt="HACA Marketing OS"
            className="h-8 sm:h-9 w-auto object-contain drop-shadow-xs transition-transform duration-200 hover:scale-[1.02]"
          />
          <p className="mt-2 text-xs text-slate-500 font-medium tracking-wide">
            Marketing Operations & Content Workflow Engine
          </p>
        </div>

        {/* Frosted Glass Login Card */}
        <div className="glass-modal p-8 shadow-modal-glass border border-white">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900">
              Sign in to your account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your corporate credentials to access your dashboard
            </p>
          </div>

          {successNotice && (
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 text-emerald-800 text-xs flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span className="font-medium leading-relaxed">{successNotice}</span>
            </div>
          )}

          {loginError && (
            <div
              className={`p-4 rounded-2xl border mb-6 flex items-start gap-3 ${
                loginError.code?.startsWith('ACCESS_REQUEST')
                  ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                  : 'bg-rose-50/80 border-rose-200 text-rose-800'
              }`}
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold block mb-0.5">
                  {loginError.code === 'ACCESS_REQUEST_PENDING'
                    ? 'Pending Approval'
                    : loginError.code === 'ACCESS_REQUEST_REJECTED'
                    ? 'Access Rejected'
                    : loginError.code === 'ACCOUNT_SUSPENDED'
                    ? 'Account Suspended'
                    : 'Authentication Alert'}
                </span>
                {loginError.message}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ui-ink transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotEmail(email);
                    setForgotSuccess(null);
                    setForgotError(null);
                  }}
                  className="text-[11px] font-semibold text-ui-ink hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ui-ink transition-all shadow-xs"
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

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 px-4 bg-[#0d0e12] hover:bg-black text-white font-bold text-xs rounded-full shadow-pill flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


          {/* Request Access Link */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 text-center">
            <p className="text-xs text-slate-500 mb-3">
              Need access to submit requests or view content pipelines?
            </p>
            <button
              type="button"
              onClick={() => {
                setShowRequestModal(true);
                setReqSuccess(null);
                setReqError(null);
              }}
              className="w-full py-2.5 px-4 bg-white/90 hover:bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-full shadow-sm transition-all hover:scale-[1.01]"
            >
              Request Portal Access
            </button>
          </div>
        </div>

        {/* Dev server only: DEV is false in a production build, so the component and the
            account list are dropped from the bundle (checked by Phase9QuickLoginBuild.test). */}
        {import.meta.env.DEV && (
          <DevQuickLogin
            accounts={QUICK_LOGINS}
            busy={isLoggingIn}
            onPick={(account) => {
              setEmail(account.email);
              setPassword('');
              void signIn(account.email, account.password);
            }}
          />
        )}
      </div>

      {/* Request Access Modal (Glassmorphic) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-modal-glass border border-white relative rounded-3xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Request Access</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit your details for Administrator review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reqSuccess ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Request Sent</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Request sent. You will get an email when it is reviewed.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestModal(false);
                    setReqSuccess(null);
                  }}
                  className="mt-4 px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm transition-transform active:scale-95"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestAccess} className="space-y-4">
                {reqError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{reqError}</span>
                  </div>
                )}

                {/* Name & Work Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Jane Doe"
                      className={`w-full px-4 py-2.5 bg-white/90 border ${
                        fieldErrors.name ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'
                      } rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs`}
                    />
                    {fieldErrors.name && (
                      <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className={`w-full px-4 py-2.5 bg-white/90 border ${
                        fieldErrors.email ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'
                      } rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs`}
                    />
                    {fieldErrors.email && (
                      <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Phone & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={reqPhone}
                      onChange={(e) => setReqPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className={`w-full px-4 py-2.5 bg-white/90 border ${
                        fieldErrors.phone ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'
                      } rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs`}
                    />
                    {fieldErrors.phone && (
                      <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department *
                    </label>
                    <select
                      value={reqDept}
                      onChange={(e) => setReqDept(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs cursor-pointer"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept.code} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.department && (
                      <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.department}</p>
                    )}
                  </div>
                </div>

                {/* Job Role & Requested Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Job Role *
                    </label>
                    <select
                      value={reqJobRole}
                      onChange={(e) => setReqJobRole(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs cursor-pointer"
                    >
                      {JOB_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.jobRole && (
                      <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.jobRole}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Requested Role *
                    </label>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as RequestableRole)}
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs cursor-pointer"
                    >
                      <option value="team_member">Team Member</option>
                      <option value="sm_manager">SM Manager</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1 pl-2">
                      Your administrator confirms your final role.
                    </p>
                    {fieldErrors.requestedRole && (
                      <p className="text-[11px] text-rose-600 mt-0.5 pl-2">{fieldErrors.requestedRole}</p>
                    )}
                  </div>
                </div>

                {/* Reason for Access */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason for Access *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Briefly describe your role and the work you will do in the marketing team."
                    className={`w-full p-3.5 bg-white/90 border ${
                      fieldErrors.reason ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'
                    } rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs resize-none`}
                  />
                  {fieldErrors.reason && (
                    <p className="text-[11px] text-rose-600 mt-1 pl-2">{fieldErrors.reason}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReq}
                    className="px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50 flex items-center gap-2 transition-transform active:scale-95"
                  >
                    {isSubmittingReq ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="glass-modal max-w-md w-full p-6 sm:p-8 shadow-modal-glass border border-white relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Reset Password
                </h3>
                <p className="text-xs text-slate-500">
                  Receive a temporary link to set a new password
                </p>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{forgotSuccess}</p>
                </div>

                {forgotResetLink && (
                  <div className="p-4 rounded-2xl bg-ui-card border border-ui-line text-ui-ink text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <Sparkles className="w-4 h-4 text-ui-ink" />
                      <span>Development / Demo Direct Link:</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      In local development, email delivery is in console mode. You can open the set password link directly below:
                    </p>
                    <Link
                      to={forgotResetLink.replace(/^https?:\/\/[^/]+/, '')}
                      onClick={() => setShowForgotModal(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-ui-ink hover:bg-black text-white text-xs font-bold rounded-full shadow-sm transition-transform hover:scale-[1.02]"
                    >
                      <span>Set New Password Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-5 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotError && (
                  <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ui-ink shadow-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForgot || !forgotEmail.trim()}
                    className="px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50"
                  >
                    {isSubmittingForgot ? 'Sending Link...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
