'use client';

import React, { useState, useMemo } from 'react';
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Ship,
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  ExternalLink,
  ShieldAlert,
  X,
  RotateCcw,
  Tag,
  Zap,
} from 'lucide-react';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { formatDateDdMmYy } from '@/utils/formatDate';

interface SisaLayananSlaSubTabProps {
  items: SisaLayananItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Badge warna untuk entitas PT
const PT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CPL: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  HL: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  MIL: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  GAJ: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  MO: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  MOI: { bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/20', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-500/30' },
  SP: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
  SS: { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
};

// Helper parse date ke timestamp UTC secara akurat
function parseDateToTimestamp(val?: string | number | null): number | null {
  if (!val || val === '-' || val === '/') return null;
  if (typeof val === 'number') {
    // Excel serial date
    return (val - 25569) * 86400 * 1000;
  }
  const str = String(val).trim();
  const formatted = formatDateDdMmYy(str);
  if (!formatted || formatted === '-') return null;

  const parts = formatted.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month, day)).getTime();
  }
  return null;
}

// Hitung selisih hari antara dua tanggal
function calcDaysDiff(dateFrom?: string | null, dateTo?: string | null): number | null {
  const t1 = parseDateToTimestamp(dateFrom);
  const t2 = parseDateToTimestamp(dateTo);
  if (t1 === null || t2 === null) return null;
  const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

// Hitung umur tunggu (aging) dari FPB hingga hari ini untuk barang yang belum CLOSE
function calcAgingDays(dateFpb?: string | null): number {
  const tFpb = parseDateToTimestamp(dateFpb);
  if (!tFpb) return 0;
  const now = new Date().getTime();
  const diff = Math.round((now - tFpb) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function SisaLayananSlaSubTab({
  items,
  onOpenAudit,
  showToast,
}: SisaLayananSlaSubTabProps) {
  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPt, setFilterPt] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterAgingBucket, setFilterAgingBucket] = useState<string>('ALL');
  const [rankView, setRankView] = useState<'armada' | 'pt' | 'kategori'>('armada');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [sortField, setSortField] = useState<'tglFpb' | 'leadTime' | 'aging' | 'noFpb' | 'departement'>('tglFpb');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Kategori unik dari data
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.kategori && it.kategori !== '-') set.add(it.kategori.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Ekstraksi data metrik SLA per item
  const enrichedItems = useMemo(() => {
    return items.map((it) => {
      const ltPurchasing = calcDaysDiff(it.tglFpb, it.tglPo);
      const ltVendor = calcDaysDiff(it.tglPo, it.tglFstb);
      const ltLogistik = calcDaysDiff(it.tglFstb, it.tglTtb);
      const totalLeadTime = calcDaysDiff(it.tglFpb, it.tglTtb);
      const agingDays = it.status !== 'CLOSE' ? calcAgingDays(it.tglFpb) : 0;

      let agingBucket: '<7' | '8-14' | '15-30' | '>30' | '>60' = '<7';
      if (agingDays > 60) agingBucket = '>60';
      else if (agingDays > 30) agingBucket = '>30';
      else if (agingDays >= 15) agingBucket = '15-30';
      else if (agingDays >= 8) agingBucket = '8-14';

      return {
        ...it,
        ltPurchasing,
        ltVendor,
        ltLogistik,
        totalLeadTime,
        agingDays,
        agingBucket,
      };
    });
  }, [items]);

  // Global KPI Metrics Summary
  const metrics = useMemo(() => {
    let sumTotalLt = 0;
    let countTotalLt = 0;
    let sumPurchasingLt = 0;
    let countPurchasingLt = 0;
    let sumVendorLt = 0;
    let countVendorLt = 0;
    let sumLogistikLt = 0;
    let countLogistikLt = 0;

    let totalClose = 0;
    let totalOpen = 0;
    let totalBelumTtb = 0;
    let totalKurang = 0;

    let agingUnder7 = 0;
    let aging8to14 = 0;
    let aging15to30 = 0;
    let agingOver30 = 0;
    let agingOver60 = 0;

    let p1Total = 0;
    let p1Close = 0;

    enrichedItems.forEach((it) => {
      const st = (it.status || '').toUpperCase();
      if (st === 'CLOSE') totalClose++;
      else if (st === 'OPEN') totalOpen++;
      else if (st === 'BELUM TTB') totalBelumTtb++;
      else if (st === 'KURANG') totalKurang++;

      if (it.totalLeadTime !== null) {
        sumTotalLt += it.totalLeadTime;
        countTotalLt++;
      }
      if (it.ltPurchasing !== null) {
        sumPurchasingLt += it.ltPurchasing;
        countPurchasingLt++;
      }
      if (it.ltVendor !== null) {
        sumVendorLt += it.ltVendor;
        countVendorLt++;
      }
      if (it.ltLogistik !== null) {
        sumLogistikLt += it.ltLogistik;
        countLogistikLt++;
      }

      if (st !== 'CLOSE') {
        if (it.agingDays > 60) agingOver60++;
        else if (it.agingDays > 30) agingOver30++;
        else if (it.agingDays >= 15) aging15to30++;
        else if (it.agingDays >= 8) aging8to14++;
        else agingUnder7++;
      }

      if ((it.priority || '').toUpperCase().includes('P1')) {
        p1Total++;
        if (st === 'CLOSE') p1Close++;
      }
    });

    const totalCount = enrichedItems.length;
    const fulfillmentRate = totalCount > 0 ? (totalClose / totalCount) * 100 : 0;
    const avgTotalLt = countTotalLt > 0 ? sumTotalLt / countTotalLt : 0;
    const avgPurchasingLt = countPurchasingLt > 0 ? sumPurchasingLt / countPurchasingLt : 0;
    const avgVendorLt = countVendorLt > 0 ? sumVendorLt / countVendorLt : 0;
    const avgLogistikLt = countLogistikLt > 0 ? sumLogistikLt / countLogistikLt : 0;
    const p1FulfillmentRate = p1Total > 0 ? (p1Close / p1Total) * 100 : 0;

    return {
      totalCount,
      totalClose,
      totalOpen,
      totalBelumTtb,
      totalKurang,
      fulfillmentRate,
      avgTotalLt,
      avgPurchasingLt,
      avgVendorLt,
      avgLogistikLt,
      countTotalLt,
      agingUnder7,
      aging8to14,
      aging15to30,
      agingOver30,
      agingOver60,
      totalPending: totalOpen + totalBelumTtb + totalKurang,
      p1Total,
      p1Close,
      p1FulfillmentRate,
    };
  }, [enrichedItems]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    let result = enrichedItems;

    if (filterPt !== 'ALL') {
      result = result.filter((it) => (it.pt || '').toUpperCase() === filterPt);
    }
    if (filterStatus !== 'ALL') {
      result = result.filter((it) => (it.status || '').toUpperCase() === filterStatus);
    }
    if (filterPriority !== 'ALL') {
      result = result.filter((it) => (it.priority || '').toUpperCase().includes(filterPriority));
    }
    if (filterCategory !== 'ALL') {
      result = result.filter((it) => (it.kategori || '').toLowerCase() === filterCategory.toLowerCase());
    }
    if (filterAgingBucket !== 'ALL') {
      result = result.filter((it) => it.status !== 'CLOSE' && it.agingBucket === filterAgingBucket);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          (it.noFpb || '').toLowerCase().includes(q) ||
          (it.noPo || '').toLowerCase().includes(q) ||
          (it.noTtb || '').toLowerCase().includes(q) ||
          (it.departement || '').toLowerCase().includes(q) ||
          (it.namaBarang || '').toLowerCase().includes(q) ||
          (it.kodeBarang || '').toLowerCase().includes(q) ||
          (it.keterangan || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'tglFpb') {
        valA = parseDateToTimestamp(a.tglFpb) || 0;
        valB = parseDateToTimestamp(b.tglFpb) || 0;
      } else if (sortField === 'leadTime') {
        valA = a.totalLeadTime !== null ? a.totalLeadTime : -1;
        valB = b.totalLeadTime !== null ? b.totalLeadTime : -1;
      } else if (sortField === 'aging') {
        valA = a.agingDays;
        valB = b.agingDays;
      } else if (sortField === 'noFpb') {
        valA = a.noFpb || '';
        valB = b.noFpb || '';
      } else if (sortField === 'departement') {
        valA = a.departement || '';
        valB = b.departement || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    enrichedItems,
    filterPt,
    filterStatus,
    filterPriority,
    filterCategory,
    filterAgingBucket,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Peringkat Groupings (Armada / PT / Kategori)
  const rankingData = useMemo(() => {
    const map: Record<string, { total: number; close: number; open: number; belumTtb: number; sumLt: number; countLt: number }> = {};

    enrichedItems.forEach((it) => {
      let groupKey = it.departement || 'Lainnya';
      if (rankView === 'pt') groupKey = it.pt || 'OTHER';
      if (rankView === 'kategori') groupKey = it.kategori || 'General';

      if (!map[groupKey]) {
        map[groupKey] = { total: 0, close: 0, open: 0, belumTtb: 0, sumLt: 0, countLt: 0 };
      }
      map[groupKey].total++;
      if (it.status === 'CLOSE') map[groupKey].close++;
      if (it.status === 'OPEN') map[groupKey].open++;
      if (it.status === 'BELUM TTB') map[groupKey].belumTtb++;

      if (it.totalLeadTime !== null) {
        map[groupKey].sumLt += it.totalLeadTime;
        map[groupKey].countLt++;
      }
    });

    const list = Object.entries(map).map(([name, data]) => {
      const fulfillmentRate = data.total > 0 ? (data.close / data.total) * 100 : 0;
      const avgLeadTime = data.countLt > 0 ? data.sumLt / data.countLt : null;
      return {
        name,
        total: data.total,
        close: data.close,
        open: data.open,
        belumTtb: data.belumTtb,
        fulfillmentRate,
        avgLeadTime,
      };
    });

    list.sort((a, b) => b.total - a.total);
    return list;
  }, [enrichedItems, rankView]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Handle Export CSV
  const handleExportCsv = () => {
    const headers = [
      'No',
      'PT',
      'No FPB',
      'Tgl FPB',
      'No PO',
      'Tgl PO',
      'No FSTB',
      'Tgl FSTB',
      'No TTB',
      'Tgl TTB',
      'Kode Barang',
      'Nama Barang',
      'Jml FPB',
      'Jml TTB',
      'Satuan',
      'Status',
      'Priority',
      'Departement / Armada',
      'Kategori',
      'Lead Time (Hari)',
      'Aging Tunggu (Hari)',
      'Keterangan',
    ];

    const rows = filteredItems.map((it, idx) => [
      idx + 1,
      it.pt || '',
      `"${it.noFpb || ''}"`,
      it.tglFpb || '',
      `"${it.noPo || ''}"`,
      it.tglPo || '',
      `"${it.noFstb || ''}"`,
      it.tglFstb || '',
      `"${it.noTtb || ''}"`,
      it.tglTtb || '',
      `"${it.kodeBarang || ''}"`,
      `"${(it.namaBarang || '').replace(/"/g, '""')}"`,
      it.jmlFpb || 0,
      it.jmlTtb || 0,
      it.satuan || '',
      it.status || '',
      it.priority || '',
      `"${it.departement || ''}"`,
      `"${it.kategori || ''}"`,
      it.totalLeadTime !== null ? it.totalLeadTime : '',
      it.status !== 'CLOSE' ? it.agingDays : '',
      `"${(it.keterangan || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analisa_SLA_Sisa_Layanan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast?.('✓ Laporan SLA Sisa Layanan berhasil diexport ke CSV!', 'success');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterPt('ALL');
    setFilterStatus('ALL');
    setFilterPriority('ALL');
    setFilterCategory('ALL');
    setFilterAgingBucket('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Clock className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Analisis SLA &amp; Lead Time Sisa Layanan (Database Gabungan)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-mono">
                {items.length.toLocaleString('id-ID')} Total Permintaan
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              Pelacakan Service Level Agreement (SLA) berdasarkan 4 milestone resmi: <strong>Tgl FPB</strong> (Permintaan Kapal) ➔ <strong>Tgl PO</strong> (Purchasing) ➔ <strong>Tgl FSTB</strong> (Kedatangan Gudang) ➔ <strong>Tgl TTB</strong> (Serah Terima Kapal), analisis umur tunggu (aging), dan mitigasi kemacetan logistik.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 hover:bg-muted text-xs font-semibold text-foreground transition cursor-pointer border border-border"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Lead Time End-to-End */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Lead Time End-to-End</span>
            <Clock className="size-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {metrics.avgTotalLt.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Hari</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>Siklus FPB ➔ TTB</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics.countTotalLt.toLocaleString('id-ID')} item terukur
            </span>
          </div>
        </div>

        {/* KPI 2: Fulfillment Rate */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Fulfillment Rate</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.fulfillmentRate.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Selesai (CLOSE)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>{metrics.totalClose.toLocaleString('id-ID')} / {metrics.totalCount.toLocaleString('id-ID')} item</span>
            <span className="font-semibold text-foreground">Target: &gt;80%</span>
          </div>
        </div>

        {/* KPI 3: Tahap 1 Purchasing (FPB -> PO) */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">1. Lead Time Purchasing</span>
            <Building2 className="size-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {metrics.avgPurchasingLt.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Hari</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>FPB ➔ PO Terbit</span>
            <span className="font-semibold text-foreground">SLA: &le; 5 Hari</span>
          </div>
        </div>

        {/* KPI 4: Tahap 2 Vendor Delivery (PO -> FSTB) */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">2. Vendor Delivery</span>
            <Truck className="size-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {metrics.avgVendorLt.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Hari</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>PO ➔ Tiba Gudang</span>
            <span className="font-semibold text-foreground">SLA: &le; 7 Hari</span>
          </div>
        </div>

        {/* KPI 5: Tahap 3 Logistik Gudang (FSTB -> TTB) */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">3. Serah Terima Kapal</span>
            <Package className="size-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
              {metrics.avgLogistikLt.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Hari</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>Gudang ➔ TTB Kapal</span>
            <span className="font-semibold text-foreground">SLA: &le; 2 Hari</span>
          </div>
        </div>
      </div>

      {/* 3. Aging Analysis & Bottleneck Alert Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Kolom Kiri: Aging Umur Tunggu Permintaan Terbuka */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <span>Distribusi Umur Tunggu Barang Belum Selesai (Aging Analysis)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total {metrics.totalPending.toLocaleString('id-ID')} item masih dalam proses (OPEN, BELUM TTB, KURANG). Klik kotak untuk memfilter tabel di bawah.
              </p>
            </div>
            {filterAgingBucket !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterAgingBucket('ALL')}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <X className="size-3" /> Reset Filter Aging
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Bucket 1: < 7 Hari */}
            <button
              type="button"
              onClick={() => setFilterAgingBucket(filterAgingBucket === '<7' ? 'ALL' : '<7')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterAgingBucket === '<7'
                  ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                🟢 &lt; 7 Hari
              </div>
              <div className="text-xl font-bold text-foreground font-mono mt-1">
                {metrics.agingUnder7.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Aman / Baru Masuk</div>
            </button>

            {/* Bucket 2: 8 - 14 Hari */}
            <button
              type="button"
              onClick={() => setFilterAgingBucket(filterAgingBucket === '8-14' ? 'ALL' : '8-14')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterAgingBucket === '8-14'
                  ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                🔵 8 - 14 Hari
              </div>
              <div className="text-xl font-bold text-foreground font-mono mt-1">
                {metrics.aging8to14.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Dalam Pantauan</div>
            </button>

            {/* Bucket 3: 15 - 30 Hari */}
            <button
              type="button"
              onClick={() => setFilterAgingBucket(filterAgingBucket === '15-30' ? 'ALL' : '15-30')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterAgingBucket === '15-30'
                  ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                🟡 15 - 30 Hari
              </div>
              <div className="text-xl font-bold text-foreground font-mono mt-1">
                {metrics.aging15to30.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Mulai Kritis</div>
            </button>

            {/* Bucket 4: > 30 Hari */}
            <button
              type="button"
              onClick={() => setFilterAgingBucket(filterAgingBucket === '>30' ? 'ALL' : '>30')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterAgingBucket === '>30'
                  ? 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-500/30'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                🔴 31 - 60 Hari
              </div>
              <div className="text-xl font-bold text-foreground font-mono mt-1">
                {metrics.agingOver30.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Overdue SLA</div>
            </button>

            {/* Bucket 5: > 60 Hari */}
            <button
              type="button"
              onClick={() => setFilterAgingBucket(filterAgingBucket === '>60' ? 'ALL' : '>60')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                filterAgingBucket === '>60'
                  ? 'border-purple-500 bg-purple-500/15 ring-2 ring-purple-500/30'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                🟣 &gt; 60 Hari
              </div>
              <div className="text-xl font-bold text-foreground font-mono mt-1">
                {metrics.agingOver60.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Macet Kronis</div>
            </button>
          </div>
        </div>

        {/* Kolom Kanan: Peringatan Bottleneck Utama */}
        <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3.5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="size-4 text-rose-500" />
              <span>Titik Kritis &amp; Bottleneck Pengadaan</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Area yang membutuhkan atensi khusus operasional logistik:
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Alert 1: Barang tertahan di gudang */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
              <Package className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground">
                  {metrics.totalBelumTtb.toLocaleString('id-ID')} Item Tertahan di Gudang (BELUM TTB)
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  FSTB sudah diterima di gudang tetapi fisik barang belum diserahkan ke tim lapangan / kapal.
                </p>
              </div>
            </div>

            {/* Alert 2: Permintaan belum diproses purchasing */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5">
              <Building2 className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground">
                  {metrics.totalOpen.toLocaleString('id-ID')} Item Belum Ada PO (OPEN)
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Permintaan kapal masih menunggu penerbitan PO ke supplier atau tender pengadaan.
                </p>
              </div>
            </div>

            {/* Alert 3: Prioritas P1 Darurat */}
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-2.5">
              <Zap className="size-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground">
                  Prioritas P1 (Darurat): {metrics.p1FulfillmentRate.toFixed(1)}% Terpenuhi
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {metrics.p1Close} dari {metrics.p1Total} item darurat kapal telah selesai diserahterimakan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Peringkat Breakdown Switcher */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        {/* Baris 1: Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari No. FPB, PO, TTB, Armada Kapal, atau Nama Barang..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Filter PT */}
            <select
              value={filterPt}
              onChange={(e) => {
                setFilterPt(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background font-medium text-xs focus:outline-none"
            >
              <option value="ALL">Semua PT</option>
              {['CPL', 'HL', 'MIL', 'GAJ', 'MO', 'MOI', 'SP', 'SS'].map((pt) => (
                <option key={pt} value={pt}>
                  PT {pt}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background font-medium text-xs focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="CLOSE">CLOSE (Selesai)</option>
              <option value="OPEN">OPEN (Menunggu PO)</option>
              <option value="BELUM TTB">BELUM TTB (Di Gudang)</option>
              <option value="KURANG">KURANG (Sebagian)</option>
            </select>

            {/* Filter Priority */}
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background font-medium text-xs focus:outline-none"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="P1">P1 (Darurat)</option>
              <option value="P2">P2 (Penting)</option>
              <option value="P3">P3 (Rutin)</option>
            </select>

            {/* Filter Category */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background font-medium text-xs focus:outline-none max-w-[140px]"
            >
              <option value="ALL">Semua Kategori</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {(filterPt !== 'ALL' ||
              filterStatus !== 'ALL' ||
              filterPriority !== 'ALL' ||
              filterCategory !== 'ALL' ||
              filterAgingBucket !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1 font-semibold"
                title="Reset Semua Filter"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Baris 2: Ranking Sub-view Switcher Tabs */}
        <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">Peringkat &amp; Komparasi SLA:</span>
            <div className="inline-flex rounded-lg bg-muted p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setRankView('armada')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  rankView === 'armada'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🚢 Per Armada Kapal
              </button>
              <button
                type="button"
                onClick={() => setRankView('pt')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  rankView === 'pt'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🏢 Per Entitas PT
              </button>
              <button
                type="button"
                onClick={() => setRankView('kategori')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  rankView === 'kategori'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                📦 Per Kategori Barang
              </button>
            </div>
          </div>

          <span className="text-muted-foreground font-mono">
            Menampilkan <strong>{filteredItems.length.toLocaleString('id-ID')}</strong> dari{' '}
            <strong>{items.length.toLocaleString('id-ID')}</strong> item
          </span>
        </div>

        {/* Peringkat Top 6 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2">
          {rankingData.slice(0, 6).map((r, idx) => (
            <div
              key={r.name}
              className="p-3 rounded-xl border border-border bg-muted/20 hover:border-primary/40 transition flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>#{idx + 1}</span>
                  <span>{r.total.toLocaleString('id-ID')} item</span>
                </div>
                <div className="text-xs font-bold text-foreground truncate mt-0.5" title={r.name}>
                  {r.name}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">% Selesai:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {r.fulfillmentRate.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, r.fulfillmentRate)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <span>Lead Time:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {r.avgLeadTime !== null ? `${r.avgLeadTime.toFixed(1)} hr` : '-'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Detail Transaction SLA Table */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-purple-500" />
            <h3 className="text-sm font-bold text-foreground">
              Tabel Rincian Transaksi &amp; Perhitungan Lead Time SLA
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-border bg-background text-xs font-medium cursor-pointer"
            >
              {[15, 25, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3">PT</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortField === 'departement') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('departement');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Armada / Unit</span>
                    <ArrowUpDown className="size-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortField === 'noFpb') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('noFpb');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>No. FPB</span>
                    <ArrowUpDown className="size-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Barang &amp; Kategori</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Prio</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortField === 'tglFpb') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('tglFpb');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Timeline (FPB ➔ TTB)</span>
                    <ArrowUpDown className="size-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortField === 'leadTime') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('leadTime');
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Lead Time</span>
                    <ArrowUpDown className="size-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-center cursor-pointer hover:text-foreground"
                  onClick={() => {
                    if (sortField === 'aging') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('aging');
                      setSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Umur Tunggu</span>
                    <ArrowUpDown className="size-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <Package className="size-10 mx-auto text-muted-foreground/40 stroke-1 mb-2" />
                    <p className="font-medium">Tidak ada data transaksi yang cocok dengan filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((it, idx) => {
                  const ptColor = PT_COLORS[it.pt] || PT_COLORS.CPL;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  // Status badge style
                  let statusBadge = 'bg-muted text-muted-foreground';
                  if (it.status === 'CLOSE') statusBadge = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                  else if (it.status === 'OPEN') statusBadge = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
                  else if (it.status === 'BELUM TTB') statusBadge = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                  else if (it.status === 'KURANG') statusBadge = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';

                  // Lead time badge style
                  let ltColor = 'bg-muted text-muted-foreground';
                  if (it.totalLeadTime !== null) {
                    if (it.totalLeadTime <= 7) ltColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold';
                    else if (it.totalLeadTime <= 14) ltColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold';
                    else if (it.totalLeadTime <= 30) ltColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold';
                    else ltColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold';
                  }

                  return (
                    <tr key={`${it.id}-${idx}`} className="hover:bg-muted/30 transition">
                      {/* No */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* PT */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ptColor.bg} ${ptColor.text} ${ptColor.border}`}>
                          {it.pt || 'CPL'}
                        </span>
                      </td>

                      {/* Departement / Armada */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Ship className="size-3 text-muted-foreground" />
                          <span>{it.departement || '-'}</span>
                        </div>
                      </td>

                      {/* No. FPB */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary">{it.noFpb}</span>
                          {onOpenAudit && (
                            <button
                              type="button"
                              onClick={() => onOpenAudit(it.noFpb, it.noPo)}
                              className="text-muted-foreground hover:text-primary transition cursor-pointer"
                              title="Audit alur berkas"
                            >
                              <ExternalLink className="size-3" />
                            </button>
                          )}
                        </div>
                        {it.noPo && (
                          <div className="text-[10px] text-muted-foreground">PO: {it.noPo}</div>
                        )}
                        {it.noTtb && (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">TTB: {it.noTtb}</div>
                        )}
                      </td>

                      {/* Barang */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="font-semibold text-foreground truncate" title={it.namaBarang}>
                          {it.namaBarang}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span className="font-mono">{it.kodeBarang || '-'}</span>
                          {it.kategori && (
                            <span className="px-1 py-0.2 rounded bg-muted text-[9px]">
                              {it.kategori}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge}`}>
                          {it.status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-muted text-muted-foreground">
                          {it.priority || 'P3'}
                        </span>
                      </td>

                      {/* Timeline Milestone */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px] font-mono text-muted-foreground">
                        <div className="flex items-center gap-1 text-foreground">
                          <span>FPB: {it.tglFpb || '-'}</span>
                          <span className="text-muted-foreground">➔</span>
                          <span>TTB: {it.tglTtb || (it.status === 'CLOSE' ? it.tglFpb : '-')}</span>
                        </div>
                        {it.tglPo && (
                          <div className="text-[10px] text-muted-foreground">PO: {it.tglPo} | FSTB: {it.tglFstb || '-'}</div>
                        )}
                      </td>

                      {/* Lead Time */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {it.totalLeadTime !== null ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${ltColor}`}>
                            {it.totalLeadTime} Hari
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">-</span>
                        )}
                      </td>

                      {/* Umur Tunggu (Aging) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {it.status !== 'CLOSE' ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              it.agingDays > 30
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : it.agingDays >= 15
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {it.agingDays} Hari
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            ✓ Selesai
                          </span>
                        )}
                      </td>

                      {/* Keterangan */}
                      <td className="py-2.5 px-3 max-w-[180px] text-muted-foreground truncate" title={it.keterangan}>
                        {it.keterangan || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Menampilkan baris <strong>{filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> sampai{' '}
            <strong>{Math.min(currentPage * pageSize, filteredItems.length)}</strong> dari{' '}
            <strong>{filteredItems.length.toLocaleString('id-ID')}</strong> baris data
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-mono px-2 font-semibold text-foreground">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
