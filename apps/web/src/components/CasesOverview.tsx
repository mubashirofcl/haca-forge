import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import {
  Plus,
  Clock,
  MoreHorizontal,
  TrendingUp,
  GitBranch,
  ChevronRight,
  Calendar,
  Paperclip,
  CheckSquare,
} from 'lucide-react';
import { NewCaseModal } from './NewCaseModal';

interface CaseItem {
  id: string;
  title: string;
  column: 'new' | 'progress' | 'pending' | 'closed';
  duration: string;
  creator: string;
  team: string;
  budget: number;
  avatars: { initials: string; bg: string }[];
  tags?: string[];
}

export const CasesOverview: React.FC = () => {
  const [activeView, setActiveView] = useState<'pipelines' | 'progress' | 'completed' | 'journey'>('pipelines');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initial case data conforming to reference specifications
  const [cases, setCases] = useState<CaseItem[]>([
    {
      id: 'case-1',
      title: 'Conversion Issues',
      column: 'new',
      duration: 'Approximate wait: 10 minutes',
      creator: 'Brian McCartney - Senior Technical Lead',
      team: 'Team-A - Main Support Team',
      budget: 24985,
      avatars: [
        { initials: 'BM', bg: 'bg-slate-900' },
        { initials: 'SJ', bg: 'bg-[#7a6af6]' },
      ],
      tags: ['Attribution', 'Performance'],
    },
    {
      id: 'case-2',
      title: 'Tech Visionaries Campaign',
      column: 'new',
      duration: 'Approximate wait: 28 minutes',
      creator: 'David Miller - Creative Lead',
      team: 'Team-B - Motion Team',
      budget: 45000,
      avatars: [
        { initials: 'DM', bg: 'bg-emerald-600' },
        { initials: 'AK', bg: 'bg-indigo-600' },
      ],
      tags: ['Video Reel', 'YouTube'],
    },
    {
      id: 'case-3',
      title: 'Meta Ad Variants Refactoring',
      column: 'progress',
      duration: 'In progress: 4 hours elapsed',
      creator: 'Sarah Jenkins - Performance Lead',
      team: 'Team-C - Ads Creative',
      budget: 18500,
      avatars: [
        { initials: 'SJ', bg: 'bg-purple-600' },
        { initials: 'RC', bg: 'bg-amber-600' },
        { initials: 'LP', bg: 'bg-blue-600' },
      ],
      tags: ['Meta Ads', 'Carousels'],
    },
    {
      id: 'case-4',
      title: 'Course Launch Brochure',
      column: 'pending',
      duration: 'Awaiting Academics Review',
      creator: 'Mark Zuckerberg - Lead Staff',
      team: 'Team-A - Main Support Team',
      budget: 12000,
      avatars: [
        { initials: 'MZ', bg: 'bg-slate-800' },
      ],
      tags: ['Print & PDF'],
    },
    {
      id: 'case-5',
      title: 'Fall 2026 Strategy Teaser',
      column: 'closed',
      duration: 'Completed & Published',
      creator: 'Elena Rostova - SM Manager',
      team: 'Team-B - Motion Team',
      budget: 32000,
      avatars: [
        { initials: 'ER', bg: 'bg-pink-600' },
        { initials: 'BM', bg: 'bg-slate-900' },
      ],
      tags: ['Instagram', 'Published'],
    },
  ]);

  useEffect(() => {
    const loadContentItems = async () => {
      try {
        const res = await apiFetch<{ data: any[] }>('/content');
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          const liveCases: CaseItem[] = res.data.map((item) => {
            let column: 'new' | 'progress' | 'pending' | 'closed' = 'new';
            if (item.status === 'in_production') column = 'progress';
            else if (['review_pending', 'changes_requested'].includes(item.status)) column = 'pending';
            else if (['approved', 'scheduled', 'published', 'archived'].includes(item.status)) column = 'closed';

            const initials = item.requester?.name
              ? item.requester.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'HQ';

            return {
              id: item._id,
              title: item.title || item.contentId || 'Production Asset',
              column,
              duration: item.publishDate
                ? `Target: ${new Date(item.publishDate).toLocaleDateString()}`
                : `Status: ${(item.status || 'draft').replace('_', ' ')}`,
              creator: item.requester?.name ? `${item.requester.name} - Requester` : 'Production Staff',
              team: item.sourceDepartment?.name || item.format || 'Marketing Operations',
              budget: item.estimatedBudget || 25000,
              avatars: [
                { initials, bg: 'bg-[#7a6af6]' },
              ],
              tags: [item.format, item.priority].filter(Boolean),
            };
          });
          setCases(liveCases);
        }
      } catch (err) {
        console.warn('Failed to fetch live content items, keeping fallback mock cases:', err);
      }
    };
    loadContentItems();
  }, []);

  const handleAddNewCase = (newCaseData: any) => {
    const newCase: CaseItem = {
      id: `case-${Date.now()}`,
      title: newCaseData.title,
      column: 'new',
      duration: newCaseData.duration || 'Approximate wait: 15 minutes',
      creator: newCaseData.creator,
      team: newCaseData.team,
      budget: newCaseData.budget,
      avatars: [
        { initials: 'BM', bg: 'bg-slate-900' },
        { initials: 'ME', bg: 'bg-[#7a6af6]' },
      ],
      tags: ['New Request'],
    };
    setCases([newCase, ...cases]);
  };

  const columns = [
    { key: 'new', label: 'New Cases', count: cases.filter((c) => c.column === 'new').length },
    { key: 'progress', label: 'In Progress', count: cases.filter((c) => c.column === 'progress').length },
    { key: 'pending', label: 'Pending Info', count: cases.filter((c) => c.column === 'pending').length },
    { key: 'closed', label: 'Closed / Delivered', count: cases.filter((c) => c.column === 'closed').length },
  ] as const;

  return (
    <div className="space-y-8">
      {/* 1. Header Bar with Title, Capsule View Switcher, and "+ Add New Case" */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Cases Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time pipeline orchestration, case drivers, and cross-team workflows
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Capsule View Switcher */}
          <div className="p-1 glass-pill-container flex items-center border border-white">
            <button
              onClick={() => setActiveView('pipelines')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeView === 'pipelines' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pipelines
            </button>
            <button
              onClick={() => setActiveView('progress')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeView === 'progress' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setActiveView('completed')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeView === 'completed' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveView('journey')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                activeView === 'journey' ? 'pill-active' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Customer Journey</span>
            </button>
          </div>

          {/* Primary Action Button: "+ Add New Case" */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-bold shadow-pill flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Case</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content View: Either Kanban Board OR Customer Journey Flow */}
      {activeView !== 'journey' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
          {columns.map((col) => {
            const columnCases = cases.filter((c) => {
              if (activeView === 'progress') return c.column === 'progress';
              if (activeView === 'completed') return c.column === 'closed';
              return c.column === col.key;
            });

            return (
              <div
                key={col.key}
                className="glass-panel p-4 rounded-[22px] border border-white/80 shadow-glass flex flex-col gap-3 min-h-[360px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 tracking-tight">
                      {col.label}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-white/90 border border-slate-200/80 text-[10px] font-bold text-slate-600 flex items-center justify-center shadow-xs">
                      {col.count}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Cards List */}
                <div className="space-y-3">
                  {columnCases.map((c) => (
                    <div
                      key={c.id}
                      className="glass-card p-4 relative group cursor-pointer"
                    >
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#7a6af6] transition-colors leading-snug">
                          {c.title}
                        </h4>
                        <button className="text-slate-400 hover:text-slate-600 p-0.5">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Subtext / Wait Duration Row */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-3">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{c.duration}</span>
                      </div>

                      {/* Tags */}
                      {c.tags && (
                        <div className="flex flex-wrap gap-1.5 mb-3.5">
                          {c.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/80 border border-slate-200/70 text-slate-600"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Footer: Avatar Stack + Node Connector Handle */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60">
                        {/* Avatar stack */}
                        <div className="flex items-center -space-x-1.5">
                          {c.avatars.map((av, idx) => (
                            <div
                              key={idx}
                              className={`w-7 h-7 rounded-full ${av.bg} text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white shadow-xs`}
                            >
                              {av.initials}
                            </div>
                          ))}
                        </div>

                        {/* Node Connector Handle on Right Edge */}
                        <div
                          title="Connection node"
                          className="w-5 h-5 rounded-full bg-white border-2 border-[#7a6af6] shadow-xs flex items-center justify-center group-hover:scale-110 transition-transform"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7a6af6]"></div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnCases.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-slate-300/60 rounded-2xl">
                      <span className="text-xs text-slate-400">No cases in this stage</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Customer Journey / Process Canvas View with SVG Bezier Connecting Cables */
        <div className="glass-panel p-6 sm:p-8 rounded-[24px] border border-white shadow-glass overflow-x-auto relative">
          <div className="min-w-[960px] space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-[#7a6af6]" />
                  <span>End-to-End Processing Flow</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated stage progression and cross-team dependency cable nodes
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                All 4 Pipelines Active
              </span>
            </div>

            {/* Stage Columns & Connected Nodes */}
            <div className="grid grid-cols-4 gap-8 relative py-4">
              {[
                {
                  stage: '1. Case Allocation',
                  desc: 'Triage & Department Mapping',
                  cardTitle: 'Conversion Issues (Intake)',
                  assignee: 'Brian McCartney',
                  status: 'Done',
                  statusColor: 'bg-emerald-500',
                },
                {
                  stage: '2. Issue Identification',
                  desc: 'Root Cause & Brief Scripting',
                  cardTitle: 'Attribution Tracking Audit',
                  assignee: 'Sarah Jenkins',
                  status: 'In Progress',
                  statusColor: 'bg-blue-500 animate-pulse',
                },
                {
                  stage: '3. Technical Resolution',
                  desc: 'Asset Production & Edits',
                  cardTitle: 'Motion Creative Variants',
                  assignee: 'David Miller',
                  status: 'Queued',
                  statusColor: 'bg-amber-400',
                },
                {
                  stage: '4. Final Delivery & Review',
                  desc: 'Lead Sign-off & Release',
                  cardTitle: 'Client Confirmation',
                  assignee: 'Elena Rostova',
                  status: 'Pending',
                  statusColor: 'bg-slate-300',
                },
              ].map((step, idx) => (
                <div key={idx} className="space-y-3 relative">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#7a6af6]">
                      {step.stage}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900">{step.desc}</h5>
                  </div>

                  <div className="glass-card p-4 border border-white relative shadow-sm hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-slate-500">Node #{idx + 1}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${step.statusColor}`}></span>
                        <span className="text-[10px] font-bold text-slate-700">{step.status}</span>
                      </div>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900 mb-3">{step.cardTitle}</h4>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                      <span>{step.assignee}</span>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <CheckSquare className="w-3 h-3" />
                        <Paperclip className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Connecting Cables Annotation */}
            <div className="p-3 bg-white/70 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#7a6af6]"></span>
                <span>Automated handoff: Completing stage N unlocks assignee queue in stage N+1.</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">SLA: 48h turnaround</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottom Analytics Row: Top Case Drivers & Case Metrics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Case Drivers */}
        <div className="glass-panel p-6 rounded-[22px] border border-white/80 shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#7a6af6]" />
              <span>Top Case Drivers</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-500">This Month</span>
          </div>

          <div className="space-y-3">
            {[
              { driver: 'Conversion Issues', pct: 42, color: 'bg-[#7a6af6]' },
              { driver: 'Content & Script Revisions', pct: 28, color: 'bg-[#4f46e5]' },
              { driver: 'Format Dimension Adapts', pct: 18, color: 'bg-emerald-500' },
              { driver: 'Approval Cycle Delays', pct: 12, color: 'bg-amber-500' },
            ].map((d, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{d.driver}</span>
                  <span>{d.pct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.color} rounded-full transition-all duration-500`}
                    style={{ width: `${d.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Case Metrics Dashboard */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-[22px] border border-white/80 shadow-glass flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Case Metrics Dashboard</h3>
              <p className="text-xs text-slate-500">Efficiency score calculation and resolution velocity</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#7a6af6]/10 text-[#7a6af6] border border-[#7a6af6]/20">
              Overall Score: 94 / 100
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-2">
            <div className="p-4 rounded-xl bg-white/70 border border-white shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">On-Time Completion</span>
              <div className="text-2xl font-extrabold text-slate-900">96.8%</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">↑ 2.4% vs last week</span>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">First-Pass Approval</span>
              <div className="text-2xl font-extrabold text-slate-900">89.2%</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">↑ 1.1% first review</span>
            </div>
            <div className="p-4 rounded-xl bg-white/70 border border-white shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Average Wait Time</span>
              <div className="text-2xl font-extrabold text-slate-900">14.2 min</div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">↓ 3.8 min decrease</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <span>Automated metric weights: On-time (40%), Approval (30%), Speed (20%), Volume (10%).</span>
            <button className="font-semibold text-slate-800 hover:text-[#7a6af6] flex items-center gap-1 transition-colors">
              <span>View full metrics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog for "+ Add New Case" */}
      <NewCaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddCase={handleAddNewCase}
      />
    </div>
  );
};
