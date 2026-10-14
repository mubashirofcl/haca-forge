import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  Sparkles,
  CheckCircle2,
  Trash2,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface CalendarEntryDrawerProps {
  entry: any | null;
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

const FORMAT_LEAD_TIMES: Record<string, number> = {
  static_post: 3,
  carousel: 4,
  story: 2,
  reel: 7,
  ad_creative: 4,
  brochure: 5,
  academic_creative: 4,
};

const PLATFORMS = [
  'instagram',
  'linkedin',
  'youtube',
  'facebook',
  'tiktok',
  'twitter',
  'pinterest',
];

export const CalendarEntryDrawer: React.FC<CalendarEntryDrawerProps> = ({
  entry,
  isOpen,
  onClose,
  initialDate,
}) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('static_post');
  const [theme, setTheme] = useState('');
  const [contentPillar, setContentPillar] = useState('General');
  const [captionBrief, setCaptionBrief] = useState('');
  const [status, setStatus] = useState('draft');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (entry) {
      setDate(entry.date ? new Date(entry.date).toISOString().split('T')[0] : '');
      setPlatform(entry.platform || 'instagram');
      setFormat(entry.format || 'static_post');
      setTheme(entry.theme || '');
      setContentPillar(entry.contentPillar || 'General');
      setCaptionBrief(entry.captionBrief || '');
      setStatus(entry.status || 'draft');
    } else {
      setDate(initialDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
      setPlatform('instagram');
      setFormat('static_post');
      setTheme('');
      setContentPillar('General');
      setCaptionBrief('');
      setStatus('draft');
    }
    setErrorMessage('');
  }, [entry, initialDate, isOpen]);

  // Derived production deadline preview
  const leadDays = FORMAT_LEAD_TIMES[format] || 3;
  const targetDateObj = date ? new Date(date) : null;
  const productionDeadline = targetDateObj
    ? new Date(targetDateObj.getTime() - leadDays * 86400000).toLocaleDateString()
    : 'TBD';

  // 1. Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to create calendar entry');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['teamCapacity'] });
      onClose();
    },
    onError: (err: any) => setErrorMessage(err.message),
  });

  // 2. Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/calendar/${entry._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to update calendar entry');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['teamCapacity'] });
      onClose();
    },
    onError: (err: any) => setErrorMessage(err.message),
  });

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/${entry._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to delete calendar entry');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['teamCapacity'] });
      onClose();
    },
    onError: (err: any) => setErrorMessage(err.message),
  });

  // 4. Generate Pipeline Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/calendar/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds: [entry._id] }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to generate pipeline');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEntries'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
      onClose();
    },
    onError: (err: any) => setErrorMessage(err.message),
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const payload = {
      date,
      platform,
      format,
      theme,
      contentPillar,
      captionBrief,
      status,
    };
    if (entry) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-white/80">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#7a6af6]/10 text-[#7a6af6] flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {entry ? 'Edit Calendar Deliverable' : 'Schedule New Deliverable'}
                </h3>
                <p className="text-[11px] text-slate-400">Social media calendar planning & pipeline</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMessage && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Theme / Topic Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Q4 Growth Case Study Breakdown"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Publish Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Platform *</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700 capitalize"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Format Pipeline *</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700 capitalize"
                >
                  {Object.keys(FORMAT_LEAD_TIMES).map((f) => (
                    <option key={f} value={f}>
                      {f.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Content Pillar</label>
                <select
                  value={contentPillar}
                  onChange={(e) => setContentPillar(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700"
                >
                  {['General', 'Product', 'Culture', 'Thought Leadership', 'Educational', 'Promotional'].map(
                    (pil) => (
                      <option key={pil} value={pil}>
                        {pil}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Derived Deadline Indicator */}
            <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#7a6af6]" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Derived Production Deadline</span>
                  <span className="text-xs font-bold text-purple-900">{productionDeadline}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-purple-700 border border-purple-200">
                {leadDays}d lead time
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Caption Brief & Instructions</label>
              <textarea
                rows={4}
                placeholder="Outline copy hooks, key talking points, hashtags, or required assets..."
                value={captionBrief}
                onChange={(e) => setCaptionBrief(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#7a6af6]"
              />
            </div>

            {entry && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Planning Status</label>
                <div className="flex gap-2">
                  {['draft', 'approved'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`flex-1 py-1.5 rounded-xl font-bold capitalize text-xs transition-all ${
                        status === st
                          ? 'bg-[#0d0e12] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pipeline Generation Bridge */}
            {entry && entry.status === 'approved' && !entry.linkedContentItemId && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 mt-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ready for Pipeline Generation</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  This deliverable is approved. Generating content will create the central ContentItem
                  and orchestrate stage tasks across production teams.
                </p>
                <button
                  type="button"
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate()}
                  className="w-full py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {generateMutation.isPending ? 'Spawning Pipeline...' : 'Generate Content Pipeline'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {entry && entry.linkedContentItemId && (
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                <span className="font-bold block">Production Pipeline Active</span>
                <span className="text-[11px] text-indigo-700">
                  Linked to {entry.linkedContentItemId.contentId} ({entry.linkedContentItemId.status})
                </span>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            {entry && entry.status !== 'converted' ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this calendar entry?')) deleteMutation.mutate();
                }}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : entry
                  ? 'Save Changes'
                  : 'Add Deliverable'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
