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
  Anchor,
  Compass,
  Radio,
  Layers,
  Sparkles,
  ArrowRight,
  Activity,
  Check,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginPageProps {
  onSuccess?: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 detik lockout jika 5x gagal berturut-turut
const LOCKOUT_STORAGE_KEY = 'CPG_AUTH_SECURITY_LOCKOUT_V2';
const SAVED_USERNAME_KEY = 'CPG_AUTH_SAVED_USERNAME_V2';

const ENTITIES = [
  { code: 'CPL', name: 'PT Cindara Pratama Lines', color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30' },
  { code: 'GAJ', name: 'PT Galangan Aliran Jaya', color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { code: 'MO', name: 'PT Mandar Ocean', color: 'from-indigo-500/20 to-blue-500/20 text-blue-400 border-blue-500/30' },
  { code: 'SP', name: 'PT Sinar Pasifik', color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30' },
  { code: 'HL', name: 'PT Hana Lines', color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30' },
];

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
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Rate Limiting / Security Lockout States
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Real-time Maritime Clock (WITA - UTC+8)
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Makassar',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      setCurrentTime(`${dateStr} • ${timeStr} WITA`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize saved username and check ongoing lockout from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedUser = localStorage.getItem(SAVED_USERNAME_KEY);
      if (savedUser) {
        setUsername(savedUser);
        setRememberUsername(true);
      }
    } catch {}

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
      await new Promise((r) => setTimeout(r, 400));

      const result = await login(cleanUser, cleanPass);
      if (result.success) {
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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Dynamic Animated Ocean & Aurora Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.18),rgba(2,6,23,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a18_1px,transparent_1px),linear-gradient(to_bottom,#0f172a18_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Luminous Ambient Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute top-1/2 -right-32 -translate-y-1/2 w-[480px] h-[480px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Nautical Compass & Coordinates Motif in Background */}
      <div className="absolute -right-24 -bottom-24 w-[520px] h-[520px] pointer-events-none opacity-[0.06] hidden md:block">
        <svg viewBox="0 0 200 200" className="w-full h-full text-cyan-400 stroke-current fill-none">
          <circle cx="100" cy="100" r="95" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="75" strokeWidth="1" />
          <circle cx="100" cy="100" r="45" strokeWidth="1.5" />
          <line x1="100" y1="0" x2="100" y2="200" strokeWidth="1" />
          <line x1="0" y1="100" x2="200" y2="100" strokeWidth="1" />
          <polygon points="100,10 95,95 100,85 105,95" fill="currentColor" />
          <polygon points="100,190 95,105 100,115 105,105" fill="currentColor" />
        </svg>
      </div>

      {/* Main Container - Split Command Center on Desktop */}
      <div className="w-full max-w-6xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Marine Logistics & Supply Chain Command Showcase */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-4">
          {/* Top Status & Timestamp Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 backdrop-blur-xl shadow-xs">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
              </span>
              <span className="font-semibold tracking-wider">CPG COMMAND CENTER</span>
            </div>

            {currentTime && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-800 text-[11px] font-mono text-slate-400 backdrop-blur-md">
                <Radio className="size-3 text-cyan-400 shrink-0 animate-pulse" />
                <span>{currentTime}</span>
              </div>
            )}
          </div>

          {/* Main Title & Hero Heading */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              Integrated Marine Fleet &amp;{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
                Procurement Hub
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              Pusat kendali terintegrasi operasional 60 armada kapal, gudang logistik, dan percepatan rantai pasok pengadaan 
              (<span className="text-slate-200 font-medium">FPB &rarr; PO &rarr; FSTB &rarr; TTB</span>) lintas seluruh entitas grup.
            </p>
          </div>

          {/* 3 Live Highlight Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl hover:border-cyan-500/40 transition group">
              <div className="size-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <Ship className="size-4.5" />
              </div>
              <div className="text-xs font-bold text-white">60 Armada &amp; Unit</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Monitoring formasi kru, tug boat, tanker, &amp; barge.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl hover:border-emerald-500/40 transition group">
              <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <Layers className="size-4.5" />
              </div>
              <div className="text-xs font-bold text-white">Rantai Pasok Real-Time</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Sinkronisasi berkas pengadaan &amp; stok gudang.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl hover:border-blue-500/40 transition group">
              <div className="size-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <ShieldCheck className="size-4.5" />
              </div>
              <div className="text-xs font-bold text-white">Zero-Trust Security</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Digital signature legalitas &amp; audit trail otomatis.
              </div>
            </div>
          </div>

          {/* Group Entities Pills */}
          <div className="pt-2">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-mono mb-2 flex items-center gap-1.5">
              <Anchor className="size-3 text-cyan-400" />
              <span>Multi-Entitas Usaha Terpadu (CPG)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ENTITIES.map((ent) => (
                <div
                  key={ent.code}
                  className={`px-2.5 py-1 rounded-lg border bg-gradient-to-r ${ent.color} text-[11px] font-medium flex items-center gap-1.5 shadow-xs`}
                  title={ent.name}
                >
                  <span className="font-bold font-mono">{ent.code}</span>
                  <span className="text-slate-300 hidden sm:inline text-[10px]">&bull; {ent.name.replace('PT ', '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: High-Class Glassmorphism Auth Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/85 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
            {/* Luminous Top Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600" />

            {/* Header Brand */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/20 mb-3 border border-cyan-400/40 ring-4 ring-cyan-500/10">
                <Ship className="size-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                CPG Procurement Hub
              </h2>
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
                  sebelum mencoba kembali.
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
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
                {failedAttempts >= 2 && (
                  <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-rose-300/80">Lupa kata sandi?</span>
                    <button
                      type="button"
                      onClick={resetFailedAttempts}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                    >
                      Pulihkan Form
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Info Message Callout */}
            {infoMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-400" />
                <div className="leading-relaxed">{infoMessage}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Anti-bot Trap */}
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

              {/* Username Input */}
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
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Input */}
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
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/70 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition font-mono disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={isLocked || isLoading}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-50 p-1"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Options Row */}
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

                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="size-3" />
                  <span>Bantuan</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isLocked}
                className="w-full h-11 mt-2 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:via-teal-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Enterprise Safe Security Notice */}
            <div className="mt-5 pt-4 border-t border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
                <Shield className="size-3.5 text-cyan-400 shrink-0" />
                <span>Security Patch SEC-2026 &bull; Zero-Trust Protocol</span>
              </div>
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                Akses terbatas hanya untuk personel PT Cindara Pratama Lines yang berwenang.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
              <div className="size-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <HelpCircle className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Bantuan Kredensial &amp; Akses</h3>
                <p className="text-[10px] text-slate-400">Portal Pengadaan PT Cindara Pratama Lines</p>
              </div>
            </div>

            <div className="text-xs space-y-2 text-slate-300 leading-relaxed">
              <p>
                Jika Anda lupa kata sandi atau akun Anda mengalami kendala akses, silakan hubungi:
              </p>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] space-y-1">
                <div className="font-semibold text-cyan-300">Tim IT &amp; Administrator CPG</div>
                <div className="text-slate-400">&bull; Email: <span className="font-mono text-slate-300">admin@cindaragroup.com</span></div>
                <div className="text-slate-400">&bull; PIC Procurement: <span className="font-mono text-slate-300">Pak Hermansyah (Ext. 102)</span></div>
                <div className="text-slate-400">&bull; Operasional: <span className="text-slate-300">Kantor Pusat CPG Balikpapan</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
