import React, { useState, useEffect, useRef } from 'react';
import { User, ShieldCheck, Building2, Camera, Upload, Edit3, Save, X, Mail, Phone, Lock, CheckCircle2, AlertCircle, Key, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { supabase } from '../services/supabaseClient';
import { getCurrentSessionUser, setSessionUser } from '../services/unifiedAuth';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface AdminProfileData {
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  avatarUrl?: string;
}

export function getAdminProfile(): AdminProfileData {
  const cached = localStorage.getItem('admin_profile_data');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed?.name && !parsed.name.toLowerCase().includes('hyma') && !parsed.email?.toLowerCase().includes('hyma')) {
        return parsed;
      }
    } catch {}
  }

  const session = getCurrentSessionUser();
  if (session && session.name) {
    const roleTitle = session.role === 'admin'
      ? 'System Administrator'
      : session.role === 'teamlead'
      ? 'Team Lead'
      : 'Employee';
    return {
      name: session.name,
      email: session.email,
      role: roleTitle,
      department: session.department || 'IT Operations',
      phone: session.phone || '+1 (555) 019-2834',
      avatarUrl: session.avatarUrl || localStorage.getItem('admin_profile_avatar') || '',
    };
  }

  return {
    name: 'Sudheshna Bharadwaj',
    email: 'sudheshna@gmail.com',
    role: 'System Administrator',
    department: 'IT Operations',
    phone: '+1 (555) 019-2834',
    avatarUrl: localStorage.getItem('admin_profile_avatar') || '',
  };
}

