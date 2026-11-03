import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Star,
  Mail,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Pencil,
  Lock,
  CheckCircle2,
  Camera,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { AvatarCropModal } from '../../components/AvatarCropModal';
import {
  ROLE_LABELS,
  JOB_ROLES,
  formatDuration,
} from '@mmp/shared';

export const WorkerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // If path is /profile, target person is current logged in user
  const isProfileRoute = location.pathname.startsWith('/profile');
  const targetId = isProfileRoute ? user?._id || user?.id : id;

  const isSelf = user?._id === targetId || user?.id === targetId;
  const isExecutive = user?.role === 'executive';
  const isAdmin = user?.role === 'admin';
  const isCreativeHead = user?.role === 'creative_head';
  const isSmManager = user?.role === 'sm_manager';

  // Base Profile & KPIs
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global Date Range
  const [dateRange, setDateRange] = useState('30d');

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'work' | 'performance' | 'ratings' | 'activity' | 'changes'
  >('overview');

  // Tab Data States
  const [overviewData, setOverviewData] = useState<any>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [ratingsData, setRatingsData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [changesData, setChangesData] = useState<any>(null);

  // Modals
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [expandedWorkItemId, setExpandedWorkItemId] = useState<string | null>(null);

  // Edit Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    preferredName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    sameAsPhone: true,
    about: '',
    languages: [] as string[],
    skills: [] as string[],
  });

  const [languageInput, setLanguageInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Phone OTP Verification State
  const [initialPhone, setInitialPhone] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Form states for Edit Details Modal
  const [editForm, setEditForm] = useState({
    jobRole: '',
    departmentId: '',
    weeklyCapacityHours: 40,
    workPreferences: [] as string[],
    reason: '',
  });

  // Reassign state
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [targetAssigneeId, setTargetAssigneeId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Fetch base profile
  const fetchBaseProfile = async () => {
    if (!targetId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}`);
      setProfile(res.data);
      setEditForm({
        jobRole: res.data.jobRole || '',
        departmentId: res.data.department?._id || '',
        weeklyCapacityHours: res.data.weeklyCapacityHours || 40,
        workPreferences: res.data.workPreferences || [],
        reason: '',
      });
    } catch (err: any) {
      setError(err?.message || 'Profile not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseProfile();
  }, [targetId]);

  // Load Tab specific data
  useEffect(() => {
    if (!targetId || !profile) return;

    if (activeTab === 'overview') {
      apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}/overview`)
        .then((res) => setOverviewData(res.data))
        .catch(() => {});
    } else if (activeTab === 'work') {
      apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}/work`)
        .then((res) => setWorkData(res.data))
        .catch(() => {});
    } else if (activeTab === 'performance') {
      apiFetch<{ success: boolean; data: any }>(
        `/api/team/${targetId}/performance?range=${dateRange}`
      )
        .then((res) => setPerformanceData(res.data))
        .catch(() => {});
    } else if (activeTab === 'ratings') {
      apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}/ratings`)
        .then((res) => setRatingsData(res.data))
        .catch(() => {});
    } else if (activeTab === 'activity') {
      apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}/activity`)
        .then((res) => setActivityData(res.data))
        .catch(() => {});
    } else if (activeTab === 'changes' && (isAdmin || isCreativeHead)) {
      apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}/changes`)
        .then((res) => setChangesData(res.data))
        .catch(() => {});
    }
  }, [targetId, profile, activeTab, dateRange]);

  // Fetch worker list for reassign modal
  useEffect(() => {
    if (showReassignModal) {
      apiFetch<{ success: boolean; data: { items: any[] } }>('/api/team?limit=100')
        .then((res) => {
          setAllWorkers(res.data.items.filter((w) => w._id !== targetId));
        })
        .catch(() => {});
    }
  }, [showReassignModal, targetId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading worker profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Profile Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested team member profile is not accessible or does not exist.
        </p>
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
        >
          Return to Team Directory
        </button>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || profile.role;
  const displayName = profile.preferredName
    ? `${profile.preferredName} (${profile.name})`
    : profile.name;

  const isWorkerRole = profile.role === 'team_member';
  const isSmOrCreativeRole = profile.role === 'sm_manager' || profile.role === 'creative_head';

  // Available tabs based on viewed role
  const availableTabs: Array<{ id: any; label: string }> = [
    { id: 'overview', label: 'Overview' },
  ];

  if (isWorkerRole) {
    availableTabs.push(
      { id: 'work', label: 'Work' },
      { id: 'performance', label: 'Performance' },
      { id: 'ratings', label: 'Ratings' },
      { id: 'activity', label: 'Activity' }
    );
    if (isAdmin || isCreativeHead) {
      availableTabs.push({ id: 'changes', label: 'Changes Log' });
    }
  } else if (isSmOrCreativeRole) {
    availableTabs.push({ id: 'activity', label: 'Activity' });
  }

  // Handle Operational Edit Save
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/team/${targetId}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setShowEditModal(false);
      fetchBaseProfile();
    } catch (err: any) {
      alert(err?.message || 'Failed to update details');
    }
  };

  // Open Edit Profile Modal
  const openEditProfileModal = () => {
    if (!profile) return;
    const phoneVal = profile.phone || '';
    const waVal = profile.whatsappNumber || '';
    setProfileForm({
      name: profile.name || '',
      preferredName: profile.preferredName || '',
      email: profile.email || '',
      phone: phoneVal,
      whatsappNumber: waVal,
      sameAsPhone: Boolean(phoneVal && waVal === phoneVal),
      about: profile.about || '',
      languages: Array.isArray(profile.languages) ? [...profile.languages] : [],
      skills: Array.isArray(profile.skills) ? [...profile.skills] : [],
    });
    setInitialPhone(phoneVal);
    setIsPhoneVerified(Boolean(phoneVal && (profile.phoneVerified || profile.phoneVerifiedAt)));
    setPhoneVerificationToken(null);
    setOtpSent(false);
    setOtpCode('');
    setOtpError(null);
    setOtpSuccess(null);
    setProfileError(null);
    setProfileSuccess(null);
    setShowEditProfileModal(true);
  };

  // Phone number change handling
  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/[\s\-\(\)]/g, '');
    const cleanInitial = initialPhone.replace(/[\s\-\(\)]/g, '');
    setProfileForm((prev) => ({
      ...prev,
      phone: val,
      whatsappNumber: prev.sameAsPhone ? val : prev.whatsappNumber,
    }));
    setOtpError(null);
    setOtpSuccess(null);
    if (clean === cleanInitial && profile?.phoneVerified) {
      setIsPhoneVerified(true);
      setOtpSent(false);
    } else {
      setIsPhoneVerified(false);
      setPhoneVerificationToken(null);
    }
  };

  // Send OTP for mobile verification
  const handleSendPhoneOtp = async () => {
    const clean = profileForm.phone.replace(/[\s\-\(\)]/g, '');
    if (!clean || !/^\+?[1-9]\d{6,14}$/.test(clean)) {
      setOtpError('Please enter a valid mobile number (e.g. +919876543210).');
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string; testOtp?: string }>(
        '/api/me/phone-otp/send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: clean }),
        }
      );
      setOtpSent(true);
      setOtpCountdown(30);
      setOtpSuccess(res.message || 'OTP verification code sent to your mobile phone.');
    } catch (err: any) {
      setOtpError(err?.message || 'Failed to send OTP. Please check your number.');
    } finally {
      setOtpSending(false);
    }
  };

  // Verify mobile OTP
  const handleVerifyPhoneOtp = async () => {
    const clean = profileForm.phone.replace(/[\s\-\(\)]/g, '');
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }
    setOtpVerifying(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        verified: boolean;
        verificationToken: string;
        message: string;
      }>('/api/me/phone-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, otp: otpCode.trim() }),
      });
      if (res.verified && res.verificationToken) {
        setIsPhoneVerified(true);
        setPhoneVerificationToken(res.verificationToken);
        setOtpSuccess('Mobile phone verified successfully!');
        setOtpSent(false);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setOtpVerifying(false);
    }
  };

  // Add / Remove Languages
  const addLanguage = () => {
    const val = languageInput.trim();
    if (!val) return;
    if (profileForm.languages.length >= 5) {
      setProfileError('Maximum 5 languages permitted.');
      return;
    }
    if (!profileForm.languages.includes(val)) {
      setProfileForm((prev) => ({ ...prev, languages: [...prev.languages, val] }));
    }
    setLanguageInput('');
  };

  const removeLanguage = (lang: string) => {
    setProfileForm((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l !== lang),
    }));
  };

  // Add / Remove Skills
  const addSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (profileForm.skills.length >= 10) {
      setProfileError('Maximum 10 skill tags permitted.');
      return;
    }
    if (val.length > 30) {
      setProfileError('Skill tag must not exceed 30 characters.');
      return;
    }
    if (!profileForm.skills.includes(val)) {
      setProfileForm((prev) => ({ ...prev, skills: [...prev.skills, val] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setProfileForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileForm.name || profileForm.name.trim().length < 2) {
      setProfileError('Full legal name must be at least 2 characters.');
      return;
    }

    const cleanPhone = profileForm.phone.replace(/[\s\-\(\)]/g, '');
    const cleanInitial = initialPhone.replace(/[\s\-\(\)]/g, '');

    // Mobile verification enforcement
    if (cleanPhone && cleanPhone !== cleanInitial && !isPhoneVerified) {
      setProfileError('Mobile phone number must be verified with OTP before saving.');
      return;
    }

    setSavingProfile(true);

    try {
      if (isSelf) {
        const payload: any = {
          name: profileForm.name.trim(),
          preferredName: profileForm.preferredName.trim(),
          whatsappNumber: profileForm.whatsappNumber,
          about: profileForm.about.trim(),
          languages: profileForm.languages,
          skills: profileForm.skills,
        };

        if (cleanPhone !== cleanInitial) {
          payload.phone = cleanPhone;
          if (phoneVerificationToken) {
            payload.phoneVerificationToken = phoneVerificationToken;
          }
        }

        await apiFetch<{ success: boolean; data: any }>('/api/me/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        setProfileSuccess('Profile updated successfully!');
        await fetchBaseProfile();
        setTimeout(() => setShowEditProfileModal(false), 500);
      } else if (isAdmin) {
        const payload: any = {
          name: profileForm.name.trim(),
          preferredName: profileForm.preferredName.trim(),
          email: profileForm.email.trim(),
          phone: cleanPhone,
          whatsappNumber: profileForm.whatsappNumber,
          about: profileForm.about.trim(),
          languages: profileForm.languages,
          skills: profileForm.skills,
          reason: 'Admin profile update',
        };

        await apiFetch<{ success: boolean; data: any }>(`/api/team/${targetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        setProfileSuccess('Profile updated successfully!');
        await fetchBaseProfile();
        setTimeout(() => setShowEditProfileModal(false), 500);
      }
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Reassign
  const handleReassign = async () => {
    if (!targetAssigneeId) {
      alert('Please select a target assignee');
      return;
    }
    try {
      setReassigning(true);
      await apiFetch(`/api/team/${targetId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ targetPersonId: targetAssigneeId }),
      });
      setShowReassignModal(false);
      alert('Active steps reassigned successfully');
      fetchBaseProfile();
    } catch (err: any) {
      alert(err?.message || 'Failed to reassign steps');
    } finally {
      setReassigning(false);
    }
  };

  // Status toggle
  const handleToggleStatus = async () => {
    if (!confirm(`Are you sure you want to change status to ${profile.status === 'active' ? 'suspended' : 'active'}?`)) return;
    try {
      await apiFetch(`/api/team/${targetId}/status`, { method: 'POST' });
      fetchBaseProfile();
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-16 space-y-6 animate-fade-in">
      {/* Back to Directory Link (leadership only) */}
      {!isProfileRoute && (
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Team Directory
        </button>
      )}

      {/* Transparency Notice for Worker Self-View */}
      {isSelf && isWorkerRole && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="font-medium">
            Your work history, timings and ratings are visible to the Admin, Creative Head, SM
            Manager and Executive.
          </p>
        </div>
      )}

      {/* Profile Header Glass Card */}
      <div className="p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`relative group ${isSelf || isAdmin ? 'cursor-pointer' : ''}`}
              onClick={() => (isSelf || isAdmin) && setIsCropModalOpen(true)}
              title={isSelf || isAdmin ? 'Click to change profile photo' : undefined}
            >
              <Avatar
                url={profile.avatarUrl}
                name={profile.name}
                size="lg"
                className="border-2 border-white shadow-xs"
              />
              {(isSelf || isAdmin) && (
                <div className="absolute inset-0 rounded-full bg-slate-900/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-bold text-white mt-0.5">Edit</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {displayName}
                </h1>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    profile.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {profile.status}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                  {roleLabel}
                </span>
                {profile.jobRole && (
                  <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {profile.jobRole}
                  </span>
                )}
                {profile.department?.name && (
                  <span className="font-semibold text-slate-500">
                    {profile.department.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium pt-1">
                <span>
                  Member since{' '}
                  {profile.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
                <span>•</span>
                <span>
                  Last sign-in:{' '}
                  {profile.lastLoginAt
                    ? new Date(profile.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </span>
                <span>•</span>
                <span className="font-bold text-slate-700">
                  Capacity: {profile.weeklyCapacityHours || 40}h / week
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons for Elevated Roles & Profile Editing */}
          {!isExecutive && (
            <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
              {(isSelf || isAdmin) && (
                <button
                  type="button"
                  onClick={openEditProfileModal}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-200 transition-all min-h-[44px] flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}

              {(isAdmin || isCreativeHead || isSmManager) && !isSelf && (
                <button
                  type="button"
                  onClick={() => setShowReassignModal(true)}
                  className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-all min-h-[44px]"
                >
                  Reassign Steps
                </button>
              )}

              {(isAdmin || isCreativeHead) && !isSelf && (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all min-h-[44px]"
                >
                  Edit Operational Details
                </button>
              )}

              {isAdmin && !isSelf && (
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-rose-600 font-bold text-xs transition-all min-h-[44px]"
                >
                  {profile.status === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
              )}
            </div>
          )}
        </div>

          {/* Contact Details (Hidden for Executive) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
            {profile.email ? (
              <div className="flex items-center gap-2 text-slate-600 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{profile.email}</span>
                <span
                  className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0"
                  title="Official registered email (Admin managed)"
                >
                  <Lock className="w-2.5 h-2.5 text-slate-400" /> Official
                </span>
              </div>
            ) : isExecutive ? (
              <span className="text-slate-400 italic">Contact details restricted</span>
            ) : null}

            {profile.phone && (
              <div className="flex items-center gap-2 text-slate-600 truncate">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{profile.phone}</span>
                {(profile.phoneVerified || profile.phoneVerifiedAt) && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Verified
                  </span>
                )}
              </div>
            )}

            {profile.whatsappNumber && (
              <a
                href={`https://wa.me/${profile.whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-600 font-bold hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                WhatsApp Message
              </a>
            )}
          </div>

        {/* Skills and Work Preferences Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
            Work Preferences:
          </span>
          {profile.workPreferences?.length > 0 ? (
            profile.workPreferences.map((pref: string) => (
              <span
                key={pref}
                className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-100"
              >
                {pref}
              </span>
            ))
          ) : (
            <span className="text-slate-400 italic">None specified</span>
          )}

          {profile.skills?.length > 0 && (
            <>
              <span className="text-slate-300 ml-2">|</span>
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider ml-2">
                Skills:
              </span>
              {profile.skills.map((skill: string) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]"
                >
                  {skill}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Load & Band */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Weekly Load
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-slate-900">
              {profile.kpis?.loadPct || 0}%
            </span>
            <span
              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                profile.kpis?.capacityBand === 'Overloaded'
                  ? 'bg-rose-50 text-rose-700'
                  : profile.kpis?.capacityBand === 'High'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {profile.kpis?.capacityBand || 'Healthy'}
            </span>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            In Progress
          </span>
          <span className="text-lg font-black text-blue-600">
            {profile.kpis?.inProgressCount || 0}
          </span>
        </div>

        {/* Waiting for Approval */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Waiting Approval
          </span>
          <span className="text-lg font-black text-amber-600">
            {profile.kpis?.waitingApprovalCount || 0}
          </span>
        </div>

        {/* Late */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Late Deliverables
          </span>
          <span className="text-lg font-black text-rose-600">
            {profile.kpis?.lateCount || 0}
          </span>
        </div>

        {/* On-Time Rate */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            On-Time Rate
          </span>
          <span className="text-lg font-black text-emerald-600">
            {profile.kpis?.onTimeRate || 100}%
          </span>
        </div>

        {/* Average Rating (Shown only if >= 3 ratings) */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Avg Rating
          </span>
          {profile.kpis?.averageRating !== null && profile.kpis?.averageRating !== undefined ? (
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-lg font-black text-slate-900">
                {profile.kpis.averageRating}
              </span>
              <span className="text-xs text-slate-400">
                ({profile.kpis.ratingCount})
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic block mt-1">
              &lt; 3 ratings
            </span>
          )}
        </div>
      </div>

      {/* Tabs Navigation and Global Date Range Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Date Range selector (for Work, Performance, Ratings, Activity) */}
        {activeTab !== 'overview' && activeTab !== 'changes' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Range:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none min-h-[38px]"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Operational summary for leadership roles */}
          {overviewData?.operationalSummary && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider">
                Leadership Operational Summary
              </h3>
              {overviewData.operationalSummary.role === 'creative_head' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-indigo-600 font-semibold block">Pending Reviews Queue:</span>
                    <span className="text-lg font-black text-slate-900">
                      {overviewData.operationalSummary.pendingReviewsCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600 font-semibold block">Approved Past 30 Days:</span>
                    <span className="text-lg font-black text-slate-900">
                      {overviewData.operationalSummary.approvedPast30Days}
                    </span>
                  </div>
                </div>
              )}
              {overviewData.operationalSummary.role === 'sm_manager' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-indigo-600 font-semibold block">Active Calendar Plans:</span>
                    <span className="text-lg font-black text-slate-900">
                      {overviewData.operationalSummary.activePlansCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-indigo-600 font-semibold block">Upcoming Postings:</span>
                    <span className="text-lg font-black text-slate-900">
                      {overviewData.operationalSummary.upcomingPostingsCount}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Right Now */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Right Now ({overviewData?.rightNow?.length || 0})
                </h3>
              </div>
              <div className="space-y-3">
                {overviewData?.rightNow?.length > 0 ? (
                  overviewData.rightNow.map((item: any) => (
                    <div
                      key={item._id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {item.stageKey}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {item.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Due: {item.deadline ? new Date(item.deadline).toLocaleDateString() : '—'}</span>
                        <span className="font-semibold text-slate-700">
                          {item.status === 'In Progress' && item.measures?.workTimeFormatted !== '—'
                            ? `Working for ${item.measures.workTimeFormatted}`
                            : item.status === 'Feedback'
                            ? `In Review (${item.measures?.approvalWaitFormatted || '—'})`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No steps currently active</p>
                )}
              </div>
            </div>

            {/* 8-Week Load History Trend Chart */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                8-Week Load History Trend
              </h3>
              <div className="h-56 w-full">
                {overviewData?.loadTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData.loadTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                      <YAxis unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="loadPct" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Load %" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Loading trend...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Next Up Queue */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Next Up ({overviewData?.nextUp?.length || 0})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {overviewData?.nextUp?.length > 0 ? (
                overviewData.nextUp.map((item: any) => (
                  <div key={item._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {item.stageKey}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                    <p className="text-[11px] text-slate-500">
                      Due: {item.deadline ? new Date(item.deadline).toLocaleDateString() : '—'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No upcoming queued deliverables</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORK */}
      {activeTab === 'work' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Assigned Deliverables ({workData?.pagination?.total || 0})
            </h3>
            <div className="space-y-3">
              {workData?.items?.map((item: any) => {
                const isExpanded = expandedWorkItemId === item._id;
                return (
                  <div
                    key={item._id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {item.stageKey}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                            {item.status}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                            Calendar: {item.calendar}
                          </span>
                          {item.measures?.isLate && (
                            <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white uppercase">
                              Late by {item.measures.lateByFormatted}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedWorkItemId(isExpanded ? null : item._id)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold inline-flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Timeline
                      </button>
                    </div>

                    {/* Compact Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Due Date</span>
                        <span className="font-semibold text-slate-800">
                          {item.deadline ? new Date(item.deadline).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Work Time</span>
                        <span className="font-semibold text-slate-800">
                          {item.measures?.workTimeFormatted || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Approval Wait</span>
                        <span className="font-semibold text-slate-800">
                          {item.measures?.approvalWaitFormatted || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Revisions</span>
                        <span className="font-semibold text-slate-800">{item.revisions || 0}</span>
                      </div>
                    </div>

                    {/* Expanded Timeline Breakdown */}
                    {isExpanded && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-2">
                        <h5 className="font-bold text-slate-800">Step Timeline & Revision Rounds</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                          <div>Assigned: {item.assignedAt ? new Date(item.assignedAt).toLocaleString() : '—'}</div>
                          <div>Unlocked: {item.unlockedAt ? new Date(item.unlockedAt).toLocaleString() : '—'}</div>
                          <div>Started: {item.startedAt ? new Date(item.startedAt).toLocaleString() : '—'}</div>
                          <div>Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'}</div>
                          <div>Decided: {item.decisionAt ? new Date(item.decisionAt).toLocaleString() : '—'}</div>
                          <div>Approved: {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : '—'}</div>
                        </div>

                        {item.intervals?.length > 0 && (
                          <div className="pt-2">
                            <span className="font-bold text-[11px] text-rose-700 block">Paused Intervals (Blocked / Pending):</span>
                            {item.intervals.map((iv: any, idx: number) => (
                              <div key={idx} className="text-[10px] text-slate-500">
                                • {iv.kind.toUpperCase()}: {iv.reason || 'No reason'} ({formatDuration(new Date(iv.endedAt || Date.now()).getTime() - new Date(iv.startedAt).getTime())})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Craft Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                First-Pass Approval Rate
              </span>
              <span className="text-2xl font-black text-indigo-600">
                {performanceData?.current?.firstPassApprovalRate || 100}%
              </span>
              <span className="text-[11px] text-slate-400 block">
                Approved in Round 1
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Avg Work Time
              </span>
              <span className="text-2xl font-black text-slate-900">
                {performanceData?.current?.avgWorkTimeFormatted || '—'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Net creative craftsmanship
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Avg Waiting to Start
              </span>
              <span className="text-2xl font-black text-slate-900">
                {performanceData?.current?.avgWaitingToStartFormatted || '—'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Unlocked to started
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Avg Approval Wait
              </span>
              <span className="text-2xl font-black text-slate-900">
                {performanceData?.current?.avgApprovalWaitFormatted || '—'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Submitted to review decision
              </span>
            </div>
          </div>

          {/* Monthly Output Trend Chart */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Trailing 6-Month Deliverables Output Trend
            </h3>
            <div className="h-64 w-full">
              {performanceData?.monthlyOutputTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData.monthlyOutputTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Completed Pieces" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Loading monthly trend...
                </div>
              )}
            </div>
          </div>

          {/* Anti-Ranking Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              HACA Marketing OS enforces individual craftsmanship metrics. Cross-person rankings,
              speed scorecards, and peer comparisons are strictly prohibited.
            </span>
          </div>
        </div>
      )}

      {/* TAB 4: RATINGS */}
      {activeTab === 'ratings' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Ratings & Feedback Summary
          </h3>
          {ratingsData?.averageRating !== null && ratingsData?.averageRating !== undefined ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-900">
                  {ratingsData.averageRating}
                </span>
                <div>
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.round(ratingsData.averageRating)
                            ? 'fill-current'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">
                    Based on {ratingsData.totalRatings || 0} reviews
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Fewer than 3 ratings received. Average rating is kept confidential until minimum 3
              reviews are recorded.
            </p>
          )}
        </div>
      )}

      {/* TAB 5: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Recent Operational Activity
          </h3>
          <div className="space-y-3">
            {activityData?.length > 0 ? (
              activityData.map((ev: any) => (
                <div key={ev._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">{ev.action}</span>
                    <p className="text-[11px] text-slate-400">
                      Entity: {ev.entityType} • Actor: {ev.actorId?.name || 'System'}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ev.timestamp || ev.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No activity recorded</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: CHANGES AUDIT LOG */}
      {activeTab === 'changes' && (isAdmin || isCreativeHead) && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Operational Changes Audit Log
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Date & Time</th>
                  <th className="p-2.5">Changed By</th>
                  <th className="p-2.5">Field</th>
                  <th className="p-2.5">Old Value</th>
                  <th className="p-2.5">New Value</th>
                  <th className="p-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {changesData?.map((log: any) => (
                  <tr key={log._id}>
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">
                      {log.actorId?.name || 'Admin'}
                    </td>
                    <td className="p-2.5 font-semibold text-indigo-700">{log.field}</td>
                    <td className="p-2.5 text-slate-500">
                      {JSON.stringify(log.oldValue || '—')}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">
                      {JSON.stringify(log.newValue || '—')}
                    </td>
                    <td className="p-2.5 text-slate-500 italic">{log.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Reassign Steps */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reassign Steps</h3>
            <p className="text-xs text-slate-500">
              Reassign active deliverable steps from {profile.name} to another team member.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">New Assignee</label>
              <select
                value={targetAssigneeId}
                onChange={(e) => setTargetAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              >
                <option value="">Select team member...</option>
                {allWorkers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.preferredName ? `${w.preferredName} (${w.name})` : w.name} ({w.jobRole || w.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassign}
                disabled={reassigning || !targetAssigneeId}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Operational Details */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Operational Details</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block">Job Role</label>
                <select
                  value={editForm.jobRole}
                  onChange={(e) => setEditForm({ ...editForm, jobRole: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                >
                  <option value="">Select Job Role...</option>
                  {JOB_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block">Weekly Capacity (hours)</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  value={editForm.weeklyCapacityHours}
                  onChange={(e) =>
                    setEditForm({ ...editForm, weeklyCapacityHours: parseInt(e.target.value, 10) || 40 })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block">Reason for Change</label>
                <input
                  type="text"
                  placeholder="e.g. Workload rebalancing, role update"
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm hover:bg-black"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Profile with OTP Verification & Admin-Only Email Lock */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isSelf ? 'Edit Your Profile' : `Edit Profile: ${profile.name}`}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {isSelf
                    ? 'Keep your personal details, contact info and skills up to date'
                    : 'Administrator edit for team member personal details'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Alert Feedback */}
              {profileError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-semibold">{profileError}</span>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="font-semibold">{profileSuccess}</span>
                </div>
              )}

              {/* Photo Avatar Preview & Action */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Avatar
                    url={profile.avatarUrl}
                    name={profile.name}
                    size="md"
                    className="border-2 border-white shadow-xs"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Profile Picture</h4>
                    <p className="text-[11px] text-slate-500">
                      Standard circular avatar shown across teams
                    </p>
                  </div>
                </div>
                {(isSelf || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => setIsCropModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>
                )}
              </div>

              {/* Identity Section: Legal Name & Preferred Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium text-slate-900 transition-all outline-hidden"
                    placeholder="e.g. Test Writer One"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Official name used in reports and formal records.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Preferred Name / Nickname
                  </label>
                  <input
                    type="text"
                    value={profileForm.preferredName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, preferredName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium text-slate-900 transition-all outline-hidden"
                    placeholder="e.g. Alex"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Displayed across calendar, assignment cards & chat.
                  </span>
                </div>
              </div>

              {/* Email Section (Admin only editable; User locked with explanation) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Registered Email Address</span>
                  </label>
                  {isAdmin && !isSelf ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      Admin Email Override
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-slate-500" /> Registered Email (Locked)
                    </span>
                  )}
                </div>

                {isAdmin && !isSelf ? (
                  <>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50/30 text-xs font-medium text-slate-900 outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      required
                    />
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      ⚠️ Modifying official email changes the user login credentials.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="email"
                        value={profileForm.email}
                        readOnly
                        disabled
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-100 text-xs font-medium text-slate-600 cursor-not-allowed select-all"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                    <div className="mt-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Registered email cannot be changed by the user. Contact an administrator to
                        request an email update.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile Phone Number & OTP Verification */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mobile Phone Number</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {isPhoneVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Verification Required
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium text-slate-900 bg-white transition-all outline-hidden"
                    />
                  </div>

                  {!isPhoneVerified && (
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={
                        otpSending ||
                        otpCountdown > 0 ||
                        !profileForm.phone.replace(/[\s\-\(\)]/g, '')
                      }
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shrink-0 min-h-[40px]"
                    >
                      {otpSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : otpCountdown > 0 ? (
                        `Resend OTP in ${otpCountdown}s`
                      ) : (
                        'Send OTP'
                      )}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  Enter mobile number with country code (e.g. +91 9876543210 or 9000000011).
                  Changes require OTP verification before saving.
                </p>

                {/* OTP Verification Box */}
                {!isPhoneVerified && otpSent && (
                  <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-2xs space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">
                        Enter 6-Digit OTP Code
                      </span>
                      <span className="text-[11px] font-semibold text-indigo-600">
                        Code sent to {profileForm.phone}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="123456"
                        className="w-36 px-3 py-2 rounded-xl border border-indigo-300 text-center text-sm font-black tracking-widest text-indigo-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPhoneOtp}
                        disabled={otpVerifying || otpCode.trim().length !== 6}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        {otpVerifying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify Code</span>
                          </>
                        )}
                      </button>
                    </div>

                    {otpError && (
                      <p className="text-[11px] font-semibold text-rose-600">{otpError}</p>
                    )}
                    {otpSuccess && (
                      <p className="text-[11px] font-semibold text-emerald-600">{otpSuccess}</p>
                    )}
                  </div>
                )}
              </div>

              {/* WhatsApp Number with Sync Checkbox */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Number</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={profileForm.sameAsPhone}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProfileForm((prev) => ({
                          ...prev,
                          sameAsPhone: checked,
                          whatsappNumber: checked ? prev.phone : prev.whatsappNumber,
                        }));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Same as mobile number</span>
                  </label>
                </div>
                <input
                  type="tel"
                  disabled={profileForm.sameAsPhone}
                  value={profileForm.whatsappNumber}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, whatsappNumber: e.target.value })
                  }
                  placeholder="+919876543210"
                  className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 transition-all outline-hidden ${
                    profileForm.sameAsPhone ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
                  }`}
                />
              </div>

              {/* Bio / About */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">About / Bio</label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {profileForm.about.length} / 500 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={profileForm.about}
                  onChange={(e) => setProfileForm({ ...profileForm, about: e.target.value })}
                  placeholder="Share a short summary of your background, interests and creative strengths..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-xs font-medium text-slate-900 transition-all outline-hidden resize-none"
                />
              </div>

              {/* Languages Spoken (Max 5) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Languages Spoken (Max 5)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {profileForm.languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200"
                    >
                      {lang}
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang)}
                        className="p-0.5 rounded-full hover:bg-indigo-200 text-indigo-600"
                        title={`Remove ${lang}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {profileForm.languages.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No languages added yet.</span>
                  )}
                </div>
                {profileForm.languages.length < 5 && (
                  <div className="flex gap-2">
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
                      placeholder="e.g. English, Hindi, Spanish"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={addLanguage}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Skills Tags (Max 10) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Skills & Expertise Tags (Max 10)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {profileForm.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-600"
                        title={`Remove ${skill}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {profileForm.skills.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No skill tags added yet.</span>
                  )}
                </div>
                {profileForm.skills.length < 10 && (
                  <div className="flex gap-2">
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
                      placeholder="e.g. Copywriting, Premiere Pro, Figma"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={addSkill}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs min-h-[44px] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savingProfile ||
                    (Boolean(profileForm.phone.replace(/[\s\-\(\)]/g, '')) &&
                      profileForm.phone.replace(/[\s\-\(\)]/g, '') !==
                        initialPhone.replace(/[\s\-\(\)]/g, '') &&
                      !isPhoneVerified)
                  }
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 disabled:opacity-50 transition-all min-h-[44px] flex items-center gap-1.5"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Profile Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Avatar Crop Modal */}
      {isCropModalOpen && (
        <AvatarCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          currentAvatarUrl={profile.avatarUrl}
          onAvatarUpdated={(newUrl) => {
            setProfile((prev: any) => (prev ? { ...prev, avatarUrl: newUrl } : prev));
          }}
        />
      )}
    </div>
  );
};
