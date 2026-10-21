'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  UserCheck,
  Building2,
  Clock,
  CheckCircle2,
  ArrowUp,
  FileCheck,
  Ship,
  Truck,
  Copy,
  Layers,
  Info,
  SlidersHorizontal,
  Package,
  Boxes,
  Receipt,
  Plus,
  Pencil,
  Settings2,
  X,
  Check,
  AlertCircle,
  Save,
  Link2,
  Code2,
  ArrowUpDown,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ProcurementItem } from '@/types/procurement';

interface MonitoringInternalTabProps {
  items: ProcurementItem[];
  onSyncSuccess?: (items: ProcurementItem[]) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8qGsGYX_xCNsqZvME-uZvaAeECsE69PBYlY32fZk/edit?pli=1&gid=0#gid=0';

// Daftar staf PIC Purchasing CPG
const PIC_OPTIONS = ['ALL', 'NOVI', 'TRI', 'ELSA', 'YATI', 'PUTRI', 'LUTFI'];

// Opsi Delivery Time standar
const DELIVERY_TIME_OPTIONS = [
  '1 HARI',
  '1-2 HARI',
  '1-3 HARI',
  '1 MINGGU',
  '2 MINGGU',
  '2-3 MINGGU',
];

const INITIAL_FORM_DATA: Partial<ProcurementItem> = {
  entity: 'CPL',
  deptArmada: '',
  fpb: '',
  po: '',
  noPo: '',
  tglPo: '',
  deliveryTime: '1 MINGGU',
  noFstb: '',
  tglInputFstb: '',
  tglKePicTtb: '',
  waktuKePicTtb: '',
  ketPch: '',
  keterangan: '',
  picPch: 'NOVI',
  picTtb: '',
  noTtb: '',
  tglInputTtb: '',
  tglKeTimLapangan: '',
  picLap: '',
  tglBarangDiantar: '',
  ketLap: '',
  tglTimLapKePicTtb: '',
  tglTtbKePicPch: '',
  tglKeAdmPch: '',
  picAdm: '',
  noSpp: '',
  tglInputSpp: '',
  tglKeKeuangan: '',
  statusBadge: 'DALAM PROSES',
  statusTone: 'amber',
};

export default function MonitoringInternalTab({
  items,
  onSyncSuccess,
  showToast,
}: MonitoringInternalTabProps) {
  // State lokal untuk data berkas internal (optimistic update)
  const [localItems, setLocalItems] = useState<ProcurementItem[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Mode Tampilan Kolom (Lengkap atau per Seksi)
  const [columnSection, setColumnSection] = useState<'ALL' | 'PCH' | 'LOG' | 'ADM'>('ALL');

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedPicPch, setSelectedPicPch] = useState<string>('ALL');
  const [selectedPicTtb, setSelectedPicTtb] = useState<string>('ALL');
  const [selectedPicLap, setSelectedPicLap] = useState<string>('ALL');
  const [selectedDelivery, setSelectedDelivery] = useState<string>('ALL');
  const [selectedTtbStatus, setSelectedTtbStatus] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL');
  const [onlySpecialNotes, setOnlySpecialNotes] = useState<boolean>(false);

  // Sorting state untuk kolom interaktif
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [formData, setFormData] = useState<Partial<ProcurementItem>>(INITIAL_FORM_DATA);
  const [modalActiveTab, setModalActiveTab] = useState<'PCH' | 'LOG' | 'ADM'>('PCH');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isWebhookConfigured, setIsWebhookConfigured] = useState<boolean>(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<{ checked: boolean; active: boolean; message: string } | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Load konfigurasi Webhook saat komponen dibuka
  useEffect(() => {
    const fetchWebhookConfig = async () => {
      try {
        const res = await fetch('/api/monitoring-internal');
        const json = await res.json();
        if (json.success) {
          setWebhookUrl(json.webhookUrl || '');
          setIsWebhookConfigured(json.isConfigured || false);
        }
      } catch {}
    };
    fetchWebhookConfig();
  }, []);

  // Helper format tanggal DD-MM-YYYY
  const formatTgl = (tgl?: string) => {
    if (!tgl || tgl === '-') return '-';
    if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
      const parts = tgl.slice(0, 10).split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return tgl;
  };

  // Helper format waktu
  const formatWaktu = (waktu?: string) => {
    if (!waktu || waktu === '-') return '-';
    const num = parseFloat(waktu);
    if (!isNaN(num) && num >= 0 && num < 1 && waktu.includes('.')) {
      const totalSeconds = Math.round(num * 86400);
      const hours24 = Math.floor(totalSeconds / 3600) % 24;
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
    }
    return waktu;
  };

  // Helper hitung selisih hari antar 2 tanggal
  const calculateLapseDays = (tglStart?: string, tglEnd?: string): string => {
    if (!tglStart || !tglEnd || tglStart === '-' || tglEnd === '-') return '-';
    try {
      const d1 = new Date(tglStart.slice(0, 10));
      const d2 = new Date(tglEnd.slice(0, 10));
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} HARI`;
    } catch {
      return '-';
    }
  };

  // Helper styling & tooltip Lapse Day SLA
  const getLapseBadge = (lapseStr?: string, tglStart?: string, tglEnd?: string) => {
    if (!lapseStr || lapseStr === '-' || lapseStr.includes('-46209')) {
      return <span className="text-muted-foreground/60 italic text-xs">-</span>;
    }
    const match = lapseStr.match(/(-?\d+)/);
    const days = match ? parseInt(match[1], 10) : 0;

    let colorClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
    let label = 'Tepat Waktu';

    if (days < 0) {
      colorClass = 'bg-muted text-muted-foreground border-border';
      label = 'Sebelum Jadwal';
    } else if (days === 0 || days === 1) {
      colorClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
      label = 'Sangat Cepat';
    } else if (days <= 3) {
      colorClass = 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25';
      label = 'Normal';
    } else {
      colorClass = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold';
      label = 'Terlambat SLA';
    }

    const tooltipText =
      tglStart && tglEnd && tglStart !== '-' && tglEnd !== '-'
        ? `Input: ${formatTgl(tglStart)} ➔ Selesai: ${formatTgl(tglEnd)} (${days} hari)`
        : `${days} hari selisih alur`;

    return (
      <div className="relative group/lapse inline-block" title={tooltipText}>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${colorClass} cursor-help transition hover:scale-105`}
        >
          {days > 3 && <AlertCircle className="size-2.5 text-rose-600 dark:text-rose-400 shrink-0" />}
          {lapseStr}
        </span>
      </div>
    );
  };

  // Helper Copy to Clipboard
  const handleCopy = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast?.(`${label} ${text} disalin ke clipboard!`, 'info');
  };

  // 1. Sinkronisasi Live dengan Google Sheets
  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: GOOGLE_SHEET_URL }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.procurement)) {
        setLocalItems(json.procurement);
        onSyncSuccess?.(json.procurement);
        showToast?.(
          json.message ||
            `Berhasil menyinkronkan ${json.procurement.length.toLocaleString('id-ID')} berkas dari Google Sheets!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal menyinkronkan Google Sheets.', 'warning');
      }
    } catch (err: any) {
      console.error('Error syncing Google Sheets:', err);
      showToast?.('Gagal menghubungi server untuk sinkronisasi Google Sheets.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper untuk styling badge PIC PCH
  const getPicPchBadge = (pic?: string) => {
    const p = (pic || '').toUpperCase().trim();
    if (!p || p === '-') return <span className="text-muted-foreground">-</span>;

    let colorClass = 'bg-primary/10 text-primary border-primary/20';
    if (p.includes('NOVI')) colorClass = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
    else if (p.includes('TRI')) colorClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    else if (p.includes('ELSA')) colorClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    else if (p.includes('YATI')) colorClass = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
    else if (p.includes('PUTRI')) colorClass = 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
    else if (p.includes('LUTFI')) colorClass = 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${colorClass}`}>
        {p}
      </span>
    );
  };

  // Helper styling badge PT / Entitas
  const getEntityBadge = (entity?: string) => {
    const ent = (entity || 'CPL').toUpperCase().trim();
    let bg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (ent === 'MO') bg = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    if (ent === 'GAJ') bg = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    if (ent === 'HL') bg = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    if (ent === 'SP') bg = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${bg}`}>
        {ent}
      </span>
    );
  };

  // Toggle sorting helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 2. Filter & Sort data
  const filteredData = useMemo(() => {
    let result = localItems.filter((item) => {
      // 1. Search Query (seluruh kolom)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpbMatch = (item.fpb || '').toLowerCase().includes(q);
        const poMatch = (item.po || item.noPo || '').toLowerCase().includes(q);
        const fstbMatch = (item.noFstb || '').toLowerCase().includes(q);
        const ttbMatch = (item.noTtb || '').toLowerCase().includes(q);
        const sppMatch = (item.noSpp || '').toLowerCase().includes(q);
        const armadaMatch = (item.deptArmada || '').toLowerCase().includes(q);
        const picPchMatch = (item.picPch || '').toLowerCase().includes(q);
        const picTtbMatch = (item.picTtb || '').toLowerCase().includes(q);
        const picLapMatch = (item.picLap || '').toLowerCase().includes(q);
        const ketMatch = (item.keterangan || item.ketPch || item.ketLap || item.peruntukan || '').toLowerCase().includes(q);

        if (!fpbMatch && !poMatch && !fstbMatch && !ttbMatch && !sppMatch && !armadaMatch && !picPchMatch && !picTtbMatch && !picLapMatch && !ketMatch) {
          return false;
        }
      }

      // 2. Entity Filter
      if (selectedEntity !== 'ALL') {
        const ent = (item.entity || '').toUpperCase();
        if (ent !== selectedEntity) return false;
      }

      // 3. PIC PCH Filter
      if (selectedPicPch !== 'ALL') {
        const pic = (item.picPch || '').toUpperCase();
        if (!pic.includes(selectedPicPch)) return false;
      }

      // 4. PIC TTB Filter
      if (selectedPicTtb !== 'ALL') {
        const pic = (item.picTtb || '').toUpperCase();
        if (!pic.includes(selectedPicTtb)) return false;
      }

      // 5. PIC Lapangan Filter
      if (selectedPicLap !== 'ALL') {
        const pic = (item.picLap || '').toUpperCase();
        if (!pic.includes(selectedPicLap)) return false;
      }

      // 6. Delivery Time Filter
      if (selectedDelivery !== 'ALL') {
        const dt = (item.deliveryTime || '').toUpperCase();
        if (!dt.includes(selectedDelivery)) return false;
      }

      // 7. Status Penyerahan TTB
      if (selectedTtbStatus === 'DONE') {
        if (!item.tglKePicTtb || item.tglKePicTtb === '-') return false;
      } else if (selectedTtbStatus === 'PENDING') {
        if (item.tglKePicTtb && item.tglKePicTtb !== '-') return false;
      }

      // 8. Only Special Notes (Bypass, Stock Gudang, dll)
      if (onlySpecialNotes) {
        const ket = (item.keterangan || item.ketPch || item.ketLap || item.peruntukan || '').trim();
        if (!ket || ket === '-') return false;
      }

      return true;
    });

    // Sorting Logic
    if (sortField) {
      result = [...result].sort((a: any, b: any) => {
        const valA = a[sortField] || '';
        const valB = b[sortField] || '';

        // Priority ranking for delivery time
        if (sortField === 'deliveryTime') {
          const getDeliveryRank = (val: string) => {
            const v = (val || '').toUpperCase();
            if (v.includes('1 HARI') && !v.includes('1-2') && !v.includes('1-3')) return 1;
            if (v.includes('1-2 HARI')) return 2;
            if (v.includes('1-3 HARI')) return 3;
            if (v.includes('1 MINGGU')) return 4;
            if (v.includes('2 MINGGU')) return 5;
            if (v.includes('2-3 MINGGU') || v.includes('3 MINGGU')) return 6;
            return 99;
          };
          const rankA = getDeliveryRank(valA);
          const rankB = getDeliveryRank(valB);
          return sortDirection === 'asc' ? rankA - rankB : rankB - rankA;
        }

        // Numeric sort for lapse days
        if (sortField === 'lapsePchToTtb') {
          const getDays = (str: string) => {
            const m = String(str || '').match(/(-?\d+)/);
            return m ? parseInt(m[1], 10) : -999;
          };
          const daysA = getDays(valA);
          const daysB = getDays(valB);
          return sortDirection === 'asc' ? daysA - daysB : daysB - daysA;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [
    localItems,
    searchQuery,
    selectedEntity,
    selectedPicPch,
    selectedPicTtb,
    selectedPicLap,
    selectedDelivery,
    selectedTtbStatus,
    onlySpecialNotes,
    sortField,
    sortDirection,
  ]);

  // 3. Ringkasan Metrik KPI
  const metrics = useMemo(() => {
    let totalDonePurchasing = 0;
    let fastDeliveryCount = 0;
    let doneTtbCount = 0;
    let pendingTtbCount = 0;
    let doneLapanganCount = 0;
    let doneSppCount = 0;
    let specialNotesCount = 0;

    localItems.forEach((it) => {
      const po = it.po || it.noPo || '';
      if (po && po !== '-') totalDonePurchasing++;

      const dt = (it.deliveryTime || '').toUpperCase();
      if (dt.includes('1 HARI') || dt.includes('1-2 HARI') || dt.includes('1-3 HARI')) {
        fastDeliveryCount++;
      }

      if (it.tglKePicTtb && it.tglKePicTtb !== '-') {
        doneTtbCount++;
      } else {
        pendingTtbCount++;
      }

      if (it.tglBarangDiantar && it.tglBarangDiantar !== '-') {
        doneLapanganCount++;
      }

      if (it.noSpp && it.noSpp !== '-') {
        doneSppCount++;
      }

      const ket = (it.keterangan || it.ketPch || it.ketLap || it.peruntukan || '').trim();
      if (ket && ket !== '-') specialNotesCount++;
    });

    return {
      total: localItems.length,
      totalDonePurchasing,
      fastDeliveryCount,
      doneTtbCount,
      pendingTtbCount,
      doneLapanganCount,
      doneSppCount,
      specialNotesCount,
    };
  }, [localItems]);

  // 4. Unique Lists untuk dropdown filter
  const uniquePicsTtb = useMemo(() => {
    const set = new Set<string>();
    localItems.forEach((it) => {
      const p = (it.picTtb || '').trim().toUpperCase();
      if (p && p !== '-' && p !== 'LOGISTIK') set.add(p);
    });
    return Array.from(set).sort();
  }, [localItems]);

  const uniquePicsLap = useMemo(() => {
    const set = new Set<string>();
    localItems.forEach((it) => {
      const p = (it.picLap || '').trim().toUpperCase();
      if (p && p !== '-') set.add(p);
    });
    return Array.from(set).sort();
  }, [localItems]);

  // 5. Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedEntity,
    selectedPicPch,
    selectedPicTtb,
    selectedPicLap,
    selectedDelivery,
    selectedTtbStatus,
    onlySpecialNotes,
    pageSize,
  ]);

  // ========================================================
  // 6. Action Handlers: Tambah Berkas, Edit, Auto-Save
  // ========================================================

  // Handler update cepat langsung dari cell (Inline Auto-Save)
  const handleQuickUpdate = async (item: ProcurementItem, updates: Partial<ProcurementItem>) => {
    const updatedItem: ProcurementItem = {
      ...item,
      ...updates,
    };

    // 1. Optimistic Update Local State
    setLocalItems((prev) => {
      const next = prev.map((it) => {
        const itFpb = String(it.fpb || '').trim().toUpperCase();
        const curFpb = String(item.fpb || '').trim().toUpperCase();
        const itPo = String(it.po || it.noPo || '').trim().toUpperCase();
        const curPo = String(item.po || item.noPo || '').trim().toUpperCase();

        if ((curFpb && itFpb === curFpb) || (curPo && curPo !== '-' && itPo === curPo)) {
          return { ...it, ...updates };
        }
        return it;
      });
      onSyncSuccess?.(next);
      return next;
    });

    // 2. Kirim update ke Server & Auto-Save Google Sheets
    try {
      const res = await fetch('/api/monitoring-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_row',
          data: updatedItem,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.(
          json.googleSync
            ? `✓ Data ${item.fpb || item.po} diperbarui & AUTO-SAVE ke Google Sheet!`
            : `✓ Data ${item.fpb || item.po} diperbarui di database.`,
          json.googleSync ? 'success' : 'info'
        );
      } else {
        showToast?.(json.message || 'Gagal menyimpan perubahan.', 'warning');
      }
    } catch (err: any) {
      showToast?.(`Gagal auto-save: ${err.message}`, 'error');
    }
  };

  // 1-Klik Serah Terima ke PIC TTB (Staf Purchasing)
  const handleMarkDoneTtb = async (item: ProcurementItem) => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const timeStr = `${hours12}:${minutes}:${seconds} ${ampm}`;

    // Hitung lapse jika ada tglInputFstb
    const calculatedLapse = item.tglInputFstb ? calculateLapseDays(item.tglInputFstb, today) : '0 HARI';

    const updates: Partial<ProcurementItem> = {
      tglKePicTtb: today,
      waktuKePicTtb: timeStr,
      lapsePchToTtb: calculatedLapse,
      statusBadge: 'PROSES TTB',
      statusTone: 'cyan',
      picAktif: item.picTtb && item.picTtb !== '-' ? item.picTtb : 'Logistik (TTB)',
    };

    await handleQuickUpdate(item, updates);
  };

  const handleOpenAddModal = () => {
    setFormData({
      ...INITIAL_FORM_DATA,
      tglPo: new Date().toISOString().slice(0, 10),
    });
    setEditingItem(null);
    setModalActiveTab('PCH');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: ProcurementItem) => {
    setEditingItem(item);
    setFormData({
      entity: item.entity || 'CPL',
      deptArmada: item.deptArmada || '',
      fpb: item.fpb || '',
      po: item.po || item.noPo || '',
      noPo: item.noPo || item.po || '',
      tglPo: item.tglPo || '',
      deliveryTime: item.deliveryTime || '1 MINGGU',
      noFstb: item.noFstb || '',
      tglInputFstb: item.tglInputFstb || '',
      tglKePicTtb: item.tglKePicTtb || '',
      waktuKePicTtb: item.waktuKePicTtb || '',
      ketPch: item.ketPch || item.keterangan || '',
      keterangan: item.keterangan || item.ketPch || '',
      picPch: item.picPch || 'NOVI',
      picTtb: item.picTtb || '',
      noTtb: item.noTtb || '',
      tglInputTtb: item.tglInputTtb || '',
      tglKeTimLapangan: item.tglKeTimLapangan || '',
      picLap: item.picLap || '',
      tglBarangDiantar: item.tglBarangDiantar || '',
      ketLap: item.ketLap || '',
      tglTimLapKePicTtb: item.tglTimLapKePicTtb || '',
      tglTtbKePicPch: item.tglTtbKePicPch || '',
      tglKeAdmPch: item.tglKeAdmPch || '',
      picAdm: item.picAdm || '',
      noSpp: item.noSpp || '',
      tglInputSpp: item.tglInputSpp || '',
      tglKeKeuangan: item.tglKeKeuangan || '',
      statusBadge: item.statusBadge || 'DALAM PROSES',
      statusTone: item.statusTone || 'amber',
    });
    setModalActiveTab('PCH');
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fpb && !formData.po) {
      showToast?.('Nomor FPB atau Nomor PO wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    const isNew = !editingItem;

    try {
      const res = await fetch('/api/monitoring-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isNew ? 'create_row' : 'update_row',
          data: formData,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setLocalItems((prev) => {
          let updated: ProcurementItem[];
          if (isNew) {
            const newItem: ProcurementItem = json.item || {
              id: `fpb-${Date.now()}`,
              fpb: formData.fpb || '-',
              entity: formData.entity || 'CPL',
              po: formData.po || formData.noPo || '-',
              noPo: formData.noPo || formData.po || '-',
              date: formData.tglPo || new Date().toISOString().slice(0, 10),
              item: formData.keterangan || '-',
              peruntukan: formData.deptArmada || '-',
              lapse: 0,
              statusBadge: formData.statusBadge || 'BARU DIBUAT',
              statusTone: formData.statusTone || 'amber',
              picPch: formData.picPch || '-',
              picTtb: formData.picTtb || '-',
              picLap: formData.picLap || '-',
              picAdm: formData.picAdm || '-',
              picAktif: formData.picPch || '-',
              statusPenjelasan: 'Baris baru ditambahkan',
              ...formData,
            };
            updated = [newItem, ...prev];
          } else {
            updated = prev.map((it) => {
              const itFpb = String(it.fpb || '').trim().toUpperCase();
              const curFpb = String(formData.fpb || '').trim().toUpperCase();
              const itPo = String(it.po || it.noPo || '').trim().toUpperCase();
              const curPo = String(formData.po || formData.noPo || '').trim().toUpperCase();

              if ((curFpb && itFpb === curFpb) || (curPo && curPo !== '-' && itPo === curPo)) {
                return { ...it, ...formData };
              }
              return it;
            });
          }
          onSyncSuccess?.(updated);
          return updated;
        });

        if (json.googleSync) {
          showToast?.(
            `✓ ${isNew ? 'Berkas baru berhasil ditambah' : 'Perubahan tersimpan'} & AUTO-SAVE ke Google Sheet berhasil!`,
            'success'
          );
        } else {
          showToast?.(
            json.message ||
              `Data tersimpan di sistem lokal. (Hubungkan Webhook untuk auto-save langsung ke Google Sheets)`,
            'info'
          );
        }

        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
      } else {
        showToast?.(json.message || 'Gagal menyimpan data ke server.', 'error');
      }
    } catch (err: any) {
      console.error('Error saving record:', err);
      showToast?.(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========================================================
  // 7. Webhook Configuration Handlers
  // ========================================================

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/monitoring-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_webhook_url',
          webhookUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsWebhookConfigured(!!webhookUrl.trim());
        showToast?.(json.message, 'success');
      } else {
        showToast?.(json.message || 'Gagal menyimpan webhook.', 'error');
      }
    } catch (err: any) {
      showToast?.(`Error: ${err.message}`, 'error');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      showToast?.('Silakan masukkan URL Webhook Apps Script terlebih dahulu.', 'warning');
      return;
    }
    setIsTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await fetch('/api/monitoring-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_webhook',
          webhookUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebhookStatus({ checked: true, active: true, message: json.message });
        showToast?.(json.message, 'success');
      } else {
        setWebhookStatus({ checked: true, active: false, message: json.message });
        showToast?.(json.message, 'warning');
      }
    } catch (err: any) {
      setWebhookStatus({ checked: true, active: false, message: err.message });
      showToast?.(`Gagal tes webhook: ${err.message}`, 'error');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyAppsScript = async () => {
    try {
      const res = await fetch('/api/monitoring-internal?script=true');
      const json = await res.json();
      if (json.success && json.script) {
        await navigator.clipboard.writeText(json.script);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 3500);
        showToast?.('Skrip Google Apps Script berhasil disalin ke clipboard!', 'success');
      } else {
        showToast?.('Gagal memuat skrip dari server.', 'error');
      }
    } catch {
      showToast?.('Gagal menyalin skrip.', 'error');
    }
  };

  // 8. Export to CSV (Seluruh 40 Kolom Spreadsheet)
  const handleExportCsv = () => {
    if (filteredData.length === 0) {
      showToast?.('Tidak ada data untuk diekspor', 'warning');
      return;
    }

    const headers = [
      'NO',
      'PIC PCH',
      'PT',
      'DEPT/ ARMADA',
      'NO. FPB',
      'NO. PO',
      'TANGGAL INPUT PO',
      'DELIVERY TIME',
      'NO. FSTB',
      'TANGGAL INPUT FSTB',
      'TANGGAL KE PIC TTB',
      'WAKTU KE PIC TTB',
      'KETERANGAN PURCHASING',
      'LAPSE PCH KE TTB',
      'PIC TTB',
      'NO. TTB',
      'TANGGAL INPUT TTB',
      'TANGGAL KE TIM LAPANGAN',
      'LAPSE TTB KE LAPANGAN',
      'PIC LAPANGAN',
      'TANGGAL BARANG DIANTAR',
      'KETERANGAN LOGISTIK',
      'TANGGAL TIM LAP KE PIC TTB',
      'LAPSE LAP KE TTB',
      'TANGGAL TTB KE PIC PCH',
      'LAPSE TTB KE PCH',
      'TANGGAL KE ADM PCH',
      'PIC ADM PCH',
      'NO. SPP',
      'TANGGAL INPUT SPP',
      'TANGGAL KE KEUANGAN',
      'STATUS ALUR DOKUMEN',
    ];

    const rows = filteredData.map((r, i) => {
      return [
        i + 1,
        `"${r.picPch || '-'}"`,
        `"${r.entity || '-'}"`,
        `"${r.deptArmada || '-'}"`,
        `"${r.fpb || '-'}"`,
        `"${r.po || r.noPo || '-'}"`,
        `"${formatTgl(r.tglPo)}"`,
        `"${r.deliveryTime || '-'}"`,
        `"${r.noFstb || '-'}"`,
        `"${formatTgl(r.tglInputFstb)}"`,
        `"${formatTgl(r.tglKePicTtb)}"`,
        `"${formatWaktu(r.waktuKePicTtb)}"`,
        `"${(r.ketPch || r.keterangan || r.peruntukan || '-').replace(/"/g, '""')}"`,
        `"${r.lapsePchToTtb || '-'}"`,
        `"${r.picTtb || '-'}"`,
        `"${r.noTtb || '-'}"`,
        `"${formatTgl(r.tglInputTtb)}"`,
        `"${formatTgl(r.tglKeTimLapangan)}"`,
        `"${r.lapseTtbToLap || '-'}"`,
        `"${r.picLap || '-'}"`,
        `"${formatTgl(r.tglBarangDiantar)}"`,
        `"${(r.ketLap || '-').replace(/"/g, '""')}"`,
        `"${formatTgl(r.tglTimLapKePicTtb)}"`,
        `"${r.lapseLapToTtb || '-'}"`,
        `"${formatTgl(r.tglTtbKePicPch)}"`,
        `"${r.lapseTtbToPch || '-'}"`,
        `"${formatTgl(r.tglKeAdmPch)}"`,
        `"${r.picAdm || '-'}"`,
        `"${r.noSpp || '-'}"`,
        `"${formatTgl(r.tglInputSpp)}"`,
        `"${formatTgl(r.tglKeKeuangan)}"`,
        `"${r.statusBadge || '-'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monitoring_Berkas_Internal_Lengkap_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast?.('Data berkas internal lengkap berhasil diekspor ke CSV!', 'success');
  };

  // Condition checks for visible column groups based on columnSection
  const showPurchasingCols = columnSection === 'ALL' || columnSection === 'PCH';
  const showLogistikCols = columnSection === 'ALL' || columnSection === 'LOG';
  const showAdmKeuCols = columnSection === 'ALL' || columnSection === 'ADM';

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ======================================================== */}
      {/* 1. Header Hub & Action Bar                                */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Monitoring Berkas Internal Procurement
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live 2-Way Sync (Input &amp; Auto-Save)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  <Sparkles className="size-3 text-amber-600 dark:text-amber-400" />
                  Kolom Purchasing Interaktif
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Input langsung, edit data, ubah SLA di tempat, dan 1-klik serah terima ke TTB dengan auto-save real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Tambah Berkas Baru */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
            title="Tambah Berkas Internal Baru"
          >
            <Plus className="size-4" />
            <span>Tambah Berkas</span>
          </button>

          {/* Tombol Pengaturan Webhook Google Sheets */}
          <button
            type="button"
            onClick={() => setIsWebhookModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer relative"
            title="Pengaturan Auto-Save Google Sheets"
          >
            <Settings2 className="size-3.5 text-muted-foreground" />
            <span>Auto-Save Sheet</span>
            {isWebhookConfigured ? (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" title="Webhook Aktif" />
            ) : (
              <span className="size-2 rounded-full bg-amber-500" title="Webhook Belum Dikonfigurasi" />
            )}
          </button>

          {/* Buka Google Sheet Asli */}
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs"
            title="Buka Spreadsheet Asli di Google Sheets"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Buka Sheet</span>
          </a>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor seluruh 40 kolom ke CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Sinkronkan Google Sheets */}
          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tarik data terbaru langsung dari Google Sheets"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Top Summary KPI Cards (Alur 4 Seksi)                    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Berkas */}
        <div
          onClick={() => {
            setSearchQuery('');
            setSelectedTtbStatus('ALL');
            setSelectedDelivery('ALL');
            setOnlySpecialNotes(false);
          }}
          className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Total Berkas</span>
            <FileCheck className="size-4 text-primary group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1.5">
            {metrics.total.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Database tersinkron</div>
        </div>

        {/* PO Terbit */}
        <div
          onClick={() => {
            setColumnSection('PCH');
          }}
          className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] hover:border-amber-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">PO Terbit (PCH)</span>
            <Receipt className="size-4 text-amber-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1.5">
            {metrics.totalDonePurchasing.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Done by Purchasing</div>
        </div>

        {/* Delivery Cepat (1-3 Hari) */}
        <div
          onClick={() => {
            setSelectedDelivery('1 HARI');
          }}
          className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] hover:border-rose-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400">SLA Mendesak</span>
            <Clock className="size-4 text-rose-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-rose-800 dark:text-rose-300 mt-1.5">
            {metrics.fastDeliveryCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Lead time 1-3 hari</div>
        </div>

        {/* Selesai TTB */}
        <div
          onClick={() => {
            setSelectedTtbStatus('DONE');
            setColumnSection('LOG');
          }}
          className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] hover:border-emerald-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Telah TTB</span>
            <Boxes className="size-4 text-emerald-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1.5">
            {metrics.doneTtbCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Ke PIC TTB</div>
        </div>

        {/* Diantar Lapangan */}
        <div
          onClick={() => {
            setColumnSection('LOG');
          }}
          className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] hover:border-cyan-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400">Barang Diantar</span>
            <Truck className="size-4 text-cyan-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-cyan-800 dark:text-cyan-300 mt-1.5">
            {metrics.doneLapanganCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-cyan-600/80 dark:text-cyan-400/80 mt-0.5">Done by Tim Lapangan</div>
        </div>

        {/* SPP Selesai */}
        <div
          onClick={() => {
            setColumnSection('ADM');
          }}
          className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] hover:border-purple-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">SPP Selesai</span>
            <CheckCircle2 className="size-4 text-purple-600 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-purple-800 dark:text-purple-300 mt-1.5">
            {metrics.doneSppCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5">Done by ADM &amp; Keu</div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Section Switcher & Search Bar                          */}
      {/* ======================================================== */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Section View Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-muted border border-border text-xs">
            <button
              type="button"
              onClick={() => setColumnSection('ALL')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                columnSection === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua Kolom (40 Kolom)
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('PCH')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                columnSection === 'PCH'
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="size-2 rounded-full bg-amber-500" />
              Purchasing
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('LOG')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                columnSection === 'LOG'
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              Logistik &amp; Lapangan
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('ADM')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                columnSection === 'ADM'
                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="size-2 rounded-full bg-purple-500" />
              ADM PCH &amp; Keuangan
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari No. FPB, PO, FSTB, TTB, SPP, Armada, PIC, atau Catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3.5" />
            <span>Filter Cepat:</span>
          </div>

          {/* Filter Entitas / PT */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">PT:</span>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">Semua PT</option>
              <option value="CPL">CPL</option>
              <option value="PPI">PPI</option>
              <option value="HL">HL</option>
              <option value="GAJ">GAJ</option>
              <option value="MIL">MIL</option>
              <option value="SP">SP</option>
              <option value="SSK">SSK</option>
              <option value="MO">MO</option>
            </select>
          </div>

          {/* Filter PIC Purchasing */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">PIC PCH:</span>
            <select
              value={selectedPicPch}
              onChange={(e) => setSelectedPicPch(e.target.value)}
              className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">Semua PIC PCH</option>
              {PIC_OPTIONS.filter((p) => p !== 'ALL').map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filter PIC TTB */}
          {uniquePicsTtb.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">PIC TTB:</span>
              <select
                value={selectedPicTtb}
                onChange={(e) => setSelectedPicTtb(e.target.value)}
                className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua TTB</option>
                {uniquePicsTtb.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter PIC Lapangan */}
          {uniquePicsLap.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">PIC Lap:</span>
              <select
                value={selectedPicLap}
                onChange={(e) => setSelectedPicLap(e.target.value)}
                className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Lapangan</option>
                {uniquePicsLap.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Delivery Time */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
              <Clock className="size-3.5" />
              Delivery:
            </span>
            <select
              value={selectedDelivery}
              onChange={(e) => setSelectedDelivery(e.target.value)}
              className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">Semua Lead Time</option>
              <option value="1 HARI">1 Hari (Mendesak)</option>
              <option value="1-2 HARI">1-2 Hari</option>
              <option value="1-3 HARI">1-3 Hari</option>
              <option value="1 MINGGU">1 Minggu</option>
              <option value="2 MINGGU">2 Minggu</option>
              <option value="2-3 MINGGU">2-3 Minggu</option>
            </select>
          </div>

          {/* Filter Khusus: Belum TTB */}
          <button
            type="button"
            onClick={() => setSelectedTtbStatus(selectedTtbStatus === 'PENDING' ? 'ALL' : 'PENDING')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition cursor-pointer ${
              selectedTtbStatus === 'PENDING'
                ? 'bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Tampilkan hanya berkas yang belum diserahkan ke TTB"
          >
            <Clock className="size-3.5 text-amber-600" />
            <span>Hanya Belum TTB</span>
          </button>

          {/* Toggle Keterangan Khusus */}
          <button
            type="button"
            onClick={() => setOnlySpecialNotes(!onlySpecialNotes)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition cursor-pointer ${
              onlySpecialNotes
                ? 'bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-400 font-semibold'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Info className="size-3.5" />
            <span>Ada Keterangan</span>
          </button>
        </div>

        {/* Counter Info & Reset Filter */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div>
            Menampilkan <span className="font-semibold text-foreground">{filteredData.length.toLocaleString('id-ID')}</span> dari{' '}
            <span className="font-semibold text-foreground">{localItems.length.toLocaleString('id-ID')}</span> baris berkas internal
            {sortField && (
              <span className="ml-2 px-2 py-0.5 rounded bg-muted text-[11px] font-mono">
                Sorted: {sortField} ({sortDirection})
              </span>
            )}
          </div>
          {(selectedEntity !== 'ALL' ||
            selectedPicPch !== 'ALL' ||
            selectedPicTtb !== 'ALL' ||
            selectedPicLap !== 'ALL' ||
            selectedDelivery !== 'ALL' ||
            selectedTtbStatus !== 'ALL' ||
            onlySpecialNotes ||
            sortField) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedEntity('ALL');
                setSelectedPicPch('ALL');
                setSelectedPicTtb('ALL');
                setSelectedPicLap('ALL');
                setSelectedDelivery('ALL');
                setSelectedTtbStatus('ALL');
                setOnlySpecialNotes(false);
                setSortField(null);
                setSortDirection('asc');
              }}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Reset Semua Filter &amp; Urutan
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Complete Main Table (Seluruh 40 Kolom Spreadsheet)     */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* Super Header: Zona Berkas Sesuai Spreadsheet */}
            <thead>
              <tr className="bg-muted/80 text-muted-foreground border-b border-border text-[11px] font-bold uppercase tracking-wider text-center">
                {/* Zona 1: Identitas & PIC PCH */}
                <th colSpan={6} className="py-2 px-3 border-r-2 border-border/80 text-left bg-muted/60">
                  Identitas Pengadaan &amp; Armada
                </th>

                {/* Zona 2: Done by Purchasing (Kuning) - INTERAKTIF */}
                {showPurchasingCols && (
                  <th
                    colSpan={9}
                    className="py-2 px-3 border-r-2 border-border/80 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Done by Purchasing</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/30 font-mono">
                        (Interaktif ⚡)
                      </span>
                    </div>
                  </th>
                )}

                {/* Zona 3: Done by Logistik & Lapangan (Hijau) */}
                {showLogistikCols && (
                  <th
                    colSpan={9}
                    className="py-2 px-3 border-r-2 border-border/80 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200"
                  >
                    Done by Logistik &amp; Tim Lapangan
                  </th>
                )}

                {/* Zona 4: ADM PCH & Keuangan (Biru / Ungu) */}
                {showAdmKeuCols && (
                  <th
                    colSpan={8}
                    className="py-2 px-3 bg-purple-500/15 text-purple-900 dark:text-purple-200"
                  >
                    Done by ADM PCH &amp; Keuangan (SPP)
                  </th>
                )}
              </tr>

              {/* Header Kolom Rinci */}
              <tr className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                {/* Sticky Left: Aksi, No, PIC, PT, Dept/Armada, No FPB */}
                <th className="py-2.5 px-2 w-10 text-center sticky left-0 z-20 bg-muted/90 backdrop-blur-xs">AKSI</th>
                <th className="py-2.5 px-3 w-10 text-center sticky left-10 z-20 bg-muted/90 backdrop-blur-xs">NO</th>
                <th className="py-2.5 px-3 sticky left-20 z-20 bg-muted/90 backdrop-blur-xs">PIC PCH</th>
                <th className="py-2.5 px-2 text-center sticky left-38 z-20 bg-muted/90 backdrop-blur-xs">PT</th>
                <th className="py-2.5 px-3 min-w-[180px] sticky left-48 z-20 bg-muted/90 backdrop-blur-xs">DEPT/ ARMADA</th>
                <th className="py-2.5 px-3 min-w-[140px] border-r-2 border-border/80 sticky left-[372px] z-20 bg-muted/90 backdrop-blur-xs">
                  NO. FPB
                </th>

                {/* Seksi 1: Purchasing (INTERAKTIF HEADERS) */}
                {showPurchasingCols && (
                  <>
                    <th className="py-2.5 px-3 min-w-[140px] bg-amber-500/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <span>NO. PO</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleSort('tglPo')}
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer font-semibold"
                        title="Klik untuk mengurutkan tanggal PO"
                      >
                        <span>TGL INPUT PO</span>
                        {sortField === 'tglPo' ? (
                          <span className="text-primary font-mono text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="size-2.5 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleSort('deliveryTime')}
                        className="flex items-center gap-1 text-amber-900 dark:text-amber-200 hover:text-amber-700 cursor-pointer font-bold"
                        title="Klik untuk mengurutkan berdasarkan urgensi SLA (Mendesak ke Santai)"
                      >
                        <Clock className="size-3 text-amber-600" />
                        <span>DELIVERY TIME</span>
                        {sortField === 'deliveryTime' ? (
                          <span className="font-mono text-[10px]">{sortDirection === 'asc' ? '⚡ (Mendesak)' : '⏳ (Santai)'}</span>
                        ) : (
                          <ArrowUpDown className="size-2.5 opacity-60" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px] bg-amber-500/[0.04]">NO. FSTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">TGL INPUT FSTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">
                      <button
                        type="button"
                        onClick={() => setSelectedTtbStatus(selectedTtbStatus === 'PENDING' ? 'ALL' : 'PENDING')}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition font-semibold ${
                          selectedTtbStatus === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40'
                            : 'hover:text-foreground'
                        }`}
                        title="Klik untuk memfilter: Tampilkan hanya berkas yang BELUM TTB"
                      >
                        <span>TGL KE PIC TTB</span>
                        {selectedTtbStatus === 'PENDING' ? (
                          <span className="px-1 py-0.2 rounded bg-amber-500 text-white text-[9px]">Belum TTB</span>
                        ) : (
                          <span className="text-[10px] opacity-60">🔍</span>
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">WAKTU KE PIC TTB</th>
                    <th className="py-2.5 px-3 min-w-[160px] bg-amber-500/[0.04]">KETERANGAN (PCH)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap border-r-2 border-border/80 bg-amber-500/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleSort('lapsePchToTtb')}
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer font-semibold"
                        title="Klik untuk mengurutkan berdasarkan lapse day (Terlama ke Tercepat)"
                      >
                        <span>LAPSE PCH-TTB</span>
                        {sortField === 'lapsePchToTtb' ? (
                          <span className="text-primary font-mono text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="size-2.5 opacity-50" />
                        )}
                      </button>
                    </th>
                  </>
                )}

                {/* Seksi 2: Logistik & Lapangan */}
                {showLogistikCols && (
                  <>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">PIC TTB</th>
                    <th className="py-2.5 px-3 min-w-[140px] bg-emerald-500/[0.04]">NO. TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL INPUT TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL KE TIM LAP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">PIC LAPANGAN</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL DIANTAR</th>
                    <th className="py-2.5 px-3 min-w-[160px] bg-emerald-500/[0.04]">KETERANGAN (LAP)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL TL KE TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap border-r-2 border-border/80 bg-emerald-500/[0.04]">TGL TTB KE PCH</th>
                  </>
                )}

                {/* Seksi 3: ADM PCH & Keuangan */}
                {showAdmKeuCols && (
                  <>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">TGL KE ADM PCH</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">LAPSE ADM</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">PIC ADM PCH</th>
                    <th className="py-2.5 px-3 min-w-[140px] bg-purple-500/[0.04]">NO. SPP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">TGL INPUT SPP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">TGL KEUANGAN</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.04]">STATUS ALUR</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-purple-500/[0.04]">ACTION</th>
                  </>
                )}
              </tr>
            </thead>

            {/* Isi Data Tabel */}
            <tbody className="divide-y divide-border">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={32} className="py-12 text-center text-muted-foreground">
                    Tidak ada berkas yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isDoneTtb = Boolean(row.tglKePicTtb && row.tglKePicTtb !== '-');
                  const isArmadaTruck =
                    (row.deptArmada || '').toUpperCase().includes('TRUCK') ||
                    (row.deptArmada || '').toUpperCase().includes('TANKI');
                  const ketPchText = (row.ketPch || row.keterangan || '').trim();
                  const ketLapText = (row.ketLap || '').trim();

                  return (
                    <tr
                      key={row.id || `${row.fpb}-${idx}`}
                      className="hover:bg-muted/40 transition group"
                    >
                      {/* Sticky 0: AKSI EDIT CEPAT */}
                      <td className="py-2 px-2 text-center sticky left-0 z-10 bg-card group-hover:bg-muted/80">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(row)}
                          className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition cursor-pointer"
                          title="Edit Berkas & Auto-Save"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </td>

                      {/* Sticky 1: NO */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono font-medium sticky left-10 z-10 bg-card group-hover:bg-muted/80">
                        {globalIdx}
                      </td>

                      {/* Sticky 2: PIC PCH */}
                      <td className="py-2.5 px-3 whitespace-nowrap sticky left-20 z-10 bg-card group-hover:bg-muted/80">
                        {getPicPchBadge(row.picPch)}
                      </td>

                      {/* Sticky 3: PT */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap sticky left-38 z-10 bg-card group-hover:bg-muted/80">
                        {getEntityBadge(row.entity)}
                      </td>

                      {/* Sticky 4: DEPT / ARMADA */}
                      <td className="py-2.5 px-3 font-medium text-foreground sticky left-48 z-10 bg-card group-hover:bg-muted/80">
                        <div className="flex items-center gap-1.5">
                          {isArmadaTruck ? (
                            <Truck className="size-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Ship className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate max-w-[170px]" title={row.deptArmada}>
                            {row.deptArmada || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Sticky 5: NO. FPB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-foreground border-r-2 border-border/80 sticky left-[372px] z-10 bg-card group-hover:bg-muted/80">
                        <div className="flex items-center gap-1.5 group/fpb">
                          <span>{row.fpb || '-'}</span>
                          {row.fpb && row.fpb !== '-' && (
                            <button
                              type="button"
                              onClick={() => handleCopy(row.fpb, 'No. FPB')}
                              className="opacity-0 group-hover/fpb:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Salin No. FPB"
                            >
                              <Copy className="size-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Seksi 1: Purchasing (INTERAKTIF CELLS) */}
                      {showPurchasingCols && (
                        <>
                          {/* 1. NO. PO (Hover Card & Filter Shortcut) */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-primary font-semibold bg-amber-500/[0.01]">
                            <div className="relative group/po flex items-center gap-1.5">
                              <span
                                className="hover:underline cursor-pointer"
                                onClick={() => setSearchQuery(row.po || row.noPo || '')}
                                title="Klik untuk memfilter No. PO ini"
                              >
                                {row.po || row.noPo || '-'}
                              </span>
                              {(row.po || row.noPo) && (row.po || row.noPo) !== '-' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(row.po || row.noPo || '', 'No. PO')}
                                    className="opacity-0 group-hover/po:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                    title="Salin No. PO"
                                  >
                                    <Copy className="size-3" />
                                  </button>

                                  {/* Floating Preview Card on Hover */}
                                  <div className="absolute top-full left-0 mt-1 hidden group-hover/po:block z-30 w-64 p-3 rounded-xl bg-card border border-border shadow-xl text-xs font-sans text-foreground pointer-events-auto animate-in fade-in-50 zoom-in-95 duration-150">
                                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2">
                                      <span className="font-mono font-bold text-primary">{row.po || row.noPo}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Detail PO</span>
                                    </div>
                                    <div className="space-y-1 text-[11px]">
                                      <div><span className="text-muted-foreground">FPB:</span> <strong className="font-mono">{row.fpb || '-'}</strong></div>
                                      <div><span className="text-muted-foreground">Armada:</span> <strong>{row.deptArmada || '-'}</strong></div>
                                      <div><span className="text-muted-foreground">Item:</span> <span className="line-clamp-2 text-muted-foreground">{row.keterangan || row.item || '-'}</span></div>
                                      <div><span className="text-muted-foreground">Tgl PO:</span> {formatTgl(row.tglPo)}</div>
                                      <div><span className="text-muted-foreground">SLA:</span> {row.deliveryTime || '-'}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSearchQuery(row.po || row.noPo || '')}
                                      className="w-full mt-2.5 py-1 px-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-[10px] text-center transition cursor-pointer"
                                    >
                                      🔍 Filter Berkas dengan PO ini
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          {/* 2. TANGGAL INPUT PO */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-amber-500/[0.01]">
                            {formatTgl(row.tglPo)}
                          </td>

                          {/* 3. DELIVERY TIME (INLINE SLA SELECTOR DROPDOWN) */}
                          <td className="py-2 px-2 whitespace-nowrap bg-amber-500/[0.01]">
                            <select
                              value={row.deliveryTime || '1 MINGGU'}
                              onChange={(e) => handleQuickUpdate(row, { deliveryTime: e.target.value })}
                              className={`text-[11px] font-bold py-1 px-2 rounded-md border cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition ${
                                (row.deliveryTime || '').includes('1 HARI') && !(row.deliveryTime || '').includes('1-2') && !(row.deliveryTime || '').includes('1-3')
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  : (row.deliveryTime || '').includes('1-2 HARI') || (row.deliveryTime || '').includes('1-3 HARI')
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                  : (row.deliveryTime || '').includes('1 MINGGU')
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25'
                              }`}
                              title="Klik untuk mengubah SLA Delivery Time (Otomatis Tersimpan ke Google Sheet)"
                            >
                              <option value="1 HARI">⚡ 1 HARI (Mendesak)</option>
                              <option value="1-2 HARI">⚡ 1-2 HARI</option>
                              <option value="1-3 HARI">⚡ 1-3 HARI</option>
                              <option value="1 MINGGU">📦 1 MINGGU</option>
                              <option value="2 MINGGU">📅 2 MINGGU</option>
                              <option value="2-3 MINGGU">📅 2-3 MINGGU</option>
                            </select>
                          </td>

                          {/* 4. NO. FSTB (Interactive Link & Quick Input) */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-amber-500/[0.01]">
                            {row.noFstb && row.noFstb !== '-' ? (
                              <div className="flex items-center gap-1.5 group/fstb">
                                <span
                                  onClick={() => setSearchQuery(row.noFstb || '')}
                                  className="hover:underline cursor-pointer"
                                  title="Klik untuk memfilter No. FSTB ini"
                                >
                                  {row.noFstb}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(row.noFstb || '', 'No. FSTB')}
                                  className="opacity-0 group-hover/fstb:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Salin No. FSTB"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const input = window.prompt(`Masukkan No. FSTB untuk berkas ${row.fpb || row.po}:`);
                                  if (input && input.trim()) {
                                    const today = new Date().toISOString().slice(0, 10);
                                    handleQuickUpdate(row, {
                                      noFstb: input.trim().toUpperCase(),
                                      tglInputFstb: row.tglInputFstb || today,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground/70 hover:text-emerald-600 hover:bg-emerald-500/10 border border-dashed border-border hover:border-emerald-500/30 transition cursor-pointer"
                                title="Klik untuk menginput No. FSTB"
                              >
                                <Plus className="size-2.5" />
                                <span>+ FSTB</span>
                              </button>
                            )}
                          </td>

                          {/* 5. TGL INPUT FSTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-amber-500/[0.01]">
                            {row.tglInputFstb && row.tglInputFstb !== '-' ? (
                              <span>{formatTgl(row.tglInputFstb)}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const today = new Date().toISOString().slice(0, 10);
                                  handleQuickUpdate(row, { tglInputFstb: today });
                                }}
                                className="text-[10px] text-muted-foreground/50 hover:text-foreground italic cursor-pointer"
                                title="Set tanggal input FSTB hari ini"
                              >
                                + Set Hari Ini
                              </button>
                            )}
                          </td>

                          {/* 6. TGL KE PIC TTB (1-KLIK SERAH TERIMA KE LOGISTIK) */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono bg-amber-500/[0.01]">
                            {isDoneTtb ? (
                              <div className="flex items-center gap-1.5 group/ttbdate">
                                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                  {formatTgl(row.tglKePicTtb)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Batalkan serah terima TTB untuk berkas ${row.fpb || row.po}?`)) {
                                      handleQuickUpdate(row, {
                                        tglKePicTtb: '',
                                        waktuKePicTtb: '',
                                        statusBadge: 'DALAM PROSES',
                                        statusTone: 'amber',
                                      });
                                    }
                                  }}
                                  className="opacity-0 group-hover/ttbdate:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
                                  title="Batalkan serah terima TTB"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMarkDoneTtb(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer shadow-2xs group/btn"
                                title="Klik untuk tandai telah diserahkan ke PIC TTB hari ini (Auto-Save ke Google Sheet)"
                              >
                                <CheckCircle2 className="size-3 text-amber-600 dark:text-amber-400 group-hover/btn:scale-110 transition" />
                                <span>+ Serahkan ke TTB</span>
                              </button>
                            )}
                          </td>

                          {/* 7. WAKTU KE PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground text-xs bg-amber-500/[0.01]">
                            {row.waktuKePicTtb && row.waktuKePicTtb !== '-' ? (
                              <span className="px-1.5 py-0.5 rounded bg-muted/60 text-[11px]">
                                {formatWaktu(row.waktuKePicTtb)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs italic">-</span>
                            )}
                          </td>

                          {/* 8. KETERANGAN PURCHASING (CLICK-TO-EDIT & TAGS) */}
                          <td className="py-2.5 px-3 max-w-[200px] bg-amber-500/[0.01]">
                            <div className="relative group/ket">
                              {ketPchText && ketPchText !== '-' ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="line-clamp-2 text-foreground font-medium hover:text-primary cursor-pointer transition"
                                    title={`${ketPchText} (Klik untuk edit catatan)`}
                                    onClick={() => {
                                      const newKet = window.prompt(
                                        `Edit Catatan Purchasing (${row.fpb || row.po}):`,
                                        ketPchText
                                      );
                                      if (newKet !== null) {
                                        handleQuickUpdate(row, { ketPch: newKet, keterangan: newKet });
                                      }
                                    }}
                                  >
                                    {ketPchText}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newKet = window.prompt(
                                        `Edit Catatan Purchasing (${row.fpb || row.po}):`,
                                        ketPchText
                                      );
                                      if (newKet !== null) {
                                        handleQuickUpdate(row, { ketPch: newKet, keterangan: newKet });
                                      }
                                    }}
                                    className="opacity-0 group-hover/ket:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                    title="Edit Catatan"
                                  >
                                    <Pencil className="size-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newKet = window.prompt(
                                      `Tambah Catatan Purchasing (${row.fpb || row.po}):`
                                    );
                                    if (newKet) {
                                      handleQuickUpdate(row, { ketPch: newKet, keterangan: newKet });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground italic cursor-pointer"
                                  title="Tambah Catatan"
                                >
                                  <Plus className="size-2.5" />
                                  <span>+ Catatan</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 9. LAPSE PCH KE TTB (SMART SLA BADGE WITH TOOLTIP) */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs border-r-2 border-border/80 bg-amber-500/[0.01]">
                            {getLapseBadge(
                              row.lapsePchToTtb ||
                                (row.tglInputFstb && row.tglKePicTtb
                                  ? calculateLapseDays(row.tglInputFstb, row.tglKePicTtb)
                                  : '-'),
                              row.tglInputFstb || row.tglPo,
                              row.tglKePicTtb
                            )}
                          </td>
                        </>
                      )}

                      {/* Seksi 2: Logistik & Tim Lapangan */}
                      {showLogistikCols && (
                        <>
                          {/* PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.01]">
                            {row.picTtb && row.picTtb !== '-' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                                {row.picTtb}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* NO. TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-foreground bg-emerald-500/[0.01]">
                            {row.noTtb && row.noTtb !== '-' ? (
                              <div className="flex items-center gap-1.5 group/ttb">
                                <span>{row.noTtb}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(row.noTtb || '', 'No. TTB')}
                                  className="opacity-0 group-hover/ttb:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Salin No. TTB"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL INPUT TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-emerald-500/[0.01]">
                            {formatTgl(row.tglInputTtb)}
                          </td>

                          {/* TGL KE TIM LAPANGAN */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground bg-emerald-500/[0.01]">
                            {formatTgl(row.tglKeTimLapangan)}
                          </td>

                          {/* PIC LAPANGAN */}
                          <td className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.01]">
                            {row.picLap && row.picLap !== '-' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25">
                                {row.picLap}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL BARANG DIANTAR */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/[0.01]">
                            {formatTgl(row.tglBarangDiantar)}
                          </td>

                          {/* KETERANGAN LOGISTIK / LAPANGAN */}
                          <td className="py-2.5 px-3 max-w-[200px] bg-emerald-500/[0.01]">
                            {ketLapText && ketLapText !== '-' ? (
                              <span
                                className="line-clamp-2 text-foreground font-medium"
                                title={ketLapText}
                              >
                                {ketLapText}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL TIM LAPANGAN KE PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground bg-emerald-500/[0.01]">
                            {formatTgl(row.tglTimLapKePicTtb)}
                          </td>

                          {/* TGL TTB KE PIC PURCHASING */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground border-r-2 border-border/80 bg-emerald-500/[0.01]">
                            {formatTgl(row.tglTtbKePicPch)}
                          </td>
                        </>
                      )}

                      {/* Seksi 3: ADM PCH & Keuangan */}
                      {showAdmKeuCols && (
                        <>
                          {/* TGL KE ADM PCH */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground bg-purple-500/[0.01]">
                            {formatTgl(row.tglKeAdmPch)}
                          </td>

                          {/* LAPSE ADM */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs bg-purple-500/[0.01]">
                            {row.lapseAdmPch ? (
                              <span className="text-muted-foreground">{row.lapseAdmPch}</span>
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* PIC ADM PCH */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground bg-purple-500/[0.01]">
                            {row.picAdm && row.picAdm !== '-' ? (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                                {row.picAdm}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* NO. SPP */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/[0.01]">
                            {row.noSpp && row.noSpp !== '-' ? (
                              <div className="flex items-center gap-1.5 group/spp">
                                <span>{row.noSpp}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(row.noSpp || '', 'No. SPP')}
                                  className="opacity-0 group-hover/spp:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Salin No. SPP"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL INPUT SPP */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground bg-purple-500/[0.01]">
                            {formatTgl(row.tglInputSpp)}
                          </td>

                          {/* TGL KE KEUANGAN */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-purple-500/[0.01]">
                            {formatTgl(row.tglKeKeuangan)}
                          </td>

                          {/* STATUS ALUR BERKAS */}
                          <td className="py-2.5 px-3 whitespace-nowrap bg-purple-500/[0.01]">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                row.statusTone === 'emerald'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : row.statusTone === 'cyan'
                                  ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                                  : row.statusTone === 'purple'
                                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                  : row.statusTone === 'rose'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {row.statusBadge || 'DALAM PROSES'}
                            </span>
                          </td>

                          {/* ACTION BUTTON */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap bg-purple-500/[0.01]">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-border bg-background hover:bg-primary hover:text-primary-foreground transition cursor-pointer shadow-2xs"
                            >
                              <Pencil className="size-3" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ======================================================== */}
        {/* 5. Pagination Footer                                      */}
        {/* ======================================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/20 text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              Menampilkan {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredData.length)} dari {filteredData.length.toLocaleString('id-ID')} berkas
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-1 px-2 text-xs rounded border border-border bg-background text-foreground"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-foreground">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. MODAL: TAMBAH BERKAS BARU / EDIT BERKAS               */}
      {/* ======================================================== */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isAddModalOpen ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                  {isAddModalOpen ? <Plus className="size-5" /> : <Pencil className="size-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {isAddModalOpen ? 'Tambah Berkas Internal Baru' : `Edit Berkas ${editingItem?.fpb || editingItem?.po || ''}`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data akan disimpan ke database sistem &amp; otomatis tersinkron (Auto-Save) ke Google Sheets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Section Switcher Tabs */}
            <div className="flex border-b border-border bg-muted/20 px-5 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setModalActiveTab('PCH')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                  modalActiveTab === 'PCH'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="size-2 rounded-full bg-amber-500" />
                1. Purchasing &amp; Identitas
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('LOG')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                  modalActiveTab === 'LOG'
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                2. Logistik &amp; Lapangan
              </button>
              <button
                type="button"
                onClick={() => setModalActiveTab('ADM')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                  modalActiveTab === 'ADM'
                    ? 'border-purple-500 text-purple-700 dark:text-purple-300'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="size-2 rounded-full bg-purple-500" />
                3. ADM PCH &amp; Keuangan
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: PURCHASING & IDENTITAS */}
              {modalActiveTab === 'PCH' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* NO. FPB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor FPB <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fpb || ''}
                        onChange={(e) => setFormData({ ...formData, fpb: e.target.value.toUpperCase() })}
                        placeholder="Contoh: FPB-2026-001"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* NO. PO */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor PO
                      </label>
                      <input
                        type="text"
                        value={formData.po || formData.noPo || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, po: e.target.value.toUpperCase(), noPo: e.target.value.toUpperCase() })
                        }
                        placeholder="Contoh: PO-CPL-2026-0123"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* PT / ENTITAS */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Entitas PT
                      </label>
                      <select
                        value={formData.entity || 'CPL'}
                        onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="CPL">CPL</option>
                        <option value="PPI">PPI</option>
                        <option value="HL">HL</option>
                        <option value="GAJ">GAJ</option>
                        <option value="MIL">MIL</option>
                        <option value="SP">SP</option>
                        <option value="SSK">SSK</option>
                        <option value="MO">MO</option>
                      </select>
                    </div>

                    {/* DEPT / ARMADA */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Dept / Nama Armada
                      </label>
                      <input
                        type="text"
                        value={formData.deptArmada || ''}
                        onChange={(e) => setFormData({ ...formData, deptArmada: e.target.value.toUpperCase() })}
                        placeholder="Contoh: TB. CPL 01 / LOGISTIK / WORKSHOP"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* PIC PURCHASING */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        PIC Purchasing
                      </label>
                      <select
                        value={formData.picPch || 'NOVI'}
                        onChange={(e) => setFormData({ ...formData, picPch: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="NOVI">NOVI</option>
                        <option value="TRI">TRI</option>
                        <option value="ELSA">ELSA</option>
                        <option value="YATI">YATI</option>
                        <option value="PUTRI">PUTRI</option>
                        <option value="LUTFI">LUTFI</option>
                      </select>
                    </div>

                    {/* TGL INPUT PO */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Input PO
                      </label>
                      <input
                        type="date"
                        value={formData.tglPo ? formData.tglPo.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglPo: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* DELIVERY TIME */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Delivery Time (SLA)
                      </label>
                      <select
                        value={formData.deliveryTime || '1 MINGGU'}
                        onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="1 HARI">1 HARI (Mendesak)</option>
                        <option value="1-2 HARI">1-2 HARI</option>
                        <option value="1-3 HARI">1-3 HARI</option>
                        <option value="1 MINGGU">1 MINGGU</option>
                        <option value="2 MINGGU">2 MINGGU</option>
                        <option value="2-3 MINGGU">2-3 MINGGU</option>
                      </select>
                    </div>

                    {/* NO. FSTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor FSTB
                      </label>
                      <input
                        type="text"
                        value={formData.noFstb || ''}
                        onChange={(e) => setFormData({ ...formData, noFstb: e.target.value.toUpperCase() })}
                        placeholder="Contoh: FSTB-2026-089"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL INPUT FSTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Input FSTB
                      </label>
                      <input
                        type="date"
                        value={formData.tglInputFstb ? formData.tglInputFstb.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglInputFstb: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL KE PIC TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Berkas ke PIC TTB
                      </label>
                      <input
                        type="date"
                        value={formData.tglKePicTtb ? formData.tglKePicTtb.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglKePicTtb: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* WAKTU KE PIC TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Waktu ke PIC TTB
                      </label>
                      <input
                        type="text"
                        value={formData.waktuKePicTtb || ''}
                        onChange={(e) => setFormData({ ...formData, waktuKePicTtb: e.target.value })}
                        placeholder="Contoh: 14:30:00 atau 2:30 PM"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* KETERANGAN PURCHASING */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Keterangan Purchasing
                    </label>
                    <textarea
                      rows={2}
                      value={formData.ketPch || formData.keterangan || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, ketPch: e.target.value, keterangan: e.target.value })
                      }
                      placeholder="Catatan khusus purchasing, SLA pengadaan, catatan toko, dll."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: LOGISTIK & LAPANGAN */}
              {modalActiveTab === 'LOG' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* PIC TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        PIC TTB
                      </label>
                      <input
                        type="text"
                        value={formData.picTtb || ''}
                        onChange={(e) => setFormData({ ...formData, picTtb: e.target.value.toUpperCase() })}
                        placeholder="Contoh: LOGISTIK / ALDI / EKO"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* NO. TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor TTB
                      </label>
                      <input
                        type="text"
                        value={formData.noTtb || ''}
                        onChange={(e) => setFormData({ ...formData, noTtb: e.target.value.toUpperCase() })}
                        placeholder="Contoh: TTB-2026-0045"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL INPUT TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Input TTB
                      </label>
                      <input
                        type="date"
                        value={formData.tglInputTtb ? formData.tglInputTtb.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglInputTtb: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL KE TIM LAPANGAN */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal ke Tim Lapangan
                      </label>
                      <input
                        type="date"
                        value={formData.tglKeTimLapangan ? formData.tglKeTimLapangan.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglKeTimLapangan: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* PIC LAPANGAN */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        PIC Lapangan
                      </label>
                      <input
                        type="text"
                        value={formData.picLap || ''}
                        onChange={(e) => setFormData({ ...formData, picLap: e.target.value.toUpperCase() })}
                        placeholder="Contoh: SAMSUL / ANDI"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL BARANG DIANTAR */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Barang Diantar
                      </label>
                      <input
                        type="date"
                        value={formData.tglBarangDiantar ? formData.tglBarangDiantar.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglBarangDiantar: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL TIM LAP KE PIC TTB */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Tim Lap ke PIC TTB
                      </label>
                      <input
                        type="date"
                        value={formData.tglTimLapKePicTtb ? formData.tglTimLapKePicTtb.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglTimLapKePicTtb: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL TTB KE PIC PURCHASING */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal TTB ke PIC PCH
                      </label>
                      <input
                        type="date"
                        value={formData.tglTtbKePicPch ? formData.tglTtbKePicPch.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglTtbKePicPch: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* KETERANGAN LOGISTIK / LAPANGAN */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Keterangan Logistik &amp; Tim Lapangan
                    </label>
                    <textarea
                      rows={2}
                      value={formData.ketLap || ''}
                      onChange={(e) => setFormData({ ...formData, ketLap: e.target.value })}
                      placeholder="Catatan penerimaan fisik barang, nomor resi kirim, lokasi serah terima kapal, dll."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: ADM PCH & KEUANGAN */}
              {modalActiveTab === 'ADM' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* TGL KE ADM PCH */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal ke ADM PCH
                      </label>
                      <input
                        type="date"
                        value={formData.tglKeAdmPch ? formData.tglKeAdmPch.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglKeAdmPch: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* PIC ADM PCH */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        PIC ADM PCH
                      </label>
                      <input
                        type="text"
                        value={formData.picAdm || ''}
                        onChange={(e) => setFormData({ ...formData, picAdm: e.target.value.toUpperCase() })}
                        placeholder="Contoh: FITRI / ADM"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* NO. SPP */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nomor SPP
                      </label>
                      <input
                        type="text"
                        value={formData.noSpp || ''}
                        onChange={(e) => setFormData({ ...formData, noSpp: e.target.value.toUpperCase() })}
                        placeholder="Contoh: SPP-2026-056"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL INPUT SPP */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal Input SPP
                      </label>
                      <input
                        type="date"
                        value={formData.tglInputSpp ? formData.tglInputSpp.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglInputSpp: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* TGL KE KEUANGAN */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Tanggal ke Keuangan
                      </label>
                      <input
                        type="date"
                        value={formData.tglKeKeuangan ? formData.tglKeKeuangan.slice(0, 10) : ''}
                        onChange={(e) => setFormData({ ...formData, tglKeKeuangan: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {/* STATUS ALUR BERKAS */}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Status Alur Berkas
                      </label>
                      <select
                        value={formData.statusBadge || 'DALAM PROSES'}
                        onChange={(e) => {
                          const val = e.target.value;
                          let tone: any = 'amber';
                          if (val === 'SELESAI KEUANGAN' || val === 'SELESAI') tone = 'emerald';
                          else if (val === 'DI TIM LAPANGAN') tone = 'cyan';
                          else if (val === 'PROSES SPP') tone = 'purple';
                          setFormData({ ...formData, statusBadge: val, statusTone: tone });
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="DALAM PROSES">DALAM PROSES (Purchasing)</option>
                        <option value="PROSES TTB">PROSES TTB (Logistik)</option>
                        <option value="DI TIM LAPANGAN">DI TIM LAPANGAN (Serah Terima)</option>
                        <option value="PROSES SPP">PROSES SPP (ADM PCH)</option>
                        <option value="SELESAI KEUANGAN">SELESAI KEUANGAN</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
                >
                  Batal
                </button>

                <div className="flex items-center gap-2">
                  {modalActiveTab !== 'ADM' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalActiveTab === 'PCH') setModalActiveTab('LOG');
                        else if (modalActiveTab === 'LOG') setModalActiveTab('ADM');
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                    >
                      Lanjut ke Seksi Berikutnya →
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Auto-Save'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MODAL: PENGATURAN WEBHOOK AUTO-SAVE GOOGLE SHEETS      */}
      {/* ======================================================== */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <FileSpreadsheet className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Integrasi Google Sheets &amp; Auto-Save
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sinkronisasi 2 arah otomatis setiap kali Anda menambah atau mengedit berkas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isWebhookConfigured
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                }`}
              >
                {isWebhookConfigured ? (
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <div className="font-bold">
                    {isWebhookConfigured ? 'Webhook Google Sheets Aktif' : 'Webhook Belum Terhubung'}
                  </div>
                  <div className="opacity-90 leading-relaxed">
                    {isWebhookConfigured
                      ? 'Setiap penambahan baris baru, perubahan status SLA, atau serah terima berkas yang dilakukan dari dashboard akan otomatis dikirim dan diperbarui di Google Sheets secara real-time.'
                      : 'Masukkan URL Webhook Google Apps Script di bawah untuk mengaktifkan fitur auto-save langsung ke Google Spreadsheet.'}
                  </div>
                </div>
              </div>

              {/* Input Webhook URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-foreground">
                  URL Webhook Google Apps Script (Web App Exec URL)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook || !webhookUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-40"
                  >
                    {isTestingWebhook ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    <span>Tes Koneksi</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingWebhook}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingWebhook ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Simpan</span>
                  </button>
                </div>
                {webhookStatus && (
                  <p
                    className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
                      webhookStatus.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {webhookStatus.active ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                    <span>{webhookStatus.message}</span>
                  </p>
                )}
              </div>

              {/* Panduan Pemasangan Google Apps Script */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Langkah Pemasangan di Google Sheets (Mudah &amp; Cepat):
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Cukup 1 kali pasang pada spreadsheet Anda.
                    </p>
                  </div>

                  {/* Tombol Salin Skrip 1-Klik */}
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                  >
                    {copiedScript ? <Check className="size-3.5" /> : <Code2 className="size-3.5" />}
                    <span>{copiedScript ? '✓ Skrip Disalin!' : 'Salin Skrip Apps Script (1-Klik)'}</span>
                  </button>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/60">
                  <li>
                    Buka Google Spreadsheet:{' '}
                    <a
                      href={GOOGLE_SHEET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold"
                    >
                      Monitoring Berkas Internal Procurement
                    </a>
                  </li>
                  <li>
                    Klik menu atas: <strong className="text-foreground">Ekstensi (Extensions)</strong> →{' '}
                    <strong className="text-foreground">Apps Script</strong>.
                  </li>
                  <li>
                    Hapus kode bawaan (myFunction), lalu klik tombol hijau{' '}
                    <strong className="text-emerald-600">"Salin Skrip Apps Script"</strong> di atas, lalu tempel (Paste) seluruh kodenya.
                  </li>
                  <li>
                    Klik tombol biru <strong className="text-foreground">Terapkan (Deploy)</strong> di pojok kanan atas →{' '}
                    <strong className="text-foreground">Penerapan baru (New deployment)</strong>.
                  </li>
                  <li>
                    Pilih jenis <strong className="text-foreground">Aplikasi web (Web app)</strong>:
                    <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5">
                      <li>Jalankan sebagai: <em>Saya (email Anda)</em></li>
                      <li>Siapa yang memiliki akses: <strong className="text-foreground">Siapa saja (Anyone)</strong></li>
                    </ul>
                  </li>
                  <li>
                    Klik <strong className="text-foreground">Terapkan (Deploy)</strong> dan izinkan akses Google.
                  </li>
                  <li>
                    Salin <strong>URL Aplikasi Web</strong> yang berakhiran <code className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]">/exec</code>, lalu tempel pada kolom input di atas dan klik <strong>Simpan</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
