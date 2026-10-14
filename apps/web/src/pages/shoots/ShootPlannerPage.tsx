import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  Calendar,
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Search,
  ExternalLink,
  X,
  Film,
} from 'lucide-react';

interface ShootItem {
  _id: string;
  shootId: string;
  title: string;
  date: string;
  location: string;
  crew: Array<{ _id: string; name: string; email: string; avatar?: string; attendance?: string; onLeave?: boolean }>;
  equipment: string[];
  talentNotes?: string;
  contentItems: Array<{ _id: string; contentId: string; title: string; format: string; status: string; publishDate?: string }>;
  status: 'scheduled' | 'done' | 'reshoot_needed' | 'cancelled';
  notes?: string;
  reshootReason?: string;
  reshootCount?: number;
  footageUrls?: string[];
  overrideWarning?: boolean;
  createdBy?: { name: string; email: string };
  createdAt: string;
}

interface ContentDeliverable {
  _id: string;
  contentId: string;
  title: string;
  format: string;
  status: string;
  tasks?: Array<{ stageKey: string; team: string; status: string }>;
}

const COMMON_EQUIPMENT = [
  'Sony FX6',
  'Sony A7S III',
  'Aputure 600d Pro',
  'Aputure 300x',
  'Wireless Lav Mics',
  'Boom Mic & Recorder',
  'DJI Ronin RS3 Gimbal',
  'Heavy-Duty Tripod',
  'Teleprompter Rig',
  'DJI Mavic 3 Drone',
  'Motorized Slider',
  'Color Checker & Slate',
];

