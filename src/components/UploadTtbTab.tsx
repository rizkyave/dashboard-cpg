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
  ChevronLeft,
  ChevronRight,
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
  PackageCheck,
  FileSpreadsheet,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import {
  sanitizeTtbNumber,
  formatTtbFilename,
  formatFileSize,
  extractTtbComponents,
} from '@/utils/ttbRename';
import {
  convertSvgToPngDataUrl,
  formatTtbStampDate,
  stampTtbImageFile,
} from '@/utils/stampDateFormatter';
import { optimizeAndScaleImage, formatByteSize } from '@/utils/imageCompressor';

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
  doNo: string;
  noFpb: string;
  isAutoMatched: boolean;
  originalSize?: number;
  compressedSize?: number;
  savingsPercent?: number;
  isOptimized?: boolean;
}

interface TtbSuggestion {
  noTtb: string;
  armada: string;
  noFpb?: string;
  doNo?: string;
  description?: string;
}

/**
 * Mendeteksi Nomor TTB, Armada, dan No. FPB/PO secara cerdas dan presisi dari nama berkas dan dataset.
 */
function detectTtbAndArmada(
  fileName: string,
  suggestions: TtbSuggestion[] = []
): { noTtb: string; armada: string; doNo: string; noFpb: string; isAutoMatched: boolean } {
  const components = extractTtbComponents(fileName);

  let finalNoTtb = components.canonicalTtb || '';
  let matchedArmada = '';
  let matchedDoNo = '';
  let matchedNoFpb = '';

  const filePrefix = components.prefix;
  const targetNumber = components.number || components.rawNumber;

  if (targetNumber && suggestions.length > 0) {
    const padded = targetNumber.padStart(5, '0');

    if (filePrefix) {
      // Cari saran dengan prefix dan nomor urut yang sama
      const exactMatch = suggestions.find((s) => {
        const sComp = extractTtbComponents(s.noTtb);
        if (sComp.prefix && sComp.prefix !== filePrefix) return false;
        const cleanS = s.noTtb.replace(/\D/g, '');
        return cleanS.endsWith(targetNumber) || cleanS.endsWith(padded);
      });

      if (exactMatch) {
        finalNoTtb = exactMatch.noTtb || finalNoTtb;
        matchedArmada = exactMatch.armada || '';
        matchedDoNo = exactMatch.doNo || '';
        matchedNoFpb = exactMatch.noFpb || '';
      }
    } else {
      const lowerFileName = fileName.toLowerCase();
      const candidates = suggestions.filter((s) => {
        const cleanS = s.noTtb.replace(/\D/g, '');
        return cleanS.endsWith(targetNumber) || cleanS.endsWith(padded);
      });

      if (candidates.length > 0) {
        const matchWithArmada = candidates.find(
          (c) => c.armada && lowerFileName.includes(c.armada.toLowerCase())
        );
        const best = matchWithArmada || candidates[0];
        finalNoTtb = best.noTtb || finalNoTtb;
        matchedArmada = best.armada || '';
        matchedDoNo = best.doNo || '';
        matchedNoFpb = best.noFpb || '';
      }
    }
  }

  // Fallback pencocokan Armada dari teks nama berkas
  if (!matchedArmada && suggestions.length > 0) {
    const lowerFileName = fileName.toLowerCase();
    const uniqueArmadas = Array.from(
      new Set(suggestions.map((s) => (s.armada || '').trim()).filter(Boolean))
    );
    uniqueArmadas.sort((a, b) => b.length - a.length);

    for (const arm of uniqueArmadas) {
      if (arm.length >= 3 && lowerFileName.includes(arm.toLowerCase())) {
        matchedArmada = arm;
        break;
      }
    }
  }

  return {
    noTtb: finalNoTtb,
    armada: matchedArmada,
    doNo: matchedDoNo,
    noFpb: matchedNoFpb,
    isAutoMatched: Boolean(finalNoTtb),
  };
}

