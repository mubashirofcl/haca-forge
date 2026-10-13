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
      // Redirect by role
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
      // Reset form
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Marketing Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Unified workspace for requests, calendars & production pipelines
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-200 mb-6">
            Sign in to your account
          </h2>

          {loginError && (
            <div
              className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${
                loginError.code?.startsWith('ACCESS_REQUEST')
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  : 'bg-red-950/40 border-red-800/80 text-red-200'
              }`}
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider & Request Access button */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400 mb-3">
              Need access to submit requests or view content pipelines?
            </p>
            <button
              type="button"
              onClick={() => {
                setShowRequestModal(true);
                setReqSuccess(null);
                setReqError(null);
              }}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Request Portal Access
            </button>
          </div>
        </div>
      </div>

      {/* Request Access Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Request Access</h3>
                <p className="text-xs text-slate-400">
                  Submit your details for Administrator approval
                </p>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {reqSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-white">Application Received</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  {reqSuccess} You will receive an invitation email with a set-password link once an administrator approves your account.
                </p>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestAccess} className="space-y-4">
                {reqError && (
                  <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{reqError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={reqPhone}
                      onChange={(e) => setReqPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqDept}
                      onChange={(e) => setReqDept(e.target.value)}
                      placeholder="Sales / Social / Academics"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Requested Role *
                    </label>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as UserRole)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Skills (comma-separated, optional)
                    </label>
                    <input
                      type="text"
                      value={reqSkills}
                      onChange={(e) => setReqSkills(e.target.value)}
                      placeholder="Reels, Video, Copywriting..."
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Reason for Access *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Briefly state the work you will coordinate through the portal..."
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  ></textarea>
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReq}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center gap-2"
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
