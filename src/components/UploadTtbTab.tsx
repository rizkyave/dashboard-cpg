'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Camera,
  Bell,
  MessageCircle,
  Send,
  Share2,
  Clock,
  Lock,
  Unlock,
  BellRing,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import { UploadedFstbItem } from '@/types/fstbUpload';
import { RemoteHandoverTokenData } from '@/types/remoteHandover';
import { DocumentValidationRecord } from '@/types/documentValidation';
import { resolveDocRelation } from '@/utils/docRelationResolver';
import RemoteDispatchModal from '@/components/RemoteDispatchModal';
import { enrichTtbRecords } from '@/utils/ttbEnricher';
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
import { getSignatureForUploader } from '@/utils/uploaderSignatures';
import CameraWatermarkModal from '@/components/CameraWatermarkModal';
import TtbMediaModal from '@/components/TtbMediaModal';
import { parseTtbList } from '@/utils/timemark';


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
  noFstb?: string;
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
  noFstb?: string;
  description?: string;
}

/**
 * Mendeteksi Nomor TTB, Armada, dan No. FPB/PO/FSTB secara cerdas dan presisi dari nama berkas dan dataset.
 */
function detectTtbAndArmada(
  fileName: string,
  suggestions: TtbSuggestion[] = []
): { noTtb: string; armada: string; doNo: string; noFpb: string; noFstb?: string; isAutoMatched: boolean } {
  const components = extractTtbComponents(fileName);

  let finalNoTtb = components.canonicalTtb || '';
  let matchedArmada = '';
  let matchedDoNo = '';
  let matchedNoFpb = '';
  let matchedNoFstb = '';

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
        matchedNoFstb = exactMatch.noFstb || '';
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
        matchedNoFstb = best.noFstb || '';
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
    noFstb: matchedNoFstb,
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
    if (user?.name) {
      if (user.username === 'nurul.hafifah' || user.name.toUpperCase().includes('HAFIFAH')) {
        setUploaderName('FIFI');
      } else if (user.username === 'idham.khalid' || user.name.toUpperCase().includes('IDHAM')) {
        setUploaderName('IDHAM KHALID');
      } else if (user.username === 'davila.zalianti' || user.name.toUpperCase().includes('DAVILA')) {
        setUploaderName('DAVILA');
      } else {
        setUploaderName(user.name);
      }
    }
  }, [user?.name, user?.username]);

    useEffect(() => {
    const fallbackSig = getSignatureForUploader(uploaderName || user?.username || user?.name);
    if (user?.signature?.signatureDataUrl) {
      convertSvgToPngDataUrl(user.signature.signatureDataUrl).then((sig) => {
        setUserSignaturePng(sig || fallbackSig);
      });
    } else {
      setUserSignaturePng(fallbackSig);
    }
  }, [user?.signature?.signatureDataUrl, uploaderName, user?.username, user?.name]);

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
  const [mediaModalTtb, setMediaModalTtb] = useState<string | null>(null);
  const [selectedMediaItem, setSelectedMediaItem] = useState<UploadedTtbItem | null>(null);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState<boolean>(false);
  const [pendingDispatchItem, setPendingDispatchItem] = useState<UploadedTtbItem | null>(null);
  const [statusFilterTab, setStatusFilterTab] = useState<'ALL' | 'UNVALIDATED' | 'READY_WA' | 'PENDING_CREW' | 'COMPLETED'>('ALL');
  const [remoteTokens, setRemoteTokens] = useState<Record<string, RemoteHandoverTokenData>>({});
  const [validationsMap, setValidationsMap] = useState<Record<string, DocumentValidationRecord>>({});

  // SOP Control: Wajib FSTB Terunggah Sebelum Terbit TTB (Hanya dapat diubah Admin)
  const [sopRequireFstb, setSopRequireFstb] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cpg_sop_require_fstb');
      return saved !== 'false'; // Default TRUE (SOP Ketat Aktif)
    }
    return true;
  });
  const [uploadedFstbs, setUploadedFstbs] = useState<UploadedFstbItem[]>([]);
  const [isMissingFstbModalOpen, setIsMissingFstbModalOpen] = useState<boolean>(false);
  const [missingFstbQueueItems, setMissingFstbQueueItems] = useState<{
    item: QueuedFile;
    fstbInfo: { hasFstb: boolean; expectedFstb: string; noFpb: string; noPo: string; armada?: string };
  }[]>([]);
  const [isNotifyingFstb, setIsNotifyingFstb] = useState<boolean>(false);

  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  // Floating Reminder State (Dismissible Reminder Terbang SOP Logistik)
  const [showFloatingReminder, setShowFloatingReminder] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cpg_ttb_pair_reminder_closed');
      if (saved === 'true') {
        setShowFloatingReminder(false);
      }
    } catch {}
  }, []);

  // Cloudflare Storage Connection Test State
  const [isTestingStorage, setIsTestingStorage] = useState<boolean>(false);

  // Cadangan data pengadaan jika props awal dari halaman utama belum selesai termuat
  const [internalProcurement, setInternalProcurement] = useState<ProcurementItem[]>([]);
  const effectiveProcurement = useMemo(() => {
    return procurementItems && procurementItems.length > 0 ? procurementItems : internalProcurement;
  }, [procurementItems, internalProcurement]);

  // Auto-fetch data pengadaan terbaru dari /api/dashboard-sync jika prop kosong
  useEffect(() => {
    if (!procurementItems || procurementItems.length === 0) {
      fetch('/api/dashboard-sync')
        .then((r) => r.json())
        .then((res) => {
          if (res.success && Array.isArray(res.procurement) && res.procurement.length > 0) {
            setInternalProcurement(res.procurement);
          }
        })
        .catch(() => {});
    }
  }, [procurementItems]);

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
            noFstb: item.noFstb || '',
            description: item.namaBarang || '',
          });
        }
      }
    }

    // 2. Dari Procurement
    for (const item of effectiveProcurement) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.deptArmada || item.peruntukan || '',
            noFpb: item.fpb || '',
            doNo: item.po || '',
            noFstb: item.noFstb || '',
            description: item.item || '',
          });
        } else {
          if (!existing.noFstb && item.noFstb) existing.noFstb = item.noFstb;
          if (!existing.armada && item.deptArmada) existing.armada = item.deptArmada;
          if (!existing.doNo && item.po) existing.doNo = item.po;
          if (!existing.noFpb && item.fpb) existing.noFpb = item.fpb;
        }
      }
    }

    // 3. Dari Armada
    for (const item of armadaItems) {
      const rawTtb = (item.noTtb || '').trim();
      if (rawTtb && rawTtb !== '-' && rawTtb.length >= 3) {
        const key = rawTtb.toUpperCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            noTtb: rawTtb,
            armada: item.armada || '',
            noFpb: item.fpb || '',
            doNo: item.noPo || '',
            noFstb: item.noFstb || '',
            description: item.item || '',
          });
        } else {
          if (!existing.noFstb && item.noFstb) existing.noFstb = item.noFstb;
          if (!existing.armada && item.armada) existing.armada = item.armada;
        }
      }
    }

    // 4. Dari Uploaded FSTB
    for (const item of uploadedFstbs) {
      const rawFstb = (item.cleanNoFstb || item.noFstb || '').trim();
      const rawPo = (item.doNo || '').trim();
      const rawFpb = (item.noFpb || '').trim();
      if (rawFstb) {
        const procByFstb = effectiveProcurement.find((p) => (p.noFstb || '').trim().toUpperCase() === rawFstb.toUpperCase());
        if (procByFstb && procByFstb.noTtb) {
          const key = procByFstb.noTtb.trim().toUpperCase();
          const existing = map.get(key);
          if (existing) {
            existing.noFstb = rawFstb;
            if (item.armada && item.armada !== '-') existing.armada = item.armada;
          } else {
            map.set(key, {
              noTtb: procByFstb.noTtb.trim(),
              armada: item.armada && item.armada !== '-' ? item.armada : procByFstb.deptArmada || '',
              noFpb: rawFpb || procByFstb.fpb || '',
              doNo: rawPo || procByFstb.po || '',
              noFstb: rawFstb,
              description: procByFstb.item || '',
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [effectiveProcurement, armadaItems, sisaLayananItems, uploadedFstbs]);

  // Kumpulan saran nomor FSTB untuk autocomplete pilihan manual jika relasi baru belum tercatat
  const fstbSuggestionsList = useMemo(() => {
    const list: { noFstb: string; armada?: string; doNo?: string; isUploaded?: boolean }[] = [];
    const seen = new Set<string>();

    for (const f of uploadedFstbs) {
      const num = (f.cleanNoFstb || f.noFstb || '').trim();
      if (num && !seen.has(num.toUpperCase())) {
        seen.add(num.toUpperCase());
        list.push({
          noFstb: num,
          armada: f.armada !== '-' ? f.armada : undefined,
          doNo: f.doNo,
          isUploaded: true,
        });
      }
    }

    Object.values(validationsMap).forEach((rec) => {
      if (rec.docType === 'FSTB' || rec.id?.startsWith('val-fstb-') || (rec.cleanDocNumber || rec.docNumber || '').includes('FSTB')) {
        const num = (rec.cleanDocNumber || rec.docNumber || '').trim();
        if (num && !seen.has(num.toUpperCase())) {
          seen.add(num.toUpperCase());
          list.push({
            noFstb: num,
            armada: rec.armada,
            doNo: rec.poNumber,
            isUploaded: true,
          });
        }
      }
    });

    for (const p of effectiveProcurement) {
      const num = (p.noFstb || '').trim();
      if (num && !seen.has(num.toUpperCase())) {
        seen.add(num.toUpperCase());
        list.push({
          noFstb: num,
          armada: p.deptArmada,
          doNo: p.po,
          isUploaded: false,
        });
      }
    }

    return list;
  }, [uploadedFstbs, validationsMap, effectiveProcurement]);

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
        if (typeof data.sopRequireFstb === 'boolean') {
          setSopRequireFstb(data.sopRequireFstb);
          try {
            localStorage.setItem('cpg_sop_require_fstb', String(data.sopRequireFstb));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat upload TTB:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch token serah terima mandiri WhatsApp
  const fetchRemoteTokens = async () => {
    try {
      const res = await fetch(`/api/remote-handover?_t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.tokens)) {
          const map: Record<string, RemoteHandoverTokenData> = {};
          d.tokens.forEach((t: RemoteHandoverTokenData) => {
            if (t.cleanNoTtb) map[t.cleanNoTtb.toUpperCase().trim()] = t;
            if (t.noTtb) map[t.noTtb.toUpperCase().trim()] = t;
            if (t.ttbId) map[t.ttbId.toUpperCase().trim()] = t;
          });
          setRemoteTokens(map);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat status remote handover:', err);
    }
  };

  // Fetch status pengesahan & validasi dokumen dari Manajer Procurement & Lini Logistik (Semua tipe dokumen)
  const fetchValidations = async () => {
    try {
      const res = await fetch(`/api/validasi-dokumen?_t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.records)) {
          const map: Record<string, DocumentValidationRecord> = {};
          d.records.forEach((rec: DocumentValidationRecord) => {
            const key = (rec.cleanDocNumber || rec.docNumber || '').toUpperCase().trim();
            if (key) map[key] = rec;
          });
          setValidationsMap(map);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat data validasi dokumen:', err);
    }
  };

  // Fetch riwayat FSTB yang telah terunggah di Cloudflare R2
  const fetchUploadedFstbs = async () => {
    try {
      const res = await fetch(`/api/upload-fstb?_t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        const fstbList = Array.isArray(d.items) ? d.items : Array.isArray(d.history) ? d.history : [];
        if (fstbList.length > 0) {
          setUploadedFstbs(fstbList);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat data riwayat FSTB:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchRemoteTokens();
    fetchValidations();
    fetchUploadedFstbs();
  }, []);

  // Helper memverifikasi keberadaan FSTB untuk nomor TTB tertentu
  const checkFstbPrerequisite = useCallback((rawTtb: string, noFpb?: string, noPo?: string, explicitFstb?: string) => {
    const cleanTtb = sanitizeTtbNumber(rawTtb);
    if (!cleanTtb) return { hasFstb: true, expectedFstb: '', noFpb: '', noPo: '', armada: '' };

    // Kumpulan nomor FSTB yang terverifikasi ada di Cloudflare R2 (dari upload & validasi)
    const uploadedFstbKeys = new Set(
      uploadedFstbs.map((f) => (f.cleanNoFstb || f.noFstb || '').toUpperCase().trim()).filter(Boolean)
    );

    // Tambahkan juga dari records validasi yang bertipe FSTB
    Object.values(validationsMap).forEach((rec) => {
      if (rec.docType === 'FSTB' || rec.id?.startsWith('val-fstb-') || (rec.cleanDocNumber || rec.docNumber || '').includes('FSTB')) {
        const k1 = (rec.cleanDocNumber || '').toUpperCase().trim();
        const k2 = (rec.docNumber || '').toUpperCase().trim();
        if (k1) uploadedFstbKeys.add(k1);
        if (k2) uploadedFstbKeys.add(k2);
      }
    });

    const isFstbPresentInSystem = (fstbCandidate: string): boolean => {
      if (!fstbCandidate) return false;
      const cleanCand = fstbCandidate.toUpperCase().trim();
      if (uploadedFstbKeys.has(cleanCand)) return true;
      const candDigits = cleanCand.replace(/\D/g, '');
      if (candDigits.length >= 4) {
        for (const key of Array.from(uploadedFstbKeys)) {
          const kDigits = key.replace(/\D/g, '');
          if (kDigits === candDigits || (kDigits.length >= 4 && (kDigits.endsWith(candDigits) || candDigits.endsWith(kDigits)))) {
            return true;
          }
        }
      }
      return false;
    };

    // 0. Cek jika pengguna memasukkan / memilih No. FSTB secara eksplisit pada antrean
    if (explicitFstb && explicitFstb.trim()) {
      const cleanExp = explicitFstb.toUpperCase().trim();
      const isPresent = isFstbPresentInSystem(cleanExp);
      const fstbObj = uploadedFstbs.find((f) => (f.cleanNoFstb || f.noFstb || '').toUpperCase().trim() === cleanExp);
      const procObj = effectiveProcurement.find((p) => (p.noFstb || '').toUpperCase().trim() === cleanExp);
      const sisaObj = sisaLayananItems.find((s) => (s.noFstb || '').toUpperCase().trim() === cleanExp);
      const matchedArmada = fstbObj?.armada && fstbObj.armada !== '-' ? fstbObj.armada : (procObj?.deptArmada || sisaObj?.departement || '');
      const matchedPo = fstbObj?.doNo || procObj?.po || sisaObj?.noPo || noPo || '';
      const matchedFpb = fstbObj?.noFpb || procObj?.fpb || sisaObj?.noFpb || noFpb || '';

      if (isPresent) {
        return { hasFstb: true, expectedFstb: cleanExp, noFpb: matchedFpb, noPo: matchedPo, armada: matchedArmada };
      }
      return { hasFstb: false, expectedFstb: cleanExp, noFpb: matchedFpb, noPo: matchedPo, armada: matchedArmada };
    }

    // 1. Cek relasi dari database saran TTB (ttbSuggestions yang sudah di-enrich)
    const tDigits = cleanTtb.replace(/\D/g, '');
    const suggMatch = ttbSuggestions.find((s) => {
      if (s.noTtb.toUpperCase() === cleanTtb.toUpperCase()) return true;
      const sDig = s.noTtb.replace(/\D/g, '');
      return sDig && tDigits && (sDig === tDigits || sDig.endsWith(tDigits) || tDigits.endsWith(sDig));
    });

    if (suggMatch && suggMatch.noFstb) {
      const sFstb = suggMatch.noFstb.toUpperCase().trim();
      if (isFstbPresentInSystem(sFstb)) {
        return {
          hasFstb: true,
          expectedFstb: suggMatch.noFstb,
          noFpb: suggMatch.noFpb || noFpb || '',
          noPo: suggMatch.doNo || noPo || '',
          armada: suggMatch.armada || '',
        };
      }
    }

    // 2. Cek relasi dari docRelationResolver
    const relation = resolveDocRelation('TTB', cleanTtb, noFpb, noPo);
    const resolvedFpb = noFpb || relation.fpbNumber || '';
    const resolvedPo = noPo || relation.poNumber || '';
    const candidateFstbs = relation.relatedFstbs || [];

    const foundFstb = candidateFstbs.find((fstb) => isFstbPresentInSystem(fstb));
    if (foundFstb) {
      return { hasFstb: true, expectedFstb: foundFstb, noFpb: resolvedFpb, noPo: resolvedPo, armada: relation.armada };
    }

    // 3. Cek dari dataset procurementItems
    const procMatch = (effectiveProcurement || []).find((p) => {
      const pTtb = (p.noTtb || (p as any).ttb || '').replace(/\D/g, '');
      return pTtb && tDigits && (pTtb === tDigits || pTtb.endsWith(tDigits) || tDigits.endsWith(pTtb));
    });
    const procFstb = procMatch?.noFstb || (procMatch as any)?.fstb;
    if (procFstb) {
      const fstbClean = procFstb.toUpperCase().trim();
      const armadaName = procMatch?.deptArmada || (procMatch as any)?.kapal || relation.armada;
      const poName = procMatch?.po || procMatch?.noPo || resolvedPo;
      const fpbName = procMatch?.fpb || resolvedFpb;
      if (isFstbPresentInSystem(fstbClean)) {
        return { hasFstb: true, expectedFstb: procFstb, noFpb: fpbName, noPo: poName, armada: armadaName };
      }
      return { hasFstb: false, expectedFstb: procFstb, noFpb: fpbName, noPo: poName, armada: armadaName };
    }

    // 4. Cek dari sisaLayananItems
    const sisaMatch = (sisaLayananItems || []).find((s) => {
      const sTtb = (s.noTtb || '').replace(/\D/g, '');
      return sTtb && tDigits && (sTtb === tDigits || sTtb.endsWith(tDigits) || tDigits.endsWith(sTtb));
    });
    const sisaFstb = sisaMatch?.noFstb;
    if (sisaFstb) {
      const fstbClean = sisaFstb.toUpperCase().trim();
      const armadaName = sisaMatch?.departement || sisaMatch?.pt || relation.armada;
      const poName = sisaMatch?.noPo || resolvedPo;
      const fpbName = sisaMatch?.noFpb || resolvedFpb;
      if (isFstbPresentInSystem(fstbClean)) {
        return { hasFstb: true, expectedFstb: sisaFstb, noFpb: fpbName, noPo: poName, armada: armadaName };
      }
      return { hasFstb: false, expectedFstb: sisaFstb, noFpb: fpbName, noPo: poName, armada: armadaName };
    }

    // 5. Cek apakah PO yang sama sudah memiliki berkas FSTB di R2
    if (resolvedPo) {
      const matchByPo = uploadedFstbs.find((f) => (f.doNo || '').toUpperCase().trim() === resolvedPo.toUpperCase().trim());
      if (matchByPo) {
        return { hasFstb: true, expectedFstb: matchByPo.cleanNoFstb || matchByPo.noFstb || '', noFpb: resolvedFpb, noPo: resolvedPo, armada: matchByPo.armada || relation.armada };
      }
    }

    // 6. Cek apakah FPB yang sama sudah memiliki berkas FSTB di R2
    if (resolvedFpb) {
      const matchByFpb = uploadedFstbs.find((f) => (f.noFpb || '').toUpperCase().trim() === resolvedFpb.toUpperCase().trim());
      if (matchByFpb) {
        return { hasFstb: true, expectedFstb: matchByFpb.cleanNoFstb || matchByFpb.noFstb || '', noFpb: resolvedFpb, noPo: resolvedPo, armada: matchByFpb.armada || relation.armada };
      }
    }

    // 7. Cek pencocokan digit langsung FSTB (misal CPL-TTB-26-06669 <-> CPL-FSTB-26-06669)
    if (tDigits.length >= 4) {
      for (const fstbKey of Array.from(uploadedFstbKeys)) {
        const fDig = fstbKey.replace(/\D/g, '');
        if (fDig && (fDig === tDigits || fDig.endsWith(tDigits) || tDigits.endsWith(fDig))) {
          const matchFstb = uploadedFstbs.find((f) => (f.cleanNoFstb || f.noFstb || '').toUpperCase().trim() === fstbKey);
          return {
            hasFstb: true,
            expectedFstb: fstbKey,
            noFpb: matchFstb?.noFpb || resolvedFpb,
            noPo: matchFstb?.doNo || resolvedPo,
            armada: matchFstb?.armada || relation.armada,
          };
        }
      }
    }

    // 8. Jika ada saran FSTB tapi belum terunggah di R2
    if (suggMatch?.noFstb) {
      return {
        hasFstb: false,
        expectedFstb: suggMatch.noFstb,
        noFpb: suggMatch.noFpb || resolvedFpb,
        noPo: suggMatch.doNo || resolvedPo,
        armada: suggMatch.armada || relation.armada,
      };
    }

    // 9. Jika kandidat FSTB ada tapi belum terunggah di R2
    if (candidateFstbs.length > 0) {
      return { hasFstb: false, expectedFstb: candidateFstbs[0], noFpb: resolvedFpb, noPo: resolvedPo, armada: relation.armada };
    }

    return { hasFstb: false, expectedFstb: '', noFpb: resolvedFpb, noPo: resolvedPo, armada: relation.armada };
  }, [uploadedFstbs, effectiveProcurement, sisaLayananItems, armadaItems, ttbSuggestions, validationsMap]);

  // Handler toggle pengendalian SOP FSTB oleh Administrator (Sinkron ke Server & Cloudflare R2)
  const handleToggleSopRequireFstb = async () => {
    if (!isAdmin) {
      showToast?.('Akses Ditolak: Hanya Administrator yang berwenang mengubah pengendalian SOP FSTB.', 'error');
      return;
    }
    const newVal = !sopRequireFstb;
    setSopRequireFstb(newVal);
    try {
      localStorage.setItem('cpg_sop_require_fstb', String(newVal));
      await fetch('/api/upload-ttb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setSopRequireFstb',
          value: newVal,
          updatedBy: user?.username || user?.name || 'admin',
        }),
      });
    } catch (syncErr) {
      console.warn('Gagal sinkronisasi pengaturan SOP ke server:', syncErr);
    }
    if (newVal) {
      showToast?.('SOP KETAT DIAKTIFKAN: TTB wajib memiliki berkas FSTB yang telah terunggah.', 'info');
    } else {
      showToast?.('PERINGATAN: Mode Bypass SOP Aktif. Seluruh pengguna dapat mengunggah TTB tanpa FSTB.', 'warning');
    }
  };

  // Handler kirim notifikasi urgensi ke Tim FSTB
  const handleNotifyFstbTeam = async (
    itemsToNotify: {
      item: QueuedFile;
      fstbInfo: { hasFstb: boolean; expectedFstb: string; noFpb: string; noPo: string; armada?: string };
    }[]
  ) => {
    setIsNotifyingFstb(true);
    try {
      const ttbList = itemsToNotify.map((x) => x.item.noTtb || x.item.file.name).join(', ');
      const fpbList = Array.from(new Set(itemsToNotify.map((x) => x.fstbInfo.noFpb).filter(Boolean))).join(', ');
      const poList = Array.from(new Set(itemsToNotify.map((x) => x.fstbInfo.noPo).filter(Boolean))).join(', ');
      const armadaList = Array.from(new Set(itemsToNotify.map((x) => x.fstbInfo.armada).filter(Boolean))).join(', ');

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'FSTB_URGENT_REQUEST',
          title: '🚨 Peringatan SOP: Unggah Berkas FSTB Diperlukan Segera',
          message: `Penerbitan TTB (${ttbList}) untuk armada ${armadaList || 'kapal'} tertahan oleh SOP karena berkas FSTB terkait belum diunggah ke Cloudflare R2 (Ref FPB: ${fpbList || '-'}, PO: ${poList || '-'}). Mohon Tim FSTB segera mengunggah berkas tersebut di menu Unggah FSTB.`,
          senderName: user?.name || user?.username || 'Tim Logistik CPG',
          senderUsername: user?.username || 'logistik',
          senderRole: user?.role || 'logistik',
          targetRole: 'staf_purchasing',
          linkTab: 'upload-fstb',
          metadata: {
            noTtb: ttbList,
            noFpb: fpbList,
            noPo: poList,
            armada: armadaList,
            urgency: 'HIGH',
            sopBlocked: true,
          },
        }),
      });

      if (res.ok) {
        showToast?.(`Notifikasi urgensi berhasil dikirim ke Tim FSTB untuk ${itemsToNotify.length} berkas!`, 'success');
      } else {
        throw new Error('Gagal mengirimkan notifikasi ke Tim FSTB.');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Gagal mengirimkan notifikasi ke Tim FSTB.', 'error');
    } finally {
      setIsNotifyingFstb(false);
    }
  };

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

  // Struktur & Analisis Pasangan Berkas TTB (Pair Analysis: Wajib PDF Resmi & Foto Fisik Barang)
  interface QueuePairGroup {
    key: string;
    displayNoTtb: string;
    files: QueuedFile[];
    pdfFiles: QueuedFile[];
    photoFiles: QueuedFile[];
    hasPdf: boolean;
    hasPhoto: boolean;
    isComplete: boolean;
    hasHistoryPdf: boolean;
    hasHistoryPhoto: boolean;
    status: 'COMPLETE' | 'MISSING_PHOTO' | 'MISSING_PDF';
  }

  const queuePairAnalysis = useMemo(() => {
    const groupsMap = new Map<string, QueuePairGroup>();

    for (const item of queue) {
      const rawTtb = (item.noTtb.trim() || batchNoTtb.trim());
      let cleanKey = sanitizeTtbNumber(rawTtb);
      if (!cleanKey) {
        const baseName = item.file.name.replace(/\.[^/.]+$/, '').trim();
        cleanKey = sanitizeTtbNumber(baseName) || baseName;
      }
      const key = cleanKey.toUpperCase();

      if (!groupsMap.has(key)) {
        // Cek apakah di riwayat Cloudflare R2 sudah ada pasangannya
        const histMatches = history.filter((h) => {
          const cleanH = sanitizeTtbNumber(h.noTtb || h.cleanNoTtb || '');
          return cleanH && cleanH.toUpperCase() === key;
        });
        const hasHistoryPdf = histMatches.some(
          (h) => h.renamedFileName.toLowerCase().endsWith('.pdf') || h.fileType === 'application/pdf'
        );
        const hasHistoryPhoto = histMatches.some(
          (h) =>
            (!h.renamedFileName.toLowerCase().endsWith('.pdf') && h.fileType !== 'application/pdf') ||
            h.hasPhysicalPhotos ||
            (h.physicalPhotosCount && h.physicalPhotosCount > 0)
        );

        groupsMap.set(key, {
          key,
          displayNoTtb: item.noTtb || batchNoTtb || key,
          files: [],
          pdfFiles: [],
          photoFiles: [],
          hasPdf: false,
          hasPhoto: false,
          isComplete: false,
          hasHistoryPdf,
          hasHistoryPhoto,
          status: 'COMPLETE',
        });
      }

      const group = groupsMap.get(key)!;
      group.files.push(item);
      if (item.isPdf) {
        group.pdfFiles.push(item);
      } else if (item.isImage) {
        group.photoFiles.push(item);
      }
    }

    const groups = Array.from(groupsMap.values()).map((g) => {
      const hasPdf = g.pdfFiles.length > 0 || g.hasHistoryPdf;
      const hasPhoto = g.photoFiles.length > 0 || g.hasHistoryPhoto;
      const isComplete = hasPdf && hasPhoto;
      let status: 'COMPLETE' | 'MISSING_PHOTO' | 'MISSING_PDF' = 'COMPLETE';
      if (!isComplete) {
        if (hasPdf && !hasPhoto) {
          status = 'MISSING_PHOTO';
        } else if (!hasPdf && hasPhoto) {
          status = 'MISSING_PDF';
        }
      }
      return {
        ...g,
        hasPdf,
        hasPhoto,
        isComplete,
        status,
      };
    });

    const completeGroups = groups.filter((g) => g.isComplete);
    const incompleteGroups = groups.filter((g) => !g.isComplete);
    const missingPhotoGroups = groups.filter((g) => g.status === 'MISSING_PHOTO');
    const missingPdfGroups = groups.filter((g) => g.status === 'MISSING_PDF');

    const itemGroupMap = new Map<string, QueuePairGroup>();
    for (const g of groups) {
      for (const f of g.files) {
        itemGroupMap.set(f.id, g);
      }
    }

    return {
      groups,
      completeGroups,
      incompleteGroups,
      missingPhotoGroups,
      missingPdfGroups,
      hasIncomplete: incompleteGroups.length > 0,
      itemGroupMap,
    };
  }, [queue, history, batchNoTtb]);

  const hasIncompleteInQueue = queuePairAnalysis.hasIncomplete;

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

    const MAX_PHOTOS_PER_TTB = 10;

    for (const rawFile of files) {
      const ext = rawFile.name.slice(rawFile.name.lastIndexOf('.')).toLowerCase();
      const isImage = /\.(jpe?g|png|webp|gif)$/i.test(ext);
      const isPdf = /\.pdf$/i.test(ext);

      if (isImage) {
        const detectedEarly = detectTtbAndArmada(rawFile.name, ttbSuggestions);
        const ttbKey = sanitizeTtbNumber(detectedEarly.noTtb || batchNoTtb || '');
        if (ttbKey) {
          const currentPhotosForTtb =
            queue.filter((q) => q.isImage && sanitizeTtbNumber(q.noTtb || batchNoTtb) === ttbKey).length +
            newItems.filter((q) => q.isImage && sanitizeTtbNumber(q.noTtb || batchNoTtb) === ttbKey).length;
          if (currentPhotosForTtb >= MAX_PHOTOS_PER_TTB) {
            showToast?.(
              `Batas maksimal ${MAX_PHOTOS_PER_TTB} foto bukti fisik untuk TTB "${detectedEarly.noTtb || ttbKey}" telah tercapai. Berkas "${rawFile.name}" diabaikan.`,
              'warning'
            );
            continue;
          }
        }
      }

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
        noFstb: detected.noFstb || '',
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

            if (cleanDigits.length >= 3) {
              const found = ttbSuggestions.find((s) => {
                if (inputPrefix) {
                  const sComp = extractTtbComponents(s.noTtb);
                  if (sComp.prefix && sComp.prefix !== inputPrefix) return false;
                }
                const sDigits = s.noTtb.replace(/\D/g, '');
                return sDigits.endsWith(cleanDigits);
              });
              if (found) {
                if (found.armada && (!updated.armada || updated.armada === batchArmada)) updated.armada = found.armada;
                if (found.doNo && !updated.doNo) updated.doNo = found.doNo;
                if (found.noFpb && !updated.noFpb) updated.noFpb = found.noFpb;
                if (found.noFstb && !updated.noFstb) updated.noFstb = found.noFstb;
              }
            }
          } else if (field === 'noFstb' && typeof value === 'string') {
            const cleanDigits = value.replace(/\D/g, '');
            if (cleanDigits.length >= 3) {
              const matchFstb = uploadedFstbs.find((f) => {
                const fDig = (f.cleanNoFstb || f.noFstb || '').replace(/\D/g, '');
                return fDig && (fDig === cleanDigits || fDig.endsWith(cleanDigits));
              });
              if (matchFstb) {
                if (matchFstb.armada && matchFstb.armada !== '-' && (!updated.armada || updated.armada === batchArmada)) {
                  updated.armada = matchFstb.armada;
                }
                if (matchFstb.doNo && !updated.doNo) updated.doNo = matchFstb.doNo;
                if (matchFstb.noFpb && !updated.noFpb) updated.noFpb = matchFstb.noFpb;
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
        if (item.noFstb) formData.append('noFstb', item.noFstb.trim());
        formData.append('receivedDate', batchReceivedDate);
        formData.append('keterangan', batchKeterangan.trim());

        // Hitung urutan foto untuk nomor TTB ini (mendukung s/d 10 foto)
        if (item.isImage) {
          const histPhotosForTtb = history.filter((h) => {
            const hClean = sanitizeTtbNumber(h.noTtb || h.cleanNoTtb || '');
            const isImg = !h.renamedFileName.toLowerCase().endsWith('.pdf') && h.fileType !== 'application/pdf';
            return hClean === cleanNoTtb && isImg;
          });

          const queuePhotosForTtb = targetQueue.filter((q) => {
            const qClean = sanitizeTtbNumber(q.noTtb.trim() || batchNoTtb.trim());
            return qClean === cleanNoTtb && q.isImage;
          });

          const queuePhotoIdx = queuePhotosForTtb.indexOf(item);
          const photoIndex = Math.min(10, histPhotosForTtb.length + (queuePhotoIdx >= 0 ? queuePhotoIdx : 0) + 1);
          const totalPhotos = Math.min(10, histPhotosForTtb.length + queuePhotosForTtb.length);

          formData.append('photoIndex', String(photoIndex));
          formData.append('totalPhotos', String(totalPhotos));
        }

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
        const currentUsername = user?.username || (currentUploader.toUpperCase().includes('IDHAM') ? 'idham.khalid' : currentUploader.toUpperCase().includes('DAVILA') ? 'davila.zalianti' : currentUploader.toUpperCase().includes('FIFI') || currentUploader.toUpperCase().includes('HAFIFAH') ? 'nurul.hafifah' : '');
        formData.append('uploaderName', currentUploader);
        if (currentUsername) formData.append('uploaderUsername', currentUsername);
        if (user?.role) formData.append('uploaderRole', user.role);
        if (user?.nik) formData.append('uploaderNik', user.nik);
        if (user?.jabatan) formData.append('uploaderJabatan', user.jabatan);

        formData.append('autoStamp', enableAutoStamp ? 'true' : 'false');
        if (enableAutoStamp) {
          const effectiveSig = userSignaturePng || getSignatureForUploader(currentUsername) || getSignatureForUploader(currentUploader);
          if (effectiveSig) formData.append('signatureDataUrl', effectiveSig);
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

        // Kirim Notifikasi In-App & WA Gateway: Dokumen TTB Baru Diunggah
        try {
          const sampleTtbs = newlyUploaded.map((u) => u.noTtb).slice(0, 3).join(', ') + (newlyUploaded.length > 3 ? ` (+${newlyUploaded.length - 3} lainnya)` : '');
          const sampleArmada = Array.from(new Set(newlyUploaded.map((u) => u.armada).filter(Boolean))).join(', ');
          const samplePo = Array.from(new Set(newlyUploaded.map((u) => u.noPo).filter(Boolean))).join(', ');

          fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'TTB_UPLOADED',
              title: '📦 Dokumen TTB Baru Siap Divalidasi',
              message: `User ${uploaderName || user?.name || 'Staf Logistik'} telah mengunggah ${newlyUploaded.length} berkas TTB (${sampleTtbs}). Mohon diproses untuk pengesahan & validasi digital.`,
              senderName: uploaderName || user?.name || 'Staf Logistik',
              senderUsername: user?.username || 'user',
              senderRole: user?.role || 'logistik',
              targetRole: 'manager',
              linkTab: 'validasi-dokumen',
              metadata: {
                noTtb: sampleTtbs,
                armada: sampleArmada || undefined,
                noPo: samplePo || undefined,
              },
            }),
          }).catch(() => {});
        } catch {}

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

  // Submit Handler dengan proteksi duplikat, pengendalian SOP FSTB & validasi kelengkapan berkas berpasangan
  const handleExecuteUpload = async () => {
    if (queue.length === 0) {
      showToast?.('Pilih setidaknya 1 berkas TTB untuk diunggah.', 'warning');
      return;
    }

    // 1. PENGENDALIAN SOP: Verifikasi prasyarat berkas FSTB wajib terunggah jika toggle switch aktif
    if (sopRequireFstb) {
      const blocked: {
        item: QueuedFile;
        fstbInfo: { hasFstb: boolean; expectedFstb: string; noFpb: string; noPo: string; armada?: string };
      }[] = [];

      for (const item of queue) {
        const rawTtb = item.noTtb.trim() || batchNoTtb.trim();
        const fstbStatus = checkFstbPrerequisite(rawTtb, item.noFpb, item.doNo, item.noFstb);
        if (!fstbStatus.hasFstb) {
          blocked.push({ item, fstbInfo: fstbStatus });
        }
      }

      if (blocked.length > 0) {
        setMissingFstbQueueItems(blocked);
        setIsMissingFstbModalOpen(true);
        return;
      }
    }

    if (hasDuplicateInQueue) {
      setIsDuplicateModalOpen(true);
      return;
    }

    if (hasIncompleteInQueue) {
      setIsIncompleteModalOpen(true);
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

  // Auto-enrich riwayat pengarsipan TTB dengan data dari Monitoring Internal, Armada, dan Sisa Layanan
  const enrichedHistory = useMemo(() => {
    return enrichTtbRecords(history, {
      procurementItems,
      armadaItems,
      sisaLayananItems,
    });
  }, [history, procurementItems, armadaItems, sisaLayananItems]);

  // Statistik ringkas alur pengantaran via WA & Validasi SOP
  const dispatchStats = useMemo(() => {
    let unvalidatedCount = 0;
    let readyCount = 0;
    let pendingCrewCount = 0;
    let completedCount = 0;

    for (const h of enrichedHistory) {
      const key = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
      const token = remoteTokens[key];
      const isReceived = h.hasPhysicalPhotos || h.isArmadaReceived || token?.isUsed;
      const isWaiting = !isReceived && Boolean(token && !token.isUsed);

      const valRecord = validationsMap[key];
      const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
      const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;

      if (isReceived) {
        completedCount++;
      } else if (isWaiting) {
        pendingCrewCount++;
      } else if (!isLegallyReady) {
        unvalidatedCount++;
      } else {
        readyCount++;
      }
    }

    return {
      total: enrichedHistory.length,
      unvalidatedCount,
      readyCount,
      pendingCrewCount,
      completedCount,
    };
  }, [enrichedHistory, remoteTokens, validationsMap]);

  // Filter riwayat berdasarkan pencarian & status pengantaran WA
  const filteredHistory = useMemo(() => {
    let list = enrichedHistory;

    // Filter status tab
    if (statusFilterTab === 'UNVALIDATED') {
      list = list.filter((h) => {
        const key = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
        const token = remoteTokens[key];
        const isReceived = h.hasPhysicalPhotos || h.isArmadaReceived || token?.isUsed;
        const isWaiting = !isReceived && Boolean(token && !token.isUsed);
        const valRecord = validationsMap[key];
        const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
        const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;
        return !isReceived && !isWaiting && !isLegallyReady;
      });
    } else if (statusFilterTab === 'READY_WA') {
      list = list.filter((h) => {
        const key = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
        const token = remoteTokens[key];
        const isReceived = h.hasPhysicalPhotos || h.isArmadaReceived || token?.isUsed;
        const isWaiting = !isReceived && Boolean(token && !token.isUsed);
        const valRecord = validationsMap[key];
        const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
        const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;
        return !isReceived && !isWaiting && isLegallyReady;
      });
    } else if (statusFilterTab === 'PENDING_CREW') {
      list = list.filter((h) => {
        const key = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
        const token = remoteTokens[key];
        const isReceived = h.hasPhysicalPhotos || h.isArmadaReceived || token?.isUsed;
        return !isReceived && Boolean(token && !token.isUsed);
      });
    } else if (statusFilterTab === 'COMPLETED') {
      list = list.filter((h) => {
        const key = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
        const token = remoteTokens[key];
        return h.hasPhysicalPhotos || h.isArmadaReceived || token?.isUsed;
      });
    }

    if (!searchHistory.trim()) return list;
    const q = searchHistory.toLowerCase().trim();
    return list.filter(
      (h) =>
        h.noTtb?.toLowerCase().includes(q) ||
        h.cleanNoTtb?.toLowerCase().includes(q) ||
        h.armada?.toLowerCase().includes(q) ||
        h.noPo?.toLowerCase().includes(q) ||
        h.noFpb?.toLowerCase().includes(q) ||
        h.renamedFileName?.toLowerCase().includes(q) ||
        h.uploaderName?.toLowerCase().includes(q)
    );
  }, [enrichedHistory, searchHistory, statusFilterTab, remoteTokens, validationsMap]);

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
  }, [searchHistory, enrichedHistory.length]);

  // Statistik Ringkasan (4 Stat Cards)
  const stats = useMemo(() => {
    const total = enrichedHistory.length;
    const pdfCount = enrichedHistory.filter(
      (h) => h.fileType === 'application/pdf' || h.renamedFileName.toLowerCase().endsWith('.pdf')
    ).length;
    const imgCount = total - pdfCount;
    const r2Count = enrichedHistory.filter(
      (h) => h.storageProvider === 'CLOUDFLARE_R2' || h.status === 'STORED_IN_CLOUDFLARE_R2' || h.fileUrl
    ).length;
    return { total, pdfCount, imgCount, r2Count };
  }, [enrichedHistory]);

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

      {/* Kartu Pengendalian SOP: FSTB Prerequisite Gate (Admin Toggle Switch) */}
      <div className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs ${
        sopRequireFstb
          ? 'bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border-emerald-500/30'
          : 'bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border-amber-500/40'
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            sopRequireFstb
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
          }`}>
            {sopRequireFstb ? <ShieldCheck className="size-6" /> : <ShieldAlert className="size-6" />}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">
                Pengendalian SOP: Wajib FSTB Sebelum Terbit TTB
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                sopRequireFstb
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40'
              }`}>
                {sopRequireFstb ? '🛡️ SOP KETAT: AKTIF (Wajib FSTB)' : '⚠️ MODE BYPASS: AKTIF (SOP FSTB Diabaikan)'}
              </span>
              {isAdmin && (
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                  Khusus Admin
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sopRequireFstb
                ? 'Aturan SOP Ketat Aktif: Berkas TTB hanya dapat diunggah jika dokumen FSTB terkait telah terdaftar di Cloudflare R2.'
                : 'Mode Bypass Darurat Aktif: Seluruh pengguna diizinkan mengunggah berkas TTB secara langsung tanpa kewajiban berkas FSTB.'}
            </p>
          </div>
        </div>

        {/* Toggle Switch Controller */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          {isAdmin ? (
            <button
              type="button"
              onClick={handleToggleSopRequireFstb}
              className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                sopRequireFstb ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              title={sopRequireFstb ? 'Klik untuk mengaktifkan Mode Bypass (Izinkan Upload tanpa FSTB)' : 'Klik untuk mengaktifkan SOP Ketat (Wajib Berkas FSTB)'}
            >
              <span className="sr-only">Toggle SOP FSTB</span>
              <span
                className={`pointer-events-none inline-block size-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                  sopRequireFstb ? 'translate-x-8 text-emerald-600' : 'translate-x-0 text-slate-500'
                }`}
              >
                {sopRequireFstb ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/80 border border-border text-xs text-muted-foreground">
              <Lock className="size-3.5 text-muted-foreground" />
              <span>Dikelola Admin</span>
            </div>
          )}
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

      <datalist id="fstb-reference-datalist">
        {fstbSuggestionsList.slice(0, 150).map((fstb, idx) => (
          <option key={idx} value={fstb.noFstb}>
            {fstb.armada ? `${fstb.armada} • ${fstb.doNo || ''} ${fstb.isUploaded ? '✓ Di R2' : ''}` : fstb.doNo || ''}
          </option>
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
              <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono border border-emerald-500/30">
                  <Sparkles className="size-3" />
                  <span>Mendukung Banyak TTB Sekaligus</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  <Camera className="size-3" />
                  <span>Maks. 10 Foto Bukti Fisik per TTB</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  <AlertCircle className="size-3" />
                  <span>Wajib Berpasangan: PDF + Foto Fisik</span>
                </div>
              </div>

              <p className="text-sm font-bold text-foreground">
                Tarik &amp; Letakkan berkas TTB di sini, atau{' '}
                <span className="text-primary underline underline-offset-2">Pilih Banyak Berkas Sekaligus</span>
              </p>

              <p className="text-xs text-muted-foreground mt-2">
                Bisa mengunggah <strong>banyak nomor TTB berbeda sekaligus</strong>. Sesuai SOP Logistik, setiap TTB dapat menyertakan <strong>1 berkas scan PDF resmi &amp; hingga 10 foto fisik barang (.jpg/.png)</strong> untuk mendokumentasikan setiap item barang dalam TTB tersebut.
              </p>
              <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                Contoh: <strong>CPL-TTB-26-00449.pdf</strong> &amp; <strong>CPL-TTB-26-00449_01.jpg</strong>, <strong>CPL-TTB-26-00449_02.jpg</strong> (hingga 10 foto)
              </p>
            </div>
          </div>

          {/* Tombol Kamera Langsung dengan Watermark CPG */}
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            disabled={!canEdit}
            className="w-full h-10 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Buka kamera langsung dengan watermark CPG (tanggal, user, GPS)"
          >
            <Camera className="size-4" />
            <span>📷 Kamera Langsung — Foto Langsung Ber-Watermark CPG</span>
          </button>

          {/* Daftar Antrean Berkas (Jika Ada) */}
          {queue.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <Layers className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Antrean Berkas ({queue.length})
                  </h3>
                  {queuePairAnalysis.groups.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {queuePairAnalysis.groups.length} Dokumen TTB
                      </span>
                      {queuePairAnalysis.completeGroups.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                          ✓ {queuePairAnalysis.completeGroups.length} Komplit
                        </span>
                      )}
                      {queuePairAnalysis.incompleteGroups.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold animate-pulse">
                          ⚠️ {queuePairAnalysis.incompleteGroups.length} Belum Komplit
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="text-xs text-red-500 hover:text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="size-3" />
                  <span>Kosongkan Antrean</span>
                </button>
              </div>

              {/* Alert Banner: Kelengkapan Pasangan Belum Komplit */}
              {hasIncompleteInQueue && (
                <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold flex items-center gap-1.5 flex-wrap text-foreground">
                        <span>⚠️ Kelengkapan Upload Belum Komplit: {queuePairAnalysis.incompleteGroups.length} Dokumen TTB Belum Berpasangan!</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-500 text-slate-950 font-bold font-mono">
                          Wajib SOP Logistik
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Sesuai SOP Tim TTB, setiap upload dokumen wajib menyertakan berkas scan PDF resmi dan foto fisik barang dengan nama nomor TTB yang sama.
                        Harap lengkapi berkas berikut:
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {queuePairAnalysis.incompleteGroups.slice(0, 4).map((inc) => (
                          <span
                            key={inc.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-background/80 border border-amber-500/30 text-foreground"
                          >
                            <span>{inc.key}</span>
                            <span className="text-amber-600 dark:text-amber-400 font-sans">
                              ({inc.status === 'MISSING_PHOTO' ? 'Kurang Foto Fisik' : 'Kurang Scan PDF'})
                            </span>
                          </span>
                        ))}
                        {queuePairAnalysis.incompleteGroups.length > 4 && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            +{queuePairAnalysis.incompleteGroups.length - 4} lainnya
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      title="Unggah berkas pelengkap sekarang"
                    >
                      <FolderUp className="size-3.5" />
                      <span>Lengkapi Berkas</span>
                    </button>
                  </div>
                </div>
              )}

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
                  const pairGroup = queuePairAnalysis.itemGroupMap.get(item.id);
                  const isIncomplete = pairGroup && !pairGroup.isComplete;

                  const targetCleanTtb = sanitizeTtbNumber(item.noTtb || batchNoTtb);
                  const photosInQueueForTtb = queue.filter(
                    (q) => q.isImage && sanitizeTtbNumber(q.noTtb || batchNoTtb) === targetCleanTtb
                  );
                  const photoIndexInQueue = item.isImage ? photosInQueueForTtb.indexOf(item) + 1 : 0;
                  const totalPhotosInQueue = photosInQueueForTtb.length;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition text-xs space-y-2 ${
                        isDup
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : isIncomplete
                          ? 'border-amber-500/30 bg-amber-500/5/30 hover:bg-background'
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
                          {item.isImage && totalPhotosInQueue > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0"
                              title={`Foto bukti fisik serah terima #${photoIndexInQueue} dari ${totalPhotosInQueue} untuk TTB ${targetCleanTtb || '-'}`}
                            >
                              <Camera className="size-2.5" />
                              <span>Foto #{photoIndexInQueue} ({photoIndexInQueue}/{totalPhotosInQueue})</span>
                            </span>
                          )}
                          {item.isPdf && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1 shrink-0"
                              title="Dokumen scan TTB resmi bertandatangan"
                            >
                              <FileText className="size-2.5" />
                              <span>Scan PDF Resmi</span>
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

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/50">
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
                          <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5 flex items-center justify-between">
                            <span>No. FSTB Terkait (SOP):</span>
                            {item.noFstb && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">✓ Terhubung</span>}
                          </label>
                          <input
                            type="text"
                            list="fstb-reference-datalist"
                            value={item.noFstb || ''}
                            onChange={(e) =>
                              handleUpdateQueueItem(item.id, 'noFstb', e.target.value)
                            }
                            placeholder="Cth: CPL-FSTB-26-06669"
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

                      {/* Status Pasangan Dokumen TTB (PDF & Foto Barang Fisik) */}
                      {pairGroup && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                          {pairGroup.isComplete ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25">
                              <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                              <span>
                                Pasangan Lengkap ({pairGroup.pdfFiles.length} PDF + {pairGroup.photoFiles.length} Foto Fisik)
                              </span>
                            </span>
                          ) : pairGroup.status === 'MISSING_PHOTO' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30">
                              <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                              <span>
                                Kelengkapan Belum Komplit: <strong>Wajib upload Foto Fisik Barang</strong> ({pairGroup.key}.jpg)
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 font-semibold border border-amber-500/30">
                              <AlertCircle className="size-3 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                              <span>
                                Kelengkapan Belum Komplit: <strong>Wajib upload Scan Berkas Resmi PDF</strong> ({pairGroup.key}.pdf)
                              </span>
                            </span>
                          )}
                          <span className="text-muted-foreground font-mono">
                            {item.isPdf ? '📄 Berkas PDF' : '📷 Foto Barang Fisik'}
                          </span>
                        </div>
                      )}

                      {/* Status Verifikasi Berkas FSTB Pasangan (SOP Prerequisite) */}
                      {(() => {
                        const rawTtb = item.noTtb.trim() || batchNoTtb.trim();
                        if (!rawTtb) return null;
                        const fstbCheck = checkFstbPrerequisite(rawTtb, item.noFpb, item.doNo, item.noFstb);
                        return (
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-[10px]">
                            {fstbCheck.hasFstb ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25">
                                <ShieldCheck className="size-3 text-emerald-500 shrink-0" />
                                <span>FSTB Terverifikasi di R2 {fstbCheck.expectedFstb ? `(${fstbCheck.expectedFstb})` : ''}</span>
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold border ${
                                  sopRequireFstb
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30'
                                }`}>
                                  <ShieldAlert className="size-3 shrink-0" />
                                  <span>FSTB Belum Terunggah {fstbCheck.expectedFstb ? `(${fstbCheck.expectedFstb})` : ''}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleNotifyFstbTeam([{ item, fstbInfo: fstbCheck }])}
                                  disabled={isNotifyingFstb}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[9px] border border-primary/20 transition cursor-pointer"
                                  title="Kirim notifikasi urgensi ke Tim FSTB / Purchasing"
                                >
                                  <BellRing className="size-2.5" />
                                  <span>Panggil Tim FSTB</span>
                                </button>
                              </div>
                            )}
                            <span className="text-muted-foreground font-mono">
                              {fstbCheck.noFpb ? `FPB: ${fstbCheck.noFpb}` : fstbCheck.noPo ? `PO: ${fstbCheck.noPo}` : ''}
                            </span>
                          </div>
                        );
                      })()}
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-medium self-start sm:self-auto">
              <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
              <span>Sinkronisasi Monitoring Internal Aktif</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchHistory();
                  fetchRemoteTokens();
                }}
                disabled={isLoadingHistory}
                className="h-8 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Sinkronkan Ulang Riwayat dengan Monitoring Internal"
              >
                <RefreshCw className={`size-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <div className="relative w-full sm:w-64">
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
          </div>
        </div>

        {/* Filter Tab Status Pengantaran & Serah Terima WA */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilterTab('ALL')}
            className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilterTab === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            }`}
          >
            <span>Semua TTB</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/30 font-mono">
              {dispatchStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterTab('UNVALIDATED')}
            className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilterTab === 'UNVALIDATED'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            }`}
            title="Dokumen TTB yang belum lengkap divalidasi oleh Manajer Procurement / Lini Logistik"
          >
            <AlertTriangle className="size-3.5" />
            <span>Belum Lengkap Validasi</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/30 font-mono">
              {dispatchStats.unvalidatedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterTab('READY_WA')}
            className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilterTab === 'READY_WA'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            }`}
            title="Dokumen TTB yang telah sah divalidasi Manajer dan siap diterbitkan link WA"
          >
            <Send className="size-3.5" />
            <span>Sah &bull; Siap Antar (WA)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/30 font-mono">
              {dispatchStats.readyCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterTab('PENDING_CREW')}
            className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilterTab === 'PENDING_CREW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            }`}
          >
            <Clock className="size-3.5" />
            <span>Link WA Terkirim (I/P Received)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/30 font-mono">
              {dispatchStats.pendingCrewCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterTab('COMPLETED')}
            className={`h-8 px-3 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              statusFilterTab === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60'
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            <span>Selesai Diterima (Ada Foto & TTD)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/30 font-mono">
              {dispatchStats.completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/cek-ttb`;
              navigator.clipboard?.writeText(url);
              showToast?.(`✓ Link HP Tim TTB disalin: ${url}`, 'success');
            }}
            className="ml-auto h-8 px-3 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Salin link mobile (/cek-ttb) untuk Tim TTB Penerima Barang di HP personal"
          >
            <Camera className="size-3.5 text-sky-500" />
            <span>Link HP Tim TTB</span>
          </button>
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
                        {(() => {
                          const parsed = parseTtbList(item.noTtb);
                          if (parsed.length > 1) {
                            const shown = parsed.slice(0, 3).join(', ');
                            const remaining = parsed.length - 3;
                            return (
                              <span title={item.noTtb} className="truncate max-w-[280px] inline-block font-mono">
                                {shown}
                                {remaining > 0 ? ` (+${remaining} lainnya)` : ''}
                              </span>
                            );
                          }
                          return <span>{item.noTtb}</span>;
                        })()}
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

                    <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">
                      {item.armada && item.armada !== '-' ? (
                        <div className="flex items-center gap-1.5">
                          <Ship className="size-3 text-blue-500 shrink-0" />
                          <span className="font-semibold text-foreground">{item.armada}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      {item.noPo && item.noPo !== '-' ? (
                        <div className="space-y-0.5">
                          <span className="text-foreground font-semibold block">{item.noPo}</span>
                          {item.noFpb && item.noFpb !== '-' && item.noFpb !== item.noPo && (
                            <span className="text-[10px] text-muted-foreground block font-sans">
                              Ref FPB: <strong className="font-mono">{item.noFpb}</strong>
                            </span>
                          )}
                        </div>
                      ) : item.noFpb && item.noFpb !== '-' ? (
                        <div className="space-y-0.5">
                          <span className="text-foreground font-semibold block">{item.noFpb}</span>
                          <span className="text-[9px] text-muted-foreground block uppercase font-sans">No. FPB Acuan</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      {item.uploaderName && item.uploaderName !== '-' ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground text-[11px] block">
                            {item.uploaderName}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <FileSignature className="size-2.5" />
                            <span>Auto-Signed</span>
                          </span>
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
                      {(() => {
                        const cleanTtbKey = (item.cleanNoTtb || item.noTtb || '').toUpperCase().trim();
                        const activeToken = remoteTokens[cleanTtbKey];
                        const isReceived = item.hasPhysicalPhotos || item.isArmadaReceived || activeToken?.isUsed;
                        const isWaitingCrew = !isReceived && Boolean(activeToken && !activeToken.isUsed);

                        // Cek status validasi dari Manajer Procurement & Lini Logistik
                        const valRecord = validationsMap[cleanTtbKey];
                        const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
                        const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;
                        const validCount = valRecord?.completedLinesCount || (
                          (valRecord?.ttbSlots?.deliveredBy?.isValidated ? 1 : 0) +
                          (valRecord?.ttbSlots?.approvedBy?.isValidated ? 1 : 0) +
                          (valRecord?.ttbSlots?.acknowledgedBy?.isValidated ? 1 : 0) +
                          (valRecord?.ttbSlots?.receivedBy?.isValidated ? 1 : 0)
                        );

                        return (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 w-fit">
                              <CheckCircle2 className="size-3" />
                              UPLOADED
                            </span>
                            {isReceived ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const cleanNo = (item.cleanNoTtb || item.noTtb || '').trim();
                                  setSelectedMediaItem(item);
                                  setMediaModalTtb(cleanNo);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 w-fit hover:bg-emerald-500/25 transition cursor-pointer text-left"
                                title="Barang telah diterima di kapal. Klik untuk melihat galeri foto & tanda tangan basah."
                              >
                                <CheckCircle2 className="size-2.5 text-emerald-500 shrink-0" />
                                <span>Diterima Kapal {item.physicalPhotosCount ? `(${item.physicalPhotosCount} Foto)` : ''}</span>
                              </button>
                            ) : isWaitingCrew ? (
                              <button
                                type="button"
                                onClick={() => setPendingDispatchItem(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 w-fit hover:bg-blue-500/25 transition cursor-pointer text-left"
                                title="Tautan WA sudah diterbitkan. Klik untuk melihat pesan atau mengirim ulang."
                              >
                                <Clock className="size-2.5 text-blue-500 shrink-0 animate-pulse" />
                                <span>I/P Received</span>
                              </button>
                            ) : !isLegallyReady ? (
                              <div
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 w-fit text-left cursor-help"
                                title={`SOP: TTB ini belum disahkan oleh Manajer Procurement & Lini Logistik (${validCount}/3 internal sah). Wajib divalidasi di menu 'Validasi FSTB & TTB' sebelum sah untuk diantar.`}
                              >
                                <AlertTriangle className="size-2.5 text-amber-500 shrink-0" />
                                <span>Perlu Validasi Manajer ({validCount}/3)</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDispatchItem(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 w-fit hover:bg-cyan-500/25 transition cursor-pointer text-left"
                                title="Disahkan Manajer & Siap Antar. Klik untuk menerbitkan tautan dan kirim pesan WhatsApp ke penerima."
                              >
                                <Send className="size-2.5 text-cyan-500 shrink-0" />
                                <span>Sah &bull; Siap Antar (WA)</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const cleanTtbKey = (item.cleanNoTtb || item.noTtb || '').toUpperCase().trim();
                            const valRecord = validationsMap[cleanTtbKey];
                            const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
                            const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;

                            if (!isLegallyReady && !isAdmin) {
                              showToast?.(
                                `PERINGATAN SOP: Dokumen TTB ${item.cleanNoTtb || item.noTtb} belum divalidasi oleh Manajer Procurement / Lini Logistik. Harap selesaikan validasi di menu 'Validasi FSTB & TTB' sebelum melakukan pengantaran lapangan.`,
                                'warning'
                              );
                              return;
                            }
                            setPendingDispatchItem(item);
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer shadow-2xs ${
                            (() => {
                              const cleanTtbKey = (item.cleanNoTtb || item.noTtb || '').toUpperCase().trim();
                              const valRecord = validationsMap[cleanTtbKey];
                              const managerApproved = Boolean(valRecord?.ttbSlots?.acknowledgedBy?.isValidated);
                              const isLegallyReady = valRecord?.isReadyForDispatch || managerApproved;
                              return isLegallyReady
                                ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400';
                            })()
                          }`}
                          title="Kirim Notifikasi WA & Tautan Mandiri Serah Terima ke Penerima"
                        >
                          <MessageCircle className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ttbNum = (item.noTtb || item.cleanNoTtb || '').trim();
                            const url = `${window.location.origin}/cek-ttb?noTtb=${encodeURIComponent(ttbNum)}&armada=${encodeURIComponent(item.armada || '')}`;
                            navigator.clipboard?.writeText(url);
                            showToast?.(`✓ Link Cek HP Tim TTB untuk ${ttbNum} disalin!`, 'success');
                          }}
                          className="p-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition cursor-pointer"
                          title="Salin Link Cek Foto Tim TTB (HP Personal) untuk TTB ini"
                        >
                          <Camera className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePreview(item)}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Pratinjau Berkas"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cleanNo = (item.cleanNoTtb || item.noTtb || '').trim();
                            setSelectedMediaItem(item);
                            setMediaModalTtb(cleanNo);
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            item.hasPhysicalPhotos || item.isArmadaReceived
                              ? 'border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 shadow-sm'
                              : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                          title={
                            item.hasPhysicalPhotos || item.isArmadaReceived
                              ? `Buka Galeri Foto Fisik Kapal (${item.physicalPhotosCount || 1} Foto)`
                              : 'Verifikasi Dokumen Scan & Foto Fisik TTB'
                          }
                        >
                          <Camera className="size-3.5" />
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

      {/* Modal Peringatan SOP: FSTB Belum Terunggah */}
      {isMissingFstbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-border bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-transparent flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span>SOP Tertahan: Berkas FSTB Belum Terunggah</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Pengendalian SOP Aktif: TTB wajib memiliki berkas FSTB di Cloudflare R2
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMissingFstbModalOpen(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 leading-relaxed text-[11px]">
                Sesuai aturan SOP operasional logistik, berkas TTB <strong>tidak dapat diterbitkan / diunggah</strong> ke Cloudflare R2 sebelum dokumen <strong>FSTB (Formulir Serah Terima Barang)</strong> terkait telah diunggah oleh Tim Purchasing / FSTB.
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Daftar Berkas TTB yang Tertahan ({missingFstbQueueItems.length}):
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {missingFstbQueueItems.map(({ item, fstbInfo }, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {idx + 1}. {item.noTtb || item.file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {fstbInfo.expectedFstb ? (
                            <span>Target FSTB: <strong className="text-rose-600 dark:text-rose-400">{fstbInfo.expectedFstb}</strong> • </span>
                          ) : null}
                          {fstbInfo.noFpb ? `FPB: ${fstbInfo.noFpb} • ` : ''}
                          {fstbInfo.armada ? `Armada: ${fstbInfo.armada}` : ''}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0">
                        Belum Diunggah
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleNotifyFstbTeam(missingFstbQueueItems);
                }}
                disabled={isNotifyingFstb}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <BellRing className={`size-3.5 ${isNotifyingFstb ? 'animate-spin' : ''}`} />
                <span>{isNotifyingFstb ? 'Mengirim Notifikasi...' : 'Kirim Notifikasi ke Tim FSTB'}</span>
              </button>

              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMissingFstbModalOpen(false);
                      showToast?.('Mode Bypass Admin: Mengunggah TTB tanpa FSTB...', 'warning');
                      if (hasDuplicateInQueue) {
                        setIsDuplicateModalOpen(true);
                        return;
                      }
                      if (hasIncompleteInQueue) {
                        setIsIncompleteModalOpen(true);
                        return;
                      }
                      await processUploadForQueue(queue);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold transition cursor-pointer"
                    title="Bypass SOP sementara (Khusus Hak Akses Admin)"
                  >
                    Bypass &amp; Tetap Unggah
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsMissingFstbModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
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
                  if (hasIncompleteInQueue) {
                    setIsIncompleteModalOpen(true);
                    return;
                  }
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

      {/* Modal Peringatan Kelengkapan Berkas Belum Komplit (Mandatory Berpasangan) */}
      {isIncompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-border bg-linear-to-r from-amber-500/15 via-orange-500/10 to-transparent flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span>Kelengkapan Dokumen TTB Belum Komplit!</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    SOP Kantor Logistik: Wajib Unggah Berpasangan (Dokumen PDF &amp; Foto Barang Fisik)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIncompleteModalOpen(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 leading-relaxed text-[11px] space-y-1">
                <p>
                  Sistem mendeteksi <strong>{queuePairAnalysis.incompleteGroups.length} nomor TTB</strong> yang berkasnya <strong>belum memiliki pasangan lengkap</strong>.
                </p>
                <p>
                  Sesuai ketentuan SOP Kantor Logistik, pengarsipan TTB <strong>wajib menyertakan 2 berkas berpasangan</strong> (Scan Dokumen PDF Resmi dan Foto Fisik Barang di Logistik dengan nama yang sama) sebelum diproses.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Daftar Nomor TTB yang Belum Komplit:
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {queuePairAnalysis.incompleteGroups.map((group, idx) => (
                    <div
                      key={group.key}
                      className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="size-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {group.key}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-950">
                          {group.status === 'MISSING_PHOTO' ? 'Kurang Foto Fisik' : 'Kurang Scan PDF'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-background/80 border border-border">
                          <span className="text-[10px] text-muted-foreground block font-medium">Berkas Tersedia:</span>
                          <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span className="truncate">
                              {group.pdfFiles.length > 0 ? `${group.pdfFiles.length}x Dokumen PDF` : `${group.photoFiles.length}x Foto Fisik`}
                            </span>
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                          <span className="text-[10px] text-red-600 dark:text-red-400 block font-medium">Wajib Dilengkapi:</span>
                          <div className="flex items-center gap-1 font-bold text-red-700 dark:text-red-300 mt-0.5">
                            <AlertCircle className="size-3 shrink-0" />
                            <span className="truncate">
                              {group.status === 'MISSING_PHOTO' ? `${group.key}.jpg` : `${group.key}.pdf`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsIncompleteModalOpen(false);
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FolderUp className="size-3.5" />
                <span>Lengkapi Berkas Sekarang</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsIncompleteModalOpen(false);
                  showToast?.(
                    'Perhatian: Berkas TTB diunggah dengan status pasangan belum komplit. Wajib dipenuhi segera!',
                    'warning'
                  );
                  await processUploadForQueue(queue);
                }}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer text-center"
              >
                Tetap Lanjutkan (Draft Sementara)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 0. Reminder Terbang: Wajib Upload Berpasangan (PDF & Foto Barang Fisik) */}
      {showFloatingReminder ? (
        <aside
          aria-label="Floating Reminder SOP Logistik"
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 max-w-md w-[calc(100vw-32px)] sm:w-[440px] bg-card/95 backdrop-blur-md border-2 border-amber-500/50 rounded-2xl shadow-2xl p-4 sm:p-5 text-card-foreground animate-in slide-in-from-bottom-5 duration-300"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-10 -right-10 size-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Header Reminder Terbang */}
          <div className="flex items-start justify-between gap-3 relative z-10 pb-3 border-b border-border/70">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Bell className="size-4.5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider">
                    Reminder Terbang
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    SOP Tim TTB • Mandatory
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground mt-0.5">
                  Wajib Upload Berpasangan (PDF + Foto Barang)
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowFloatingReminder(false);
                try {
                  localStorage.setItem('cpg_ttb_pair_reminder_closed', 'true');
                } catch {}
              }}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
              title="Tutup Reminder Terbang"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Konten Reminder Terbang */}
          <div className="space-y-2.5 py-3 text-xs text-muted-foreground relative z-10">
            <p className="text-[11px] leading-relaxed text-foreground">
              Setiap pengarsipan dokumen TTB oleh tim logistik <strong>wajib (mandatory)</strong> mengunggah <strong>2 jenis berkas berpasangan</strong> dengan <strong>nama nomor TTB yang sama</strong>:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                  <FileText className="size-3.5" />
                  <span>1. Dokumen Resmi</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Format: <strong className="text-foreground">.pdf</strong>
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Scan formulir TTB bertandatangan &amp; stempel.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                  <Camera className="size-3.5" />
                  <span>2. Foto Fisik Barang</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Format: <strong className="text-foreground">.jpg / .png</strong>
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight">
                  Dokumentasi fisik barang di kantor logistik.
                </p>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-muted/60 border border-border text-[10px] space-y-0.5">
              <div className="font-semibold text-foreground flex items-center gap-1">
                <AlertCircle className="size-3 text-amber-500 shrink-0" />
                <span>Contoh Penamaan Identik:</span>
              </div>
              <p className="font-mono text-primary font-bold pl-4">
                CPL-TTB-26-07542.pdf <span className="text-muted-foreground font-normal">&amp;</span> CPL-TTB-26-07542.jpg
              </p>
            </div>

            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
              ⚠️ <em>Jika hanya terdapat 1 data upload, sistem otomatis memunculkan status <strong>&ldquo;Kelengkapan Belum Komplit&rdquo;</strong> dan mewajibkan pemenuhan berkas fisik.</em>
            </p>
          </div>

          {/* Footer Aksi Reminder Terbang */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70 relative z-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <FolderUp className="size-3.5" />
              <span>Pilih Berkas Berpasangan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowFloatingReminder(false);
                try {
                  localStorage.setItem('cpg_ttb_pair_reminder_closed', 'true');
                } catch {}
              }}
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer"
            >
              Saya Mengerti (Tutup)
            </button>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowFloatingReminder(true);
            try {
              localStorage.removeItem('cpg_ttb_pair_reminder_closed');
            } catch {}
          }}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 h-9 px-3.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border border-amber-500/40 shadow-xl backdrop-blur-md text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer active:scale-95 animate-in fade-in"
          title="Buka kembali Reminder SOP Logistik (Wajib PDF + Foto)"
        >
          <Bell className="size-3.5 text-amber-500 animate-pulse" />
          <span>Reminder SOP: Wajib PDF + Foto TTB</span>
        </button>
      )}

      {/* Camera Watermark Modal */}
      <CameraWatermarkModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        docNumber={batchNoTtb || undefined}
        docType="TTB"
        onPhotoCaptured={async (dataUrl, filename) => {
          // Convert dataUrl to File and add to queue
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'image/jpeg' });
          await handleFilesAdded([file]);
        }}
        showToast={showToast}
      />
      {/* Modal Verifikasi Dokumen & Galeri Foto Fisik Serah Terima */}
      <TtbMediaModal
        isOpen={!!mediaModalTtb}
        onClose={() => {
          setMediaModalTtb(null);
          setSelectedMediaItem(null);
        }}
        noTtb={mediaModalTtb || ''}
        noFstb={selectedMediaItem?.noFstb}
        fpb={selectedMediaItem?.noFpb}
        po={selectedMediaItem?.noPo}
        armada={selectedMediaItem?.armada}
        item={selectedMediaItem?.keterangan}
        initialTab="photos"
        showToast={showToast}
      />

      {/* Modal Disposisi Pengiriman & Kirim WA Mandiri */}
      {pendingDispatchItem && (
        <RemoteDispatchModal
          isOpen={!!pendingDispatchItem}
          onClose={() => setPendingDispatchItem(null)}
          targetTtb={{
            noTtb: pendingDispatchItem.noTtb,
            cleanNoTtb: pendingDispatchItem.cleanNoTtb || pendingDispatchItem.noTtb,
            armada: pendingDispatchItem.armada || '-',
            noFpb: pendingDispatchItem.noFpb,
            noPo: pendingDispatchItem.noPo,
            itemSummary: pendingDispatchItem.keterangan || 'Barang Serah Terima Operasional Kapal',
            fileUrl: pendingDispatchItem.fileUrl,
            isManagerApproved: Boolean(
              validationsMap[(pendingDispatchItem.cleanNoTtb || pendingDispatchItem.noTtb || '').toUpperCase().trim()]?.ttbSlots?.acknowledgedBy?.isValidated ||
              validationsMap[(pendingDispatchItem.cleanNoTtb || pendingDispatchItem.noTtb || '').toUpperCase().trim()]?.isReadyForDispatch
            ),
            validationCount: validationsMap[(pendingDispatchItem.cleanNoTtb || pendingDispatchItem.noTtb || '').toUpperCase().trim()]?.completedLinesCount ?? 0,
          }}
          dispatchedBy={user?.name || user?.username || 'Tim Logistik CPG'}
          onSuccess={() => {
            fetchRemoteTokens();
            fetchValidations();
            fetchHistory();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
