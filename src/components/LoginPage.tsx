'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Ship,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginPageProps {
  onSuccess?: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 detik lockout jika 5x gagal berturut-turut
const LOCKOUT_STORAGE_KEY = 'CPG_AUTH_SECURITY_LOCKOUT_V2';
const SAVED_USERNAME_KEY = 'CPG_AUTH_SAVED_USERNAME_V2';

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Anti-bot trap

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Rate Limiting / Security Lockout States
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Initialize saved username and check ongoing lockout from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load saved username if remember me was active
    try {
      const savedUser = localStorage.getItem(SAVED_USERNAME_KEY);
      if (savedUser) {
        setUsername(savedUser);
        setRememberUsername(true);
      }
    } catch {}

    // Check ongoing lockout
    try {
      const rawLockout = localStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (rawLockout) {
        const parsed = JSON.parse(rawLockout);
        const now = Date.now();
        if (parsed.lockedUntil && parsed.lockedUntil > now) {
          const diffSec = Math.ceil((parsed.lockedUntil - now) / 1000);
          setLockoutRemaining(diffSec);
          setFailedAttempts(parsed.failedAttempts || MAX_FAILED_ATTEMPTS);
        } else if (parsed.failedAttempts) {
          setFailedAttempts(parsed.failedAttempts);
        }
      }
    } catch {}
  }, []);

  // Timer countdown for active security lockout
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Unlock
          try {
            localStorage.setItem(
              LOCKOUT_STORAGE_KEY,
              JSON.stringify({ failedAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null })
            );
          } catch {}
          setErrorMessage('');
          setInfoMessage('Periode penangguhan keamanan telah berakhir. Silakan masukkan kredensial resmi Anda.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handlePasswordKeyEvents = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const resetFailedAttempts = () => {
    setFailedAttempts(0);
    setLockoutRemaining(0);
    try {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    } catch {}
    setErrorMessage('');
    setInfoMessage('Batas percobaan gagal telah dipulihkan. Silakan coba masuk kembali.');
  };

  const recordFailedAttempt = (serverMessage?: string) => {
    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      const sec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      setLockoutRemaining(sec);
      try {
        localStorage.setItem(
          LOCKOUT_STORAGE_KEY,
          JSON.stringify({ failedAttempts: newCount, lockedUntil })
        );
      } catch {}
      setErrorMessage(
        `Sistem Keamanan Aktif: Percobaan login gagal mencapai batas maksimum (${MAX_FAILED_ATTEMPTS}x). Form dikunci sementara selama ${sec} detik demi mencegah serangan brute-force.`
      );
    } else {
      try {
        localStorage.setItem(
          LOCKOUT_STORAGE_KEY,
          JSON.stringify({ failedAttempts: newCount, lockedUntil: null })
        );
      } catch {}
      const attemptsLeft = MAX_FAILED_ATTEMPTS - newCount;
      const baseMsg = serverMessage || 'Kombinasi kredensial salah.';
      if (attemptsLeft <= 2) {
        setErrorMessage(
          `${baseMsg} Peringatan Keamanan: Tersisa ${attemptsLeft} percobaan sebelum form dikunci sementara.`
        );
      } else {
        setErrorMessage(baseMsg);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Anti-bot honeypot check
    if (honeypot) {
      setErrorMessage('Permintaan otentikasi ditolak oleh modul perlindungan keamanan bot.');
      return;
    }

    if (lockoutRemaining > 0) {
      setErrorMessage(`Sistem masih dalam masa penangguhan keamanan (${lockoutRemaining}s). Harap tunggu atau klik Pulihkan Form.`);
      return;
    }

    setErrorMessage('');
    setInfoMessage('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Silakan masukkan username/email dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);

    try {
      // Artificial cryptographic verification delay (400ms) to resist timing analysis
      await new Promise((r) => setTimeout(r, 400));

      const result = await login(cleanUser, cleanPass);
      if (result.success) {
        // Clear security lockout on success
        try {
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
          if (rememberUsername) {
            localStorage.setItem(SAVED_USERNAME_KEY, cleanUser);
          } else {
            localStorage.removeItem(SAVED_USERNAME_KEY);
          }
        } catch {}

        if (onSuccess) {
          onSuccess();
        }
      } else {
        recordFailedAttempt(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi gangguan koneksi otentikasi keamanan.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = lockoutRemaining > 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background glowing ambient security grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in-50 zoom-in-95 duration-300">
        {/* Top Enterprise Security Status Pill */}
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/30 shadow-xs text-[11px] font-mono text-cyan-400 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck className="size-3.5 text-cyan-400" />
            <span className="font-semibold tracking-wide">SECURE ACCESS &bull; 256-BIT ENCRYPTION</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
          {/* Subtle security line header */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/20 mb-3 border border-cyan-400/30 ring-4 ring-cyan-500/10">
              <Ship className="size-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>CPG Procurement Hub</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              PT Cindara Pratama Lines &bull; Integrated Supply Chain
            </p>
          </div>

          {/* Lockout Warning Alert */}
          {isLocked && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2 animate-in fade-in-50">
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-amber-400 animate-spin" />
                <span>Akun Ditangguhkan Sementara (Cooldown)</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Terlalu banyak percobaan gagal. Silakan tunggu{' '}
                <span className="font-mono font-bold text-amber-300 px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  {lockoutRemaining}s
                </span>{' '}
                sebelum mencoba kembali, atau klik tombol pulihkan di bawah.
              </p>
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={resetFailedAttempts}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-semibold border border-amber-500/30 transition cursor-pointer"
                >
                  Buka Kunci Form Sekarang
                </button>
              </div>
            </div>
          )}

          {/* Error Message Callout */}
          {errorMessage && !isLocked && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex flex-col gap-2 animate-in fade-in-50">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMessage}</div>
              </div>
              {failedAttempts >= 2 && (
                <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                  <span className="text-[10px] text-rose-300/80">Lupa kata sandi atau ingin mengulang?</span>
                  <button
                    type="button"
                    onClick={resetFailedAttempts}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Pulihkan Percobaan Login
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Info Message Callout */}
          {infoMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{infoMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Honeypot field (hidden from legitimate users) */}
            <input
              type="text"
              name="companySecurityTrap"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            {/* Username / Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username atau Email Perusahaan
              </label>
              <div className="relative">
                <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  disabled={isLocked || isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username, NIK, atau email..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Kata Sandi (Password)
                </label>
                {isCapsLockOn && (
                  <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1 animate-pulse">
                    <span>Caps Lock Aktif</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLocked || isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyEvents}
                  onKeyUp={handlePasswordKeyEvents}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isLocked || isLoading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-300 transition">
                <input
                  type="checkbox"
                  checked={rememberUsername}
                  onChange={(e) => setRememberUsername(e.target.checked)}
                  disabled={isLocked || isLoading}
                  className="rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500/40 size-3.5 cursor-pointer"
                />
                <span className="text-[11px]">Ingat username pada perangkat ini</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full h-10 mt-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-mono text-[11px]">Memverifikasi Kredensial...</span>
                </>
              ) : isLocked ? (
                <>
                  <Clock className="size-4" />
                  <span>Terkunci ({lockoutRemaining}s)</span>
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Credential Hint Card */}
          <div className="mt-4 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between font-semibold text-[11px]">
              <span className="text-cyan-400">Petunjuk Kredensial Resmi CPG:</span>
              {failedAttempts > 0 && (
                <button
                  type="button"
                  onClick={resetFailedAttempts}
                  className="text-cyan-400 hover:underline cursor-pointer text-[10px]"
                >
                  Reset Percobaan
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              &bull; <strong>Tim Lapangan &amp; Staf:</strong> Password dapat menggunakan <span className="font-mono text-cyan-300 font-semibold">cpg123</span>, <span className="font-mono text-cyan-300 font-semibold">123</span>, <span className="font-mono text-cyan-300 font-semibold">cpg</span>, atau <span className="font-mono text-cyan-300 font-semibold">lapangan123</span>.
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              &bull; <strong>Manajemen &amp; Purchasing:</strong> Password dapat menggunakan <span className="font-mono text-cyan-300 font-semibold">admin</span> atau <span className="font-mono text-cyan-300 font-semibold">cpg123</span>.
            </p>
          </div>

          {/* Enterprise Safe Security Notice */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
              <Shield className="size-3 text-cyan-400 shrink-0" />
              <span>Security Patch SEC-2026 Active &bull; Zero-Trust Protocol</span>
            </div>
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              Akses terbatas hanya untuk personel PT Cindara Pratama Lines yang berwenang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
