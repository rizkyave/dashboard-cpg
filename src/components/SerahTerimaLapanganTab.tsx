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
}

export type TtbDateRangeType = 'H-4' | 'H-7' | 'H-14' | 'H-30' | 'ALL' | 'CUSTOM';

export default function SerahTerimaLapanganTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  onOpenAudit,
  showToast,
}: SerahTerimaLapanganTabProps) {
  const { user, canEdit, isAdmin } = useAuth();

  // Active view: 'form' (Input Pengantaran) atau 'history' (Riwayat Serah Terima)
  const [activeView, setActiveView] = useState<'form' | 'history'>('form');

  // --- FORM STATE ---
  // TTB Reference search & selection
  const [ttbSearchTerm, setTtbSearchTerm] = useState<string>('');
  const [isSearchingTtb, setIsSearchingTtb] = useState<boolean>(false);
  const [selectedTtbRef, setSelectedTtbRef] = useState<TtbReferenceOption | null>(null);
  const [ttbStatusFilter, setTtbStatusFilter] = useState<'ALL' | 'BELUM' | 'SUDAH'>('ALL');
  // Pilihan rentang waktu terbit TTB: default H-4 (4 hari terakhir) agar data tidak berat
  const [ttbDateRange, setTtbDateRange] = useState<TtbDateRangeType>('H-4');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [uploadedTtbs, setUploadedTtbs] = useState<UploadedTtbItem[]>([]);
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

    return map;
  }, [historyRecords, uploadedTtbs]);

  // 1. Build TTB Reference Catalog from Sisa Layanan, Procurement, and Armada Data
  // Diurutkan berdasarkan tanggal terbaru TTB terbit (newest date first)
  const ttbReferenceCatalog = useMemo(() => {
    const map = new Map<string, TtbReferenceOption>();

    const addOrUpdate = (
      rawTtb: string,
      armada: string,
      noFpb: string | undefined,
      noPo: string | undefined,
      namaBarang: string | undefined,
      satuan: string | undefined,
      qty: number | string | undefined,
      rawDate: string | undefined
    ) => {
      const ttbClean = (rawTtb || '').trim();
      if (!ttbClean || ttbClean === '-' || ttbClean.toLowerCase() === 'null') return;
      const cleanKey = ttbClean.toUpperCase().replace(/\s+/g, ' ');

      const signedInfo = signedTtbMap.get(cleanKey);
      const isSigned = Boolean(signedInfo);

      const dInfo = extractDateInfo(rawDate);
      const dateFormatted = formatDateDdMmYy(rawDate);
      const timestamp = dInfo.timestamp || 0;

      if (!map.has(cleanKey)) {
        map.set(cleanKey, {
          key: cleanKey,
          noTtb: ttbClean,
          cleanNoTtb: cleanKey,
          armada: (armada || '').trim() || '-',
          noFpb: noFpb || undefined,
          noPo: noPo || undefined,
          vendor: undefined,
          itemSummary: namaBarang
            ? `${namaBarang} (${qty || 1} ${satuan || ''})`.trim()
            : 'Barang Pengadaan / Sisa Layanan',
          itemsCount: 1,
          tglTtb: rawDate || undefined,
          tglTtbFormatted: dateFormatted !== '-' ? dateFormatted : '',
          tglTtbTimestamp: timestamp,
          isRecipientSigned: isSigned,
          recipientName: signedInfo?.recipientName,
          signedAt: signedInfo?.signedAt,
        });
      } else {
        const existing = map.get(cleanKey)!;
        if (namaBarang && !existing.itemSummary.includes(namaBarang)) {
          existing.itemSummary += `, ${namaBarang}`;
          existing.itemsCount += 1;
        }
        // Update tanggal jika record baru memiliki timestamp yang lebih baru / valid
        if (timestamp > existing.tglTtbTimestamp) {
          existing.tglTtb = rawDate;
          existing.tglTtbFormatted = dateFormatted !== '-' ? dateFormatted : existing.tglTtbFormatted;
          existing.tglTtbTimestamp = timestamp;
        }
        if (!existing.noFpb && noFpb) existing.noFpb = noFpb;
        if (!existing.noPo && noPo) existing.noPo = noPo;
        if (existing.armada === '-' && armada && armada !== '-') existing.armada = armada;
        if (isSigned && !existing.isRecipientSigned) {
          existing.isRecipientSigned = true;
          existing.recipientName = signedInfo?.recipientName;
          existing.signedAt = signedInfo?.signedAt;
        }
      }
    };

    // Dari Sisa Layanan
    sisaLayananItems.forEach((item) => {
      addOrUpdate(
        item.noTtb || '',
        item.departement || '',
        item.noFpb,
        item.noPo,
        item.namaBarang,
        item.satuan,
        item.jmlTtb || item.jmlPo,
        item.tglTtb || item.tglPo || item.tglFpb
      );
    });

    // Dari Procurement
    procurementItems.forEach((item) => {
      addOrUpdate(
        item.noTtb || '',
        item.deptArmada || '',
        item.fpb,
        item.po,
        item.item,
        item.satuan,
        item.qtyTTB || item.qtyPO,
        item.tglTtb || item.tglInputTtb || item.tglPo || item.date
      );
    });

    // Dari Uploaded TTB (Cloudflare R2)
    uploadedTtbs.forEach((u) => {
      addOrUpdate(
        u.noTtb,
        u.armada,
        undefined,
        undefined,
        u.keterangan || u.renamedFileName,
        undefined,
        1,
        u.receivedDate || u.uploadedAt
      );
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
  }, [sisaLayananItems, procurementItems, uploadedTtbs, signedTtbMap]);

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
    dateFilteredCatalog.forEach((opt) => {
      if (opt.isRecipientSigned) sudahCount++;
      else belumCount++;
    });
    return {
      total: dateFilteredCatalog.length,
      belum: belumCount,
      sudah: sudahCount,
      grandTotal: ttbReferenceCatalog.length,
    };
  }, [dateFilteredCatalog, ttbReferenceCatalog]);

  // Autocomplete matching & filter results (Status TTD & Pencarian)
  const filteredTtbOptions = useMemo(() => {
    let result = dateFilteredCatalog;

    // Filter status TTD digital penerima
    if (ttbStatusFilter === 'BELUM') {
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

  // Fetch riwayat serah terima dari API & berkas Upload TTB
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const [resHistory, resUploadTtb] = await Promise.allSettled([
        fetch('/api/serah-terima'),
        fetch(`/api/upload-ttb?_t=${Date.now()}`),
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
    } catch (err) {
      console.warn('Gagal memuat riwayat serah terima & upload TTB:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
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

  // Hapus riwayat
  const handleDeleteRecord = async (record: SerahTerimaItem) => {
    if (!window.confirm(`Hapus rekaman serah terima TTB "${record.noTtb}" beserta foto buktinya?`)) {
      return;
    }

    setDeletingId(record.id);
    try {
      const res = await fetch(`/api/serah-terima?id=${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
      });
      const data: SerahTerimaResponse = await res.json();
      if (res.ok && data.success) {
        setHistoryRecords((prev) => prev.filter((r) => r.id !== record.id));
        showToast?.(`Rekaman serah terima ${record.noTtb} berhasil dihapus.`, 'success');
      } else {
        showToast?.(data.error || 'Gagal menghapus rekaman.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan saat menghapus data.', 'error');
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
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner - Tim Lapangan Delivery Portal */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-5 sm:p-6 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 size-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-semibold tracking-wide">
              <Truck className="size-3.5" />
              <span>Portal Operasional &amp; Tim Lapangan CPG</span>
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Serah Terima Lapangan &amp; Bukti Kirim TTB</span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                End-User Proof
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Semua pengiriman barang wajib menggunakan data <strong>TTB resmi</strong> sebagai referensi. Unggah bukti foto serah terima fisik barang atau lembar TTB bertanda tangan agar pengiriman terverifikasi selesai dan otomatis tampil di <strong>Galeri Foto TTB</strong> serta <strong>Overview</strong>.
            </p>
          </div>

          {/* Quick Metrics & Storage Status */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[110px]">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-400" />
                <span>Terverifikasi</span>
              </div>
              <div className="text-lg font-mono font-black text-white">
                {historyRecords.length}
              </div>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/80 rounded-xl px-3.5 py-2 text-center min-w-[130px]">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <CloudFlareIcon className="size-3 text-amber-400" />
                <span>Cloudflare R2</span>
              </div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Aktif &amp; Sinkron</span>
              </div>
            </div>

            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              title="Perbarui data serah terima"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className={`size-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="relative z-10 flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveView('form')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'form'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 font-bold'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Plus className="size-4" />
            <span>Form Input Serah Terima Baru</span>
          </button>

          <button
            onClick={() => setActiveView('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              activeView === 'history'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 font-bold'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Clock className="size-4" />
            <span>Riwayat Pengantaran Lapangan</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900/60 text-cyan-300 border border-cyan-500/30">
              {historyRecords.length}
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
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  1
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Pilih Referensi Data TTB</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold">
                      Wajib
                    </span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Semua pengantaran wajib mengacu pada nomor TTB pengadaan atau barang sisa layanan
                  </p>
                </div>
              </div>

              {/* KOTAK HITAM: Kontrol Pilihan Rentang Waktu (Default: H-4) */}
              {!isManualTtb && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-muted/70 dark:bg-muted/40 border border-border/80 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    <Calendar className="size-3.5 text-indigo-500 shrink-0" />
                    <span>Rentang Terbit:</span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {(['H-4', 'H-7', 'H-14', 'H-30', 'ALL', 'CUSTOM'] as const).map((rng) => {
                      const isActive = ttbDateRange === rng;
                      const labelMap: Record<typeof rng, string> = {
                        'H-4': 'H-4 (Default)',
                        'H-7': 'H-7',
                        'H-14': 'H-14',
                        'H-30': 'H-30',
                        'ALL': 'Semua',
                        'CUSTOM': 'Kustom',
                      };
                      return (
                        <button
                          key={rng}
                          type="button"
                          onClick={() => setTtbDateRange(rng)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-500/40'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                          }`}
                          title={
                            rng === 'H-4'
                              ? 'Default: 4 Hari Terakhir (H-4 s/d Hari ini)'
                              : rng === 'ALL'
                              ? 'Tampilkan semua arsip berkas TTB'
                              : `Rentang ${rng}`
                          }
                        >
                          {labelMap[rng]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Badge rentang tanggal aktif */}
                  <div className="hidden lg:flex items-center gap-1 pl-1.5 border-l border-border/60 text-[10.5px] font-mono text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap">
                    <span>{dateRangeBounds.label}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsManualTtb(!isManualTtb);
                  setSelectedTtbRef(null);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer self-start xl:self-auto shrink-0"
              >
                {isManualTtb ? '← Pilih dari Database TTB' : '+ Input Nomor TTB Manual'}
              </button>
            </div>

            {/* Input Rentang Tanggal Kustom (jika Kustom dipilih) */}
            {!isManualTtb && ttbDateRange === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300">
                  <Calendar className="size-3.5 text-indigo-500" />
                  <span>Tentukan Rentang Tanggal Terbit TTB:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Dari:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Sampai:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold underline cursor-pointer ml-auto"
                  >
                    Reset Tanggal
                  </button>
                )}
              </div>
            )}

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
                        <span>Urutan: Tanggal TTB Terbaru ↓ ({dateRangeBounds.label})</span>
                      </div>
                    </div>

                    {/* List Kolom (Tabel Daftar TTB Terbit) */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                      <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-muted/80 backdrop-blur sticky top-0 z-10 text-muted-foreground font-semibold border-b border-border uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3 whitespace-nowrap">Tgl Terbit TTB</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Nomor TTB Resmi</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Armada / Unit</th>
                              <th className="py-2.5 px-3 min-w-[220px]">Rincian Item Barang</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">No. FPB / PO</th>
                              <th className="py-2.5 px-3 whitespace-nowrap">Status TTD Digital Armada</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredTtbOptions.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                                  {ttbSearchTerm ? (
                                    <div className="space-y-1.5">
                                      <p>
                                        Tidak ditemukan data TTB sesuai kata kunci &quot;<strong className="text-foreground">{ttbSearchTerm}</strong>&quot; di rentang {ttbDateRange} ({dateRangeBounds.label}).
                                      </p>
                                      {searchMatchesInGrandCatalog > 0 ? (
                                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                                          💡 Ditemukan <strong>{searchMatchesInGrandCatalog}</strong> data TTB yang cocok di arsip tanggal lainnya.{' '}
                                          <button
                                            type="button"
                                            onClick={() => setTtbDateRange('ALL')}
                                            className="text-indigo-600 dark:text-indigo-400 font-bold underline ml-1 cursor-pointer"
                                          >
                                            Buka Rentang ke Semua Data
                                          </button>
                                        </p>
                                      ) : null}
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTtbSearchTerm('');
                                            setTtbStatusFilter('ALL');
                                          }}
                                          className="text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer"
                                        >
                                          Reset Pencarian
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <p>
                                        Tidak ada berkas TTB pada rentang <strong>{ttbDateRange}</strong> ({dateRangeBounds.label}).
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTtbDateRange('ALL');
                                          setTtbStatusFilter('ALL');
                                        }}
                                        className="text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer"
                                      >
                                        Tampilkan Semua Arsip ({ttbStats.grandTotal} TTB)
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ) : (
                              filteredTtbOptions.map((opt) => (
                                <tr
                                  key={opt.key}
                                  onClick={() => {
                                    setSelectedTtbRef(opt);
                                    setIsSearchingTtb(false);
                                  }}
                                  className="hover:bg-indigo-500/5 transition cursor-pointer group"
                                >
                                  {/* Tgl Terbit TTB */}
                                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                                    {opt.tglTtbFormatted ? (
                                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                                        <Calendar className="size-3 text-indigo-500 shrink-0" />
                                        <span>{opt.tglTtbFormatted}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/50 italic text-[10px]">
                                        Belum Ada Tgl
                                      </span>
                                    )}
                                  </td>

                                  {/* Nomor TTB Resmi */}
                                  <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    <div className="flex items-center gap-1.5">
                                      <span>{opt.noTtb}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(opt.noTtb);
                                          if (showToast) showToast('No. TTB disalin!', 'info');
                                        }}
                                        className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 transition"
                                        title="Salin No TTB"
                                      >
                                        <Copy className="size-3" />
                                      </button>
                                    </div>
                                  </td>

                                  {/* Armada / Unit */}
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                                      <Ship className="size-2.5 shrink-0" />
                                      <span className="truncate max-w-[150px]">{opt.armada}</span>
                                    </span>
                                  </td>

                                  {/* Rincian Item Barang */}
                                  <td className="py-2.5 px-3">
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug" title={opt.itemSummary}>
                                      {opt.itemSummary}
                                    </p>
                                  </td>

                                  {/* No. FPB / PO */}
                                  <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                                    {opt.noFpb && <div>FPB: {opt.noFpb}</div>}
                                    {opt.noPo && <div className="text-foreground/80">PO: {opt.noPo}</div>}
                                    {!opt.noFpb && !opt.noPo && <span>-</span>}
                                  </td>

                                  {/* Status TTD Digital Armada / Penerima Akhir */}
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    {opt.isRecipientSigned ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                          <CheckCircle2 className="size-3 shrink-0" />
                                          <span>Sudah Ditandatangani</span>
                                        </span>
                                        {opt.recipientName && (
                                          <span className="block text-[9.5px] text-muted-foreground font-mono truncate max-w-[160px]">
                                            Oleh: {opt.recipientName}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                          <Clock className="size-3 shrink-0" />
                                          <span>Belum Ditandatangani</span>
                                        </span>
                                        <span className="block text-[9.5px] text-amber-600/75 dark:text-amber-400/75 font-mono">
                                          Menunggu TTD Crew
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Aksi */}
                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTtbRef(opt);
                                        setIsSearchingTtb(false);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                                    >
                                      <span>Pilih TTB</span>
                                      <ChevronRight className="size-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Summary */}
                      <div className="px-3.5 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>
                          Menampilkan <strong className="text-foreground font-mono">{filteredTtbOptions.length}</strong> dari{' '}
                          <strong className="text-foreground font-mono">{dateFilteredCatalog.length}</strong> data TTB
                          {ttbDateRange !== 'ALL' && (
                            <span className="text-muted-foreground/80 font-mono">
                              {' '}(Rentang {ttbDateRange}: {dateRangeBounds.label} • dari total {ttbStats.grandTotal} TTB di arsip)
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-mono">
                          Klik baris atau tombol &quot;Pilih TTB&quot; untuk memilih referensi serah terima
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-xl border border-border animate-in fade-in">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Nomor TTB Manual *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualNoTtb}
                    onChange={(e) => setManualNoTtb(e.target.value)}
                    placeholder="Contoh: CPL-TTB 04975"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-indigo-500"
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
                    placeholder="Contoh: SPOB SEA LION"
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
              </div>
            )}
          </div>

          {/* STEP 2: DATA SERAH TERIMA & END USER */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="size-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                2
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Informasi Petugas Pengantar &amp; Penerima End User
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Identitas petugas lapangan yang mengantar dan personel end-user penerima barang
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Truck className="size-3.5 text-cyan-500" />
                  <span>Petugas Pengantar (Tim Lapangan) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={petugasNama}
                  onChange={(e) => setPetugasNama(e.target.value)}
                  placeholder="Nama petugas logistik lapangan"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Kolom Penerima Barang (End User) - Otomatis Dropdown Kru & Manual */}
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5 text-emerald-500" />
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
                      className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      {isManualPenerima ? `← Pilih dari Kru (${matchedCrewList.length})` : 'Ketik Manual'}
                    </button>
                  )}
                </label>

                {matchedCrewList.length > 0 && !isManualPenerima ? (
                  <div className="space-y-1.5">
                    <select
                      value={selectedCrewId}
                      onChange={(e) => handleSelectCrew(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-emerald-500 font-medium text-foreground cursor-pointer"
                    >
                      <option value="" disabled>-- Pilih Kru Penerima ({matchedCrewList.length} Personel) --</option>
                      {matchedCrewList.map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {crew.jabatan} - {crew.namaPersonel} {crew.noHp && crew.noHp !== '-' ? `(WA: ${crew.noHp})` : ''}
                        </option>
                      ))}
                      <option value="MANUAL">✏️ Input Manual (Nama di Luar Daftar Kru)</option>
                    </select>

                    <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
                      <span className="flex items-center gap-1 truncate">
                        <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                        <span>Kru Terverifikasi: <strong>{matchedShipName || currentArmada}</strong></span>
                      </span>
                      <span className="text-muted-foreground font-mono text-[9px] shrink-0">
                        {matchedCrewList.find((c) => c.id === selectedCrewId)?.departemen || 'Deck/Engine'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      value={penerimaNama}
                      onChange={(e) => setPenerimaNama(e.target.value)}
                      placeholder={matchedCrewList.length > 0 ? "Ketik nama penerima..." : "Contoh: Mualim 1 Budi / Chief Eng. Anton"}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-emerald-500"
                    />
                    {matchedCrewList.length === 0 && currentArmada && currentArmada !== '-' && (
                      <p className="text-[10px] text-muted-foreground italic">
                        Tidak ada kru di modul Crew &amp; Armada untuk {currentArmada} (ketik manual).
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Kolom No. Telp / WA Penerima - Otomatis terisi & dapat diedit */}
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-indigo-500" />
                    <span>No. Telp / WA Penerima</span>
                  </span>
                  {kontakPenerima && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <Sparkles className="size-2.5" />
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
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  {kontakPenerima && (
                    <button
                      type="button"
                      onClick={() => setKontakPenerima('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      title="Hapus no telp"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                {matchedShipPhone && kontakPenerima !== matchedShipPhone && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <span>No. Telp Kapal:</span>
                    <button
                      type="button"
                      onClick={() => setKontakPenerima(matchedShipPhone)}
                      className="text-indigo-600 dark:text-indigo-400 font-mono underline cursor-pointer"
                      title="Gunakan no telp kapal ini"
                    >
                      {matchedShipPhone}
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Clock className="size-3.5 text-amber-500" />
                  <span>Waktu Serah Terima Barang *</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={waktuSerahTerima}
                  onChange={(e) => setWaktuSerahTerima(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            {/* EVIDENCE DIGITAL SIGNATURE PENERIMA AKHIR (Received By : User) */}
            <div className="pt-2">
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 via-background to-blue-50/30 dark:from-indigo-950/20 dark:via-background dark:to-blue-950/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <FileSignature className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>Bukti Tanda Terima (Digital Signature Penerima Akhir)</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Auto-Stamp TTB
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Tanda tangan digital penerima barang akan otomatis dibubuhkan ke dokumen PDF TTB resmi pada kolom <strong className="text-foreground">"Received By : User"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
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
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 transition cursor-pointer"
                      title="Upload file gambar tanda tangan (PNG/JPG)"
                    >
                      <Upload className="size-3" />
                      <span>Upload TTD</span>
                    </button>
                    {(hasDrawnSig || sigDataUrl) && (
                      <button
                        type="button"
                        onClick={clearSig}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1 transition cursor-pointer"
                        title="Hapus tanda tangan"
                      >
                        <RotateCcw className="size-3" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Canvas Signature Pad */}
                <div className="relative border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-inner">
                  <canvas
                    ref={sigCanvasRef}
                    width={500}
                    height={150}
                    onMouseDown={startDrawingSig}
                    onMouseMove={drawSig}
                    onMouseUp={stopDrawingSig}
                    onMouseLeave={stopDrawingSig}
                    onTouchStart={startDrawingSig}
                    onTouchMove={drawSig}
                    onTouchEnd={stopDrawingSig}
                    className="w-full h-32 sm:h-36 block touch-none cursor-crosshair bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px]"
                  />
                  {!hasDrawnSig && !sigDataUrl && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 p-4 select-none">
                      <PenTool className="size-5 stroke-[1.5]" />
                      <p className="text-xs font-medium text-center">
                        Tanda tangani di sini menggunakan mouse, stylus, atau sentuhan layar ponsel/tablet
                      </p>
                      <p className="text-[10px] text-muted-foreground/50">
                        Penerima: {penerimaNama ? <strong>{penerimaNama}</strong> : 'Nama penerima di atas'}
                      </p>
                    </div>
                  )}

                  {/* Garis tanda tangan bawah */}
                  <div className="absolute bottom-5 left-8 right-8 border-b border-indigo-200 dark:border-indigo-900/50 pointer-events-none flex justify-between text-[9px] text-muted-foreground/50 pt-0.5 select-none">
                    <span>X</span>
                    <span>Tanda Tangan Penerima Barang</span>
                  </div>
                </div>

                {/* Footer preview info */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground px-1 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="size-1.5 rounded-full bg-indigo-500" />
                    <span>
                      Penerima: <strong className="text-foreground">{penerimaNama || '(Belum diisi)'}</strong>
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>
                      Tanggal: <strong className="text-foreground">{waktuSerahTerima ? waktuSerahTerima.split('T')[0] : 'Hari ini'}</strong>
                    </span>
                  </div>
                  {(hasDrawnSig || sigDataUrl) && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="size-3" />
                      Tanda tangan siap distempel ke TTB
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Kondisi Serah Terima */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-foreground block">
                Kondisi &amp; Status Penyerahan Barang *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setKondisi('LENGKAP_BAIK')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    kondisi === 'LENGKAP_BAIK'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Diterima Lengkap &amp; Baik</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      Jumlah dan spesifikasi barang sesuai TTB tanpa kekurangan.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKondisi('PARSIAL')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    kondisi === 'PARSIAL'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Diterima Sebagian (Parsial)</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      Sebagian barang diserahkan, sisanya menyusul.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKondisi('CATATAN_KONDISI')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                    kondisi === 'CATATAN_KONDISI'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <AlertOctagon className="size-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Catatan / Kerusakan Fisik</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      Ada catatan kondisi kemasan, segel, atau perbedaan fisik.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Catatan Lapangan */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Catatan Pengantaran &amp; Lokasi Serah Terima (Opsional)
              </label>
              <textarea
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Barang diserahkan langsung di Dermaga Somber, disaksikan oleh perwira jaga. Kondisi palka bersih dan aman."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* STEP 3: UNGGAH BUKTI FOTO PENYERAHAN BARANG */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  3
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Unggah Bukti Foto Penyerahan Barang</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      Cloudflare R2
                    </span>
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Foto fisik barang di kapal/lokasi, TTB bertanda tangan basah, atau foto penyerahan bersama penerima
                  </p>
                </div>
              </div>

              {queuedPhotos.length > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-4 rounded-xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center gap-3 transition cursor-pointer group"
              >
                <div className="size-10 rounded-full bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition">
                  <Camera className="size-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                    Buka Kamera Langsung (HP/Tablet)
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ambil foto langsung di lokasi dermaga / kapal
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-3 transition cursor-pointer group"
              >
                <div className="size-10 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition">
                  <Images className="size-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Pilih Foto dari Galeri / Berkas
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Unggah beberapa foto sekaligus dari galeri perangkat
                  </div>
                </div>
              </button>
            </div>

            {/* Photo Queue Preview Grid */}
            {queuedPhotos.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Pratinjau Foto Bukti Serah Terima ({queuedPhotos.length}):</span>
                  <button
                    type="button"
                    onClick={() => setQueuedPhotos([])}
                    className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                  >
                    Hapus Semua
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {queuedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="group relative rounded-xl overflow-hidden border border-border bg-muted/40 aspect-square flex flex-col justify-end"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={`Bukti ${idx + 1}`}
                        className="absolute inset-0 size-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-90" />

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-md cursor-pointer"
                        title="Hapus foto ini"
                      >
                        <X className="size-3" />
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
                        className="absolute top-1.5 left-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 shadow-md cursor-pointer"
                        title="Perbesar"
                      >
                        <Maximize2 className="size-3" />
                      </button>

                      {/* Info Label */}
                      <div className="relative z-10 p-2 text-white">
                        <div className="text-[11px] font-bold">Foto #{idx + 1}</div>
                        <div className="text-[9px] text-slate-300 font-mono">
                          {photo.sizeFormatted}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nomenclature preview */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span>Format nama file otomatis Cloudflare R2: </span>
                    <strong className="font-mono text-foreground font-semibold">
                      {previewSampleFilename}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                Belum ada foto yang dipilih. Silakan ambil foto kamera langsung atau pilih dari galeri.
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON BAR */}
          <div className="sticky bottom-4 z-20 bg-background/95 backdrop-blur-md border border-border p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {uploadProgressMsg ? (
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-2">
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>{uploadProgressMsg}</span>
                </span>
              ) : (
                <span>
                  Pastikan data TTB referensi dan nama penerima telah terisi dengan benar.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClearForm}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer flex-1 sm:flex-initial"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-lg shadow-teal-500/25 transition flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Menyimpan ke R2...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="size-4" />
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
                            onClick={() => handleDeleteRecord(rec)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus rekaman serah terima ini"
                          >
                            <Trash2 className="size-3.5" />
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