export function saveAdminProfile(data: AdminProfileData) {
  localStorage.setItem('admin_profile_data', JSON.stringify(data));
  if (data.avatarUrl) {
    localStorage.setItem('admin_profile_avatar', data.avatarUrl);
  } else {
    localStorage.removeItem('admin_profile_avatar');
  }
  window.dispatchEvent(new Event('storage'));
}

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<AdminProfileData>(getAdminProfile());
  const [isEditing, setIsEditing] = useState(false);

  // Form edit state
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editRole, setEditRole] = useState(profile.role);
  const [editDepartment, setEditDepartment] = useState(profile.department);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editAvatarUrl, setEditAvatarUrl] = useState(profile.avatarUrl || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Purge legacy hyma data if present
    try {
      const raw = localStorage.getItem('admin_profile_data');
      if (raw && (raw.toLowerCase().includes('hyma') || raw.toLowerCase().includes('hyma.admin@company.com'))) {
        localStorage.removeItem('admin_profile_data');
        localStorage.removeItem('admin_profile_avatar');
      }
    } catch {}

    const initial = getAdminProfile();
    setProfile(initial);
    setEditName(initial.name);
    setEditEmail(initial.email);
    setEditRole(initial.role);
    setEditDepartment(initial.department);
    setEditPhone(initial.phone);
    setEditAvatarUrl(initial.avatarUrl || '');

    // Fetch live user from Supabase to keep in sync
    const fetchLiveUser = async () => {
      const session = getCurrentSessionUser();
      const targetEmail = session?.email || initial.email;
      if (!targetEmail) return;

      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', targetEmail.trim().toLowerCase())
          .maybeSingle();

        if (dbUser) {
          const liveProfile: AdminProfileData = {
            name: dbUser.name || initial.name,
            email: dbUser.email || initial.email,
            role: dbUser.designation || (dbUser.role === 'admin' ? 'System Administrator' : dbUser.role === 'teamlead' ? 'Team Lead' : 'Employee'),
            department: dbUser.department || initial.department,
            phone: dbUser.phone || initial.phone,
            avatarUrl: dbUser.avatar || initial.avatarUrl || '',
          };
          setProfile(liveProfile);
          setEditName(liveProfile.name);
          setEditEmail(liveProfile.email);
          setEditRole(liveProfile.role);
          setEditDepartment(liveProfile.department);
          setEditPhone(liveProfile.phone);
          setEditAvatarUrl(liveProfile.avatarUrl || '');
          saveAdminProfile(liveProfile);
        }
      } catch (err) {
        console.warn('Supabase profile fetch warning:', err);
      }
    };

    fetchLiveUser();
  }, []);

  const startEditing = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditRole(profile.role);
    setEditDepartment(profile.department);
    setEditPhone(profile.phone);
    setEditAvatarUrl(profile.avatarUrl || '');
    setEmailError(null);
    setPhoneError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEmailError(null);
    setPhoneError(null);
    setIsEditing(false);
  };

  // Validation error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentSession = getCurrentSessionUser();
  const [userId] = useState<string>(currentSession?.id || 'usr-admin-1791538577749');

  const handleRemovePhoto = async () => {
    setEditAvatarUrl('');
    const updated = { ...profile, avatarUrl: '' };
    saveAdminProfile(updated);
    setProfile(updated);
    localStorage.removeItem('admin_profile_avatar');

    const activeSession = getCurrentSessionUser();
    if (activeSession) {
      setSessionUser({
        ...activeSession,
        avatarUrl: '',
      });
      localStorage.setItem('platform_current_user', JSON.stringify({
        ...activeSession,
        avatarUrl: '',
      }));
      window.dispatchEvent(new Event('storage'));
    }

    try {
      const targetId = activeSession?.id || userId || 'usr-admin-1791538577749';
      await supabase
        .from('users')
        .update({
          avatar: null,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${targetId},email.eq.${profile.email}`);
    } catch (err) {
      console.warn('Remove avatar error:', err);
    }
    setToastMessage('Profile photo removed.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Email format validation
    const cleanEmail = editEmail.trim();
    if (!cleanEmail) {
      setEmailError('Email address is required.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setEmailError('Invalid email format. Please enter a valid address (e.g. name@company.com). Comma or invalid domain rejected.');
      return;
    }
    setEmailError(null);

    // 2. Mobile number validation (10 digits limit)
    const cleanPhone = editPhone.trim();
    if (cleanPhone && cleanPhone.length !== 10) {
      setPhoneError('Contact mobile number must be exactly 10 digits.');
      return;
    }
    setPhoneError(null);

    const updated: AdminProfileData = {
      name: editName.trim() || profile.name,
      email: cleanEmail || profile.email,
      role: editRole.trim() || profile.role,
      department: editDepartment.trim() || profile.department,
      phone: cleanPhone,
      avatarUrl: editAvatarUrl,
    };
    saveAdminProfile(updated);
    setProfile(updated);
    setIsEditing(false);

    // Update current session user in localStorage
    const activeSession = getCurrentSessionUser();
    const targetId = activeSession?.id || userId || 'usr-admin-1791538577749';

    setSessionUser({
      ...(activeSession || {}),
      id: targetId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      department: updated.department,
      avatarUrl: updated.avatarUrl,
      role: 'admin',
      status: activeSession?.status || 'Active',
    });

    localStorage.setItem('platform_current_user', JSON.stringify({
      id: targetId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      department: updated.department,
      avatarUrl: updated.avatarUrl,
      role: 'admin',
      status: activeSession?.status || 'Active',
    }));

    window.dispatchEvent(new Event('storage'));

    // Sync profile changes to Supabase public.users
    try {
      await supabase
        .from('users')
        .update({
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          department: updated.department,
          avatar: updated.avatarUrl || null,
          designation: updated.role,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${targetId},email.eq.${profile.email},email.eq.${updated.email}`);
    } catch (err) {
      console.warn('Supabase profile sync warning:', err);
    }

    setToastMessage('Profile details saved successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (isEditing) {
          setEditAvatarUrl(result);
        } else {
          const updated = { ...profile, avatarUrl: result };
          saveAdminProfile(updated);
          setProfile(updated);
          setEditAvatarUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const displayAvatar = isEditing ? editAvatarUrl : profile.avatarUrl;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Hidden File Input for Direct Local Image Selection */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Profile</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your administrative account, contact details, and department permissions.
          </p>
        </div>

        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            icon={<Edit3 className="w-4 h-4 text-[#0284C7]" />}
            className="border-slate-200 text-slate-700 font-semibold"
          >
            Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              icon={<X className="w-4 h-4 text-slate-400" />}
              className="border-slate-200 text-slate-600"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProfile}
              icon={<Save className="w-4 h-4" />}
              className="bg-[#0284C7] hover:bg-[#0369a1] text-white font-semibold shadow-2xs"
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 max-w-3xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="max-w-3xl bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        {/* User Identity Header with Profile Avatar Support */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={profile.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-2xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
                  {(isEditing ? editName : profile.name)
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
              )}

              <div className="absolute -bottom-1 -right-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-[#0284C7] hover:border-[#0284C7] shadow-xs cursor-pointer transition-all"
                  title="Upload profile photo from computer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#0284C7]" />
                </button>
                {displayAvatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1.5 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-xs cursor-pointer transition-all"
                    title="Remove profile photo"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? editName || 'Admin Name' : profile.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-[#0284C7] border border-sky-200/60 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 inline" /> {isEditing ? editRole : profile.role}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                  <Key className="w-3 h-3 text-[#0284C7]" />
                  User ID: <span className="text-[#0284C7]">{userId}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-[#0284C7]" />
              Upload Photo
            </Button>
            {displayAvatar && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemovePhoto}
                className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                Remove Photo
              </Button>
            )}
          </div>
        </div>

        {/* Profile Attributes / Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#0284C7]" /> System User ID <span className="text-slate-400 font-normal">(Permanent Identifier)</span>
              </label>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-mono font-bold text-slate-900 flex items-center justify-between shadow-2xs">
                <span className="tracking-wide text-slate-900">{userId}</span>
                <span className="text-[10.5px] uppercase font-sans font-bold bg-sky-100 text-[#0284C7] px-2.5 py-0.5 rounded-full border border-sky-200">
                  Verified Identity
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Full Name <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <Input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter full name"
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-900">
                  {profile.name}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <Input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="Enter valid email (e.g. a.ronda@gmail.com)"
                  error={emailError || undefined}
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-900">
                  {profile.email}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Department <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <Select
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  options={[
                    { value: 'IT Support', label: 'IT Support' },
                    { value: 'Finance', label: 'Finance' },
                    { value: 'HR Operations', label: 'HR Operations' },
                    { value: 'Facilities', label: 'Facilities' },
                    { value: 'General Administration', label: 'General Administration' },
                  ]}
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-900">
                  {profile.department}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Administrative Role <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <Input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  placeholder="Enter role (e.g. System Administrator)"
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-900">
                  {profile.role}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Contact Number (10 Digits)
              </label>
              {isEditing ? (
                <Input
                  type="tel"
                  maxLength={10}
                  value={editPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setEditPhone(digits);
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="10-digit mobile number"
                  error={phoneError || undefined}
                  helperText="Maximum 10 numerical digits limit"
                />
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-900">
                  {profile.phone || 'Not provided'}
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={cancelEditing}
                className="border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-[#0284C7] hover:bg-[#0369a1] text-white font-semibold shadow-2xs"
              >
                <Save className="w-4 h-4 mr-1.5" /> Save Changes
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
