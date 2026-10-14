import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Globe,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Eye,
  Heart,
} from 'lucide-react';
import { PublishModal } from './PublishModal';

export const SmDashboard: React.FC = () => {
  const [selectedPublishItem, setSelectedPublishItem] = useState<any | null>(null);

  // Fetch all deliverables for SM Manager overview
  const { data: contentResponse, isLoading } = useQuery({
    queryKey: ['smContentItems'],
    queryFn: async () => {
      const res = await fetch('/api/content?limit=100');
      if (!res.ok) throw new Error('Failed to load content items');
      return res.json();
    },
  });

  const items: any[] = contentResponse?.data || [];

  // Group items by status
  const plannedCount = items.filter((i) => i.status === 'planned').length;
  const inProdCount = items.filter((i) => i.status === 'in_production').length;
  const inReviewCount = items.filter((i) => i.status === 'in_review').length;
  const readyToPublish = items.filter((i) => ['approved', 'scheduled'].includes(i.status));
  const publishedItems = items.filter((i) => i.status === 'published');

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              SM Operations
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-semibold text-slate-500">Live Release & Distribution Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Social Media Manager Hub</span>
          </h1>
        </div>

        <a
          href="/calendar"
          className="px-4 py-2 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 transition-transform hover:scale-105"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Open Full Content Calendar</span>
        </a>
      </div>

      {/* 2. KPI Status Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-[24px] glass-panel border border-white/80 bg-white/70 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Planned</span>
          <div className="text-2xl font-black text-slate-900">{plannedCount}</div>
        </div>

        <div className="p-4 rounded-[24px] glass-panel border border-white/80 bg-white/70 space-y-1">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">In Production</span>
          <div className="text-2xl font-black text-blue-700">{inProdCount}</div>
        </div>

        <div className="p-4 rounded-[24px] glass-panel border border-white/80 bg-white/70 space-y-1">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">In Review</span>
          <div className="text-2xl font-black text-amber-700">{inReviewCount}</div>
        </div>

        <div className="p-4 rounded-[24px] glass-panel border border-emerald-200 bg-emerald-50/50 space-y-1 ring-1 ring-emerald-500/20">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Ready to Publish</span>
          <div className="text-2xl font-black text-emerald-800">{readyToPublish.length}</div>
        </div>

        <div className="p-4 rounded-[24px] glass-panel border border-purple-200 bg-purple-50/50 space-y-1">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Live Published</span>
          <div className="text-2xl font-black text-purple-900">{publishedItems.length}</div>
        </div>
      </div>

      {/* 3. Ready to Publish Queue */}
      <div className="glass-panel rounded-[28px] border border-white/80 overflow-hidden shadow-glass space-y-3 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Distribution & Publishing Queue</h2>
              <p className="text-xs text-slate-500">Deliverables approved by lead and ready for live release</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {readyToPublish.length} Awaiting Release
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading publishing queue...</div>
        ) : readyToPublish.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">All caught up!</p>
            <p className="text-[11px] text-slate-400">No approved deliverables waiting in the publishing queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Deliverable</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Platforms</th>
                  <th className="p-3">Publish Date</th>
                  <th className="p-3">Department</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readyToPublish.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3">
                      <div className="font-mono text-[10px] font-bold text-[#7a6af6]">{item.contentId}</div>
                      <div className="font-bold text-slate-900 leading-tight mt-0.5">{item.title}</div>
                    </td>
                    <td className="p-3 capitalize">{item.format?.replace('_', ' ')}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.platforms || []).map((p: string) => (
                          <span
                            key={p}
                            className="px-2 py-0.2 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-700 uppercase"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">
                      {item.publishDate ? new Date(item.publishDate).toLocaleDateString() : 'TBD'}
                    </td>
                    <td className="p-3 text-slate-500">
                      {item.sourceDepartment?.name || item.sourceDepartment?.code || 'Marketing'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedPublishItem(item)}
                        className="px-4 py-1.5 rounded-full bg-[#7a6af6] hover:bg-[#6857ea] text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 transition-transform hover:scale-105"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Publish Live</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Live Published Archive Table */}
      {publishedItems.length > 0 && (
        <div className="glass-panel rounded-[28px] border border-white/80 overflow-hidden shadow-glass p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recently Published Deliverables</h3>
            <span className="text-xs text-slate-400 font-semibold">{publishedItems.length} live records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Deliverable</th>
                  <th className="p-3">Release Date</th>
                  <th className="p-3">Live URL</th>
                  <th className="p-3">Key Metrics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {publishedItems.slice(0, 15).map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60">
                    <td className="p-3">
                      <span className="font-mono text-[10px] font-bold text-purple-600 mr-2">{item.contentId}</span>
                      <strong className="text-slate-800">{item.title}</strong>
                    </td>
                    <td className="p-3 text-slate-500">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Recent'}
                    </td>
                    <td className="p-3">
                      {item.publishedUrl ? (
                        <a
                          href={item.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#7a6af6] hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>{item.publishedUrl.slice(0, 32)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3 text-slate-600 font-medium text-[11px]">
                        {item.metrics?.reach ? (
                          <span title="Reach">{item.metrics.reach.toLocaleString()} reach</span>
                        ) : null}
                        {item.metrics?.views ? (
                          <span title="Views" className="flex items-center gap-0.5">
                            <Eye className="w-3 h-3 text-slate-400" />
                            {item.metrics.views.toLocaleString()}
                          </span>
                        ) : null}
                        {item.metrics?.likes ? (
                          <span title="Likes" className="flex items-center gap-0.5">
                            <Heart className="w-3 h-3 text-rose-400" />
                            {item.metrics.likes.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {selectedPublishItem && (
        <PublishModal
          contentItem={selectedPublishItem}
          onClose={() => setSelectedPublishItem(null)}
        />
      )}
    </div>
  );
};
