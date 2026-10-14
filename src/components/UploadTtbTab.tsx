'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FolderUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Search,
  RefreshCw,
  Download,
  Eye,
  Info,
  Ship,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  HardDrive,
  FileCheck,
  Pencil,
  Link2,
  Database,
  FileSpreadsheet,
  Code2,
  Sparkles,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import { sanitizeTtbNumber, formatTtbFilename, formatFileSize } from '@/utils/ttbRename';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '@/utils/googleDriveAppsScript';

const DEFAULT_DRIVE_FOLDER_ID = '1Hd6FsgWiALq1jJyRvh8auY0FJGE9h5tf';
const DEFAULT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;

/**
 * Ekstraksi ID Folder Google Drive secara utuh dan aman
 * Menghindari pemotongan karakter atau query parameter tambahan.
 */
export function extractDriveFolderId(inputUrlOrId: string): string {
  const trimmed = (inputUrlOrId || '').trim();
  if (!trimmed) return DEFAULT_DRIVE_FOLDER_ID;

  // 1. Jika pengguna langsung memasukkan string ID utuh (base64url 20-50 karakter)
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Ekstraksi dari path /folders/<ID>
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchFolders && matchFolders[1]) {
    return matchFolders[1];
  }

  // 3. Ekstraksi dari parameter ?id=<ID> atau &id=<ID>
  const matchQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchQuery && matchQuery[1]) {
    return matchQuery[1];
  }

  return DEFAULT_DRIVE_FOLDER_ID;
}

interface UploadTtbTabProps {
  procurementItems?: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  sisaLayananItems?: SisaLayananItem[];
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  isImage: boolean;
  isPdf: boolean;
}

interface TtbSuggestion {
  noTtb: string;
  armada: string;
  noFpb?: string;
  description?: string;
}

