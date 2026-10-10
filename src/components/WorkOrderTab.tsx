'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link2,
  Eye,
  X,
  Download,
  Building2,
  Anchor,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  Sparkles,
  Layers,
  Calendar,
  Check,
  Copy,
  Wrench,
  Pin,
  ChevronUp,
  Printer,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { WorkOrderItem, WorkOrderSummary } from '@/types/workOrder';

interface WorkOrderTabProps {
  items: WorkOrderItem[];
  summary?: WorkOrderSummary | null;
  isLoading?: boolean;
  onRefresh: () => Promise<void>;
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1PCko1zSn1PNpK9kfnUp3CoMGeeKsxhycwBiUH78b9B4/edit?gid=687878754#gid=687878754';

function parseDateStringToMs(dateStr: string): number {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  // Format DD/MM/YYYY
  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10) - 1;
    const year = parseInt(slashParts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day).getTime() || 0;
    }
  }
  // Format YYYY-MM-DD
  const dashParts = trimmed.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const year = parseInt(dashParts[0], 10);
    const month = parseInt(dashParts[1], 10) - 1;
    const day = parseInt(dashParts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day).getTime() || 0;
    }
  }
  const parsed = new Date(trimmed).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function getMtcServiceReportUrl(evidence: string): string {
  if (!evidence) return 'https://mtc.cindaragroup.com/';
  const clean = evidence.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  // Gunakan API resolver otomatis untuk mencocokkan ID database MTC secara presisi 100%
  return `/api/mtc-redirect?evidence=${encodeURIComponent(clean)}`;
}

