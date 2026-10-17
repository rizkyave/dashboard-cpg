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
  Database,
  FileCheck,
  Sparkles,
  Trash2,
  User,
  FileSignature,
  PenTool,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import { sanitizeTtbNumber, formatTtbFilename, formatFileSize } from '@/utils/ttbRename';
import {
  convertSvgToPngDataUrl,
  formatTtbStampDate,
  stampTtbImageFile,
} from '@/utils/ttbStamper';

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
  noTtb: string;
  armada: string;
  isAutoMatched: boolean;
}

interface TtbSuggestion {
  noTtb: string;
  armada: string;
  noFpb?: string;
  description?: string;
}

/**
 * Mendeteksi Nomor TTB dan Armada secara cerdas dari nama berkas (contoh: "CPL-TTB-26-00449.pdf", "04975.jpg")
 */
function detectTtbAndArmada(
  fileName: string,
  suggestions: TtbSuggestion[] = []
): { noTtb: string; armada: string; isAutoMatched: boolean } {
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, '').trim();

  // 1. Ekstrak pola TTB: (CPL|SP|MO|HL|GAJ|MIL|SSK)?[-_\s]*T?TB[-_\s]*(?:(\d{2})[-_\s]+)?(\d{3,6})
  const ttbRegex = /(?:([A-Z]{2,4})[-_\s]*)?T?TB[-_\s]*(?:(\d{2})[-_\s]+)?(\d{3,6})/i;
  const match = baseName.match(ttbRegex);

  let rawDetectedTtb = '';
  let targetNumber = '';

  if (match) {
    const prefix = match[1] ? match[1].toUpperCase() : '';
    const yr = match[2] ? match[2].trim() : '';
    const num = match[3] ? match[3].padStart(5, '0') : '';
    targetNumber = match[3];

    if (prefix && yr) {
      rawDetectedTtb = `${prefix}-TTB-${yr}-${num}`;
    } else if (prefix) {
      rawDetectedTtb = `${prefix}-TTB ${num}`;
    } else {
      rawDetectedTtb = `TTB ${num}`;
    }
  } else {
    // Coba deteksi angka 4-6 digit mandiri (misal "04975.pdf" atau "Scan_04975.jpg")
    const numMatch = baseName.match(/\b\d{4,6}\b/);
    if (numMatch) {
      targetNumber = numMatch[0];
      rawDetectedTtb = `TTB ${targetNumber.padStart(5, '0')}`;
    }
  }

  // 2. Cocokkan targetNumber dengan ttbSuggestions (dari Sisa Layanan & Procurement)
  let matchedArmada = '';
  let finalNoTtb = rawDetectedTtb;

  if (targetNumber && suggestions.length > 0) {
    const padded = targetNumber.padStart(5, '0');
    const found = suggestions.find((s) => {
      const cleanS = s.noTtb.replace(/\D/g, '');
      return cleanS.endsWith(targetNumber) || cleanS.endsWith(padded);
    });

    if (found) {
      finalNoTtb = found.noTtb;
      matchedArmada = found.armada || '';
    }
  }

  return {
    noTtb: finalNoTtb,
    armada: matchedArmada,
    isAutoMatched: Boolean(finalNoTtb),
  };
}

