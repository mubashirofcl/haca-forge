import React, { useState, useEffect } from 'react';
import {
  Shield,
  Bell,
  Sliders,
  Laptop,
  Smartphone,
  Key,
  Check,
  AlertCircle,
  Lock,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  START_PAGE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  WEEK_START_OPTIONS,
  StartPageOption,
  DateFormatOption,
  TimeFormatOption,
  WeekStartOption,
} from '@mmp/shared';

interface SessionItem {
  id: string;
  _id?: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'security' | 'notifications' | 'preferences'>('security');

  // Security - Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Security - Sessions State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState({
    mySteps: { inApp: true, email: true },
    approvalsRevisions: { inApp: true, email: true },
    messagesComments: { inApp: true, email: true },
    deadlinesOverdue: { inApp: true, email: true },
    planUpdates: { inApp: true, email: true },
    system: { inApp: true, email: true },
    chat: { inApp: true, email: false, mentionsOnly: false },
  });
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsSuccess, setNotifsSuccess] = useState<string | null>(null);

  // Preferences State
  const [preferences, setPreferences] = useState({
    startPage: 'Home' as StartPageOption,
    dateFormat: 'DD/MM/YYYY' as DateFormatOption,
    timeFormat: '12h' as TimeFormatOption,
    weekStart: 'monday' as WeekStartOption,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);

  // Load Settings and Sessions on mount
  const fetchSettingsAndSessions = async () => {
    setLoadingSessions(true);
    try {
      const [settingsRes, sessionsRes] = await Promise.allSettled([
        apiFetch<{ data: any }>('/api/me/settings'),
        apiFetch<{ data: SessionItem[] }>('/api/me/sessions'),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        const d = settingsRes.value.data;
        if (d.preferences) {
          setPreferences({
            startPage: d.preferences.startPage || 'Home',
            dateFormat: d.preferences.dateFormat || 'DD/MM/YYYY',
            timeFormat: d.preferences.timeFormat || '12h',
            weekStart: d.preferences.weekStart || 'monday',
          });
        }
        if (d.notificationPrefs) {
          setNotifPrefs((prev) => ({
            ...prev,
            ...d.notificationPrefs,
          }));
        }
      }

      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value.data)) {
        setSessions(sessionsRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndSessions();
  }, []);

  // Password Validation
  const hasMinLength = passwordForm.newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordForm.newPassword);
  const hasNumber = /[0-9]/.test(passwordForm.newPassword);
  const isDifferent =
    Boolean(passwordForm.newPassword) &&
    passwordForm.newPassword !== passwordForm.currentPassword;
  const isMatching =
    Boolean(passwordForm.confirmPassword) &&
    passwordForm.newPassword === passwordForm.confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && isDifferent && isMatching;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword) {
      setPasswordErrors({ currentPassword: 'Enter your current password.' });
      return;
    }
    if (!isPasswordValid) {
      setPasswordErrors({ form: 'Please ensure all password requirements are satisfied.' });
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });

      setPasswordSuccess('Password updated successfully. A security confirmation email has been dispatched.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordErrors({ form: err?.message || 'Failed to update password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  // Revoke Single Device Session
  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to sign out this device?')) return;
    setRevokingId(sessionId);
    try {
      const res = await apiFetch<{ success: boolean; isCurrent?: boolean }>(
        `/api/me/sessions/${sessionId}`,
        { method: 'DELETE' }
      );
      if (res.isCurrent) {
        window.location.href = '/login';
        return;
      }
      setSessions((prev) => prev.filter((s) => (s.id || s._id) !== sessionId));
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  // Revoke All Other Sessions
  const handleRevokeOtherSessions = async () => {
    if (!window.confirm('Sign out all other active devices? You will remain signed in on this device.')) return;
    setRevokingOthers(true);
    try {
      await apiFetch('/api/me/sessions/revoke-others', { method: 'POST' });
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke other sessions');
    } finally {
      setRevokingOthers(false);
    }
  };

  // Save Notification Preferences
  const handleSaveNotifications = async () => {
    setSavingNotifs(true);
    setNotifsSuccess(null);
    try {
      await apiFetch('/api/me/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPrefs: notifPrefs }),
      });
      setNotifsSuccess('Notification preferences saved successfully.');
      setTimeout(() => setNotifsSuccess(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save notification preferences');
    } finally {
      setSavingNotifs(false);
    }
  };

  // Save General Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSuccess(null);
    try {
      await apiFetch('/api/me/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      setPrefsSuccess('Preferences saved successfully.');
      setTimeout(() => setPrefsSuccess(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Role Category Visibility
  const role = user?.role || 'team_member';
  const isAdmin = role === 'admin';
  const isCreativeHead = role === 'creative_head';
  const isSMManager = role === 'sm_manager';
  const isExecutive = role === 'executive';
  const isTeamMember = role === 'team_member';

  const notificationCategories = [
    {
      key: 'mySteps',
      label: 'My steps and task handoffs',
      desc: 'When tasks are assigned, stages unlock, or handoffs are ready',
      visible: isTeamMember || isSMManager || isCreativeHead || isAdmin,
    },
    {
      key: 'approvalsRevisions',
      label: 'Approvals & revision requests',
      desc: 'When work requires review or creative feedback notes are returned',
      visible: isCreativeHead || isSMManager || isExecutive || isAdmin,
    },
    {
      key: 'messagesComments',
      label: 'Messages, threads & comments',
      desc: 'Direct discussions in Writing Studio, Media Workspaces, or Review Studio',
      visible: isTeamMember || isCreativeHead || isSMManager || isAdmin,
    },
    {
      key: 'deadlinesOverdue',
      label: 'Deadlines & overdue escalations',
      desc: '24-hour advance warnings and overdue notifications',
      visible: true, // Visible to all roles
    },
    {
      key: 'planUpdates',
      label: 'Content plan updates',
      desc: 'Monthly and individual plan submissions, approvals, and row changes',
      visible: isSMManager || isCreativeHead || isExecutive || isAdmin,
    },
    {
      key: 'chat',
      label: 'Team Chat & Group messages',
      desc: 'Notifications for messages, replies, and mentions across team conversations',
      visible: true,
      hasMentionsOnly: true,
    },
    {
      key: 'system',
      label: 'System & user access requests',
      desc: 'Candidate access requests and organization maintenance alerts',
      visible: isAdmin, // Strictly Admins
    },
  ].filter((c) => c.visible);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div>
        <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">Settings</h1>
        <p className="text-xs sm:text-sm text-ui-muted mt-1">
          Manage your account security, active devices, notifications, and application preferences
        </p>
      </div>

      {/* Main Layout: Left Tab Bar on Desktop, Stacked List on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Tabs (Desktop Left List / Mobile Stacked Row) */}
        <div className="glass-card p-2 flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            aria-pressed={activeTab === 'security'}
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-full text-[13px] font-semibold transition-colors text-left whitespace-nowrap min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink ${
              activeTab === 'security'
                ? 'bg-ui-ink text-white'
                : 'text-ui-text hover:text-ui-ink hover:bg-white/60'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Security & Devices</span>
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-full text-[13px] font-semibold transition-colors text-left whitespace-nowrap min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink ${
              activeTab === 'notifications'
                ? 'bg-ui-ink text-white'
                : 'text-ui-text hover:text-ui-ink hover:bg-white/60'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'preferences'}
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-full text-[13px] font-semibold transition-colors text-left whitespace-nowrap min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink ${
              activeTab === 'preferences'
                ? 'bg-ui-ink text-white'
                : 'text-ui-text hover:text-ui-ink hover:bg-white/60'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Tab Content Panel (3 Columns Wide) */}
        <div className="md:col-span-3 space-y-6">
          {/* TAB 1: SECURITY & SESSIONS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password Card */}
              <div className="glass-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ui-line">
                  <div className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ui-ink">Change Password</h2>
                    <p className="text-xs text-ui-muted">Update your account authentication credentials</p>
                  </div>
                </div>

                {passwordSuccess && (
                  <div role="status" className="p-3.5 rounded-2xl status-tint status-approved text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordErrors.form && (
                  <div role="alert" className="p-3.5 rounded-2xl status-tint status-changes text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{passwordErrors.form}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="current-password-input" className="block text-xs font-bold text-ui-text mb-1">
                      Current Password
                    </label>
                    <input
                      id="current-password-input"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      className="ui-input w-full min-h-[44px]"
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-xs font-semibold mt-1 rounded-lg px-2 py-1 status-tint status-changes">{passwordErrors.currentPassword}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-password-input" className="block text-xs font-bold text-ui-text mb-1">
                        New Password
                      </label>
                      <input
                        id="new-password-input"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="ui-input w-full min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirm-password-input" className="block text-xs font-bold text-ui-text mb-1">
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-password-input"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="ui-input w-full min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Password Rules Checklist */}
                  <div className="p-4 rounded-2xl bg-white/60 border border-ui-line text-xs space-y-1.5">
                    <p className="font-bold text-ui-text mb-2">Password Requirements:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#1e5a3c] font-bold' : 'text-ui-muted'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasMinLength ? 'status-chip status-approved' : 'bg-ui-ink/10'}`}>
                          {hasMinLength ? '✓' : '•'}
                        </div>
                        <span>At least 8 characters</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-[#1e5a3c] font-bold' : 'text-ui-muted'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasUppercase ? 'status-chip status-approved' : 'bg-ui-ink/10'}`}>
                          {hasUppercase ? '✓' : '•'}
                        </div>
                        <span>At least one letter</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-[#1e5a3c] font-bold' : 'text-ui-muted'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasNumber ? 'status-chip status-approved' : 'bg-ui-ink/10'}`}>
                          {hasNumber ? '✓' : '•'}
                        </div>
                        <span>At least one number</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${isDifferent ? 'text-[#1e5a3c] font-bold' : 'text-ui-muted'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isDifferent ? 'status-chip status-approved' : 'bg-ui-ink/10'}`}>
                          {isDifferent ? '✓' : '•'}
                        </div>
                        <span>Different from current password</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-ui-muted flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-ui-muted" />
                    <span>A mandatory security notice will be emailed to you whenever your password changes.</span>
                  </p>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingPassword || !isPasswordValid}
                      className="ui-btn ui-btn-primary h-11"
                    >
                      {savingPassword ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Devices & Sessions Card */}
              <div className="glass-card p-6 sm:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-line">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-ui-ink">Active Devices & Sessions</h2>
                      <p className="text-xs text-ui-muted">Manage signed-in browsers and revoke remote devices</p>
                    </div>
                  </div>

                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleRevokeOtherSessions}
                      disabled={revokingOthers}
                      className="ui-btn ui-btn-secondary h-11 self-start sm:self-auto"
                    >
                      {revokingOthers ? 'Signing out...' : 'Sign out all other devices'}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {loadingSessions ? (
                    <p className="text-xs text-ui-muted italic py-4 text-center">Loading active devices...</p>
                  ) : !Array.isArray(sessions) || sessions.length === 0 ? (
                    <p className="text-xs text-ui-muted italic py-4 text-center">No active sessions recorded.</p>
                  ) : (
                    sessions.map((sess) => {
                      const id = sess.id || sess._id || '';
                      const isMobile = /android|iphone|ipad|mobile/i.test(sess.deviceLabel);

                      return (
                        <div
                          key={id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-ui-line gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white text-ui-text border border-ui-line flex items-center justify-center shrink-0">
                              {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-ui-ink">{sess.deviceLabel}</p>
                                {sess.isCurrent && (
                                  <span className="status-chip status-approved text-[11px] font-semibold px-2 py-0.5">
                                    This device
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-ui-muted mt-0.5">
                                Last active: {sess.lastUsedAt ? new Date(sess.lastUsedAt).toLocaleString() : 'Recently'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center self-end sm:self-auto">
                            {!sess.isCurrent ? (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(id)}
                                disabled={revokingId === id}
                                className="ui-btn ui-btn-secondary h-11"
                              >
                                {revokingId === id ? 'Signing out...' : 'Sign Out'}
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-ui-muted px-3 py-1">Active Now</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="glass-card p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-ui-line">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ui-ink">Notification Preferences</h2>
                    <p className="text-xs text-ui-muted">Configure in-app and email delivery switches per category</p>
                  </div>
                </div>
              </div>

              {notifsSuccess && (
                <div role="status" className="p-3.5 rounded-2xl status-tint status-approved text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{notifsSuccess}</span>
                </div>
              )}

              {/* Table / List Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-ui-muted px-2">
                  <span>Category</span>
                  <div className="flex items-center gap-8">
                    <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> In-App</span>
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                  </div>
                </div>

                {notificationCategories.map((cat) => {
                  const prefs = notifPrefs[cat.key as keyof typeof notifPrefs] || { inApp: true, email: true };

                  return (
                    <div
                      key={cat.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-ui-line gap-3 transition-colors"
                    >
                      <div className="pr-4">
                        <p className="text-xs font-bold text-ui-ink">{cat.label}</p>
                        <p className="text-[11px] text-ui-muted mt-0.5">{cat.desc}</p>
                        {cat.hasMentionsOnly && (
                          <label className="mt-2 inline-flex items-center gap-2 text-xs text-ui-text cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean((prefs as any).mentionsOnly)}
                              onChange={(e) =>
                                setNotifPrefs((prev) => ({
                                  ...prev,
                                  [cat.key]: {
                                    ...(prev[cat.key as keyof typeof prev] as any),
                                    mentionsOnly: e.target.checked,
                                  },
                                }))
                              }
                              className="w-3.5 h-3.5 rounded text-ui-ink focus:ring-ui-ink cursor-pointer"
                            />
                            <span className="font-medium text-ui-text">Mentions only (mute non-mention messages)</span>
                          </label>
                        )}
                      </div>

                      <div className="flex items-center gap-10 shrink-0 self-end sm:self-auto pr-2">
                        {/* In-App Toggle */}
                        <label className="flex items-center cursor-pointer min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={prefs.inApp}
                            onChange={(e) =>
                              setNotifPrefs((prev) => ({
                                ...prev,
                                [cat.key]: {
                                  ...(prev[cat.key as keyof typeof prev] as any),
                                  inApp: e.target.checked,
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-ui-ink focus:ring-ui-ink cursor-pointer"
                          />
                        </label>

                        {/* Email Toggle */}
                        <label className="flex items-center cursor-pointer min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={prefs.email}
                            onChange={(e) =>
                              setNotifPrefs((prev) => ({
                                ...prev,
                                [cat.key]: {
                                  ...(prev[cat.key as keyof typeof prev] as any),
                                  email: e.target.checked,
                                },
                              }))
                            }
                            className="w-4 h-4 rounded text-ui-ink focus:ring-ui-ink cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Security Notices Note */}
              <div className="p-4 rounded-2xl bg-white/60 border border-ui-line text-xs text-ui-muted flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-ui-muted shrink-0 mt-0.5" />
                <span>
                  <strong>Security alerts cannot be disabled:</strong> Mandatory notifications regarding password updates, new device logins, and session revocations will always be dispatched to safeguard your account.
                </span>
              </div>

              <div className="flex justify-end pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={savingNotifs}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {savingNotifs ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: APPLICATION PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="glass-card p-6 sm:p-7 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-ui-line">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/70 text-ui-ink flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ui-ink">Regional & Interface Preferences</h2>
                    <p className="text-xs text-ui-muted">Configure your landing page, date, and calendar formats</p>
                  </div>
                </div>
              </div>

              {prefsSuccess && (
                <div role="status" className="p-3.5 rounded-2xl status-tint status-approved text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{prefsSuccess}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Start Page */}
                <div>
                  <label className="block text-xs font-bold text-ui-text mb-1">
                    Start Page / Default Start Screen (Landing after sign-in)
                  </label>
                  <select
                    value={preferences.startPage}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, startPage: e.target.value as StartPageOption }))
                    }
                    className="ui-select w-full min-h-[44px]"
                  >
                    {START_PAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} {opt === 'Home' ? (isTeamMember ? '(Team Member Home)' : '(Dashboard)') : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date & Time Formats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ui-text mb-1">
                      Date Format
                    </label>
                    <select
                      value={preferences.dateFormat}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, dateFormat: e.target.value as DateFormatOption }))
                      }
                      className="ui-select w-full min-h-[44px]"
                    >
                      {DATE_FORMAT_OPTIONS.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ui-text mb-1">
                      Time Format
                    </label>
                    <select
                      value={preferences.timeFormat}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, timeFormat: e.target.value as TimeFormatOption }))
                      }
                      className="ui-select w-full min-h-[44px]"
                    >
                      {TIME_FORMAT_OPTIONS.map((fmt) => (
                        <option key={fmt} value={fmt}>
                          {fmt === '12h' ? '12-hour (e.g. 02:30 PM)' : '24-hour (e.g. 14:30)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Week Starts On */}
                <div>
                  <label className="block text-xs font-bold text-ui-text mb-1">
                    Week Starts On (Calendar & Weekly Views)
                  </label>
                  <select
                    value={preferences.weekStart}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, weekStart: e.target.value as WeekStartOption }))
                    }
                    className="ui-select w-full min-h-[44px]"
                  >
                    {WEEK_START_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'monday' ? 'Monday' : 'Sunday'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-ui-line">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  className="ui-btn ui-btn-primary h-11"
                >
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
