'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  X,
  Check,
  Settings,
  Users,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getConfidentialConfig,
  saveConfidentialConfig,
  verifyConfidentialPin,
  setConfidentialUnlocked,
  isConfidentialUnlocked,
  isUserAuthorizedForConfidential,
  ConfidentialConfig,
} from '@/utils/confidentialStorage';

interface ConfidentialUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  initialMode?: 'unlock' | 'config';
}

export default function ConfidentialUnlockModal({
  isOpen,
  onClose,
  showToast,
  initialMode = 'unlock',
}: ConfidentialUnlockModalProps) {
  const { user, isAdmin } = useAuth();

  const [mode, setMode] = useState<'unlock' | 'config'>(initialMode);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Config form state (Admin only)
  const [config, setConfig] = useState<ConfidentialConfig>(getConfidentialConfig());
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [newUserTag, setNewUserTag] = useState<string>('');
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setPinInput('');
      setErrorMessage('');
      setConfig(getConfidentialConfig());
      setNewPin('');
      setConfirmPin('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleUnlockSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!pinInput.trim()) {
      setErrorMessage('Silakan masukkan Password / PIN otorisasi.');
      return;
    }

    const isValid = verifyConfidentialPin(pinInput);
    if (isValid) {
      setConfidentialUnlocked(true);
      showToast?.('✓ Otorisasi berhasil! Nilai finansial confidential telah terbuka.', 'success');
      onClose();
    } else {
      setErrorMessage('Password otorisasi salah. Hubungi Administrator untuk akses.');
    }
  };

  const handleAdminBypassUnlock = () => {
    if (!isAdmin && !isUserAuthorizedForConfidential(user)) {
      setErrorMessage('Anda tidak memiliki izin bypass administrator.');
      return;
    }
    setConfidentialUnlocked(true);
    showToast?.('✓ Otorisasi Administrator berhasil diterapkan.', 'success');
    onClose();
  };

  const handleSaveConfig = () => {
    setErrorMessage('');

    let updatedPin = config.pin;
    if (newPin.trim()) {
      if (newPin.length < 4) {
        setErrorMessage('Password/PIN baru minimal 4 karakter.');
        return;
      }
      if (newPin !== confirmPin) {
        setErrorMessage('Konfirmasi password tidak cocok.');
        return;
      }
      updatedPin = newPin.trim();
    }

    setIsSavingConfig(true);
    try {
      saveConfidentialConfig(
        {
          ...config,
          pin: updatedPin,
        },
        user?.name || 'Administrator'
      );

      showToast?.('✓ Konfigurasi keamanan nilai finansial berhasil diperbarui!', 'success');
      setNewPin('');
      setConfirmPin('');
      setMode('unlock');
    } catch {
      setErrorMessage('Gagal menyimpan konfigurasi.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddUser = () => {
    const trimmed = newUserTag.trim().toLowerCase();
    if (!trimmed) return;
    if (config.allowedUsers.map((u) => u.toLowerCase()).includes(trimmed)) {
      setErrorMessage(`User "${trimmed}" sudah terdaftar.`);
      return;
    }

    setConfig((prev) => ({
      ...prev,
      allowedUsers: [...prev.allowedUsers, trimmed],
    }));
    setNewUserTag('');
  };

  const handleRemoveUser = (userName: string) => {
    setConfig((prev) => ({
      ...prev,
      allowedUsers: prev.allowedUsers.filter((u) => u.toLowerCase() !== userName.toLowerCase()),
    }));
  };

  const handleToggleRole = (role: string) => {
    setConfig((prev) => {
      const exists = prev.allowedRoles.includes(role);
      const updated = exists ? prev.allowedRoles.filter((r) => r !== role) : [...prev.allowedRoles, role];
      return { ...prev, allowedRoles: updated };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-muted/40 border-b border-border flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  {mode === 'unlock' ? 'Otorisasi Nilai Finansial' : 'Pengaturan Password Confidential'}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'unlock'
                  ? 'Nilai nominal uang & pagu anggaran bersifat rahasia (Confidential).'
                  : 'Kelola password & daftar pengguna yang berhak membuka nilai finansial.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'unlock' ? (
            /* MODE UNLOCK / VERIFIKASI PIN */
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Masukkan Password / PIN Otorisasi:</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Default: CPG2026</span>
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Ketik password otorisasi..."
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Admin Bypass Card */}
              {isAdmin && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-medium">
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>Terdeteksi Login Administrator</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdminBypassUnlock}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                  >
                    Buka Cepat
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('config');
                      setErrorMessage('');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="size-3.5" />
                    <span>Atur Password &amp; Akses</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md"
                  >
                    <Unlock className="size-3.5" />
                    <span>Buka Nilai</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* MODE CONFIGURATION (ADMIN ONLY) */
            <div className="space-y-4 text-xs">
              {/* Ubah Password / PIN */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-primary" />
                  <span>Ubah Password / PIN Otorisasi</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Password Baru:</span>
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Min. 4 karakter"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Konfirmasi Password:</span>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Peran / Role Yang Diizinkan */}
              <div className="space-y-2">
                <span className="font-bold text-foreground block">
                  Peran (Role) Otomatis Berwenang:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['admin', 'manager', 'supervisor', 'staf_purchasing'].map((role) => {
                    const isChecked = config.allowedRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleToggleRole(role)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                          isChecked
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold'
                            : 'bg-background border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isChecked && <Check className="size-3" />}
                        <span className="capitalize">{role.replace('_', ' ')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daftar Pengguna Khusus yang Diizinkan */}
              <div className="space-y-2">
                <span className="font-bold text-foreground block">
                  Pengguna Spesifik yang Diberi Izin:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newUserTag}
                    onChange={(e) => setNewUserTag(e.target.value)}
                    placeholder="Ketik username / nama..."
                    className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUser();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddUser}
                    className="h-8 px-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border cursor-pointer"
                  >
                    Tambah
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1 max-h-24 overflow-y-auto pt-1">
                  {config.allowedUsers.map((u) => (
                    <span
                      key={u}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono border border-border"
                    >
                      <span>{u}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(u)}
                        className="text-muted-foreground hover:text-rose-500 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons Config */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMode('unlock')}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Kembali
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition shadow-md"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

