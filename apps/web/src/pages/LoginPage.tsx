import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';
import type { UserRole } from '@mmp/shared';
import {
  Sparkles,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  X,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<{ code?: string; message: string } | null>(null);

  // Request Access modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqDept, setReqDept] = useState('');
  const [reqRole, setReqRole] = useState<UserRole>('dept_staff');
  const [reqSkills, setReqSkills] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [reqSuccess, setReqSuccess] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const loggedUser = await login({ email, password });
      switch (loggedUser.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'lead':
          navigate('/lead');
          break;
        case 'worker':
          navigate('/worker');
          break;
        case 'sm_manager':
        case 'dept_lead':
        case 'dept_staff':
          navigate('/requester');
          break;
        case 'viewer':
          navigate('/reports');
          break;
        default:
          navigate('/requester');
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

    try {
      const skillsArray = reqSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiFetch('/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({
          name: reqName,
          email: reqEmail,
          phone: reqPhone,
          department: reqDept,
          requestedRole: reqRole,
          skills: skillsArray,
          reason: reqReason,
        }),
      });

      setReqSuccess(res.message || 'Your access request was successfully submitted!');
      setReqName('');
      setReqEmail('');
      setReqPhone('');
      setReqDept('');
      setReqSkills('');
      setReqReason('');
    } catch (err: any) {
      setReqError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-[440px] z-10">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7a6af6] to-[#4f46e5] shadow-lg shadow-[#7a6af6]/25 mb-4 hover:scale-105 transition-transform">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Marketing Portal
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 font-medium">
            Antigravity Workflow Engine & Pipeline Management
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-full text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] transition-all shadow-xs"
                />
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
      </div>

      {/* Request Access Modal (Glassmorphic) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-modal-glass border border-white relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Access</h3>
                <p className="text-xs text-slate-500">
                  Submit your details for Administrator review and team assignment
                </p>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reqSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Application Received</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  {reqSuccess} You will receive an invitation email with a set-password link once an administrator approves your account.
                </p>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="mt-4 px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm"
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
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    />
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
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    />
                  </div>
                </div>

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
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqDept}
                      onChange={(e) => setReqDept(e.target.value)}
                      placeholder="Sales / Social / Academics"
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Requested Role *
                    </label>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as UserRole)}
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    >
                      <option value="dept_staff">Department Staff (Requester)</option>
                      <option value="dept_lead">Department Lead</option>
                      <option value="sm_manager">Social Media Manager</option>
                      <option value="worker">Production Worker (Designer/Editor/Writer)</option>
                      <option value="lead">Marketing Manager / Lead</option>
                      <option value="viewer">Management Viewer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Skills (comma-separated, optional)
                    </label>
                    <input
                      type="text"
                      value={reqSkills}
                      onChange={(e) => setReqSkills(e.target.value)}
                      placeholder="Reels, Video, Copywriting..."
                      className="w-full px-4 py-2.5 bg-white/90 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason for Access *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Briefly state the work you will coordinate through the portal..."
                    className="w-full p-3.5 bg-white/90 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-xs resize-none"
                  ></textarea>
                </div>

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReq}
                    className="px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingReq ? 'Submitting...' : 'Submit Request'}
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