export default function WorkOrderTab({
  items = [],
  summary,
  isLoading = false,
  onRefresh,
  onOpenAudit,
  showToast,
}: WorkOrderTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'On Progress' | 'Close'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [fpbFilter, setFpbFilter] = useState<'ALL' | 'WITH_FPB' | 'WITHOUT_FPB'>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof WorkOrderItem>('tanggalOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Selected item for detail modal
  const [selectedItem, setSelectedItem] = useState<WorkOrderItem | null>(null);

  // Copied indicator state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Split View & Freeze Header Pane State
  const [splitHeight, setSplitHeight] = useState<'compact' | 'default' | 'expanded'>('default');
  const [isTableScrolled, setIsTableScrolled] = useState<boolean>(false);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsTableScrolled(e.currentTarget.scrollTop > 30);
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    if (showToast) showToast(`${label} disalin ke clipboard!`, 'info');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Distinct departments and sections for dropdowns
  const { departmentList, sectionList, priorityList } = useMemo(() => {
    const depts = new Set<string>();
    const sects = new Set<string>();
    const priors = new Set<string>();

    items.forEach((it) => {
      if (it.departemenArmada) depts.add(it.departemenArmada);
      if (it.section) sects.add(it.section);
      if (it.scalaPrioritas) priors.add(it.scalaPrioritas);
    });

    return {
      departmentList: Array.from(depts).sort((a, b) => a.localeCompare(b)),
      sectionList: Array.from(sects).sort((a, b) => a.localeCompare(b)),
      priorityList: Array.from(priors).sort((a, b) => a.localeCompare(b)),
    };
  }, [items]);

  // Dynamic status counts based on total items
  const stats = useMemo(() => {
    let open = 0;
    let onProgress = 0;
    let close = 0;
    let withFpb = 0;

    items.forEach((it) => {
      if (it.status === 'Open') open++;
      else if (it.status === 'On Progress') onProgress++;
      else if (it.status === 'Close') close++;

      if (it.noFpbMrp) withFpb++;
    });

    return {
      total: items.length,
      open,
      onProgress,
      close,
      withFpb,
    };
  }, [items]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Status filter
      if (statusFilter !== 'ALL' && it.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && it.scalaPrioritas !== priorityFilter) return false;

      // Department filter
      if (departmentFilter !== 'ALL' && it.departemenArmada !== departmentFilter) return false;

      // Section filter
      if (sectionFilter !== 'ALL' && it.section !== sectionFilter) return false;

      // FPB filter
      if (fpbFilter === 'WITH_FPB' && !it.noFpbMrp) return false;
      if (fpbFilter === 'WITHOUT_FPB' && it.noFpbMrp) return false;

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const docMatch = it.nomerDokumen.toLowerCase().includes(q);
        const fpbMatch = it.noFpbMrp.toLowerCase().includes(q);
        const deptMatch = it.departemenArmada.toLowerCase().includes(q);
        const projMatch = it.namaProject.toLowerCase().includes(q);
        const descMatch = it.uraianPerbaikan.toLowerCase().includes(q);
        const lkaMatch = it.noLkaLkk.toLowerCase().includes(q);
        const spkMatch = it.spk.toLowerCase().includes(q);
        const evidenceMatch = it.evidence.toLowerCase().includes(q);
        const secMatch = it.section.toLowerCase().includes(q);
        if (
          !docMatch &&
          !fpbMatch &&
          !deptMatch &&
          !projMatch &&
          !descMatch &&
          !lkaMatch &&
          !spkMatch &&
          !evidenceMatch &&
          !secMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    statusFilter,
    priorityFilter,
    departmentFilter,
    sectionFilter,
    fpbFilter,
    searchQuery,
  ]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // 1. Sort khusus tanggal order (chronological comparison)
      if (sortField === 'tanggalOrder') {
        const timeA = a.orderDateMs || parseDateStringToMs(a.tanggalOrder);
        const timeB = b.orderDateMs || parseDateStringToMs(b.tanggalOrder);
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        // Sub-sort: timestamp pengiriman form response atau baris spreadsheet
        const subA = a.timestampMs || a.rowIndex || 0;
        const subB = b.timestampMs || b.rowIndex || 0;
        return sortOrder === 'asc' ? subA - subB : subB - subA;
      }

      // 2. Sort khusus timestamp submission form
      if (sortField === 'timestamp') {
        const timeA = a.timestampMs || parseDateStringToMs(a.timestamp);
        const timeB = b.timestampMs || parseDateStringToMs(b.timestamp);
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        const subA = a.rowIndex || 0;
        const subB = b.rowIndex || 0;
        return sortOrder === 'asc' ? subA - subB : subB - subA;
      }

      // 3. Kolom tanggal lainnya (tanggalMulai, tanggalSelesai, tanggalMrpFpb)
      if (
        sortField === 'tanggalMulai' ||
        sortField === 'tanggalSelesai' ||
        sortField === 'tanggalMrpFpb'
      ) {
        const timeA = parseDateStringToMs(a[sortField] as string);
        const timeB = parseDateStringToMs(b[sortField] as string);
        if (timeA !== timeB) {
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
      }

      // 4. Progress numerik (%)
      if (sortField === 'progress') {
        return sortOrder === 'asc' ? a.progress - b.progress : b.progress - a.progress;
      }

      // 5. String fields (natural Indonesian numeric sort)
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      const strA = String(valA).trim();
      const strB = String(valB).trim();

      const cmp = strA.localeCompare(strB, 'id-ID', { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredItems, sortField, sortOrder]);

  // Pagination slice
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (field: keyof WorkOrderItem) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Kolom tanggal dan progress default descending (terbaru dahulu)
      if (
        field === 'tanggalOrder' ||
        field === 'timestamp' ||
        field === 'tanggalMulai' ||
        field === 'tanggalSelesai' ||
        field === 'progress'
      ) {
        setSortOrder('desc');
      } else {
        setSortOrder('asc');
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (sortedItems.length === 0) {
      if (showToast) showToast('Tidak ada data yang sesuai filter untuk diekspor.', 'warning');
      return;
    }

    const exportRows = sortedItems.map((it, idx) => ({
      No: idx + 1,
      'No. Dokumen (WO)': it.nomerDokumen,
      'Tanggal Order': it.tanggalOrder,
      'Departemen / Armada': it.departemenArmada,
      'Nama Project': it.namaProject,
      'Lokasi Pekerjaan': it.lokasiPekerjaan,
      'Tanggal Mulai': it.tanggalMulai,
      'Tanggal Selesai': it.tanggalSelesai,
      'No. LKA / LKK': it.noLkaLkk,
      Prioritas: it.scalaPrioritas,
      Section: it.section,
      'Uraian Permintaan Perbaikan': it.uraianPerbaikan,
      'No. FPB / MRP': it.noFpbMrp,
      Status: it.status,
      'Progress (%)': `${it.progress}%`,
      Evidence: it.evidence,
      SPK: it.spk,
      'Link SO/WO': it.uploadSoWoUrl,
      'Link BAST': it.bastUrl,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'List Work Order');
    XLSX.writeFile(wb, `List_Work_Order_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (showToast) showToast(`Berhasil mengekspor ${exportRows.length} data Work Order!`, 'success');
  };

  const getPriorityBadgeClass = (p: string) => {
    const pl = p.toLowerCase();
    if (pl.includes('1') || pl.includes('emergency') || pl.includes('high')) {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (pl.includes('2') || pl.includes('medium')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
  };

  const getStatusBadgeClass = (s: string) => {
    if (s === 'Close') {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (s === 'On Progress') {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <FileSpreadsheet className="size-5" />
              </span>
              <div>
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Monitoring Work Order (WO)</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Data rekap perbaikan armada, dokumen SO/WO, berita acara BAST, serta status terhubung nomor FPB secara live.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs disabled:opacity-60 cursor-pointer"
              title="Tarik & sinkronkan data terbaru dari Google Spreadsheet"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
              title="Unduh data Work Order sebagai file Excel (.xlsx)"
            >
              <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>

            <a
              href={GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition cursor-pointer"
              title="Buka dokumen Google Spreadsheet asli di tab baru"
            >
              <ExternalLink className="size-3.5" />
              <span>Buka Sheets</span>
            </a>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border">
          {/* 1. Total WO */}
          <div className="bg-muted/40 border border-border/80 rounded-lg p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Total WO</span>
              <FileSpreadsheet className="size-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-foreground">
              {stats.total.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground">Seluruh data WO</span>
          </div>

          {/* 2. Open */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Open' ? 'ALL' : 'Open')}
            className={`border rounded-lg p-3 cursor-pointer transition ${
              statusFilter === 'Open'
                ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/50'
                : 'bg-muted/40 border-border/80 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs mb-1">
              <span className="font-semibold">Open</span>
              <AlertCircle className="size-3.5" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {stats.open.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground">Menunggu pengerjaan</span>
          </div>

          {/* 3. On Progress */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'On Progress' ? 'ALL' : 'On Progress')}
            className={`border rounded-lg p-3 cursor-pointer transition ${
              statusFilter === 'On Progress'
                ? 'bg-blue-500/15 border-blue-500 ring-1 ring-blue-500/50'
                : 'bg-muted/40 border-border/80 hover:border-blue-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs mb-1">
              <span className="font-semibold">On Progress</span>
              <Clock className="size-3.5" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {stats.onProgress.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground">Sedang dikerjakan</span>
          </div>

          {/* 4. Close */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Close' ? 'ALL' : 'Close')}
            className={`border rounded-lg p-3 cursor-pointer transition ${
              statusFilter === 'Close'
                ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500/50'
                : 'bg-muted/40 border-border/80 hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs mb-1">
              <span className="font-semibold">Close</span>
              <CheckCircle2 className="size-3.5" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.close.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground">Pekerjaan selesai</span>
          </div>

          {/* 5. Terhubung FPB */}
          <div
            onClick={() => setFpbFilter(fpbFilter === 'WITH_FPB' ? 'ALL' : 'WITH_FPB')}
            className={`border rounded-lg p-3 cursor-pointer transition col-span-2 sm:col-span-1 ${
              fpbFilter === 'WITH_FPB'
                ? 'bg-purple-500/15 border-purple-500 ring-1 ring-purple-500/50'
                : 'bg-muted/40 border-border/80 hover:border-purple-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs mb-1">
              <span className="font-semibold">Ada No. FPB</span>
              <Link2 className="size-3.5" />
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {stats.withFpb.toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground">Terkoneksi e-FPB</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-3 md:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari No. Dokumen WO, No. FPB/MRP, Kapal / Armada, Project, Uraian, LKA, SPK..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            {(['ALL', 'Open', 'On Progress', 'Close'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {st === 'ALL' ? 'Semua Status' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-xs">
          {/* Departemen / Armada */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium block mb-1">
              Departemen / Armada:
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="ALL">Semua Departemen ({departmentList.length})</option>
              {departmentList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium block mb-1">
              Section:
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="ALL">Semua Section ({sectionList.length})</option>
              {sectionList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Prioritas */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium block mb-1">
              Prioritas (Urgency):
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="ALL">Semua Prioritas</option>
              {priorityList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Hubungan FPB */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium block mb-1">
              Status No. FPB:
            </label>
            <select
              value={fpbFilter}
              onChange={(e) => {
                setFpbFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary truncate"
            >
              <option value="ALL">Semua Data WO</option>
              <option value="WITH_FPB">Hanya dengan No. FPB ({stats.withFpb})</option>
              <option value="WITHOUT_FPB">
                Tanpa No. FPB ({(stats.total - stats.withFpb).toLocaleString('id-ID')})
              </option>
            </select>
          </div>
        </div>

        {/* Results summary info */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <div>
            Menampilkan <strong className="text-foreground">{sortedItems.length}</strong> dari{' '}
            <strong>{items.length}</strong> record Work Order
          </div>
          {(searchQuery ||
            statusFilter !== 'ALL' ||
            priorityFilter !== 'ALL' ||
            departmentFilter !== 'ALL' ||
            sectionFilter !== 'ALL' ||
            fpbFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setDepartmentFilter('ALL');
                setSectionFilter('ALL');
                setFpbFilter('ALL');
                setCurrentPage(1);
              }}
              className="text-primary hover:underline font-medium"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden relative">
        {/* Table Header Bar with Split / Freeze Panes Status & Controls */}
        <div className="py-2.5 px-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Freeze Panes Indicator Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Pin className="size-3 text-primary rotate-45" />
              <span>Header Terkunci (Split Scroll Aktif)</span>
              <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
            </div>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              Judul kolom tetap melayang di atas saat scroll ke bawah
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Height selector buttons */}
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

            {/* Quick Scroll To Top Button in toolbar */}
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
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md text-muted-foreground font-semibold border-b border-border select-none shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  No
                </th>
                <th
                  onClick={() => handleSort('nomerDokumen')}
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md group"
                  title="Klik untuk mengurutkan No. Dokumen"
                >
                  <div className="flex items-center gap-1 group-hover:bg-muted/60 px-1.5 py-0.5 -mx-1.5 rounded-md transition">
                    <span>No. Dokumen (WO)</span>
                    {sortField === 'nomerDokumen' ? (
                      <span className="text-[10px] font-bold text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('tanggalOrder')}
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md group"
                  title="Klik untuk mengurutkan Tanggal Order"
                >
                  <div className="flex items-center gap-1 group-hover:bg-muted/60 px-1.5 py-0.5 -mx-1.5 rounded-md transition">
                    <span>Tgl Order</span>
                    {sortField === 'tanggalOrder' ? (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                        {sortOrder === 'desc' ? '↓ Terbaru' : '↑ Terlama'}
                      </span>
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('departemenArmada')}
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition whitespace-nowrap min-w-[140px] sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md group"
                  title="Klik untuk mengurutkan Departemen / Armada"
                >
                  <div className="flex items-center gap-1 group-hover:bg-muted/60 px-1.5 py-0.5 -mx-1.5 rounded-md transition">
                    <span>Departemen / Armada</span>
                    {sortField === 'departemenArmada' ? (
                      <span className="text-[10px] font-bold text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 min-w-[130px] whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  Project &amp; Section
                </th>
                <th className="py-2.5 px-3 min-w-[200px] sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  Uraian Perbaikan
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  Prioritas
                </th>
                <th className="py-2.5 px-3 whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  No. FPB/MRP
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition whitespace-nowrap text-center sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md group"
                  title="Klik untuk mengurutkan Status"
                >
                  <div className="flex items-center justify-center gap-1 group-hover:bg-muted/60 px-1.5 py-0.5 -mx-1.5 rounded-md transition">
                    <span>Status / Progress</span>
                    {sortField === 'status' ? (
                      <span className="text-[10px] font-bold text-primary">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  Dokumen
                </th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap w-16 sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="font-medium text-sm">Menyinkronkan data Work Order dari Google Spreadsheet...</p>
                    <p className="text-xs">Mohon tunggu sebentar, memuat form response lengkap.</p>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="size-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    <p className="font-semibold text-sm text-foreground">Tidak Ada Data Work Order Ditemukan</p>
                    <p className="text-xs max-w-sm mx-auto mt-1">
                      Tidak ada record yang sesuai dengan filter atau kata kunci pencarian Anda. Coba reset filter atau sinkronkan data.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition group cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      {/* No */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
                        {globalIndex}
                      </td>

                      {/* No. Dokumen (WO) */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold text-foreground text-xs group-hover:text-primary transition-colors flex items-center gap-1">
                          <span>{item.nomerDokumen}</span>
                        </div>
                        {item.noLkaLkk && item.noLkaLkk !== '-' && (
                          <span className="text-[10px] text-muted-foreground block truncate">
                            LKA: {item.noLkaLkk}
                          </span>
                        )}
                      </td>

                      {/* Tanggal Order */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {item.tanggalOrder || '-'}
                      </td>

                      {/* Departemen / Armada */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground text-xs leading-tight">
                          {item.departemenArmada || '-'}
                        </div>
                        {item.lokasiPekerjaan && (
                          <span className="text-[10px] text-muted-foreground block truncate max-w-[160px]">
                            {item.lokasiPekerjaan}
                          </span>
                        )}
                      </td>

                      {/* Project & Section */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground text-xs leading-tight">
                          {item.namaProject || '-'}
                        </div>
                        {item.section && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/80">
                            {item.section}
                          </span>
                        )}
                      </td>

                      {/* Uraian Perbaikan */}
                      <td className="py-2.5 px-3 max-w-[260px]">
                        <p className="line-clamp-2 text-xs text-foreground/90 leading-relaxed" title={item.uraianPerbaikan}>
                          {item.uraianPerbaikan || '-'}
                        </p>
                        {item.evidence && (
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={getMtcServiceReportUrl(item.evidence)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25 hover:bg-orange-500/20 transition cursor-pointer"
                              title={`Buka PDF Service Report (${item.evidence}) langsung di MTC System`}
                            >
                              <FileText className="size-2.5 text-orange-600 dark:text-orange-400" />
                              <span>PDF SR: {item.evidence}</span>
                              <ExternalLink className="size-2 opacity-70" />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Prioritas */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.scalaPrioritas ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadgeClass(
                              item.scalaPrioritas
                            )}`}
                          >
                            {item.scalaPrioritas}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* No. FPB/MRP */}
                      <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {item.noFpbMrp ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenAudit) {
                                onOpenAudit(item.noFpbMrp);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 transition shadow-2xs group/fpb cursor-pointer"
                            title="Klik untuk melihat Audit e-FPB"
                          >
                            <Link2 className="size-2.5 text-purple-500 group-hover/fpb:scale-110" />
                            <span>{item.noFpbMrp}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60">-</span>
                        )}
                      </td>

                      {/* Status & Progress */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        {item.progress > 0 && (
                          <div className="w-16 bg-muted rounded-full h-1.5 mx-auto mt-1 overflow-hidden border border-border/60">
                            <div
                              className={`h-full transition-all duration-300 ${
                                item.progress === 100
                                  ? 'bg-emerald-500'
                                  : item.progress >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Dokumen Links */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {item.evidence && (
                            <a
                              href={getMtcServiceReportUrl(item.evidence)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Buka Evidence / Service Report (${item.evidence}) di MTC System`}
                              className="p-1 rounded text-orange-600 dark:text-orange-400 hover:bg-orange-500/15 transition cursor-pointer"
                            >
                              <Wrench className="size-3.5" />
                            </a>
                          )}
                          {item.uploadSoWoUrl && (
                            <a
                              href={item.uploadSoWoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka File SO/WO di Google Drive"
                              className="p-1 rounded text-blue-600 hover:bg-blue-500/10 transition cursor-pointer"
                            >
                              <FileText className="size-3.5" />
                            </a>
                          )}
                          {item.bastUrl && (
                            <a
                              href={item.bastUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Buka Berita Acara BAST di Google Drive"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 transition cursor-pointer"
                            >
                              <CheckCircle2 className="size-3.5" />
                            </a>
                          )}
                          {!item.uploadSoWoUrl && !item.bastUrl && !item.evidence && (
                            <span className="text-muted-foreground/40 text-[10px]">-</span>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          title="Lihat Detail Lengkap Work Order"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                        >
                          <Eye className="size-3.5" />
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
            className="absolute bottom-16 right-5 z-30 shadow-lg bg-foreground text-background hover:bg-foreground/90 font-semibold text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200 border border-border/40 shadow-primary/10"
            title="Kembali ke baris pertama tabel"
          >
            <ChevronUp className="size-3.5" />
            <span>Kembali ke Atas</span>
          </button>
        )}

        {/* Pagination Bar */}
        {sortedItems.length > 0 && (
          <div className="py-3 px-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-muted/20">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 rounded-md border border-border bg-background text-foreground text-xs focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>
                Halaman <strong className="text-foreground">{currentPage}</strong> dari{' '}
                <strong className="text-foreground">{totalPages}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pNum = idx + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pNum = currentPage - 3 + idx;
                    if (pNum > totalPages) pNum = totalPages - (4 - idx);
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`min-w-7 h-7 px-2 rounded-md text-xs font-medium transition ${
                        currentPage === pNum
                          ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                          : 'border border-border bg-background hover:bg-muted text-foreground'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 printable-modal-overlay"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto printable-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm md:text-base font-bold text-foreground">
                    {selectedItem.nomerDokumen}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadgeClass(
                      selectedItem.status
                    )}`}
                  >
                    {selectedItem.status}
                  </span>
                  {selectedItem.scalaPrioritas && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getPriorityBadgeClass(
                        selectedItem.scalaPrioritas
                      )}`}
                    >
                      {selectedItem.scalaPrioritas}
                    </span>
                  )}
                  {selectedItem.progress > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                      {selectedItem.progress}% Selesai
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Timestamp Input: {selectedItem.timestamp || '-'} &bull; Google Sheets
                </p>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Uraian Singkat Box */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
                  Uraian Singkat Permintaan Perbaikan:
                </span>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">
                  {selectedItem.uraianPerbaikan || 'Tidak ada deskripsi perbaikan.'}
                </p>
              </div>

              {/* Grid Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Departemen / Armada */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Departemen / Armada</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {selectedItem.departemenArmada || '-'}
                  </span>
                </div>

                {/* Nama Project */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Nama Project</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {selectedItem.namaProject || '-'}
                  </span>
                </div>

                {/* Section */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Section</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {selectedItem.section || '-'}
                  </span>
                </div>

                {/* Lokasi Pekerjaan */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Lokasi Pekerjaan</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block">
                    {selectedItem.lokasiPekerjaan || '-'}
                  </span>
                </div>

                {/* Tanggal Order */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Tanggal Order</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.tanggalOrder || '-'}
                  </span>
                </div>

                {/* Tanggal Mulai */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Tanggal Mulai Pekerjaan</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.tanggalMulai || '-'}
                  </span>
                </div>

                {/* Tanggal Selesai */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Tanggal Selesai Pekerjaan</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.tanggalSelesai || '-'}
                  </span>
                </div>

                {/* No LKA / LKK */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">No. LKA / LKK</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.noLkaLkk || '-'}
                  </span>
                </div>

                {/* SPK */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">SPK</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.spk || '-'}
                  </span>
                </div>

                {/* Evidence (SR & Foto) */}
                <div className={`p-3 rounded-lg border ${selectedItem.evidence ? 'border-orange-500/30 bg-orange-500/5' : 'border-border bg-card'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground block font-medium">Evidence (SR &amp; Foto)</span>
                    {selectedItem.evidence && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                        MTC System
                      </span>
                    )}
                  </div>
                  {selectedItem.evidence ? (
                    <>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="font-mono font-bold text-foreground text-xs truncate" title={selectedItem.evidence}>
                          {selectedItem.evidence}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(selectedItem.evidence, 'Nomor Evidence SR')}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                            title="Salin Nomor SR"
                          >
                            {copiedText === 'Nomor Evidence SR' ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                          <a
                            href={getMtcServiceReportUrl(selectedItem.evidence)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-600 hover:bg-orange-700 text-white transition shadow-2xs cursor-pointer"
                            title={`Buka PDF ${selectedItem.evidence} langsung di MTC System (Login: guest / 0123)`}
                          >
                            <FileText className="size-2.5" />
                            <span>Buka PDF MTC</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        </div>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-orange-500/15 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Login MTC: <strong className="font-mono text-foreground font-semibold">guest</strong> / <strong className="font-mono text-foreground font-semibold">0123</strong></span>
                        <button
                          type="button"
                          onClick={() => handleCopy('guest:0123', 'Akun Login MTC')}
                          className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                          title="Salin user & password MTC"
                        >
                          {copiedText === 'Akun Login MTC' ? 'Tersalin!' : 'Salin Akun'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="font-mono text-muted-foreground text-xs mt-0.5 block">-</span>
                  )}
                </div>

                {/* Tanggal MRP/FPB */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">Tanggal MRP / FPB</span>
                  <span className="font-mono font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.tanggalMrpFpb || '-'}
                  </span>
                </div>

                {/* GAP Analysis */}
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-[10px] text-muted-foreground block">GAP Analysis</span>
                  <span className="font-medium text-foreground text-xs mt-0.5 block">
                    {selectedItem.gapAnalysis || '-'}
                  </span>
                </div>
              </div>

              {/* Integrasi dengan e-FPB */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-foreground text-xs">
                      Integrasi Nomor FPB (e-FPB Procurement)
                    </span>
                  </div>
                  {selectedItem.noFpbMrp && onOpenAudit && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAudit(selectedItem.noFpbMrp);
                        setSelectedItem(null);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>Buka Audit FPB</span>
                      <ExternalLink className="size-3" />
                    </button>
                  )}
                </div>

                {selectedItem.noFpbMrp ? (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-muted-foreground text-xs">Nomor FPB Terkait:</span>
                    <span className="font-mono font-bold text-sm text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {selectedItem.noFpbMrp}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedItem.noFpbMrp, 'Nomor FPB')}
                      className="p-1 rounded text-muted-foreground hover:text-foreground"
                      title="Salin Nomor FPB"
                    >
                      {copiedText === 'Nomor FPB' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Work order ini belum mencantumkan No. FPB / MRP di Google Spreadsheet.
                  </p>
                )}
              </div>

              {/* Lampiran Dokumen */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                <span className="font-semibold text-foreground text-xs block">
                  Tautan Lampiran Dokumen &amp; Google Drive:
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedItem.evidence && (
                    <a
                      href={getMtcServiceReportUrl(selectedItem.evidence)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/30 hover:bg-orange-500/20 transition cursor-pointer"
                      title={`Buka Service Report (${selectedItem.evidence}) di MTC System`}
                    >
                      <FileText className="size-3.5 text-orange-600 dark:text-orange-400" />
                      <span>Buka PDF Evidence MTC ({selectedItem.evidence})</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}

                  {selectedItem.uploadSoWoUrl ? (
                    <a
                      href={selectedItem.uploadSoWoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition cursor-pointer"
                    >
                      <FileText className="size-3.5" />
                      <span>Buka Dokumen SO / WO (Drive)</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs py-1">SO/WO: Tidak ada link</span>
                  )}

                  {selectedItem.bastUrl ? (
                    <a
                      href={selectedItem.bastUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Buka Berita Acara BAST (Drive)</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  ) : null}

                  {selectedItem.efpbPdfUrl && selectedItem.efpbPdfUrl.includes('.pdf') && (
                    <a
                      href={selectedItem.efpbPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition cursor-pointer"
                    >
                      <FileText className="size-3.5" />
                      <span>Buka PDF e-FPB</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 md:p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                ID Record: <span className="font-mono">{selectedItem.id}</span>
              </span>
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
                  onClick={() => setSelectedItem(null)}
                  className="h-8 px-4 rounded-lg text-xs font-bold tracking-wide bg-foreground text-background transition cursor-pointer print:hidden"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

