'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  UserCheck,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  FileCheck,
  Ship,
  Truck,
  Copy,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { ProcurementItem } from '@/types/procurement';

interface MonitoringInternalTabProps {
  items: ProcurementItem[];
  onSyncSuccess?: (items: ProcurementItem[]) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8qGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit?pli=1&gid=0#gid=0';

// Daftar staf PIC Purchasing CPG sesuai spreadsheet
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
  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
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
  const getPicBadge = (pic?: string) => {
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

    if (d === '1 HARI' || d.includes('1 HARI') && !d.includes('1-2') && !d.includes('1-3')) {
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
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(tgl)) {
      const parts = tgl.slice(0, 10).split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return tgl;
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
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpbMatch = (item.fpb || '').toLowerCase().includes(q);
        const poMatch = (item.po || item.noPo || '').toLowerCase().includes(q);
        const fstbMatch = (item.noFstb || '').toLowerCase().includes(q);
        const armadaMatch = (item.deptArmada || '').toLowerCase().includes(q);
        const picMatch = (item.picPch || '').toLowerCase().includes(q);
        const ketMatch = (item.keterangan || item.peruntukan || '').toLowerCase().includes(q);

        if (!fpbMatch && !poMatch && !fstbMatch && !armadaMatch && !picMatch && !ketMatch) {
          return false;
        }
      }

      // 2. Entity Filter
      if (selectedEntity !== 'ALL') {
        const ent = (item.entity || '').toUpperCase();
        if (ent !== selectedEntity) return false;
      }

      // 3. PIC Filter
      if (selectedPic !== 'ALL') {
        const pic = (item.picPch || '').toUpperCase();
        if (!pic.includes(selectedPic)) return false;
      }

      // 4. Delivery Time Filter
      if (selectedDelivery !== 'ALL') {
        const dt = (item.deliveryTime || '').toUpperCase();
        if (!dt.includes(selectedDelivery)) return false;
      }

      // 5. Status Penyerahan TTB
      if (selectedTtbStatus === 'DONE') {
        if (!item.tglKePicTtb || item.tglKePicTtb === '-') return false;
      } else if (selectedTtbStatus === 'PENDING') {
        if (item.tglKePicTtb && item.tglKePicTtb !== '-') return false;
      }

      // 6. Only Special Notes (Bypass, Stock Gudang, dll)
      if (onlySpecialNotes) {
        const ket = (item.keterangan || item.peruntukan || '').trim();
        if (!ket || ket === '-') return false;
      }

      return true;
    });
  }, [
    items,
    searchQuery,
    selectedEntity,
    selectedPic,
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

      const ket = (it.keterangan || it.peruntukan || '').trim();
      if (ket && ket !== '-') specialNotesCount++;
    });

    return {
      total: items.length,
      totalDonePurchasing,
      fastDeliveryCount,
      doneTtbCount,
      pendingTtbCount,
      specialNotesCount,
    };
  }, [items]);

  // 4. Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedEntity, selectedPic, selectedDelivery, selectedTtbStatus, onlySpecialNotes, pageSize]);

  // 5. Export to CSV
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
      'KETERANGAN',
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
        `"${r.waktuKePicTtb || '-'}"`,
        `"${(r.keterangan || r.peruntukan || '-').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monitoring_Berkas_Internal_Procurement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast?.('Data berkas internal berhasil diekspor ke CSV!', 'success');
  };

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
                  Google Sheets Live Sync
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitoring berkas fisik Done by Purchasing (PO, Delivery Time SLA), serah terima dokumen FSTB ke PIC TTB, dan catatan operasional armada CPG.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Direct Link to Google Sheets */}
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

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor daftar ke format CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Sync Live Button */}
          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tarik pembaruan data langsung dari Google Sheets"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Google Sheets'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Top Summary KPI Cards (Alur Berkas Internal)           */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Berkas */}
        <div
          onClick={() => {
            setSearchQuery('');
            setSelectedEntity('ALL');
            setSelectedPic('ALL');
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
        <div className="p-4 rounded-xl bg-card border border-emerald-500/20 bg-emerald-500/[0.02] shadow-xs hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
            <span className="text-xs font-medium">Done Purchasing</span>
            <FileCheck className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.totalDonePurchasing.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Sudah terbit PO</div>
        </div>

        {/* Delivery Time 1-3 Hari (Mendesak) */}
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

        {/* Sudah Diserahkan ke PIC TTB */}
        <div
          onClick={() => setSelectedTtbStatus(selectedTtbStatus === 'DONE' ? 'ALL' : 'DONE')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedTtbStatus === 'DONE'
              ? 'bg-cyan-500/15 border-cyan-500 shadow-sm'
              : 'bg-card border-cyan-500/20 bg-cyan-500/[0.02] shadow-xs hover:border-cyan-500/40'
          }`}
          title="Klik untuk filter berkas yang sudah ke PIC TTB"
        >
          <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 mb-1.5">
            <span className="text-xs font-medium">Sudah ke PIC TTB</span>
            <CheckCircle2 className="size-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {metrics.doneTtbCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">FSTB diserahterimakan</div>
        </div>

        {/* Pending di Purchasing (Belum ke TTB) */}
        <div
          onClick={() => setSelectedTtbStatus(selectedTtbStatus === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedTtbStatus === 'PENDING'
              ? 'bg-amber-500/15 border-amber-500 shadow-sm'
              : 'bg-card border-amber-500/20 bg-amber-500/[0.02] shadow-xs hover:border-amber-500/40'
          }`}
          title="Klik untuk filter berkas yang belum diserahkan ke TTB"
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
            <span className="text-xs font-medium">Pending di PCH</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.pendingTtbCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Belum serah terima TTB</div>
        </div>

        {/* Keterangan Khusus / Bypass */}
        <div
          onClick={() => setOnlySpecialNotes(!onlySpecialNotes)}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            onlySpecialNotes
              ? 'bg-purple-500/15 border-purple-500 shadow-sm'
              : 'bg-card border-purple-500/20 bg-purple-500/[0.02] shadow-xs hover:border-purple-500/40'
          }`}
          title="Klik untuk filter berkas dengan catatan khusus"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1.5">
            <span className="text-xs font-medium">Keterangan Khusus</span>
            <Info className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {metrics.specialNotesCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Bypass, Stock Gudang, dll</div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Filter Toolbar                                         */}
      {/* ======================================================== */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. FPB, No. PO, No. FSTB, Armada/Truk, PIC, atau Keterangan..."
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
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
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
                value={selectedPic}
                onChange={(e) => setSelectedPic(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PIC</option>
                {PIC_OPTIONS.filter((p) => p !== 'ALL').map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Delivery Time */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Clock className="size-3.5" />
                Delivery:
              </span>
              <select
                value={selectedDelivery}
                onChange={(e) => setSelectedDelivery(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
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

            {/* Status TTB Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">Ke PIC TTB:</span>
              <select
                value={selectedTtbStatus}
                onChange={(e) => setSelectedTtbStatus(e.target.value as any)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Status</option>
                <option value="DONE">Sudah Serah Terima</option>
                <option value="PENDING">Belum Serah Terima</option>
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

        {/* Counter & Active Filter Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div>
            Menampilkan <span className="font-semibold text-foreground">{filteredData.length.toLocaleString('id-ID')}</span> dari{' '}
            <span className="font-semibold text-foreground">{items.length.toLocaleString('id-ID')}</span> baris berkas internal
          </div>
          {(selectedEntity !== 'ALL' || selectedPic !== 'ALL' || selectedDelivery !== 'ALL' || selectedTtbStatus !== 'ALL' || onlySpecialNotes) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedEntity('ALL');
                setSelectedPic('ALL');
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
      {/* 4. Main Data Table (1:1 Google Sheet Structure)           */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            {/* Header Super Section (Zone Banner) */}
            <thead>
              <tr className="bg-muted/70 text-muted-foreground border-b border-border text-[11px] font-bold uppercase tracking-wider text-center">
                <th colSpan={4} className="py-1.5 px-3 border-r border-border/70 text-left">
                  Identitas & PIC Pengadaan
                </th>
                <th colSpan={4} className="py-1.5 px-3 border-r border-border/70 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                  Done by Purchasing
                </th>
                <th colSpan={4} className="py-1.5 px-3 border-r border-border/70 bg-blue-500/10 text-blue-800 dark:text-blue-300">
                  Serah Terima Dokumen ke PIC TTB
                </th>
                <th className="py-1.5 px-3 text-left">Keterangan</th>
              </tr>
              <tr className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                <th className="py-3 px-3 w-10 text-center">NO</th>
                <th className="py-3 px-3">PIC PCH</th>
                <th className="py-3 px-2 text-center">PT</th>
                <th className="py-3 px-4 border-r border-border/70 min-w-[180px]">DEPT/ ARMADA</th>
                <th className="py-3 px-3 min-w-[140px]">NO. FPB</th>
                <th className="py-3 px-3 min-w-[140px]">NO. PO</th>
                <th className="py-3 px-3 whitespace-nowrap">TANGGAL INPUT PO</th>
                <th className="py-3 px-3 border-r border-border/70 whitespace-nowrap">DELIVERY TIME</th>
                <th className="py-3 px-3 min-w-[140px]">NO. FSTB</th>
                <th className="py-3 px-3 whitespace-nowrap">TGL INPUT FSTB</th>
                <th className="py-3 px-3 whitespace-nowrap">TGL KE PIC TTB</th>
                <th className="py-3 px-3 border-r border-border/70 whitespace-nowrap">WAKTU KE PIC TTB</th>
                <th className="py-3 px-4 min-w-[180px]">KETERANGAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-muted-foreground">
                    Tidak ada berkas yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isDoneTtb = Boolean(row.tglKePicTtb && row.tglKePicTtb !== '-');
                  const isArmadaTruck = (row.deptArmada || '').toUpperCase().includes('TRUCK') || (row.deptArmada || '').toUpperCase().includes('TANKI');
                  const ketText = (row.keterangan || row.peruntukan || '').trim();

                  return (
                    <tr
                      key={row.id || `${row.fpb}-${idx}`}
                      className="hover:bg-muted/40 transition group"
                    >
                      {/* NO */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono font-medium">
                        {globalIdx}
                      </td>

                      {/* PIC PCH */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getPicBadge(row.picPch)}
                      </td>

                      {/* PT */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {getEntityBadge(row.entity)}
                      </td>

                      {/* DEPT / ARMADA */}
                      <td className="py-2.5 px-4 font-medium text-foreground border-r border-border/70">
                        <div className="flex items-center gap-1.5">
                          {isArmadaTruck ? (
                            <Truck className="size-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Ship className="size-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate max-w-[220px]" title={row.deptArmada}>
                            {row.deptArmada || '-'}
                          </span>
                        </div>
                      </td>

                      {/* NO. FPB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-foreground">
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

                      {/* NO. PO */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-primary font-semibold">
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
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono">
                        {formatTgl(row.tglPo)}
                      </td>

                      {/* DELIVERY TIME */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-r border-border/70">
                        {getDeliveryTimeBadge(row.deliveryTime)}
                      </td>

                      {/* NO. FSTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
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
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono">
                        {formatTgl(row.tglInputFstb)}
                      </td>

                      {/* TGL KE PIC TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        {isDoneTtb ? (
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            {formatTgl(row.tglKePicTtb)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Belum TTB</span>
                        )}
                      </td>

                      {/* WAKTU KE PIC TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono border-r border-border/70 text-muted-foreground">
                        {row.waktuKePicTtb && row.waktuKePicTtb !== '-' ? (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                            {row.waktuKePicTtb}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* KETERANGAN */}
                      <td className="py-2.5 px-4 text-foreground">
                        {ketText && ketText !== '-' ? (
                          <div className="flex items-center gap-1.5">
                            {ketText.toUpperCase().includes('BYPASS') || ketText.toUpperCase().includes('BY PASS') ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                                BYPASS
                              </span>
                            ) : ketText.toUpperCase().includes('STOCK') || ketText.toUpperCase().includes('GUDANG') ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shrink-0">
                                STOK GUDANG
                              </span>
                            ) : null}
                            <span className="text-xs truncate max-w-xs" title={ketText}>
                              {ketText}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </td>
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