export const ShootPlannerPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'reshoot'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedShoot, setSelectedShoot] = useState<ShootItem | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [showReshootModal, setShowReshootModal] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formCrew, setFormCrew] = useState<string[]>([]);
  const [formEquipment, setFormEquipment] = useState<string[]>([]);
  const [formTalentNotes, setFormTalentNotes] = useState('');
  const [formContentItems, setFormContentItems] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formOverride, setFormOverride] = useState(false);
  const [customEquip, setCustomEquip] = useState('');

  // Done / Reshoot dialog state
  const [doneNotes, setDoneNotes] = useState('');
  const [footageUrl, setFootageUrl] = useState('');
  const [reshootReason, setReshootReason] = useState('');

  // 1. Fetch Shoots
  const { data: shoots = [], isLoading: shootsLoading } = useQuery({
    queryKey: ['shoots', activeTab],
    queryFn: async () => {
      let url = '/api/shoots';
      if (activeTab === 'today') url += '?today=true';
      if (activeTab === 'reshoot') url += '?status=reshoot_needed';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch shoots');
      const data = await res.json();
      return data.data as ShootItem[];
    },
  });

  // 2. Fetch Cinematography Crew Members
  const { data: crewMembers = [] } = useQuery({
    queryKey: ['cinematographyCrew'],
    queryFn: async () => {
      const res = await fetch('/api/teams/cinematography/dashboard');
      if (!res.ok) {
        // Fallback to all users
        const uRes = await fetch('/api/admin/users');
        if (!uRes.ok) return [];
        const uData = await uRes.json();
        return uData.users || [];
      }
      const data = await res.json();
      return data.data?.members || [];
    },
  });

  // 3. Fetch Video Content Deliverables (Reels / Videos)
  const { data: videoDeliverables = [] } = useQuery({
    queryKey: ['videoDeliverables'],
    queryFn: async () => {
      const res = await fetch('/api/content');
      if (!res.ok) return [];
      const data = await res.json();
      const allItems = (data.data || []) as ContentDeliverable[];
      // Filter for video formats
      return allItems.filter((i) => ['reel', 'video', 'ad_creative'].includes(i.format));
    },
  });

  // Create Shoot Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/shoots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          date: formDate,
          location: formLocation,
          crew: formCrew,
          equipment: formEquipment,
          talentNotes: formTalentNotes,
          contentItems: formContentItems,
          notes: formNotes,
          overrideWarning: formOverride,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create shoot');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  // Transition Shoot Mutation
  const transitionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
      reshootReason,
      footageUrls,
    }: {
      id: string;
      status: string;
      notes?: string;
      reshootReason?: string;
      footageUrls?: string[];
    }) => {
      const res = await fetch(`/api/shoots/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, reshootReason, footageUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Transition failed');
      return data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      setSelectedShoot(updated);
      setShowDoneModal(false);
      setShowReshootModal(false);
      setDoneNotes('');
      setFootageUrl('');
      setReshootReason('');
    },
  });

  const resetForm = () => {
    setFormTitle('');
    setFormDate('');
    setFormLocation('');
    setFormCrew([]);
    setFormEquipment([]);
    setFormTalentNotes('');
    setFormContentItems([]);
    setFormNotes('');
    setFormOverride(false);
  };

  const handleToggleEquipment = (eq: string) => {
    setFormEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleAddCustomEquipment = () => {
    if (!customEquip.trim()) return;
    if (!formEquipment.includes(customEquip.trim())) {
      setFormEquipment((prev) => [...prev, customEquip.trim()]);
    }
    setCustomEquip('');
  };

  const handleToggleCrew = (memberId: string) => {
    setFormCrew((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleToggleDeliverable = (deliverableId: string) => {
    setFormContentItems((prev) =>
      prev.includes(deliverableId)
        ? prev.filter((id) => id !== deliverableId)
        : [...prev, deliverableId]
    );
  };

  // Check if any selected deliverable has an unapproved script
  const selectedDeliverables = videoDeliverables.filter((d) =>
    formContentItems.includes(d._id)
  );

  const hasUnapprovedScript = selectedDeliverables.some((d) => {
    const scriptTask = d.tasks?.find(
      (t) => t.stageKey === 'content_script' || (t.team === 'content')
    );
    return scriptTask && !['done', 'approved'].includes(scriptTask.status);
  });

  // Filtered shoots
  const filteredShoots = shoots.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shootId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const totalCount = shoots.length;
  const scheduledCount = shoots.filter((s) => s.status === 'scheduled').length;
  const doneCount = shoots.filter((s) => s.status === 'done').length;
  const reshootCount = shoots.filter((s) => s.status === 'reshoot_needed').length;

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <Video className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Shoot Planner & Production Sets
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Coordinate video filming, crew allocations, equipment checklists and release footage to the Editor queue.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D0E12] dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:opacity-90 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Schedule Shoot
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200/60 dark:border-white/10">
          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled</span>
              <Calendar className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{scheduledCount}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Footage Released</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{doneCount}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reshoots Needed</span>
              <RotateCcw className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{reshootCount}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Productions</span>
              <Film className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalCount}</div>
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Shoots
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            Today's Shoots
          </button>
          <button
            onClick={() => setActiveTab('reshoot')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'reshoot'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            Reshoots Queue
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search shoots, locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Done & Released</option>
            <option value="reshoot_needed">Reshoot Needed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Shoots Grid / Cards */}
      {shootsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredShoots.length === 0 ? (
        <div className="text-center py-16 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8">
          <Camera className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">No shoots found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'today'
              ? 'No shoots scheduled for today.'
              : 'Create a new shoot to group video reels and deploy camera crews.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShoots.map((shoot) => {
            const shootDate = new Date(shoot.date);
            const isToday = new Date().toDateString() === shootDate.toDateString();

            const statusColors = {
              scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
              done: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
              reshoot_needed: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
              cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
            };

            return (
              <div
                key={shoot._id}
                onClick={() => setSelectedShoot(shoot)}
                className="group cursor-pointer rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/60 dark:border-white/10 p-5 hover:border-violet-500/50 hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                      {shoot.shootId}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium border capitalize ${
                        statusColors[shoot.status]
                      }`}
                    >
                      {shoot.status === 'reshoot_needed' ? 'Reshoot Needed' : shoot.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">
                      {shoot.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {shootDate.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold text-[10px]">
                          TODAY
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {shoot.location}
                      </span>
                    </div>
                  </div>

                  {/* Linked Deliverables */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Linked Deliverables ({shoot.contentItems?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {shoot.contentItems?.slice(0, 3).map((item) => (
                        <span
                          key={item._id}
                          className="text-xs px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 flex items-center gap-1"
                        >
                          <Film className="w-3 h-3 text-violet-500" />
                          <span className="truncate max-w-[120px]">{item.title}</span>
                        </span>
                      ))}
                      {(shoot.contentItems?.length || 0) > 3 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          +{(shoot.contentItems?.length || 0) - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reshoot warning notice if applicable */}
                  {shoot.status === 'reshoot_needed' && shoot.reshootReason && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <span className="line-clamp-2">
                        <strong>Reshoot:</strong> {shoot.reshootReason}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Crew & Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center -space-x-1.5">
                    {shoot.crew?.map((c) => (
                      <div
                        key={c._id}
                        title={`${c.name} (${c.attendance === 'on_leave' ? 'On Leave' : 'Available'})`}
                        className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-semibold uppercase ${
                          c.attendance === 'on_leave'
                            ? 'bg-rose-500 text-white'
                            : 'bg-violet-600 text-white'
                        }`}
                      >
                        {c.name.charAt(0)}
                      </div>
                    ))}
                    {(shoot.crew?.length || 0) === 0 && (
                      <span className="text-xs text-slate-400 italic">No crew assigned</span>
                    )}
                  </div>

                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400 group-hover:underline">
                    View Call Sheet →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* Shoot Call Sheet Detail Drawer                                 */}
      {/* ============================================================== */}
      {selectedShoot && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 h-full overflow-y-auto shadow-2xl p-6 md:p-8 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    {selectedShoot.shootId}
                  </span>
                  <span className="text-xs capitalize font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedShoot.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedShoot(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Timing */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {selectedShoot.title}
                </h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-violet-500" />
                    {new Date(selectedShoot.date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-violet-500" />
                    {selectedShoot.location}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Mark Done / Reshoot */}
              {selectedShoot.status === 'scheduled' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10 space-y-2">
                  <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                    On-Set Production Actions
                  </span>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => setShowDoneModal(true)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Done & Release Footage
                    </button>
                    <button
                      onClick={() => setShowReshootModal(true)}
                      className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium text-sm border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 inline mr-1" />
                      Request Reshoot
                    </button>
                  </div>
                </div>
              )}

              {selectedShoot.status === 'reshoot_needed' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Reshoot Scheduled (Round {selectedShoot.reshootCount || 1})
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {selectedShoot.reshootReason}
                  </p>
                  <button
                    onClick={() => setShowDoneModal(true)}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Reshoot & Release
                  </button>
                </div>
              )}

              {/* Call Sheet: Crew Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Assigned Crew & Camera Ops ({selectedShoot.crew?.length || 0})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedShoot.crew?.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center text-xs">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {member.name}
                          {member.attendance === 'on_leave' && (
                            <span className="text-[10px] px-1.5 rounded bg-rose-500/10 text-rose-600 font-medium">
                              On Leave
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[150px]">{member.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call Sheet: Equipment Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Equipment Kit Checklist ({selectedShoot.equipment?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedShoot.equipment?.map((eq, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-white/5"
                    >
                      <Camera className="w-3.5 h-3.5 text-violet-500" />
                      {eq}
                    </span>
                  ))}
                  {(selectedShoot.equipment?.length || 0) === 0 && (
                    <span className="text-xs text-slate-400 italic">No equipment specified</span>
                  )}
                </div>
              </div>

              {/* Call Sheet: Talent & Set Notes */}
              {selectedShoot.talentNotes && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Talent & Cast Instructions
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {selectedShoot.talentNotes}
                  </div>
                </div>
              )}

              {/* Linked Content Deliverables */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Filming Content Deliverables ({selectedShoot.contentItems?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedShoot.contentItems?.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400">
                          {item.contentId}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium uppercase">
                        {item.format}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footage URLs if marked Done */}
              {selectedShoot.footageUrls && selectedShoot.footageUrls.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Delivered Footage Sources
                  </h4>
                  <div className="space-y-1">
                    {selectedShoot.footageUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:underline"
                      >
                        <span className="truncate">{url}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-2" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={() => setSelectedShoot(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close Call Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Schedule Shoot Modal                                           */}
      {/* ============================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
                  <Camera className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Schedule Production Shoot
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Shoot Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Brand Commercial & BTS Video Shoot"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Location / Set *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Studio Stage B / On-Location"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Linked Video Deliverables */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Select Video Deliverables to Film * (Reels, Videos)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-800/30">
                  {videoDeliverables.map((deliv) => {
                    const isSelected = formContentItems.includes(deliv._id);
                    const scriptTask = deliv.tasks?.find(
                      (t) => t.stageKey === 'content_script' || t.team === 'content'
                    );
                    const isScriptReady = ['done', 'approved'].includes(scriptTask?.status || '');

                    return (
                      <div
                        key={deliv._id}
                        onClick={() => handleToggleDeliverable(deliv._id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                          isSelected
                            ? 'bg-violet-600/10 border border-violet-500/40 text-violet-900 dark:text-violet-200 font-medium'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span className="font-mono text-slate-500">{deliv.contentId}</span>
                          <span className="font-semibold">{deliv.title}</span>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                            isScriptReady
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isScriptReady ? 'Script Approved' : 'Script In Progress'}
                        </span>
                      </div>
                    );
                  })}
                  {videoDeliverables.length === 0 && (
                    <div className="text-xs text-slate-400 italic p-2">
                      No video deliverables found. Create a reel or video request first.
                    </div>
                  )}
                </div>
              </div>

              {/* Script Not Ready Warning & Lead Override */}
              {hasUnapprovedScript && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Script Stage Not Approved for One or More Deliverables
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Marketing portal policy requires the Content team's script to be completed before filming. You may override this requirement if preliminary filming or b-roll is authorized.
                  </p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formOverride}
                      onChange={(e) => setFormOverride(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    Override warning (Confirm Lead / Manager Authorization)
                  </label>
                </div>
              )}

              {/* Crew Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Assign Camera Crew & Operators ({formCrew.length} selected)
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/10">
                  {crewMembers.map((m: any) => {
                    const isSelected = formCrew.includes(m._id);
                    const onLeave = m.attendance === 'on_leave' || m.onLeave;

                    return (
                      <button
                        type="button"
                        key={m._id}
                        onClick={() => handleToggleCrew(m._id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-violet-500/50'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[10px]">
                          {m.name.charAt(0)}
                        </span>
                        <span>{m.name}</span>
                        {onLeave && (
                          <span className="text-[10px] px-1 bg-rose-500 text-white rounded">
                            Leave
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Equipment Kit Checklist */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Equipment Kit Checklist ({formEquipment.length} items)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_EQUIPMENT.map((eq) => {
                    const isChecked = formEquipment.includes(eq);
                    return (
                      <button
                        type="button"
                        key={eq}
                        onClick={() => handleToggleEquipment(eq)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                          isChecked
                            ? 'bg-violet-600 text-white font-medium shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {eq}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add custom gear or specialty lens..."
                    value={customEquip}
                    onChange={(e) => setCustomEquip(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomEquipment();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomEquipment}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Talent Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Talent & Call Sheet Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes for hair, makeup, teleprompter speed, or client presence..."
                  value={formTalentNotes}
                  onChange={(e) => setFormTalentNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-violet-500 outline-none text-slate-900 dark:text-white"
                />
              </div>

              {createMutation.isError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                  {(createMutation.error as Error).message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !formTitle ||
                  !formDate ||
                  !formLocation ||
                  formContentItems.length === 0 ||
                  createMutation.isPending
                }
                onClick={() => createMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-[#0D0E12] dark:bg-white text-white dark:text-slate-950 font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
              >
                {createMutation.isPending ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Mark Done Dialog (Releases Footage to Editor Queue)            */}
      {/* ============================================================== */}
      {showDoneModal && selectedShoot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Mark Done & Release Footage
                </h3>
                <p className="text-xs text-slate-500">
                  This will complete Cinematography and activate Editor stage tasks.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Footage Storage / Folder Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://drive.google.com/drive/folders/raw-footage..."
                  value={footageUrl}
                  onChange={(e) => setFootageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Production / Camera Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes on card numbers, best takes, audio sync details..."
                  value={doneNotes}
                  onChange={(e) => setDoneNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDoneModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transitionMutation.isPending}
                onClick={() =>
                  transitionMutation.mutate({
                    id: selectedShoot._id,
                    status: 'done',
                    notes: doneNotes,
                    footageUrls: footageUrl ? [footageUrl] : [],
                  })
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-sm"
              >
                {transitionMutation.isPending ? 'Releasing...' : 'Confirm & Release Footage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Request Reshoot Dialog                                         */}
      {/* ============================================================== */}
      {showReshootModal && selectedShoot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <RotateCcw className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Request Reshoot
                </h3>
                <p className="text-xs text-slate-500">
                  Returns items to Cinematography with mandatory reason notes.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Reshoot Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe technical faults, missing b-roll angles, audio clipping..."
                  value={reshootReason}
                  onChange={(e) => setReshootReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReshootModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reshootReason.trim() || transitionMutation.isPending}
                onClick={() =>
                  transitionMutation.mutate({
                    id: selectedShoot._id,
                    status: 'reshoot_needed',
                    reshootReason: reshootReason.trim(),
                  })
                }
                className="px-4 py-2 rounded-xl bg-amber-600 text-white font-medium text-xs hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {transitionMutation.isPending ? 'Submitting...' : 'Confirm Reshoot Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShootPlannerPage;
