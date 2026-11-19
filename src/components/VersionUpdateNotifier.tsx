'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Sparkles, X, AlertCircle, ArrowUpCircle, CheckCircle2 } from 'lucide-react';

export interface AppVersionData {
  version: string;
  gitCommit: string;
  gitDate: string;
  gitMessage: string;
  buildTime: string;
  buildId: string;
  environment: string;
}

const STORAGE_KEY_CLIENT_BUILD = 'CPG_CLIENT_LOADED_BUILD_ID';
const SNOOZE_KEY = 'CPG_UPDATE_SNOOZE_UNTIL';
const POLLING_INTERVAL_MS = 45 * 1000; // Cek setiap 45 detik

export default function VersionUpdateNotifier() {
  const [initialBuild, setInitialBuild] = useState<AppVersionData | null>(null);
  const [latestBuild, setLatestBuild] = useState<AppVersionData | null>(null);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const [showUpToDateToast, setShowUpToDateToast] = useState(false);

  const initialBuildRef = useRef<AppVersionData | null>(null);
  const checkingRef = useRef(false);

  // Fetch versi dari server
  const fetchVersion = useCallback(async (isManual = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    if (isManual) setIsManualChecking(true);

    try {
      // Tambahkan query timestamp untuk bypass segala jenis cache browser
      const res = await fetch(`/api/app-version?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data: AppVersionData = await res.json();

      // Jika ini inisialisasi pertama kali
      if (!initialBuildRef.current) {
        initialBuildRef.current = data;
        setInitialBuild(data);

        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(STORAGE_KEY_CLIENT_BUILD, JSON.stringify(data));
          } catch {}
        }
        return;
      }

      setLatestBuild(data);

      // Cek apakah ada perubahan build / commit / version
      const init = initialBuildRef.current;
      const isCommitDifferent = Boolean(data.gitCommit && init.gitCommit && data.gitCommit !== init.gitCommit && data.gitCommit !== 'local' && data.gitCommit !== 'latest');
      const isBuildIdDifferent = Boolean(data.buildId && init.buildId && data.buildId !== init.buildId);
      const isVersionDifferent = Boolean(data.version && init.version && data.version !== init.version);

      const hasUpdate = isCommitDifferent || isBuildIdDifferent || isVersionDifferent;

      if (hasUpdate) {
        // Cek apakah user sedang men-snooze
        let snoozed = false;
        try {
          const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
          if (snoozeUntil && Date.now() < Number(snoozeUntil)) {
            snoozed = true;
          }
        } catch {}

        setIsSnoozed(snoozed);
        setHasNewVersion(true);

        // Jika dalam mode development dan bukan sedang mengetik form, reload otomatis bisa diaktifkan
        if (data.environment === 'development') {
          console.info('[VersionNotifier] Mode development: versi baru terdeteksi.', data);
        }
      } else {
        setHasNewVersion(false);
        if (isManual) {
          setShowUpToDateToast(true);
          setTimeout(() => setShowUpToDateToast(false), 3500);
        }
      }
    } catch (err) {
      console.warn('[VersionNotifier] Gagal mengecek versi aplikasi:', err);
    } finally {
      checkingRef.current = false;
      if (isManual) setIsManualChecking(false);
    }
  }, []);

  // Lakukan reload aplikasi dengan pembersihan cache
  const handleApplyUpdate = useCallback(() => {
    setIsUpdating(true);
    try {
      localStorage.removeItem(SNOOZE_KEY);
      sessionStorage.removeItem(STORAGE_KEY_CLIENT_BUILD);
    } catch {}

    // Hard reload browser
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }, []);

  // Tunda notifikasi selama 10 menit
  const handleSnooze = useCallback(() => {
    setIsSnoozed(true);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 10 * 60 * 1000));
    } catch {}
  }, []);

  useEffect(() => {
    // 1. Initial check
    fetchVersion();

    // 2. Heartbeat interval
    const intervalId = setInterval(() => {
      fetchVersion();
    }, POLLING_INTERVAL_MS);

    // 3. Tab visibility change & focus listener (Sangat efektif saat user kembali ke tab web)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchVersion();
      }
    };
    const onFocus = () => {
      fetchVersion();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    // 4. Custom event agar bisa dipicu dari tombol di Sidebar / Navbar
    const onCustomCheck = () => {
      fetchVersion(true);
    };
    window.addEventListener('cpg:check-update', onCustomCheck);

    // 5. Tangkap ChunkLoadError secara otomatis untuk reload mandiri jika server baru redeploy
    const handleError = (e: ErrorEvent) => {
      const msg = e.message || '';
      if (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module')
      ) {
        console.warn('[VersionNotifier] ChunkLoadError terdeteksi. Memuat ulang aplikasi...');
        handleApplyUpdate();
      }
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason ? String(e.reason) : '';
      if (
        reason.includes('Loading chunk') ||
        reason.includes('ChunkLoadError') ||
        reason.includes('Failed to fetch dynamically imported module')
      ) {
        console.warn('[VersionNotifier] ChunkLoadError pada Promise rejection terdeteksi. Memuat ulang aplikasi...');
        handleApplyUpdate();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('cpg:check-update', onCustomCheck);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [fetchVersion, handleApplyUpdate]);

  // Toast ketika user manual check dan sudah paling baru
  if (showUpToDateToast) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-md border border-emerald-500/40 text-foreground shadow-xl">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold block text-emerald-400">Aplikasi Sudah Terkini</span>
            <span className="text-muted-foreground">
              Versi {initialBuild?.version || '2.6.0'} ({initialBuild?.gitCommit || 'latest'}) aktif.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Jika tidak ada update atau sedang di-snooze
  if (!hasNewVersion || isSnoozed) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
      <div className="relative overflow-hidden rounded-2xl bg-card/95 backdrop-blur-md border-2 border-sky-500/50 shadow-2xl p-4 text-card-foreground ring-1 ring-sky-500/20">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 size-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
            <Sparkles className="size-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <span>Pembaruan Sistem Tersedia</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {latestBuild?.version || 'Baru'}
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Versi terbaru aplikasi telah diterapkan di server. Terapkan pembaruan sekarang agar mendapatkan fitur dan perbaikan terkini.
            </p>

            {latestBuild?.gitMessage && (
              <p className="text-[11px] font-mono text-sky-300/80 bg-sky-950/40 border border-sky-800/40 px-2 py-1 rounded mt-2 truncate">
                Rilis: {latestBuild.gitMessage}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'Memperbarui...' : 'Perbarui Sekarang'}</span>
              </button>

              <button
                type="button"
                onClick={handleSnooze}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              >
                Ingatkan Nanti
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSnooze}
            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition cursor-pointer"
            title="Tutup & Ingatkan Nanti"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
