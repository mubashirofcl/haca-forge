import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { DynamicFormRenderer } from '../../components/DynamicFormRenderer';
import type { DynamicFieldDefinition } from '@mmp/shared';
import {
  Globe,
  AlertTriangle,
  PauseCircle,
  FileVideo,
  ListPlus,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Sliders,
  ChevronRight,
  Code,
} from 'lucide-react';

interface PlatformRecord {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  isActive: boolean;
}

interface PriorityRecord {
  _id: string;
  name: string;
  level: number;
  slaHours: number;
  color?: string;
}

interface HoldReasonRecord {
  _id: string;
  reason: string;
  category?: string;
  description?: string;
}

interface ContentFormatRecord {
  _id: string;
  name: string;
  slug: string;
  leadTimeDays: number;
  description?: string;
}

interface RequestTypeRecord {
  _id: string;
  name: string;
  departmentType: string;
  description?: string;
  fieldSchema: DynamicFieldDefinition[];
  isActive: boolean;
}

export const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'platforms' | 'priorities' | 'holdReasons' | 'formats' | 'requestTypes'>('platforms');
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [platforms, setPlatforms] = useState<PlatformRecord[]>([]);
  const [priorities, setPriorities] = useState<PriorityRecord[]>([]);
  const [holdReasons, setHoldReasons] = useState<HoldReasonRecord[]>([]);
  const [formats, setFormats] = useState<ContentFormatRecord[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestTypeRecord[]>([]);

  // Preview state for Request Type
  const [previewType, setPreviewType] = useState<RequestTypeRecord | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  // Modals state
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [platformName, setPlatformName] = useState('');
  const [platformSlug, setPlatformSlug] = useState('');

  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReasonText, setHoldReasonText] = useState('');
  const [holdCategory, setHoldCategory] = useState('internal');
  const [holdDesc, setHoldDesc] = useState('');

  const [showFormatModal, setShowFormatModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<ContentFormatRecord | null>(null);
  const [formatName, setFormatName] = useState('');
  const [formatSlug, setFormatSlug] = useState('');
  const [formatLeadDays, setFormatLeadDays] = useState(7);
  const [formatDesc, setFormatDesc] = useState('');

  // Request Type Builder Modal
  const [showReqTypeModal, setShowReqTypeModal] = useState(false);
  const [editingReqType, setEditingReqType] = useState<RequestTypeRecord | null>(null);
  const [reqTypeName, setReqTypeName] = useState('');
  const [reqDeptType, setReqDeptType] = useState('social_media');
  const [reqTypeDesc, setReqTypeDesc] = useState('');
  const [reqFieldSchema, setReqFieldSchema] = useState<DynamicFieldDefinition[]>([]);

  const loadAllMasterData = async () => {
    setIsLoading(true);
    try {
      const [platRes, prioRes, holdRes, formatRes, typeRes] = await Promise.all([
        apiFetch<{ platforms: PlatformRecord[] }>('/master-data/platforms'),
        apiFetch<{ priorities: PriorityRecord[] }>('/master-data/priorities'),
        apiFetch<{ holdReasons: HoldReasonRecord[] }>('/master-data/hold-reasons'),
        apiFetch<{ formats: ContentFormatRecord[] }>('/master-data/content-formats'),
        apiFetch<{ requestTypes: RequestTypeRecord[] }>('/master-data/request-types'),
      ]);

      setPlatforms(platRes.platforms || []);
      setPriorities(prioRes.priorities || []);
      setHoldReasons(holdRes.holdReasons || []);
      setFormats(formatRes.formats || []);
      setRequestTypes(typeRes.requestTypes || []);
      if (typeRes.requestTypes?.length > 0 && !previewType) {
        setPreviewType(typeRes.requestTypes[0]);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load master data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasterData();
  }, []);

  const clearFeedback = () => setTimeout(() => setFeedback(null), 4000);

  // Platform handlers
  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/master-data/platforms', {
        method: 'POST',
        body: JSON.stringify({
          name: platformName,
          slug: platformSlug || platformName.toLowerCase().replace(/\s+/g, '-'),
          isActive: true,
        }),
      });
      setFeedback({ type: 'success', message: `Platform "${platformName}" added.` });
      setShowPlatformModal(false);
      setPlatformName('');
      setPlatformSlug('');
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save platform.' });
    }
  };

  const handleDeletePlatform = async (id: string, name: string) => {
    if (!window.confirm(`Delete platform ${name}?`)) return;
    try {
      await apiFetch(`/master-data/platforms/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: `Platform ${name} deleted.` });
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete platform.' });
    }
  };

  // Hold reason handlers
  const handleSaveHoldReason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/master-data/hold-reasons', {
        method: 'POST',
        body: JSON.stringify({
          reason: holdReasonText,
          category: holdCategory,
          description: holdDesc,
        }),
      });
      setFeedback({ type: 'success', message: 'Hold reason added.' });
      setShowHoldModal(false);
      setHoldReasonText('');
      setHoldDesc('');
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save hold reason.' });
    }
  };

  const handleDeleteHoldReason = async (id: string) => {
    if (!window.confirm('Delete this hold reason?')) return;
    try {
      await apiFetch(`/master-data/hold-reasons/${id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', message: 'Hold reason deleted.' });
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete hold reason.' });
    }
  };

  // Content formats handlers
  const openEditFormat = (f: ContentFormatRecord) => {
    setEditingFormat(f);
    setFormatName(f.name);
    setFormatSlug(f.slug);
    setFormatLeadDays(f.leadTimeDays);
    setFormatDesc(f.description || '');
    setShowFormatModal(true);
  };

  const handleSaveFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFormat) {
        await apiFetch(`/master-data/content-formats/${editingFormat._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formatName,
            leadTimeDays: Number(formatLeadDays),
            description: formatDesc,
          }),
        });
        setFeedback({ type: 'success', message: `Format "${formatName}" updated.` });
      } else {
        await apiFetch('/master-data/content-formats', {
          method: 'POST',
          body: JSON.stringify({
            name: formatName,
            slug: formatSlug || formatName.toLowerCase().replace(/\s+/g, '-'),
            leadTimeDays: Number(formatLeadDays),
            description: formatDesc,
          }),
        });
        setFeedback({ type: 'success', message: `Format "${formatName}" created.` });
      }
      setShowFormatModal(false);
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save format.' });
    }
  };

  // Request Type Builder handlers
  const openCreateRequestType = () => {
    setEditingReqType(null);
    setReqTypeName('');
    setReqDeptType('social_media');
    setReqTypeDesc('');
    setReqFieldSchema([
      {
        fieldKey: 'campaignGoal',
        label: 'Campaign Objective',
        type: 'text',
        required: true,
        helperText: 'State the primary business goal',
      },
    ]);
    setShowReqTypeModal(true);
  };

  const openEditRequestType = (type: RequestTypeRecord) => {
    setEditingReqType(type);
    setReqTypeName(type.name);
    setReqDeptType(type.departmentType);
    setReqTypeDesc(type.description || '');
    setReqFieldSchema(type.fieldSchema || []);
    setShowReqTypeModal(true);
  };

  const handleAddFieldToSchema = () => {
    const key = `customField_${Date.now()}`;
    setReqFieldSchema([
      ...reqFieldSchema,
      {
        fieldKey: key,
        label: 'New Dynamic Field',
        type: 'text',
        required: false,
      },
    ]);
  };

  const handleRemoveFieldFromSchema = (index: number) => {
    setReqFieldSchema(reqFieldSchema.filter((_, idx) => idx !== index));
  };

  const handleUpdateFieldProperty = (index: number, prop: keyof DynamicFieldDefinition, val: any) => {
    const updated = [...reqFieldSchema];
    updated[index] = { ...updated[index], [prop]: val };
    setReqFieldSchema(updated);
  };

  const handleSaveRequestType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReqType) {
        await apiFetch(`/master-data/request-types/${editingReqType._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: reqTypeName,
            departmentType: reqDeptType,
            description: reqTypeDesc,
            fieldSchema: reqFieldSchema,
          }),
        });
        setFeedback({ type: 'success', message: `Request type "${reqTypeName}" updated.` });
      } else {
        await apiFetch('/master-data/request-types', {
          method: 'POST',
          body: JSON.stringify({
            name: reqTypeName,
            departmentType: reqDeptType,
            description: reqTypeDesc,
            fieldSchema: reqFieldSchema,
          }),
        });
        setFeedback({ type: 'success', message: `Request type "${reqTypeName}" created.` });
      }
      setShowReqTypeModal(false);
      loadAllMasterData();
      clearFeedback();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save request type.' });
    }
  };

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Master Data & Schemas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maintain platforms, SLAs, hold reasons, production lead times, and dynamic field schemas
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="glass-pill-container p-1 border border-white/90 flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              activeTab === 'platforms' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Platforms ({platforms.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('priorities')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              activeTab === 'priorities' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Priorities & SLA ({priorities.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('holdReasons')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              activeTab === 'holdReasons' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Reasons ({holdReasons.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('formats')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              activeTab === 'formats' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileVideo className="w-3.5 h-3.5" />
              <span>Lead Times ({formats.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('requestTypes')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
              activeTab === 'requestTypes' ? 'pill-active shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ListPlus className="w-3.5 h-3.5" />
              <span>Field Schemas ({requestTypes.length})</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Feedback */}
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
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Main Views */}
      {isLoading ? (
        <div className="glass-panel p-12 text-center rounded-[24px]">
          <div className="w-8 h-8 border-4 border-[#7a6af6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading master data catalog...</p>
        </div>
      ) : activeTab === 'platforms' ? (
        /* PLATFORMS */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Social Media & Delivery Platforms
            </h2>
            <button
              onClick={() => {
                setPlatformName('');
                setPlatformSlug('');
                setShowPlatformModal(true);
              }}
              className="px-4 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Platform</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {platforms.map((p) => (
              <div
                key={p._id}
                className="glass-panel p-4 rounded-2xl border border-white shadow-glass flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {p.name.slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{p.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">slug: {p.slug}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePlatform(p._id, p.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50/60 transition-all"
                  title="Remove Platform"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'priorities' ? (
        /* PRIORITIES */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              SLA Priority Tiers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {priorities.map((prio) => (
              <div
                key={prio._id}
                className="glass-panel p-5 rounded-2xl border border-white shadow-glass flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                      prio.name === 'urgent'
                        ? 'bg-rose-500/10 text-rose-700 border border-rose-200'
                        : prio.name === 'high'
                        ? 'bg-amber-500/10 text-amber-700 border border-amber-200'
                        : prio.name === 'medium'
                        ? 'bg-blue-500/10 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {prio.name} Priority
                  </span>
                  <span className="text-xs text-slate-400 font-mono font-bold">L{prio.level}</span>
                </div>

                <div className="flex items-baseline justify-between mt-2 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Target Response SLA:</span>
                  <span className="text-base font-extrabold text-slate-900">{prio.slaHours}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'holdReasons' ? (
        /* HOLD REASONS */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Task & Deliverable Hold Reasons
            </h2>
            <button
              onClick={() => {
                setHoldReasonText('');
                setHoldDesc('');
                setShowHoldModal(true);
              }}
              className="px-4 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Hold Reason</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {holdReasons.map((hr) => (
              <div
                key={hr._id}
                className="glass-panel p-4 rounded-2xl border border-white shadow-glass flex items-start justify-between gap-3"
              >
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 capitalize flex items-center gap-1.5">
                    <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{hr.reason}</span>
                  </h4>
                  {hr.description && (
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{hr.description}</p>
                  )}
                  {hr.category && (
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      {hr.category}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteHoldReason(hr._id)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Delete Reason"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'formats' ? (
        /* CONTENT FORMATS & LEAD TIMES */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Content Formats & Default Lead Times
            </h2>
            <button
              onClick={() => {
                setEditingFormat(null);
                setFormatName('');
                setFormatSlug('');
                setFormatLeadDays(7);
                setFormatDesc('');
                setShowFormatModal(true);
              }}
              className="px-4 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Format</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {formats.map((fmt) => (
              <div
                key={fmt._id}
                className="glass-panel p-5 rounded-2xl border border-white shadow-glass flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-extrabold text-slate-900">{fmt.name}</h4>
                    <button
                      onClick={() => openEditFormat(fmt)}
                      className="p-1 text-slate-400 hover:text-slate-900 rounded-md hover:bg-white"
                      title="Edit Lead Time"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 min-h-[32px]">
                    {fmt.description || 'Production pipeline format specification.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#7a6af6]" />
                    Lead Time:
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                    {fmt.leadTimeDays} Days
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* REQUEST TYPES & DYNAMIC SCHEMA BUILDER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Request Types List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Configured Request Types
              </h2>
              <button
                onClick={openCreateRequestType}
                className="px-3.5 py-1.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Type</span>
              </button>
            </div>

            <div className="space-y-3">
              {requestTypes.map((t) => {
                const isSelected = previewType?._id === t._id;
                return (
                  <div
                    key={t._id}
                    onClick={() => {
                      setPreviewType(t);
                      setPreviewValues({});
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-white shadow-md border-[#7a6af6]'
                        : 'glass-panel border-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase font-semibold">
                          {t.departmentType.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {t.fieldSchema?.length || 0} dynamic fields configured
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditRequestType(t);
                        }}
                        title="Edit Schema"
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#7a6af6]' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Live Dynamic Form Preview */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-[24px] border border-white shadow-glass">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#7a6af6]/10 text-[#7a6af6] flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Live Form Schema Renderer
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Previewing how {previewType?.name || 'this request type'} renders for requesters
                  </p>
                </div>
              </div>

              {previewType && (
                <button
                  onClick={() => openEditRequestType(previewType)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Configure Schema</span>
                </button>
              )}
            </div>

            {previewType ? (
              <div className="space-y-6">
                <DynamicFormRenderer
                  fields={previewType.fieldSchema || []}
                  values={previewValues}
                  onChange={(key, val) => setPreviewValues((prev) => ({ ...prev, [key]: val }))}
                />

                {/* Live JSON Output Inspector */}
                <div className="mt-6 p-4 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                  <div className="flex items-center justify-between text-slate-400 pb-2 mb-2 border-b border-slate-800 text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Code className="w-3 h-3" />
                      Live Form State Payload
                    </span>
                    <span>Ready for Phase 3 submit</span>
                  </div>
                  <pre>{JSON.stringify(previewValues, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-8">Select a request type on the left to preview.</p>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS */}
      {/* ======================================================== */}

      {/* Platform Modal */}
      {showPlatformModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-sm p-6 rounded-[28px] shadow-2xl border border-white">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add Media Platform</h2>
            <form onSubmit={handleSavePlatform} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TikTok"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug (optional)</label>
                <input
                  type="text"
                  placeholder="tiktok"
                  value={platformSlug}
                  onChange={(e) => setPlatformSlug(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlatformModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full"
                >
                  Add Platform
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hold Reason Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-sm p-6 rounded-[28px] shadow-2xl border border-white">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add Hold Reason</h2>
            <form onSubmit={handleSaveHoldReason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pending External Actor"
                  value={holdReasonText}
                  onChange={(e) => setHoldReasonText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={holdCategory}
                  onChange={(e) => setHoldCategory(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                >
                  <option value="internal">Internal Dependency</option>
                  <option value="client">Client / Partner</option>
                  <option value="technical">Equipment / Technical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Explanation</label>
                <textarea
                  rows={2}
                  value={holdDesc}
                  onChange={(e) => setHoldDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full"
                >
                  Save Reason
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Format Modal */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="glass-modal w-full max-w-md p-6 rounded-[28px] shadow-2xl border border-white">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              {editingFormat ? 'Edit Format Lead Time' : 'Add Content Format'}
            </h2>
            <form onSubmit={handleSaveFormat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Format Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. YouTube Long-form"
                  value={formatName}
                  onChange={(e) => setFormatName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Lead Time (Days) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={formatLeadDays}
                  onChange={(e) => setFormatLeadDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Used for deadline estimation in production planning.
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formatDesc}
                  onChange={(e) => setFormatDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormatModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full"
                >
                  Save Format
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Type & Field Schema Builder Modal */}
      {showReqTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="glass-modal w-full max-w-2xl p-6 sm:p-8 rounded-[28px] shadow-2xl border border-white max-h-[90vh] flex flex-col justify-between my-auto">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-extrabold text-slate-900">
                  {editingReqType ? `Edit Schema: ${editingReqType.name}` : 'Create Dynamic Request Type'}
                </h2>
                <button
                  onClick={() => setShowReqTypeModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type Name *</label>
                  <input
                    type="text"
                    required
                    value={reqTypeName}
                    onChange={(e) => setReqTypeName(e.target.value)}
                    placeholder="e.g. Influencer Campaign Brief"
                    className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Department *</label>
                  <select
                    value={reqDeptType}
                    onChange={(e) => setReqDeptType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white/80 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="social_media">Social Media</option>
                    <option value="performance">Performance Marketing</option>
                    <option value="sales">Sales</option>
                    <option value="academics">Academics</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Field Schema Editor */}
              <div className="border-t border-slate-200/80 pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Custom Fields Definition ({reqFieldSchema.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddFieldToSchema}
                    className="px-3 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-full flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Field</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {reqFieldSchema.map((field, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/60 border border-slate-200/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field Key (e.g. targetAudience)"
                          value={field.fieldKey}
                          onChange={(e) => handleUpdateFieldProperty(idx, 'fieldKey', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Label (e.g. Target Audience)"
                          value={field.label}
                          onChange={(e) => handleUpdateFieldProperty(idx, 'label', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => handleUpdateFieldProperty(idx, 'type', e.target.value)}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="number">Number</option>
                          <option value="select">Dropdown</option>
                          <option value="multiselect">Multi-Select</option>
                          <option value="date">Date</option>
                          <option value="url">URL</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveFieldFromSchema(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleUpdateFieldProperty(idx, 'required', e.target.checked)}
                            className="rounded text-[#7a6af6]"
                          />
                          <span>Required</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Helper text / instructions"
                          value={field.helperText || ''}
                          onChange={(e) => handleUpdateFieldProperty(idx, 'helperText', e.target.value)}
                          className="flex-1 px-2 py-1 bg-white/70 border border-slate-200 rounded text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReqTypeModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRequestType}
                className="px-6 py-2 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-sm"
              >
                Save Request Type & Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
