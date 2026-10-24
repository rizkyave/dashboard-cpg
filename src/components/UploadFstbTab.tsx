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
  PackageCheck,
  FileSpreadsheet,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { UploadedFstbItem, UploadFstbResponse } from '@/types/fstbUpload';
import {
  sanitizeFstbNumber,
  formatFstbFilename,
  formatFileSize,
  extractFstbComponents,
} from '@/utils/fstbRename';
import { formatFstbStampDate } from '@/utils/stampDateFormatter';
import FstbSuccessWaModal from './FstbSuccessWaModal';
import { optimizeAndScaleImage, formatByteSize } from '@/utils/imageCompressor';

interface UploadFstbTabProps {
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
  noFstb: string;
  armada: string;
  doNo: string;
  noFpb: string;
  isAutoMatched: boolean;
  originalSize?: number;
  compressedSize?: number;
  savingsPercent?: number;
  isOptimized?: boolean;
}

interface FstbSuggestion {
  noFstb: string;
  armada: string;
  noFpb?: string;
  doNo?: string;
  description?: string;
}

/**
 * Mendeteksi Nomor FSTB, Armada, DO/PO, dan FPB secara cerdas dari nama berkas dan dataset.
 */
function detectFstbAndArmada(
  fileName: string,
  suggestions: FstbSuggestion[] = []
): { noFstb: string; armada: string; doNo: string; noFpb: string; isAutoMatched: boolean } {
  const components = extractFstbComponents(fileName);

  let finalNoFstb = components.canonicalFstb || '';
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
        const sComp = extractFstbComponents(s.noFstb);
        if (sComp.prefix && sComp.prefix !== filePrefix) return false;
        const cleanS = s.noFstb.replace(/\D/g, '');
        return cleanS.endsWith(targetNumber) || cleanS.endsWith(padded);
      });

      if (exactMatch) {
        finalNoFstb = exactMatch.noFstb || finalNoFstb;
        matchedArmada = exactMatch.armada || '';
        matchedDoNo = exactMatch.doNo || '';
        matchedNoFpb = exactMatch.noFpb || '';
      }
    } else {
      const lowerFileName = fileName.toLowerCase();
      const candidates = suggestions.filter((s) => {
        const cleanS = s.noFstb.replace(/\D/g, '');
        return cleanS.endsWith(targetNumber) || cleanS.endsWith(padded);
      });

      if (candidates.length > 0) {
        const matchWithArmada = candidates.find(
          (c) => c.armada && lowerFileName.includes(c.armada.toLowerCase())
        );
        const best = matchWithArmada || candidates[0];
        finalNoFstb = best.noFstb || finalNoFstb;
        matchedArmada = best.armada || '';
        matchedDoNo = best.doNo || '';
        matchedNoFpb = best.noFpb || '';
      }
    }
  }

  // Jika nama armada tertera pada nama berkas, ekstrak langsung
  if (!matchedArmada) {
    const knownArmadas = [
      'UB CMPL 01', 'CMPL 01', 'SPOB SEA LION', 'SEA LION', 'TEMASEK',
      'CINDARA', 'TWINSISTER', 'PMI ABADI', 'FERY 471', 'MANDAR',
      'BLUE PETROL', 'COASTWAY', 'CAKRA 10', 'OFFICE GAJ', 'WORKSHOP',
    ];
    const upperFile = fileName.toUpperCase();
    for (const arm of knownArmadas) {
      if (upperFile.includes(arm)) {
        matchedArmada = arm;
        break;
      }
    }
  }

  return {
    noFstb: finalNoFstb,
    armada: matchedArmada,
    doNo: matchedDoNo,
    noFpb: matchedNoFpb,
    isAutoMatched: Boolean(finalNoFstb && matchedArmada),
  };
}

