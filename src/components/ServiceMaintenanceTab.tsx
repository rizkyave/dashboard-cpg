'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Wrench,
  Search,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  ChevronUp,
  Pin,
  Settings2,
  X,
  Printer,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ServiceMaintenanceItem,
  ServiceMaintenanceSummary,
  VendorSheetConfig,
} from '@/types/serviceMaintenance';
import { parseServiceMaintenanceWorkbook } from '@/utils/smParser';

interface ServiceMaintenanceTabProps {
  items: ServiceMaintenanceItem[];
  summary?: ServiceMaintenanceSummary | null;
  isLoading?: boolean;
  onRefreshAll: () => Promise<void>;
  onRefreshVendor?: (vendorId: string, url: string) => Promise<void>;
  onUploadExcel: (newItems: ServiceMaintenanceItem[]) => void;
  onOpenAudit?: (fpb: string, po?: string) => void;
  vendorConfigs: VendorSheetConfig[];
  onSaveVendorConfigs: (configs: VendorSheetConfig[]) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ServiceMaintenanceTab({
  items,
  summary,
  isLoading = false,
  onRefreshAll,
  onUploadExcel,
  onOpenAudit,
  vendorConfigs,
  onSaveVendorConfigs,
  showToast,
}: ServiceMaintenanceTabProps) {
  // Filters
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Split View & Freeze Header Pane State
  const [splitHeight, setSplitHeight] = useState<'compact' | 'default' | 'expanded'>('default');
  const [isTableScrolled, setIsTableScrolled] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Modal Detail Item SM
  const [selectedItemDetail, setSelectedItemDetail] = useState<ServiceMaintenanceItem | null>(null);

  // Modal Pengaturan URL Vendor Google Sheets
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [editingConfigs, setEditingConfigs] = useState<VendorSheetConfig[]>(vendorConfigs);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsTableScrolled(e.currentTarget.scrollTop > 30);
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Vendor options for filter
  const vendorList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.vendor) set.add(it.vendor);
    });
    return Array.from(set);
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      // Vendor filter
      if (selectedVendor !== 'ALL' && row.vendor !== selectedVendor) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'CLOSE' && row.status !== 'CLOSE') return false;
        if (selectedStatus === 'OPEN' && row.status !== 'OPEN') return false;
        if (selectedStatus === 'HOLD' && row.status !== 'HOLD') return false;
      }

      // Keyword search
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase().trim();
        const matchDept = row.dept?.toLowerCase().includes(q);
        const matchFpb = row.noFpb?.toLowerCase().includes(q);
        const matchPo = row.noPo?.toLowerCase().includes(q);
        const matchItem = row.item?.toLowerCase().includes(q);
        const matchKet = row.ket?.toLowerCase().includes(q);
        const matchType = row.type?.toLowerCase().includes(q);
        const matchVendor = row.vendor?.toLowerCase().includes(q);
        if (!matchDept && !matchFpb && !matchPo && !matchItem && !matchKet && !matchType && !matchVendor) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedVendor, selectedStatus, searchKeyword]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = items.length;
    const close = items.filter((i) => i.status === 'CLOSE').length;
    const open = items.filter((i) => i.status === 'OPEN').length;
    const hold = items.filter((i) => i.status === 'HOLD').length;
    const uniqueVendors = Array.from(new Set(items.map((i) => i.vendor).filter(Boolean))).length;
    return { total, close, open, hold, uniqueVendors };
  }, [items]);

  // Handle Excel Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const { items: parsedItems } = parseServiceMaintenanceWorkbook(workbook);

        if (parsedItems.length > 0) {
          onUploadExcel(parsedItems);
          showToast?.(
            `Berhasil memuat ${parsedItems.length} data Service & Maintenance dari file Excel!`,
            'success'
          );
        } else {
          showToast?.(
            'Format kolom tidak cocok atau tidak ada baris data SM yang terdeteksi.',
            'warning'
          );
        }
      } catch (err: any) {
        showToast?.(`Gagal membaca berkas Excel: ${err?.message || 'Error'}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      showToast?.('Tidak ada data yang dapat diekspor.', 'warning');
      return;
    }

    const headers = [
      'No',
      'Vendor',
      'Dept / Armada',
      'Tgl Barang Turun',
      'BAPB / BAST',
      'Tgl Ke Vendor',
      'Quot Ke Admin',
      'No FPB',
      'Input FPB',
      'No PO',
      'Tgl PO',
      'Item Pekerjaan',
      'Keterangan',
      'Type Mesin',
      'Tgl Selesai',
      'Status',
    ];

    const rows = filteredItems.map((r, i) => [
      i + 1,
      r.vendor || '',
      r.dept || '',
      r.tglBarangTurun || '',
      r.bapbLink || '',
      r.tglKeVendor || '',
      r.quotKeAdmin || '',
      r.noFpb || '',
      r.inputFpb || '',
      r.noPo || '',
      r.tglPo || '',
      `"${(r.item || '').replace(/"/g, '""')}"`,
      `"${(r.ket || '').replace(/"/g, '""')}"`,
      `"${(r.type || '').replace(/"/g, '""')}"`,
      r.tglSelesai || '',
      r.status || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monitoring_SM_Vendor_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Data SM berhasil diekspor ke format CSV!', 'success');
  };

  const handleSaveConfigs = () => {
    onSaveVendorConfigs(editingConfigs);
    setIsConfigOpen(false);
    showToast?.('Pengaturan URL Google Sheets vendor berhasil disimpan!', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ═══════════════════════════════════════════════════════════
          1. HEADER TOOLBAR & ACTION BUTTONS
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Wrench className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground">
                Monitoring Service &amp; Maintenance (SM) Vendor
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {metrics.uniqueVendors} Vendor Bengkel Rekanan
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pelacakan pekerjaan jasa perbaikan mesin, bubut, servis bengkel rekanan, dan integrasi nomor FPB-PO armada kapal.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => onRefreshAll()}
            disabled={isLoading}
            className="h-8 px-3 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 cursor-pointer shadow-2xs"
            title="Tarik data terbaru dari Google Sheets seluruh vendor"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyinkronkan...' : 'Sync Google Sheets'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            title="Unggah berkas Excel SM (.xlsx)"
          >
            <Upload className="size-3.5 text-muted-foreground" />
            <span>Unggah Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
            title="Ekspor data saat ini ke format CSV"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Ekspor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingConfigs(vendorConfigs);
              setIsConfigOpen(true);
            }}
            className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer shadow-2xs"
            title="Pengaturan URL Google Sheets per Vendor"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2. KPI SUMMARY METRICS
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Total Pekerjaan SM</span>
            <Layers className="size-4 text-sky-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
            {metrics.total.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground">Seluruh data vendor</p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-[11px] font-medium">Selesai (CLOSE)</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {metrics.close.toLocaleString()}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Pekerjaan rampung</p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-[11px] font-medium">Berjalan (OPEN)</span>
            <Clock className="size-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
            {metrics.open.toLocaleString()}
          </div>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80">Dalam proses pengerjaan</p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
            <span className="text-[11px] font-medium">Tertahan (HOLD)</span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
            {metrics.hold.toLocaleString()}
          </div>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80">Perlu tindak lanjut</p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Vendor Bengkel</span>
            <Building2 className="size-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
            {metrics.uniqueVendors}
          </div>
          <p className="text-[10px] text-muted-foreground">Balikpapan Diesel, Solusi, Tjokro, dll.</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. FILTER BAR (VENDOR & STATUS TABS)
          ═══════════════════════════════════════════════════════════ */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-3">
        {/* Vendor Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 mr-1">
            Vendor:
          </span>
          <button
            type="button"
            onClick={() => setSelectedVendor('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition cursor-pointer ${
              selectedVendor === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Semua Vendor ({items.length})
          </button>
          {vendorList.map((vnd) => {
            const count = items.filter((i) => i.vendor === vnd).length;
            const isSelected = selectedVendor === vnd;
            return (
              <button
                key={vnd}
                type="button"
                onClick={() => setSelectedVendor(vnd)}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                <span>{vnd}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-black/20 text-slate-950' : 'bg-background text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 border-t border-border/60">
          <div className="relative w-full sm:w-80">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Cari No FPB, No PO, Kapal, Item..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border rounded-lg focus:outline-hidden focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="size-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-foreground text-background font-semibold shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('CLOSE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedStatus === 'CLOSE'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <CheckCircle2 className="size-3" />
              <span>CLOSE ({metrics.close})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('OPEN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedStatus === 'OPEN'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-blue-700 dark:text-blue-400'
              }`}
            >
              <Clock className="size-3" />
              <span>OPEN ({metrics.open})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('HOLD')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedStatus === 'HOLD'
                  ? 'bg-rose-600 text-white font-semibold shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-rose-700 dark:text-rose-400'
              }`}
            >
              <AlertTriangle className="size-3" />
              <span>HOLD ({metrics.hold})</span>
            </button>

            {(searchKeyword || selectedVendor !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedVendor('ALL');
                  setSelectedStatus('ALL');
                }}
                className="h-7 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center gap-1 ml-auto"
                title="Reset seluruh filter"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          4. TABEL DATA DENGAN SPLIT SCROLL & FREEZE HEADER
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Split / Freeze Panes Status & Controls Toolbar */}
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
              <Pin className="size-3 text-amber-600 rotate-45" />
              <span>Header Terkunci (Split Scroll Aktif)</span>
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              Menampilkan {filteredItems.length} dari {items.length} pekerjaan SM
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center gap-1 bg-background border border-border p-0.5 rounded-lg text-[11px]">
              <span className="px-2 text-muted-foreground text-[10px] font-medium hidden sm:inline">
                Tinggi Panel:
              </span>
              <button
                type="button"
                onClick={() => setSplitHeight('compact')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  splitHeight === 'compact'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tinggi Ringkas (500px)"
              >
                500px
              </button>
              <button
                type="button"
                onClick={() => setSplitHeight('default')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  splitHeight === 'default'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tinggi Fokus Layar (72vh - Rekomendasi)"
              >
                Fokus (72vh)
              </button>
              <button
                type="button"
                onClick={() => setSplitHeight('expanded')}
                className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                  splitHeight === 'expanded'
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tinggi Bebas (Mengikuti Seluruh Baris)"
              >
                Penuh
              </button>
            </div>

            {isTableScrolled && (
              <button
                type="button"
                onClick={scrollToTop}
                className="h-7 px-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95 animate-in fade-in"
                title="Kembali ke baris teratas"
              >
                <ChevronUp className="size-3.5" />
                <span className="hidden sm:inline">Ke Atas</span>
              </button>
            )}
          </div>
        </div>

        {/* Scroll Container with Freeze Header */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className={`overflow-auto relative transition-all duration-200 ${
            splitHeight === 'compact'
              ? 'max-h-[500px]'
              : splitHeight === 'default'
              ? 'max-h-[72vh]'
              : 'max-h-none'
          }`}
        >
          <table className="w-full text-left text-xs text-foreground border-collapse">
            <thead className="sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] select-none">
              <tr>
                <th className="p-3 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  NO
                </th>
                <th className="p-3.5 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  VENDOR BENGKEL
                </th>
                <th className="p-3.5 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  DEPT / ARMADA
                </th>
                <th className="p-3.5 sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md min-w-[200px]">
                  ITEM PEKERJAAN &amp; SPESIFIKASI
                </th>
                <th className="p-3.5 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  NO FPB &amp; NO PO
                </th>
                <th className="p-3.5 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  TIMELINE DOKUMEN
                </th>
                <th className="p-3.5 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  BAPB / BAST
                </th>
                <th className="p-3.5 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  STATUS
                </th>
                <th className="p-3 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wrench className="size-8 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Tidak ada data Service &amp; Maintenance yang cocok
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Sesuaikan kata kunci pencarian, filter status, atau gunakan tombol Sync Google Sheets di atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((row, idx) => {
                  const isHold = row.status === 'HOLD';
                  const isClose = row.status === 'CLOSE';
                  const isOpen = row.status === 'OPEN';

                  return (
                    <tr
                      key={row.id || idx}
                      className={`transition group ${
                        isHold
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      {/* NO */}
                      <td className="p-3 text-center font-mono text-muted-foreground text-[11px]">
                        {idx + 1}
                      </td>

                      {/* VENDOR */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Building2 className="size-2.5" />
                          <span>{row.vendor || 'SM - VENDOR'}</span>
                        </span>
                      </td>

                      {/* DEPT / ARMADA */}
                      <td className="p-3.5 whitespace-nowrap font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{row.dept || '-'}</span>
                        </div>
                      </td>

                      {/* ITEM PEKERJAAN & TYPE */}
                      <td className="p-3.5 max-w-[320px]">
                        <div className="font-semibold text-foreground leading-snug">
                          {row.item || '-'}
                        </div>
                        {(row.ket || row.type) && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-muted-foreground font-mono">
                            {row.ket && (
                              <span className="px-1.5 py-0.2 rounded bg-muted border border-border">
                                {row.ket}
                              </span>
                            )}
                            {row.type && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                                {row.type}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* NO FPB & NO PO */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                        {row.noFpb ? (
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenAudit && onOpenAudit(row.noFpb, row.noPo)}
                              className="font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                              title="Buka Verifikasi Akuntabilitas Lintas Modul"
                            >
                              <span>{row.noFpb}</span>
                              <ExternalLink className="size-2.5" />
                            </button>
                            {row.inputFpb && (
                              <span className="text-[10px] text-muted-foreground block">
                                Input: {row.inputFpb}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}

                        {row.noPo && (
                          <div className="mt-1 pt-1 border-t border-border/40">
                            <span className="text-foreground font-medium">
                              PO: {row.noPo}
                            </span>
                            {row.tglPo && (
                              <span className="text-[10px] text-muted-foreground block">
                                Tgl: {row.tglPo}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* TIMELINE DOKUMEN */}
                      <td className="p-3.5 whitespace-nowrap text-[10px] font-mono text-muted-foreground space-y-0.5">
                        {row.tglBarangTurun && (
                          <div>Turun: <strong className="text-foreground">{row.tglBarangTurun}</strong></div>
                        )}
                        {row.tglKeVendor && (
                          <div>Kirim: <span className="text-foreground">{row.tglKeVendor}</span></div>
                        )}
                        {row.quotKeAdmin && (
                          <div>Quot: <span className="text-foreground">{row.quotKeAdmin}</span></div>
                        )}
                        {row.tglSelesai && (
                          <div>Selesai: <strong className="text-emerald-600 dark:text-emerald-400">{row.tglSelesai}</strong></div>
                        )}
                      </td>

                      {/* BAPB / BAST */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {row.bapbLink && row.bapbLink.startsWith('http') ? (
                          <a
                            href={row.bapbLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition shadow-2xs"
                            title="Buka Dokumen BAST di Workplace Cindara"
                          >
                            <span>Link BAST</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        ) : row.bapbLink && row.bapbLink !== 'N/A' && row.bapbLink !== '-' ? (
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-muted text-muted-foreground border border-border">
                            {row.bapbLink}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px]">-</span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isHold
                              ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                              : isClose
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : isOpen
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {row.status || 'UNKNOWN'}
                        </span>
                      </td>

                      {/* AKSI */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedItemDetail(row)}
                          className="h-7 px-2.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Quick Back to Top Button */}
        {isTableScrolled && splitHeight !== 'expanded' && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute bottom-4 right-5 z-30 shadow-lg bg-foreground text-background hover:bg-foreground/90 font-semibold text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200 border border-border/40 shadow-primary/10"
            title="Kembali ke baris pertama tabel"
          >
            <ChevronUp className="size-3.5" />
            <span>Kembali ke Atas</span>
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5. MODAL DETAIL POP-UP INSPECTION
          ═══════════════════════════════════════════════════════════ */}
      {selectedItemDetail && (
        <div
          onClick={() => setSelectedItemDetail(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 printable-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto p-5 sm:p-6 space-y-4 printable-modal-content"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Wrench className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Rincian Pekerjaan Service &amp; Maintenance
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Vendor: <strong className="text-foreground">{selectedItemDetail.vendor}</strong> &bull; Kapal:{' '}
                    <strong className="text-foreground">{selectedItemDetail.dept}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition print:hidden"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Uraian Pekerjaan &amp; Mesin
                </div>
                <div className="text-sm font-bold text-foreground">
                  {selectedItemDetail.item || '-'}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Keterangan: </span>
                    <strong className="text-foreground">{selectedItemDetail.ket || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipe Mesin: </span>
                    <strong className="text-foreground">{selectedItemDetail.type || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Status and Referensi Dokumen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl border border-border bg-background space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-sans block font-semibold">
                    Referensi Dokumen Pengadaan:
                  </span>
                  <div>
                    <span className="text-muted-foreground text-[11px]">No FPB: </span>
                    <strong className="text-foreground">{selectedItemDetail.noFpb || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Input FPB: </span>
                    <span className="text-foreground">{selectedItemDetail.inputFpb || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">No PO: </span>
                    <strong className="text-foreground">{selectedItemDetail.noPo || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Tanggal PO: </span>
                    <span className="text-foreground">{selectedItemDetail.tglPo || '-'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-sans block font-semibold">
                    Jadwal &amp; Status Penyelesaian:
                  </span>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Barang Turun: </span>
                    <span className="text-foreground">{selectedItemDetail.tglBarangTurun || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Kirim Vendor: </span>
                    <span className="text-foreground">{selectedItemDetail.tglKeVendor || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Quot Masuk: </span>
                    <span className="text-foreground">{selectedItemDetail.quotKeAdmin || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Pekerjaan Selesai: </span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {selectedItemDetail.tglSelesai || '-'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* BAST Link Preview */}
              {selectedItemDetail.bapbLink && (
                <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-emerald-600" />
                    <div>
                      <span className="font-semibold block text-foreground">Dokumen BAST / BAPB</span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-sm block">
                        {selectedItemDetail.bapbLink}
                      </span>
                    </div>
                  </div>
                  {selectedItemDetail.bapbLink.startsWith('http') && (
                    <a
                      href={selectedItemDetail.bapbLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 transition shadow-xs"
                    >
                      <span>Buka BAST</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer (with Print PDF & TUTUP buttons) */}
            <div className="p-3 border-t border-border flex items-center justify-between pt-3">
              {selectedItemDetail.noFpb && onOpenAudit ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAudit(selectedItemDetail.noFpb, selectedItemDetail.noPo);
                    setSelectedItemDetail(null);
                  }}
                  className="h-8 px-3 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer print:hidden"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>Audit Lintas Modul</span>
                </button>
              ) : (
                <div></div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="h-8 px-3.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer print:hidden"
                  title="Cetak atau simpan modul ini ke format PDF"
                >
                  <Printer className="size-3.5 text-primary" />
                  <span>Print PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemDetail(null)}
                  className="h-8 px-4 rounded-lg text-xs font-bold tracking-wide bg-foreground text-background transition cursor-pointer print:hidden"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          6. MODAL PENGATURAN URL GOOGLE SHEETS PER VENDOR
          ═══════════════════════════════════════════════════════════ */}
      {isConfigOpen && (
        <div
          onClick={() => setIsConfigOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="size-5 text-amber-500" />
                <h3 className="font-bold text-sm text-foreground">
                  Konfigurasi Link Google Sheets Vendor
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="size-7 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Masukkan URL Google Sheets untuk setiap vendor rekanan bengkel SM. Pastikan setiap tautan memiliki izin &quot;Siapa saja yang memiliki link dapat melihat&quot; (Viewer).
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {editingConfigs.map((cfg, idx) => (
                <div key={cfg.id} className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground font-mono">{cfg.name}</span>
                    <a
                      href={cfg.sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5"
                    >
                      Buka Sheet <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={cfg.sheetUrl}
                    onChange={(e) => {
                      const next = [...editingConfigs];
                      next[idx] = { ...cfg, sheetUrl: e.target.value };
                      setEditingConfigs(next);
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full h-7 px-2 text-[11px] font-mono rounded bg-background border border-border focus:border-primary focus:outline-hidden text-foreground"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveConfigs}
                className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

