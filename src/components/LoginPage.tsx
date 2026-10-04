'use client';

import React, { useState } from 'react';
import {
  Lock,
  User,
  Shield,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Building2,
  CheckCircle2,
  Ship,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginPageProps {
  onSuccess?: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const { login, resetDefaults } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Silakan masukkan username dan password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMessage(result.message || 'Username atau password tidak valid.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat mencoba masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (userPreset: string, passPreset: string) => {
    setUsername(userPreset);
    setPassword(passPreset);
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await login(userPreset, passPreset);
      if (result.success && onSuccess) {
        onSuccess();
      } else if (!result.success) {
        setErrorMessage(result.message || 'Login gagal.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 relative overflow-hidden">
      {/* Background glowing ambient effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in-50 zoom-in-95 duration-300">
        {/* Main Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/85 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-linear-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 mb-3 border border-cyan-400/20">
              <Ship className="size-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>CPG Procurement Hub</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              PT Cindara Pratama Lines &bull; Integrated Supply Chain
            </p>
          </div>

          {/* Error Message Callout */}
          {/* Error & Info Message Callouts */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{infoMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username atau Email
              </label>
              <div className="relative">
                <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin / staff / visitor"
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition font-mono"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 mt-2 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-slate-900 px-3 text-slate-500 font-medium">
                Pilih Akun Cepat (Quick Demo)
              </span>
            </div>
          </div>

          {/* Quick Login Presets */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin')}
              className="p-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-left transition flex flex-col justify-between cursor-pointer"
              className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-left transition flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-1 font-semibold text-[11px]">
                <Shield className="size-3 text-purple-400" />
                <Shield className="size-3 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>Admin</span>
              </div>
              <span className="text-[9px] text-purple-400/80 font-mono mt-1">
                Full Access
              </span>
              <div className="mt-1">
                <span className="text-[9px] text-purple-400/80 font-mono block">
                  pass: admin
                </span>
                <span className="text-[9px] text-purple-300/60 font-sans">
                  Full Access
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('staff', 'user123')}
              className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-left transition flex flex-col justify-between cursor-pointer"
              className="p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-left transition flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-1 font-semibold text-[11px]">
                <User className="size-3 text-sky-400" />
                <User className="size-3 text-sky-400 group-hover:scale-110 transition-transform" />
                <span>Staff User</span>
              </div>
              <span className="text-[9px] text-sky-400/80 font-mono mt-1">
                Operasional
              </span>
              <div className="mt-1">
                <span className="text-[9px] text-sky-400/80 font-mono block">
                  pass: user123
                </span>
                <span className="text-[9px] text-sky-300/60 font-sans">
                  Operasional
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('visitor', 'visitor123')}
              className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-left transition flex flex-col justify-between cursor-pointer"
              className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-left transition flex flex-col justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-1 font-semibold text-[11px]">
                <Eye className="size-3 text-emerald-400" />
                <Eye className="size-3 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Visitor</span>
              </div>
              <span className="text-[9px] text-emerald-400/80 font-mono mt-1">
                Overview Only
              </span>
              <div className="mt-1">
                <span className="text-[9px] text-emerald-400/80 font-mono block">
                  pass: visitor123
                </span>
                <span className="text-[9px] text-emerald-300/60 font-sans">
                  Read-Only
                </span>
              </div>
            </button>
          </div>

          {/* Reset Akun Default Helper */}
          <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-800">
            <span>Password tersimpan bermasalah?</span>
            <button
              type="button"
              onClick={() => {
                resetDefaults();
                setInfoMessage('Kredensial akun default berhasil di-reset! Silakan klik tombol Admin atau masukkan: admin / admin');
                setErrorMessage('');
              }}
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset Akun Default</span>
            </button>
          </div>

          {/* Footer Information */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
            Sistem Pemantauan Alur Pengadaan & Verifikasi Logistik Maritim
          </div>
        </div>
      </div>
    </div>
  );
}

