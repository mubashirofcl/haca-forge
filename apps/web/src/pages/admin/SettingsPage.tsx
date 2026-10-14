import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Sliders,
  Shield,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
} from 'lucide-react';

interface SettingsData {
  efficiencyWeights: {
    onTime: number;
    firstPass: number;
    speedVsEstimate: number;
    volumeUtilization: number;
  };
  requestersCanSeeWorkerNames: boolean;
  requireReasonForHold: boolean;
  defaultWeeklyCapacityHours: number;
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    efficiencyWeights: {
      onTime: 0.4,
      firstPass: 0.3,
      speedVsEstimate: 0.2,
      volumeUtilization: 0.1,
    },
    requestersCanSeeWorkerNames: false,
    requireReasonForHold: true,
    defaultWeeklyCapacityHours: 40,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ settings: SettingsData }>('/master-data/settings');
      if (res.settings) {
        setSettings(res.settings);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load system settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const totalWeight =
    settings.efficiencyWeights.onTime +
    settings.efficiencyWeights.firstPass +
    settings.efficiencyWeights.speedVsEstimate +
    settings.efficiencyWeights.volumeUtilization;

  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.001;

  const handleWeightChange = (key: keyof SettingsData['efficiencyWeights'], value: number) => {
    setSettings((prev) => ({
      ...prev,
      efficiencyWeights: {
        ...prev.efficiencyWeights,
        [key]: Math.round(value * 100) / 100,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid) {
      setFeedback({
        type: 'error',
        message: `Efficiency weights must sum to exactly 100% (currently ${(totalWeight * 100).toFixed(0)}%).`,
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/master-data/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setFeedback({ type: 'success', message: 'System settings saved successfully.' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({
      efficiencyWeights: {
        onTime: 0.4,
        firstPass: 0.3,
        speedVsEstimate: 0.2,
        volumeUtilization: 0.1,
      },
      requestersCanSeeWorkerNames: false,
      requireReasonForHold: true,
      defaultWeeklyCapacityHours: 40,
    });
  };

  return (
    <div className="space-y-8 max-w-[1020px] mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            System Settings & Engine Rules
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tune algorithmic efficiency weights, worker privacy visibility, and organizational constraints
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          type="button"
          className="px-4 py-2 bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-bold rounded-full shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* 2. Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* 3. Settings Form */}
      {isLoading ? (
        <div className="glass-panel p-12 text-center rounded-[24px]">
          <div className="w-8 h-8 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading configuration settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section A: Efficiency Weights */}
          <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7a6af6] to-[#4f46e5] text-white flex items-center justify-center shadow-sm">
                  <Sliders className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Worker Efficiency Formula Weights
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defines the weighting criteria used to calculate worker efficiency scores in Phase 7
                  </p>
                </div>
              </div>

              {/* Live Weight Sum Indicator */}
              <div className="text-right">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    isWeightValid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  }`}
                >
                  Total: {(totalWeight * 100).toFixed(0)}% / 100%
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {/* On-Time Delivery Weight */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span>On-Time Milestone Delivery</span>
                    <span className="text-slate-400 font-normal">(completed before target deadline)</span>
                  </span>
                  <span className="text-[#7a6af6] font-mono font-extrabold">
                    {(settings.efficiencyWeights.onTime * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.efficiencyWeights.onTime}
                  onChange={(e) => handleWeightChange('onTime', parseFloat(e.target.value))}
                  className="w-full accent-[#7a6af6] cursor-pointer"
                />
              </div>

              {/* First-Pass Approval Weight */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span>First-Pass Approval Rate</span>
                    <span className="text-slate-400 font-normal">(deliverable approved with 0 revisions)</span>
                  </span>
                  <span className="text-[#7a6af6] font-mono font-extrabold">
                    {(settings.efficiencyWeights.firstPass * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.efficiencyWeights.firstPass}
                  onChange={(e) => handleWeightChange('firstPass', parseFloat(e.target.value))}
                  className="w-full accent-[#7a6af6] cursor-pointer"
                />
              </div>

              {/* Speed vs Estimate Weight */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span>Speed vs Time Estimate</span>
                    <span className="text-slate-400 font-normal">(logged hours vs estimated budget)</span>
                  </span>
                  <span className="text-[#7a6af6] font-mono font-extrabold">
                    {(settings.efficiencyWeights.speedVsEstimate * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.efficiencyWeights.speedVsEstimate}
                  onChange={(e) => handleWeightChange('speedVsEstimate', parseFloat(e.target.value))}
                  className="w-full accent-[#7a6af6] cursor-pointer"
                />
              </div>

              {/* Volume Utilization Weight */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span>Volume Utilization</span>
                    <span className="text-slate-400 font-normal">(tasks delivered relative to weekly capacity)</span>
                  </span>
                  <span className="text-[#7a6af6] font-mono font-extrabold">
                    {(settings.efficiencyWeights.volumeUtilization * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.efficiencyWeights.volumeUtilization}
                  onChange={(e) => handleWeightChange('volumeUtilization', parseFloat(e.target.value))}
                  className="w-full accent-[#7a6af6] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section B: Privacy & Workflow Policies */}
          <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass">
            <div className="pb-4 mb-6 border-b border-slate-200/80">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-700" />
                <span>Privacy & Workflow Policies</span>
              </h3>
              <p className="text-xs text-slate-500">
                Control team visibility boundaries and operational guardrails
              </p>
            </div>

            <div className="space-y-4">
              {/* Toggle 1: Worker Names Visibility */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-white">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                    {settings.requestersCanSeeWorkerNames ? (
                      <Eye className="w-4 h-4 text-[#7a6af6]" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Requesters Can View Assigned Worker Names
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      When turned off, external department requesters only see team-level progress (e.g. &quot;Assigned to Graphics Team&quot;) to prevent individual worker solicitation.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={settings.requestersCanSeeWorkerNames}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, requestersCanSeeWorkerNames: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0d0e12]"></div>
                </label>
              </div>

              {/* Toggle 2: Require Reason for Hold */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-white">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Mandatory Reason When Placing Tasks on Hold
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      Enforce selecting a valid HoldReason code from master data before a worker or lead can pause an active deliverable.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={settings.requireReasonForHold}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, requireReasonForHold: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0d0e12]"></div>
                </label>
              </div>

              {/* Default Weekly Capacity */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/60 border border-white">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700 mt-0.5">
                    <Clock className="w-4 h-4 text-[#7a6af6]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Default Worker Weekly Capacity Hours
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      Standard working hours per week assigned to newly approved staff members.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={80}
                    value={settings.defaultWeeklyCapacityHours}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultWeeklyCapacityHours: Number(e.target.value),
                      }))
                    }
                    className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center"
                  />
                  <span className="text-xs text-slate-500 font-medium">hrs/wk</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || !isWeightValid}
              className="px-8 py-3 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-md flex items-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
