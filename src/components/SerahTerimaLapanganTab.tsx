'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  PackageCheck,
  CheckCircle2,
  Camera,
  UploadCloud,
  Images,
  Calendar,
  Clock,
  User,
  Phone,
  FileText,
  AlertTriangle,
  AlertOctagon,
  Search,
  X,
  ExternalLink,
  Eye,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Ship,
  Sparkles,
  Plus,
  Layers,
  ShieldCheck,
  Info,
  Maximize2,
  ChevronRight,
  Filter,
  FileSignature,
  PenTool,
  RotateCcw,
  Upload,
  Lock,
  Tablet,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import {
  SerahTerimaItem,
  SerahTerimaResponse,
  SerahTerimaPhoto,
  KondisiSerahTerima,
} from '@/types/serahTerima';
import { UploadedTtbItem } from '@/types/ttbUpload';
import { DocumentValidationRecord } from '@/types/documentValidation';
import { extractTtbComponents } from '@/utils/ttbRename';
import { formatDateDdMmYy, extractDateInfo } from '@/utils/formatDate';
import { useAuth } from '@/context/AuthContext';
import TtbMediaModal from './TtbMediaModal';
import { loadCrewData, StoredCrewData } from '@/utils/crewKapalStorage';
import { CrewMasterItem, KapalRekapItem } from '@/types/crewKapal';

/**
 * Normalisasi nama kapal/armada untuk pencocokan toleran
 */
function normalizeShipNameForMatch(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/\b(TK|OB|TB|SPOB|SV|MT|LCT|SP|BG|KM|KL|MV|CRANE BARGE|HOPPER BARGE|CREW BOAT)\b/g, '')
    .replace(/PASIFIC/g, 'PASIFIK')
    .replace(/PACIFIC/g, 'PASIFIK')
    .replace(/TWIN\s*SISTER/g, 'TWINSISTER')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Mencari daftar kru kapal berdasarkan nama armada dari TTB
 */
function findCrewByArmada(
  armada: string,
  masterCrew: CrewMasterItem[],
  kapalRekap: KapalRekapItem[] = []
): { crewList: CrewMasterItem[]; shipPhone?: string; matchedShipName?: string } {
  if (!armada || armada === '-' || armada.toLowerCase() === 'null') {
    return { crewList: [] };
  }

  const rawQ = armada.trim().toLowerCase();
  const validCrew = masterCrew.filter(
    (c) =>
      c.namaPersonel &&
      c.namaPersonel !== '-' &&
      !c.statusSlot.toLowerCase().includes('lowong')
  );

  // 1. Exact match nama kapal
  let matched = validCrew.filter((c) => c.namaKapal.toLowerCase() === rawQ);
  let matchedShipName = matched[0]?.namaKapal;

  // 2. Normalized exact match
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ) {
      matched = validCrew.filter(
        (c) => normalizeShipNameForMatch(c.namaKapal) === normQ
      );
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // 3. Slash split match (e.g. TB CPL 88 / GAJ 02)
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ) {
      matched = validCrew.filter((c) => {
        const parts = c.namaKapal.split('/').map((p) => normalizeShipNameForMatch(p));
        return parts.some((p) => p && (p === normQ || p.includes(normQ) || normQ.includes(p)));
      });
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // 4. Substring match
  if (matched.length === 0) {
    const normQ = normalizeShipNameForMatch(armada);
    if (normQ && normQ.length >= 3) {
      matched = validCrew.filter((c) => {
        const normC = normalizeShipNameForMatch(c.namaKapal);
        return normC.includes(normQ) || normQ.includes(normC);
      });
      matchedShipName = matched[0]?.namaKapal;
    }
  }

  // Cari no telepon kapal dari kapalRekap
  let shipPhone: string | undefined;
  if (matchedShipName) {
    const k = kapalRekap.find(
      (kr) => kr.namaKapal.toLowerCase() === matchedShipName?.toLowerCase()
    );
    if (k && k.noTelp && k.noTelp !== '-') {
      shipPhone = k.noTelp;
    }
  } else {
    const normQ = normalizeShipNameForMatch(armada);
    const k = kapalRekap.find(
      (kr) => normalizeShipNameForMatch(kr.namaKapal) === normQ
    );
    if (k && k.noTelp && k.noTelp !== '-') {
      shipPhone = k.noTelp;
      matchedShipName = k.namaKapal;
    }
  }

  // Urutkan kru berdasarkan noKru (hierarki perwira -> AB/Oiler)
  matched.sort((a, b) => (a.noKru || 99) - (b.noKru || 99));

  return { crewList: matched, shipPhone, matchedShipName };
}

interface SerahTerimaLapanganTabProps {
  procurementItems?: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  sisaLayananItems?: SisaLayananItem[];
  onOpenAudit?: (ttbNumber: string, item?: any) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onDataMutated?: () => void;
}

interface QueuedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  sizeFormatted: string;
}

interface TtbReferenceOption {
  key: string;
  noTtb: string;
  cleanNoTtb: string;
  armada: string;
  noFpb?: string;
  noPo?: string;
  vendor?: string;
  itemSummary: string;
  itemsCount: number;
  tglTtb?: string;
  tglTtbFormatted: string;
  tglTtbTimestamp: number;
  isRecipientSigned: boolean;
  recipientName?: string;
  signedAt?: string;
  logistikValidatorName?: string;
  logistikValidatedAt?: string;
  logistikVerificationToken?: string;
  isManagerApproved: boolean; // Otorisasi sah oleh Procurement / Purchasing Manager
  managerValidatorName?: string;
  managerValidatedAt?: string;
  isLogSpvApproved: boolean;
  logSpvValidatorName?: string;
  approvalProgressCount: number;
  fileUrl?: string;
}

export type TtbDateRangeType = 'H-4' | 'H-7' | 'H-14' | 'H-30' | 'ALL' | 'CUSTOM';
export type TtbStatusFilterType = 'ALL' | 'SIAP_KIRIM' | 'BELUM' | 'SUDAH';

