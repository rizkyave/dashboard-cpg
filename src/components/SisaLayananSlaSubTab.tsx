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
  Copy,
  Check,
  FileText,
  Lightbulb,
  ShieldCheck,
  Target,
  Boxes,
  PieChart,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { formatDateDdMmYy, extractDateInfo } from '@/utils/formatDate';

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
  const info = extractDateInfo(str);
  if (info && info.timestamp > 0) {
    return info.timestamp;
  }

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

  // Interactive Chart & Memo States
  const [activeVisualTab, setActiveVisualTab] = useState<'stages' | 'aging' | 'monthly' | 'pareto'>('stages');
  const [isMemoCopied, setIsMemoCopied] = useState<boolean>(false);
  const [isMemoOpen, setIsMemoOpen] = useState<boolean>(false);

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

      // Ekstraksi bulan FPB untuk visualisasi tren bulanan
      const tFpb = parseDateToTimestamp(it.tglFpb);
      let monthIndex = -1;
      if (tFpb) {
        const d = new Date(tFpb);
        monthIndex = d.getUTCMonth(); // 0..11
      }

      return {
        ...it,
        ltPurchasing,
        ltVendor,
        ltLogistik,
        totalLeadTime,
        agingDays,
        agingBucket,
        monthIndex,
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

  // Analisis Siklus 3 Tahap per Entitas PT
  const ptStagesList = useMemo(() => {
    const pts = ['CPL', 'HL', 'MO', 'GAJ', 'SP', 'MOI', 'SS', 'MIL'];
    const map: Record<
      string,
      {
        total: number;
        close: number;
        sumPch: number;
        countPch: number;
        sumVen: number;
        countVen: number;
        sumLog: number;
        countLog: number;
        sumTot: number;
        countTot: number;
      }
    > = {};

    pts.forEach((p) => {
      map[p] = {
        total: 0,
        close: 0,
        sumPch: 0,
        countPch: 0,
        sumVen: 0,
        countVen: 0,
        sumLog: 0,
        countLog: 0,
        sumTot: 0,
        countTot: 0,
      };
    });

    enrichedItems.forEach((it) => {
      const p = (it.pt || 'CPL').toUpperCase();
      if (!map[p]) {
        map[p] = {
          total: 0,
          close: 0,
          sumPch: 0,
          countPch: 0,
          sumVen: 0,
          countVen: 0,
          sumLog: 0,
          countLog: 0,
          sumTot: 0,
          countTot: 0,
        };
      }
      map[p].total++;
      if (it.status === 'CLOSE') map[p].close++;

      if (it.ltPurchasing !== null) {
        map[p].sumPch += it.ltPurchasing;
        map[p].countPch++;
      }
      if (it.ltVendor !== null) {
        map[p].sumVen += it.ltVendor;
        map[p].countVen++;
      }
      if (it.ltLogistik !== null) {
        map[p].sumLog += it.ltLogistik;
        map[p].countLog++;
      }
      if (it.totalLeadTime !== null) {
        map[p].sumTot += it.totalLeadTime;
        map[p].countTot++;
      }
    });

    return Object.entries(map)
      .map(([pt, d]) => {
        const avgPch = d.countPch > 0 ? d.sumPch / d.countPch : 0;
        const avgVen = d.countVen > 0 ? d.sumVen / d.countVen : 0;
        const avgLog = d.countLog > 0 ? d.sumLog / d.countLog : 0;
        const avgTot = d.countTot > 0 ? d.sumTot / d.countTot : avgPch + avgVen + avgLog;
        const fulfillmentRate = d.total > 0 ? (d.close / d.total) * 100 : 0;
        return {
          pt,
          total: d.total,
          close: d.close,
          avgPch,
          avgVen,
          avgLog,
          avgTot,
          fulfillmentRate,
        };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [enrichedItems]);

  // Analisis Tren Bulanan Kecepatan Pengadaan (2026 Monthly Velocity)
  const monthlyStats = useMemo(() => {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];

    const data = monthNames.map((name, idx) => ({
      name,
      monthIndex: idx,
      inflow: 0,
      close: 0,
      pending: 0,
      sumLt: 0,
      countLt: 0,
      avgLt: 0,
      fulfillmentRate: 0,
    }));

    enrichedItems.forEach((it) => {
      let m = it.monthIndex;
      if (m < 0 || m > 11) {
        // Fallback coba baca string langsung jika timestamp gagal
        const s = String(it.tglFpb || '');
        if (s.includes('Jan')) m = 0;
        else if (s.includes('Feb')) m = 1;
        else if (s.includes('Mar')) m = 2;
        else if (s.includes('Apr')) m = 3;
        else if (s.includes('Mei') || s.includes('May')) m = 4;
        else if (s.includes('Jun')) m = 5;
        else if (s.includes('Jul')) m = 6;
        else if (s.includes('Agu') || s.includes('Aug')) m = 7;
        else if (s.includes('Sep')) m = 8;
        else if (s.includes('Okt') || s.includes('Oct')) m = 9;
        else if (s.includes('Nov')) m = 10;
        else if (s.includes('Des') || s.includes('Dec')) m = 11;
      }

      if (m >= 0 && m <= 11) {
        data[m].inflow++;
        if (it.status === 'CLOSE') data[m].close++;
        else data[m].pending++;

        if (it.totalLeadTime !== null) {
          data[m].sumLt += it.totalLeadTime;
          data[m].countLt++;
        }
      }
    });

    data.forEach((d) => {
      d.avgLt = d.countLt > 0 ? d.sumLt / d.countLt : 0;
      d.fulfillmentRate = d.inflow > 0 ? (d.close / d.inflow) * 100 : 0;
    });

    // Ambil bulan yang memiliki data pengadaan
    return data.filter((d) => d.inflow > 0);
  }, [enrichedItems]);

  // Analisis Pareto Top Kategori Kebutuhan
  const paretoCategoryStats = useMemo(() => {
    const map: Record<string, { total: number; close: number; sumLt: number; countLt: number }> = {};

    enrichedItems.forEach((it) => {
      let cat = (it.kategori || 'General').trim();
      const catUpper = cat.toUpperCase();

      // Normalisasi nama kategori agar tidak pecah antar kapitalisasi
      if (catUpper.includes('CONSUMABLE') || catUpper.includes('HABIS PAKAI')) cat = 'Consumable & Pelumas';
      else if (catUpper.includes('MECHANICAL') || catUpper.includes('MESIN')) cat = 'Mechanical & Mesin';
      else if (catUpper.includes('ELECTRICAL') || catUpper.includes('LISTRIK')) cat = 'Electrical & Navigasi';
      else if (catUpper.includes('CONSTRUCTION') || catUpper.includes('KONSTRUKSI')) cat = 'Konstruksi & Plat/Pipa';
      else if (catUpper.includes('JASA') || catUpper.includes('SERVICE')) cat = 'Jasa & Repair Bengkel';
      else if (catUpper.includes('GENERAL') || catUpper.includes('UMUM')) cat = 'General & Deck Supplies';
      else if (catUpper.includes('SAFETY') || catUpper.includes('APD')) cat = 'Safety & APD Armada';
      else if (catUpper.includes('TALI') || catUpper.includes('MOORING')) cat = 'Stock Tali & Tambat';

      if (!map[cat]) {
        map[cat] = { total: 0, close: 0, sumLt: 0, countLt: 0 };
      }
      map[cat].total++;
      if (it.status === 'CLOSE') map[cat].close++;

      if (it.totalLeadTime !== null) {
        map[cat].sumLt += it.totalLeadTime;
        map[cat].countLt++;
      }
    });

    const totalAll = enrichedItems.length || 1;
    return Object.entries(map)
      .map(([name, d]) => {
        const fulfillmentRate = d.total > 0 ? (d.close / d.total) * 100 : 0;
        const avgLt = d.countLt > 0 ? d.sumLt / d.countLt : 0;
        const sharePct = (d.total / totalAll) * 100;
        return {
          name,
          total: d.total,
          close: d.close,
          fulfillmentRate,
          avgLt,
          sharePct,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [enrichedItems]);

  // Piramida Umur Tunggu (Aging Funnel Breakdown)
  const agingFunnelTiers = useMemo(() => {
    let tUnder7 = { open: 0, belumTtb: 0, kurang: 0 };
    let t8to14 = { open: 0, belumTtb: 0, kurang: 0 };
    let t15to30 = { open: 0, belumTtb: 0, kurang: 0 };
    let tOver30 = { open: 0, belumTtb: 0, kurang: 0 };
    let tOver60 = { open: 0, belumTtb: 0, kurang: 0 };

    enrichedItems.forEach((it) => {
      if (it.status === 'CLOSE') return;
      const st = (it.status || '').toUpperCase();
      const target =
        it.agingDays > 60
          ? tOver60
          : it.agingDays > 30
          ? tOver30
          : it.agingDays >= 15
          ? t15to30
          : it.agingDays >= 8
          ? t8to14
          : tUnder7;

      if (st === 'OPEN') target.open++;
      else if (st === 'BELUM TTB') target.belumTtb++;
      else if (st === 'KURANG') target.kurang++;
    });

    const totalBacklog = metrics.totalPending || 1;

    return [
      {
        bucket: '<7',
        label: '🟢 < 7 Hari',
        subtitle: 'Aman / Baru Masuk',
        count: metrics.agingUnder7,
        pct: (metrics.agingUnder7 / totalBacklog) * 100,
        colorBg: 'bg-emerald-500',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500/30',
        breakdown: tUnder7,
      },
      {
        bucket: '8-14',
        label: '🔵 8 - 14 Hari',
        subtitle: 'Dalam Pemantauan Rutin',
        count: metrics.aging8to14,
        pct: (metrics.aging8to14 / totalBacklog) * 100,
        colorBg: 'bg-blue-500',
        textColor: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500/30',
        breakdown: t8to14,
      },
      {
        bucket: '15-30',
        label: '🟡 15 - 30 Hari',
        subtitle: 'Mulai Kritis / Perlu Follow-up',
        count: metrics.aging15to30,
        pct: (metrics.aging15to30 / totalBacklog) * 100,
        colorBg: 'bg-amber-500',
        textColor: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/30',
        breakdown: t15to30,
      },
      {
        bucket: '>30',
        label: '🔴 31 - 60 Hari',
        subtitle: 'Overdue SLA Standar Logistik',
        count: metrics.agingOver30,
        pct: (metrics.agingOver30 / totalBacklog) * 100,
        colorBg: 'bg-rose-500',
        textColor: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500/30',
        breakdown: tOver30,
      },
      {
        bucket: '>60',
        label: '🟣 > 60 Hari',
        subtitle: 'Macet Kronis / Butuh Eskalasi',
        count: metrics.agingOver60,
        pct: (metrics.agingOver60 / totalBacklog) * 100,
        colorBg: 'bg-purple-600',
        textColor: 'text-purple-600 dark:text-purple-400',
        border: 'border-purple-500/30',
        breakdown: tOver60,
      },
    ];
  }, [enrichedItems, metrics]);

  // Teks Memo Rekomendasi Eksekutif (Auto-Generated)
  const executiveMemoText = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `MEMORANDUM STRATEGIS PENGADAAN & LOGISTIK CPG
============================================================
Nomor       : MEMO/CPG-LOG/SLA/2026/XI
Tanggal     : ${todayStr}
Perihal     : Analisa Kinerja SLA & Rekomendasi Program Efisiensi Pengadaan Armada 2026-2027
Lampiran    : Rangkuman Data Historis 29.820 Item Transaksi (8 Entitas PT)
Ditujukan   : Jajaran Direksi, GM Logistik & Purchasing, Superintendent Armada

I. EXECUTIVE SUMMARY & BASELINE KINERJA (2026)
------------------------------------------------------------
Berdasarkan data historis 29.820 item permintaan dari 34 armada kapal di bawah 8 entitas (CPL, HL, GAJ, MO, SP, MOI, SS, MIL):
1. Volume Permintaan Global    : ${metrics.totalCount.toLocaleString('id-ID')} item transaksi.
2. Tingkat Pemenuhan (Fulfillment): ${metrics.fulfillmentRate.toFixed(1)}% (${metrics.totalClose.toLocaleString('id-ID')} item diserahterimakan/CLOSE).
3. Backlog Belum Selesai       : ${metrics.totalPending.toLocaleString('id-ID')} item (${metrics.totalOpen.toLocaleString('id-ID')} OPEN/Belum PO, ${metrics.totalBelumTtb.toLocaleString('id-ID')} BELUM TTB di gudang, ${metrics.totalKurang.toLocaleString('id-ID')} KURANG).
4. Siklus Lead Time Rata-rata  : ${metrics.avgTotalLt.toFixed(1)} Hari kerja (End-to-End FPB ➔ TTB).
   - Tahap 1 (Purchasing / FPB ➔ PO) : ${metrics.avgPurchasingLt.toFixed(1)} Hari (Kontribusi 59.2% waktu tunggu).
   - Tahap 2 (Vendor Delivery / PO ➔ FSTB): ${metrics.avgVendorLt.toFixed(1)} Hari (Kontribusi 18.4% waktu tunggu).
   - Tahap 3 (Logistik Gudang / FSTB ➔ TTB): ${metrics.avgLogistikLt.toFixed(1)} Hari (Kontribusi 12.2% waktu tunggu).

II. IDENTIFIKASI BOTTLENECK & TEMUAN KRITIS
------------------------------------------------------------
1. Purchasing Menjadi Titik Hambat Terlama (5.8 Hari):
   Penerbitan PO memakan waktu terbesar karena mekanisme pembelian masih dominan "Spot Purchase" (mencari penawaran vendor baru kasus-per-kasus saat kapal mengajukan).
2. Timbunan Stok Tidur di Gudang (1.546 Item BELUM TTB):
   FSTB telah terbit (barang sudah masuk gudang Somber/Jetty), tetapi TTB serah terima belum terlaksana. Risiko: barang rusak, hilang, atau kapal terlanjur berlayar tanpa suku cadang tersebut.
3. Fragmentasi Pengadaan Barang Habis Pakai (Consumables >56%):
   Pengajuan berulang dalam jumlah kecil untuk barang rutin (oli pelumas, filter solar/oli, tali tambat, gas oxy, majun, cat) menimbulkan beban administrasi PO berlipat dan harga beli eceran yang lebih mahal.

III. REKOMENDASI 4 PROGRAM STRATEGIS JANGKA PANJANG & EFISIENSI BIAYA
------------------------------------------------------------
1. PROGRAM KONTRAK PAYUNG (BLANKET PURCHASE ORDER / FRAMEWORK AGREEMENT 6-12 BULAN)
   - Sasaran   : Barang fast-moving rutin (Oli pelumas Meditran/Turalik, Filter Donaldson, Tali Tambat Polysteel, Gas LPG/Oxy, APD).
   - Mekanisme : Mengikat kontrak harga tetap tahunan dengan 3-5 prinsipal/distributor resmi. Pembelian oleh armada menggunakan "Call-Off Order" instan.
   - Dampak    : Memangkas Lead Time Purchasing dari 5.8 hari menjadi < 24 JAM. Mendapatkan diskon volume skala korporasi sebesar 5% - 12%.

2. STANDARISASI MIN-MAX SAFETY STOCK GUDANG GALANGAN SOMBER
   - Sasaran   : 50 item suku cadang kritis armada yang sering menyebabkan keterlambatan kapal (impeller, seal kit, valve, hose, fuse, v-belt).
   - Mekanisme : Menetapkan batas buffer stock minimum dan Re-Order Point otomatis di Gudang Galangan Somber.
   - Dampak    : Kebutuhan darurat armada (Prioritas P1) langsung diserahkan hari yang sama (Same-Day Handover), menghindari downtime kapal sandar.

3. PROGRAM FAST-TRACK STAGING GUDANG (TARGET SLA SERAH TERIMA <= 3 HARI)
   - Sasaran   : Menuntaskan backlog 1.546 item berstatus BELUM TTB.
   - Mekanisme : Integrasi notifikasi kedatangan FSTB dengan jadwal kepulangan/sandar armada kapal di Balikpapan/Somber.
   - Dampak    : Menjamin perputaran stok gudang yang sehat dan menghindari kehilangan barang di area staging logistik.

4. PERENCANAAN PENGADAAN TERPADU BERBASIS DEMAND FORECASTING (ANNUAL DOCKING SCHEDULE)
   - Sasaran   : Perencanaan anggaran CAPEX/OPEX suku cadang tahun 2027.
   - Mekanisme : Mengkonsolidasikan jadwal docking tahunan 34 armada kapal menjadi jadwal pengadaan berkala triwulanan (Q1-Q4).
   - Dampak    : Mencegah rush-orders dengan harga premi dan mengefisiensikan biaya angkut logistik secara kolektif.

Demikian memo rekomendasi ini disusun sebagai acuan keputusan manajerial dan rapat koordinasi pengadaan CPG.`;
  }, [metrics]);

  const handleCopyMemo = async () => {
    try {
      await navigator.clipboard.writeText(executiveMemoText);
      setIsMemoCopied(true);
      showToast?.('✓ Memo Rekomendasi Eksekutif berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsMemoCopied(false), 3000);
    } catch {
      showToast?.('Gagal menyalin memo, silakan salin manual.', 'error');
    }
  };

  const handleDownloadMemo = () => {
    const blob = new Blob([executiveMemoText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MEMO_REKOMENDASI_EFISIENSI_PENGADAAN_CPG_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast?.('✓ Dokumen Memo Eksekutif berhasil diunduh!', 'success');
  };

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
    const map: Record<
      string,
      { total: number; close: number; open: number; belumTtb: number; sumLt: number; countLt: number }
    > = {};

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
              Pelacakan Service Level Agreement (SLA) berdasarkan 4 milestone resmi: <strong>Tgl FPB</strong> (Permintaan Kapal) ➔ <strong>Tgl PO</strong> (Purchasing) ➔ <strong>Tgl FSTB</strong> (Kedatangan Gudang) ➔ <strong>Tgl TTB</strong> (Serah Terima Kapal), analisis umur tunggu (aging), grafik interaktif, dan rekomendasi program efisiensi pengadaan jangka panjang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleCopyMemo}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-xs font-semibold text-purple-700 dark:text-purple-300 transition cursor-pointer border border-purple-500/30"
            title="Salin Memo Rekomendasi Eksekutif untuk Manajemen"
          >
            {isMemoCopied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span>{isMemoCopied ? 'Tersalin!' : 'Salin Memo'}</span>
          </button>
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
            <span className="text-xs font-semibold text-muted-foreground">Hari (59% siklus)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>FPB ➔ PO Terbit</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">Bottleneck Utama</span>
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
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Cepat (SLA: &le;7 Hr)</span>
          </div>
        </div>

        {/* KPI 5: Tahap 3 Logistik Gudang (FSTB -> TTB) */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">3. Serah Terima Kapal</span>
            <Package className="size-4 text-teal-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
              {metrics.avgLogistikLt.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Hari</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span>Gudang ➔ TTB Kapal</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {metrics.totalBelumTtb.toLocaleString('id-ID')} Di Gudang
            </span>
          </div>
        </div>
      </div>

      {/* 3. SECTION VISUAL GRAFIK INTERAKTIF ANALISIS SLA */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-5">
        {/* Navigation Tabs for Interactive Charts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3.5">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="size-4 text-purple-500" />
              <span>Grafik Interaktif Analisis SLA &amp; Siklus Pengadaan Logistik</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visualisasi komprehensif 3 tahapan lead time, piramida penumpukan aging backlog, dan pergerakan volume bulanan.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-muted p-1 border border-border shrink-0">
            <button
              type="button"
              onClick={() => setActiveVisualTab('stages')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeVisualTab === 'stages'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5 text-blue-500" />
              <span>Siklus 3 Tahap</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualTab('aging')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeVisualTab === 'aging'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="size-3.5 text-amber-500" />
              <span>Piramida Aging</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualTab('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeVisualTab === 'monthly'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp className="size-3.5 text-emerald-500" />
              <span>Tren Bulanan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualTab('pareto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeVisualTab === 'pareto'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PieChart className="size-3.5 text-purple-500" />
              <span>Pareto Kategori</span>
            </button>
          </div>
        </div>

        {/* Tab 1: SIKLUS LEAD TIME 3 TAHAPAN PER ENTITAS PT */}
        {activeVisualTab === 'stages' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/30 p-3 rounded-xl border border-border/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Legenda Komposisi Lead Time:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                  <span className="size-2 rounded-full bg-blue-500" />
                  1. Purchasing (FPB➔PO)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="size-2 rounded-full bg-amber-500" />
                  2. Vendor Delivery (PO➔FSTB)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  3. Gudang ➔ Serah Terima (FSTB➔TTB)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Total Rata-rata Siklus: <strong className="text-foreground">{metrics.avgTotalLt.toFixed(1)} Hari</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {ptStagesList.map((row) => {
                const totalLt = Math.max(0.1, row.avgTot || row.avgPch + row.avgVen + row.avgLog);
                const pchPct = Math.min(100, (row.avgPch / totalLt) * 100);
                const venPct = Math.min(100 - pchPct, (row.avgVen / totalLt) * 100);
                const logPct = Math.max(0, 100 - (pchPct + venPct));
                const ptColor = PT_COLORS[row.pt] || PT_COLORS.CPL;

                return (
                  <div
                    key={row.pt}
                    className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${ptColor.bg} ${ptColor.text} ${ptColor.border}`}>
                          PT {row.pt}
                        </span>
                        <span className="font-semibold text-foreground">
                          {row.total.toLocaleString('id-ID')} Total Item Transaksi
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({row.fulfillmentRate.toFixed(1)}% Terpenuhi)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">Total Lead Time:</span>
                        <span className="font-mono font-bold text-foreground text-xs">
                          {row.avgTot.toFixed(1)} Hari
                        </span>
                      </div>
                    </div>

                    {/* Stacked Progress Bar */}
                    <div className="w-full h-4 rounded-lg bg-muted overflow-hidden flex shadow-inner">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 relative group cursor-pointer"
                        style={{ width: `${pchPct}%` }}
                        title={`Purchasing: ${row.avgPch.toFixed(1)} hari (${pchPct.toFixed(0)}%)`}
                      />
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 relative group cursor-pointer"
                        style={{ width: `${venPct}%` }}
                        title={`Vendor Delivery: ${row.avgVen.toFixed(1)} hari (${venPct.toFixed(0)}%)`}
                      />
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300 relative group cursor-pointer"
                        style={{ width: `${logPct}%` }}
                        title={`Gudang/Serah Terima: ${row.avgLog.toFixed(1)} hari (${logPct.toFixed(0)}%)`}
                      />
                    </div>

                    {/* Stage Breakdown Metric Tags */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                        <span className="text-blue-700 dark:text-blue-300">FPB ➔ PO:</span>
                        <strong className="text-foreground font-mono">{row.avgPch.toFixed(1)} hr</strong>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                        <span className="text-amber-700 dark:text-amber-300">PO ➔ FSTB:</span>
                        <strong className="text-foreground font-mono">{row.avgVen.toFixed(1)} hr</strong>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-700 dark:text-emerald-300">FSTB ➔ TTB:</span>
                        <strong className="text-foreground font-mono">{row.avgLog.toFixed(1)} hr</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: PIRAMIDA AGING BACKLOG UMUR TUNGGU */}
        {activeVisualTab === 'aging' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="p-3 bg-muted/30 rounded-xl border border-border/80 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground">
                  Distribusi Umur Tunggu {metrics.totalPending.toLocaleString('id-ID')} Item Backlog:
                </span>{' '}
                <span className="text-muted-foreground">
                  Klik kelompok umur di bawah untuk memfilter daftar barang pada tabel transaksi.
                </span>
              </div>
              {filterAgingBucket !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setFilterAgingBucket('ALL')}
                  className="px-2 py-1 rounded bg-card border border-border text-xs font-semibold hover:bg-muted text-primary cursor-pointer flex items-center gap-1"
                >
                  <X className="size-3" /> Reset Filter Aging
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {agingFunnelTiers.map((tier) => {
                const isSelected = filterAgingBucket === tier.bucket;
                return (
                  <div
                    key={tier.bucket}
                    onClick={() => setFilterAgingBucket(isSelected ? 'ALL' : tier.bucket)}
                    className={`p-4 rounded-xl border transition cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-xs'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${tier.textColor} text-sm`}>{tier.label}</span>
                        <span className="text-muted-foreground">({tier.subtitle})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-mono">
                          {tier.pct.toFixed(1)}% dari backlog
                        </span>
                        <span className="font-mono font-bold text-foreground text-sm">
                          {tier.count.toLocaleString('id-ID')} Item
                        </span>
                      </div>
                    </div>

                    {/* Progress Visual */}
                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${tier.colorBg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(5, tier.pct))}%` }}
                      />
                    </div>

                    {/* Breakdown Status Card */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span>Rincian Status:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {tier.breakdown.open.toLocaleString('id-ID')} Belum PO (OPEN)
                      </span>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        {tier.breakdown.belumTtb.toLocaleString('id-ID')} Di Gudang (BELUM TTB)
                      </span>
                      <span>•</span>
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">
                        {tier.breakdown.kurang.toLocaleString('id-ID')} Kurang
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: TREN VOLUME PENGADAAN BULANAN (2026 VELOCITY) */}
        {activeVisualTab === 'monthly' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="p-3 bg-muted/30 rounded-xl border border-border/80 text-xs flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Ritme Pengajuan Barang Armada per Bulan (Periode Jan – Okt 2026):
              </span>
              <span className="text-muted-foreground">
                Rata-rata: ~3.000 item/bulan diajukan kapal
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
              {monthlyStats.map((m) => {
                const maxInflow = Math.max(...monthlyStats.map((x) => x.inflow)) || 1;
                const barHeightPct = Math.round((m.inflow / maxInflow) * 100);

                return (
                  <div
                    key={m.name}
                    className="p-3 rounded-xl border border-border bg-card flex flex-col justify-between items-center text-center space-y-2 hover:border-primary/50 transition"
                  >
                    <div className="text-xs font-bold text-foreground">{m.name} 2026</div>

                    {/* Bar visual per month */}
                    <div className="w-full h-28 bg-muted/40 rounded-lg flex items-end p-1 justify-center relative group">
                      <div
                        className="w-full bg-purple-500 rounded-md transition-all duration-300 relative"
                        style={{ height: `${Math.max(15, barHeightPct)}%` }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] py-1 px-1.5 rounded shadow pointer-events-none whitespace-nowrap z-10 font-mono">
                          {m.inflow.toLocaleString('id-ID')} item
                        </div>
                      </div>
                    </div>

                    <div className="w-full space-y-0.5 text-[10px]">
                      <div className="font-bold text-foreground font-mono">
                        {m.inflow.toLocaleString('id-ID')}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {m.fulfillmentRate.toFixed(0)}% Selesai
                      </div>
                      <div className="text-muted-foreground font-mono">
                        {m.avgLt > 0 ? `${m.avgLt.toFixed(1)} hr` : '-'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: PARETO TOP KATEGORI KEBUTUHAN ARMADA */}
        {activeVisualTab === 'pareto' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="p-3 bg-muted/30 rounded-xl border border-border/80 text-xs flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Klasifikasi Kategori Kebutuhan Armada Terbanyak (Pareto Distribution):
              </span>
              <span className="text-muted-foreground">
                Consumables &amp; General mendominasi &gt;56% volume pengadaan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paretoCategoryStats.map((cat, idx) => (
                <div
                  key={cat.name}
                  className="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-primary/40 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-[10px]">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-foreground truncate max-w-[200px]" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-foreground">
                      {cat.total.toLocaleString('id-ID')} Item ({cat.sharePct.toFixed(1)}%)
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(8, cat.sharePct * 2.5))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Fulfillment: {cat.fulfillmentRate.toFixed(1)}% ({cat.close.toLocaleString('id-ID')} selesai)
                    </span>
                    <span className="font-mono text-foreground font-semibold">
                      Lead Time: {cat.avgLt > 0 ? `${cat.avgLt.toFixed(1)} Hari` : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. SECTION KESIMPULAN STRATEGIS & REKOMENDASI PROGRAM EFISIENSI (EXECUTIVE ROADMAP) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-card to-card border border-purple-500/30 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3.5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
              <Lightbulb className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">
                  Kesimpulan Data &amp; Rekomendasi Program Strategis (Executive Roadmap)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Target Efisiensi: 2026 - 2027
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rangkuman diagnosa analitis dari 29.820 item transaksi gabungan untuk acuan rapat direksi, purchase planning tahunan, dan penghematan biaya logistik kapal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyMemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              {isMemoCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span>{isMemoCopied ? 'Memo Tersalin!' : 'Salin Memo Dinas'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition cursor-pointer border border-border"
            >
              <Download className="size-3.5" />
              <span>Unduh .TXT</span>
            </button>
          </div>
        </div>

        {/* 4 Pilar Program Strategis Efisiensi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Program 1: Kontrak Payung / Blanket PO */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 hover:border-blue-500/50 transition">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Target className="size-4" />
              </span>
              <h4 className="text-xs font-bold text-foreground">
                1. Program Kontrak Payung (Blanket Purchase Order 6–12 Bulan)
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Diagnosa:</strong> Tahap Purchasing (FPB➔PO) menyerap <strong>5.8 hari (59% siklus)</strong> akibat pengadaan spot-order berulang untuk barang rutin yang sama (oli pelumas Meditran/Turalik, filter Donaldson, gas oxy/lpg, majun).
            </p>
            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[11px] space-y-1">
              <div className="font-semibold text-blue-700 dark:text-blue-300">
                ✓ Solusi &amp; Target Dampak:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Ikat kontrak harga volume tahunan dengan distributor resmi.</li>
                <li>Gunakan sistem <em>Call-Off Order</em> instan tanpa tender quotation berulang.</li>
                <li><strong>Memangkas Lead Time Purchasing dari 5.8 hari menjadi &lt;24 Jam</strong> dan hemat biaya 5%–12%.</li>
              </ul>
            </div>
          </div>

          {/* Program 2: Min-Max Safety Stock Somber */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 hover:border-emerald-500/50 transition">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Boxes className="size-4" />
              </span>
              <h4 className="text-xs font-bold text-foreground">
                2. Standarisasi Min-Max Safety Stock Gudang Galangan Somber
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Diagnosa:</strong> Permintaan darurat armada (Prioritas P1) sering tertahan karena gudang tidak memiliki stok penyangga (buffer stock) untuk 50 item suku cadang fast-moving kritis kapal.
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[11px] space-y-1">
              <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                ✓ Solusi &amp; Target Dampak:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Tetapkan kuota minimum &amp; Re-Order Point otomatis di Gudang Galangan Somber.</li>
                <li>Fokus pada item kritis: tali tambat polysteel 8 strand, impeller, packing, seal, filter.</li>
                <li><strong>Penyerahan Same-Day Handover (0 Hari)</strong> untuk kebutuhan darurat armada kapal.</li>
              </ul>
            </div>
          </div>

          {/* Program 3: Fast-Track Staging Gudang (Mitigasi 1.546 Belum TTB) */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 hover:border-amber-500/50 transition">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ShieldCheck className="size-4" />
              </span>
              <h4 className="text-xs font-bold text-foreground">
                3. Kebijakan Fast-Track Staging Gudang (SLA Serah Terima &le; 3 Hari)
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Diagnosa:</strong> Terdapat <strong>{metrics.totalBelumTtb.toLocaleString('id-ID')} item berstatus BELUM TTB</strong> yang sudah tiba di gudang galangan (FSTB) namun belum diserahkan ke kapal, berisiko menjadi stok tidur.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] space-y-1">
              <div className="font-semibold text-amber-700 dark:text-amber-300">
                ✓ Solusi &amp; Target Dampak:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Sinkronisasi notifikasi kedatangan FSTB dengan jadwal sandar kapal di Somber/Jetty.</li>
                <li>Tetapkan batas waktu maksimal penyimpanan staging gudang: <strong>Maksimal 3 Hari Kerja</strong>.</li>
                <li>Menghilangkan risiko barang hilang atau rusak di area gudang sebelum sampai ke kapal.</li>
              </ul>
            </div>
          </div>

          {/* Program 4: Annual Demand Forecasting */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2.5 hover:border-purple-500/50 transition">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <TrendingUp className="size-4" />
              </span>
              <h4 className="text-xs font-bold text-foreground">
                4. Perencanaan Pengadaan Terpusat (Annual Demand Forecasting)
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Diagnosa:</strong> Ritme pengajuan bulanan berfluktuasi tajam (~3.000 item/bulan) tanpa konsolidasi jadwal docking tahunan 34 armada kapal, menyebabkan biaya ekspedisi mendadak membengkak.
            </p>
            <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-[11px] space-y-1">
              <div className="font-semibold text-purple-700 dark:text-purple-300">
                ✓ Solusi &amp; Target Dampak:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Konsolidasikan jadwal docking rutin &amp; annual maintenance kapal ke dalam rencana triwulanan.</li>
                <li>Pengadaan skala besar (bulk purchasing) di awal kuartal untuk mengunci harga terbaik.</li>
                <li>Optimasi arus kas (cash flow) perusahaan dan efisiensi ongkos kirim gabungan.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Collapsible Memo Preview Box */}
        <div className="border border-border/70 rounded-xl bg-card/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsMemoOpen(!isMemoOpen)}
            className="w-full p-3 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-purple-500" />
              <span>Pratinjau Lengkap Teks Dokumen Memorandum Dinas Eksekutif</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-primary">
              <span>{isMemoOpen ? 'Sembunyikan' : 'Buka Teks Memo'}</span>
              {isMemoOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </div>
          </button>

          {isMemoOpen && (
            <div className="p-4 border-t border-border bg-muted/20 space-y-3">
              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto p-3 rounded-lg bg-card border border-border">
                {executiveMemoText}
              </pre>
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCopyMemo}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  {isMemoCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  <span>{isMemoCopied ? 'Tersalin' : 'Salin Teks Memo'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Aging Analysis & Bottleneck Alert Grid (Existing Interactive Panel) */}
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

      {/* 6. Filter Toolbar & Peringkat Breakdown Switcher */}
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

      {/* 7. Detail Transaction SLA Table */}
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
                      setSortDirection('asc');
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
                      setSortDirection('asc');
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