export default function UploadTtbTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  showToast,
}: UploadTtbTabProps) {
  // Form State
  const [noTtbInput, setNoTtbInput] = useState<string>('');
  const [armadaInput, setArmadaInput] = useState<string>('');
  const [receivedDate, setReceivedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [keteranganInput, setKeteranganInput] = useState<string>('');

  // Dropzone & Queued Files
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessResult, setUploadSuccessResult] = useState<UploadTtbResponse | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);

  // Configurable Google Drive Folder URL
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cpg_drive_ttb_url');
      // Auto-migrate jika ada cache ID lama yang salah (WiAlQ) atau rusak
      if (stored && (stored.includes('1Hd6FsgWiAlQ1jJyRvh8auY0FJGE9h5tf') || stored.includes('WiAlQ'))) {
        localStorage.setItem('cpg_drive_ttb_url', DEFAULT_DRIVE_FOLDER_URL);
        return DEFAULT_DRIVE_FOLDER_URL;
      }
      return stored || DEFAULT_DRIVE_FOLDER_URL;
    }
    return DEFAULT_DRIVE_FOLDER_URL;
  });
  const [isEditingDriveUrl, setIsEditingDriveUrl] = useState<boolean>(false);
  const [tempDriveUrl, setTempDriveUrl] = useState<string>(DEFAULT_DRIVE_FOLDER_URL);

  // Google Drive Database & Apps Script Integration
  const [driveScriptUrl, setDriveScriptUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cpg_drive_script_url') || '';
    }
    return '';
  });
  const [tempScriptUrl, setTempScriptUrl] = useState<string>('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cpg_drive_spreadsheet_url') || null;
    }
    return null;
  });
  const [isDriveDatabaseModalOpen, setIsDriveDatabaseModalOpen] = useState<boolean>(false);
  const [modalActiveTab, setModalActiveTab] = useState<'config' | 'guide'>('config');
  const [isTestingDriveConnection, setIsTestingDriveConnection] = useState<boolean>(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    spreadsheetUrl?: string;
  } | null>(null);
  const [isCopiedScript, setIsCopiedScript] = useState<boolean>(false);

  const activeFolderId = useMemo(() => {
    return extractDriveFolderId(driveFolderUrl);
  }, [driveFolderUrl]);

  const handleSaveDriveUrl = () => {
    const clean = tempDriveUrl.trim();
    if (clean) {
      const extractedId = extractDriveFolderId(clean);
      const fullUrl = clean.startsWith('http')
        ? clean
        : `https://drive.google.com/drive/folders/${extractedId}`;

      setDriveFolderUrl(fullUrl);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cpg_drive_ttb_url', fullUrl);
      }
      showToast?.(`URL Folder Google Drive disimpan! ID: ${extractedId}`, 'success');
    }
    setIsEditingDriveUrl(false);
  };

  // Uji koneksi Web App Google Apps Script
  const handleTestDriveConnection = async () => {
    const urlToTest = (tempScriptUrl || driveScriptUrl).trim();
    if (!urlToTest) {
      showToast?.('Masukkan URL Web App Google Apps Script terlebih dahulu.', 'warning');
      return;
    }

    setIsTestingDriveConnection(true);
    setTestConnectionResult(null);

    try {
      const res = await fetch('/api/upload-ttb/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl: urlToTest,
          folderId: activeFolderId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestConnectionResult({
          success: true,
          message: data.message || 'Koneksi ke Google Drive & Database Spreadsheet aktif!',
          latencyMs: data.latencyMs,
          spreadsheetUrl: data.spreadsheetUrl,
        });
        if (data.spreadsheetUrl) {
          setSpreadsheetUrl(data.spreadsheetUrl);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cpg_drive_spreadsheet_url', data.spreadsheetUrl);
          }
        }
        showToast?.(`Koneksi Database Google Drive Berhasil! (${data.latencyMs}ms)`, 'success');
      } else {
        setTestConnectionResult({
          success: false,
          message: data.error || 'Gagal tersambung ke Google Apps Script.',
          latencyMs: data.latencyMs,
        });
        showToast?.(data.error || 'Gagal tersambung ke Google Apps Script.', 'error');
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menguji koneksi.';
      setTestConnectionResult({
        success: false,
        message: msg,
      });
      showToast?.(msg, 'error');
    } finally {
      setIsTestingDriveConnection(false);
    }
  };

  // Simpan konfigurasi Script Google Drive
  const handleSaveDriveDatabaseConfig = () => {
    const clean = tempScriptUrl.trim();
    setDriveScriptUrl(clean);
    if (typeof window !== 'undefined') {
      if (clean) {
        localStorage.setItem('cpg_drive_script_url', clean);
        showToast?.('Pengaturan Database Google Drive berhasil disimpan!', 'success');
      } else {
        localStorage.removeItem('cpg_drive_script_url');
        showToast?.('Integrasi Database Google Drive dinonaktifkan (mode lokal).', 'info');
      }
    }
    setIsDriveDatabaseModalOpen(false);
  };

  // Salin Kode Google Apps Script
  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setIsCopiedScript(true);
    showToast?.('Kode Google Apps Script disalin ke clipboard!', 'success');
    setTimeout(() => setIsCopiedScript(false), 3000);
  };

  const handleDownloadQueuedFile = (qf: QueuedFile, renamedName: string) => {
    const url = URL.createObjectURL(qf.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = renamedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast?.(`Mengunduh berkas: ${renamedName}`, 'info');
  };

  // Autocomplete state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const autocompleteRef = useRef<HTMLDivElement | null>(null);

  // Upload History
  const [historyItems, setHistoryItems] = useState<UploadedTtbItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Buat database saran nomor TTB dari seluruh dataset yang ada
  const ttbSuggestions = useMemo<TtbSuggestion[]>(() => {
    const map = new Map<string, TtbSuggestion>();

    // 1. Dari Sisa Layanan (Prioritas tinggi karena terlengkap)
    for (const item of sisaLayananItems) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        if (!map.has(key)) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.departement || item.pt || '',
            noFpb: item.noFpb || '',
            description: item.namaBarang || '',
          });
        }
      }
    }

    // 2. Dari Procurement
    for (const item of procurementItems) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        if (!map.has(key)) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.deptArmada || item.peruntukan || '',
            noFpb: item.fpb || '',
            description: item.item || '',
          });
        }
      }
    }

    // 3. Dari Armada
    for (const item of armadaItems) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        if (!map.has(key)) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.armada || '',
            noFpb: item.fpb || '',
            description: item.item || '',
          });
        }
      }
    }

    return Array.from(map.values());
  }, [procurementItems, armadaItems, sisaLayananItems]);

  // Filter saran autocomplete berdasarkan input
  const filteredSuggestions = useMemo(() => {
    const q = noTtbInput.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    return ttbSuggestions
      .filter((s) => {
        return (
          s.noTtb.toLowerCase().includes(q) ||
          (s.noFpb && s.noFpb.toLowerCase().includes(q)) ||
          (s.armada && s.armada.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [noTtbInput, ttbSuggestions]);

  // Fetch riwayat upload dari API
  const fetchUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/upload-ttb');
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setHistoryItems(data.items);
        }
        if (data.spreadsheetUrl) {
          setSpreadsheetUrl(data.spreadsheetUrl);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cpg_drive_spreadsheet_url', data.spreadsheetUrl);
          }
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat upload:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUploadHistory();
  }, []);

  // Tutup autocomplete saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setIsAutocompleteOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle autocomplete selection
  const handleSelectSuggestion = (sug: TtbSuggestion) => {
    setNoTtbInput(sug.noTtb);
    if (sug.armada) {
      setArmadaInput(sug.armada);
    }
    setIsAutocompleteOpen(false);
  };

  // Tambahkan file ke antrean
  const addFilesToQueue = (files: FileList | File[]) => {
    const validFiles: QueuedFile[] = [];
    const arrayFiles = Array.from(files);

    for (const file of arrayFiles) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(ext);
      const isPdf = /\.pdf$/i.test(ext);

      if (!isImage && !isPdf) {
        showToast?.(`Berkas "${file.name}" dilewati karena bukan gambar atau PDF.`, 'warning');
        continue;
      }

      // Preview URL
      const previewUrl = isImage ? URL.createObjectURL(file) : '';
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        isImage,
        isPdf,
      });
    }

    if (validFiles.length > 0) {
      setQueuedFiles((prev) => [...prev, ...validFiles]);
      setUploadSuccessResult(null);
    }
  };

  // Remove single file
  const handleRemoveFile = (id: string) => {
    setQueuedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Clear all queued files
  const handleClearAllFiles = () => {
    queuedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
    setUploadSuccessResult(null);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFilename(text);
    showToast?.(`Disalin: ${text}`, 'info');
    setTimeout(() => setCopiedFilename(null), 2500);
  };

  // Submit Upload
  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!noTtbInput.trim()) {
      showToast?.('Nomor TTB wajib diisi sebelum mengunggah berkas!', 'error');
      return;
    }

    if (queuedFiles.length === 0) {
      showToast?.('Pilih atau tarik minimal 1 berkas foto/dokumen TTB.', 'warning');
      return;
    }

    setIsUploading(true);
    setUploadSuccessResult(null);
    setUploadErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('noTtb', noTtbInput.trim());
      formData.append('armada', armadaInput.trim());
      formData.append('receivedDate', receivedDate);
      formData.append('keterangan', keteranganInput.trim());
      if (driveScriptUrl.trim()) {
        formData.append('driveScriptUrl', driveScriptUrl.trim());
      }
      formData.append('folderId', activeFolderId);

      queuedFiles.forEach((qf) => {
        formData.append('files', qf.file);
      });

      const res = await fetch('/api/upload-ttb', {
        method: 'POST',
        body: formData,
      });

      let data: UploadTtbResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error('Gagal terhubung ke Google Drive, periksa izin akses atau URL folder.');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Gagal terhubung ke Google Drive, periksa izin akses atau URL folder.');
      }

      // Success
      setUploadSuccessResult(data);
      setUploadErrorMessage(null);
      if (data.spreadsheetUrl) {
        setSpreadsheetUrl(data.spreadsheetUrl);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cpg_drive_spreadsheet_url', data.spreadsheetUrl);
        }
      }
      showToast?.(data.message, 'success');

      // Perbarui riwayat
      if (data.uploadedFiles && data.uploadedFiles.length > 0) {
        setHistoryItems((prev) => [...data.uploadedFiles, ...prev]);
      }

      // Reset antrean file
      queuedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setQueuedFiles([]);

      // Simpan status TTB di localStorage agar sinkron dengan modul internal
      try {
        const uploadedList = JSON.parse(localStorage.getItem('cpg_uploaded_ttb_list') || '[]');
        uploadedList.push(sanitizeTtbNumber(noTtbInput));
        localStorage.setItem('cpg_uploaded_ttb_list', JSON.stringify(Array.from(new Set(uploadedList))));
      } catch {
        // Non-fatal
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal terhubung ke Google Drive, periksa izin akses atau URL folder.';
      const formattedError = msg.includes('Google Drive')
        ? msg
        : `Gagal terhubung ke Google Drive, periksa izin akses atau URL folder: ${msg}`;
      setUploadErrorMessage(formattedError);
      showToast?.(formattedError, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter history items by search
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter(
      (h) =>
        h.noTtb.toLowerCase().includes(q) ||
        h.armada.toLowerCase().includes(q) ||
        h.renamedFileName.toLowerCase().includes(q) ||
        (h.keterangan && h.keterangan.toLowerCase().includes(q))
    );
  }, [historyItems, historySearch]);

  const cleanCurrentNoTtb = sanitizeTtbNumber(noTtbInput);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Header Banner & Quick Action Google Drive */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                <UploadCloud className="size-5" />
              </span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Upload Dokumen TTB ke Google Drive
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Auto-Rename Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                Folder: {activeFolderId}
              </span>
              {driveScriptUrl ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Database Drive &amp; Sheets Terhubung
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempScriptUrl(driveScriptUrl);
                    setIsDriveDatabaseModalOpen(true);
                  }}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer transition"
                  title="Klik untuk konfigurasi dan menghubungkan database Google Drive"
                >
                  <Database className="size-3 text-amber-500" />
                  Hubungkan Database Drive
                </button>
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Unggah berkas bukti tanda terima barang (TTB) fisik atau scan dokumen lapangan. 
              Sistem secara otomatis akan mengganti nama file ke format resmi{' '}
              <code className="text-teal-600 dark:text-teal-400 font-mono font-semibold bg-teal-500/10 px-1 py-0.5 rounded">
                [NO_TTB].[ekstensi]
              </code>{' '}
              sebelum diarsipkan ke Google Drive &amp; dicatat dalam Database Spreadsheet logistik operasional CPG.
            </p>
          </div>

          {/* Tombol Akses Cepat Google Drive Folder & Konfigurasi URL */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Tombol Database Spreadsheet jika tersedia */}
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs md:text-sm font-semibold transition shadow-sm cursor-pointer"
                title="Buka Database Spreadsheet TTB di Google Sheets"
              >
                <FileSpreadsheet className="size-4 shrink-0" />
                <span>Spreadsheet Database</span>
                <ExternalLink className="size-3.5 opacity-70 shrink-0" />
              </a>
            )}

            {/* Tombol Buka Folder Google Drive */}
            <a
              href={driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs md:text-sm font-semibold transition shadow-sm cursor-pointer"
              title="Buka Folder Google Drive Penyimpanan Berkas TTB"
            >
              <FolderUp className="size-4 shrink-0" />
              <span>Buka Folder Google Drive</span>
              <ExternalLink className="size-3.5 opacity-70 shrink-0" />
            </a>

            {/* Tombol Konfigurasi Database Google Drive */}
            <button
              type="button"
              onClick={() => {
                setTempScriptUrl(driveScriptUrl);
                setTestConnectionResult(null);
                setIsDriveDatabaseModalOpen(true);
              }}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs md:text-sm font-semibold transition cursor-pointer active:scale-95 ${
                driveScriptUrl
                  ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}
              title="Kelola Koneksi Database Google Drive & Google Sheets"
            >
              <Database className="size-3.5 shrink-0" />
              <span>Database Google Drive</span>
              {driveScriptUrl ? (
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="size-2 rounded-full bg-amber-500" />
              )}
            </button>

            {/* Tombol Cadangan: Buka Folder TTB Manual */}
            <a
              href={DEFAULT_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 active:scale-95 text-teal-700 dark:text-teal-300 text-xs md:text-sm font-semibold transition cursor-pointer"
              title="Buka Folder TTB Manual (Tautan Resmi Terverifikasi)"
            >
              <FolderUp className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
              <span>Folder Manual</span>
              <ExternalLink className="size-3 opacity-70 shrink-0" />
            </a>

            <button
              type="button"
              onClick={() => {
                setTempDriveUrl(driveFolderUrl);
                setIsEditingDriveUrl((prev) => !prev);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              title="Ubah tautan URL Google Drive (jika URL berbeda)"
            >
              <Pencil className="size-3.5" />
              <span>Ubah URL</span>
            </button>
          </div>
        </div>

        {/* Form Pengeditan URL Google Drive */}
        {isEditingDriveUrl && (
          <div className="mt-4 p-4 rounded-xl bg-muted/70 border border-teal-500/30 animate-in fade-in-50 duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Link2 className="size-3.5 text-teal-600" />
                  <span>Kustomisasi URL Folder Google Drive</span>
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Jika tab Google Drive sudah terbuka di browser Anda (seperti tab &ldquo;TTB Upload&rdquo;), salin URL dari address bar tab tersebut dan tempel di bawah ini:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingDriveUrl(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <input
                type="text"
                value={tempDriveUrl}
                onChange={(e) => setTempDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono text-foreground"
              />
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleSaveDriveUrl}
                  className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Simpan URL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempDriveUrl(DEFAULT_DRIVE_FOLDER_URL);
                    setDriveFolderUrl(DEFAULT_DRIVE_FOLDER_URL);
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('cpg_drive_ttb_url');
                    }
                    showToast?.('URL direset ke default!', 'info');
                    setIsEditingDriveUrl(false);
                  }}
                  className="px-2.5 py-2 rounded-lg border border-border hover:bg-muted text-xs text-muted-foreground transition cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Steps Indicator */}
        <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              1
            </span>
            <span className="truncate">Input Nomor TTB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              2
            </span>
            <span className="truncate">Auto-Fill Unit Armada</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              3
            </span>
            <span className="truncate">Preview Auto-Rename</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0">
              4
            </span>
            <span className="truncate">Tersimpan &amp; Sinkron</span>
          </div>
        </div>
      </div>

      {/* 2. Error Fallback Banner (Jika Upload / Folder Gagal atau Tidak Ditemukan) */}
      {uploadErrorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 md:p-5 text-rose-800 dark:text-rose-200 animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                <AlertCircle className="size-5" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm md:text-base font-bold text-rose-900 dark:text-rose-100">
                  Kendala Akses Google Drive
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                  {uploadErrorMessage}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Gagal terhubung ke Google Drive, periksa izin akses atau URL folder. Anda dapat membuka folder target secara langsung menggunakan tombol di samping.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-start flex-wrap">
              <a
                href={DEFAULT_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
                title="Buka Folder TTB Manual di Tab Baru"
              >
                <FolderUp className="size-3.5" />
                <span>Buka Folder TTB Manual</span>
                <ExternalLink className="size-3" />
              </a>
              <button
                type="button"
                onClick={() => setUploadErrorMessage(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                title="Tutup Pesan Error"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Success Banner (Jika Baru Upload Berhasil) */}
      {uploadSuccessResult && uploadSuccessResult.success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 animate-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="size-5" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm md:text-base font-bold text-emerald-800 dark:text-emerald-200">
                  {uploadSuccessResult.message}
                </h3>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Berkas telah diproses, diganti nama sesuai Nomor TTB resmi, dan siap diakses di Google Drive.
                </p>

                {uploadSuccessResult.spreadsheetUrl && (
                  <div className="pt-1">
                    <a
                      href={uploadSuccessResult.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold transition"
                    >
                      <FileSpreadsheet className="size-3.5" />
                      <span>Buka Catatan di Google Sheets Database</span>
                      <ExternalLink className="size-3 opacity-70" />
                    </a>
                  </div>
                )}

                {/* List berkas yang baru diupload */}
                <div className="mt-3 space-y-1.5">
                  {uploadSuccessResult.uploadedFiles.map((uf) => (
                    <div
                      key={uf.id}
                      className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-xs font-mono"
                    >
                      <FileCheck className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-foreground truncate">{uf.renamedFileName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({formatFileSize(uf.fileSize)})
                      </span>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyText(uf.renamedFileName)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Salin Nama File"
                        >
                          {copiedFilename === uf.renamedFileName ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                        {uf.driveViewUrl && (
                          <a
                            href={uf.driveViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 transition"
                            title="Buka Berkas di Google Drive"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                        <a
                          href={uf.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-teal-600 transition"
                          title="Buka Berkas"
                        >
                          <Eye className="size-3" />
                        </a>
                        <a
                          href={uf.driveDownloadUrl || `${uf.fileUrl}&download=true`}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 transition"
                          title="Unduh Berkas yang Sudah Di-Rename"
                        >
                          <Download className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-start flex-wrap">
              {uploadSuccessResult.spreadsheetUrl && (
                <a
                  href={uploadSuccessResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span>Google Sheets</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <FolderUp className="size-3.5" />
                <span>Buka di Google Drive</span>
                <ExternalLink className="size-3" />
              </a>
              <button
                type="button"
                onClick={() => setUploadSuccessResult(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Form Upload & Dropzone Layout */}
      <form onSubmit={handleSubmitUpload} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Metadata Form (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-foreground">Metadata Dokumen TTB</h2>
              </div>
              <span className="text-[11px] text-rose-500 font-semibold">* Wajib diisi</span>
            </div>

            {/* Input No. TTB dengan Autocomplete */}
            <div className="space-y-1.5 relative" ref={autocompleteRef}>
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>
                  Nomor TTB <span className="text-rose-500">*</span>
                </span>
                {cleanCurrentNoTtb && (
                  <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400">
                    Format: {cleanCurrentNoTtb}
                  </span>
                )}
              </label>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={noTtbInput}
                  onChange={(e) => {
                    setNoTtbInput(e.target.value);
                    setIsAutocompleteOpen(true);
                  }}
                  onFocus={() => {
                    if (noTtbInput.trim().length >= 2) {
                      setIsAutocompleteOpen(true);
                    }
                  }}
                  placeholder="Contoh: CPL-TTB-26-00449 atau 04975"
                  className="w-full h-10 px-3.5 pr-9 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono text-foreground transition placeholder:text-muted-foreground/60"
                />
                {noTtbInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNoTtbInput('');
                      setIsAutocompleteOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <Search className="size-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isAutocompleteOpen && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto no-scrollbar animate-in fade-in-50 duration-150">
                  <div className="px-3 py-1.5 bg-muted/60 text-[10px] font-semibold text-muted-foreground border-b border-border flex items-center justify-between">
                    <span>Saran dari Database Pengadaan &amp; Layanan</span>
                    <span>{filteredSuggestions.length} ditemukan</span>
                  </div>
                  {filteredSuggestions.map((sug, idx) => (
                    <button
                      key={`${sug.noTtb}-${idx}`}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="w-full text-left px-3.5 py-2 hover:bg-muted transition border-b border-border/50 last:border-b-0 cursor-pointer text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                          {sug.noTtb}
                        </span>
                        {sug.noFpb && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {sug.noFpb}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        {sug.armada && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Ship className="size-3 text-sky-500" />
                            {sug.armada}
                          </span>
                        )}
                        {sug.description && (
                          <span className="truncate">&bull; {sug.description}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input Nama Armada / Unit (Auto-filled or manual) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Ship className="size-3.5 text-sky-500" />
                <span>Nama Armada / Unit</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Auto-fill / manual)</span>
              </label>
              <input
                type="text"
                value={armadaInput}
                onChange={(e) => setArmadaInput(e.target.value)}
                placeholder="Contoh: TB. CINDARA 2107 / KANTOR PUSAT"
                className="w-full h-10 px-3.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Input Tanggal Penerimaan / TTB */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-amber-500" />
                <span>Tanggal Penerimaan Barang / TTB</span>
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-10 px-3.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition font-mono"
              />
            </div>

            {/* Input Keterangan Tambahan */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-indigo-500" />
                <span>Keterangan Tambahan (Opsional)</span>
              </label>
              <textarea
                rows={2}
                value={keteranganInput}
                onChange={(e) => setKeteranganInput(e.target.value)}
                placeholder="Catatan kondisi serah terima, nama penerima lapangan, dll."
                className="w-full p-3 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition placeholder:text-muted-foreground/60 resize-none"
              />
            </div>

            {/* Info Card Google Drive Path */}
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] space-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <HardDrive className="size-3.5 text-teal-600" />
                <span>Target Folder Google Drive:</span>
              </div>
              <div className="font-mono text-[10px] break-all text-teal-700 dark:text-teal-300">
                {activeFolderId}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Dropzone & File Auto-Rename Preview (7 Kolom) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FolderUp className="size-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-sm font-bold text-foreground">Berkas Foto &amp; Scan Dokumen TTB</h2>
              </div>
              {queuedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllFiles}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium transition cursor-pointer"
                >
                  Hapus Semua ({queuedFiles.length})
                </button>
              )}
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-border/80 hover:border-teal-500/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToQueue(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              <div className="size-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
                <UploadCloud className="size-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs md:text-sm font-semibold text-foreground">
                  Tarik berkas foto/scan ke sini, atau{' '}
                  <span className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
                    pilih dari komputer
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Mendukung foto JPG, JPEG, PNG, WebP dan dokumen scan PDF. Bisa pilih lebih dari 1 file sekaligus.
                </p>
              </div>
            </div>

            {/* Preview Auto-Rename List */}
            {queuedFiles.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3.5 text-teal-600" />
                    <span>Daftar Berkas &amp; Transformasi Nama Otomatis:</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {queuedFiles.length} berkas siap diupload
                  </span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar pr-1">
                  {queuedFiles.map((qf, index) => {
                    const newFilename = formatTtbFilename(
                      noTtbInput,
                      qf.file.name,
                      index,
                      queuedFiles.length
                    );

                    return (
                      <div
                        key={qf.id}
                        className="bg-muted/30 border border-border rounded-xl p-3 flex items-center gap-3 transition hover:border-border"
                      >
                        {/* Thumbnail or Document Icon */}
                        <div className="size-12 rounded-lg overflow-hidden bg-background border border-border flex items-center justify-center shrink-0">
                          {qf.isImage && qf.previewUrl ? (
                            <img
                              src={qf.previewUrl}
                              alt={qf.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="size-6 text-rose-500" />
                          )}
                        </div>

                        {/* File Name Transformation Details */}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Original Name */}
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[160px] md:max-w-[200px]" title={qf.file.name}>
                              {qf.file.name}
                            </span>
                            <span className="shrink-0 font-mono text-[10px]">
                              ({formatFileSize(qf.file.size)})
                            </span>
                          </div>

                          {/* New Renamed File Target */}
                          <div className="flex items-center gap-1.5">
                            <ArrowRight className="size-3 text-teal-500 shrink-0" />
                            <span className="font-mono font-bold text-xs text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 truncate">
                              {newFilename}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(newFilename)}
                              className="p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Salin Nama Baru"
                            >
                              {copiedFilename === newFilename ? (
                                <Check className="size-3 text-teal-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadQueuedFile(qf, newFilename)}
                              className="p-1 text-muted-foreground hover:text-teal-600 transition cursor-pointer"
                              title="Unduh Berkas yang Sudah Di-rename"
                            >
                              <Download className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(qf.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                          title="Hapus berkas ini"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tombol Eksekusi Upload */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground">
                {queuedFiles.length > 0 ? (
                  <span>
                    Total ukuran:{' '}
                    <strong className="text-foreground">
                      {formatFileSize(queuedFiles.reduce((acc, f) => acc + f.file.size, 0))}
                    </strong>
                  </span>
                ) : (
                  <span>Belum ada berkas dipilih</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || queuedFiles.length === 0 || !noTtbInput.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer ${
                  isUploading || queuedFiles.length === 0 || !noTtbInput.trim()
                    ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                    : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/20'
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Mengunggah &amp; Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-4" />
                    <span>
                      Upload ke Google Drive ({queuedFiles.length || 0})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 4. Tabel Riwayat Upload Dokumen TTB */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-0.5">
            <h2 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2">
              <HardDrive className="size-4 text-teal-600 dark:text-teal-400" />
              <span>Riwayat Berkas TTB Terunggah</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Daftar seluruh berkas foto dan scan dokumen TTB yang telah di-rename dan diarsipkan ke sistem cloud.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition"
                title="Buka Spreadsheet Database TTB"
              >
                <FileSpreadsheet className="size-3.5" />
                <span className="hidden sm:inline">Database Spreadsheet</span>
                <ExternalLink className="size-3 opacity-70" />
              </a>
            )}

            <div className="relative">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari No. TTB, armada, nama file..."
                className="h-8.5 px-3 pl-8 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-teal-500 w-52 md:w-64 transition placeholder:text-muted-foreground/60"
              />
              <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <button
              onClick={fetchUploadHistory}
              title="Refresh Riwayat"
              disabled={isLoadingHistory}
              className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto no-scrollbar rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Nomor TTB</th>
                <th className="py-2.5 px-3">Armada / Unit</th>
                <th className="py-2.5 px-3">Nama Berkas di Google Drive</th>
                <th className="py-2.5 px-3">Ukuran</th>
                <th className="py-2.5 px-3">Status Arsip</th>
                <th className="py-2.5 px-3">Waktu Upload</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="size-4 animate-spin text-teal-600" />
                        <span>Memuat riwayat berkas...</span>
                      </div>
                    ) : historySearch ? (
                      <span>Tidak ditemukan berkas dengan kata kunci &quot;{historySearch}&quot;.</span>
                    ) : (
                      <span>Belum ada berkas TTB yang diunggah. Unggah berkas pertama Anda di atas.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition">
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                        {item.noTtb}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {item.armada || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 max-w-xs md:max-w-sm">
                        <span className="font-mono text-teal-600 dark:text-teal-400 font-semibold truncate" title={item.renamedFileName}>
                          {item.renamedFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.renamedFileName)}
                          className="p-1 text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
                          title="Salin Nama File"
                        >
                          {copiedFilename === item.renamedFileName ? (
                            <Check className="size-3 text-teal-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                      {formatFileSize(item.fileSize)}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.status === 'SAVED_TO_DRIVE_DATABASE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <FileSpreadsheet className="size-3" />
                          <span>Drive &amp; Sheets Synced</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          <ShieldCheck className="size-3" />
                          <span>Lokal &bull; Drive Ready</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(item.uploadedAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={item.driveViewUrl || item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-teal-600 transition"
                          title={item.driveViewUrl ? "Buka File di Google Drive" : "Buka / Preview Berkas"}
                        >
                          <Eye className="size-3.5" />
                        </a>
                        <a
                          href={item.driveDownloadUrl || `${item.fileUrl}&download=true`}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Unduh Berkas"
                        >
                          <Download className="size-3.5" />
                        </a>
                        <a
                          href={item.driveViewUrl || driveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition"
                          title={item.driveViewUrl ? "Buka File di Google Drive" : "Buka Folder Google Drive"}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal Konfigurasi Database Google Drive & Google Sheets */}
      {isDriveDatabaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                  <Database className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                    <span>Integrasi Database Google Drive</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      Google Sheets
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Simpan berkas foto/scan TTB langsung ke Google Drive &amp; catat riwayatnya ke Google Sheets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDriveDatabaseModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center border-b border-border bg-muted/20 px-4 sm:px-5 shrink-0">
              <button
                type="button"
                onClick={() => setModalActiveTab('config')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  modalActiveTab === 'config'
                    ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Database className="size-3.5" />
                <span>Pengaturan &amp; Status Koneksi</span>
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('guide')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  modalActiveTab === 'guide'
                    ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code2 className="size-3.5" />
                <span>Panduan 1-Menit &amp; Salin Script (Code.gs)</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {modalActiveTab === 'config' ? (
                <div className="space-y-4">
                  {/* Status Card */}
                  <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-teal-500" />
                        Status Integrasi Database:
                      </span>
                      {driveScriptUrl ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Terhubung
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                          Mode Standalone (Cadangan Lokal Aktif)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {driveScriptUrl
                        ? 'Setiap berkas TTB yang diunggah akan otomatis disimpan ke Google Drive dan transaksi dicatat ke Spreadsheet Database secara real-time.'
                        : 'Saat ini berkas disimpan di server lokal & Vercel Blob. Masukkan Web App URL di bawah ini untuk menghubungkan langsung ke Google Drive & Sheets Anda.'}
                    </p>
                    {spreadsheetUrl && (
                      <div className="pt-1 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Database Google Sheets:</span>
                        <a
                          href={spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Buka Spreadsheet DATABASE_UPLOAD_TTB</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Input Form URL Google Apps Script */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center justify-between">
                      <span>URL Web App Google Apps Script</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        (Berakhiran /exec)
                      </span>
                    </label>
                    <input
                      type="url"
                      value={tempScriptUrl}
                      onChange={(e) => setTempScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      className="w-full h-10 px-3.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono text-foreground"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Dapatkan URL ini setelah melakukan Deploy Web App di script.google.com (lihat tab &quot;Panduan 1-Menit&quot;).
                    </p>
                  </div>

                  {/* Target Folder ID */}
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Target Folder ID Google Drive</label>
                    <div className="h-9 px-3 rounded-lg bg-muted/60 border border-border font-mono text-xs flex items-center text-muted-foreground">
                      {activeFolderId}
                    </div>
                  </div>

                  {/* Hasil Uji Koneksi */}
                  {testConnectionResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        testConnectionResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      {testConnectionResult.success ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold">{testConnectionResult.message}</div>
                        {testConnectionResult.latencyMs && (
                          <div className="text-[10px] opacity-80">
                            Waktu respons server Google: {testConnectionResult.latencyMs} ms
                          </div>
                        )}
                        {testConnectionResult.spreadsheetUrl && (
                          <div className="pt-1">
                            <a
                              href={testConnectionResult.spreadsheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold underline inline-flex items-center gap-1"
                            >
                              <span>Buka Google Spreadsheet Database</span>
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleTestDriveConnection}
                      disabled={isTestingDriveConnection || !tempScriptUrl.trim()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`size-3.5 ${isTestingDriveConnection ? 'animate-spin' : ''}`} />
                      <span>{isTestingDriveConnection ? 'Menguji Koneksi...' : 'Uji Koneksi Database'}</span>
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setTempScriptUrl('');
                          setDriveScriptUrl('');
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('cpg_drive_script_url');
                          }
                          showToast?.('URL dibersihkan.', 'info');
                        }}
                        className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground text-xs transition cursor-pointer"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDriveDatabaseConfig}
                        className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer shadow-xs active:scale-95"
                      >
                        Simpan Pengaturan
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Panduan 1-Menit */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">
                      Langkah Mudah Menghubungkan Google Drive &amp; Sheets (1 Menit):
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground leading-relaxed pl-1">
                      <li>
                        Buka{' '}
                        <a
                          href="https://script.google.com/home/start"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 dark:text-teal-400 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5"
                        >
                          script.google.com
                          <ExternalLink className="size-3" />
                        </a>{' '}
                        di browser dengan akun Google Anda.
                      </li>
                      <li>Klik <strong>&ldquo;New Project&rdquo;</strong> (Beri judul: <em>CPG TTB Drive Database</em>).</li>
                      <li>
                        Hapus kode bawaan, lalu klik tombol <strong>&ldquo;Salin Kode Script (Code.gs)&rdquo;</strong> di bawah dan tempel seluruh kodenya.
                      </li>
                      <li>
                        Klik tombol biru <strong>&ldquo;Deploy&rdquo;</strong> (kanan atas) &gt; pilih <strong>&ldquo;New deployment&rdquo;</strong>.
                      </li>
                      <li>
                        Klik icon Gear (⚙) di samping <em>Select type</em> &gt; pilih <strong>Web app</strong>.
                      </li>
                      <li>
                        Atur:
                        <ul className="list-disc list-inside pl-4 mt-0.5 space-y-0.5">
                          <li><strong>Execute as:</strong> Me (email Anda)</li>
                          <li><strong>Who has access:</strong> Anyone (agar dashboard dapat mengunggah berkas)</li>
                        </ul>
                      </li>
                      <li>
                        Klik <strong>Deploy</strong>, izinkan akses Google jika diminta, lalu salin <strong>Web app URL</strong> dan tempel di tab Pengaturan.
                      </li>
                    </ol>
                  </div>

                  {/* Kode Apps Script Viewer & Copy */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                        <Code2 className="size-3.5 text-teal-600" />
                        <span>Code.gs (Google Apps Script)</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyScriptCode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition cursor-pointer active:scale-95 shadow-xs"
                      >
                        {isCopiedScript ? (
                          <>
                            <Check className="size-3.5" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            <span>Salin Kode Script (1-Click)</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-xl bg-muted/80 border border-border font-mono text-[10px] leading-relaxed max-h-56 overflow-y-auto no-scrollbar text-foreground select-all">
                      {GOOGLE_APPS_SCRIPT_TEMPLATE}
                    </pre>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-border">
                    <a
                      href="https://script.google.com/home/start"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-foreground font-semibold transition"
                    >
                      <span>Buka Google Apps Script Editor</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setModalActiveTab('config')}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition cursor-pointer"
                    >
                      Lanjut ke Pengaturan URL &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