export default function UploadTtbTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  showToast,
}: UploadTtbTabProps) {
  const { user } = useAuth();

  // Form State
  const [noTtbInput, setNoTtbInput] = useState<string>('');
  const [armadaInput, setArmadaInput] = useState<string>('');
  const [receivedDate, setReceivedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [keteranganInput, setKeteranganInput] = useState<string>('');
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload mode: 'batch' (Multi-TTB per berkas) atau 'single' (Satu TTB untuk semua berkas)
  const [uploadMode, setUploadMode] = useState<'batch' | 'single'>('batch');
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessResult, setUploadSuccessResult] = useState<UploadTtbResponse | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);

  // Auto-Stamp State (Tanda Tangan Digital & Identitas Uploader Otomatis)
  const [isAutoStampEnabled, setIsAutoStampEnabled] = useState<boolean>(true);
  const [userSignaturePng, setUserSignaturePng] = useState<string | null>(null);

  useEffect(() => {
    if (user?.signature?.signatureDataUrl) {
      convertSvgToPngDataUrl(user.signature.signatureDataUrl).then(setUserSignaturePng);
    } else {
      setUserSignaturePng(null);
    }
  }, [user?.signature?.signatureDataUrl]);

  // Cloudflare R2 Storage Connection Test State
  const [isTestingStorage, setIsTestingStorage] = useState<boolean>(false);
  const [storageTestResult, setStorageTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    bucket?: string;
  } | null>(null);

  // Autocomplete state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const autocompleteRef = useRef<HTMLDivElement | null>(null);

  // Upload History
  const [historyItems, setHistoryItems] = useState<UploadedTtbItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Uji koneksi ke Cloudflare R2 Storage
  const handleTestStorageConnection = async () => {
    setIsTestingStorage(true);
    try {
      const res = await fetch('/api/upload-ttb/test-connection');
      const data = await res.json();
      if (res.ok && data.success) {
        setStorageTestResult({
          success: true,
          message: data.message,
          latencyMs: data.latencyMs,
          bucket: data.bucket,
        });
        showToast?.(`Cloudflare Storage (${data.bucket || 'R2'}) terhubung! (${data.latencyMs}ms)`, 'success');
      } else {
        setStorageTestResult({
          success: false,
          message: data.error || 'Gagal terhubung ke Cloudflare R2.',
        });
        showToast?.(data.error || 'Gagal terhubung ke Cloudflare R2.', 'error');
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menguji koneksi.';
      setStorageTestResult({
        success: false,
        message: msg,
      });
      showToast?.(msg, 'error');
    } finally {
      setIsTestingStorage(false);
    }
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

  // Fetch riwayat upload dari Cloudflare R2
  const fetchUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/upload-ttb');
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setHistoryItems(data.items);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat upload:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hapus berkas dari Cloudflare R2 & riwayat
  const handleDeleteHistoryItem = async (item: UploadedTtbItem) => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus berkas "${item.renamedFileName}" dari Cloudflare Storage (R2)?`
    );
    if (!confirmDelete) return;

    setDeletingId(item.id);
    try {
      const res = await fetch(
        `/api/upload-ttb?id=${encodeURIComponent(item.id)}&key=${encodeURIComponent(item.r2Key || '')}&fileName=${encodeURIComponent(item.renamedFileName)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setHistoryItems((prev) => prev.filter((h) => h.id !== item.id));
        showToast?.(`Berkas "${item.renamedFileName}" berhasil dihapus dari Cloudflare R2!`, 'success');
      } else {
        showToast?.(data.error || 'Gagal menghapus berkas.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan saat menghapus berkas.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Sinkronisasi manual live dengan Cloudflare R2
  const handleForceSyncWithR2 = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/upload-ttb');
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setHistoryItems(data.items);
          showToast?.(`Sinkronisasi Cloudflare R2 berhasil! Total ${data.items.length} berkas aktif.`, 'success');
        }
      } else {
        showToast?.('Gagal menyinkronkan dengan Cloudflare R2.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan saat sinkronisasi Cloudflare R2.', 'error');
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

  // Tambahkan file ke antrean (dengan deteksi otomatis Nomor TTB & Armada per berkas)
  const addFilesToQueue = (files: FileList | File[]) => {
    const validFiles: QueuedFile[] = [];
    const arrayFiles = Array.from(files);

    for (const file of arrayFiles) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(ext);
      const isPdf = /\.pdf$/i.test(ext);

      if (!isImage && !isPdf) {
        showToast?.(
          `Format file "${file.name}" tidak didukung. Harap unggah foto JPG/PNG atau scan PDF.`,
          'warning'
        );
        continue;
      }

      const previewUrl = isImage ? URL.createObjectURL(file) : '';
      const detected = detectTtbAndArmada(file.name, ttbSuggestions);

      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        isImage,
        isPdf,
        noTtb: detected.noTtb || noTtbInput || '',
        armada: detected.armada || armadaInput || '',
        isAutoMatched: detected.isAutoMatched,
      });
    }

    if (validFiles.length > 0) {
      setQueuedFiles((prev) => [...prev, ...validFiles]);
      const autoCount = validFiles.filter((f) => f.isAutoMatched).length;
      if (autoCount > 0) {
        showToast?.(
          `Menambahkan ${validFiles.length} berkas (${autoCount} No. TTB otomatis terdeteksi).`,
          'success'
        );
      } else {
        showToast?.(`Menambahkan ${validFiles.length} berkas ke antrean.`, 'info');
      }
    }
  };

  // Update properti No. TTB atau Armada pada berkas tertentu di antrean
  const updateQueuedFile = (id: string, field: 'noTtb' | 'armada', value: string) => {
    setQueuedFiles((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'noTtb') {
            const cleanDigits = value.replace(/\D/g, '');
            if (cleanDigits.length >= 3 && !updated.armada) {
              const found = ttbSuggestions.find((s) => s.noTtb.replace(/\D/g, '').endsWith(cleanDigits));
              if (found && found.armada) {
                updated.armada = found.armada;
              }
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveFile = (id: string) => {
    setQueuedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleClearAllFiles = () => {
    queuedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFilename(text);
    showToast?.(`Teks disalin: ${text}`, 'info');
    setTimeout(() => setCopiedFilename(null), 2500);
  };

  // Submit Upload ke Cloudflare R2 (Mendukung Multi-TTB Batch & Single TTB)
  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (queuedFiles.length === 0) {
      showToast?.('Silakan pilih minimal 1 berkas foto atau dokumen PDF.', 'warning');
      return;
    }

    // MODE 1: MULTI-TTB BATCH UPLOAD (Setiap berkas menggunakan No. TTB masing-masing)
    if (uploadMode === 'batch') {
      const missingTtbFiles = queuedFiles.filter((f) => !f.noTtb.trim());
      if (missingTtbFiles.length > 0) {
        showToast?.(
          `Ada ${missingTtbFiles.length} berkas yang belum memiliki Nomor TTB. Harap lengkapi nomor TTB pada berkas yang bersangkutan.`,
          'warning'
        );
        return;
      }

      setIsUploading(true);
      setUploadSuccessResult(null);
      setUploadErrorMessage(null);

      const newlyUploaded: UploadedTtbItem[] = [];
      const failedFiles: string[] = [];

      for (let i = 0; i < queuedFiles.length; i++) {
        const qf = queuedFiles[i];
        const targetNoTtb = qf.noTtb.trim();
        const targetArmada = qf.armada.trim();

        setBatchProgress({
          current: i + 1,
          total: queuedFiles.length,
          currentFileName: `${qf.file.name} → ${targetNoTtb}`,
        });

        try {
          const formData = new FormData();
          formData.append('noTtb', targetNoTtb);
          formData.append('armada', targetArmada);
          formData.append('receivedDate', receivedDate);
          formData.append('keterangan', keteranganInput.trim());

          let fileToUpload = qf.file;
          if (isAutoStampEnabled && qf.isImage) {
            try {
              fileToUpload = await stampTtbImageFile({
                imageFile: qf.file,
                signaturePngDataUrl: userSignaturePng || undefined,
                uploaderName: user?.name || 'DAVILA ZALIANTI PUTRI',
                uploadDate: formatTtbStampDate(receivedDate),
              });
            } catch (err) {
              console.warn('Gagal stempel gambar client, upload berkas asli:', err);
            }
          }
          formData.append('files', fileToUpload);

          if (user?.name) formData.append('uploaderName', user.name);
          if (user?.username) formData.append('uploaderUsername', user.username);
          if (user?.role) formData.append('uploaderRole', user.role);
          if (user?.nik) formData.append('uploaderNik', user.nik);
          if (user?.jabatan) formData.append('uploaderJabatan', user.jabatan);

          formData.append('autoStamp', isAutoStampEnabled ? 'true' : 'false');
          if (isAutoStampEnabled) {
            if (userSignaturePng) formData.append('signatureDataUrl', userSignaturePng);
            formData.append('stampDate', formatTtbStampDate(receivedDate));
          }

          const res = await fetch('/api/upload-ttb', {
            method: 'POST',
            body: formData,
          });

          const data: UploadTtbResponse = await res.json();
          if (res.ok && data.success && data.uploadedFiles && data.uploadedFiles.length > 0) {
            newlyUploaded.push(...data.uploadedFiles);
          } else {
            failedFiles.push(`"${qf.file.name}" (${targetNoTtb}): ${data.message || data.error || 'Gagal'}`);
          }
        } catch (err) {
          failedFiles.push(`"${qf.file.name}": ${(err as Error).message}`);
        }
      }

      setIsUploading(false);
      setBatchProgress(null);

      if (newlyUploaded.length > 0) {
        setHistoryItems((prev) => [...newlyUploaded, ...prev]);

        // Simpan status TTB di localStorage
        try {
          const uploadedList = JSON.parse(localStorage.getItem('cpg_uploaded_ttb_list') || '[]');
          newlyUploaded.forEach((u) => uploadedList.push(sanitizeTtbNumber(u.noTtb)));
          localStorage.setItem('cpg_uploaded_ttb_list', JSON.stringify(Array.from(new Set(uploadedList))));
        } catch {
          // Non-fatal
        }

        setUploadSuccessResult({
          success: true,
          message: `Sukses! Berhasil mengunggah ${newlyUploaded.length} dari ${queuedFiles.length} berkas ke Cloudflare R2 sesuai Nomor TTB masing-masing.`,
          storageProvider: 'CLOUDFLARE_R2',
          uploadedFiles: newlyUploaded,
        });

        showToast?.(
          `Berhasil mengunggah ${newlyUploaded.length} berkas TTB ke Cloudflare R2!`,
          'success'
        );

        // Bersihkan berkas yang sukses dari antrean
        const successOriginalNames = new Set(newlyUploaded.map((u) => u.originalFileName));
        setQueuedFiles((prev) => {
          prev.forEach((f) => {
            if (successOriginalNames.has(f.file.name) && f.previewUrl) {
              URL.revokeObjectURL(f.previewUrl);
            }
          });
          return prev.filter((f) => !successOriginalNames.has(f.file.name));
        });
      }

      if (failedFiles.length > 0) {
        const errorMsg = `Sebagian berkas mengalami kendala upload (${failedFiles.length} gagal):\n${failedFiles.join('\n')}`;
        setUploadErrorMessage(errorMsg);
        showToast?.(errorMsg, 'error');
      }

      return;
    }

    // MODE 2: SATU TTB UNTUK SEMUA BERKAS (Single TTB Mode)
    if (!noTtbInput.trim()) {
      showToast?.('Nomor TTB wajib diisi.', 'warning');
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
      if (user?.name) formData.append('uploaderName', user.name);
      if (user?.username) formData.append('uploaderUsername', user.username);
      if (user?.role) formData.append('uploaderRole', user.role);
      if (user?.nik) formData.append('uploaderNik', user.nik);
      if (user?.jabatan) formData.append('uploaderJabatan', user.jabatan);

      formData.append('autoStamp', isAutoStampEnabled ? 'true' : 'false');
      if (isAutoStampEnabled) {
        if (userSignaturePng) formData.append('signatureDataUrl', userSignaturePng);
        formData.append('stampDate', formatTtbStampDate(receivedDate));
      }

      for (const qf of queuedFiles) {
        let fileToUpload = qf.file;
        if (isAutoStampEnabled && qf.isImage) {
          try {
            fileToUpload = await stampTtbImageFile({
              imageFile: qf.file,
              signaturePngDataUrl: userSignaturePng || undefined,
              uploaderName: user?.name || 'DAVILA ZALIANTI PUTRI',
              uploadDate: formatTtbStampDate(receivedDate),
            });
          } catch (err) {
            console.warn('Gagal stempel gambar single mode:', err);
          }
        }
        formData.append('files', fileToUpload);
      }

      const res = await fetch('/api/upload-ttb', {
        method: 'POST',
        body: formData,
      });

      let data: UploadTtbResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error('Gagal terhubung ke server penyimpanan Cloudflare.');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Gagal mengunggah berkas.');
      }

      // Success
      setUploadSuccessResult(data);
      setUploadErrorMessage(null);
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

      try {
        const uploadedList = JSON.parse(localStorage.getItem('cpg_uploaded_ttb_list') || '[]');
        uploadedList.push(sanitizeTtbNumber(noTtbInput));
        localStorage.setItem('cpg_uploaded_ttb_list', JSON.stringify(Array.from(new Set(uploadedList))));
      } catch {
        // Non-fatal
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal mengunggah berkas ke Cloudflare Storage.';
      setUploadErrorMessage(msg);
      showToast?.(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter history search
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter((item) => {
      return (
        item.noTtb.toLowerCase().includes(q) ||
        item.armada.toLowerCase().includes(q) ||
        item.renamedFileName.toLowerCase().includes(q) ||
        item.originalFileName.toLowerCase().includes(q) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(q)) ||
        (item.uploaderName && item.uploaderName.toLowerCase().includes(q)) ||
        (item.uploaderUsername && item.uploaderUsername.toLowerCase().includes(q)) ||
        (item.uploaderNik && item.uploaderNik.toLowerCase().includes(q)) ||
        (item.uploaderJabatan && item.uploaderJabatan.toLowerCase().includes(q))
      );
    });
  }, [historyItems, historySearch]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <UploadCloud className="size-5" />
              </span>
              <h1 className="text-lg md:text-xl font-bold text-foreground">
                Upload &amp; Arsip Dokumen TTB
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Cloudflare Storage (R2)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                Auto-Rename Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
                Bucket: cpg-storage
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              Unggah berkas bukti tanda terima barang (TTB) fisik atau scan dokumen lapangan (PDF / Foto). 
              Sistem secara otomatis akan mengganti nama file ke format resmi{' '}
              <code className="text-teal-600 dark:text-teal-400 font-mono font-semibold bg-teal-500/10 px-1 py-0.5 rounded">
                [NO_TTB].[ekstensi]
              </code>{' '}
              dan menyimpannya langsung ke database <strong>Cloudflare Storage (R2)</strong> secara terenkripsi dan permanen.
            </p>
          </div>

          {/* Tombol Akses Cepat Cloudflare Storage */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleTestStorageConnection}
              disabled={isTestingStorage}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 active:scale-95 text-orange-700 dark:text-orange-300 text-xs md:text-sm font-semibold transition shadow-xs cursor-pointer"
              title="Uji Koneksi Langsung ke Cloudflare R2"
            >
              <Database className={`size-4 shrink-0 ${isTestingStorage ? 'animate-spin' : ''}`} />
              <span>{isTestingStorage ? 'Menguji Koneksi...' : 'Uji Koneksi Storage'}</span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </button>

            <button
              type="button"
              onClick={fetchUploadHistory}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              title="Segarkan Riwayat"
            >
              <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Koneksi Storage Real-time jika diuji */}
        {storageTestResult && (
          <div className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in-50 duration-200 ${
            storageTestResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {storageTestResult.success ? (
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="size-4 text-rose-600 shrink-0" />
              )}
              <span>{storageTestResult.message}</span>
              {storageTestResult.latencyMs !== undefined && (
                <span className="font-mono text-[11px] opacity-75">
                  ({storageTestResult.latencyMs} ms)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStorageTestResult(null)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Error Banner */}
      {uploadErrorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 md:p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                <AlertCircle className="size-5" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm md:text-base font-bold text-rose-900 dark:text-rose-100">
                  Kendala Upload Berkas
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                  {uploadErrorMessage}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pastikan koneksi internet stabil dan kredensial Cloudflare R2 sudah aktif di environment variables.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUploadErrorMessage(null)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer self-end sm:self-start"
              title="Tutup Pesan Error"
            >
              <X className="size-4" />
            </button>
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
                  Berkas telah diproses, diganti nama sesuai Nomor TTB resmi, dan tersimpan aman di Cloudflare Storage (R2).
                </p>

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
                        <a
                          href={uf.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-teal-600 transition"
                          title="Buka / Preview Berkas"
                        >
                          <Eye className="size-3" />
                        </a>
                        <a
                          href={`${uf.fileUrl}&download=true`}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600 transition"
                          title="Unduh Berkas dari Cloudflare Storage"
                        >
                          <Download className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUploadSuccessResult(null)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer self-end sm:self-start"
              title="Tutup Notifikasi"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mode Switcher Bar */}
      <div className="bg-card border border-border rounded-2xl p-2.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setUploadMode('batch')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              uploadMode === 'batch'
                ? 'bg-background text-teal-600 dark:text-teal-400 shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5 text-teal-500" />
            <span>Multi-TTB / Batch (Auto-Detect)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono font-medium">
              Rekomendasi
            </span>
          </button>

          <button
            type="button"
            onClick={() => setUploadMode('single')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              uploadMode === 'single'
                ? 'bg-background text-teal-600 dark:text-teal-400 shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-3.5" />
            <span>Satu TTB (Single)</span>
          </button>
        </div>

        <div className="text-[11px] text-muted-foreground px-2 flex items-center gap-1.5">
          <Info className="size-3.5 text-teal-500 shrink-0" />
          {uploadMode === 'batch' ? (
            <span>
              Nomor TTB &amp; Armada otomatis terdeteksi per berkas. Tiap berkas disimpan di Cloudflare R2 sesuai nomor TTB aslinya.
            </span>
          ) : (
            <span>
              Unggah berkas foto/scan di mana semua berkas menggunakan satu Nomor TTB yang sama.
            </span>
          )}
        </div>
      </div>

      {/* Datalist bantuan untuk autocomplete instan pada input batch */}
      <datalist id="ttb-batch-suggestions">
        {ttbSuggestions.slice(0, 100).map((sug, idx) => (
          <option key={idx} value={sug.noTtb}>
            {sug.armada ? `${sug.armada} - ${sug.description || ''}` : sug.description || ''}
          </option>
        ))}
      </datalist>

      <datalist id="armada-batch-suggestions">
        {Array.from(new Set(ttbSuggestions.map((s) => s.armada).filter(Boolean))).map((arm, idx) => (
          <option key={idx} value={arm} />
        ))}
      </datalist>

      {/* 4. Form Upload Berkas (Mendukung Multi-TTB Batch & Single TTB) */}
      <form onSubmit={handleSubmitUpload} className="space-y-6">
        {/* Card Auto-Stamp Tanda Tangan & Identitas Uploader */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs relative overflow-hidden transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`size-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isAutoStampEnabled
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                <FileSignature className="size-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-foreground">
                    Auto-Stamp Tanda Tangan Digital &amp; Tanggal Dokumen
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Check className="size-2.5" />
                    <span>Format SOP CPL-PRC-SOP-004-F02</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Otomatis mengisi tanda tangan Anda di kolom <em>&quot;Delivered By : Logistic Staff&quot;</em>, nama di <em>&quot;Name :&quot;</em>, dan tanggal di <em>&quot;Date :&quot;</em> saat berkas diunggah.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
              <span className={`text-xs font-semibold ${isAutoStampEnabled ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'}`}>
                {isAutoStampEnabled ? 'Auto-Stamp Aktif' : 'Nonaktif'}
              </span>
              <button
                type="button"
                onClick={() => setIsAutoStampEnabled(!isAutoStampEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                  isAutoStampEnabled ? 'bg-teal-600' : 'bg-muted border border-border'
                }`}
                title="Aktifkan / Nonaktifkan Auto-Stamp TTD & Tanggal pada Dokumen TTB"
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white shadow-md transition-transform ${
                    isAutoStampEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Detail Pratinjau Spesimen saat Auto-Stamp Aktif */}
          {isAutoStampEnabled && (
            <div className="mt-4 pt-3.5 border-t border-border/70 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Tanda Tangan */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="size-10 rounded-lg border border-border bg-background p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  {userSignaturePng || user?.signature?.signatureDataUrl ? (
                    <img
                      src={userSignaturePng || user?.signature?.signatureDataUrl}
                      alt="Spesimen TTD"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <PenTool className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-mono font-semibold uppercase">
                    Delivered By (TTD)
                  </p>
                  <p className="font-semibold text-foreground text-xs truncate">
                    {user?.signature?.certificateId ? 'Spesimen Terverifikasi' : 'TTD Default Sistem'}
                  </p>
                </div>
              </div>

              {/* 2. Nama Uploader */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="size-10 rounded-lg border border-border bg-background flex items-center justify-center shrink-0 text-foreground font-mono font-bold text-xs">
                  {(user?.name || 'DAVILA ZALIANTI PUTRI')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-mono font-semibold uppercase">
                    Name : (Logistic Staff)
                  </p>
                  <p className="font-bold text-foreground text-xs truncate" title={user?.name || 'DAVILA ZALIANTI PUTRI'}>
                    {user?.name || 'DAVILA ZALIANTI PUTRI'}
                  </p>
                </div>
              </div>

              {/* 3. Tanggal Upload */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="size-10 rounded-lg border border-border bg-background flex items-center justify-center shrink-0 text-teal-600 dark:text-teal-400">
                  <Calendar className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-mono font-semibold uppercase">
                    Date : (Tanggal Stempel)
                  </p>
                  <p className="font-mono font-bold text-foreground text-xs">
                    {formatTtbStampDate(receivedDate)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {uploadMode === 'batch' ? (
          /* ========================================================================= */
          /* MODE 1: MULTI-TTB BATCH UPLOAD (Setiap Berkas Punya No. TTB Masing-Masing)  */
          /* ========================================================================= */
          <div className="space-y-5">
            {/* Dropzone Multi-TTB */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 md:p-9 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3.5 ${
                isDragging
                  ? 'border-teal-500 bg-teal-500/10 scale-[1.005]'
                  : 'border-border/80 hover:border-teal-500/60 bg-card hover:bg-muted/30 shadow-xs'
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

              <div className="size-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
                <UploadCloud className="size-7" />
              </div>

              <div className="space-y-1.5 max-w-xl">
                <p className="text-sm md:text-base font-bold text-foreground">
                  Tarik &amp; lepas berkas dokumen scan PDF atau foto di sini, atau{' '}
                  <span className="text-teal-600 dark:text-teal-400 underline underline-offset-4">
                    pilih dari komputer
                  </span>
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Unggah beberapa file sekaligus dengan nomor TTB berbeda (misal 5 berkas sekaligus). Sistem secara otomatis membaca nomor TTB dari nama file (contoh:{' '}
                  <code className="text-teal-600 dark:text-teal-400 font-mono font-semibold">CPL-TTB-26-00449.pdf</code> atau{' '}
                  <code className="text-teal-600 dark:text-teal-400 font-mono font-semibold">04975.jpg</code>) dan mencocokkan armadanya.
                </p>
              </div>
            </div>

            {/* Antrean Berkas Batch */}
            {queuedFiles.length > 0 ? (
              <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-teal-600 dark:text-teal-400" />
                      <h3 className="text-sm md:text-base font-bold text-foreground">
                        Daftar Berkas Batch ({queuedFiles.length} berkas)
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Periksa &amp; sesuaikan Nomor TTB serta Armada untuk masing-masing berkas di bawah sebelum diunggah.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAllFiles}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-medium px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer self-start sm:self-center"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Hapus Semua Antrean</span>
                  </button>
                </div>

                {/* List Berkas Batch */}
                <div className="space-y-3">
                  {queuedFiles.map((qf, index) => {
                    const cleanTtb = sanitizeTtbNumber(qf.noTtb);
                    const targetPreviewName = qf.isPdf
                      ? (cleanTtb ? `${cleanTtb}.pdf` : `[NO_TTB].pdf`)
                      : (cleanTtb ? `${qf.armada ? `${qf.armada}_` : ''}${cleanTtb}.jpg` : `[NO_TTB].jpg`);

                    return (
                      <div
                        key={qf.id}
                        className="bg-muted/20 hover:bg-muted/40 border border-border rounded-xl p-3.5 md:p-4 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs font-bold text-muted-foreground size-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                              #{index + 1}
                            </span>

                            {/* Thumbnail / PDF Icon */}
                            <div className="size-10 rounded-lg overflow-hidden bg-background border border-border flex items-center justify-center shrink-0">
                              {qf.isImage && qf.previewUrl ? (
                                <img src={qf.previewUrl} alt={qf.file.name} className="w-full h-full object-cover" />
                              ) : (
                                <FileText className="size-5 text-rose-500" />
                              )}
                            </div>

                            {/* Filename & size */}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-foreground truncate max-w-xs md:max-w-md" title={qf.file.name}>
                                {qf.file.name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                <span>{formatFileSize(qf.file.size)}</span>
                                <span>&bull;</span>
                                <span className={qf.isPdf ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-blue-600 dark:text-blue-400 font-semibold'}>
                                  {qf.isPdf ? 'Dokumen Scan PDF' : 'Foto Serah Terima'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badges & Delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            {qf.isAutoMatched && qf.noTtb ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                <Sparkles className="size-3 text-emerald-500" />
                                Auto-Detect
                              </span>
                            ) : qf.noTtb ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                Manual
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 animate-pulse">
                                <AlertCircle className="size-3 text-rose-500" />
                                TTB Belum Diisi
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveFile(qf.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus berkas ini dari antrean"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        </div>

                        {/* Editable Fields Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          {/* No TTB Input */}
                          <div className="md:col-span-5 space-y-1">
                            <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                              <span>
                                Nomor TTB Berkas Ini <span className="text-rose-500">*</span>
                              </span>
                              <span className="text-[10px] text-muted-foreground font-normal">Ketik atau pilih saran</span>
                            </label>
                            <input
                              type="text"
                              list="ttb-batch-suggestions"
                              value={qf.noTtb}
                              onChange={(e) => updateQueuedFile(qf.id, 'noTtb', e.target.value)}
                              placeholder="Contoh: 04975 atau CPL-TTB 04975"
                              className={`w-full px-3 py-2 text-xs rounded-xl bg-background border transition font-mono ${
                                !qf.noTtb.trim()
                                  ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                  : 'border-border focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
                              }`}
                            />
                          </div>

                          {/* Armada Input */}
                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                              <Ship className="size-3 text-muted-foreground" />
                              <span>Armada / Departemen</span>
                            </label>
                            <input
                              type="text"
                              list="armada-batch-suggestions"
                              value={qf.armada}
                              onChange={(e) => updateQueuedFile(qf.id, 'armada', e.target.value)}
                              placeholder="Contoh: SPOB SEA LION"
                              className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                            />
                          </div>

                          {/* Rename Output Target */}
                          <div className="md:col-span-3 space-y-1">
                            <span className="text-[11px] text-muted-foreground block font-medium">Output Cloudflare:</span>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2.5 py-2 rounded-xl border border-teal-500/20 truncate">
                              <ArrowRight className="size-3 shrink-0 text-teal-500" />
                              <span className="truncate">{targetPreviewName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Shared Metadata & Catatan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span>Tanggal Serah Terima (Serentak)</span>
                    </label>
                    <input
                      type="date"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Keterangan / Catatan Serah Terima (Opsional)</label>
                    <input
                      type="text"
                      value={keteranganInput}
                      onChange={(e) => setKeteranganInput(e.target.value)}
                      placeholder="Catatan kondisi serah terima, nama penerima lapangan, dll."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition placeholder:text-muted-foreground/60"
                    />
                  </div>
                </div>

                {/* Batch Progress Bar during upload */}
                {batchProgress && (
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 space-y-2 animate-in fade-in-50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-2">
                        <RefreshCw className="size-3.5 animate-spin text-teal-600" />
                        Mengunggah ke Cloudflare R2 ({batchProgress.current} dari {batchProgress.total} berkas)
                      </span>
                      <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                        {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-teal-950/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80 font-mono truncate">
                      Sedang memproses: {batchProgress.currentFileName}
                    </p>
                  </div>
                )}

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Total: <strong className="text-foreground">{queuedFiles.length} berkas</strong> (
                      {formatFileSize(queuedFiles.reduce((acc, f) => acc + f.file.size, 0))})
                    </div>
                    {queuedFiles.some((f) => !f.noTtb.trim()) && (
                      <div className="text-rose-500 font-semibold text-[11px] flex items-center gap-1">
                        <AlertCircle className="size-3" />
                        <span>Ada {queuedFiles.filter((f) => !f.noTtb.trim()).length} berkas yang belum memiliki Nomor TTB.</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || queuedFiles.length === 0 || queuedFiles.some((f) => !f.noTtb.trim())}
                    className={`px-6 py-2.5 rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer ${
                      isUploading || queuedFiles.length === 0 || queuedFiles.some((f) => !f.noTtb.trim())
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                        : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/20'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        <span>Menyimpan ke Cloudflare R2...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-4" />
                        <span>
                          Unggah Semua Berkas ({queuedFiles.length}) ke Cloudflare R2
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-center text-xs text-muted-foreground">
                Belum ada berkas dalam antrean. Tarik dan lepas berkas di area atas untuk memulai upload Multi-TTB.
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* MODE 2: SATU TTB (Single TTB - Semua Berkas Menggunakan 1 Nomor TTB)       */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Kolom Kiri: Metadata Form (5 Kolom) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-3 border-b border-border">
                  <FileText className="size-4 text-teal-600 dark:text-teal-400" />
                  <h2 className="text-sm font-bold text-foreground">Data Identitas TTB</h2>
                </div>

                {/* Field Nomor TTB dengan Autocomplete */}
                <div className="space-y-1.5 relative" ref={autocompleteRef}>
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      Nomor TTB <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Ketik untuk saran otomatis
                    </span>
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
                      onFocus={() => setIsAutocompleteOpen(true)}
                      placeholder="Contoh: 04975 atau CPL-TTB 04975"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition placeholder:text-muted-foreground/60 font-mono"
                    />
                    {noTtbInput && (
                      <button
                        type="button"
                        onClick={() => setNoTtbInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {isAutocompleteOpen && filteredSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto no-scrollbar">
                      <div className="p-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border flex items-center gap-1.5">
                        <Sparkles className="size-3 text-teal-500" />
                        <span>Ditemukan {filteredSuggestions.length} data TTB:</span>
                      </div>
                      {filteredSuggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectSuggestion(sug)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition flex flex-col gap-0.5 border-b border-border/40 last:border-0 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-foreground">
                              {sug.noTtb}
                            </span>
                            {sug.armada && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium">
                                {sug.armada}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {sug.description || sug.noFpb || 'Data TTB Sistem'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Field Armada / Peruntukan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Ship className="size-3.5 text-muted-foreground" />
                    <span>Armada / Departemen (Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={armadaInput}
                    onChange={(e) => setArmadaInput(e.target.value)}
                    placeholder="Contoh: SPOB SEA LION, WORKSHOP 01"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Field Tanggal Terima */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>Tanggal Serah Terima</span>
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition"
                  />
                </div>

                {/* Field Keterangan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Keterangan / Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    value={keteranganInput}
                    onChange={(e) => setKeteranganInput(e.target.value)}
                    placeholder="Catatan kondisi serah terima, nama penerima lapangan, dll."
                    className="w-full p-3 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition placeholder:text-muted-foreground/60 resize-none"
                  />
                </div>

                {/* Info Card Cloudflare Storage */}
                <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-[11px] space-y-1.5 text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Database className="size-3.5 text-orange-500" />
                    <span>Penyimpanan Berkas: Cloudflare Storage (R2)</span>
                  </div>
                  <div className="text-[10px] space-y-0.5 leading-relaxed">
                    <div>&bull; <strong>ttb-documents/</strong>: Berkas dokumen scan PDF resmi</div>
                    <div>&bull; <strong>ttb-photos/</strong>: Foto bukti fisik (langsung masuk ke Galeri Foto TTB)</div>
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
                        <span>Menyimpan ke Cloudflare R2...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-4" />
                        <span>
                          Unggah ke Cloudflare Storage ({queuedFiles.length || 0})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* 5. Tabel Riwayat Upload Dokumen TTB */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="space-y-0.5">
            <h2 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2">
              <Database className="size-4 text-orange-500" />
              <span>Riwayat Berkas TTB Terunggah (Cloudflare Storage)</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Daftar seluruh berkas foto dan scan dokumen TTB yang telah di-rename dan tersimpan di bucket Cloudflare R2.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari TTB / Armada / File..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground transition"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleForceSyncWithR2}
              disabled={isLoadingHistory}
              className="h-8 px-3 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Sinkronkan live dengan Cloudflare R2 (membersihkan berkas yang telah dihapus)"
            >
              <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin text-teal-600' : ''}`} />
              <span>Sinkronkan R2</span>
            </button>

            <button
              type="button"
              onClick={fetchUploadHistory}
              disabled={isLoadingHistory}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Segarkan Riwayat"
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
                <th className="py-2.5 px-3">Nama Berkas Resmi TTB</th>
                <th className="py-2.5 px-3">Ukuran</th>
                <th className="py-2.5 px-3">Penyimpanan</th>
                <th className="py-2.5 px-3">Waktu Upload</th>
                <th className="py-2.5 px-3">Pengunggah (Uploader)</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                        <Database className="size-3" />
                        <span>Cloudflare R2</span>
                      </span>
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
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 max-w-[240px]">
                        <div
                          className={`size-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-xs ${
                            item.uploaderRole === 'admin'
                              ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                              : item.uploaderRole === 'staf_lapangan'
                              ? 'bg-linear-to-tr from-amber-600 to-emerald-600'
                              : 'bg-linear-to-tr from-blue-600 to-cyan-600'
                          }`}
                        >
                          {(item.uploaderName || item.uploaderUsername || 'D')[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="font-semibold text-foreground text-xs truncate"
                              title={item.uploaderName || 'DAVILA ZALIANTI PUTRI'}
                            >
                              {item.uploaderName || 'DAVILA ZALIANTI PUTRI'}
                            </span>
                            {item.isAutoStamped && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0"
                                title="Dokumen ini otomatis tertandatangani digital & tercetak nama/tanggal resmi"
                              >
                                <FileSignature className="size-2.5" />
                                <span>Auto-Signed</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                            {item.uploaderNik ? (
                              <span className="px-1 py-0.2 rounded font-mono font-medium bg-muted text-foreground/80 border border-border">
                                {item.uploaderNik}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground">
                                @{item.uploaderUsername || 'davila.zalianti'}
                              </span>
                            )}
                            <span className="text-muted-foreground/40">&bull;</span>
                            <span
                              className="truncate text-muted-foreground"
                              title={item.uploaderJabatan || 'Admin Logistik'}
                            >
                              {item.uploaderJabatan || 'Admin Logistik'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-teal-600 transition"
                          title="Buka / Preview Berkas"
                        >
                          <Eye className="size-3.5" />
                        </a>
                        <a
                          href={`${item.fileUrl}&download=true`}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Unduh Berkas dari Cloudflare Storage"
                        >
                          <Download className="size-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg border border-border hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition disabled:opacity-40 cursor-pointer"
                          title="Hapus berkas dari Cloudflare Storage & riwayat"
                        >
                          {deletingId === item.id ? (
                            <RefreshCw className="size-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="size-3.5 text-rose-500 hover:text-rose-600" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
