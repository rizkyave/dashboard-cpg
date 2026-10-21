'use client';

import React, { useState, useMemo } from 'react';
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
  Truck as TruckIcon,
  Receipt,
} from 'lucide-react';
import { ProcurementItem } from '@/types/procurement';

interface MonitoringInternalTabProps {
  items: ProcurementItem[];
  onSyncSuccess?: (items: ProcurementItem[]) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8qGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit?pli=1&gid=0#gid=0';

// Daftar staf PIC Purchasing CPG
const PIC_OPTIONS = ['ALL', 'NOVI', 'TRI', 'ELSA', 'YATI', 'PUTRI', 'LUTFI'];

// Opsi Delivery Time standar
const DELIVERY_TIME_OPTIONS = [
  'ALL',
  '1 HARI',
  '1-2 HARI',
  '1-3 HARI',
  '1 MINGGU',
  '2 MINGGU',
  '2-3 MINGGU',
];

export default function MonitoringInternalTab({
  items,
  onSyncSuccess,
  showToast,
}: MonitoringInternalTabProps) {
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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

  // Helper styling badge Delivery Time (SLA) persis seperti di Google Sheet
  const getDeliveryTimeBadge = (delivery?: string) => {
    if (!delivery || delivery === '-') {
      return <span className="text-muted-foreground text-xs italic">-</span>;
    }
    const d = delivery.toUpperCase().trim();

    if (d === '1 HARI' || (d.includes('1 HARI') && !d.includes('1-2') && !d.includes('1-3'))) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
          <ArrowUp className="size-3 text-rose-600 dark:text-rose-400 shrink-0" />
          {delivery}
        </span>
      );
    }
    if (d.includes('1-2 HARI') || d.includes('1-3 HARI')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
          <ArrowUp className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
          {delivery}
        </span>
      );
    }
    if (d.includes('1 MINGGU')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
          {delivery}
        </span>
      );
    }
    if (d.includes('2 MINGGU') || d.includes('2-3 MINGGU') || d.includes('3 MINGGU')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
          {delivery}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
        {delivery}
      </span>
    );
  };

  // Helper format tanggal DD-MM-YYYY
  const formatTgl = (tgl?: string) => {
    if (!tgl || tgl === '-') return '-';
    if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
      const parts = tgl.slice(0, 10).split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return tgl;
  };

  // Helper format waktu (menangani nilai serial desimal Excel)
  const formatWaktu = (waktu?: string) => {
    if (!waktu || waktu === '-') return '-';
    // If it's a raw decimal string like 0.6111111111111112
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

  // Helper Copy to Clipboard
  const handleCopy = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    showToast?.(`${label} ${text} disalin ke clipboard!`, 'info');
  };

  // 2. Filter data
  const filteredData = useMemo(() => {
    return items.filter((item) => {
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
  }, [
    items,
    searchQuery,
    selectedEntity,
    selectedPicPch,
    selectedPicTtb,
    selectedPicLap,
    selectedDelivery,
    selectedTtbStatus,
    onlySpecialNotes,
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

    items.forEach((it) => {
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
      total: items.length,
      totalDonePurchasing,
      fastDeliveryCount,
      doneTtbCount,
      pendingTtbCount,
      doneLapanganCount,
      doneSppCount,
      specialNotesCount,
    };
  }, [items]);

  // 4. Unique Lists untuk dropdown filter
  const uniquePicsTtb = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const p = (it.picTtb || '').trim().toUpperCase();
      if (p && p !== '-' && p !== 'LOGISTIK') set.add(p);
    });
    return Array.from(set).sort();
  }, [items]);

  const uniquePicsLap = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const p = (it.picLap || '').trim().toUpperCase();
      if (p && p !== '-') set.add(p);
    });
    return Array.from(set).sort();
  }, [items]);

  // 5. Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset page when filter changes
  React.useEffect(() => {
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

  // 6. Export to CSV (Seluruh 40 Kolom Spreadsheet)
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
                  Semua Kolom Spreadsheet (4 Seksi Lengkap)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitoring berkas fisik menyeluruh: Done by Purchasing (PO & Delivery Time), Done by Logistik (TTB & Tim Lapangan), Serah Terima Barang, hingga ADM PCH & Keuangan (SPP).
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs"
            title="Buka Spreadsheet Asli di Google Sheets"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Buka Google Sheet</span>
          </a>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor seluruh 40 kolom ke CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tarik data terbaru langsung dari Google Sheets"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Google Sheets'}</span>
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
            setSelectedEntity('ALL');
            setSelectedPicPch('ALL');
            setSelectedPicTtb('ALL');
            setSelectedPicLap('ALL');
            setSelectedDelivery('ALL');
            setSelectedTtbStatus('ALL');
            setOnlySpecialNotes(false);
          }}
          className="p-4 rounded-xl bg-card border border-border shadow-xs hover:border-primary/40 transition cursor-pointer"
          title="Klik untuk reset semua filter"
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Total Berkas</span>
            <Layers className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">{metrics.total.toLocaleString('id-ID')}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Baris spreadsheet</div>
        </div>

        {/* Done by Purchasing (PO Terbit) */}
        <div
          onClick={() => setColumnSection('PCH')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            columnSection === 'PCH'
              ? 'bg-amber-500/15 border-amber-500 shadow-sm'
              : 'bg-card border-amber-500/20 bg-amber-500/[0.02] shadow-xs hover:border-amber-500/40'
          }`}
          title="Klik untuk fokus kolom Done by Purchasing"
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
            <span className="text-xs font-medium">Done Purchasing</span>
            <FileCheck className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.totalDonePurchasing.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Sudah terbit PO</div>
        </div>

        {/* Delivery Time 1-3 Hari */}
        <div
          onClick={() => setSelectedDelivery(selectedDelivery === '1 HARI' ? 'ALL' : '1 HARI')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedDelivery === '1 HARI'
              ? 'bg-rose-500/15 border-rose-500 shadow-sm'
              : 'bg-card border-rose-500/20 bg-rose-500/[0.02] shadow-xs hover:border-rose-500/40'
          }`}
          title="Klik untuk filter Delivery 1-3 Hari"
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
            <span className="text-xs font-medium">Delivery 1-3 Hari</span>
            <ArrowUp className="size-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {metrics.fastDeliveryCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Lead time pengiriman cepat</div>
        </div>

        {/* Done by Logistik (TTB Selesai) */}
        <div
          onClick={() => setColumnSection('LOG')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            columnSection === 'LOG'
              ? 'bg-emerald-500/15 border-emerald-500 shadow-sm'
              : 'bg-card border-emerald-500/20 bg-emerald-500/[0.02] shadow-xs hover:border-emerald-500/40'
          }`}
          title="Klik untuk fokus kolom Done by Logistik"
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
            <span className="text-xs font-medium">Done Logistik</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.doneTtbCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">FSTB diserahterimakan TTB</div>
        </div>

        {/* Barang Diantar Lapangan */}
        <div
          onClick={() => setColumnSection('LOG')}
          className="p-4 rounded-xl bg-card border border-cyan-500/20 bg-cyan-500/[0.02] shadow-xs hover:border-cyan-500/40 transition cursor-pointer"
          title="Barang telah diantar tim lapangan ke armada"
        >
          <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 mb-1.5">
            <span className="text-xs font-medium">Diantar Lapangan</span>
            <TruckIcon className="size-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {metrics.doneLapanganCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Diserahkan ke armada</div>
        </div>

        {/* Selesai SPP / Keuangan */}
        <div
          onClick={() => setColumnSection('ADM')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            columnSection === 'ADM'
              ? 'bg-purple-500/15 border-purple-500 shadow-sm'
              : 'bg-card border-purple-500/20 bg-purple-500/[0.02] shadow-xs hover:border-purple-500/40'
          }`}
          title="Klik untuk fokus kolom ADM PCH & Keuangan"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1.5">
            <span className="text-xs font-medium">SPP & Keuangan</span>
            <Receipt className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {metrics.doneSppCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">SPP terbit & selesai</div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Section Mode Switcher & Filter Toolbar                 */}
      {/* ======================================================== */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        {/* Section View Switcher Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/70">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mr-2">
              <SlidersHorizontal className="size-3.5 text-primary" />
              Tampilan Kolom:
            </span>
            <button
              type="button"
              onClick={() => setColumnSection('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                columnSection === 'ALL'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              🌐 Semua Kolom (4 Seksi Lengkap)
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('PCH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                columnSection === 'PCH'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              🟨 Done by Purchasing
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('LOG')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                columnSection === 'LOG'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              🟩 Done by Logistik & Lapangan
            </button>
            <button
              type="button"
              onClick={() => setColumnSection('ADM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                columnSection === 'ADM'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-500/10 text-purple-800 dark:text-purple-300 hover:bg-purple-500/20'
              }`}
            >
              🟦 ADM PCH & Keuangan (SPP)
            </button>
          </div>

          <div className="text-[11px] text-muted-foreground italic">
            * Kolom identitas (No, PIC, PT, Dept/Armada, FPB) terkunci di sebelah kiri saat geser horizontal.
          </div>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. FPB, PO, FSTB, TTB, SPP, Armada, PIC PCH/TTB/Lap, atau Keterangan..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition"
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

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter PT */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Building2 className="size-3.5" />
                PT:
              </span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="py-1.5 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PT</option>
                <option value="CPL">CPL</option>
                <option value="MO">MO</option>
                <option value="GAJ">GAJ</option>
                <option value="HL">HL</option>
                <option value="SP">SP</option>
              </select>
            </div>

            {/* Filter PIC PCH */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <UserCheck className="size-3.5" />
                PIC PCH:
              </span>
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
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div>
            Menampilkan <span className="font-semibold text-foreground">{filteredData.length.toLocaleString('id-ID')}</span> dari{' '}
            <span className="font-semibold text-foreground">{items.length.toLocaleString('id-ID')}</span> baris berkas internal
          </div>
          {(selectedEntity !== 'ALL' ||
            selectedPicPch !== 'ALL' ||
            selectedPicTtb !== 'ALL' ||
            selectedPicLap !== 'ALL' ||
            selectedDelivery !== 'ALL' ||
            selectedTtbStatus !== 'ALL' ||
            onlySpecialNotes) && (
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
              }}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Reset Semua Filter
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
                <th colSpan={5} className="py-2 px-3 border-r-2 border-border/80 text-left bg-muted/60">
                  Identitas Pengadaan &amp; Armada
                </th>

                {/* Zona 2: Done by Purchasing (Kuning) */}
                {showPurchasingCols && (
                  <th
                    colSpan={9}
                    className="py-2 px-3 border-r-2 border-border/80 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                  >
                    Done by Purchasing
                  </th>
                )}

                {/* Zona 3: Done by Logistik & Lapangan (Hijau) */}
                {showLogistikCols && (
                  <th
                    colSpan={12}
                    className="py-2 px-3 border-r-2 border-border/80 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200"
                  >
                    Done by Logistik &amp; Tim Lapangan
                  </th>
                )}

                {/* Zona 4: ADM PCH & Keuangan (Biru / Ungu) */}
                {showAdmKeuCols && (
                  <th
                    colSpan={7}
                    className="py-2 px-3 bg-purple-500/15 text-purple-900 dark:text-purple-200"
                  >
                    Done by ADM PCH &amp; Keuangan (SPP)
                  </th>
                )}
              </tr>

              {/* Header Kolom Rinci */}
              <tr className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                {/* Sticky Left: No, PIC, PT, Dept/Armada, No FPB */}
                <th className="py-2.5 px-3 w-10 text-center sticky left-0 z-20 bg-muted/90 backdrop-blur-xs">NO</th>
                <th className="py-2.5 px-3 sticky left-10 z-20 bg-muted/90 backdrop-blur-xs">PIC PCH</th>
                <th className="py-2.5 px-2 text-center sticky left-28 z-20 bg-muted/90 backdrop-blur-xs">PT</th>
                <th className="py-2.5 px-3 min-w-[180px] sticky left-38 z-20 bg-muted/90 backdrop-blur-xs">DEPT/ ARMADA</th>
                <th className="py-2.5 px-3 min-w-[140px] border-r-2 border-border/80 sticky left-[332px] z-20 bg-muted/90 backdrop-blur-xs">
                  NO. FPB
                </th>

                {/* Seksi 1: Purchasing */}
                {showPurchasingCols && (
                  <>
                    <th className="py-2.5 px-3 min-w-[140px] bg-amber-500/[0.04]">NO. PO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">TGL INPUT PO</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">DELIVERY TIME</th>
                    <th className="py-2.5 px-3 min-w-[140px] bg-amber-500/[0.04]">NO. FSTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">TGL INPUT FSTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">TGL KE PIC TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.04]">WAKTU KE PIC TTB</th>
                    <th className="py-2.5 px-3 min-w-[160px] bg-amber-500/[0.04]">KETERANGAN (PCH)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap border-r-2 border-border/80 bg-amber-500/[0.04]">LAPSE PCH-TTB</th>
                  </>
                )}

                {/* Seksi 2: Logistik & Lapangan */}
                {showLogistikCols && (
                  <>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">PIC TTB</th>
                    <th className="py-2.5 px-3 min-w-[140px] bg-emerald-500/[0.04]">NO. TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL INPUT TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL KE TIM LAP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">LAPSE TTB-LAP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">PIC LAPANGAN</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL DIANTAR</th>
                    <th className="py-2.5 px-3 min-w-[160px] bg-emerald-500/[0.04]">KETERANGAN (LAP)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL TL KE TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">LAPSE LAP-TTB</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-emerald-500/[0.04]">TGL TTB KE PCH</th>
                    <th className="py-2.5 px-3 whitespace-nowrap border-r-2 border-border/80 bg-emerald-500/[0.04]">LAPSE TTB-PCH</th>
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
                  </>
                )}
              </tr>
            </thead>

            {/* Isi Data Tabel */}
            <tbody className="divide-y divide-border">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={33} className="py-12 text-center text-muted-foreground">
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
                      {/* Sticky 1: NO */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/80">
                        {globalIdx}
                      </td>

                      {/* Sticky 2: PIC PCH */}
                      <td className="py-2.5 px-3 whitespace-nowrap sticky left-10 z-10 bg-card group-hover:bg-muted/80">
                        {getPicPchBadge(row.picPch)}
                      </td>

                      {/* Sticky 3: PT */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap sticky left-28 z-10 bg-card group-hover:bg-muted/80">
                        {getEntityBadge(row.entity)}
                      </td>

                      {/* Sticky 4: DEPT / ARMADA */}
                      <td className="py-2.5 px-3 font-medium text-foreground sticky left-38 z-10 bg-card group-hover:bg-muted/80">
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
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-foreground border-r-2 border-border/80 sticky left-[332px] z-10 bg-card group-hover:bg-muted/80">
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

                      {/* Seksi 1: Purchasing */}
                      {showPurchasingCols && (
                        <>
                          {/* NO. PO */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-primary font-semibold bg-amber-500/[0.01]">
                            <div className="flex items-center gap-1.5 group/po">
                              <span>{row.po || row.noPo || '-'}</span>
                              {(row.po || row.noPo) && (row.po || row.noPo) !== '-' && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(row.po || row.noPo || '', 'No. PO')}
                                  className="opacity-0 group-hover/po:opacity-100 text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Salin No. PO"
                                >
                                  <Copy className="size-3" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* TANGGAL INPUT PO */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-amber-500/[0.01]">
                            {formatTgl(row.tglPo)}
                          </td>

                          {/* DELIVERY TIME */}
                          <td className="py-2.5 px-3 whitespace-nowrap bg-amber-500/[0.01]">
                            {getDeliveryTimeBadge(row.deliveryTime)}
                          </td>

                          {/* NO. FSTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-amber-500/[0.01]">
                            {row.noFstb && row.noFstb !== '-' ? (
                              <div className="flex items-center gap-1.5 group/fstb">
                                <span>{row.noFstb}</span>
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
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL INPUT FSTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-amber-500/[0.01]">
                            {formatTgl(row.tglInputFstb)}
                          </td>

                          {/* TGL KE PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono bg-amber-500/[0.01]">
                            {isDoneTtb ? (
                              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                                {formatTgl(row.tglKePicTtb)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Belum TTB</span>
                            )}
                          </td>

                          {/* WAKTU KE PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-muted-foreground bg-amber-500/[0.01]">
                            {row.waktuKePicTtb && row.waktuKePicTtb !== '-' ? (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                {formatWaktu(row.waktuKePicTtb)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* KETERANGAN (PCH) */}
                          <td className="py-2.5 px-3 text-foreground bg-amber-500/[0.01]">
                            {ketPchText && ketPchText !== '-' ? (
                              <span className="text-xs truncate max-w-[160px] block" title={ketPchText}>
                                {ketPchText}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* LAPSE PCH KE TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs border-r-2 border-border/80 bg-amber-500/[0.01]">
                            {row.lapsePchToTtb ? (
                              <span className="font-semibold text-muted-foreground">{row.lapsePchToTtb}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </>
                      )}

                      {/* Seksi 2: Done by Logistik & Tim Lapangan */}
                      {showLogistikCols && (
                        <>
                          {/* PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-cyan-700 dark:text-cyan-300 bg-emerald-500/[0.01]">
                            {row.picTtb && row.picTtb !== '-' ? (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                                {row.picTtb}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>

                          {/* NO. TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-blue-600 dark:text-blue-400 font-semibold bg-emerald-500/[0.01]">
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
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-emerald-500/[0.01]">
                            {formatTgl(row.tglKeTimLapangan)}
                          </td>

                          {/* LAPSE TTB KE LAPANGAN */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs bg-emerald-500/[0.01]">
                            {row.lapseTtbToLap ? (
                              <span className="text-muted-foreground">{row.lapseTtbToLap}</span>
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* PIC LAPANGAN */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-amber-700 dark:text-amber-300 bg-emerald-500/[0.01]">
                            {row.picLap && row.picLap !== '-' ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                                {row.picLap}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>

                          {/* TGL BARANG DIANTAR */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono bg-emerald-500/[0.01]">
                            {row.tglBarangDiantar && row.tglBarangDiantar !== '-' ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatTgl(row.tglBarangDiantar)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">-</span>
                            )}
                          </td>

                          {/* KETERANGAN (LAPANGAN) */}
                          <td className="py-2.5 px-3 text-foreground bg-emerald-500/[0.01]">
                            {ketLapText && ketLapText !== '-' ? (
                              <span className="text-xs truncate max-w-[160px] block" title={ketLapText}>
                                {ketLapText}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            )}
                          </td>

                          {/* TGL TIM LAP KE PIC TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-emerald-500/[0.01]">
                            {formatTgl(row.tglTimLapKePicTtb)}
                          </td>

                          {/* LAPSE LAP KE TTB */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs bg-emerald-500/[0.01]">
                            {row.lapseLapToTtb ? (
                              <span className="text-muted-foreground">{row.lapseLapToTtb}</span>
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* TGL TTB KE PIC PCH */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono bg-emerald-500/[0.01]">
                            {formatTgl(row.tglTtbKePicPch)}
                          </td>

                          {/* LAPSE TTB KE PCH */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs border-r-2 border-border/80 bg-emerald-500/[0.01]">
                            {row.lapseTtbToPch ? (
                              <span className="font-semibold text-muted-foreground">{row.lapseTtbToPch}</span>
                            ) : (
                              '-'
                            )}
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
    </div>
  );
}
