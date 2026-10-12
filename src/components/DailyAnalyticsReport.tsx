'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  Share2,
  Ship,
  Boxes,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { extractDateInfo, formatDateDdMmYy, formatDateDdMmYyDash } from '@/utils/formatDate';
import WorkflowTrafficLight from './WorkflowTrafficLight';
import {
  evaluateFiveDivisionWorkflow,
  FiveDivisionWorkflowResult,
  isFieldBelum,
  hasValue,
} from '@/utils/statusWorkflow';

export interface DailyAnalyticsReportProps {
  items: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  className?: string;
}

type DateBasisFilter = 'ALL_ACTIVITY' | 'PO_DATE' | 'FPB_DATE' | 'TTB_DATE' | 'KEU_DATE';
type TrafficLightFilter = 'ALL' | 'FULL' | 'PARTIAL' | 'OFF';

export default function DailyAnalyticsReport({
  items,
  armadaItems = [],
  onOpenAudit,
  showToast,
  className = '',
}: DailyAnalyticsReportProps) {
  // Gabungkan semua data transaksi unik (prioritas items procurement, fallback armada)
  const allTransactions = useMemo(() => {
    const list = [...items];
    if (armadaItems && armadaItems.length > 0) {
      const existingFpbs = new Set(list.map((i) => i.fpb?.trim().toUpperCase()).filter(Boolean));
      for (const a of armadaItems) {
        const fKey = a.fpb?.trim().toUpperCase();
        if (fKey && !existingFpbs.has(fKey)) {
          list.push(a as unknown as ProcurementItem);
          existingFpbs.add(fKey);
        }
      }
    }
    return list;
  }, [items, armadaItems]);

  // Ekstraksi seluruh tanggal aktivitas valid dalam dataset (diurutkan kronologis descending)
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, { fullDate: string; timestamp: number; formatted: string }>();

    for (const it of allTransactions) {
      const candidates = [
        it.tglPo,
        it.date,
        it.tglFpb,
        it.tglTtb,
        it.tglInputTtb,
        it.tglBarangDiantar,
        it.tglSpp,
        it.tglInputSpp,
        it.tglKeKeuangan,
      ];

      for (const c of candidates) {
        if (!hasValue(c)) continue;
        const info = extractDateInfo(c);
        if (info.fullDate && info.year && parseInt(info.year, 10) >= 2020 && info.timestamp > 0) {
          if (!dateMap.has(info.fullDate)) {
            dateMap.set(info.fullDate, {
              fullDate: info.fullDate,
              timestamp: info.timestamp,
              formatted: formatDateDdMmYy(info.fullDate),
            });
          }
        }
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [allTransactions]);

  // Tanggal default: tanggal data aktivitas terbaru dalam dataset (atau hari ini jika kosong)
  const defaultIsoDate = useMemo(() => {
    if (availableDates.length > 0) {
      return availableDates[0].fullDate;
    }
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, [availableDates]);

  // State filter
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(defaultIsoDate);
  const [dateBasis, setDateBasis] = useState<DateBasisFilter>('ALL_ACTIVITY');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [trafficFilter, setTrafficFilter] = useState<TrafficLightFilter>('ALL');
  const [divisionBottleneckFilter, setDivisionBottleneckFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const pageSize = 15;

  // Tanggal terformat (contoh: 09/08/24)
  const selectedFormattedDate = useMemo(() => {
    return formatDateDdMmYy(selectedIsoDate);
  }, [selectedIsoDate]);

  // Ambil transaksi yang memiliki aktivitas pada selectedIsoDate
  const dailyTransactions = useMemo(() => {
    if (!selectedIsoDate) return [];

    return allTransactions.filter((it) => {
      // Filter Entitas
      if (entityFilter !== 'ALL') {
        const itemEnt = (it.entity || '').toUpperCase();
        if (itemEnt !== entityFilter.toUpperCase()) return false;
      }

      // Filter Tanggal berdasarkan basis yang dipilih
      const matchesDate = (rawDate?: string | number | null) => {
        if (!hasValue(rawDate)) return false;
        const info = extractDateInfo(rawDate);
        return info.fullDate === selectedIsoDate;
      };

      if (dateBasis === 'PO_DATE') {
        return matchesDate(it.tglPo) || matchesDate(it.date);
      }
      if (dateBasis === 'FPB_DATE') {
        return matchesDate(it.tglFpb);
      }
      if (dateBasis === 'TTB_DATE') {
        return matchesDate(it.tglTtb) || matchesDate(it.tglInputTtb);
      }
      if (dateBasis === 'KEU_DATE') {
        return matchesDate(it.tglKeKeuangan) || matchesDate(it.tglSpp) || matchesDate(it.tglInputSpp);
      }

      // Default: ALL_ACTIVITY (Ada pergerakan PO, FPB, TTB, Lapangan, atau SPP/Keuangan)
      return (
        matchesDate(it.tglPo) ||
        matchesDate(it.date) ||
        matchesDate(it.tglFpb) ||
        matchesDate(it.tglTtb) ||
        matchesDate(it.tglInputTtb) ||
        matchesDate(it.tglBarangDiantar) ||
        matchesDate(it.tglTimLapKePicTtb) ||
        matchesDate(it.tglKeTimLapangan) ||
        matchesDate(it.tglSpp) ||
        matchesDate(it.tglInputSpp) ||
        matchesDate(it.tglKeKeuangan)
      );
    });
  }, [allTransactions, selectedIsoDate, dateBasis, entityFilter]);

  // Evaluasi workflow untuk setiap item harian
  const dailyEvaluatedItems = useMemo(() => {
    return dailyTransactions.map((item) => {
      const wf = evaluateFiveDivisionWorkflow(item);

      // Hitung keterangan rincian yang masih berstatus 'Belum'
      const pendingBelumDetails: string[] = [];
      for (const st of wf.stages) {
        if (st.isPartial) {
          pendingBelumDetails.push(`${st.code}: ${st.statusText} [${st.detail}]`);
        } else if (!st.isPassed) {
          pendingBelumDetails.push(`${st.code}: Belum Dimulai`);
        }
      }

      return {
        item,
        wf,
        pendingBelumDetails,
      };
    });
  }, [dailyTransactions]);

  // Statistik Ringkasan Harian (KPI Metrics)
  const dailyMetrics = useMemo(() => {
    const total = dailyEvaluatedItems.length;
    let fullCount = 0; // 5/5 Lengkap (semua divisi hijau penuh)
    let partialCount = 0; // Ada divisi aktif yang menyala setengah (data belum)
    let offCount = 0; // Belum berjalan (0/5)

    // Breakdown kendala per 5 divisi
    const bottleneckCounts = {
      FPB: 0,
      PCH: 0,
      LOG: 0,
      LAP: 0,
      ADM: 0,
    };

    let totalQtyFPB = 0;
    let totalQtyTTB = 0;
    const vesselsSet = new Set<string>();

    for (const { item, wf } of dailyEvaluatedItems) {
      if (wf.isComplete) {
        fullCount++;
      } else if (wf.passedCount === 0) {
        offCount++;
      } else {
        partialCount++;
      }

      for (const st of wf.stages) {
        if (st.isPartial) {
          bottleneckCounts[st.code as keyof typeof bottleneckCounts]++;
        }
      }

      if (typeof item.qtyFPB === 'number') totalQtyFPB += item.qtyFPB;
      if (typeof item.qtyTTB === 'number') totalQtyTTB += item.qtyTTB;

      const vessel = (item as any).armada || (item as any).deptArmada || '';
      if (vessel && vessel !== '-') vesselsSet.add(vessel.trim());
    }

    const completionRate = total > 0 ? Math.round((fullCount / total) * 100) : 0;

    return {
      total,
      fullCount,
      partialCount,
      offCount,
      completionRate,
      bottleneckCounts,
      totalQtyFPB,
      totalQtyTTB,
      activeVesselsCount: vesselsSet.size,
      vesselList: Array.from(vesselsSet),
    };
  }, [dailyEvaluatedItems]);

  // Filter daftar transaksi berdasarkan pencarian, traffic filter, dan bottleneck seksi
  const filteredList = useMemo(() => {
    return dailyEvaluatedItems.filter(({ item, wf }) => {
      // Filter Traffic Light Status
      if (trafficFilter === 'FULL' && !wf.isComplete) return false;
      if (trafficFilter === 'PARTIAL' && (wf.isComplete || wf.passedCount === 0)) return false;
      if (trafficFilter === 'OFF' && wf.passedCount > 0) return false;

      // Filter Bottleneck Divisi Spesifik
      if (divisionBottleneckFilter) {
        const stage = wf.stages.find((s) => s.code === divisionBottleneckFilter);
        if (!stage || !stage.isPartial) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpb = (item.fpb || '').toLowerCase();
        const po = (item.po || item.noPo || '').toLowerCase();
        const itName = (item.item || '').toLowerCase();
        const pic = (item.picAktif || item.picPch || item.picTtb || '').toLowerCase();
        const armada = ((item as any).armada || (item as any).deptArmada || '').toLowerCase();
        const ent = (item.entity || '').toLowerCase();

        return (
          fpb.includes(q) ||
          po.includes(q) ||
          itName.includes(q) ||
          pic.includes(q) ||
          armada.includes(q) ||
          ent.includes(q)
        );
      }

      return true;
    });
  }, [dailyEvaluatedItems, trafficFilter, divisionBottleneckFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Navigasi tanggal cepat (Hari Sebelumnya / Hari Berikutnya)
  const currentIdx = availableDates.findIndex((d) => d.fullDate === selectedIsoDate);
  const handlePrevDay = () => {
    if (currentIdx !== -1 && currentIdx < availableDates.length - 1) {
      setSelectedIsoDate(availableDates[currentIdx + 1].fullDate);
      setCurrentPage(1);
    }
  };
  const handleNextDay = () => {
    if (currentIdx > 0) {
      setSelectedIsoDate(availableDates[currentIdx - 1].fullDate);
      setCurrentPage(1);
    }
  };

  // Preset Cepat
  const handleSelectToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedIsoDate(today);
    setCurrentPage(1);
  };
  const handleSelectLatestAvailable = () => {
    if (availableDates.length > 0) {
      setSelectedIsoDate(availableDates[0].fullDate);
      setCurrentPage(1);
    }
  };

  // Fungsi: Salin Teks Rekap Eksekutif ke WhatsApp
  const handleCopyWhatsApp = () => {
    const header = `📋 *LAPORAN HARIAN SUPPLY CHAIN & PROCUREMENT CPG*\n📅 *Tanggal Aktivitas:* ${selectedFormattedDate} (${selectedIsoDate})\n🏢 *Entitas:* ${entityFilter === 'ALL' ? 'Semua Entitas CPG' : entityFilter}\n\n`;

    const summarySection = `📊 *RINGKASAN EKSEKUTIF ALUR:*\n• Total Berkas Aktif Hari Ini: *${dailyMetrics.total} Transaksi*\n• 🟢 5/5 Lengkap (Tuntas 100%): *${dailyMetrics.fullCount} Transaksi (${dailyMetrics.completionRate}%)*\n• ◐ Menyala Setengah (Data Belum Penuh): *${dailyMetrics.partialCount} Transaksi*\n• ⚪ Belum Dimulai: *${dailyMetrics.offCount} Transaksi*\n• 🚢 Armada Dilayani: *${dailyMetrics.activeVesselsCount} Kapal/Unit*\n\n`;

    const bottleneckSection = `🚦 *RADAR KENDALA & STATUS 'BELUM' PER SEKSI:*\n• 1. FPB Check: ${dailyMetrics.bottleneckCounts.FPB > 0 ? `⚠️ ${dailyMetrics.bottleneckCounts.FPB} item belum terverifikasi` : '✅ Lancar'}\n• 2. Purchasing: ${dailyMetrics.bottleneckCounts.PCH > 0 ? `⚠️ ${dailyMetrics.bottleneckCounts.PCH} item Delivery/FSTB Belum Terbit` : '✅ Lancar'}\n• 3. Logistik TTB: ${dailyMetrics.bottleneckCounts.LOG > 0 ? `⚠️ ${dailyMetrics.bottleneckCounts.LOG} item Menunggu TTB` : '✅ Lancar'}\n• 4. Tim Lapangan: ${dailyMetrics.bottleneckCounts.LAP > 0 ? `⚠️ ${dailyMetrics.bottleneckCounts.LAP} item Belum Diantar/Serah Terima` : '✅ Lancar'}\n• 5. ADM / SPP: ${dailyMetrics.bottleneckCounts.ADM > 0 ? `⚠️ ${dailyMetrics.bottleneckCounts.ADM} item SPP Belum Terbit` : '✅ Lancar'}\n\n`;

    let topPendingSection = `⚠️ *DAFTAR TRANSAKSI PARSIAL (DATA BELUM PENUH):*\n`;
    const pendingItems = dailyEvaluatedItems.filter(({ wf }) => wf.passedCount > 0 && !wf.isComplete).slice(0, 5);
    if (pendingItems.length === 0) {
      topPendingSection += `• Tidak ada transaksi parsial yang tertahan pada tanggal ini.\n`;
    } else {
      pendingItems.forEach(({ item, wf }, idx) => {
        const fpb = item.fpb || '-';
        const po = item.po || item.noPo || '-';
        const armada = (item as any).armada || (item as any).deptArmada || '-';
        const pendingStages = wf.stages
          .filter((s) => s.isPartial)
          .map((s) => s.code)
          .join(', ');
        topPendingSection += `${idx + 1}. *FPB:* ${fpb} | *Armada:* ${armada} | *PO:* ${po}\n   ↳ Kendala Seksi: [${pendingStages || 'Sebagian'}]\n`;
      });
      if (dailyEvaluatedItems.filter(({ wf }) => wf.passedCount > 0 && !wf.isComplete).length > 5) {
        topPendingSection += `   _...dan ${dailyEvaluatedItems.filter(({ wf }) => wf.passedCount > 0 && !wf.isComplete).length - 5} berkas lainnya._\n`;
      }
    }

    const footer = `\n_Digenerate otomatis dari Dashboard CPG Web Operasional & Supply Chain._`;
    const fullText = header + summarySection + bottleneckSection + topPendingSection + footer;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        showToast?.('Ringkasan Laporan Harian berhasil disalin ke clipboard!', 'success');
      });
    }
  };

  // Fungsi: Unduh Laporan Harian sebagai CSV
  const handleDownloadCsv = () => {
    if (filteredList.length === 0) {
      showToast?.('Tidak ada data transaksi untuk diunduh pada tanggal ini.', 'warning');
      return;
    }

    const headers = [
      'NO FPB',
      'ENTITAS',
      'ARMADA / DEPT',
      'ITEM PENGADAAN',
      'NO PO',
      'TGL PO',
      'PIC AKTIF',
      'STATUS 5 DIVISI',
      'STATUS LENGKAP',
      'RINCIAN DATA BELUM',
    ];

    const rows = filteredList.map(({ item, wf, pendingBelumDetails }) => [
      `"${item.fpb || '-'}"`,
      `"${item.entity || '-'}"`,
      `"${(item as any).armada || (item as any).deptArmada || '-'}"`,
      `"${(item.item || '').replace(/"/g, '""')}"`,
      `"${item.po || item.noPo || '-'}"`,
      `"${formatDateDdMmYy(item.tglPo || item.date)}"`,
      `"${item.picAktif || item.picPch || '-'}"`,
      `"${wf.summaryBadge}"`,
      `"${wf.isComplete ? 'YA (5/5 Lengkap)' : wf.passedCount > 0 ? 'SEBAGIAN (Parsial)' : 'BELUM'}"`,
      `"${pendingBelumDetails.join(' | ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Harian_CPG_${selectedIsoDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast?.(`File CSV Laporan Harian ${selectedIsoDate} berhasil diunduh.`, 'success');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ═══════════════════════════════════════════════════════════
          HEADER: TITLE & ACTIONS
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <CalendarDays className="size-5 shrink-0" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                  <span>Laporan Harian Operasional &amp; Alur 5 Seksi</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    Live Analytics
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rekap eksekutif pergerakan transaksi harian, status lampu lalu lintas, dan deteksi data bertuliskan &ldquo;Belum&rdquo;.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyWhatsApp}
              className={`h-8 px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title="Salin rekap eksekutif ke clipboard dalam format WhatsApp siap kirim"
            >
              {isCopied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
              <span>{isCopied ? 'Tersalin!' : 'Salin Rekap WhatsApp'}</span>
            </button>

            <button
              onClick={handleDownloadCsv}
              className="h-8 px-3 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Unduh data transaksi hari ini ke file CSV"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            DATE PICKER & FILTER BAR
            ═══════════════════════════════════════════════════════════ */}
        <div className="pt-3 border-t border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Tanggal Picker & Navigasi */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              <button
                onClick={handlePrevDay}
                disabled={currentIdx >= availableDates.length - 1}
                className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="size-3.5 text-primary shrink-0" />
                <input
                  type="date"
                  value={selectedIsoDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedIsoDate(e.target.value);
                      setCurrentPage(1);
                    }
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-foreground focus:outline-hidden cursor-pointer"
                />
              </div>

              <button
                onClick={handleNextDay}
                disabled={currentIdx <= 0}
                className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Hari Berikutnya"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Tombol Preset Cepat */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <button
                onClick={handleSelectLatestAvailable}
                className={`px-2 py-1 rounded-md border transition ${
                  selectedIsoDate === defaultIsoDate
                    ? 'bg-primary text-primary-foreground font-semibold border-primary'
                    : 'bg-card hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                Data Terakhir ({formatDateDdMmYy(defaultIsoDate)})
              </button>
              <button
                onClick={handleSelectToday}
                className="px-2 py-1 rounded-md bg-card hover:bg-muted text-muted-foreground border border-border transition"
              >
                Hari Ini
              </button>
            </div>
          </div>

          {/* Filter Entitas & Basis Tanggal */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Basis Tanggal */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-mono">Basis:</span>
              <select
                value={dateBasis}
                onChange={(e) => {
                  setDateBasis(e.target.value as DateBasisFilter);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg bg-card border border-border text-xs text-foreground font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL_ACTIVITY">Semua Tanggal Aktivitas</option>
                <option value="PO_DATE">Tanggal PO (Purchasing)</option>
                <option value="FPB_DATE">Tanggal FPB (Permintaan)</option>
                <option value="TTB_DATE">Tanggal TTB (Logistik)</option>
                <option value="KEU_DATE">Tanggal Penyerahan Keuangan</option>
              </select>
            </div>

            {/* Filter Entitas */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-mono">Entitas:</span>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 rounded-lg bg-card border border-border text-xs text-foreground font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Semua Entitas</option>
                <option value="CPL">PT CPL</option>
                <option value="PPI">PT PPI</option>
                <option value="HL">PT HL</option>
                <option value="GAJ">PT GAJ</option>
                <option value="MIL">PT MIL</option>
                <option value="SP">PT SP</option>
                <option value="SSK">PT SSK</option>
                <option value="MO">PT MO</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EXECUTIVE KPI SUMMARY CARDS (4 METRICS)
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Transaksi Bergerak */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>TOTAL AKTIVITAS BERKAS</span>
            <span className="size-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.total}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {selectedFormattedDate}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Jumlah berkas PO/FPB/TTB/SPP yang tercatat aktif bergerak pada tanggal ini.
          </p>
        </div>

        {/* Card 2: 5/5 Lengkap (Hijau Penuh) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'FULL' ? 'ALL' : 'FULL')}
          className={`p-4 rounded-xl bg-card border shadow-xs space-y-2 cursor-pointer transition hover:border-emerald-500/50 ${
            trafficFilter === 'FULL'
              ? 'ring-2 ring-emerald-500/40 border-emerald-500 bg-emerald-500/5'
              : 'border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
            <span>5/5 LENGKAP (PENUH)</span>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {dailyMetrics.fullCount}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {dailyMetrics.completionRate}% Tuntas
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Seluruh 5 divisi tuntas 100% tanpa ada data yang bertuliskan &ldquo;Belum&rdquo;.
          </p>
        </div>

        {/* Card 3: Menyala Setengah (◐ Parsial) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'PARTIAL' ? 'ALL' : 'PARTIAL')}
          className={`p-4 rounded-xl bg-card border shadow-xs space-y-2 cursor-pointer transition hover:border-amber-500/50 ${
            trafficFilter === 'PARTIAL'
              ? 'ring-2 ring-amber-500/40 border-amber-500 bg-amber-500/5'
              : 'border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-mono font-semibold">
            <span>MENYALA SETENGAH (◐)</span>
            <span className="text-sm font-bold leading-none text-amber-500">◐</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
              {dailyMetrics.partialCount}
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              Perlu Tindak Lanjut
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Berkas aktif namun masih memiliki status &ldquo;Belum&rdquo; (misal: Delivery/FSTB/SPP belum terbit).
          </p>
        </div>

        {/* Card 4: Armada & Volume */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>ARMADA &amp; VOLUME BARANG</span>
            <Ship className="size-4 text-sky-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.activeVesselsCount}
            </span>
            <span className="text-xs font-mono font-semibold text-muted-foreground">
              Kapal / Unit
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight truncate" title={dailyMetrics.vesselList.join(', ')}>
            {dailyMetrics.vesselList.length > 0 ? dailyMetrics.vesselList.slice(0, 3).join(', ') : 'Belum ada armada'}
            {dailyMetrics.vesselList.length > 3 ? ` +${dailyMetrics.vesselList.length - 3} lainnya` : ''}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5-DIVISION BOTTLENECK RADAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>Radar Kendala Alur 5 Seksi (Status &ldquo;Belum&rdquo; Hari Ini)</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Klik pada salah satu divisi di bawah untuk memfilter transaksi yang tertahan di tahap tersebut:
            </p>
          </div>

          {divisionBottleneckFilter && (
            <button
              onClick={() => setDivisionBottleneckFilter(null)}
              className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-[11px] font-mono flex items-center gap-1 self-start sm:self-auto transition cursor-pointer"
            >
              <RotateCcw className="size-3 text-muted-foreground" />
              <span>Reset Filter Divisi ({divisionBottleneckFilter})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {/* 1. FPB */}
          <button
            type="button"
            onClick={() =>
              setDivisionBottleneckFilter(divisionBottleneckFilter === 'FPB' ? null : 'FPB')
            }
            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
              divisionBottleneckFilter === 'FPB'
                ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-muted/40 hover:bg-muted/70 border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-emerald-700 dark:text-emerald-400">
                1. FPB
              </span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2">
              <div className="text-lg font-bold font-mono text-foreground">
                {dailyMetrics.bottleneckCounts.FPB}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dailyMetrics.bottleneckCounts.FPB > 0 ? 'Belum Verifikasi' : 'Tuntas'}
              </span>
            </div>
          </button>

          {/* 2. PCH */}
          <button
            type="button"
            onClick={() =>
              setDivisionBottleneckFilter(divisionBottleneckFilter === 'PCH' ? null : 'PCH')
            }
            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
              divisionBottleneckFilter === 'PCH'
                ? 'bg-sky-500/10 border-sky-500 ring-2 ring-sky-500/30'
                : 'bg-muted/40 hover:bg-muted/70 border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-sky-700 dark:text-sky-400">
                2. PCH
              </span>
              <span className="size-2 rounded-full bg-sky-500" />
            </div>
            <div className="mt-2">
              <div className="text-lg font-bold font-mono text-foreground">
                {dailyMetrics.bottleneckCounts.PCH}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dailyMetrics.bottleneckCounts.PCH > 0 ? 'Delivery/FSTB Belum' : 'Tuntas'}
              </span>
            </div>
          </button>

          {/* 3. LOG */}
          <button
            type="button"
            onClick={() =>
              setDivisionBottleneckFilter(divisionBottleneckFilter === 'LOG' ? null : 'LOG')
            }
            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
              divisionBottleneckFilter === 'LOG'
                ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30'
                : 'bg-muted/40 hover:bg-muted/70 border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-purple-700 dark:text-purple-400">
                3. LOG
              </span>
              <span className="size-2 rounded-full bg-purple-500" />
            </div>
            <div className="mt-2">
              <div className="text-lg font-bold font-mono text-foreground">
                {dailyMetrics.bottleneckCounts.LOG}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dailyMetrics.bottleneckCounts.LOG > 0 ? 'Menunggu TTB' : 'Tuntas'}
              </span>
            </div>
          </button>

          {/* 4. LAP */}
          <button
            type="button"
            onClick={() =>
              setDivisionBottleneckFilter(divisionBottleneckFilter === 'LAP' ? null : 'LAP')
            }
            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
              divisionBottleneckFilter === 'LAP'
                ? 'bg-orange-500/10 border-orange-500 ring-2 ring-orange-500/30'
                : 'bg-muted/40 hover:bg-muted/70 border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-orange-700 dark:text-orange-400">
                4. LAP
              </span>
              <span className="size-2 rounded-full bg-orange-500" />
            </div>
            <div className="mt-2">
              <div className="text-lg font-bold font-mono text-foreground">
                {dailyMetrics.bottleneckCounts.LAP}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dailyMetrics.bottleneckCounts.LAP > 0 ? 'Belum Diantar' : 'Tuntas'}
              </span>
            </div>
          </button>

          {/* 5. ADM */}
          <button
            type="button"
            onClick={() =>
              setDivisionBottleneckFilter(divisionBottleneckFilter === 'ADM' ? null : 'ADM')
            }
            className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
              divisionBottleneckFilter === 'ADM'
                ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-muted/40 hover:bg-muted/70 border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-emerald-700 dark:text-emerald-400">
                5. ADM
              </span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2">
              <div className="text-lg font-bold font-mono text-foreground">
                {dailyMetrics.bottleneckCounts.ADM}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {dailyMetrics.bottleneckCounts.ADM > 0 ? 'SPP Belum Terbit' : 'Tuntas'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TABLE: TRANSAKSI HARIAN & STATUS 5 SEKSI
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden space-y-0">
        {/* Table Filter & Search Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">
              Daftar Transaksi ({filteredList.length})
            </span>
            {trafficFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                Filter: {trafficFilter}
              </span>
            )}
            {divisionBottleneckFilter && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Kendala Seksi: {divisionBottleneckFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari FPB, PO, Kapal, PIC..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary transition"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredList.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
              <CalendarDays className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Tidak ada transaksi tercatat pada {selectedFormattedDate}
              </h4>
              <p className="text-xs text-muted-foreground">
                Coba pilih tanggal aktivitas lain yang tersedia atau reset filter pencarian Anda.
              </p>
            </div>
            <button
              onClick={handleSelectLatestAvailable}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              Lihat Data Terakhir ({formatDateDdMmYy(defaultIsoDate)})
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                  <th className="py-2.5 px-3 whitespace-nowrap">No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">No. FPB &amp; Entitas</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Armada / Kapal</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">No. PO &amp; Tgl</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Item &amp; PIC</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Status Alur 5 Seksi</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Kendala / Rincian &ldquo;Belum&rdquo;</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedList.map(({ item, wf, pendingBelumDetails }, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const fpb = item.fpb || '-';
                  const po = item.po || item.noPo || '-';
                  const armada = (item as any).armada || (item as any).deptArmada || '-';

                  return (
                    <tr
                      key={item.id || `${fpb}-${idx}`}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* No */}
                      <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                        {globalIdx}
                      </td>

                      {/* No. FPB & Entitas */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <span className="font-bold font-mono text-foreground block truncate">
                          {fpb}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.entity || 'CPG'}
                        </span>
                      </td>

                      {/* Armada / Kapal */}
                      <td className="py-2.5 px-3 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <Ship className="size-3 text-sky-500 shrink-0" />
                          <span className="font-medium text-foreground truncate" title={armada}>
                            {armada}
                          </span>
                        </div>
                      </td>

                      {/* No. PO & Tgl */}
                      <td className="py-2.5 px-3 min-w-[130px]">
                        <span className="font-mono text-foreground block truncate" title={po}>
                          {po !== '-' ? po : <span className="text-muted-foreground italic">Menunggu PO</span>}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatDateDdMmYy(item.tglPo || item.date)}
                        </span>
                      </td>

                      {/* Item & PIC */}
                      <td className="py-2.5 px-3 min-w-[160px] max-w-[220px]">
                        <span className="text-foreground block truncate" title={item.item}>
                          {item.item || '-'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          PIC: {item.picAktif || item.picPch || '-'}
                        </span>
                      </td>

                      {/* Status Alur 5 Seksi Traffic Light */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center">
                          <WorkflowTrafficLight
                            item={item}
                            compact={true}
                            showBadge={true}
                            onClick={() => onOpenAudit?.(item.fpb, item.po || item.noPo)}
                          />
                        </div>
                      </td>

                      {/* Kendala / Rincian Belum */}
                      <td className="py-2.5 px-3 min-w-[200px] max-w-[280px]">
                        {wf.isComplete ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Lengkap (5/5 Selesai)</span>
                          </span>
                        ) : pendingBelumDetails.length > 0 ? (
                          <div className="space-y-0.5">
                            {pendingBelumDetails.slice(0, 2).map((det, dIdx) => (
                              <div
                                key={dIdx}
                                className="text-[10.5px] font-mono text-amber-700 dark:text-amber-300 leading-tight truncate"
                                title={det}
                              >
                                • {det}
                              </div>
                            ))}
                            {pendingBelumDetails.length > 2 && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                +{pendingBelumDetails.length - 2} kendala lainnya
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-muted-foreground italic">
                            Belum Dimulai
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onOpenAudit?.(item.fpb, item.po || item.noPo)}
                          className="h-7 px-2.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border text-[11px] font-medium transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                          title="Buka Audit Rinci 5 Seksi"
                        >
                          <span>Audit</span>
                          <ArrowRight className="size-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredList.length > pageSize && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
            <span className="font-mono">
              Halaman {currentPage} dari {totalPages} ({filteredList.length} transaksi)
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2 font-mono font-bold text-foreground">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-card disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

