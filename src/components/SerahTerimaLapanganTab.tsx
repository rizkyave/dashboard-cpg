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
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import {
  SerahTerimaItem,
  SerahTerimaResponse,
  SerahTerimaPhoto,
  KondisiSerahTerima,
} from '@/types/serahTerima';
import { useAuth } from '@/context/AuthContext';
import TtbMediaModal from './TtbMediaModal';

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
}

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

  // 1. Build TTB Reference Catalog from Sisa Layanan, Procurement, and Armada Data
  const ttbReferenceCatalog = useMemo(() => {
    const map = new Map<string, TtbReferenceOption>();

    // Dari Sisa Layanan
    sisaLayananItems.forEach((item) => {
      const rawTtb = (item.noTtb || '').trim();
      if (!rawTtb || rawTtb === '-' || rawTtb.toLowerCase() === 'null') return;
      const cleanKey = rawTtb.toUpperCase().replace(/\s+/g, ' ');

      if (!map.has(cleanKey)) {
        map.set(cleanKey, {
          key: cleanKey,
          noTtb: rawTtb,
          cleanNoTtb: cleanKey,
          armada: (item.departement || '').trim() || '-',
          noFpb: item.noFpb || undefined,
          noPo: item.noPo || undefined,
          vendor: undefined,
          itemSummary: item.namaBarang ? `${item.namaBarang} (${item.jmlTtb || item.jmlPo || 1} ${item.satuan || ''})` : 'Barang Sisa Layanan',
          itemsCount: 1,
        });
      } else {
        const existing = map.get(cleanKey)!;
        if (item.namaBarang && !existing.itemSummary.includes(item.namaBarang)) {
          existing.itemSummary += `, ${item.namaBarang}`;
          existing.itemsCount += 1;
        }
      }
    });

    // Dari Procurement
    procurementItems.forEach((item) => {
      const rawTtb = (item.noTtb || '').trim();
      if (!rawTtb || rawTtb === '-' || rawTtb.toLowerCase() === 'null') return;
      const cleanKey = rawTtb.toUpperCase().replace(/\s+/g, ' ');

      if (!map.has(cleanKey)) {
        map.set(cleanKey, {
          key: cleanKey,
          noTtb: rawTtb,
          cleanNoTtb: cleanKey,
          armada: (item.deptArmada || '').trim() || '-',
          noFpb: item.fpb || undefined,
          noPo: item.po || undefined,
          vendor: undefined,
          itemSummary: item.item ? `${item.item} (${item.qtyTTB || item.qtyPO || 1} ${item.satuan || ''})` : 'Barang Pengadaan',
          itemsCount: 1,
        });
      } else {
        const existing = map.get(cleanKey)!;
        if (item.item && !existing.itemSummary.includes(item.item)) {
          existing.itemSummary += `, ${item.item}`;
          existing.itemsCount += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [sisaLayananItems, procurementItems]);

  // Autocomplete matching results
  const filteredTtbOptions = useMemo(() => {
    if (!ttbSearchTerm.trim()) {
      return ttbReferenceCatalog.slice(0, 8); // Top 8 suggestions default
    }
    const q = ttbSearchTerm.toLowerCase();
    return ttbReferenceCatalog
      .filter(
        (opt) =>
          opt.noTtb.toLowerCase().includes(q) ||
          opt.armada.toLowerCase().includes(q) ||
          (opt.noFpb && opt.noFpb.toLowerCase().includes(q)) ||
          (opt.noPo && opt.noPo.toLowerCase().includes(q)) ||
          opt.itemSummary.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [ttbReferenceCatalog, ttbSearchTerm]);

  // Fetch riwayat serah terima dari API
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/serah-terima');
      const data: SerahTerimaResponse = await res.json();
      if (data.records) {
        setHistoryRecords(data.records);
      }
      if (typeof data.isR2Active === 'boolean') {
        setIsR2Active(data.isR2Active);
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat serah terima:', err);
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
    setCatatan('');
    setKondisi('LENGKAP_BAIK');
    setUploadProgressMsg('');
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
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

              <button
                type="button"
                onClick={() => {
                  setIsManualTtb(!isManualTtb);
                  setSelectedTtbRef(null);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer self-start sm:self-auto"
              >
                {isManualTtb ? '← Pilih dari Database TTB' : '+ Input Nomor TTB Manual'}
              </button>
            </div>

            {/* Mode 1: Search & Autocomplete from Preloaded TTB database */}
            {!isManualTtb ? (
              <div className="space-y-3">
                {!selectedTtbRef ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={ttbSearchTerm}
                        onChange={(e) => {
                          setTtbSearchTerm(e.target.value);
                          setIsSearchingTtb(true);
                        }}
                        onFocus={() => setIsSearchingTtb(true)}
                        placeholder="Ketik No. TTB (contoh: 04975), nama armada (contoh: SEA LION), atau No. FPB..."
                        className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      {ttbSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setTtbSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Suggestions list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1 border border-border rounded-xl bg-muted/20">
                      {filteredTtbOptions.length > 0 ? (
                        filteredTtbOptions.map((opt) => (
                          <div
                            key={opt.key}
                            onClick={() => {
                              setSelectedTtbRef(opt);
                              setIsSearchingTtb(false);
                            }}
                            className="p-3 rounded-xl border border-border hover:border-indigo-500/50 bg-card hover:bg-indigo-500/5 cursor-pointer transition flex flex-col justify-between gap-2 text-xs group"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-mono font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                {opt.noTtb}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                                {opt.armada}
                              </span>
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                              {opt.itemSummary}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/50">
                              <span>FPB: {opt.noFpb || '-'}</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition">
                                Pilih →
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
                          Tidak ditemukan data TTB sesuai kata kunci. Anda dapat klik{' '}
                          <button
                            type="button"
                            onClick={() => setIsManualTtb(true)}
                            className="text-indigo-600 dark:text-indigo-400 font-bold underline"
                          >
                            Input Nomor TTB Manual
                          </button>
                        </div>
                      )}
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

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <User className="size-3.5 text-emerald-500" />
                  <span>Penerima Barang (End User) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={penerimaNama}
                  onChange={(e) => setPenerimaNama(e.target.value)}
                  placeholder="Contoh: Mualim 1 Budi / Chief Eng. Anton"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Phone className="size-3.5 text-indigo-500" />
                  <span>No. Telp / WA Penerima (Opsional)</span>
                </label>
                <input
                  type="tel"
                  value={kontakPenerima}
                  onChange={(e) => setKontakPenerima(e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-indigo-500"
                />
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
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Cari riwayat serah terima (No. TTB, Armada, Penerima, Petugas)..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-cyan-500"
              />
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