export default function UploadTtbTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  showToast,
}: UploadTtbTabProps) {
  const { user, isAdmin } = useAuth();
  const canEdit = user?.role !== 'visitor';

  // State Form Konfigurasi Metadata (Batch Default)
  const [batchNoTtb, setBatchNoTtb] = useState<string>('');
  const [batchArmada, setBatchArmada] = useState<string>('');
  const [batchDoNo, setBatchDoNo] = useState<string>('');
  const [batchReceivedDate, setBatchReceivedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [batchKeterangan, setBatchKeterangan] = useState<string>('');

  // Identitas Uploader & Auto-Stamp
  const [uploaderName, setUploaderName] = useState<string>('');
  const [enableAutoStamp, setEnableAutoStamp] = useState<boolean>(true);
  const [userSignaturePng, setUserSignaturePng] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name && !uploaderName) {
      setUploaderName(user.name);
    }
  }, [user?.name, uploaderName]);

  useEffect(() => {
    if (user?.signature?.signatureDataUrl) {
      convertSvgToPngDataUrl(user.signature.signatureDataUrl).then(setUserSignaturePng);
    } else {
      setUserSignaturePng(null);
    }
  }, [user?.signature?.signatureDataUrl]);

  // Antrean Berkas (Queue)
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Status Upload
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Riwayat Pengarsipan (History)
  const [history, setHistory] = useState<UploadedTtbItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [searchHistory, setSearchHistory] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal State
  const [activePreview, setActivePreview] = useState<UploadedTtbItem | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);

  // Cloudflare Storage Connection Test State
  const [isTestingStorage, setIsTestingStorage] = useState<boolean>(false);

  // Buat database saran nomor TTB dari dataset pengadaan & sisa layanan
  const ttbSuggestions = useMemo<TtbSuggestion[]>(() => {
    const map = new Map<string, TtbSuggestion>();

    // 1. Dari Sisa Layanan
    for (const item of sisaLayananItems) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        if (!map.has(key)) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.departement || item.pt || '',
            noFpb: item.noFpb || '',
            doNo: item.noPo || '',
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
            doNo: item.po || '',
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
            doNo: item.noPo || '',
            description: item.item || '',
          });
        }
      }
    }

    return Array.from(map.values());
  }, [procurementItems, armadaItems, sisaLayananItems]);

  // Fetch riwayat upload dari Cloudflare R2
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/upload-ttb');
      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setHistory(data.items);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat upload TTB:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Uji koneksi ke Cloudflare R2 Storage
  const handleTestStorageConnection = async () => {
    setIsTestingStorage(true);
    try {
      const res = await fetch('/api/upload-ttb/test-connection');
      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(
          `Cloudflare Storage (${data.bucket || 'R2'}) terhubung! Latensi: ${data.latencyMs || 0}ms`,
          'success'
        );
      } else {
        showToast?.(data.error || 'Gagal terhubung ke Cloudflare R2.', 'error');
      }
    } catch (err) {
      showToast?.((err as Error).message || 'Gagal menguji koneksi.', 'error');
    } finally {
      setIsTestingStorage(false);
    }
  };

  // Helper cek duplikat TTB terhadap riwayat
  const checkTtbDuplicate = (noTtb: string, fileName: string) => {
    const targetNo = sanitizeTtbNumber(noTtb.trim() || batchNoTtb.trim());
    if (!targetNo) return null;
    return (
      history.find((h) => {
        const cleanH = sanitizeTtbNumber(h.noTtb || h.cleanNoTtb || '');
        if (cleanH && cleanH === targetNo) return true;
        if (
          h.renamedFileName &&
          (h.renamedFileName.toLowerCase() === fileName.toLowerCase() ||
            h.renamedFileName.toLowerCase() === `${targetNo}.pdf`.toLowerCase())
        ) {
          return true;
        }
        return false;
      }) || null
    );
  };

  // Kumpulan berkas di antrean yang terindikasi ganda / sudah pernah diupload
  const duplicateQueueItems = useMemo(() => {
    return queue
      .map((item) => {
        const existing = checkTtbDuplicate(item.noTtb, item.file.name);
        return { item, existing };
      })
      .filter((x): x is { item: QueuedFile; existing: UploadedTtbItem } => Boolean(x.existing));
  }, [queue, history, batchNoTtb]);

  const hasDuplicateInQueue = duplicateQueueItems.length > 0;

  // Lewati (Skip) Semua Duplikat & Hapus dari Antrean
  const handleSkipAllDuplicates = () => {
    const dupIds = new Set(duplicateQueueItems.map((d) => d.item.id));
    setQueue((prev) => {
      prev.forEach((item) => {
        if (dupIds.has(item.id) && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return prev.filter((item) => !dupIds.has(item.id));
    });
    setIsDuplicateModalOpen(false);
    showToast?.(`Berhasil menghapus ${dupIds.size} berkas duplikat dari antrean.`, 'info');
  };

  // Tambahkan berkas ke antrean (dengan auto-detect & auto-scaling)
  const handleFilesAdded = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newItems: QueuedFile[] = [];

    let totalSavedBytes = 0;
    let compressedCount = 0;

    for (const rawFile of files) {
      const ext = rawFile.name.slice(rawFile.name.lastIndexOf('.')).toLowerCase();
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(ext);
      const isPdf = /\.pdf$/i.test(ext);

      if (!isImage && !isPdf) {
        showToast?.(
          `Format berkas "${rawFile.name}" tidak didukung. Harap unggah foto JPG/PNG atau scan PDF.`,
          'warning'
        );
        continue;
      }

      let finalFile = rawFile;
      let originalSize = rawFile.size;
      let compressedSize = rawFile.size;
      let savingsPercent = 0;
      let isOptimized = false;

      // Jalankan optimasi & scaling otomatis untuk foto
      if (isImage) {
        try {
          const compResult = await optimizeAndScaleImage(rawFile);
          finalFile = compResult.file;
          compressedSize = compResult.compressedSize;
          savingsPercent = compResult.savingsPercent;
          isOptimized = compResult.isCompressed;
          if (compResult.isCompressed && compResult.savingsPercent > 5) {
            totalSavedBytes += (originalSize - compressedSize);
            compressedCount++;
          }
        } catch (compErr) {
          console.warn('Gagal optimasi foto TTB:', compErr);
        }
      }

      const previewUrl = isImage ? URL.createObjectURL(finalFile) : '';
      const detected = detectTtbAndArmada(finalFile.name, ttbSuggestions);

      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: finalFile,
        previewUrl,
        isImage,
        isPdf,
        noTtb: detected.noTtb || batchNoTtb || '',
        armada: detected.armada || batchArmada || '',
        doNo: detected.doNo || batchDoNo || '',
        noFpb: detected.noFpb || '',
        isAutoMatched: detected.isAutoMatched,
        originalSize,
        compressedSize,
        savingsPercent,
        isOptimized,
      });
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);
      const autoCount = newItems.filter((f) => f.isAutoMatched).length;
      const detectedDuplicates = newItems.filter((q) => Boolean(checkTtbDuplicate(q.noTtb, q.file.name)));

      if (detectedDuplicates.length > 0) {
        showToast?.(
          `⚠️ Peringatan: ${detectedDuplicates.length} berkas terindikasi SUDAH PERNAH DIUPLOAD sebelumnya!`,
          'warning'
        );
      } else if (compressedCount > 0 && totalSavedBytes > 0) {
        showToast?.(
          `⚡ Menambahkan ${newItems.length} berkas. Foto berhasil dioptimasi & diskalakan (hemat ${formatByteSize(totalSavedBytes)})!`,
          'success'
        );
      } else if (autoCount > 0) {
        showToast?.(
          `Menambahkan ${newItems.length} berkas (${autoCount} No. TTB otomatis terdeteksi).`,
          'success'
        );
      } else {
        showToast?.(`Menambahkan ${newItems.length} berkas ke antrean.`, 'info');
      }
    }
  };

  const handleUpdateQueueItem = (id: string, field: keyof QueuedFile, value: any) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'noTtb' && typeof value === 'string') {
            const cleanDigits = value.replace(/\D/g, '');
            const inputComp = extractTtbComponents(value);
            const inputPrefix = inputComp.prefix;

            if (cleanDigits.length >= 3 && !updated.armada) {
              const found = ttbSuggestions.find((s) => {
                if (inputPrefix) {
                  const sComp = extractTtbComponents(s.noTtb);
                  if (sComp.prefix !== inputPrefix) return false;
                }
                const sDigits = s.noTtb.replace(/\D/g, '');
                return sDigits.endsWith(cleanDigits);
              });
              if (found) {
                if (found.armada) updated.armada = found.armada;
                if (found.doNo && !updated.doNo) updated.doNo = found.doNo;
                if (found.noFpb && !updated.noFpb) updated.noFpb = found.noFpb;
              }
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearQueue = () => {
    queue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setQueue([]);
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
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Proses Upload Antrean ke Cloudflare R2
  const processUploadForQueue = async (targetQueue: QueuedFile[]) => {
    if (targetQueue.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const newlyUploaded: UploadedTtbItem[] = [];
      const failedFiles: string[] = [];

      for (let i = 0; i < targetQueue.length; i++) {
        const item = targetQueue[i];
        const targetNoTtb = (item.noTtb.trim() || batchNoTtb.trim());
        const cleanNoTtb = sanitizeTtbNumber(targetNoTtb);

        if (!cleanNoTtb) {
          throw new Error(`Nomor TTB untuk berkas "${item.file.name}" wajib diisi.`);
        }

        const formData = new FormData();
        formData.append('noTtb', cleanNoTtb);
        formData.append('armada', item.armada.trim() || batchArmada.trim());
        formData.append('noPo', item.doNo.trim() || batchDoNo.trim());
        if (item.noFpb) formData.append('noFpb', item.noFpb.trim());
        formData.append('receivedDate', batchReceivedDate);
        formData.append('keterangan', batchKeterangan.trim());

        let fileToUpload = item.file;
        if (enableAutoStamp && item.isImage) {
          try {
            fileToUpload = await stampTtbImageFile({
              imageFile: item.file,
              signaturePngDataUrl: userSignaturePng || undefined,
              uploaderName: uploaderName.trim() || user?.name || 'Administrator CPG',
              uploadDate: formatTtbStampDate(batchReceivedDate),
            });
          } catch (err) {
            console.warn('Gagal stempel gambar client, upload berkas asli:', err);
          }
        }
        formData.append('files', fileToUpload);

        const currentUploader = uploaderName.trim() || user?.name || 'Administrator CPG';
        formData.append('uploaderName', currentUploader);
        if (user?.username) formData.append('uploaderUsername', user.username);
        if (user?.role) formData.append('uploaderRole', user.role);
        if (user?.nik) formData.append('uploaderNik', user.nik);
        if (user?.jabatan) formData.append('uploaderJabatan', user.jabatan);

        formData.append('autoStamp', enableAutoStamp ? 'true' : 'false');
        if (enableAutoStamp) {
          if (userSignaturePng) formData.append('signatureDataUrl', userSignaturePng);
          formData.append('stampDate', formatTtbStampDate(batchReceivedDate));
        }

        const res = await fetch('/api/upload-ttb', {
          method: 'POST',
          body: formData,
        });

        const result: UploadTtbResponse = await res.json();
        if (res.ok && result.success && result.uploadedFiles && result.uploadedFiles.length > 0) {
          newlyUploaded.push(...result.uploadedFiles);
        } else {
          failedFiles.push(`"${item.file.name}" (${cleanNoTtb}): ${result.message || result.error || 'Gagal'}`);
        }

        setUploadProgress(10 + Math.round(((i + 1) / targetQueue.length) * 85));
      }

      setUploadProgress(100);

      if (newlyUploaded.length > 0) {
        showToast?.(
          `Sukses! ${newlyUploaded.length} berkas TTB berhasil diarsipkan ke Cloudflare R2.`,
          'success'
        );

        // Bersihkan antrean yang baru diunggah
        const uploadedIds = new Set(targetQueue.map((t) => t.id));
        setQueue((prev) => {
          prev.forEach((item) => {
            if (uploadedIds.has(item.id) && item.previewUrl) {
              URL.revokeObjectURL(item.previewUrl);
            }
          });
          return prev.filter((item) => !uploadedIds.has(item.id));
        });

        if (targetQueue.length === queue.length) {
          setBatchNoTtb('');
          setBatchArmada('');
          setBatchDoNo('');
          setBatchKeterangan('');
        }

        await fetchHistory();
      }

      if (failedFiles.length > 0) {
        const errorMsg = `Sebagian berkas mengalami kendala upload (${failedFiles.length} gagal):\n${failedFiles.join('\n')}`;
        showToast?.(errorMsg, 'error');
      }
    } catch (err) {
      showToast?.((err as Error).message || 'Terjadi kesalahan saat mengunggah.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Submit Handler dengan proteksi duplikat
  const handleExecuteUpload = async () => {
    if (queue.length === 0) {
      showToast?.('Pilih setidaknya 1 berkas TTB untuk diunggah.', 'warning');
      return;
    }

    if (hasDuplicateInQueue) {
      setIsDuplicateModalOpen(true);
      return;
    }

    await processUploadForQueue(queue);
  };

  // Salin Nomor TTB
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast?.(`Nomor TTB "${text}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast?.('Gagal menyalin.', 'warning');
    }
  };

  // Hapus Berkas dari Riwayat
  const handleDeleteHistoryItem = async (item: UploadedTtbItem) => {
    if (!isAdmin) {
      showToast?.('Akses ditolak: Hanya Administrator yang berwenang menghapus berkas TTB.', 'error');
      return;
    }
    if (!window.confirm(`Hapus berkas TTB "${item.renamedFileName}" dari penyimpanan Cloudflare R2?`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(
        `/api/upload-ttb?id=${encodeURIComponent(item.id)}&key=${encodeURIComponent(item.r2Key || '')}&fileName=${encodeURIComponent(item.renamedFileName)}`,
        {
          method: 'DELETE',
          headers: {
            'x-user-role': user?.role || '',
          },
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(`Berkas "${item.renamedFileName}" berhasil dihapus.`, 'success');
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
      } else {
        throw new Error(data.error || 'Gagal menghapus berkas.');
      }
    } catch (err) {
      showToast?.((err as Error).message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter riwayat berdasarkan pencarian
  const filteredHistory = useMemo(() => {
    if (!searchHistory.trim()) return history;
    const q = searchHistory.toLowerCase().trim();
    return history.filter(
      (h) =>
        h.noTtb?.toLowerCase().includes(q) ||
        h.cleanNoTtb?.toLowerCase().includes(q) ||
        h.armada?.toLowerCase().includes(q) ||
        h.noPo?.toLowerCase().includes(q) ||
        h.noFpb?.toLowerCase().includes(q) ||
        h.renamedFileName?.toLowerCase().includes(q) ||
        h.uploaderName?.toLowerCase().includes(q)
    );
  }, [history, searchHistory]);

  // Pagination state untuk riwayat tabel (10 data per halaman)
  const [historyPage, setHistoryPage] = useState<number>(1);
  const historyPageSize = 10;
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage]);

  // Reset pagination saat pencarian atau riwayat berubah
  useEffect(() => {
    setHistoryPage(1);
  }, [searchHistory, history.length]);

  // Statistik Ringkasan (4 Stat Cards)
  const stats = useMemo(() => {
    const total = history.length;
    const pdfCount = history.filter(
      (h) => h.fileType === 'application/pdf' || h.renamedFileName.toLowerCase().endsWith('.pdf')
    ).length;
    const imgCount = total - pdfCount;
    const r2Count = history.filter(
      (h) => h.storageProvider === 'CLOUDFLARE_R2' || h.status === 'STORED_IN_CLOUDFLARE_R2' || h.fileUrl
    ).length;
    return { total, pdfCount, imgCount, r2Count };
  }, [history]);

  const distinctTtbCount = useMemo(() => {
    const set = new Set(queue.map((item) => sanitizeTtbNumber(item.noTtb.trim() || batchNoTtb.trim())).filter(Boolean));
    return set.size;
  }, [queue, batchNoTtb]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Top Banner Header & Summary Metric Cards */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -right-12 -top-12 size-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs shrink-0">
              <PackageCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  Unggah Dokumen TTB
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Cloudflare R2
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  CPL-PRC-SOP-004-F02
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pengarsipan berkas Tanda Terima Barang (TTB) resmi ke Cloudflare R2 dengan sistem penamaan otomatis sesuai Nomor TTB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleTestStorageConnection}
              disabled={isTestingStorage}
              className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-2 transition active:scale-95 cursor-pointer"
              title="Uji koneksi langsung ke bucket Cloudflare R2 Storage"
            >
              <Database className={`size-3.5 text-orange-500 ${isTestingStorage ? 'animate-pulse' : ''}`} />
              <span>{isTestingStorage ? 'Menguji...' : 'Uji Koneksi Penyimpanan'}</span>
            </button>

            <button
              type="button"
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* 4 Kolom Stat Card (Summary Metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/70">
          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
              <FileCheck className="size-3.5 text-primary" />
              <span>Total Berkas TTB</span>
            </span>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {stats.total.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
              <FileText className="size-3.5 text-blue-500" />
              <span>Berkas PDF Resmi</span>
            </span>
            <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {stats.pdfCount.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
              <ImageIcon className="size-3.5 text-amber-500" />
              <span>Bukti Foto Fisik</span>
            </span>
            <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {stats.imgCount.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
              <Database className="size-3.5 text-emerald-500" />
              <span>Cloudflare R2</span>
            </span>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.r2Count.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Datalist autocomplete untuk Nomor TTB & Armada */}
      <datalist id="ttb-batch-datalist">
        {ttbSuggestions.slice(0, 100).map((sug, idx) => (
          <option key={idx} value={sug.noTtb}>
            {sug.armada ? `${sug.armada} - ${sug.description || ''}` : sug.description || ''}
          </option>
        ))}
      </datalist>

      <datalist id="armada-batch-datalist">
        {Array.from(new Set(ttbSuggestions.map((s) => s.armada).filter(Boolean))).map((arm, idx) => (
          <option key={idx} value={arm} />
        ))}
      </datalist>

      {/* 2 & 5. Grid 2 Kolom Interaktif (Equal Height Layout: items-stretch) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Kolom Kiri: Dropzone Area & Antrean Berkas */}
        <div className="h-full flex flex-col justify-between space-y-4">
          {/* Dropzone Container */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
              queue.length === 0 ? 'flex-1 min-h-[420px]' : 'py-6'
            } ${
              isDragging
                ? 'border-primary bg-primary/5 scale-[0.99]'
                : 'border-border bg-card/60 hover:bg-card hover:border-primary/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
            />
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary group-hover:scale-110 transition">
              <FolderUp className="size-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono border border-emerald-500/30 mb-2">
                <Sparkles className="size-3" />
                <span>Mendukung Banyak TTB &amp; Unggah Sekaligus</span>
              </div>

              <p className="text-sm font-bold text-foreground">
                Tarik &amp; Letakkan berkas TTB di sini, atau{' '}
                <span className="text-primary underline underline-offset-2">Pilih Banyak Berkas Sekaligus</span>
              </p>

              <p className="text-xs text-muted-foreground mt-2">
                Bisa mengunggah <strong>banyak nomor TTB berbeda sekaligus</strong> maupun berkas lampiran multi-halaman/foto.
              </p>
              <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                Format otomatis: <strong>CPL-TTB-26-00449.pdf</strong> (nomor TTB, armada, &amp; PO terdeteksi otomatis per berkas)
              </p>
            </div>
          </div>

          {/* Daftar Antrean Berkas (Jika Ada) */}
          {queue.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Antrean Berkas ({queue.length})
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="text-xs text-red-500 hover:text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  <span>Kosongkan Antrean</span>
                </button>
              </div>

              {/* Alert Banner: Terindikasi Duplikat / Pernah Diupload */}
              {hasDuplicateInQueue && (
                <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold flex items-center gap-1.5 flex-wrap text-foreground">
                        <span>⚠️ Terdeteksi {duplicateQueueItems.length} Berkas Terindikasi Sudah Diupload!</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-bold font-mono">
                          Pencegahan Double Posting
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Nomor berkas TTB ini telah terdaftar di riwayat Cloudflare R2 sebelumnya. Untuk menghindari data ganda, disarankan melewati (skip) atau menghapus berkas baru ini.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSkipAllDuplicates}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Lewati semua berkas yang terindikasi ganda dan hapus dari antrean baru"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Skip Semua Duplikat</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Daftar Item File dalam Antrean */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {queue.map((item, idx) => {
                  const dupInfo = checkTtbDuplicate(item.noTtb, item.file.name);
                  const isDup = Boolean(dupInfo);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition text-xs space-y-2 ${
                        isDup
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-border bg-background/60 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-5 rounded-full bg-muted text-muted-foreground font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-foreground truncate" title={item.file.name}>
                            {item.file.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            ({formatFileSize(item.file.size)})
                          </span>
                          {item.isOptimized && item.savingsPercent && item.savingsPercent > 5 ? (
                            <span
                              className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] border border-emerald-500/30 shrink-0"
                              title={`Foto diskalakan & dikompres otomatis (hemat ${item.savingsPercent}%)`}
                            >
                              ⚡ -{item.savingsPercent}%
                            </span>
                          ) : null}
                          {isDup && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0">
                              Duplikat
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveQueueItem(item.id)}
                          className="size-6 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-muted flex items-center justify-center cursor-pointer transition shrink-0"
                          title="Hapus dari antrean"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/50">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                            Nomor TTB Berkas Ini:
                          </label>
                          <input
                            type="text"
                            list="ttb-batch-datalist"
                            value={item.noTtb}
                            onChange={(e) =>
                              handleUpdateQueueItem(item.id, 'noTtb', e.target.value)
                            }
                            placeholder="CPL-TTB-26-00449"
                            className="w-full h-7 px-2 text-xs rounded-lg border border-border bg-card text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                            Armada / Unit Kapal:
                          </label>
                          <input
                            type="text"
                            list="armada-batch-datalist"
                            value={item.armada}
                            onChange={(e) =>
                              handleUpdateQueueItem(item.id, 'armada', e.target.value)
                            }
                            placeholder="SPOB SEA LION"
                            className="w-full h-7 px-2 text-xs rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Form Konfigurasi Metadata, Auto-Stamp, & CTA Button */}
        <div className="h-full flex flex-col justify-between bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldCheck className="size-4 text-primary" />
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  KONFIGURASI METADATA TTB
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Nomor TTB Default (Batch):
                </label>
                <input
                  type="text"
                  list="ttb-batch-datalist"
                  value={batchNoTtb}
                  onChange={(e) => setBatchNoTtb(e.target.value)}
                  placeholder="Cth: CPL-TTB-26-00449"
                  className="w-full h-8.5 px-3 rounded-lg border border-border bg-background text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Armada / Unit:
                  </label>
                  <input
                    type="text"
                    list="armada-batch-datalist"
                    value={batchArmada}
                    onChange={(e) => setBatchArmada(e.target.value)}
                    placeholder="Cth: SPOB SEA LION"
                    className="w-full h-8.5 px-3 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    No. DO / No. PO:
                  </label>
                  <input
                    type="text"
                    value={batchDoNo}
                    onChange={(e) => setBatchDoNo(e.target.value)}
                    placeholder="Cth: CPL-PO-26-04738"
                    className="w-full h-8.5 px-3 rounded-lg border border-border bg-background text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Tanggal Serah Terima:
                </label>
                <input
                  type="date"
                  value={batchReceivedDate}
                  onChange={(e) => setBatchReceivedDate(e.target.value)}
                  className="w-full h-8.5 px-3 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Catatan / Keterangan:
                </label>
                <textarea
                  value={batchKeterangan}
                  onChange={(e) => setBatchKeterangan(e.target.value)}
                  placeholder="Catatan tambahan TTB (misal: cat bottom & top side)..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              {/* Card Sub-Pengaturan: Identitas Pengunggah & Stempel Otomatis */}
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                    <PenTool className="size-3.5" />
                    <div>
                      <span className="font-bold">Identitas Pengunggah &amp; Stempel</span>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={enableAutoStamp}
                      onChange={(e) => setEnableAutoStamp(e.target.checked)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>Stempel Otomatis PDF</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium block">
                    Nama Pengunggah (Staf Logistik / Pengadaan):
                  </label>
                  <input
                    type="text"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    placeholder="Nama lengkap pengunggah"
                    className="w-full h-7 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {enableAutoStamp && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Sistem akan secara otomatis menyematkan nama pengunggah, tanda tangan digital akun (jika tersimpan di Pengaturan Admin), dan tanggal pada kolom formulir TTB resmi.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tombol Eksekusi Upload (CTA Full-Width di Bawah, Mt-Auto) */}
          <div className="pt-4 mt-auto">
            <button
              type="button"
              onClick={handleExecuteUpload}
              disabled={isUploading || queue.length === 0}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin text-white" />
                  <span>Mengunggah ke Cloudflare R2 ({uploadProgress}%)...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UploadCloud className="size-4 text-white" />
                  <span>
                    {queue.length > 0
                      ? distinctTtbCount > 1
                        ? `Unggah ${queue.length} Berkas (${distinctTtbCount} No. TTB)`
                        : `Unggah ${queue.length} Berkas TTB`
                      : 'ke Cloudflare R2'}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Tabel Riwayat Pengarsipan Berkas TTB (Archiving History Table) */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Riwayat Pengarsipan Berkas TTB
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daftar berkas yang tersimpan aman di Cloudflare R2 Storage
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari nomor TTB, armada, PO..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Tabel Data Riwayat */}
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] rounded-xl border border-border relative">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md text-muted-foreground font-semibold border-b border-border uppercase text-[10px] tracking-wider shadow-xs">
              <tr>
                <th className="py-2.5 px-3">NO. TTB RESMI</th>
                <th className="py-2.5 px-3">ARMADA / UNIT</th>
                <th className="py-2.5 px-3">NO. DO / PO</th>
                <th className="py-2.5 px-3">PENGUNGGAH</th>
                <th className="py-2.5 px-3">TANGGAL &amp; WAKTU UNGGAH</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {isLoadingHistory ? (
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="size-4 animate-spin text-primary" />
                        Memuat riwayat TTB...
                      </span>
                    ) : (
                      'Belum ada data riwayat upload TTB.'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{item.noTtb}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.noTtb, item.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Salin No TTB"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {item.armada || '-'}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {item.noPo || item.noFpb || '-'}
                    </td>

                    <td className="py-2.5 px-3">
                      {item.uploaderName ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground text-[11px] block">
                            {item.uploaderName}
                          </span>
                          {item.isAutoStamped && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <FileSignature className="size-2.5" />
                              <span>Auto-Signed</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                      {item.uploadedAt ? (
                        <div className="flex flex-col leading-tight">
                          <span className="text-foreground font-semibold">
                            {(() => {
                              try {
                                const d = new Date(item.uploadedAt);
                                return !isNaN(d.getTime())
                                  ? d.toLocaleDateString('id-ID', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : item.uploadedAt.slice(0, 10);
                              } catch {
                                return item.uploadedAt.slice(0, 10);
                              }
                            })()}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {(() => {
                              try {
                                const d = new Date(item.uploadedAt);
                                return !isNaN(d.getTime())
                                  ? `${d.toLocaleTimeString('id-ID', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })} WIB`
                                  : '';
                              } catch {
                                return '';
                              }
                            })()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{item.receivedDate || '-'}</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="size-3" />
                        UPLOADED
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActivePreview(item)}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Pratinjau Berkas"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        <a
                          href={item.fileUrl.includes('?') ? `${item.fileUrl}&download=true` : `${item.fileUrl}?download=true`}
                          download={item.renamedFileName}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Unduh Berkas"
                        >
                          <Download className="size-3.5" />
                        </a>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition cursor-pointer"
                            title="Hapus Berkas dari Cloudflare R2 (Khusus Admin)"
                          >
                            {deletingId === item.id ? (
                              <RefreshCw className="size-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredHistory.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <div>
              Menampilkan{' '}
              <strong className="text-foreground">
                {(historyPage - 1) * historyPageSize + 1}
              </strong>{' '}
              -{' '}
              <strong className="text-foreground">
                {Math.min(historyPage * historyPageSize, filteredHistory.length)}
              </strong>{' '}
              dari <strong className="text-foreground">{filteredHistory.length}</strong> data
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer flex items-center gap-1 text-xs font-medium"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-3.5" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-3 py-1 text-xs font-semibold text-foreground">
                Halaman {historyPage} dari {totalHistoryPages}
              </span>

              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                disabled={historyPage === totalHistoryPages}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer flex items-center gap-1 text-xs font-medium"
                title="Halaman Berikutnya"
              >
                <span>Berikutnya</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview Berkas */}
      {activePreview && (
        <div
          onClick={() => setActivePreview(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden cursor-default text-card-foreground animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-foreground font-mono truncate">
                    {activePreview.renamedFileName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate">
                    No. TTB: <strong className="text-foreground">{activePreview.noTtb}</strong> • Armada: {activePreview.armada || '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activePreview.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Tab Baru</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-black/95 p-2 flex items-center justify-center min-h-[450px]">
              {activePreview.fileType === 'application/pdf' || activePreview.renamedFileName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={activePreview.fileUrl}
                  title={activePreview.renamedFileName}
                  className="w-full h-[650px] rounded-lg border-0 bg-white"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activePreview.fileUrl}
                  alt={activePreview.renamedFileName}
                  className="max-w-full max-h-[650px] object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Peringatan Duplikat TTB */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-border bg-linear-to-r from-amber-500/15 via-rose-500/10 to-transparent flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span>Peringatan Dokumen TTB Terindikasi Duplikat</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Cegah double posting / upload ganda dokumen TTB ke Cloudflare R2
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 leading-relaxed text-[11px]">
                Sistem mendeteksi <strong>{duplicateQueueItems.length} berkas</strong> dalam antrean sudah pernah diarsipkan di Cloudflare R2 sebelumnya.
                Untuk menjaga keakuratan pengarsipan, disarankan untuk <strong>Melewati (Skip)</strong> berkas duplikat tersebut.
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Daftar Berkas Terindikasi Duplikat:
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {duplicateQueueItems.map(({ item, existing }, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {idx + 1}. {item.file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          No. TTB: <span className="font-bold text-primary">{item.noTtb}</span> • Tercatat: {existing.renamedFileName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQueueItem(item.id)}
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-[10px] font-bold transition cursor-pointer shrink-0"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSkipAllDuplicates}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Skip Semua Duplikat ({duplicateQueueItems.length})</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsDuplicateModalOpen(false);
                  await processUploadForQueue(queue);
                }}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition cursor-pointer text-center"
              >
                Tetap Unggah Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
