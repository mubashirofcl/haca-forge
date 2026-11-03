import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  MessageCircle,
  Briefcase,
  Building,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  Camera,
  Trash2,
  Send,
  AlertCircle,
  FileCheck,
  CalendarRange,
  Users,
  CheckSquare,
  BarChart3,
  Globe,
  Tag,
  Star,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { AvatarCropModal } from './AvatarCropModal';
import { RatingsFeedbackSection } from './RatingsFeedbackSection';
import { apiFetch } from '../lib/api';
import {
  WORK_PREFERENCES,
  ROLE_LABELS,
  UserRole,
} from '@mmp/shared';

export interface ProfileData {
  id: string;
  _id?: string;
  name: string;
  preferredName?: string;
  email?: string | null;
  role: string;
  jobRole?: string;
  department?: string;
  departmentId?: string | null;
  status?: string;
  avatarUrl?: string | null;
  avatarStorageId?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  languages?: string[];
  about?: string;
  skills?: string[];
  weeklyCapacityHours?: number;
  workPreferences?: string[];
  createdAt?: string;
  lastLoginAt?: string | null;
  rolePanelData?: any;
}

interface ProfileViewProps {
  profile: ProfileData;
  isSelf?: boolean;
  readOnly?: boolean;
  onProfileUpdated?: (updated: ProfileData) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isSelf = false,
  readOnly = false,
  onProfileUpdated,
}) => {
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isChangeRequestModalOpen, setIsChangeRequestModalOpen] = useState(false);
  const [changeRequestText, setChangeRequestText] = useState('');
  const [submittingChangeRequest, setSubmittingChangeRequest] = useState(false);
  const [changeRequestSuccess, setChangeRequestSuccess] = useState(false);

  // Editable Form State (only used when !readOnly && isSelf)
  const [formData, setFormData] = useState({
    preferredName: profile.preferredName || '',
    phone: profile.phone || '',
    whatsappNumber: profile.whatsappNumber || '',
    sameAsPhone: Boolean(profile.phone && profile.whatsappNumber === profile.phone),
    about: profile.about || '',
    languages: profile.languages || [],
    skills: profile.skills || [],
  });

  const [languageInput, setLanguageInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Role Panel Metrics State
  const [roleMetrics, setRoleMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(!profile.rolePanelData);

  useEffect(() => {
    setFormData({
      preferredName: profile.preferredName || '',
      phone: profile.phone || '',
      whatsappNumber: profile.whatsappNumber || '',
      sameAsPhone: Boolean(profile.phone && profile.whatsappNumber === profile.phone),
      about: profile.about || '',
      languages: profile.languages || [],
      skills: profile.skills || [],
    });
    setIsDirty(false);
  }, [profile]);

  // Fetch role-specific operational summary metrics if not already supplied on profile
  useEffect(() => {
    if (profile.rolePanelData) {
      setLoadingMetrics(false);
      return;
    }
    let isMounted = true;
    setLoadingMetrics(true);

    const fetchRoleData = async () => {
      try {
        if (profile.role === 'admin') {
          // Access requests count + users count
          const [reqRes, usersRes] = await Promise.allSettled([
            apiFetch<{ data: any[] }>('/api/admin/access-requests?status=pending'),
            apiFetch<{ data: any[] }>('/api/people'),
          ]);
          if (isMounted) {
            setRoleMetrics({
              pendingRequests: reqRes.status === 'fulfilled' ? reqRes.value.data?.length || 0 : 0,
              totalUsers: usersRes.status === 'fulfilled' ? usersRes.value.data?.length || 0 : 0,
            });
          }
        } else if (profile.role === 'creative_head') {
          // Approvals and pending plans
          const [feedRes, planRes] = await Promise.allSettled([
            apiFetch<{ data: any[] }>('/api/feedback?status=Feedback'),
            apiFetch<{ data: any[] }>('/api/calendar-plans?status=Submitted'),
          ]);
          if (isMounted) {
            setRoleMetrics({
              waitingApprovals: feedRes.status === 'fulfilled' ? feedRes.value.data?.length || 0 : 0,
              waitingPlans: planRes.status === 'fulfilled' ? planRes.value.data?.length || 0 : 0,
            });
          }
        } else if (profile.role === 'sm_manager') {
          // Plans and tracker items
          const [planRes, trackerRes] = await Promise.allSettled([
            apiFetch<{ data: any[] }>('/api/calendar-plans'),
            apiFetch<{ data: any[] }>('/api/content-pieces?needsOwner=true'),
          ]);
          if (isMounted) {
            const plans = planRes.status === 'fulfilled' ? planRes.value.data || [] : [];
            setRoleMetrics({
              totalPlans: plans.length,
              draftPlans: plans.filter((p: any) => p.status === 'Draft').length,
              needsOwnerCount: trackerRes.status === 'fulfilled' ? trackerRes.value.data?.length || 0 : 0,
            });
          }
        } else if (profile.role === 'team_member') {
          // My active steps & workload
          const [myWorkRes, workloadRes] = await Promise.allSettled([
            apiFetch<{ data: any[] }>('/api/my-work?status=active'),
            apiFetch<{ data: any }>('/api/workload'),
          ]);
          if (isMounted) {
            setRoleMetrics({
              activeSteps: myWorkRes.status === 'fulfilled' ? myWorkRes.value.data?.length || 0 : 0,
              utilizationBand: workloadRes.status === 'fulfilled' ? 'Optimal' : 'Standard',
            });
          }
        } else if (profile.role === 'executive') {
          // Executive summary
          const dashRes = await apiFetch<any>('/api/dashboard').catch(() => null);
          if (isMounted && dashRes) {
            setRoleMetrics({
              summaryAvailable: true,
              throughput: dashRes.throughput || null,
            });
          }
        }
      } catch {
        // Fallback silently if metrics fail
      } finally {
        if (isMounted) setLoadingMetrics(false);
      }
    };

    fetchRoleData();
    return () => {
      isMounted = false;
    };
  }, [profile.role, profile.rolePanelData]);

  // Derived metrics from rolePanelData or asynchronously fetched roleMetrics
  const adminMetrics = profile.rolePanelData?.adminMetrics || profile.rolePanelData;
  const adminPending = adminMetrics?.pendingAccessRequests ?? adminMetrics?.pendingRequests ?? roleMetrics?.pendingRequests ?? 0;
  const adminUsersByRole = adminMetrics?.usersByRole || roleMetrics?.usersByRole || null;
  const adminTotalUsers = adminMetrics?.totalUsers ?? roleMetrics?.totalUsers ?? 0;

  const creativeMetrics = profile.rolePanelData?.creativeMetrics || profile.rolePanelData;
  const stagesWaitingApproval = creativeMetrics?.stagesWaitingApproval ?? roleMetrics?.waitingApprovals ?? 0;
  const plansWaiting = creativeMetrics?.plansWaiting ?? roleMetrics?.waitingPlans ?? 0;

  const smMetrics = profile.rolePanelData?.smMetrics || profile.rolePanelData;
  const smPlanStatus = smMetrics?.planStatus || 'Active';
  const smNeedsOwner = smMetrics?.needsOwnerCount ?? roleMetrics?.needsOwnerCount ?? 0;
  const smLateItems = smMetrics?.lateItemsCount ?? roleMetrics?.lateItemsCount ?? 0;

  const execMetrics = profile.rolePanelData?.companySummary || profile.rolePanelData;
  const execActiveUsers = execMetrics?.activeUsersCount ?? 0;
  const execActiveDeliverables = execMetrics?.activeDeliverablesCount ?? 0;

  const memberMetrics = profile.rolePanelData?.memberMetrics || profile.rolePanelData;
  const memberSteps = memberMetrics?.myCurrentStepsCount ?? memberMetrics?.activeSteps ?? roleMetrics?.activeSteps ?? 0;
  const memberBand = memberMetrics?.capacityBand ?? roleMetrics?.utilizationBand ?? 'Balanced';
  const memberOnTimeRate = memberMetrics?.onTimeRate ?? 95;

  // Form Field Change Handlers
  const handleFieldChange = (field: string, value: any) => {
    setIsDirty(true);
    setSaveSuccessMessage(null);
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));

    if (field === 'sameAsPhone') {
      const nextSame = Boolean(value);
      setFormData((prev) => ({
        ...prev,
        sameAsPhone: nextSame,
        whatsappNumber: nextSame ? prev.phone : prev.whatsappNumber,
      }));
      return;
    }

    if (field === 'phone') {
      setFormData((prev) => ({
        ...prev,
        phone: value,
        whatsappNumber: prev.sameAsPhone ? value : prev.whatsappNumber,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    try {
      await apiFetch('/api/me/avatar', { method: 'DELETE' });
      if (onProfileUpdated) {
        onProfileUpdated({ ...profile, avatarUrl: null });
      }
      setSaveSuccessMessage('Profile photo removed.');
    } catch (err: any) {
      setFieldErrors({ form: err?.message || 'Failed to remove photo.' });
    }
  };

  const addLanguage = () => {
    const val = languageInput.trim();
    if (!val) return;
    if (formData.languages.length >= 5) {
      setFieldErrors((prev) => ({ ...prev, languages: 'Maximum 5 languages permitted.' }));
      return;
    }
    if (formData.languages.includes(val)) return;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, languages: [...prev.languages, val] }));
    setLanguageInput('');
  };

  const removeLanguage = (lang: string) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, languages: prev.languages.filter((l) => l !== lang) }));
  };

  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (formData.skills.length >= 10) {
      setFieldErrors((prev) => ({ ...prev, skills: 'Maximum 10 skill tags permitted.' }));
      return;
    }
    if (val.length > 30) {
      setFieldErrors((prev) => ({ ...prev, skills: 'Skill tag must not exceed 30 characters.' }));
      return;
    }
    if (formData.skills.includes(val)) return;
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, val] }));
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setSaveSuccessMessage(null);

    // Validation
    const errors: Record<string, string> = {};
    if (formData.phone && !/^\+?[1-9]\d{6,14}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number (e.g. +919876543210).';
    }
    if (
      formData.whatsappNumber &&
      !/^\+?[1-9]\d{6,14}$/.test(formData.whatsappNumber.replace(/[\s\-\(\)]/g, ''))
    ) {
      errors.whatsappNumber = 'Please enter a valid WhatsApp number.';
    }
    if (formData.about && formData.about.length > 200) {
      errors.about = 'About me cannot exceed 200 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaving(false);
      return;
    }

    try {
      const res = await apiFetch<{ data: ProfileData }>('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredName: formData.preferredName,
          phone: formData.phone,
          whatsappNumber: formData.whatsappNumber,
          languages: formData.languages,
          about: formData.about,
          skills: formData.skills,
        }),
      });

      if (res.data) {
        setIsDirty(false);
        setSaveSuccessMessage('Profile saved successfully!');
        if (onProfileUpdated) onProfileUpdated(res.data);
      }
    } catch (err: any) {
      setFieldErrors({ form: err?.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  // Submit Work Details Change Request
  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeRequestText.trim()) return;

    setSubmittingChangeRequest(true);
    try {
      await apiFetch('/api/me/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedChanges: changeRequestText.trim() }),
      });
      setChangeRequestSuccess(true);
      setTimeout(() => {
        setIsChangeRequestModalOpen(false);
        setChangeRequestSuccess(false);
        setChangeRequestText('');
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Failed to submit change request');
    } finally {
      setSubmittingChangeRequest(false);
    }
  };

  // Role Badge Color Mapping
  const roleDisplay = ROLE_LABELS[profile.role as UserRole] || profile.role?.replace('_', ' ') || 'Team Member';
  const getBadgeStyle = (r: string) => {
    switch (r) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-700 border border-purple-200/60';
      case 'creative_head':
        return 'bg-amber-500/10 text-amber-800 border border-amber-200/60';
      case 'sm_manager':
        return 'bg-blue-500/10 text-blue-700 border border-blue-200/60';
      case 'executive':
        return 'bg-indigo-500/10 text-indigo-700 border border-indigo-200/60';
      case 'team_member':
      default:
        return 'bg-emerald-500/10 text-emerald-700 border border-emerald-200/60';
    }
  };

  const isEditable = !readOnly && isSelf;
  const canSeeContact = Boolean(profile.email !== null && profile.email !== undefined);

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/80 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar with Crop Trigger */}
          <div className="relative group">
            <Avatar
              url={profile.avatarUrl}
              name={profile.name}
              userId={profile.id || profile._id}
              size="xl"
              className="ring-4 ring-white shadow-xl"
            />
            {isEditable && (
              <button
                type="button"
                onClick={() => setIsCropModalOpen(true)}
                title="Change photo"
                className="absolute inset-0 rounded-full bg-slate-950/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-bold mt-1">Change</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {profile.preferredName ? `${profile.preferredName} (${profile.name})` : profile.name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getBadgeStyle(profile.role)}`}>
                {roleDisplay}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {profile.status ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : 'Active'}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-600 flex flex-wrap items-center gap-2">
              <span>{profile.jobRole || 'Specialist'}</span>
              <span>&bull;</span>
              <span>{profile.department || 'General Marketing'}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-medium pt-1">
              <span>Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '2026'}</span>
              {profile.lastLoginAt && (
                <>
                  <span>&bull;</span>
                  <span>Last sign-in {new Date(profile.lastLoginAt).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Change / Remove Photo Buttons */}
        {isEditable && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setIsCropModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-xs transition-all active:scale-95 flex items-center gap-1.5 min-h-[44px]"
            >
              <Camera className="w-4 h-4 text-purple-600" />
              <span>{profile.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
            </button>

            {profile.avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all flex items-center gap-1.5 min-h-[44px]"
                title="Remove photo with confirmation"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dirty state notification bar */}
      {isDirty && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
          <span>You have unsaved changes to your profile.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  preferredName: profile.preferredName || '',
                  phone: profile.phone || '',
                  whatsappNumber: profile.whatsappNumber || '',
                  sameAsPhone: Boolean(profile.phone && profile.whatsappNumber === profile.phone),
                  about: profile.about || '',
                  languages: profile.languages || [],
                  skills: profile.skills || [],
                });
                setIsDirty(false);
                setFieldErrors({});
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-black shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {fieldErrors.form && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{fieldErrors.form}</span>
        </div>
      )}

      {/* 2. Main Two-Column Layout (About Me Form & Work Details) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* About Section */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-white/80 shadow-glass space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">About Me</h2>
              <p className="text-xs text-slate-500">Contact details and personal background</p>
            </div>
          </div>

          {isEditable ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Preferred Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Preferred Name
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={formData.preferredName}
                  onChange={(e) => handleFieldChange('preferredName', e.target.value)}
                  placeholder="e.g. Jane"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[44px]"
                />
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="+919876543210"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[44px]"
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-rose-600 font-semibold mt-1">{fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sameAsPhone}
                        onChange={(e) => handleFieldChange('sameAsPhone', e.target.checked)}
                        className="rounded text-purple-600 focus:ring-purple-400 cursor-pointer"
                      />
                      <span>Same as phone</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    value={formData.whatsappNumber}
                    disabled={formData.sameAsPhone}
                    onChange={(e) => handleFieldChange('whatsappNumber', e.target.value)}
                    placeholder="+919876543210"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-slate-100 disabled:text-slate-400 min-h-[44px]"
                  />
                  {fieldErrors.whatsappNumber && (
                    <p className="text-xs text-rose-600 font-semibold mt-1">{fieldErrors.whatsappNumber}</p>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Languages (Max 5)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                    >
                      <span>{lang}</span>
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang)}
                        className="hover:text-purple-900"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                {formData.languages.length < 5 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLanguage();
                        }
                      }}
                      placeholder="Add language (e.g. English) and press Add"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-900 focus:outline-none min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={addLanguage}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 min-h-[44px]"
                    >
                      Add
                    </button>
                  </div>
                )}
                {fieldErrors.languages && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">{fieldErrors.languages}</p>
                )}
              </div>

              {/* About Me Bio */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    About Me
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {formData.about.length} / 200
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={formData.about}
                  onChange={(e) => handleFieldChange('about', e.target.value)}
                  placeholder="Write a short bio or summary about your background, craftsmanship, or creative focus..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white/80 border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {fieldErrors.about && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">{fieldErrors.about}</p>
                )}
              </div>

              {/* Skills Tags */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Skills & Tools (Max 10)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="hover:text-indigo-900"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                {formData.skills.length < 10 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add tag (e.g. Motion Graphics) and press Add"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-900 focus:outline-none min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 min-h-[44px]"
                    >
                      Add
                    </button>
                  </div>
                )}
                {fieldErrors.skills && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">{fieldErrors.skills}</p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      preferredName: profile.preferredName || '',
                      phone: profile.phone || '',
                      whatsappNumber: profile.whatsappNumber || '',
                      sameAsPhone: Boolean(profile.phone && profile.whatsappNumber === profile.phone),
                      about: profile.about || '',
                      languages: profile.languages || [],
                      skills: profile.skills || [],
                    });
                    setIsDirty(false);
                  }}
                  disabled={!isDirty || saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isDirty || saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black disabled:opacity-50 shadow-md min-h-[44px]"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* Read-Only Display */
            <div className="space-y-4 text-xs sm:text-sm">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Preferred Name
                </span>
                <p className="font-semibold text-slate-900">{profile.preferredName || profile.name}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                  </span>
                  {canSeeContact ? (
                    <p className="font-semibold text-slate-800">{profile.phone || 'Not provided'}</p>
                  ) : (
                    <p className="font-mono text-slate-400">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-slate-400" /> WhatsApp
                  </span>
                  {canSeeContact ? (
                    <p className="font-semibold text-slate-800">{profile.whatsappNumber || 'Not provided'}</p>
                  ) : (
                    <p className="font-mono text-slate-400">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</p>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-400" /> Languages
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.languages && profile.languages.length > 0 ? (
                    profile.languages.map((l) => (
                      <span key={l} className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700">
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">None listed</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  About
                </span>
                <p className="text-slate-700 leading-relaxed bg-white/50 p-3 rounded-2xl border border-slate-100">
                  {profile.about || 'No background description provided.'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Skills & Tools
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.skills && profile.skills.length > 0 ? (
                    profile.skills.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">No skills tagged</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Work Details (Read-only for all roles) */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl border border-white/80 shadow-glass space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Work Details</h2>
                <p className="text-xs text-slate-500">Official Organization Details (Read-only)</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
              <Lock className="w-3 h-3" /> Managed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
            <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Role & Job Role
              </span>
              <p className="font-bold text-slate-900">{profile.jobRole || 'Specialist'}</p>
              <p className="text-xs text-purple-700 font-semibold">{roleDisplay}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building className="w-3 h-3" /> Department
              </span>
              <p className="font-bold text-slate-900">{profile.department || 'General'}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Weekly Capacity
              </span>
              <p className="font-bold text-purple-700">{profile.weeklyCapacityHours || 40} hours / week</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email Address
              </span>
              {canSeeContact ? (
                <p className="font-semibold text-slate-900 truncate">{profile.email}</p>
              ) : (
                <p className="font-mono text-slate-400">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;@&bull;&bull;&bull;&bull;</p>
              )}
            </div>
          </div>

          {/* Work Preferences Chips */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Pipeline Stage Preferences ({profile.workPreferences?.length || 0})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WORK_PREFERENCES.map((pref) => {
                const isAssigned = (profile.workPreferences || []).includes(pref);
                return (
                  <div
                    key={pref}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition-all ${
                      isAssigned
                        ? 'bg-white border-indigo-200 text-slate-900 font-bold shadow-xs'
                        : 'bg-slate-50/50 border-slate-200/50 text-slate-400 font-medium'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${isAssigned ? 'text-indigo-600' : 'text-slate-300'}`}
                    />
                    <span>{pref}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Request a Change Button */}
          {isSelf && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsChangeRequestModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request a change in role, department, or capacity</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Role Panel (One Slot, Five Role Contents) */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-white/80 shadow-glass space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Operational Pulse: {roleDisplay}</h2>
              <p className="text-xs text-slate-500">Live operational responsibilities and pending queues</p>
            </div>
          </div>
        </div>

        {loadingMetrics ? (
          <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
            Loading operational telemetry...
          </div>
        ) : (
          <div>
            {/* 1. Admin Role Panel */}
            {profile.role === 'admin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/admin/access-requests"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Pending Access Requests
                    </span>
                    <p className="text-2xl font-black text-slate-900 mt-1">
                      {adminPending}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                    Review <ExternalLink className="w-3 h-3" />
                  </span>
                </Link>

                <Link
                  to="/people"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Team Distribution by Role
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {adminUsersByRole ? (
                        Object.entries(adminUsersByRole).map(([r, count]) => (
                          <span key={r} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                            {r}: {String(count)}
                          </span>
                        ))
                      ) : (
                        <p className="text-2xl font-black text-slate-900">{adminTotalUsers}</p>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
                    People <Users className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            )}

            {/* 2. Creative Head Role Panel */}
            {profile.role === 'creative_head' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/feedback"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Stages Waiting Review
                    </span>
                    <p className="text-2xl font-black text-amber-600 mt-1">
                      {stagesWaitingApproval}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                    Review Studio <FileCheck className="w-3 h-3" />
                  </span>
                </Link>

                <Link
                  to="/calendar?tab=plans"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Plans Awaiting Approval
                    </span>
                    <p className="text-2xl font-black text-indigo-600 mt-1">
                      {plansWaiting}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                    Plans Tab <CalendarRange className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            )}

            {/* 3. SM Manager Role Panel */}
            {profile.role === 'sm_manager' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Content Pipeline Status
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {smPlanStatus}
                  </p>
                </div>

                <Link
                  to="/calendar?tab=tracker&needsOwner=true"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Stages Needing Owner
                    </span>
                    <p className="text-2xl font-black text-amber-600 mt-1">
                      {smNeedsOwner}
                    </p>
                  </div>
                  <Users className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                </Link>

                <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Late Pipeline Items
                  </span>
                  <p className="text-2xl font-black text-rose-600 mt-1">
                    {smLateItems}
                  </p>
                </div>
              </div>
            )}

            {/* 4. Executive Role Panel (Read-only Company Summary) */}
            {profile.role === 'executive' && (
              <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Company Operational Summary
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">Read-only</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 block">Active Team Members</span>
                    <p className="text-2xl font-black text-slate-900 mt-1">{execActiveUsers}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 block">Active Deliverables</span>
                    <p className="text-2xl font-black text-indigo-600 mt-1">{execActiveDeliverables}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Team Member Role Panel */}
            {profile.role === 'team_member' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                  to="/my-work"
                  className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 shadow-xs flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active Deliverables in Flight
                    </span>
                    <p className="text-2xl font-black text-indigo-600 mt-1">
                      {memberSteps}
                    </p>
                  </div>
                  <CheckSquare className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                </Link>

                <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Current Workload Band
                  </span>
                  <p className="text-lg font-black text-emerald-700 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {memberBand}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/70 border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    On-Time Rate
                  </span>
                  <p className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-current" />
                    {memberOnTimeRate}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Ratings & Feedback Section */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl border border-white/80 shadow-glass space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-current" />
            Quality Ratings & Craftsmanship Feedback
          </h2>
        </div>
        <RatingsFeedbackSection
          personId={profile.id || profile._id || ''}
          personName={profile.name}
          isOwnProfile={isSelf}
          canEditRating={profile.role === 'creative_head' || profile.role === 'admin'}
        />
      </div>

      {/* Crop Avatar Modal */}
      {isCropModalOpen && (
        <AvatarCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          currentAvatarUrl={profile.avatarUrl}
          onAvatarUpdated={(newUrl) => {
            if (onProfileUpdated) {
              onProfileUpdated({ ...profile, avatarUrl: newUrl });
            }
          }}
        />
      )}

      {/* Request a Change Modal */}
      {isChangeRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="glass-modal max-w-md w-full p-6 sm:p-7 rounded-3xl border border-white/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Request Work Details Update</h3>
              <button
                type="button"
                onClick={() => setIsChangeRequestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                &times;
              </button>
            </div>

            {changeRequestSuccess ? (
              <div className="p-4 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-bold text-slate-900">Request Dispatched!</p>
                <p className="text-xs text-slate-500">Every active administrator has been notified.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Submit a request to update your assigned job role, department, weekly capacity hours, or pipeline stage preferences.
                </p>
                <textarea
                  required
                  rows={4}
                  minLength={5}
                  maxLength={1000}
                  value={changeRequestText}
                  onChange={(e) => setChangeRequestText(e.target.value)}
                  placeholder="Describe the changes you need made to your operational profile..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsChangeRequestModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingChangeRequest || !changeRequestText.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black disabled:opacity-50 min-h-[44px] shadow-sm"
                  >
                    {submittingChangeRequest ? 'Submitting...' : 'Send Request'}
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