export default function SerahTerimaLapanganTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  onOpenAudit,
  showToast,
  onDataMutated,
}: SerahTerimaLapanganTabProps) {
  const { user, canEdit, isAdmin } = useAuth();

  // Active view: 'form' (Input Pengantaran) atau 'history' (Riwayat Serah Terima)
  const [activeView, setActiveView] = useState<'form' | 'history'>('form');

  // --- FORM STATE ---
  // TTB Reference search & selection
  const [ttbSearchTerm, setTtbSearchTerm] = useState<string>('');
  const [isSearchingTtb, setIsSearchingTtb] = useState<boolean>(false);
  const [selectedTtbRef, setSelectedTtbRef] = useState<TtbReferenceOption | null>(null);
  const [ttbStatusFilter, setTtbStatusFilter] = useState<TtbStatusFilterType>('ALL');
  // Pilihan rentang waktu terbit TTB: default ALL agar seluruh data TTB siap kirim tampil
  const [ttbDateRange, setTtbDateRange] = useState<TtbDateRangeType>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [uploadedTtbs, setUploadedTtbs] = useState<UploadedTtbItem[]>([]);
  const [documentValidations, setDocumentValidations] = useState<DocumentValidationRecord[]>([]);
  const [isManualTtb, setIsManualTtb] = useState<boolean>(false);
  const [manualNoTtb, setManualNoTtb] = useState<string>('');
  const [manualArmada, setManualArmada] = useState<string>('');
  const [manualFpb, setManualFpb] = useState<string>('');
  const [manualPo, setManualPo] = useState<string>('');
  const [manualItemSummary, setManualItemSummary] = useState<string>('');

  // Handover Delivery Details
  const [petugasNama, setPetugasNama] = useState<string>(() => {
    return user?.name ? `${user.name} (Tim Lapangan)` : 'Petugas Logistik Lapangan';
  });
  const [penerimaNama, setPenerimaNama] = useState<string>('');
  const [kontakPenerima, setKontakPenerima] = useState<string>('');

  // Data Crew & Armada dari modul Crew & Armada
  const [crewData, setCrewData] = useState<StoredCrewData>(() => loadCrewData());
  const [selectedCrewId, setSelectedCrewId] = useState<number | 'MANUAL' | ''>('');
  const [isManualPenerima, setIsManualPenerima] = useState<boolean>(false);

  // Sinkronisasi jika data crew di-update di modul Crew & Armada
  useEffect(() => {
    const handleCrewChange = () => {
      setCrewData(loadCrewData());
    };
    window.addEventListener('cpg_crew_data_changed', handleCrewChange);
    return () => window.removeEventListener('cpg_crew_data_changed', handleCrewChange);
  }, []);
  const [waktuSerahTerima, setWaktuSerahTerima] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });
  const [kondisi, setKondisi] = useState<KondisiSerahTerima>('LENGKAP_BAIK');
  const [catatan, setCatatan] = useState<string>('');

  // Photos queue
  const [queuedPhotos, setQueuedPhotos] = useState<QueuedPhoto[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload status
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [lastSubmittedRecord, setLastSubmittedRecord] = useState<SerahTerimaItem | null>(null);

  // --- MODE KHUSUS TABLET / IPAD KIOSK LAPANGAN ---
  const [isTabletMode, setIsTabletMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cpg_serah_terima_tablet_mode') === 'true';
    }
    return false;
  });

  const toggleTabletMode = () => {
    setIsTabletMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('cpg_serah_terima_tablet_mode', String(next));
      }
      return next;
    });
  };

  const toggleBrowserFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // --- DIGITAL SIGNATURE EVIDENCE STATE (PENERIMA AKHIR) ---
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);
  const [hasDrawnSig, setHasDrawnSig] = useState<boolean>(false);
  const [sigDataUrl, setSigDataUrl] = useState<string>('');
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent<HTMLCanvasElement>).clientX;
      clientY = (e as React.MouseEvent<HTMLCanvasElement>).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawingSig = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawingSig(true);
  };

  const drawSig = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingSig) return;
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawnSig(true);
  };

  const stopDrawingSig = () => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.closePath();
      setSigDataUrl(canvas.toDataURL('image/png'));
    }
    setIsDrawingSig(false);
  };

  const clearSig = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnSig(false);
    setSigDataUrl('');
  };

  const handleSigFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast?.('Format file tidak didukung. Harap pilih gambar PNG/JPG.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        setSigDataUrl(result);
        setHasDrawnSig(true);

        // Render ke canvas jika ada
        const canvas = sigCanvasRef.current;
        if (canvas) {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
          };
          img.src = result;
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- HISTORY STATE ---
  const [historyRecords, setHistoryRecords] = useState<SerahTerimaItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [historyKondisiFilter, setHistoryKondisiFilter] = useState<'ALL' | KondisiSerahTerima>('ALL');
  const [isR2Active, setIsR2Active] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<SerahTerimaItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal Lightbox Preview Foto
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Modal TTB Media Modal
  const [selectedTtbForModal, setSelectedTtbForModal] = useState<string | null>(null);

  // Map status TTD digital penerima akhir / armada berdasarkan riwayat serah terima & upload TTB
  const signedTtbMap = useMemo(() => {
    const map = new Map<string, { recipientName?: string; signedAt?: string }>();
    // 1. Dari Serah Terima Lapangan
    historyRecords.forEach((h) => {
      const cleanKey = (h.cleanNoTtb || h.noTtb || '').toUpperCase().trim();
      const isSigned = Boolean(h.penerimaSignature || h.isTtbDocumentStamped);
      if (cleanKey && isSigned) {
        map.set(cleanKey, {
          recipientName: h.penerima || 'Crew Kapal',
          signedAt: h.tanggalSerahTerima,
        });
      }
    });

    // 2. Dari Upload TTB
    uploadedTtbs.forEach((u) => {
      const cleanKey = (u.cleanNoTtb || u.noTtb || '').toUpperCase().trim();
      const isSigned = Boolean(u.isRecipientStamped || u.recipientSignatureDataUrl);
      if (cleanKey && isSigned && !map.has(cleanKey)) {
        map.set(cleanKey, {
          recipientName: u.recipientName || 'Crew Kapal',
          signedAt: u.recipientStampedAt || u.receivedDate,
        });
      }
    });

    // 3. Dari Dokumen Validasi (Slot Received By atau Recipient Validation)
    documentValidations.forEach((v) => {
      if (v.docType !== 'TTB') return;
      const cleanKey = (v.cleanDocNumber || v.docNumber || '').toUpperCase().trim();
      const isSigned = Boolean(
        v.recipientValidation?.isSigned ||
        v.ttbSlots?.receivedBy?.isValidated ||
        v.overallStatus === 'SUDAH_DITERIMA_ARMADA'
      );
      if (cleanKey && isSigned && !map.has(cleanKey)) {
        map.set(cleanKey, {
          recipientName:
            v.recipientValidation?.recipientName ||
            v.ttbSlots?.receivedBy?.validatorName ||
            'Crew Armada Kapal',
          signedAt:
            v.recipientValidation?.signedAt ||
            v.ttbSlots?.receivedBy?.validatedAt ||
            v.updatedAt,
        });
      }
    });

    return map;
  }, [historyRecords, uploadedTtbs, documentValidations]);

  // 1. Filter Dokumen TTB yang HANYA telah tervalidasi sah oleh Staf Logistik (deliveredBy atau logistikValidation)
  const validatedLogistikTtbs = useMemo(() => {
    return documentValidations.filter((rec) => {
      if (rec.docType !== 'TTB') return false;
      const isLogStaff = Boolean(rec.ttbSlots?.deliveredBy?.isValidated || rec.logistikValidation?.isValidated);
      return isLogStaff;
    });
  }, [documentValidations]);

  // Map pencocokan toleran untuk nomor TTB tervalidasi Staf Logistik
  const { validatedLookupIndex, validatedCatalogSeed } = useMemo(() => {
    const exactMap = new Map<string, TtbReferenceOption>();
    const normMap = new Map<string, string>(); // alphanumeric -> cleanKey
    const digitsMap = new Map<string, string>(); // digits -> cleanKey
    const seedMap = new Map<string, TtbReferenceOption>();

    validatedLogistikTtbs.forEach((rec) => {
      const cleanDoc = (rec.cleanDocNumber || rec.docNumber || '').trim();
      if (!cleanDoc || cleanDoc === '-' || cleanDoc.toLowerCase() === 'null') return;
      const cleanKey = cleanDoc.toUpperCase().replace(/\s+/g, ' ');

      const signedInfo = signedTtbMap.get(cleanKey);
      const isSigned = Boolean(
        signedInfo ||
        rec.recipientValidation?.isSigned ||
        rec.ttbSlots?.receivedBy?.isValidated ||
        rec.overallStatus === 'SUDAH_DITERIMA_ARMADA'
      );

      const rawDate = rec.receivedDate || rec.ttbSlots?.deliveredBy?.validatedAt || rec.createdAt;
      const dInfo = extractDateInfo(rawDate);
      const dateFormatted = formatDateDdMmYy(rawDate);
      const timestamp = dInfo.timestamp || (rawDate ? new Date(rawDate).getTime() : 0);

      // Cek apakah Manager (Procurement / Purchasing Manager) telah menandatangani TTB
      const isManagerApproved = Boolean(
        rec.ttbSlots?.acknowledgedBy?.isValidated ||
        rec.purchasingValidation?.isValidated
      );
      const managerValidatorName =
        rec.ttbSlots?.acknowledgedBy?.validatorName ||
        rec.purchasingValidation?.validatorName ||
        (isManagerApproved ? 'Manager Procurement' : undefined);
      const managerValidatedAt =
        rec.ttbSlots?.acknowledgedBy?.validatedAt ||
        rec.purchasingValidation?.validatedAt;

      const isLogSpvApproved = Boolean(rec.ttbSlots?.approvedBy?.isValidated);
      const logSpvValidatorName =
        rec.ttbSlots?.approvedBy?.validatorName || (isLogSpvApproved ? 'SPV Logistik' : undefined);

      let progCount = 0;
      if (rec.ttbSlots?.deliveredBy?.isValidated || rec.logistikValidation?.isValidated) progCount++;
      if (isLogSpvApproved) progCount++;
      if (isManagerApproved) progCount++;
      if (isSigned) progCount++;

      const opt: TtbReferenceOption = {
        key: cleanKey,
        noTtb: cleanDoc,
        cleanNoTtb: cleanKey,
        armada: (rec.armada || '').trim() || '-',
        noFpb: rec.fpbNumber || undefined,
        noPo: rec.poNumber || undefined,
        vendor: undefined,
        itemSummary: rec.renamedFileName || 'Dokumen TTB Terverifikasi Staf Logistik',
        itemsCount: 1,
        tglTtb: rawDate,
        tglTtbFormatted: dateFormatted !== '-' ? dateFormatted : '',
        tglTtbTimestamp: timestamp,
        isRecipientSigned: isSigned,
        recipientName:
          signedInfo?.recipientName ||
          rec.recipientValidation?.recipientName ||
          rec.ttbSlots?.receivedBy?.validatorName,
        signedAt:
          signedInfo?.signedAt ||
          rec.recipientValidation?.signedAt ||
          rec.ttbSlots?.receivedBy?.validatedAt,
        logistikValidatorName:
          rec.ttbSlots?.deliveredBy?.validatorName ||
          rec.logistikValidation?.validatorName ||
          'Staf Logistik',
        logistikValidatedAt:
          rec.ttbSlots?.deliveredBy?.validatedAt ||
          rec.logistikValidation?.validatedAt,
        logistikVerificationToken:
          rec.ttbSlots?.deliveredBy?.verificationToken ||
          rec.logistikValidation?.verificationToken,
        isManagerApproved,
        managerValidatorName,
        managerValidatedAt,
        isLogSpvApproved,
        logSpvValidatorName,
        approvalProgressCount: progCount,
        fileUrl: rec.fileUrl,
      };

      const comp = extractTtbComponents(cleanKey);
      const prefix = comp.prefix || null;

      seedMap.set(cleanKey, opt);
      exactMap.set(cleanKey, opt);

      const norm = cleanKey.replace(/[^A-Z0-9]/g, '');
      if (norm) normMap.set(norm, cleanKey);

      const canon = comp.canonicalTtb;
      if (canon) {
        const normCanon = canon.toUpperCase().replace(/[^A-Z0-9]/g, '');
        normMap.set(normCanon, cleanKey);
      }

      const digits = cleanKey.replace(/\D/g, '');
      if (digits.length >= 4) {
        const pad5 = digits.length <= 5 ? digits.padStart(5, '0') : digits;
        if (prefix) {
          digitsMap.set(`${prefix}_${pad5}`, cleanKey);
          digitsMap.set(`${prefix}_${digits}`, cleanKey);
        }
        if (!digitsMap.has(pad5)) digitsMap.set(pad5, cleanKey);
        if (!digitsMap.has(digits)) digitsMap.set(digits, cleanKey);
      }
    });

    return {
      validatedLookupIndex: { exactMap, normMap, digitsMap },
      validatedCatalogSeed: seedMap,
    };
  }, [validatedLogistikTtbs, signedTtbMap]);

  // Helper pencocokan TTB ke TTB tervalidasi Staf Logistik dengan validasi ketat prefix entitas perusahaan
  const findMatchingValidatedTtb = (rawTtb: string): TtbReferenceOption | null => {
    if (!rawTtb) return null;
    const trimmed = rawTtb.trim().toUpperCase().replace(/\s+/g, ' ');
    const rawComp = extractTtbComponents(trimmed);
    const rawPrefix = rawComp.prefix || null;
    const { exactMap, normMap, digitsMap } = validatedLookupIndex;

    const verifyPrefixMatch = (candidateKey: string): TtbReferenceOption | null => {
      const opt = exactMap.get(candidateKey);
      if (!opt) return null;
      const targetComp = extractTtbComponents(opt.cleanNoTtb || opt.noTtb);
      const targetPrefix = targetComp.prefix || null;
      // KETENTUAN MUTLAK: Jika kedua pihak memiliki prefix perusahaan dan berbeda (misal GAJ vs HL), DILARANG MENCOCOKKAN!
      if (rawPrefix && targetPrefix && rawPrefix !== targetPrefix) {
        return null;
      }
      return opt;
    };

    if (exactMap.has(trimmed)) {
      const match = verifyPrefixMatch(trimmed);
      if (match) return match;
    }

    const norm = trimmed.replace(/[^A-Z0-9]/g, '');
    if (norm && normMap.has(norm)) {
      const key = normMap.get(norm)!;
      const match = verifyPrefixMatch(key);
      if (match) return match;
    }

    const canon = rawComp.canonicalTtb;
    if (canon) {
      const normCanon = canon.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normMap.has(normCanon)) {
        const key = normMap.get(normCanon)!;
        const match = verifyPrefixMatch(key);
        if (match) return match;
      }
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 4) {
      const pad5 = digits.length <= 5 ? digits.padStart(5, '0') : digits;
      if (rawPrefix) {
        const prefKeyPad5 = `${rawPrefix}_${pad5}`;
        const prefKeyDigits = `${rawPrefix}_${digits}`;
        if (digitsMap.has(prefKeyPad5)) {
          const match = verifyPrefixMatch(digitsMap.get(prefKeyPad5)!);
          if (match) return match;
        }
        if (digitsMap.has(prefKeyDigits)) {
          const match = verifyPrefixMatch(digitsMap.get(prefKeyDigits)!);
          if (match) return match;
        }
      } else {
        if (digitsMap.has(pad5)) {
          const match = verifyPrefixMatch(digitsMap.get(pad5)!);
          if (match) return match;
        }
        if (digitsMap.has(digits)) {
          const match = verifyPrefixMatch(digitsMap.get(digits)!);
          if (match) return match;
        }
      }
    }

    return null;
  };

  // 1. Build TTB Reference Catalog - HANYA DATA TTB TERVALIDASI STAF LOGISTIK
  // Data dari Procurement & Sisa Layanan hanya memperkaya metadata item, tidak dapat masuk tanpa validasi Staf Logistik
  const ttbReferenceCatalog = useMemo(() => {
    // Clone seed map dari TTB yang sah tervalidasi Staf Logistik
    const map = new Map<string, TtbReferenceOption>();
    validatedCatalogSeed.forEach((val, key) => {
      map.set(key, { ...val });
    });

    // Perkaya metadata dari berkas Uploaded TTB (Cloudflare R2)
    uploadedTtbs.forEach((u) => {
      const matched = findMatchingValidatedTtb(u.cleanNoTtb || u.noTtb);
      if (!matched) return; // DILARANG: Belum tervalidasi oleh Staf Logistik!

      const target = map.get(matched.cleanNoTtb);
      if (!target) return;

      if (u.armada && (target.armada === '-' || !target.armada)) target.armada = u.armada;
      if (u.noFpb && !target.noFpb) target.noFpb = u.noFpb;
      if (u.noPo && !target.noPo) target.noPo = u.noPo;
      if (u.keterangan && (target.itemSummary.endsWith('.pdf') || target.itemSummary.includes('Terverifikasi'))) {
        target.itemSummary = u.keterangan;
      }
      if (u.fileUrl && !target.fileUrl) target.fileUrl = u.fileUrl;
    });

    // Perkaya rincian item barang dari Procurement
    procurementItems.forEach((item) => {
      const matched = findMatchingValidatedTtb(item.noTtb || '');
      if (!matched) return; // DILARANG: Belum tervalidasi oleh Staf Logistik!

      const target = map.get(matched.cleanNoTtb);
      if (!target) return;

      if (item.deptArmada && (target.armada === '-' || !target.armada)) target.armada = item.deptArmada;
      if (item.fpb && !target.noFpb) target.noFpb = item.fpb;
      if (item.po && !target.noPo) target.noPo = item.po;
      if (item.item) {
        const qtyStr = item.qtyTTB || item.qtyPO ? `(${item.qtyTTB || item.qtyPO} ${item.satuan || ''})`.trim() : '';
        const itemLabel = `${item.item} ${qtyStr}`.trim();
        if (target.itemSummary.endsWith('.pdf') || target.itemSummary.includes('Terverifikasi')) {
          target.itemSummary = itemLabel;
        } else if (!target.itemSummary.includes(item.item)) {
          target.itemSummary += `, ${itemLabel}`;
          target.itemsCount += 1;
        }
      }
      if (item.tglTtb || item.date) {
        const dInfo = extractDateInfo(item.tglTtb || item.date);
        if (dInfo.timestamp && dInfo.timestamp > target.tglTtbTimestamp) {
          target.tglTtbTimestamp = dInfo.timestamp;
          target.tglTtbFormatted = formatDateDdMmYy(item.tglTtb || item.date);
        }
      }
    });

    // Perkaya rincian item barang dari Sisa Layanan
    sisaLayananItems.forEach((item) => {
      const matched = findMatchingValidatedTtb(item.noTtb || '');
      if (!matched) return; // DILARANG: Belum tervalidasi oleh Staf Logistik!

      const target = map.get(matched.cleanNoTtb);
      if (!target) return;

      if (item.departement && (target.armada === '-' || !target.armada)) target.armada = item.departement;
      if (item.noFpb && !target.noFpb) target.noFpb = item.noFpb;
      if (item.noPo && !target.noPo) target.noPo = item.noPo;
      if (item.namaBarang) {
        const qtyStr = item.jmlTtb || item.jmlPo ? `(${item.jmlTtb || item.jmlPo} ${item.satuan || ''})`.trim() : '';
        const itemLabel = `${item.namaBarang} ${qtyStr}`.trim();
        if (target.itemSummary.endsWith('.pdf') || target.itemSummary.includes('Terverifikasi')) {
          target.itemSummary = itemLabel;
        } else if (!target.itemSummary.includes(item.namaBarang)) {
          target.itemSummary += `, ${itemLabel}`;
          target.itemsCount += 1;
        }
      }
      if (item.tglTtb || item.tglPo) {
        const dInfo = extractDateInfo(item.tglTtb || item.tglPo);
        if (dInfo.timestamp && dInfo.timestamp > target.tglTtbTimestamp) {
          target.tglTtbTimestamp = dInfo.timestamp;
          target.tglTtbFormatted = formatDateDdMmYy(item.tglTtb || item.tglPo);
        }
      }
    });

    const catalog = Array.from(map.values());

    // URUTKAN BERDASARKAN TANGGAL TERBARU TTB TERBIT (Newest Date First)
    catalog.sort((a, b) => {
      if (b.tglTtbTimestamp !== a.tglTtbTimestamp) {
        return b.tglTtbTimestamp - a.tglTtbTimestamp;
      }
      return b.noTtb.localeCompare(a.noTtb);
    });

    return catalog;
  }, [validatedCatalogSeed, validatedLookupIndex, uploadedTtbs, procurementItems, sisaLayananItems]);

  // Perhitungan batas waktu rentang terbit TTB (Default: H-4)
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    // Tentukan acuan tanggal terbaru: max antara tanggal lokal hari ini dan tanggal TTB terbaru di database
    const latestTimestamp = ttbReferenceCatalog[0]?.tglTtbTimestamp || 0;
    const baseTimestamp = latestTimestamp > now.getTime() ? latestTimestamp : now.getTime();
    const baseDate = new Date(baseTimestamp);
    const endOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999).getTime();

    if (ttbDateRange === 'ALL') {
      return {
        startMs: 0,
        endMs: Infinity,
        label: 'Semua Waktu',
        description: 'Menampilkan seluruh arsip data TTB',
        isAll: true,
      };
    }

    if (ttbDateRange === 'CUSTOM') {
      const startMs = customStartDate ? new Date(`${customStartDate}T00:00:00`).getTime() : 0;
      const endMs = customEndDate ? new Date(`${customEndDate}T23:59:59.999`).getTime() : Infinity;
      const startLbl = customStartDate ? formatDateDdMmYy(customStartDate) : 'Awal';
      const endLbl = customEndDate ? formatDateDdMmYy(customEndDate) : 'Hari Ini';
      return {
        startMs,
        endMs,
        label: `${startLbl} - ${endLbl}`,
        description: `Rentang Kustom: ${startLbl} s/d ${endLbl}`,
        isAll: false,
      };
    }

    let days = 4;
    let labelPrefix = 'H-4';
    if (ttbDateRange === 'H-7') {
      days = 7;
      labelPrefix = 'H-7';
    } else if (ttbDateRange === 'H-14') {
      days = 14;
      labelPrefix = 'H-14';
    } else if (ttbDateRange === 'H-30') {
      days = 30;
      labelPrefix = 'H-30';
    }

    const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - days);
    const startMs = startDate.getTime();

    const startFormatted = formatDateDdMmYy(startDate.toISOString());
    const endFormatted = formatDateDdMmYy(baseDate.toISOString());

    return {
      startMs,
      endMs: endOfDay,
      label: `${startFormatted} - ${endFormatted}`,
      description: `${labelPrefix} (${startFormatted} s/d ${endFormatted})`,
      isAll: false,
    };
  }, [ttbReferenceCatalog, ttbDateRange, customStartDate, customEndDate]);

  // 1. Filter Katalog berdasarkan rentang waktu terbit TTB (Agar data ringan & cepat)
  const dateFilteredCatalog = useMemo(() => {
    if (dateRangeBounds.isAll) {
      return ttbReferenceCatalog;
    }
    return ttbReferenceCatalog.filter((opt) => {
      if (!opt.tglTtbTimestamp) return false;
      return opt.tglTtbTimestamp >= dateRangeBounds.startMs && opt.tglTtbTimestamp <= dateRangeBounds.endMs;
    });
  }, [ttbReferenceCatalog, dateRangeBounds]);

  // Statistik jumlah TTB belum vs sudah TTD digital di dalam rentang waktu aktif
  const ttbStats = useMemo(() => {
    let belumCount = 0;
    let sudahCount = 0;
    let siapKirimCount = 0;
    let belumManagerCount = 0;

    dateFilteredCatalog.forEach((opt) => {
      if (opt.isRecipientSigned) sudahCount++;
      else belumCount++;

      if (opt.isManagerApproved) siapKirimCount++;
      else belumManagerCount++;
    });

    return {
      total: dateFilteredCatalog.length,
      belum: belumCount,
      sudah: sudahCount,
      siapKirim: siapKirimCount,
      belumManager: belumManagerCount,
      grandTotal: ttbReferenceCatalog.length,
    };
  }, [dateFilteredCatalog, ttbReferenceCatalog]);

  // Autocomplete matching & filter results (Status TTD, Otorisasi Manager & Pencarian)
  const filteredTtbOptions = useMemo(() => {
    let result = dateFilteredCatalog;

    // Filter status
    if (ttbStatusFilter === 'SIAP_KIRIM') {
      result = result.filter((opt) => opt.isManagerApproved && !opt.isRecipientSigned);
    } else if (ttbStatusFilter === 'BELUM') {
      result = result.filter((opt) => !opt.isRecipientSigned);
    } else if (ttbStatusFilter === 'SUDAH') {
      result = result.filter((opt) => opt.isRecipientSigned);
    }

    // Filter pencarian
    if (ttbSearchTerm.trim()) {
      const q = ttbSearchTerm.toLowerCase();
      result = result.filter(
        (opt) =>
          opt.noTtb.toLowerCase().includes(q) ||
          opt.armada.toLowerCase().includes(q) ||
          (opt.noFpb && opt.noFpb.toLowerCase().includes(q)) ||
          (opt.noPo && opt.noPo.toLowerCase().includes(q)) ||
          opt.itemSummary.toLowerCase().includes(q) ||
          (opt.recipientName && opt.recipientName.toLowerCase().includes(q)) ||
          (opt.tglTtbFormatted && opt.tglTtbFormatted.includes(q))
      );
    }

    return result;
  }, [dateFilteredCatalog, ttbStatusFilter, ttbSearchTerm]);

  // Hitung apakah ada kecocokan di arsip luar rentang saat pencarian tidak menemukan hasil di rentang aktif
  const searchMatchesInGrandCatalog = useMemo(() => {
    if (!ttbSearchTerm.trim() || ttbDateRange === 'ALL') return 0;
    const q = ttbSearchTerm.toLowerCase();
    return ttbReferenceCatalog.filter(
      (opt) =>
        opt.noTtb.toLowerCase().includes(q) ||
        opt.armada.toLowerCase().includes(q) ||
        (opt.noFpb && opt.noFpb.toLowerCase().includes(q)) ||
        (opt.noPo && opt.noPo.toLowerCase().includes(q)) ||
        opt.itemSummary.toLowerCase().includes(q)
    ).length;
  }, [ttbSearchTerm, ttbDateRange, ttbReferenceCatalog]);

  // Nama armada aktif saat ini (dari TTB referensi yang dipilih atau input manual)
  const currentArmada = isManualTtb ? manualArmada : (selectedTtbRef?.armada || '');

  // Otomatis deteksi daftar kru & kontak kapal berdasarkan armada aktif
  const { crewList: matchedCrewList, shipPhone: matchedShipPhone, matchedShipName } = useMemo(() => {
    return findCrewByArmada(currentArmada, crewData.masterCrew, crewData.kapalRekap);
  }, [currentArmada, crewData.masterCrew, crewData.kapalRekap]);

  // Otomatis isi penerima dan no telp saat armada dari TTB terdeteksi
  useEffect(() => {
    if (!currentArmada || currentArmada === '-' || currentArmada.toLowerCase() === 'null') {
      setSelectedCrewId('');
      setIsManualPenerima(false);
      return;
    }

    if (matchedCrewList.length > 0) {
      // Otomatis pilih perwira/kru teratas (misal Nakhoda / Barge Master / Mualim)
      const topCrew = matchedCrewList[0];
      setSelectedCrewId(topCrew.id);
      setIsManualPenerima(false);
      setPenerimaNama(`${topCrew.namaPersonel} (${topCrew.jabatan})`);
      const phone = topCrew.noHp && topCrew.noHp !== '-' ? topCrew.noHp : (matchedShipPhone || '');
      setKontakPenerima(phone);
    } else {
      setSelectedCrewId('MANUAL');
      setIsManualPenerima(true);
      if (matchedShipPhone) {
        setKontakPenerima(matchedShipPhone);
      }
    }
  }, [currentArmada, matchedCrewList, matchedShipPhone]);

  const handleSelectCrew = (crewIdOrManual: string) => {
    if (crewIdOrManual === 'MANUAL') {
      setSelectedCrewId('MANUAL');
      setIsManualPenerima(true);
      setPenerimaNama('');
      setKontakPenerima(matchedShipPhone || '');
      return;
    }

    const idNum = Number(crewIdOrManual);
    const found = matchedCrewList.find((c) => c.id === idNum);
    if (found) {
      setSelectedCrewId(found.id);
      setIsManualPenerima(false);
      setPenerimaNama(`${found.namaPersonel} (${found.jabatan})`);
      const phone = found.noHp && found.noHp !== '-' ? found.noHp : (matchedShipPhone || '');
      setKontakPenerima(phone);
    }
  };

  // Fetch riwayat serah terima, berkas Upload TTB, dan Dokumen Validasi TTB dari API
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const cacheBust = `_t=${Date.now()}`;
      const [resHistory, resUploadTtb, resValidations] = await Promise.allSettled([
        fetch(`/api/serah-terima?${cacheBust}`, { cache: 'no-store' }),
        fetch(`/api/upload-ttb?${cacheBust}`, { cache: 'no-store' }),
        fetch(`/api/validasi-dokumen?type=TTB&${cacheBust}`, { cache: 'no-store' }),
      ]);

      if (resHistory.status === 'fulfilled' && resHistory.value.ok) {
        const data: SerahTerimaResponse = await resHistory.value.json();
        if (data.records) {
          setHistoryRecords(data.records);
        }
        if (typeof data.isR2Active === 'boolean') {
          setIsR2Active(data.isR2Active);
        }
      }

      if (resUploadTtb.status === 'fulfilled' && resUploadTtb.value.ok) {
        const dataTtb = await resUploadTtb.value.json();
        if (Array.isArray(dataTtb.items)) {
          setUploadedTtbs(dataTtb.items);
        }
      }

      if (resValidations.status === 'fulfilled' && resValidations.value.ok) {
        const dataVal = await resValidations.value.json();
        if (Array.isArray(dataVal.records)) {
          setDocumentValidations(dataVal.records);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat serah terima, upload TTB & validasi dokumen:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Sinkronisasi otomatis jika ada verifikasi atau perubahan dokumen di tab Validasi Dokumen
  useEffect(() => {
    const handleValChange = () => {
      fetchHistory();
    };
    window.addEventListener('cpg_validation_data_changed', handleValChange);
    return () => window.removeEventListener('cpg_validation_data_changed', handleValChange);
  }, []);

  // Filtered History list
  const filteredHistory = useMemo(() => {
    let result = historyRecords;
    if (historyKondisiFilter !== 'ALL') {
      result = result.filter((r) => r.kondisi === historyKondisiFilter);
    }
    if (historySearchTerm.trim()) {
      const q = historySearchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.noTtb.toLowerCase().includes(q) ||
          r.armada.toLowerCase().includes(q) ||
          r.petugas.toLowerCase().includes(q) ||
          r.penerima.toLowerCase().includes(q) ||
          (r.noFpb && r.noFpb.toLowerCase().includes(q)) ||
          (r.noPo && r.noPo.toLowerCase().includes(q)) ||
          (r.catatan && r.catatan.toLowerCase().includes(q))
      );
    }
    return result;
  }, [historyRecords, historyKondisiFilter, historySearchTerm]);

  // Handle file additions to photo queue
  const handleAddPhotos = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newPhotos: QueuedPhoto[] = [];
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast?.(`Berkas "${file.name}" bukan gambar. Harap pilih foto JPG/PNG.`, 'warning');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const sizeFormatted = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

      newPhotos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl,
        sizeFormatted,
      });
    });

    if (newPhotos.length > 0) {
      setQueuedPhotos((prev) => [...prev, ...newPhotos]);
      showToast?.(`${newPhotos.length} foto ditambahkan ke daftar upload bukti.`, 'info');
    }
  };

  const handleRemovePhoto = (id: string) => {
    setQueuedPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleClearForm = () => {
    queuedPhotos.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setQueuedPhotos([]);
    setSelectedTtbRef(null);
    setTtbSearchTerm('');
    setIsManualTtb(false);
    setManualNoTtb('');
    setManualArmada('');
    setManualFpb('');
    setManualPo('');
    setManualItemSummary('');
    setPenerimaNama('');
    setKontakPenerima('');
    setSelectedCrewId('');
    setIsManualPenerima(false);
    setCatatan('');
    setKondisi('LENGKAP_BAIK');
    setUploadProgressMsg('');
    clearSig();
  };

  // Notifikasi jika pengguna memilih TTB yang belum disahkan oleh Manager
  const handleBlockedTtbClick = (opt: TtbReferenceOption) => {
    if (showToast) {
      showToast(
        `Belum bisa dilakukan serah terima barang! Dokumen ${opt.noTtb} belum ditandatangani oleh Manager. Sesuai SOP, serah terima kepada end user hanya sah setelah dokumen TTB disahkan oleh Procurement Manager.`,
        'warning'
      );
    }
  };

  // Submit Penyerahan Lapangan
  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetNoTtb = isManualTtb ? manualNoTtb.trim() : (selectedTtbRef?.noTtb || '').trim();
    const targetArmada = isManualTtb ? manualArmada.trim() : (selectedTtbRef?.armada || '').trim();
    const targetFpb = isManualTtb ? manualFpb.trim() : (selectedTtbRef?.noFpb || '');
    const targetPo = isManualTtb ? manualPo.trim() : (selectedTtbRef?.noPo || '');
    const targetItemSummary = isManualTtb ? manualItemSummary.trim() : (selectedTtbRef?.itemSummary || '');

    if (!targetNoTtb) {
      showToast?.('Nomor TTB referensi wajib dipilih atau diisi.', 'warning');
      return;
    }

    // Validasi ketat: Hanya TTB yang telah tervalidasi oleh Staf Logistik yang sah diproses serah terima lapangan
    const matchedValid = findMatchingValidatedTtb(targetNoTtb);
    if (!matchedValid) {
      showToast?.(
        `Gagal: Nomor TTB "${targetNoTtb}" belum divalidasi oleh Staf Logistik. Sesuai SOP, hanya dokumen TTB yang telah disahkan Staf Logistik yang sah untuk serah terima lapangan.`,
        'error'
      );
      return;
    }

    // Validasi ketat: Dokumen TTB wajib telah disahkan oleh Manager
    if (!matchedValid.isManagerApproved) {
      showToast?.(
        `Belum bisa dilakukan serah terima barang! Dokumen TTB "${targetNoTtb}" belum ditandatangani oleh Manager. Sesuai SOP, barang baru sah diserahkan ke armada setelah otorisasi Manager selesai.`,
        'error'
      );
      return;
    }

    if (!penerimaNama.trim()) {
      showToast?.('Nama penerima barang di lapangan (end user) wajib diisi.', 'warning');
      return;
    }

    if (queuedPhotos.length === 0) {
      showToast?.('Harap ambil atau unggah minimal 1 foto bukti penyerahan barang.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setUploadProgressMsg('Menyiapkan dan mengunggah foto ke Cloudflare R2...');

    try {
      const formData = new FormData();
      formData.append('noTtb', targetNoTtb);
      formData.append('armada', targetArmada);
      if (targetFpb) formData.append('noFpb', targetFpb);
      if (targetPo) formData.append('noPo', targetPo);
      if (targetItemSummary) formData.append('itemSummary', targetItemSummary);
      formData.append('petugas', petugasNama.trim() || 'Tim Lapangan CPG');
      formData.append('penerima', penerimaNama.trim());
      if (kontakPenerima.trim()) formData.append('kontakPenerima', kontakPenerima.trim());
      formData.append('tanggalSerahTerima', waktuSerahTerima.replace('T', ' '));
      formData.append('kondisi', kondisi);
      if (catatan.trim()) formData.append('catatan', catatan.trim());

      let finalSig = sigDataUrl;
      if (hasDrawnSig && sigCanvasRef.current) {
        finalSig = sigCanvasRef.current.toDataURL('image/png');
      }
      if (finalSig) {
        formData.append('penerimaSignature', finalSig);
      }

      queuedPhotos.forEach((p) => {
        formData.append('photos', p.file);
      });

      const res = await fetch('/api/serah-terima', {
        method: 'POST',
        body: formData,
      });

      const data: SerahTerimaResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Gagal mengunggah serah terima.');
      }

      showToast?.(
        data.message || `Bukti serah terima TTB ${targetNoTtb} berhasil disimpan ke Cloudflare R2!`,
        'success'
      );

      if (data.record) {
        setLastSubmittedRecord(data.record);
        setHistoryRecords((prev) => [data.record!, ...prev]);
      }

      handleClearForm();
      // Beralih ke view riwayat agar pengguna melihat hasil upload
      setActiveView('history');
    } catch (err) {
      showToast?.((err as Error).message || 'Terjadi kesalahan saat upload.', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgressMsg('');
    }
  };

  // Hapus riwayat serah terima
  const handleDeleteRecord = (record: SerahTerimaItem) => {
    setConfirmDeleteRecord(record);
  };

  const executeDeleteRecord = async (record: SerahTerimaItem) => {
    setDeletingId(record.id);
    try {
      const res = await fetch(`/api/serah-terima?id=${encodeURIComponent(record.id)}&_t=${Date.now()}`, {
        method: 'DELETE',
      });
      const data: SerahTerimaResponse = await res.json();
      if (res.ok && data.success) {
        if (data.records) {
          setHistoryRecords(data.records);
        } else {
          setHistoryRecords((prev) => prev.filter((r) => r.id !== record.id));
        }
        setConfirmDeleteRecord(null);
        showToast?.(
          `Rekaman serah terima ${record.noTtb} berhasil dihapus & tersinkronisasi ke Cloudflare R2.`,
          'success'
        );
        await fetchHistory();
        onDataMutated?.();
      } else {
        showToast?.(data.error || data.message || 'Gagal menghapus rekaman.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan saat menghapus data serah terima.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast?.(`Teks disalin: ${text}`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Preview generated standard filename for the first photo
  const previewSampleFilename = useMemo(() => {
    const targetNoTtb = isManualTtb ? manualNoTtb.trim() : (selectedTtbRef?.noTtb || 'TTB 00000');
    const targetArmada = isManualTtb ? manualArmada.trim() : (selectedTtbRef?.armada || 'ARMADA');
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${targetArmada.toUpperCase()} ${targetNoTtb.toUpperCase()} ${yyyy}-${mm}-${dd} at ${hh}.${min}.${ss}.jpeg`;
  }, [selectedTtbRef, isManualTtb, manualNoTtb, manualArmada]);

  return (
    <div
      className={
        isTabletMode
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-3 sm:p-5 lg:p-7 space-y-5 animate-in fade-in duration-200'
          : 'space-y-5 animate-in fade-in duration-200'
      }
    >
      {/* Tablet / iPad Dedicated Kiosk Bar (Muncul saat Mode Tablet Aktif) */}
      {isTabletMode && (
        <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-2 border-cyan-500/50 rounded-3xl p-3 sm:p-4.5 shadow-2xl flex items-center justify-between gap-3 text-white ring-4 ring-cyan-500/10">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-cyan-500/25 border-2 border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-inner">
              <Tablet className="size-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base lg:text-lg font-black text-white tracking-wide">
                  Mode Tablet / iPad Kiosk Lapangan
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 animate-pulse">
                  LAYAR PENUH AKTIF
                </span>
              </div>
              <p className="text-xs text-slate-300 hidden sm:block mt-0.5">
                Navigasi sidebar dinonaktifkan sementara. Layar 100% difokuskan untuk verifikasi fisik, kamera, dan TTD kru kapal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs sm:text-sm font-bold text-slate-200 border border-slate-700 flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Aktifkan Layar Penuh Perangkat"
            >
              <Maximize2 className="size-4 text-cyan-400" />
              <span className="hidden sm:inline">Fullscreen Layar</span>
            </button>
            <button
              type="button"
              onClick={toggleTabletMode}
              className="px-4 py-2.5 rounded-2xl bg-rose-500/25 hover:bg-rose-500/35 active:scale-95 text-xs sm:text-sm font-black text-rose-300 border border-rose-500/50 flex items-center gap-2 transition cursor-pointer shadow-xs"
              title="Keluar dari mode tablet dan kembali ke tampilan normal"
            >
              <X className="size-4" />
              <span>Keluar Tablet</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Banner - Tim Lapangan Delivery Portal */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 p-6 sm:p-7 shadow-2xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 size-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3 flex-wrap">
              <span>Serah Terima Lapangan &amp; Bukti Kirim TTB</span>
              <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-mono font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                End-User Proof
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-200 max-w-4xl leading-relaxed">
              Semua pengiriman barang wajib menggunakan data <strong className="text-white font-bold">TTB resmi</strong> sebagai referensi. Unggah bukti foto serah terima fisik barang atau lembar TTB bertanda tangan agar pengiriman terverifikasi selesai dan otomatis tampil di <strong className="text-cyan-300">Galeri Foto TTB</strong> serta <strong className="text-cyan-300">Overview</strong>.
            </p>
          </div>

          {/* Quick Metrics & Storage Status */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-2xl px-4 py-2.5 text-center min-w-[120px] shadow-sm">
              <div className="text-xs text-slate-300 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Terverifikasi</span>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-white mt-0.5">
                {historyRecords.length}
              </div>
            </div>

            <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-2xl px-4 py-2.5 text-center min-w-[140px] shadow-sm">
              <div className="text-xs text-slate-300 font-bold flex items-center justify-center gap-1.5">
                <CloudFlareIcon className="size-3.5 text-amber-400" />
                <span>Cloudflare R2</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5 mt-1">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Aktif &amp; Sinkron</span>
              </div>
            </div>

            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              title="Perbarui data serah terima"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 hover:text-white transition cursor-pointer shadow-sm"
            >
              <RefreshCw className={`size-5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs & Mode Tablet Toggle */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveView('form')}
              className={`px-5 sm:px-6 py-3 rounded-2xl text-sm sm:text-base font-black flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
                activeView === 'form'
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-500/30 ring-2 ring-cyan-300'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-700'
              }`}
            >
              <Plus className="size-5 stroke-[2.5]" />
              <span>Form Input Serah Terima Baru</span>
            </button>

            <button
              onClick={() => setActiveView('history')}
              className={`px-5 sm:px-6 py-3 rounded-2xl text-sm sm:text-base font-black flex items-center gap-2.5 transition-all shadow-md cursor-pointer ${
                activeView === 'history'
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-500/30 ring-2 ring-cyan-300'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-800 hover:text-white border border-slate-700'
              }`}
            >
              <Clock className="size-5 stroke-[2.5]" />
              <span>Riwayat Pengantaran Lapangan</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-slate-900/80 text-cyan-300 border border-cyan-500/40">
                {historyRecords.length}
              </span>
            </button>
          </div>

          {/* Tombol Khusus Mode Tablet / iPad Kiosk */}
          <button
            type="button"
            onClick={toggleTabletMode}
            className={`px-5 sm:px-6 py-3 rounded-2xl text-sm sm:text-base font-black flex items-center gap-2.5 transition-all shadow-lg cursor-pointer ${
              isTabletMode
                ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-300'
                : 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 border-2 border-cyan-500/50 hover:border-cyan-400'
            }`}
            title="Buka Mode Tablet / iPad (Layar Penuh Tanpa Sidebar Navigasi untuk Penggunaan Lapangan)"
          >
            <Tablet className="size-5 stroke-[2.5]" />
            <span>{isTabletMode ? 'Tampilan Standar' : 'Mode Tablet / iPad'}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono font-black border ${
                isTabletMode
                  ? 'bg-slate-950 text-emerald-300 border-slate-800'
                  : 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50'
              }`}
            >
              {isTabletMode ? 'ON' : 'Kiosk'}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: FORM INPUT SERAH TERIMA BARU                    */}
      {/* ======================================================== */}
      {activeView === 'form' && (
        <form onSubmit={handleSubmitDelivery} className="space-y-6">
          {/* STEP 1: PILIH DATA TTB REFERENSI */}
          <div className="bg-card border-2 border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="size-9 sm:size-10 rounded-2xl bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm sm:text-base shadow-xs">
                  1
                </div>
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-foreground flex items-center gap-2.5 flex-wrap">
                    <span>Pilih Referensi Data TTB (Telah Disahkan Manager • Siap Kirim)</span>
                    <span className="text-xs font-mono px-3 py-1 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-bold flex items-center gap-1.5 shadow-2xs">
                      <Truck className="size-3.5" />
                      <span>Otorisasi Manager Wajib</span>
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Hanya data TTB yang telah tervalidasi lengkap hingga Manager (Siap Kirim) yang dapat dipilih dan sah untuk proses serah terima lapangan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsManualTtb(!isManualTtb);
                  setSelectedTtbRef(null);
                }}
                className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 font-bold cursor-pointer self-start xl:self-auto shrink-0"
              >
                {isManualTtb ? '← Pilih dari Database TTB' : '+ Input Nomor TTB Manual'}
              </button>
            </div>

            {/* Mode 1: Search & Autocomplete from Preloaded TTB database */}
            {!isManualTtb ? (
              <div className="space-y-3">
                {!selectedTtbRef ? (
                  <div className="space-y-3.5">
                    {/* Label Penuntun Sangat Jelas untuk Petugas Lapangan */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-6.5 rounded-lg bg-indigo-600 text-white font-black text-xs shadow-xs">
                          TTB
                        </span>
                        <span className="text-sm sm:text-base font-black text-foreground tracking-wide uppercase">
                          KOLOM PENCARIAN (KLIK &amp; KETIK DI KOTAK BESAR INI):
                        </span>
                      </div>
                      {ttbSearchTerm && (
                        <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                          Hasil: <strong className="text-indigo-600 dark:text-indigo-400 font-mono text-sm sm:text-base">{filteredTtbOptions.length}</strong> TTB Cocok
                        </span>
                      )}
                    </div>

                    {/* Kotak Pencarian Raksasa (2X Lebih Besar) Ramah Lansia / Petugas Lapangan */}
                    <div className="relative group">
                      <div className="absolute left-4 sm:left-6 lg:left-7 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <Search className="size-8 sm:size-10 lg:size-12 text-indigo-600 dark:text-indigo-400 shrink-0 transition-transform group-focus-within:scale-110" />
                      </div>
                      <input
                        type="text"
                        value={ttbSearchTerm}
                        onChange={(e) => {
                          setTtbSearchTerm(e.target.value);
                          setIsSearchingTtb(true);
                        }}
                        onFocus={() => setIsSearchingTtb(true)}
                        placeholder="Ketik No. TTB, Nama Kapal / Armada..."
                        className="w-full pl-16 sm:pl-22 lg:pl-24 pr-32 sm:pr-44 lg:pr-48 py-6 sm:py-7 lg:py-8 min-h-[88px] sm:min-h-[104px] text-xl sm:text-2xl lg:text-3xl font-black rounded-3xl bg-background border-4 border-indigo-500/80 dark:border-indigo-400 text-foreground placeholder:text-muted-foreground/50 placeholder:text-base sm:placeholder:text-xl lg:placeholder:text-2xl placeholder:font-semibold shadow-lg shadow-indigo-500/10 hover:border-indigo-600 dark:hover:border-indigo-300 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-300 focus:ring-8 focus:ring-indigo-500/20 transition-all duration-150"
                      />
                      {/* Tombol Hapus Ekstra Besar & Kontras Tinggi */}
                      <div className="absolute right-3.5 sm:right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {ttbSearchTerm ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTtbSearchTerm('');
                              setIsSearchingTtb(false);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-3 sm:px-6 sm:py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-sm sm:text-base lg:text-lg shadow-md transition cursor-pointer"
                            title="Hapus pencarian dan tampilkan semua TTB"
                          >
                            <X className="size-5 sm:size-6 lg:size-7 shrink-0" />
                            <span className="font-sans">HAPUS</span>
                          </button>
                        ) : (
                          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Search className="size-3.5 sm:size-4 text-indigo-500" />
                            <span>Ketik di sini</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Header Bar & Quick Filter Chips */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setTtbStatusFilter('ALL')}
                          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm lg:text-base font-black border-2 transition cursor-pointer ${
                            ttbStatusFilter === 'ALL'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                              : 'bg-background hover:bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          Semua TTB ({ttbStats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTtbStatusFilter('SIAP_KIRIM')}
                          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm lg:text-base font-black border-2 transition cursor-pointer inline-flex items-center gap-2 ${
                            ttbStatusFilter === 'SIAP_KIRIM'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                              : 'bg-background hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                          }`}
                          title="Hanya TTB yang telah disahkan Manager (Siap diserahterimakan ke armada)"
                        >
                          <Truck className="size-4 shrink-0" />
                          <span>Siap Serah Terima ({ttbStats.siapKirim})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTtbStatusFilter('BELUM')}
                          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm lg:text-base font-black border-2 transition cursor-pointer inline-flex items-center gap-2 ${
                            ttbStatusFilter === 'BELUM'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                              : 'bg-background hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <Clock className="size-4" />
                          <span>Belum TTD Digital ({ttbStats.belum})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTtbStatusFilter('SUDAH')}
                          className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm lg:text-base font-black border-2 transition cursor-pointer inline-flex items-center gap-2 ${
                            ttbStatusFilter === 'SUDAH'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                              : 'bg-background hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <CheckCircle2 className="size-4" />
                          <span>Sudah TTD Digital ({ttbStats.sudah})</span>
                        </button>
                      </div>

                      <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-mono">
                        <Calendar className="size-4 text-indigo-500" />
                        <span>Urutan: Tanggal TTB Terbaru ↓</span>
                      </div>
                    </div>

                    {/* List Kolom (Tabel Daftar TTB Terbit - Ramah Penglihatan / Font Besar) */}
                    <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-sm">
                      <div className="max-h-[460px] overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-muted/90 backdrop-blur sticky top-0 z-10 text-foreground font-black border-b-2 border-border uppercase text-xs tracking-wider">
                            <tr>
                              <th className="py-3.5 px-4 whitespace-nowrap">Tgl Terbit TTB</th>
                              <th className="py-3.5 px-4 whitespace-nowrap">Nomor TTB Resmi</th>
                              <th className="py-3.5 px-4 whitespace-nowrap">Armada / Unit</th>
                              <th className="py-3.5 px-4 min-w-[220px]">Rincian Item Barang</th>
                              <th className="py-3.5 px-4 whitespace-nowrap">No. FPB / PO</th>
                              <th className="py-3.5 px-4 whitespace-nowrap">Otorisasi Manager &amp; Logistik</th>
                              <th className="py-3.5 px-4 whitespace-nowrap">Status TTD Digital Armada</th>
                              <th className="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/80">
                            {filteredTtbOptions.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                                  {isLoadingHistory ? (
                                    <div className="flex flex-col items-center justify-center gap-2.5">
                                      <RefreshCw className="size-6 text-indigo-500 animate-spin" />
                                      <span className="font-bold text-base">Memuat data TTB...</span>
                                    </div>
                                  ) : ttbSearchTerm ? (
                                    <div className="space-y-2">
                                      <p className="text-base">
                                        Tidak ditemukan data TTB sesuai kata kunci &quot;<strong className="text-foreground">{ttbSearchTerm}</strong>&quot;.
                                      </p>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTtbSearchTerm('');
                                            setTtbStatusFilter('ALL');
                                          }}
                                          className="text-indigo-600 dark:text-indigo-400 font-black underline text-sm sm:text-base cursor-pointer"
                                        >
                                          Reset Pencarian
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="text-base text-muted-foreground">
                                        Belum ada data TTB siap kirim yang tersedia.
                                      </p>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ) : (
                              filteredTtbOptions.map((opt) => (
                                <tr
                                  key={opt.key}
                                  onClick={() => {
                                    if (!opt.isManagerApproved) {
                                      handleBlockedTtbClick(opt);
                                      return;
                                    }
                                    setSelectedTtbRef(opt);
                                    setIsSearchingTtb(false);
                                  }}
                                  className={`border-b border-border/80 transition ${
                                    opt.isManagerApproved
                                      ? 'hover:bg-indigo-500/10 cursor-pointer group'
                                      : 'bg-muted/20 hover:bg-muted/30 cursor-not-allowed opacity-80'
                                  }`}
                                >
                                  {/* Tgl Terbit TTB */}
                                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs sm:text-sm">
                                    {opt.tglTtbFormatted ? (
                                      <div className="flex items-center gap-2 text-foreground font-bold">
                                        <Calendar className="size-4 text-indigo-500 shrink-0" />
                                        <span>{opt.tglTtbFormatted}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/60 italic text-xs">
                                        Belum Ada Tgl
                                      </span>
                                    )}
                                  </td>

                                  {/* Nomor TTB Resmi */}
                                  <td className="py-3.5 px-4 whitespace-nowrap font-mono font-black text-sm sm:text-base text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    <div className="flex items-center gap-2">
                                      <span>{opt.noTtb}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(opt.noTtb);
                                          if (showToast) showToast('No. TTB disalin!', 'info');
                                        }}
                                        className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition"
                                        title="Salin No TTB"
                                      >
                                        <Copy className="size-3.5" />
                                      </button>
                                    </div>
                                  </td>

                                  {/* Armada / Unit */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30 shadow-2xs">
                                      <Ship className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      <span className="truncate max-w-[180px]">{opt.armada}</span>
                                    </span>
                                  </td>

                                  {/* Rincian Item Barang */}
                                  <td className="py-3.5 px-4">
                                    <p className="text-xs sm:text-sm text-foreground/90 font-medium line-clamp-2 leading-relaxed" title={opt.itemSummary}>
                                      {opt.itemSummary}
                                    </p>
                                  </td>

                                  {/* No. FPB / PO */}
                                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs sm:text-sm text-muted-foreground">
                                    {opt.noFpb && <div className="font-semibold text-foreground/80">FPB: {opt.noFpb}</div>}
                                    {opt.noPo && <div className="text-foreground font-bold">PO: {opt.noPo}</div>}
                                    {!opt.noFpb && !opt.noPo && <span>-</span>}
                                  </td>

                                  {/* Otorisasi Manager & Logistik */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {opt.isManagerApproved ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-2xs">
                                          <Truck className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                          <span>Disetujui Manager (Siap Kirim)</span>
                                        </span>
                                        {opt.managerValidatorName && (
                                          <span className="block text-xs text-muted-foreground font-semibold font-mono truncate max-w-[190px]" title={opt.managerValidatorName}>
                                            Manager: {opt.managerValidatorName}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-2xs">
                                          <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                          <span>Menunggu TTD Manager</span>
                                        </span>
                                        <span className="block text-xs text-amber-700 dark:text-amber-400 font-bold font-mono">
                                          Belum Siap Serah Terima
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Status TTD Digital Armada / Penerima Akhir */}
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {opt.isRecipientSigned ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                          <span>Sudah Ditandatangani</span>
                                        </span>
                                        {opt.recipientName && (
                                          <span className="block text-xs text-muted-foreground font-bold font-mono truncate max-w-[180px]">
                                            Oleh: {opt.recipientName}
                                          </span>
                                        )}
                                      </div>
                                    ) : opt.isManagerApproved ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-2xs">
                                          <Clock className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                          <span>Siap Serah Terima</span>
                                        </span>
                                        <span className="block text-xs text-blue-700 dark:text-blue-300 font-bold font-mono">
                                          Menunggu TTD Crew
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-muted text-muted-foreground border border-border">
                                          <Lock className="size-4 shrink-0" />
                                          <span>Terkunci</span>
                                        </span>
                                        <span className="block text-xs text-muted-foreground/80 font-medium font-mono">
                                          Menunggu Manager
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Aksi (Tombol Ekstra Besar Ramah Sentuhan) */}
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      disabled={!opt.isManagerApproved}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!opt.isManagerApproved) {
                                          handleBlockedTtbClick(opt);
                                          return;
                                        }
                                        setSelectedTtbRef(opt);
                                        setIsSearchingTtb(false);
                                      }}
                                      className={`h-11 px-5 rounded-2xl font-black text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-md ${
                                        opt.isManagerApproved
                                          ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white cursor-pointer'
                                          : 'bg-muted text-muted-foreground/60 border border-border cursor-not-allowed opacity-60'
                                      }`}
                                      title={
                                        opt.isManagerApproved
                                          ? 'Pilih TTB ini untuk serah terima ke armada'
                                          : `Belum bisa serah terima: TTB ${opt.noTtb} belum ditandatangani oleh Manager.`
                                      }
                                    >
                                      {opt.isManagerApproved ? (
                                        <>
                                          <span>PILIH TTB</span>
                                          <ChevronRight className="size-4 stroke-[3]" />
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="size-4 shrink-0" />
                                          <span>TERKUNCI</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Summary */}
                      <div className="px-5 py-3 border-t-2 border-border bg-muted/40 text-xs sm:text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="flex items-center gap-2 flex-wrap">
                          <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>
                            Menampilkan <strong className="text-foreground font-mono text-sm sm:text-base">{filteredTtbOptions.length}</strong> data TTB
                            {filteredTtbOptions.length > 0 && (
                              <span className="text-muted-foreground/80 font-mono">
                                {' '}({ttbStats.siapKirim} disetujui Manager, {ttbStats.belumManager} belum Manager, {ttbStats.sudah} sudah TTD penerima)
                              </span>
                            )}
                            <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">
                              • Dokumen wajib disahkan Manager sebelum serah terima
                            </span>
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-mono">
                          Hanya TTB berstatus disetujui Manager yang tombol &quot;Pilih TTB&quot;-nya aktif
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Terpilih Card */
                  <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-white shadow-xs">
                          {selectedTtbRef.noTtb}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                          <ShieldCheck className="size-3.5" />
                          <span>Tervalidasi Staf Logistik: {selectedTtbRef.logistikValidatorName || 'Staf Logistik'}</span>
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-card border border-border text-foreground flex items-center gap-1.5">
                          <Ship className="size-3 text-cyan-500" />
                          <span>{selectedTtbRef.armada}</span>
                        </span>
                        {selectedTtbRef.noFpb && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            FPB: {selectedTtbRef.noFpb}
                          </span>
                        )}
                        {selectedTtbRef.noPo && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            PO: {selectedTtbRef.noPo}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-foreground font-medium">
                        <strong className="text-muted-foreground font-normal">Item Barang: </strong>
                        {selectedTtbRef.itemSummary}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedTtbForModal(selectedTtbRef.noTtb)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted border border-border text-foreground flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Eye className="size-3.5 text-indigo-500" />
                        <span>Lihat Dokumen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTtbRef(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                      >
                        Ganti TTB
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Mode 2: Manual TTB Entry */
              <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border animate-in fade-in">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>
                    <strong>Peringatan Verifikasi &amp; Otorisasi SOP:</strong> Sesuai SOP CPG, hanya dokumen TTB yang telah tuntas ditandatangani dan <strong>disahkan oleh Procurement Manager (Status Siap Kirim)</strong> yang sah diserahterimakan kepada kru armada / end user. TTB yang belum berstatus sah sampai Manager dilarang diproses serah terima.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Nomor TTB Manual *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualNoTtb}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualNoTtb(val);
                        const matched = findMatchingValidatedTtb(val);
                        if (matched) {
                          if (matched.armada && matched.armada !== '-') setManualArmada(matched.armada);
                          if (matched.noFpb) setManualFpb(matched.noFpb);
                          if (matched.noPo) setManualPo(matched.noPo);
                          if (matched.itemSummary) setManualItemSummary(matched.itemSummary);
                        }
                      }}
                      placeholder="Contoh: CPL-TTB-26-06669"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Armada / Unit Tujuan *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualArmada}
                      onChange={(e) => setManualArmada(e.target.value)}
                      placeholder="Contoh: MT KING OCEAN"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      No. FPB (Opsional)
                    </label>
                    <input
                      type="text"
                      value={manualFpb}
                      onChange={(e) => setManualFpb(e.target.value)}
                      placeholder="Contoh: FPB-2026-0812"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Ringkasan Barang
                    </label>
                    <input
                      type="text"
                      value={manualItemSummary}
                      onChange={(e) => setManualItemSummary(e.target.value)}
                      placeholder="Contoh: Filter Oli 4 Pcs"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Live Validation Indicator untuk Input Manual */}
                  {manualNoTtb.trim() && (
                    (() => {
                      const matched = findMatchingValidatedTtb(manualNoTtb);
                      if (!matched) {
                        return (
                          <div className="sm:col-span-2 lg:col-span-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                            <AlertOctagon className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>
                              <strong>Tidak Ditemukan:</strong> Nomor TTB ini tidak ditemukan atau belum tervalidasi di sistem. Harap gunakan nomor TTB resmi yang valid.
                            </span>
                          </div>
                        );
                      }

                      if (!matched.isManagerApproved) {
                        return (
                          <div className="sm:col-span-2 lg:col-span-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>
                              <strong>Otorisasi Manager Belum Lengkap ({matched.approvalProgressCount}/4):</strong> Dokumen {matched.noTtb} ({matched.armada}) baru ditandatangani Staf/Supervisor Logistik dan <strong>belum disahkan oleh Procurement Manager</strong>. Sesuai SOP, serah terima kepada end user belum diizinkan.
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="sm:col-span-2 lg:col-span-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            <strong>Disahkan Manager &amp; Siap Kirim (3/4):</strong> {matched.noTtb} ({matched.armada}) telah diverifikasi lengkap hingga Procurement Manager ({matched.managerValidatorName || 'Manager'}). Sah untuk serah terima lapangan kepada end user.
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: DATA SERAH TERIMA & END USER */}
          <div className="bg-card border-2 border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="size-9 sm:size-10 rounded-2xl bg-cyan-500/20 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-black text-sm sm:text-base shadow-xs">
                2
              </div>
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-foreground">
                  Informasi Petugas Pengantar &amp; Penerima End User
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Identitas petugas lapangan yang mengantar dan personel end-user penerima barang di armada kapal
                </p>
              </div>
            </div>

            {/* 2-Column Responsive Layout: Kolom Isian di Kiri (Menurun) & Tanda Tangan Lebih Besar di Kanan */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Kolom Kiri: Isian Form Menurun Proporsional & Lebih Besar (lg:col-span-5) */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="h-full p-5 sm:p-6 rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-50/40 via-background to-slate-50/50 dark:from-cyan-950/20 dark:via-background dark:to-slate-900/30 flex flex-col justify-between gap-4.5 shadow-sm">
                  {/* Header Kolom Form */}
                  <div className="flex items-center gap-3 border-b border-border/70 pb-3.5">
                    <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Truck className="size-5 sm:size-6" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
                        <span>Data Pengantar &amp; Penerima</span>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                          Identitas Lini
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Identitas personel kurir lapangan, kru kapal, &amp; waktu serah terima
                      </p>
                    </div>
                  </div>

                  {/* Body Form: 4 Kolom Isian Lebih Besar & Proporsional */}
                  <div className="flex-1 flex flex-col justify-between gap-4 pt-1">
                    {/* 1. Petugas Pengantar */}
                    <div>
                      <label className="text-sm sm:text-base font-black text-foreground flex items-center gap-2 mb-2">
                        <Truck className="size-5 text-cyan-500" />
                        <span>Petugas Pengantar (Tim Lapangan) *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={petugasNama}
                        onChange={(e) => setPetugasNama(e.target.value)}
                        placeholder="Nama petugas logistik lapangan"
                        className="w-full px-4.5 py-3.5 sm:py-4 min-h-[54px] sm:min-h-[58px] text-base sm:text-lg rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500 font-bold text-foreground shadow-xs placeholder:text-muted-foreground/60 placeholder:font-normal"
                      />
                    </div>

                    {/* 2. Penerima Barang (End User) */}
                    <div>
                      <label className="text-sm sm:text-base font-black text-foreground flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <User className="size-5 text-emerald-500" />
                          <span>Penerima Barang (End User) *</span>
                        </span>
                        {matchedCrewList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isManualPenerima) {
                                setIsManualPenerima(false);
                                if (matchedCrewList[0]) handleSelectCrew(String(matchedCrewList[0].id));
                              } else {
                                setIsManualPenerima(true);
                                setSelectedCrewId('MANUAL');
                              }
                            }}
                            className="text-xs sm:text-sm font-black text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/20"
                          >
                            {isManualPenerima ? `← Pilih Kru (${matchedCrewList.length})` : '✏️ Ketik Manual'}
                          </button>
                        )}
                      </label>

                      {matchedCrewList.length > 0 && !isManualPenerima ? (
                        <div className="space-y-2.5">
                          {/* Tap Cepat Kru untuk Tablet/iPad */}
                          <div className="flex flex-wrap items-center gap-1.5 pb-1">
                            <span className="text-xs font-black text-muted-foreground mr-1 flex items-center gap-1">
                              <span>⚓</span>
                              <span>Pilih Cepat:</span>
                            </span>
                            {matchedCrewList.slice(0, 4).map((crew) => {
                              const isSelected = selectedCrewId === crew.id;
                              return (
                                <button
                                  key={crew.id}
                                  type="button"
                                  onClick={() => handleSelectCrew(String(crew.id))}
                                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all border flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30'
                                      : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20'
                                  }`}
                                >
                                  <span>{crew.jabatan}</span>
                                  <span className="opacity-60">•</span>
                                  <span>{crew.namaPersonel}</span>
                                </button>
                              );
                            })}
                          </div>

                          <select
                            value={selectedCrewId}
                            onChange={(e) => handleSelectCrew(e.target.value)}
                            className="w-full px-4.5 py-3.5 sm:py-4 min-h-[54px] sm:min-h-[58px] text-base sm:text-lg rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-foreground cursor-pointer shadow-xs"
                          >
                            <option value="" disabled>-- Pilih Kru Penerima ({matchedCrewList.length} Personel) --</option>
                            {matchedCrewList.map((crew) => (
                              <option key={crew.id} value={crew.id}>
                                {crew.jabatan} - {crew.namaPersonel} {crew.noHp && crew.noHp !== '-' ? `(WA: ${crew.noHp})` : ''}
                              </option>
                            ))}
                            <option value="MANUAL">✏️ Input Manual (Nama di Luar Daftar Kru)</option>
                          </select>

                          <div className="flex items-center justify-between text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-3.5 py-2 rounded-xl border border-emerald-500/30 font-bold">
                            <span className="flex items-center gap-1.5 truncate">
                              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                              <span>Kru Terverifikasi: <strong>{matchedShipName || currentArmada}</strong></span>
                            </span>
                            <span className="text-muted-foreground font-mono text-xs shrink-0">
                              {matchedCrewList.find((c) => c.id === selectedCrewId)?.departemen || 'Deck/Engine'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            required
                            value={penerimaNama}
                            onChange={(e) => setPenerimaNama(e.target.value)}
                            placeholder={matchedCrewList.length > 0 ? "Ketik nama penerima..." : "Contoh: Mualim 1 Budi / Chief Eng. Anton"}
                            className="w-full px-4.5 py-3.5 sm:py-4 min-h-[54px] sm:min-h-[58px] text-base sm:text-lg rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-foreground shadow-xs placeholder:text-muted-foreground/60 placeholder:font-normal"
                          />
                          {matchedCrewList.length === 0 && currentArmada && currentArmada !== '-' && (
                            <p className="text-xs text-muted-foreground italic">
                              Tidak ada kru di modul Crew &amp; Armada untuk {currentArmada} (ketik manual).
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. No. Telp / WA Penerima */}
                    <div>
                      <label className="text-sm sm:text-base font-black text-foreground flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2">
                          <Phone className="size-5 text-indigo-500" />
                          <span>No. Telp / WA Penerima</span>
                        </span>
                        {kontakPenerima && (
                          <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Sparkles className="size-3.5" />
                            <span>Otomatis</span>
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={kontakPenerima}
                          onChange={(e) => setKontakPenerima(e.target.value)}
                          placeholder="Contoh: 0812-3456-7890"
                          className="w-full px-4.5 py-3.5 sm:py-4 min-h-[54px] sm:min-h-[58px] text-base sm:text-lg rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-black text-foreground shadow-xs placeholder:text-muted-foreground/60 placeholder:font-normal"
                        />
                        {kontakPenerima && (
                          <button
                            type="button"
                            onClick={() => setKontakPenerima('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
                            title="Hapus no telp"
                          >
                            <X className="size-4.5" />
                          </button>
                        )}
                      </div>
                      {matchedShipPhone && kontakPenerima !== matchedShipPhone && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
                          <span>No. Telp Kapal:</span>
                          <button
                            type="button"
                            onClick={() => setKontakPenerima(matchedShipPhone)}
                            className="text-indigo-600 dark:text-indigo-400 font-mono font-bold underline cursor-pointer"
                            title="Gunakan no telp kapal ini"
                          >
                            {matchedShipPhone}
                          </button>
                        </p>
                      )}
                    </div>

                    {/* 4. Waktu Serah Terima Barang */}
                    <div>
                      <label className="text-sm sm:text-base font-black text-foreground flex items-center gap-2 mb-2">
                        <Clock className="size-5 text-amber-500" />
                        <span>Waktu Serah Terima Barang *</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={waktuSerahTerima}
                        onChange={(e) => setWaktuSerahTerima(e.target.value)}
                        className="w-full px-4.5 py-3.5 sm:py-4 min-h-[54px] sm:min-h-[58px] text-base sm:text-lg rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 font-mono font-bold text-foreground shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Tanda Tangan Lebih Besar & Luas (lg:col-span-7) */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="h-full p-5 sm:p-6 rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 via-background to-blue-50/30 dark:from-indigo-950/20 dark:via-background dark:to-blue-950/10 flex flex-col justify-between space-y-4 shadow-sm">
                  {/* Header Tanda Tangan */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        <FileSignature className="size-5 sm:size-6" />
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-black text-foreground flex items-center gap-2 flex-wrap">
                          <span>Bukti Tanda Terima (Digital Signature Penerima Akhir)</span>
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                            Auto-Stamp TTB
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Tanda tangan digital penerima barang otomatis dibubuhkan ke dokumen PDF TTB resmi pada kolom <strong className="text-foreground">&quot;Received By : User&quot;</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <input
                        ref={sigFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSigFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => sigFileInputRef.current?.click()}
                        className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Upload file gambar tanda tangan (PNG/JPG)"
                      >
                        <Upload className="size-3.5" />
                        <span>Upload TTD</span>
                      </button>
                      {(hasDrawnSig || sigDataUrl) && (
                        <button
                          type="button"
                          onClick={clearSig}
                          className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          title="Hapus tanda tangan"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Canvas Signature Pad - Lebih Besar & Nyaman Digores */}
                  <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] lg:min-h-[280px] border-2 border-dashed border-indigo-300 dark:border-indigo-800 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden shadow-inner flex flex-col">
                    <canvas
                      ref={sigCanvasRef}
                      width={800}
                      height={340}
                      onMouseDown={startDrawingSig}
                      onMouseMove={drawSig}
                      onMouseUp={stopDrawingSig}
                      onMouseLeave={stopDrawingSig}
                      onTouchStart={startDrawingSig}
                      onTouchMove={drawSig}
                      onTouchEnd={stopDrawingSig}
                      className="w-full h-full min-h-[220px] sm:min-h-[260px] lg:min-h-[280px] block touch-none cursor-crosshair bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:14px_14px]"
                    />
                    {!hasDrawnSig && !sigDataUrl && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/70 gap-2.5 p-4 select-none">
                        <PenTool className="size-8 stroke-[2] text-indigo-400/80 animate-bounce" />
                        <p className="text-sm sm:text-base font-bold text-center text-foreground/85">
                          Tanda tangani di sini menggunakan mouse, stylus, atau sentuhan layar ponsel/tablet
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground/70">
                          Penerima: {penerimaNama ? <strong className="text-foreground">{penerimaNama}</strong> : '(Isi nama penerima di sebelah kiri)'}
                        </p>
                      </div>
                    )}

                    {/* Garis tanda tangan bawah */}
                    <div className="absolute bottom-6 left-8 right-8 border-b-2 border-indigo-200 dark:border-indigo-900/60 pointer-events-none flex justify-between text-xs sm:text-sm font-bold text-muted-foreground/60 pt-1 select-none">
                      <span>X</span>
                      <span>Tanda Tangan Penerima Barang</span>
                    </div>
                  </div>

                  {/* Footer preview info */}
                  <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm text-muted-foreground px-1 gap-2 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="size-2 rounded-full bg-indigo-500" />
                      <span>
                        Penerima: <strong className="text-foreground">{penerimaNama || '(Belum diisi)'}</strong>
                      </span>
                      <span className="text-muted-foreground/40">•</span>
                      <span>
                        Tanggal: <strong className="text-foreground">{waktuSerahTerima ? waktuSerahTerima.split('T')[0] : 'Hari ini'}</strong>
                      </span>
                    </div>
                    {(hasDrawnSig || sigDataUrl) && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                        <Check className="size-4" />
                        Tanda tangan siap distempel ke TTB
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Kondisi Serah Terima */}
            <div className="space-y-3 pt-2">
              <label className="text-xs sm:text-sm font-black text-foreground block">
                Kondisi &amp; Status Penyerahan Barang *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <button
                  type="button"
                  onClick={() => setKondisi('LENGKAP_BAIK')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                    kondisi === 'LENGKAP_BAIK'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-4 ring-emerald-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm sm:text-base font-black text-foreground">Diterima Lengkap &amp; Baik</div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Jumlah dan spesifikasi barang sesuai TTB tanpa kekurangan.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKondisi('PARSIAL')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                    kondisi === 'PARSIAL'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-4 ring-amber-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm sm:text-base font-black text-foreground">Diterima Sebagian (Parsial)</div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Sebagian barang diserahkan, sisanya menyusul.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKondisi('CATATAN_KONDISI')}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                    kondisi === 'CATATAN_KONDISI'
                      ? 'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200 ring-4 ring-rose-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <AlertOctagon className="size-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm sm:text-base font-black text-foreground">Catatan / Kerusakan Fisik</div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Ada catatan kondisi kemasan, segel, atau perbedaan fisik.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Catatan Lapangan */}
            <div>
              <label className="text-xs sm:text-sm font-black text-foreground block mb-2">
                Catatan Pengantaran &amp; Lokasi Serah Terima (Opsional)
              </label>
              <textarea
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Barang diserahkan langsung di Dermaga Somber, disaksikan oleh perwira jaga. Kondisi palka bersih dan aman."
                className="w-full px-4 py-3 text-sm sm:text-base rounded-2xl bg-background border-2 border-border focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* STEP 3: UNGGAH BUKTI FOTO PENYERAHAN BARANG */}
          <div className="bg-card border-2 border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="size-9 sm:size-10 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-sm sm:text-base shadow-xs">
                  3
                </div>
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-foreground flex items-center gap-2.5 flex-wrap">
                    <span>Unggah Bukti Foto Penyerahan Barang</span>
                    <span className="text-xs font-mono px-3 py-0.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold">
                      Cloudflare R2
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Foto fisik barang di kapal/lokasi, TTB bertanda tangan basah, atau foto penyerahan bersama penerima
                  </p>
                </div>
              </div>

              {queuedPhotos.length > 0 && (
                <span className="text-xs sm:text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-2xs">
                  {queuedPhotos.length} Foto Siap Diupload
                </span>
              )}
            </div>

            {/* Hidden Input File / Camera */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleAddPhotos(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddPhotos(e.target.files)}
            />

            {/* Action Buttons for Mobile/Field Worker & Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-5 sm:p-6 rounded-2xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 flex items-center justify-center gap-4 transition cursor-pointer group shadow-xs active:scale-95"
              >
                <div className="size-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition shadow-xs">
                  <Camera className="size-6 text-cyan-600 dark:text-cyan-400 stroke-[2.2]" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-black text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                    Buka Kamera Langsung (HP/Tablet)
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                    Ambil foto langsung di lokasi dermaga / armada kapal
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 sm:p-6 rounded-2xl border-2 border-dashed border-indigo-500/50 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-4 transition cursor-pointer group shadow-xs active:scale-95"
              >
                <div className="size-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition shadow-xs">
                  <Images className="size-6 text-indigo-600 dark:text-indigo-400 stroke-[2.2]" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-black text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Pilih Foto dari Galeri / Berkas
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                    Unggah beberapa foto sekaligus dari galeri perangkat
                  </div>
                </div>
              </button>
            </div>

            {/* Photo Queue Preview Grid */}
            {queuedPhotos.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="text-xs sm:text-sm font-black text-foreground flex items-center justify-between">
                  <span>Pratinjau Foto Bukti Serah Terima ({queuedPhotos.length}):</span>
                  <button
                    type="button"
                    onClick={() => setQueuedPhotos([])}
                    className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                  {queuedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-2xl overflow-hidden border-2 border-border bg-muted/40 aspect-square flex flex-col justify-end shadow-xs"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={`Bukti ${idx + 1}`}
                        className="absolute inset-0 size-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-90" />

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-md cursor-pointer"
                        title="Hapus foto ini"
                      >
                        <X className="size-3.5" />
                      </button>

                      {/* Zoom Lightbox */}
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxPhoto({
                            url: photo.previewUrl,
                            title: `Bukti Foto ${idx + 1} (${photo.sizeFormatted})`,
                          })
                        }
                        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 shadow-md cursor-pointer"
                        title="Perbesar"
                      >
                        <Maximize2 className="size-3.5" />
                      </button>

                      {/* Info Label */}
                      <div className="relative z-10 p-2.5 text-white">
                        <div className="text-xs font-black">Foto #{idx + 1}</div>
                        <div className="text-[10px] text-slate-300 font-mono">
                          {photo.sizeFormatted}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nomenclature preview */}
                <div className="p-3.5 rounded-2xl bg-muted/50 border border-border text-xs text-muted-foreground flex items-center gap-2.5">
                  <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span>Format nama file otomatis Cloudflare R2: </span>
                    <strong className="font-mono text-foreground font-black">
                      {previewSampleFilename}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl text-sm font-medium text-muted-foreground">
                Belum ada foto yang dipilih. Silakan klik tombol kamera langsung atau pilih dari galeri perangkat.
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON BAR (Ramah Petugas Lapangan, Jelas, & Kontras) */}
          <div className="sticky bottom-4 z-20 bg-background/95 backdrop-blur-md border-2 border-border p-4 sm:p-5 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-muted-foreground font-medium">
              {uploadProgressMsg ? (
                <span className="text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  <span>{uploadProgressMsg}</span>
                </span>
              ) : (
                <span>
                  Pastikan data TTB referensi, nama penerima di kapal, dan minimal 1 foto telah terisi dengan benar.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClearForm}
                disabled={isSubmitting}
                className="h-12 sm:h-13 px-6 rounded-2xl text-xs sm:text-sm font-bold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer flex-1 sm:flex-initial"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 sm:h-13 px-7 sm:px-9 rounded-2xl text-sm sm:text-base font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-teal-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer flex-1 sm:flex-initial disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-5 animate-spin" />
                    <span>Menyimpan ke R2...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="size-5 stroke-[2.5]" />
                    <span>Kirim Bukti Serah Terima Lapangan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: RIWAYAT PENGANTARAN & SERAH TERIMA LAPANGAN      */}
      {/* ======================================================== */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-card border-2 border-border rounded-3xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 size-7 sm:size-9 text-cyan-600 dark:text-cyan-400 shrink-0 transition-transform group-focus-within:scale-110" />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Cari riwayat serah terima (No. TTB, Armada, Penerima)..."
                className="w-full pl-15 sm:pl-20 pr-28 sm:pr-36 py-5 sm:py-6 text-lg sm:text-2xl font-black rounded-2xl bg-background border-4 border-cyan-500/80 dark:border-cyan-400 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-600 dark:focus:border-cyan-300 focus:ring-8 focus:ring-cyan-500/20 shadow-md transition"
              />
              {historySearchTerm && (
                <button
                  type="button"
                  onClick={() => setHistorySearchTerm('')}
                  className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-base shadow-sm transition"
                  title="Hapus pencarian riwayat"
                >
                  <X className="size-4 sm:size-5" />
                  <span className="hidden sm:inline">HAPUS</span>
                </button>
              )}
            </div>

            {/* Filter Kondisi Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setHistoryKondisiFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  historyKondisiFilter === 'ALL'
                    ? 'bg-foreground text-background font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua ({historyRecords.length})
              </button>
              <button
                onClick={() => setHistoryKondisiFilter('LENGKAP_BAIK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  historyKondisiFilter === 'LENGKAP_BAIK'
                    ? 'bg-emerald-500 text-white font-semibold'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                Lengkap &amp; Baik
              </button>
              <button
                onClick={() => setHistoryKondisiFilter('PARSIAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  historyKondisiFilter === 'PARSIAL'
                    ? 'bg-amber-500 text-white font-semibold'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                Parsial
              </button>
              <button
                onClick={() => setHistoryKondisiFilter('CATATAN_KONDISI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  historyKondisiFilter === 'CATATAN_KONDISI'
                    ? 'bg-rose-500 text-white font-semibold'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                }`}
              >
                Ada Catatan
              </button>
            </div>
          </div>

          {/* Cards List */}
          {isLoadingHistory ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="size-6 animate-spin text-cyan-500" />
              <span>Memuat riwayat serah terima dari Cloudflare R2...</span>
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.map((rec) => {
                const isDeleting = deletingId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="bg-card border border-border hover:border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 transition group"
                  >
                    {/* Header: TTB Badge, Kondisi Badge, Tanggal */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTtbForModal(rec.noTtb)}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer flex items-center gap-1.5"
                          title="Klik untuk buka dokumen TTB lengkap"
                        >
                          <span>{rec.noTtb}</span>
                          <ExternalLink className="size-3" />
                        </button>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            rec.kondisi === 'LENGKAP_BAIK'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : rec.kondisi === 'PARSIAL'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {rec.kondisi === 'LENGKAP_BAIK'
                            ? 'Lengkap & Baik'
                            : rec.kondisi === 'PARSIAL'
                            ? 'Parsial'
                            : 'Catatan Fisik'}
                        </span>

                        {rec.isTtbDocumentStamped && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                            <FileSignature className="size-2.5" />
                            <span>TTB Stamped</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="size-3" />
                        <span>{rec.tanggalSerahTerima}</span>
                      </div>
                    </div>

                    {/* Middle Info: Armada, Penerima, Petugas */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-xl border border-border/60">
                      <div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Ship className="size-3 text-cyan-500" />
                          <span>Armada / Unit</span>
                        </div>
                        <div className="font-semibold text-foreground truncate mt-0.5">
                          {rec.armada || '-'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="size-3 text-emerald-500" />
                          <span>Penerima (End User)</span>
                        </div>
                        <div className="font-semibold text-foreground truncate mt-0.5">
                          {rec.penerima}
                        </div>
                      </div>

                      <div className="col-span-2 pt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Truck className="size-3 text-indigo-500" />
                          <span>Pengantar: <strong>{rec.petugas}</strong></span>
                        </span>
                        {rec.kontakPenerima && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Tel: {rec.kontakPenerima}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Item summary / Catatan */}
                    {(rec.itemSummary || rec.catatan) && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {rec.itemSummary && (
                          <div className="line-clamp-1">
                            <span className="text-foreground font-medium">Barang: </span>
                            {rec.itemSummary}
                          </div>
                        )}
                        {rec.catatan && (
                          <div className="italic text-[11px] bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/50">
                            "{rec.catatan}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recipient Digital Signature Evidence */}
                    {rec.penerimaSignature && (
                      <div className="p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-10 rounded-lg border border-border bg-white dark:bg-slate-900 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
                            <img
                              src={rec.penerimaSignature}
                              alt={`TTD ${rec.penerima}`}
                              className="size-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <FileSignature className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span className="truncate">Evidence TTD: {rec.penerima}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              {rec.isTtbDocumentStamped ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                  <Check className="size-2.5" />
                                  <span>Telah distempel ke dokumen PDF resmi TTB</span>
                                </span>
                              ) : (
                                <span>Tersimpan sebagai otentifikasi bukti serah terima</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {(rec.ttbDocumentUrl || rec.isTtbDocumentStamped) && (
                          <a
                            href={
                              rec.ttbDocumentUrl ||
                              `/api/r2-file?key=ttb-documents%2F${encodeURIComponent(rec.cleanNoTtb || rec.noTtb)}.pdf&v=${Date.now()}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-[10px] font-medium rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 shrink-0 transition"
                            title="Buka dokumen TTB resmi yang telah ditandatangani penerima"
                          >
                            <span>Lihat PDF</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Photo Thumbnails */}
                    {rec.photos && rec.photos.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Bukti Foto ({rec.photos.length}):</span>
                          <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                            Cloudflare R2 Synced
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {rec.photos.map((p, idx) => (
                            <div
                              key={p.name || idx}
                              onClick={() =>
                                setLightboxPhoto({
                                  url: p.url,
                                  title: `${rec.noTtb} - ${rec.armada} (Foto ${idx + 1})`,
                                })
                              }
                              className="relative size-16 rounded-xl overflow-hidden border border-border shrink-0 cursor-pointer hover:opacity-90 group/thumb"
                            >
                              <img
                                src={p.url}
                                alt={p.name}
                                className="size-full object-cover group-hover/thumb:scale-110 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition">
                                <Maximize2 className="size-4 text-white drop-shadow-md" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Card Footer: Copy No TTB & Delete */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleCopyText(rec.noTtb, rec.id)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                      >
                        {copiedKey === rec.id ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span className="text-emerald-500">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Salin TTB</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTtbForModal(rec.noTtb)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1 transition cursor-pointer"
                        >
                          <Eye className="size-3 text-indigo-500" />
                          <span>Detail TTB</span>
                        </button>

                        {(isAdmin || canEdit) && (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRecord(rec);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus rekaman serah terima ini & sinkronkan ke Cloudflare R2"
                          >
                            {isDeleting ? (
                              <RefreshCw className="size-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card space-y-3">
              <div className="size-12 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
                <Truck className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Belum Ada Riwayat Serah Terima Lapangan
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Tim lapangan dapat mulai mengunggah bukti serah terima barang ke end user dengan mengklik tombol di bawah ini.
              </p>
              <button
                type="button"
                onClick={() => setActiveView('form')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition cursor-pointer shadow-md"
              >
                + Mulai Input Serah Terima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal Full Photo Preview */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="text-xs font-semibold truncate pr-4">
                {lightboxPhoto.title}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-slate-400 hover:text-white transition"
                  title="Buka gambar asli"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1 rounded text-slate-400 hover:text-white transition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/60 overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Unified TTB Media Modal Integration */}
      {selectedTtbForModal && (
        <TtbMediaModal
          isOpen={true}
          onClose={() => setSelectedTtbForModal(null)}
          noTtb={selectedTtbForModal}
          showToast={showToast}
        />
      )}

      {/* Modal Konfirmasi Hapus Rekaman & Sinkronisasi Cloudflare R2 */}
      {confirmDeleteRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Hapus Bukti Serah Terima Lapangan</h3>
                <p className="text-xs text-muted-foreground">Sinkronisasi Cloudflare R2 &amp; Sistem Validasi</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">No. TTB:</span>
                <span className="font-mono font-bold text-foreground">{confirmDeleteRecord.noTtb}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Armada / Unit:</span>
                <span className="font-semibold text-foreground">{confirmDeleteRecord.armada || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Penerima:</span>
                <span className="text-foreground">{confirmDeleteRecord.penerima}</span>
              </div>
              {confirmDeleteRecord.photos && confirmDeleteRecord.photos.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bukti Foto:</span>
                  <span className="text-rose-500 font-medium">{confirmDeleteRecord.photos.length} berkas di Cloudflare R2</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Apakah Anda yakin ingin menghapus bukti serah terima ini? Tindakan ini akan:
              <br />• Menghapus seluruh foto bukti pengiriman dari <strong>Cloudflare R2</strong>.
              <br />• Mereset status tanda tangan penerima pada sistem validasi digital agar dapat diinput ulang.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => executeDeleteRecord(confirmDeleteRecord)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {deletingId ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menghapus &amp; Syncing R2...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    <span>Ya, Hapus Permanen &amp; Sync R2</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small Cloudflare icon helper
function CloudFlareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.43 12.98A5.99 5.99 0 0 0 8.08 9.5a4.5 4.5 0 0 0-3.57 4.38 4.48 4.48 0 0 0 .57 2.12H19.5a2.5 2.5 0 0 0-.07-3.02z" />
    </svg>
  );
}

