'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  RefreshCw,
  ExternalLink,
  X,
  KeyRound,
  Cookie,
  ClipboardPaste,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';
import { InventoryItem, InventorySummary } from '@/types/procurement';

interface SyncEfpbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (items: InventoryItem[], summary?: InventorySummary | null) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const DEFAULT_EFPB_URL = 'https://e-fpb.cindaragroup.com/KodeItemForAccurateList';

export default function SyncEfpbModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}: SyncEfpbModalProps) {
  const [url, setUrl] = useState<string>(DEFAULT_EFPB_URL);
  const [authMethod, setAuthMethod] = useState<'account' | 'cookie' | 'paste'>('account');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');
  const [remember, setRemember] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load saved configuration from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('EFPB_USERNAME') || 'Hermansyah';
      const savedPass = localStorage.getItem('EFPB_PASSWORD') || 'Biocpl24!@#';
      const savedSess = localStorage.getItem('EFPB_SESSION_ID') || '';
      const savedUrl = localStorage.getItem('EFPB_URL') || DEFAULT_EFPB_URL;

      setUsername(savedUser);
      setPassword(savedPass);
      if (savedSess) setSessionId(savedSess);
      if (savedUrl) setUrl(savedUrl);
    }
  }, []);

  if (!isOpen) return null;

  const handleSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const payload: Record<string, any> = {
        url: url.trim() || DEFAULT_EFPB_URL,
      };

      if (authMethod === 'account') {
        const u = username.trim() || 'Hermansyah';
        const p = password.trim() || 'Biocpl24!@#';
        payload.username = u;
        payload.password = p;
      } else if (authMethod === 'cookie') {
        if (!sessionId.trim()) {
          setErrorMsg('Session Cookie (PHPSESSID) wajib diisi.');
          setIsLoading(false);
          return;
        }
        payload.sessionId = sessionId.trim().replace(/^PHPSESSID=/i, '');
      } else if (authMethod === 'paste') {
        if (!rawContent.trim()) {
          setErrorMsg('Silakan tempel (paste) tabel HTML atau teks daftar barang dari e-FPB.');
          setIsLoading(false);
          return;
        }
        payload.rawContent = rawContent.trim();
      }

      const res = await fetch('/api/sync-efpb-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error(`Server tidak mengembalikan respons yang valid (${res.status}: ${res.statusText}).`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyinkronkan data dari e-FPB.');
      }

      if (remember && typeof window !== 'undefined') {
        if (authMethod === 'account') {
          localStorage.setItem('EFPB_USERNAME', username);
          localStorage.setItem('EFPB_PASSWORD', password);
        } else if (authMethod === 'cookie') {
          localStorage.setItem('EFPB_SESSION_ID', sessionId.trim().replace(/^PHPSESSID=/i, ''));
        }
        localStorage.setItem('EFPB_URL', url);
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        localStorage.setItem('EFPB_LAST_SYNC_TIME', timeStr);
      }

      onSuccess(data.items, data.summary);
      showToast?.(
        data.message ||
          `Berhasil menyinkronkan ${data.items.length.toLocaleString('id-ID')} item persediaan dari e-FPB!`,
        'success'
      );
      onClose();
    } catch (err: any) {
      console.error('Error sync e-FPB:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyinkronkan data.');
      showToast?.(err.message || 'Gagal sinkronisasi data e-FPB.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <Boxes className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                  Sinkronisasi Persediaan e-FPB
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  Accurate
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Tarik data stok langsung dari sistem internal e-FPB Cindara Group
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Target URL Info Banner */}
        <div className="px-4 sm:px-5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground">
            <Globe className="size-3.5 text-sky-500 shrink-0" />
            <span className="truncate font-mono text-[11px] text-foreground">
              {url}
            </span>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-sky-500 hover:text-sky-600 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Buka Link</span>
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Tab Selection: Auth Method */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('account');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                authMethod === 'account'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="size-3.5 text-indigo-500" />
              <span>Login Akun</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('cookie');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                authMethod === 'cookie'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cookie className="size-3.5 text-amber-500" />
              <span>Session Cookie</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('paste');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                authMethod === 'paste'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ClipboardPaste className="size-3.5 text-teal-500" />
              <span>Tempel Data</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSync} className="space-y-3.5">
            {authMethod === 'account' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed flex items-start gap-2">
                  <ShieldCheck className="size-4 shrink-0 mt-0.5 text-sky-500" />
                  <span>
                    Gunakan akun login Anda di <strong>e-fpb.cindaragroup.com</strong>. Server internal akan melakukan handshake login otomatis dan mengunduh data daftar barang Accurate.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">
                    Username e-FPB
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: hermansyah"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none transition shadow-2xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">
                    Password e-FPB
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password akun e-FPB"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none transition shadow-2xs"
                    required
                  />
                </div>
              </div>
            )}

            {authMethod === 'cookie' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Cookie className="size-3.5" /> Cara mengambil Session Cookie:
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-[10px]">
                    <li>Buka tab e-FPB yang sudah login di browser Anda.</li>
                    <li>Tekan <strong>F12</strong> &rarr; buka tab <strong>Application</strong> (atau Storage).</li>
                    <li>Pilih <strong>Cookies</strong> &rarr; cari nama <strong>PHPSESSID</strong>.</li>
                    <li>Salin nilainya dan tempelkan di kotak bawah ini.</li>
                  </ol>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">
                    Nilai PHPSESSID
                  </label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Contoh: vo3j8h4n613nmkfm3bqsarnj3b"
                    className="w-full h-9 px-3 font-mono rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none transition shadow-2xs"
                    required
                  />
                </div>
              </div>
            )}

            {authMethod === 'paste' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                  Buka halaman <strong>KodeItemForAccurateList</strong> di e-FPB, tekan <strong>Ctrl + A</strong> lalu <strong>Ctrl + C</strong> pada tabel atau ekspor, kemudian tempelkan di bawah ini:
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">
                    Konten Tabel / Teks dari e-FPB
                  </label>
                  <textarea
                    rows={4}
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Tempel tabel HTML atau teks baris persediaan di sini..."
                    className="w-full p-2.5 font-mono text-[11px] rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none transition resize-none shadow-2xs"
                    required
                  />
                </div>
              </div>
            )}

            {/* Remember Checkbox */}
            {authMethod !== 'paste' && (
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500 size-3.5"
                />
                <span className="text-muted-foreground hover:text-foreground transition select-none">
                  Simpan kredensial di browser ini untuk refresh 1-klik di masa depan
                </span>
              </label>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menghubungkan ke e-FPB...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    <span>Tarik Data Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