export default function UploadFstbTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  showToast,
}: UploadFstbTabProps) {
  const { user, canEdit, isAdmin } = useAuth();

  // State antrean berkas yang akan diunggah
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Form input default / batch
  const [batchNoFstb, setBatchNoFstb] = useState<string>('');
  const [batchArmada, setBatchArmada] = useState<string>('');
  const [batchDoNo, setBatchDoNo] = useState<string>('');
  const [batchNoFpb, setBatchNoFpb] = useState<string>('');
  const [batchReceivedDate, setBatchReceivedDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [batchKeterangan, setBatchKeterangan] = useState<string>('');

  // Hitung jumlah nomor FSTB unik di antrean
  const distinctFstbCount = useMemo(() => {
    const set = new Set(queue.map((q) => sanitizeFstbNumber(q.noFstb || batchNoFstb)).filter(Boolean));
    return set.size;
  }, [queue, batchNoFstb]);

  // Fitur Auto-Stamp Tanda Tangan Digital Uploader
  const [enableAutoStamp, setEnableAutoStamp] = useState<boolean>(true);
  const [uploaderName, setUploaderName] = useState<string>('');

  useEffect(() => {
    if (user?.name) {
      setUploaderName(user.name);
    }
  }, [user]);

  // State Riwayat Berkas FSTB
  const [history, setHistory] = useState<UploadedFstbItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [searchHistory, setSearchHistory] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isR2Active, setIsR2Active] = useState<boolean>(false);
  const [activePreview, setActivePreview] = useState<UploadedFstbItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal Peringatan Duplikat FSTB
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);

  // Modal WhatsApp Notifikasi Sukses FSTB
  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [waModalData, setWaModalData] = useState<{
    noFstb: string;
    noPo?: string;
    noFpb?: string;
    armada?: string;
    uploaderName: string;
    uploaderRole?: string;
    fileCount?: number;
  }>({
    noFstb: '',
    uploaderName: '',
  });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kumpulan saran nomor FSTB dari database internal
  const fstbSuggestions = useMemo<FstbSuggestion[]>(() => {
    const list: FstbSuggestion[] = [];
    const seen = new Set<string>();

    // 1. Dari data Armada
    for (const a of armadaItems) {
      if (a.noFstb && a.noFstb.trim()) {
        const key = a.noFstb.trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            noFstb: a.noFstb.trim(),
            armada: a.armada || '',
            noFpb: a.fpb || '',
            doNo: a.noPo || '',
            description: a.item || '',
          });
        }
      }
    }

    // 2. Dari data Procurement
    for (const p of procurementItems) {
      if (p.noFstb && p.noFstb.trim()) {
        const key = p.noFstb.trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            noFstb: p.noFstb.trim(),
            armada: p.deptArmada || '',
            noFpb: p.fpb || '',
            doNo: p.noPo || '',
            description: p.item || '',
          });
        }
      }
    }

    // 3. Dari Sisa Layanan
    for (const s of sisaLayananItems) {
      if (s.noFstb && s.noFstb.trim()) {
        const key = s.noFstb.trim().toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            noFstb: s.noFstb.trim(),
            armada: s.departement || '',
            noFpb: s.noFpb || '',
            doNo: s.noPo || '',
            description: s.namaBarang || '',
          });
        }
      }
    }

    return list;
  }, [armadaItems, procurementItems, sisaLayananItems]);

  // Load Riwayat FSTB dari Server
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/upload-fstb');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setHistory(data.items);
        setIsR2Active(Boolean(data.isR2StorageActive));
      } else {
        setHistory([]);
      }
    } catch {
      showToast?.('Gagal memuat riwayat upload FSTB.', 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Handle Penambahan Berkas ke Antrean dengan Auto-Compress & Scaling
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    let totalSavedBytes = 0;
    let compressedCount = 0;

    const newQueued: QueuedFile[] = [];

    for (const rawFile of fileArray) {
      const isPdf = rawFile.name.toLowerCase().endsWith('.pdf');
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(rawFile.name);

      let finalFile = rawFile;
      let originalSize = rawFile.size;
      let compressedSize = rawFile.size;
      let savingsPercent = 0;
      let isOptimized = false;

      // Jalankan auto-scaling dan kompresi untuk foto/gambar
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
          console.warn('Gagal kompresi foto:', compErr);
        }
      }

      const previewUrl = URL.createObjectURL(finalFile);
      const detection = detectFstbAndArmada(finalFile.name, fstbSuggestions);

      newQueued.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: finalFile,
        previewUrl,
        isPdf,
        isImage,
        noFstb: detection.noFstb || batchNoFstb,
        armada: detection.armada || batchArmada,
        doNo: detection.doNo || batchDoNo,
        noFpb: detection.noFpb || batchNoFpb,
        isAutoMatched: detection.isAutoMatched,
        originalSize,
        compressedSize,
        savingsPercent,
        isOptimized,
      });
    }

    setQueue((prev) => [...prev, ...newQueued]);

    // Jika antrean pertama memiliki hasil deteksi, isi batch form
    if (newQueued.length === 1 && newQueued[0].noFstb) {
      if (!batchNoFstb) setBatchNoFstb(newQueued[0].noFstb);
      if (!batchArmada && newQueued[0].armada) setBatchArmada(newQueued[0].armada);
      if (!batchDoNo && newQueued[0].doNo) setBatchDoNo(newQueued[0].doNo);
    }

    const detectedDuplicates = newQueued.filter((q) => Boolean(checkFstbDuplicate(q.noFstb, q.file.name)));
    if (detectedDuplicates.length > 0) {
      showToast?.(
        `⚠️ Peringatan: ${detectedDuplicates.length} berkas terindikasi SUDAH PERNAH DIUPLOAD sebelumnya!`,
        'warning'
      );
    } else {
      if (compressedCount > 0 && totalSavedBytes > 0) {
        showToast?.(
          `⚡ ${newQueued.length} berkas ditambahkan. Foto dioptimasi & diskalakan (hemat ${formatByteSize(totalSavedBytes)})!`,
          'success'
        );
      } else {
        showToast?.(`${newQueued.length} berkas berhasil ditambahkan ke antrean.`, 'info');
      }
    }
  };

  // Drag & Drop Handlers
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
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Hapus Berkas dari Antrean
  const handleRemoveFromQueue = (id: string) => {
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
    setBatchNoFstb('');
    setBatchArmada('');
    setBatchDoNo('');
    setBatchNoFpb('');
  };

  // Update nilai item tertentu di antrean
  const handleUpdateQueueItem = (
    id: string,
    field: 'noFstb' | 'armada' | 'doNo' | 'noFpb',
    val: string
  ) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  // Helper cek duplikat FSTB terhadap riwayat
  const checkFstbDuplicate = (noFstb: string, fileName: string) => {
    const targetNo = sanitizeFstbNumber(noFstb.trim() || batchNoFstb.trim());
    if (!targetNo) return null;
    return (
      history.find((h) => {
        const cleanH = sanitizeFstbNumber(h.noFstb || h.cleanNoFstb || '');
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
        const existing = checkFstbDuplicate(item.noFstb, item.file.name);
        return { item, existing };
      })
      .filter((x): x is { item: QueuedFile; existing: UploadedFstbItem } => Boolean(x.existing));
  }, [queue, history, batchNoFstb]);

  const hasDuplicateInQueue = duplicateQueueItems.length > 0;

  // 1. Lewati (Skip) Semua Duplikat & Hapus dari Antrean
  const handleSkipAllDuplicates = () => {
    if (duplicateQueueItems.length === 0) return;
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
    showToast?.(
      `✓ Berhasil melewati (skip) ${dupIds.size} berkas duplikat dan menghapusnya dari antrean baru.`,
      'info'
    );
  };

  // 2. Hapus satu berkas baru yang duplikat
  const handleRemoveDuplicateFile = (id: string) => {
    handleRemoveFromQueue(id);
    showToast?.('Berkas baru yang terindikasi duplikat berhasil dihapus dari antrean.', 'info');
  };

  // 3. Skip duplikat dan lanjutkan upload berkas baru yang belum pernah diupload
  const handleSkipDuplicatesAndUploadRest = async () => {
    const dupIds = new Set(duplicateQueueItems.map((d) => d.item.id));
    const nonDuplicates = queue.filter((item) => !dupIds.has(item.id));

    // Bersihkan preview URL dari berkas yang di-skip
    queue.forEach((item) => {
      if (dupIds.has(item.id) && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });

    setQueue(nonDuplicates);
    setIsDuplicateModalOpen(false);

    if (nonDuplicates.length === 0) {
      showToast?.(
        'Semua berkas terindikasi duplikat dan telah dihapus. Tidak ada berkas baru yang diunggah.',
        'info'
      );
      return;
    }

    showToast?.(
      `Melewati ${dupIds.size} berkas duplikat. Mengunggah ${nonDuplicates.length} berkas baru...`,
      'info'
    );
    await processUploadForQueue(nonDuplicates);
  };

  // 4. Tetap unggah & timpa berkas lama (Overwrite)
  const handleProceedOverwrite = async () => {
    setIsDuplicateModalOpen(false);
    showToast?.('Melanjutkan pengunggahan & memperbarui berkas yang sudah ada...', 'info');
    await processUploadForQueue(queue);
  };

  // Fungsi Inti Eksekusi Upload
  const processUploadForQueue = async (targetQueue: QueuedFile[]) => {
    if (targetQueue.length === 0) return;

    // Validasi nomor FSTB
    for (let i = 0; i < targetQueue.length; i++) {
      const q = targetQueue[i];
      const targetNo = q.noFstb.trim() || batchNoFstb.trim();
      if (!targetNo) {
        showToast?.(`Berkas "${q.file.name}" belum memiliki Nomor FSTB. Harap lengkapi.`, 'error');
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Kelompokkan per nomor FSTB
      const groups = new Map<string, QueuedFile[]>();
      for (const q of targetQueue) {
        const no = sanitizeFstbNumber(q.noFstb.trim() || batchNoFstb.trim());
        if (!groups.has(no)) {
          groups.set(no, []);
        }
        groups.get(no)!.push(q);
      }

      let totalSuccess = 0;
      let groupIndex = 0;
      const totalGroups = groups.size;

      const groupEntries = Array.from(groups.entries());
      for (const [cleanNoFstb, items] of groupEntries) {
        const formData = new FormData();
        formData.append('noFstb', cleanNoFstb);

        const armadaVal = items[0].armada || batchArmada || '-';
        const doNoVal = items[0].doNo || batchDoNo || '';
        const noFpbVal = items[0].noFpb || batchNoFpb || '';

        formData.append('armada', armadaVal);
        formData.append('doNo', doNoVal);
        formData.append('noFpb', noFpbVal);
        formData.append('receivedDate', batchReceivedDate);
        formData.append('keterangan', batchKeterangan);

        // Identitas & Tanda Tangan Uploader
        if (uploaderName.trim()) {
          formData.append('uploaderName', uploaderName.trim());
        }
        if (user?.username) {
          formData.append('uploaderUsername', user.username);
        }
        if (user?.role) {
          formData.append('uploaderRole', user.role);
        }
        if (user?.nik) {
          formData.append('uploaderNik', user.nik);
        }
        if (user?.jabatan) {
          formData.append('uploaderJabatan', user.jabatan);
        }
        if (enableAutoStamp) {
          formData.append('autoStamp', 'true');
          formData.append('stampDate', formatFstbStampDate(batchReceivedDate));
          if (user?.signature?.signatureDataUrl) {
            formData.append('signatureDataUrl', user.signature.signatureDataUrl);
          }
        }

        items.forEach((item: QueuedFile) => {
          formData.append('files', item.file);
        });

        const res = await fetch('/api/upload-fstb', {
          method: 'POST',
          body: formData,
        });

        const result: UploadFstbResponse = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || `Gagal mengunggah berkas untuk ${cleanNoFstb}`);
        }

        totalSuccess += items.length;
        groupIndex++;
        setUploadProgress(10 + Math.round((groupIndex / totalGroups) * 85));
      }

      setUploadProgress(100);
      showToast?.(
        `Sukses! ${totalSuccess} berkas FSTB berhasil diarsipkan ke Cloudflare R2.`,
        'success'
      );

      // Buka Modal Notifikasi WhatsApp otomatis untuk memberi tahu Tim PIC TTB
      const primaryGroup = targetQueue[0];
      const primaryCleanNoFstb =
        primaryGroup?.noFstb && primaryGroup.noFstb.trim()
          ? sanitizeFstbNumber(primaryGroup.noFstb)
          : batchNoFstb
          ? sanitizeFstbNumber(batchNoFstb)
          : 'FSTB BARU';

      setWaModalData({
        noFstb: primaryCleanNoFstb,
        noPo: primaryGroup?.doNo || batchDoNo || undefined,
        noFpb: primaryGroup?.noFpb || batchNoFpb || undefined,
        armada: primaryGroup?.armada || batchArmada || undefined,
        uploaderName: uploaderName.trim() || user?.name || 'Purchasing',
        uploaderRole: user?.role || 'Purchasing',
        fileCount: totalSuccess,
      });
      setIsWaModalOpen(true);

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
        setBatchNoFstb('');
        setBatchArmada('');
        setBatchDoNo('');
        setBatchNoFpb('');
      }

      await fetchHistory();
    } catch (err) {
      showToast?.((err as Error).message || 'Terjadi kesalahan saat mengunggah.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Proses Upload ke Cloudflare R2 dengan proteksi duplikat
  const handleExecuteUpload = async () => {
    if (queue.length === 0) {
      showToast?.('Pilih setidaknya 1 berkas FSTB untuk diunggah.', 'warning');
      return;
    }

    // Jika ada berkas terindikasi duplikat, buka dialog peringatan
    if (hasDuplicateInQueue) {
      setIsDuplicateModalOpen(true);
      return;
    }

    await processUploadForQueue(queue);
  };

  // Salin Nomor FSTB
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast?.(`Nomor FSTB "${text}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast?.('Gagal menyalin.', 'warning');
    }
  };

  // Hapus Berkas dari Riwayat
  const handleDeleteHistoryItem = async (item: UploadedFstbItem) => {
    if (!window.confirm(`Hapus berkas FSTB "${item.renamedFileName}" dari penyimpanan Cloudflare R2?`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(
        `/api/upload-fstb?id=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.renamedFileName)}`,
        { method: 'DELETE' }
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
        h.noFstb?.toLowerCase().includes(q) ||
        h.cleanNoFstb?.toLowerCase().includes(q) ||
        h.armada?.toLowerCase().includes(q) ||
        h.doNo?.toLowerCase().includes(q) ||
        h.noFpb?.toLowerCase().includes(q) ||
        h.renamedFileName?.toLowerCase().includes(q) ||
        h.uploaderName?.toLowerCase().includes(q)
    );
  }, [history, searchHistory]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = history.length;
    const pdfCount = history.filter((h) => h.fileType === 'application/pdf' || h.renamedFileName.endsWith('.pdf')).length;
    const imgCount = total - pdfCount;
    const r2Count = history.filter((h) => h.storageProvider === 'CLOUDFLARE_R2' || h.status === 'STORED_IN_CLOUDFLARE_R2').length;
    return { total, pdfCount, imgCount, r2Count };
  }, [history]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Header */}
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
                  Upload Dokumen FSTB
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Cloudflare R2
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  CPL-PRC-SOP-001-F03
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pengarsipan berkas Form Serah Terima Barang (FSTB) resmi ke Cloudflare R2 dengan sistem penamaan otomatis sesuai Nomor FSTB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* KPI Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/70">
          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <FileCheck className="size-3.5 text-primary" />
              Total Berkas FSTB
            </span>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {stats.total.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <FileText className="size-3.5 text-blue-500" />
              Berkas PDF Resmi
            </span>
            <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
              {stats.pdfCount.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-amber-500" />
              Bukti Foto Fisik
            </span>
            <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {stats.imgCount.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-background/80 border border-border rounded-xl p-3">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <Database className="size-3.5 text-emerald-500" />
              Cloudflare R2
            </span>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.r2Count.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Upload Dropzone & Queue Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Kolom Kiri: Dropzone & Antrean Berkas */}
        <div className="h-full flex flex-col justify-between space-y-4">
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
                <span>Mendukung Multi-FSTB &amp; Multi-Upload</span>
              </div>
              <p className="text-sm font-bold text-foreground">
                Tarik &amp; Letakkan berkas FSTB di sini, atau{' '}
                <span className="text-primary underline underline-offset-2">Pilih Banyak Berkas Sekaligus</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Bisa mengunggah <strong>banyak nomor FSTB berbeda sekaligus</strong> (Batch Multi-FSTB) maupun berkas lampiran multi-halaman/foto.
              </p>
              <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                Format otomatis: <strong>CPL-FSTB-26-05241.pdf</strong> (nomor FSTB, armada, &amp; PO terdeteksi otomatis per berkas)
              </p>
            </div>
          </div>

          {/* Daftar Antrean Berkas (Jika Ada) */}
          {queue.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Antrean Berkas ({queue.length})
                  </h3>
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
                        Nomor berkas FSTB ini telah terdaftar di riwayat Cloudflare R2 sebelumnya. Untuk menghindari data ganda, disarankan melewati (skip) atau menghapus berkas baru ini.
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

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {queue.map((item, idx) => {
                  const dupInfo = checkFstbDuplicate(item.noFstb, item.file.name);
                  const isDup = Boolean(dupInfo);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        isDup
                          ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20'
                          : 'border-border bg-background/70 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`size-5 rounded-full text-[10px] font-bold font-mono flex items-center justify-center shrink-0 ${
                              isDup ? 'bg-amber-500 text-white' : 'bg-primary/15 text-primary'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          {item.isPdf ? (
                            <FileText className="size-4 text-blue-500 shrink-0" />
                          ) : (
                            <ImageIcon className="size-4 text-amber-500 shrink-0" />
                          )}
                          <span
                            className="font-mono text-xs font-semibold text-foreground truncate"
                            title={item.file.name}
                          >
                            {item.file.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono flex items-center gap-1">
                            <span>({formatFileSize(item.file.size)})</span>
                            {item.isOptimized && item.savingsPercent && item.savingsPercent > 5 ? (
                              <span
                                className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] border border-emerald-500/30"
                                title={`Foto diskalakan & dikompres otomatis dari ${formatByteSize(item.originalSize || 0)} ke ${formatByteSize(item.compressedSize || 0)}`}
                              >
                                ⚡ -{item.savingsPercent}%
                              </span>
                            ) : null}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isDup && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <AlertCircle className="size-3 text-amber-600 dark:text-amber-400" />
                              <span>Sudah Diupload</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="text-muted-foreground hover:text-red-500 p-1 rounded-md transition"
                            title={isDup ? 'Hapus berkas duplikat ini dari antrean' : 'Hapus dari antrean'}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Notifikasi jika berkas ini terindikasi duplikat */}
                      {isDup && dupInfo && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-foreground">
                              Tercatat di Riwayat: <span className="font-mono text-primary">{dupInfo.renamedFileName}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Diunggah: {dupInfo.receivedDate || (dupInfo.uploadedAt ? new Date(dupInfo.uploadedAt).toLocaleDateString('id-ID') : '-')} &bull; Oleh: {dupInfo.uploaderName || 'Sistem'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDuplicateFile(item.id)}
                            className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                            title="Hapus data baru ini untuk mencegah double posting"
                          >
                            <Trash2 className="size-3" />
                            <span>Hapus Data Baru</span>
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                        <div>
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                            Nomor FSTB:
                          </label>
                          <input
                            type="text"
                            value={item.noFstb}
                            onChange={(e) =>
                              handleUpdateQueueItem(item.id, 'noFstb', e.target.value)
                            }
                            placeholder="CPL-FSTB-26-05241"
                            className="w-full h-7 px-2 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                            Armada / Unit Kapal:
                          </label>
                          <input
                            type="text"
                            value={item.armada}
                            onChange={(e) =>
                              handleUpdateQueueItem(item.id, 'armada', e.target.value)
                            }
                            placeholder="UB CMPL 01"
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

        {/* Kolom Kanan: Pengaturan Identitas & Tombol Upload */}
        <div className="h-full flex flex-col justify-between bg-card border border-border rounded-2xl p-6 shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldCheck className="size-4 text-primary" />
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  KONFIGURASI METADATA FSTB
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Nomor FSTB Default (Batch):
                </label>
                <input
                  type="text"
                  value={batchNoFstb}
                  onChange={(e) => setBatchNoFstb(e.target.value)}
                  placeholder="Cth: CPL-FSTB-26-05241"
                  className="w-full h-8.5 px-3 rounded-lg border border-border bg-background text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Armada / User:
                  </label>
                  <input
                    type="text"
                    value={batchArmada}
                    onChange={(e) => setBatchArmada(e.target.value)}
                    placeholder="Cth: UB CMPL 01"
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
                  placeholder="Catatan tambahan FSTB (misal: cat bottom & top side)..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              {/* Card Sub-Pengaturan: Identitas Uploader & Auto-Stamp */}
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                    <PenTool className="size-3.5" />
                    <div>
                      <span className="font-bold">Identitas Uploader &amp; Stempel</span>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-foreground font-medium">
                    <input
                      type="checkbox"
                      checked={enableAutoStamp}
                      onChange={(e) => setEnableAutoStamp(e.target.checked)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span>Auto-Stamp PDF</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium block">
                    Nama Uploader (Purchasing / Logistic Staff):
                  </label>
                  <input
                    type="text"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    placeholder="Nama lengkap uploader"
                    className="w-full h-7 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {enableAutoStamp && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Sistem akan secara otomatis menyematkan nama uploader, tanda tangan digital akun (jika tersimpan di Admin Settings), dan tanggal pada kolom formulir FSTB resmi.
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
                      ? distinctFstbCount > 1
                        ? `Unggah ${queue.length} Berkas (${distinctFstbCount} No. FSTB)`
                        : `Unggah ${queue.length} Berkas FSTB`
                      : 'ke Cloudflare R2'}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Upload FSTB */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Riwayat Pengarsipan Berkas FSTB
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
              placeholder="Cari nomor FSTB, armada, PO..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">NO. FSTB RESMI</th>
                <th className="py-2.5 px-3">ARMADA / USER</th>
                <th className="py-2.5 px-3">NO. DO / PO</th>
                <th className="py-2.5 px-3">UPLOADER</th>
                <th className="py-2.5 px-3">TGL &amp; WAKTU UPLOAD</th>
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
                        Memuat riwayat FSTB...
                      </span>
                    ) : (
                      'Belum ada data riwayat upload FSTB.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{item.noFstb}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.noFstb, item.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Salin No FSTB"
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
                      {item.doNo || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.uploaderName ? (
                        <span className="font-semibold text-foreground text-[11px] block">
                          {item.uploaderName}
                        </span>
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
                          href={item.fileUrl}
                          download={item.renamedFileName}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition"
                          title="Unduh Berkas"
                        >
                          <Download className="size-3.5" />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteHistoryItem(item)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition cursor-pointer"
                            title="Hapus Berkas dari Cloudflare R2"
                          >
                            <Trash2 className="size-3.5" />
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
      </div>

      {/* Modal Preview Berkas */}
      {activePreview && (
        <div
          onClick={() => setActivePreview(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
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
                    No. FSTB: <strong className="text-foreground">{activePreview.noFstb}</strong> • Armada: {activePreview.armada || '-'}
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
                  className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-black/95 p-2 flex items-center justify-center min-h-[450px]">
              {activePreview.fileType === 'application/pdf' || activePreview.renamedFileName.endsWith('.pdf') ? (
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
      {/* ============================================================== */}
      {/* MODAL: PERINGATAN TERINDIKASI DOUBLE UPLOAD / POSTING FSTB     */}
      {/* ============================================================== */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-5 border-b border-border bg-linear-to-r from-amber-500/15 via-rose-500/10 to-transparent flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>Peringatan Double Upload FSTB</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono">
                      {duplicateQueueItems.length} Duplikat
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data terindikasi telah diupload atau diposting sebelumnya di sistem
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong className="font-semibold block mb-1">Rekomendasi Pencegahan Double Posting:</strong>
                Sistem mendeteksi <strong>{duplicateQueueItems.length} berkas</strong> dalam antrean sudah pernah diarsipkan di Cloudflare R2.
                Untuk menjaga integritas data riwayat, Anda disarankan untuk <strong>Melewati (Skip)</strong> data duplikat atau <strong>Hapus Berkas Baru</strong>.
              </div>

              <div>
                <h4 className="font-bold text-foreground uppercase tracking-wide text-[11px] mb-2">
                  Daftar Berkas yang Terindikasi Duplikat:
                </h4>
                <div className="border border-border rounded-xl divide-y divide-border overflow-hidden max-h-52 overflow-y-auto">
                  {duplicateQueueItems.map(({ item, existing }, idx) => (
                    <div key={item.id} className="p-2.5 bg-muted/20 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">
                          {idx + 1}. {item.file.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Nomor FSTB: <span className="text-primary font-bold">{item.noFstb || batchNoFstb}</span>
                        </div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400">
                          Sudah diupload: {existing.receivedDate || existing.uploadedAt?.slice(0, 10)} oleh {existing.uploaderName || 'Sistem'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDuplicateFile(item.id)}
                        className="px-2 py-1 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold transition cursor-pointer shrink-0"
                        title="Hapus data baru ini dari antrean"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSkipAllDuplicates}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition cursor-pointer text-center"
              >
                Hapus Semua Data Baru Ini
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleProceedOverwrite}
                  className="px-3 py-2 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-semibold transition cursor-pointer"
                  title="Tetap unggah dan perbarui dokumen yang sudah ada"
                >
                  Timpa Dokumen Lama
                </button>
                <button
                  type="button"
                  onClick={handleSkipDuplicatesAndUploadRest}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Skip Duplikat &amp; Upload Sisanya</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal WhatsApp Notifikasi Pekerjaan ke Tim TTB */}
      <FstbSuccessWaModal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        noFstb={waModalData.noFstb}
        noPo={waModalData.noPo}
        noFpb={waModalData.noFpb}
        armada={waModalData.armada}
        uploaderName={waModalData.uploaderName}
        uploaderRole={waModalData.uploaderRole}
        fileCount={waModalData.fileCount}
        showToast={showToast}
      />
    </div>
  );
}
