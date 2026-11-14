'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getRoleDisplayName } from '@/types/auth';
import {
  X,
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Briefcase,
  Mail,
  Fingerprint,
  FileCheck,
  Lock,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export function UserProfileModal({ isOpen, onClose, showToast }: UserProfileModalProps) {
  const { user, updateUser, isAdmin, isVisitor } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Form Profile State
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Security (Change Password) State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync state when modal opens or user updates
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setNik(user.nik || '');
      setJabatan(user.jabatan || '');
      setDepartment(user.department || '');
      setEmail(user.email || '');
      setProfileMsg(null);
      setSecurityMsg(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    if (!name.trim()) {
      setProfileMsg({ text: 'Nama lengkap tidak boleh kosong.', type: 'error' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateUser(user.id, {
        name: name.trim(),
        nik: nik.trim() || undefined,
        jabatan: jabatan.trim() || undefined,
        department: department.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (res.success) {
        setProfileMsg({ text: 'Identitas profil berhasil diperbarui dan tersimpan.', type: 'success' });
        if (showToast) showToast('Identitas profil berhasil diperbarui!', 'success');
      } else {
        setProfileMsg({ text: res.message || 'Gagal menyimpan pembaruan profil.', type: 'error' });
        if (showToast) showToast(res.message || 'Gagal memperbarui profil.', 'error');
      }
    } catch (err: any) {
      setProfileMsg({ text: err.message || 'Terjadi kesalahan sistem saat memperbarui profil.', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg(null);

    if (!currentPassword) {
      setSecurityMsg({ text: 'Masukkan kata sandi saat ini untuk verifikasi keamanan.', type: 'error' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setSecurityMsg({ text: 'Kata sandi baru minimal harus terdiri dari 6 karakter.', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMsg({ text: 'Konfirmasi kata sandi baru tidak cocok. Periksa kembali ketikan Anda.', type: 'error' });
      return;
    }

    if (newPassword === currentPassword) {
      setSecurityMsg({ text: 'Kata sandi baru tidak boleh sama dengan kata sandi saat ini.', type: 'error' });
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await updateUser(
        user.id,
        {
          password: newPassword,
        },
        currentPassword
      );

      if (res.success) {
        setSecurityMsg({ text: 'Kata sandi Anda berhasil diperbarui! Gunakan kata sandi baru untuk login selanjutnya.', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (showToast) showToast('Kata sandi berhasil diperbarui!', 'success');
      } else {
        setSecurityMsg({ text: res.message || 'Kata sandi lama salah atau gagal memperbarui kata sandi.', type: 'error' });
        if (showToast) showToast(res.message || 'Gagal mengganti kata sandi.', 'error');
      }
    } catch (err: any) {
      setSecurityMsg({ text: err.message || 'Terjadi kesalahan sistem saat mengganti kata sandi.', type: 'error' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const roleName = getRoleDisplayName(user.role);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-full flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0 ${
                isAdmin
                  ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                  : isVisitor
                  ? 'bg-linear-to-tr from-emerald-600 to-teal-600'
                  : 'bg-linear-to-tr from-sky-500 to-indigo-500'
              }`}
            >
              {user.avatar || (user.name ? user.name[0]?.toUpperCase() : 'U')}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Profil &amp; Akun Pengguna</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                @{user.username} &bull; {roleName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-border bg-card shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="size-3.5" />
            <span>Identitas &amp; Informasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'security'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="size-3.5" />
            <span>Keamanan &amp; Ganti Password</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-5 space-y-5 text-xs flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMsg && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              {/* Status & Role Badges (Read-only System Info) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground block">Username ID</span>
                  <span className="font-mono font-bold text-foreground">@{user.username}</span>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground block">Hak Akses / Role</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="size-3 text-sky-500" />
                    <span className="font-semibold text-foreground">{roleName}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground block">Status Akun</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Aktif
                  </span>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" />
                    <span>Nama Lengkap *</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Contoh: Budi Santoso"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Fingerprint className="size-3.5 text-muted-foreground" />
                    <span>Nomor Induk Karyawan (NIK)</span>
                  </label>
                  <input
                    type="text"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder="Contoh: 20240012"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    <span>Jabatan Resmi</span>
                  </label>
                  <input
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    placeholder="Contoh: Staf Purchasing & Logistik"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building className="size-3.5 text-muted-foreground" />
                    <span>Divisi / Departemen</span>
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Contoh: Purchasing & Logistik Armada"
                    className="w-full h-9 border border-border bg-background text-foreground text-xs px-3 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span>Alamat Email Kantor</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: purchasing@cindaragroup.com"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Digital Signature Card */}
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <FileCheck className="size-4 text-sky-500" />
                    <span>Tanda Tangan Digital &amp; Sertifikat</span>
                  </div>
                  {user.signature?.signatureDataUrl ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px]">
                      Terverifikasi
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px]">
                      Belum Tersimpan
                    </span>
                  )}
                </div>

                {user.signature?.signatureDataUrl ? (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="p-1.5 rounded-lg border border-border bg-white shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.signature.signatureDataUrl}
                        alt="Tanda Tangan Digital"
                        className="h-12 w-28 object-contain"
                      />
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      <p>
                        Kode Dokumen:{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {user.signature.certificateId}
                        </span>
                      </p>
                      <p>
                        Diverifikasi oleh:{' '}
                        <span className="text-foreground">
                          {user.signature.verifiedByName || user.signature.verifiedBy}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Tanda tangan digital Anda dapat diunggah dan disahkan secara resmi oleh Administrator melalui menu Pengaturan Admin.
                  </p>
                )}
              </div>

              {/* Submit Profile Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Save className="size-3.5" />
                  <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan Identitas'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {securityMsg && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    securityMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {securityMsg.type === 'success' ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <span>{securityMsg.text}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-200 flex items-start gap-2.5">
                <Lock className="size-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-semibold">Keamanan Akun Pribadi</p>
                  <p>
                    Anda dapat mengganti password kapan saja secara mandiri. Verifikasi password saat ini diperlukan demi melindungi hak akses akun Anda.
                  </p>
                </div>
              </div>

              {/* Input Password Lama */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  <span>Kata Sandi Saat Ini *</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Masukkan kata sandi lama Anda"
                    className="w-full h-9 px-3 pr-10 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    title={showCurrentPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Input Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  <span>Kata Sandi Baru * (Minimal 6 Karakter)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Masukkan kata sandi baru yang kuat"
                    className="w-full h-9 px-3 pr-10 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    title={showNewPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Input Konfirmasi Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-muted-foreground" />
                  <span>Konfirmasi Kata Sandi Baru *</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Ulangi kata sandi baru di atas"
                    className="w-full h-9 px-3 pr-10 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    title={showConfirmPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {newPassword && confirmPassword && (
                  <p
                    className={`text-[10px] font-medium pt-0.5 ${
                      newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                    }`}
                  >
                    {newPassword === confirmPassword ? '✓ Konfirmasi kata sandi cocok' : '✗ Kata sandi konfirmasi tidak cocok'}
                  </p>
                )}
              </div>

              {/* Submit Password Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="size-3.5" />
                  <span>{isSavingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-muted-foreground">
            Sistem Autentikasi Pengguna &bull; PT Cindara Pratama Lines
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
