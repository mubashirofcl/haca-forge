import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  ArrowRight,
  Search,
  Radio,
  X,
} from 'lucide-react';

interface PerformanceAdItem {
  _id: string;
  contentId: string;
  title: string;
  format: string;
  platforms: string[];
  priority: string;
  status: string;
  publishDate?: string;
  productionDeadline?: string;
  performanceDetails?: {
    handedAt?: string;
    liveUrl?: string;
    liveDate?: string;
    notes?: string;
  };
  requester?: {
    name: string;
    email: string;
  };
  sourceDepartment?: {
    name: string;
    code: string;
  };
  tasks?: Array<{
    _id: string;
    title: string;
    team: string;
    status: string;
  }>;
}

export const PerformanceDashboard: React.FC = () => {
  const queryClient = useQueryClient();

  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Launch modal
  const [selectedAdForLive, setSelectedAdForLive] = useState<PerformanceAdItem | null>(null);
  const [liveUrl, setLiveUrl] = useState('');
  const [liveDate, setLiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [liveNotes, setLiveNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch Ad Creatives (format: ad_creative or all performance items)
  const { data: adsResponse, isLoading } = useQuery({
    queryKey: ['performanceAds', platformFilter, searchQuery],
    queryFn: async () => {
      const res = await fetch('/api/content?format=ad_creative');
      if (!res.ok) throw new Error('Failed to load performance ads');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const allAds: PerformanceAdItem[] = adsResponse?.data || [];

  // Filter ads
  const filteredAds = allAds.filter((ad) => {
    if (stageFilter === 'ready' && ad.status !== 'approved' && ad.status !== 'scheduled') return false;
    if (stageFilter === 'handed' && ad.status !== 'handed_to_performance') return false;
    if (stageFilter === 'live' && ad.status !== 'live') return false;
    if (stageFilter === 'in_production' && ad.status !== 'in_production' && ad.status !== 'in_review') return false;

    if (platformFilter && !ad.platforms.includes(platformFilter)) return false;
    if (searchQuery && !ad.title.toLowerCase().includes(searchQuery.toLowerCase()) && !ad.contentId.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Hand to performance mutation
  const handToPerformanceMutation = useMutation({
    mutationFn: async (contentItemId: string) => {
      const res = await fetch(`/api/deliverables/performance/${contentItemId}/hand`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to hand to performance');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceAds'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
    },
  });

  // Set Live mutation
  const setLiveMutation = useMutation({
    mutationFn: async ({
      contentItemId,
      liveUrl,
      liveDate,
      notes,
    }: {
      contentItemId: string;
      liveUrl: string;
      liveDate?: string;
      notes?: string;
    }) => {
      const res = await fetch(`/api/deliverables/performance/${contentItemId}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveUrl, liveDate, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to set ad live');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performanceAds'] });
      queryClient.invalidateQueries({ queryKey: ['contentItems'] });
      setSelectedAdForLive(null);
      setLiveUrl('');
      setLiveNotes('');
    },
  });

  const handleConfirmLive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdForLive || !liveUrl.trim()) {
      setErrorMessage('A valid live URL is required.');
      return;
    }
    setLiveMutation.mutate({
      contentItemId: selectedAdForLive._id,
      liveUrl: liveUrl.trim(),
      liveDate,
      notes: liveNotes.trim() || undefined,
    });
  };

  // Metrics
  const inProdCount = allAds.filter((a) => ['in_production', 'in_review', 'planned'].includes(a.status)).length;
  const readyCount = allAds.filter((a) => ['approved', 'scheduled'].includes(a.status)).length;
  const handedCount = allAds.filter((a) => a.status === 'handed_to_performance').length;
  const liveCount = allAds.filter((a) => a.status === 'live').length;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Performance Marketing Ops</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Paid Acquisition Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track high-converting ad creatives from production handoff to ad account activation and live campaign URLs.
          </p>
        </div>

        {/* Search & Platform Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ad creatives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 font-medium"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700"
          >
            <option value="">All Ad Networks</option>
            <option value="Meta">Meta / Instagram Ads</option>
            <option value="Google">Google Ads / YouTube</option>
            <option value="LinkedIn">LinkedIn Sponsored</option>
            <option value="TikTok">TikTok Ads</option>
          </select>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel p-4 border border-white/80 rounded-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">In Production</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{inProdCount}</p>
          <span className="text-[10px] text-slate-500">Copywriting / Graphics / Video</span>
        </div>

        <div className="glass-panel p-4 border border-white/80 rounded-2xl">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Ready for Performance</p>
          <p className="text-2xl font-black text-amber-700 mt-1">{readyCount}</p>
          <span className="text-[10px] text-slate-500">Approved deliverables ready</span>
        </div>

        <div className="glass-panel p-4 border border-white/80 rounded-2xl">
          <p className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Handed to Performance</p>
          <p className="text-2xl font-black text-violet-700 mt-1">{handedCount}</p>
          <span className="text-[10px] text-slate-500">Campaign setup in progress</span>
        </div>

        <div className="glass-panel p-4 border border-white/80 rounded-2xl">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Live Ad Campaigns</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{liveCount}</p>
          <span className="text-[10px] text-slate-500">Active traffic & conversions</span>
        </div>
      </div>

      {/* 3. Stage Filter Pills */}
      <div className="flex items-center gap-2">
        <div className="flex items-center p-1 rounded-full glass-panel border border-white/80 shadow-xs">
          {[
            { id: 'all', label: `All Ads (${allAds.length})` },
            { id: 'in_production', label: `In Production (${inProdCount})` },
            { id: 'ready', label: `Ready (${readyCount})` },
            { id: 'handed', label: `Handed Over (${handedCount})` },
            { id: 'live', label: `Live (${liveCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStageFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                stageFilter === tab.id ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Ad Creatives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs">
            Loading performance ad creatives...
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs glass-panel rounded-3xl p-12">
            No ad creatives found in this filter view.
          </div>
        ) : (
          filteredAds.map((ad) => {
            const isReadyForHand = ['approved', 'scheduled'].includes(ad.status);
            const isHanded = ad.status === 'handed_to_performance';
            const isLive = ad.status === 'live';

            return (
              <div
                key={ad._id}
                className="glass-panel p-5 border border-white/90 rounded-3xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {ad.contentId}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isLive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'
                          : isHanded
                          ? 'bg-violet-100 text-violet-800'
                          : isReadyForHand
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ad.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{ad.title}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Target Networks: <b className="text-slate-800">{ad.platforms.join(', ') || 'Meta'}</b>
                    </p>
                  </div>

                  {/* Live Details Banner if already active */}
                  {isLive && ad.performanceDetails?.liveUrl && (
                    <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-800">
                        <span className="flex items-center gap-1">
                          <Radio className="w-3 h-3 text-emerald-600" />
                          Live Ad Campaign Active
                        </span>
                        {ad.performanceDetails.liveDate && (
                          <span className="font-mono">{new Date(ad.performanceDetails.liveDate).toLocaleDateString()}</span>
                        )}
                      </div>
                      <a
                        href={ad.performanceDetails.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1 break-all line-clamp-1"
                      >
                        <span>{ad.performanceDetails.liveUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}

                  {/* Handed details */}
                  {isHanded && (
                    <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-100 text-violet-900 text-xs space-y-0.5">
                      <span className="font-bold text-[10px] uppercase tracking-wider block">
                        Handed to Performance Team
                      </span>
                      <p className="text-[11px] text-violet-700">
                        Creative assets received. Ready for audience targeting and campaign launch.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer and Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    Dept: <b className="text-slate-700">{ad.sourceDepartment?.code || 'PERF'}</b>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action 1: Hand to Performance */}
                    {isReadyForHand && (
                      <button
                        onClick={() => handToPerformanceMutation.mutate(ad._id)}
                        disabled={handToPerformanceMutation.isPending}
                        className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Hand to Performance</span>
                      </button>
                    )}

                    {/* Action 2: Set Live */}
                    {isHanded && (
                      <button
                        onClick={() => {
                          setSelectedAdForLive(ad);
                          setLiveUrl('');
                          setLiveNotes('');
                          setErrorMessage('');
                        }}
                        className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Launch Live</span>
                      </button>
                    )}

                    {isLive && ad.performanceDetails?.liveUrl && (
                      <a
                        href={ad.performanceDetails.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600"
                        title="View live ad"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Set Live Modal */}
      {selectedAdForLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-white shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-[10px] font-black uppercase text-emerald-700">
                  {selectedAdForLive.contentId}
                </span>
                <h3 className="font-black text-slate-900 text-sm">
                  Mark Ad Campaign As Live
                </h3>
              </div>
              <button
                onClick={() => setSelectedAdForLive(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmLive} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
                  Live Campaign URL / Ad Link *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://facebook.com/ads/library/?id=... or Google Ad URL"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
                  Launch Date
                </label>
                <input
                  type="date"
                  value={liveDate}
                  onChange={(e) => setLiveDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1">
                  Campaign Notes & Target Audience
                </label>
                <textarea
                  rows={2}
                  placeholder="Details on audience targeting, budget, or tracking UTM parameters..."
                  value={liveNotes}
                  onChange={(e) => setLiveNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-600 font-bold">{errorMessage}</p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAdForLive(null)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={setLiveMutation.isPending}
                  className="px-6 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors"
                >
                  {setLiveMutation.isPending ? 'Publishing...' : 'Confirm Live Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
