import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, Check } from 'lucide-react';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [emailPrefs, setEmailPrefs] = useState({
    requestUpdates: true,
    taskAssigned: true,
    taskBlocked: true,
    reviewDecisions: true,
    deadlineReminders: true,
    dailyDigest: true,
  });

  const [inAppPrefs, setInAppPrefs] = useState({
    requestUpdates: true,
    taskAssigned: true,
    taskBlocked: true,
    reviewDecisions: true,
    deadlineReminders: true,
    mentions: true,
  });

  const [dailyDigest, setDailyDigest] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/notifications/preferences')
      .then((res) => res.json())
      .then((data) => {
        if (data.preferences) {
          if (data.preferences.email) setEmailPrefs((prev) => ({ ...prev, ...data.preferences.email }));
          if (data.preferences.inApp) setInAppPrefs((prev) => ({ ...prev, ...data.preferences.inApp }));
          if (data.preferences.dailyDigest !== undefined) setDailyDigest(data.preferences.dailyDigest);
        }
      })
      .catch((err) => console.error('Failed to load preferences', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: {
            email: emailPrefs,
            inApp: inAppPrefs,
            dailyDigest,
          },
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to save preferences', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white/95 rounded-3xl border border-white/80 shadow-2xl w-full max-w-xl p-6 glass-panel relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#7a6af6] flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Notification Preferences</h3>
              <p className="text-xs text-slate-500">Configure how and when you want to be notified</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading preferences...</div>
        ) : (
          <div className="py-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {/* Preferences Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-2 uppercase tracking-wider">
                <span>Event Category</span>
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> In-App</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span>
                </div>
              </div>

              {[
                { key: 'requestUpdates', label: 'Request Updates & Triage Decisions', desc: 'When requests are submitted, accepted, or rejected' },
                { key: 'taskAssigned', label: 'Task Assignments & Handoffs', desc: 'When you are assigned or next stage handoff is ready' },
                { key: 'taskBlocked', label: 'Blocked Tasks & Escalations', desc: 'When tasks are placed on hold or encounter blocks' },
                { key: 'reviewDecisions', label: 'Review Submissions & Decisions', desc: 'When deliverables are ready for review or approved' },
                { key: 'deadlineReminders', label: '24h Deadlines & Overdue Alerts', desc: 'Reminders before deadlines and alerts if overdue' },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 border border-slate-100/80 hover:bg-slate-50 transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-xs font-bold text-slate-800">{row.label}</p>
                    <p className="text-[11px] text-slate-500">{row.desc}</p>
                  </div>

                  <div className="flex items-center gap-7 shrink-0 pr-2">
                    <input
                      type="checkbox"
                      checked={inAppPrefs[row.key as keyof typeof inAppPrefs] ?? true}
                      onChange={(e) =>
                        setInAppPrefs((prev) => ({ ...prev, [row.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] border-slate-300 cursor-pointer"
                    />

                    <input
                      type="checkbox"
                      checked={emailPrefs[row.key as keyof typeof emailPrefs] ?? true}
                      onChange={(e) =>
                        setEmailPrefs((prev) => ({ ...prev, [row.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
              ))}

              {/* Mentions Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 border border-slate-100/80 hover:bg-slate-50 transition-colors">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">Direct @Mentions</p>
                  <p className="text-[11px] text-slate-500">When someone mentions you in task or deliverable comments</p>
                </div>
                <div className="flex items-center gap-7 shrink-0 pr-2">
                  <input
                    type="checkbox"
                    checked={inAppPrefs.mentions ?? true}
                    onChange={(e) =>
                      setInAppPrefs((prev) => ({ ...prev, mentions: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] border-slate-300 cursor-pointer"
                  />
                  <div className="w-4 h-4" /> {/* Spacer */}
                </div>
              </div>

              {/* Daily Digest Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 border border-slate-100/80 hover:bg-slate-50 transition-colors">
                <div className="pr-4">
                  <p className="text-xs font-bold text-slate-800">Daily Operational Digest</p>
                  <p className="text-[11px] text-slate-500">Morning summary of pending triage, blocked items, and overdue tasks (Leads)</p>
                </div>
                <div className="flex items-center gap-7 shrink-0 pr-2">
                  <div className="w-4 h-4" /> {/* Spacer */}
                  <input
                    type="checkbox"
                    checked={dailyDigest}
                    onChange={(e) => setDailyDigest(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7a6af6] focus:ring-[#7a6af6] border-slate-300 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
          <span className="text-[11px] text-slate-400">Settings save to your user account</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#0f172a] text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-md shadow-slate-900/10"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : saving ? (
                <span>Saving...</span>
              ) : (
                <span>Save Preferences</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
