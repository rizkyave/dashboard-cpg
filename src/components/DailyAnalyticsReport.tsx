'use client';

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Download,
  Share2,
  Ship,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { extractDateInfo, formatDateDdMmYy } from '@/utils/formatDate';
import WorkflowTrafficLight from './WorkflowTrafficLight';
import {
  evaluateFiveDivisionWorkflow,
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
  // 1. Gabungkan seluruh data transaksi unik
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

  // 2. Daftar tanggal unik berurutan kronologis descending
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

  const defaultIsoDate = useMemo(() => {
    return availableDates.length > 0 ? availableDates[0].fullDate : new Date().toISOString().split('T')[0];
  }, [availableDates]);

  // States
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(defaultIsoDate);
  const [dateBasis, setDateBasis] = useState<DateBasisFilter>('ALL_ACTIVITY');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [trafficFilter, setTrafficFilter] = useState<TrafficLightFilter>('ALL');
  const [activeFunnelStage, setActiveFunnelStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const pageSize = 15;

  const selectedFormattedDate = useMemo(() => formatDateDdMmYy(selectedIsoDate), [selectedIsoDate]);

  // Filter transaksi berdasarkan tanggal terpilih
  const dailyTransactions = useMemo(() => {
    if (!selectedIsoDate) return [];

    return allTransactions.filter((it) => {
      if (entityFilter !== 'ALL') {
        const itemEnt = (it.entity || '').toUpperCase();
        if (itemEnt !== entityFilter.toUpperCase()) return false;
      }

      const matchesDate = (rawDate?: string | number | null) => {
        if (!hasValue(rawDate)) return false;
        return extractDateInfo(rawDate).fullDate === selectedIsoDate;
      };

      if (dateBasis === 'PO_DATE') return matchesDate(it.tglPo) || matchesDate(it.date);
      if (dateBasis === 'FPB_DATE') return matchesDate(it.tglFpb);
      if (dateBasis === 'TTB_DATE') return matchesDate(it.tglTtb) || matchesDate(it.tglInputTtb);
      if (dateBasis === 'KEU_DATE') return matchesDate(it.tglKeKeuangan) || matchesDate(it.tglSpp) || matchesDate(it.tglInputSpp);

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

  // Evaluasi alur 5 seksi & deteksi kendala
  const dailyEvaluatedItems = useMemo(() => {
    return dailyTransactions.map((item) => {
      const wf = evaluateFiveDivisionWorkflow(item);
      const pendingBelumDetails: { stage: string; text: string; detail: string }[] = [];

      for (const st of wf.stages) {
        if (st.isPartial) {
          pendingBelumDetails.push({ stage: st.code, text: st.statusText, detail: st.detail });
        } else if (!st.isPassed) {
          pendingBelumDetails.push({ stage: st.code, text: 'Belum Dimulai', detail: st.detail });
        }
      }

      // Hitung lapse / aging days
      let agingDays = typeof item.lapse === 'number' && item.lapse > 0 ? item.lapse : 0;
      if (!agingDays && item.tglPo) {
        const poDate = extractDateInfo(item.tglPo).timestamp;
        if (poDate > 0) {
          agingDays = Math.max(0, Math.floor((Date.now() - poDate) / (1000 * 60 * 60 * 24)));
        }
      }

      return {
        item,
        wf,
        pendingBelumDetails,
        agingDays,
      };
    });
  }, [dailyTransactions]);

  // Metrik KPI & Funnel
  const dailyMetrics = useMemo(() => {
    const total = dailyEvaluatedItems.length;
    let fullCount = 0;
    let partialCount = 0;
    let offCount = 0;

    const funnelCounts = {
      FPB: { stuck: 0, label: 'Belum Verifikasi' },
      PCH: { stuck: 0, label: 'Delivery/FSTB Belum' },
      LOG: { stuck: 0, label: 'Menunggu TTB' },
      LAP: { stuck: 0, label: 'Belum Diantar' },
      ADM: { stuck: 0, label: 'SPP Belum Terbit' },
    };

    const vesselsSet = new Set<string>();

    for (const { item, wf } of dailyEvaluatedItems) {
      if (wf.isComplete) fullCount++;
      else if (wf.passedCount === 0) offCount++;
      else partialCount++;

      for (const st of wf.stages) {
        if (st.isPartial && funnelCounts[st.code as keyof typeof funnelCounts]) {
          funnelCounts[st.code as keyof typeof funnelCounts].stuck++;
        }
      }

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
      funnelCounts,
      vesselsCount: vesselsSet.size,
      vesselList: Array.from(vesselsSet),
    };
  }, [dailyEvaluatedItems]);

  // Filter daftar transaksi
  const filteredList = useMemo(() => {
    return dailyEvaluatedItems.filter(({ item, wf }) => {
      if (trafficFilter === 'FULL' && !wf.isComplete) return false;
      if (trafficFilter === 'PARTIAL' && (wf.isComplete || wf.passedCount === 0)) return false;
      if (trafficFilter === 'OFF' && wf.passedCount > 0) return false;

      if (activeFunnelStage) {
        const stage = wf.stages.find((s) => s.code === activeFunnelStage);
        if (!stage || !stage.isPartial) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpb = (item.fpb || '').toLowerCase();
        const po = (item.po || (item as any).noPo || '').toLowerCase();
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
  }, [dailyEvaluatedItems, trafficFilter, activeFunnelStage, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Navigasi tanggal
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

  // Salin WhatsApp
  const handleCopyWhatsApp = () => {
    const text = `📋 *LAPORAN HARIAN SUPPLY CHAIN & LOGISTIK CPG*
📅 *Tanggal:* ${selectedFormattedDate} (${selectedIsoDate})
🏢 *Entitas:* ${entityFilter === 'ALL' ? 'Semua Entitas' : entityFilter}

📊 *EXECUTIVE SUMMARY:*
• Total Berkas Aktif: *${dailyMetrics.total} Dokumen*
• 🟢 Tuntas (5/5 Lengkap): *${dailyMetrics.fullCount} Dokumen (${dailyMetrics.completionRate}%)*
• ◐ Tertahan / Perlu Tindak Lanjut: *${dailyMetrics.partialCount} Dokumen*
• 🚢 Armada Terdampak: *${dailyMetrics.vesselsCount} Kapal/Unit*

🚦 *BOTTLENECK PER TAHAP:*
1. FPB (Permintaan): ${dailyMetrics.funnelCounts.FPB.stuck > 0 ? `⚠️ ${dailyMetrics.funnelCounts.FPB.stuck} belum terverifikasi` : '✅ Lancar'}
2. PCH (Purchasing): ${dailyMetrics.funnelCounts.PCH.stuck > 0 ? `⚠️ ${dailyMetrics.funnelCounts.PCH.stuck} Delivery/FSTB Belum Terbit` : '✅ Lancar'}
3. LOG (Gudang/TTB): ${dailyMetrics.funnelCounts.LOG.stuck > 0 ? `⚠️ ${dailyMetrics.funnelCounts.LOG.stuck} Menunggu Dokumen TTB` : '✅ Lancar'}
4. LAP (Lapangan): ${dailyMetrics.funnelCounts.LAP.stuck > 0 ? `⚠️ ${dailyMetrics.funnelCounts.LAP.stuck} Belum Diantar/Serah Terima` : '✅ Lancar'}
5. ADM (SPP Kasir): ${dailyMetrics.funnelCounts.ADM.stuck > 0 ? `⚠️ ${dailyMetrics.funnelCounts.ADM.stuck} SPP Belum Terbit` : '✅ Lancar'}

⚠️ *TOP 3 BERKAS MEMBUTUHKAN PERCEPATAN:*
${dailyEvaluatedItems
  .filter(({ wf }) => wf.passedCount > 0 && !wf.isComplete)
  .slice(0, 3)
  .map(
    ({ item, wf }, idx) =>
      `${idx + 1}. *FPB:* ${item.fpb} (${(item as any).armada || (item as any).deptArmada || '-'}) | Kendala: [${wf.stages.filter((s) => s.isPartial).map((s) => s.code).join(', ')}]`
  )
  .join('\n')}

_Dashboard CPG Web Operasional & Supply Chain._`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        showToast?.('Format pesan WhatsApp berhasil disalin!', 'success');
      });
    }
  };

  // Unduh CSV
  const handleDownloadCsv = () => {
    if (filteredList.length === 0) {
      showToast?.('Tidak ada data transaksi untuk diekspor.', 'warning');
      return;
    }
    const headers = ['NO', 'NO FPB', 'ENTITAS', 'ARMADA', 'ITEM', 'NO PO', 'TGL PO', 'PIC', 'AGING (HARI)', 'KENDALA'];
    const rows = filteredList.map(({ item, agingDays, pendingBelumDetails }, idx) => [
      idx + 1,
      `"${item.fpb || '-'}"`,
      `"${item.entity || '-'}"`,
      `"${(item as any).armada || (item as any).deptArmada || '-'}"`,
      `"${(item.item || '').replace(/"/g, '""')}"`,
      `"${item.po || (item as any).noPo || '-'}"`,
      `"${formatDateDdMmYy(item.tglPo || item.date)}"`,
      `"${item.picAktif || item.picPch || '-'}"`,
      agingDays,
      `"${pendingBelumDetails.map((p) => `${p.stage}: ${p.text}`).join('; ')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Daily_Report_CPG_${selectedIsoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('File CSV berhasil diunduh.', 'success');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ═══════════════════════════════════════════════════════════
          1. HEADER & CONTROL HUB
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Laporan Harian Operasional &amp; Alur 5 Seksi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitoring berkas aktif, pipeline kendala seksi, dan aging SLA pada tanggal aktivitas terpilih.
              </p>
            </div>
          </div>

          {/* Quick-Action Buttons */}
          <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title="Salin rekap eksekutif ke clipboard format WhatsApp"
            >
              {isCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              <span>{isCopied ? 'Tersalin!' : 'Salin Ringkasan WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="h-9 px-3.5 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Download className="size-4 text-muted-foreground" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Integrated Toolbar Filter */}
        <div className="pt-3 border-t border-border/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Picker & Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={handlePrevDay}
                disabled={currentIdx >= availableDates.length - 1}
                className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2.5">
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
                type="button"
                onClick={handleNextDay}
                disabled={currentIdx <= 0}
                className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (availableDates.length > 0) {
                  setSelectedIsoDate(availableDates[0].fullDate);
                  setCurrentPage(1);
                }
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
                selectedIsoDate === defaultIsoDate
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-card hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              Data Terakhir ({formatDateDdMmYy(defaultIsoDate)})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedIsoDate(new Date().toISOString().split('T')[0]);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-card hover:bg-muted text-muted-foreground border border-border transition"
            >
              Hari Ini
            </button>
          </div>

          {/* Search Global & Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari FPB, PO, Kapal, PIC..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8.5 pl-8 pr-3 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary transition"
              />
            </div>

            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 px-3 rounded-xl bg-card border border-border text-xs text-foreground font-medium focus:outline-hidden cursor-pointer"
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

      {/* ═══════════════════════════════════════════════════════════
          2. EXECUTIVE KPI CARDS (4 METRICS)
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Berkas Aktif */}
        <div className="p-4.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono font-medium">
            <span>TOTAL BERKAS AKTIF</span>
            <Layers className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.total}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aktivitas transaksi pada {selectedFormattedDate}
            </p>
          </div>
        </div>

        {/* Card 2: Berkas Tuntas (100%) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'FULL' ? 'ALL' : 'FULL')}
          className={`p-4.5 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-emerald-500/60 ${
            trafficFilter === 'FULL'
              ? 'ring-2 ring-emerald-500/40 border-emerald-500 bg-emerald-500/5'
              : 'border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold">
            <span>BERKAS TUNTAS (100%)</span>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {dailyMetrics.fullCount}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                {dailyMetrics.completionRate}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              5/5 seksi lengkap tanpa status &ldquo;Belum&rdquo;
            </p>
          </div>
        </div>

        {/* Card 3: Berkas Tertahan (Outstanding) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'PARTIAL' ? 'ALL' : 'PARTIAL')}
          className={`p-4.5 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-amber-500/60 ${
            trafficFilter === 'PARTIAL'
              ? 'ring-2 ring-amber-500/40 border-amber-500 bg-amber-500/5'
              : 'border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-mono font-bold">
            <span>TERTAHAN / BUTUH TINDAK LANJUT</span>
            <span className="text-sm font-bold leading-none text-amber-500">◐</span>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                {dailyMetrics.partialCount}
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                Outstanding
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Ada minimal 1 seksi masih bertuliskan &ldquo;Belum&rdquo;
            </p>
          </div>
        </div>

        {/* Card 4: Total Armada Terdampak */}
        <div className="p-4.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono font-medium">
            <span>ARMADA TERDAMPAK</span>
            <Ship className="size-4 text-sky-500" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.vesselsCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate" title={dailyMetrics.vesselList.join(', ')}>
              {dailyMetrics.vesselList.slice(0, 3).join(', ')}
              {dailyMetrics.vesselList.length > 3 ? ` +${dailyMetrics.vesselList.length - 3} lainnya` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. BOTTLENECK FUNNEL TRACKER (PIPELINE 5 SEKSI HORIZONTAL)
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>Bottleneck Funnel Tracker: Pipeline Alur 5 Seksi Berurutan</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Klik pada salah satu tahapan pipeline untuk memfilter tabel di bawah ke berkas yang tertahan di tahap tersebut:
            </p>
          </div>

          {activeFunnelStage && (
            <button
              type="button"
              onClick={() => setActiveFunnelStage(null)}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-mono flex items-center gap-1 self-start sm:self-auto transition cursor-pointer"
            >
              <RotateCcw className="size-3 text-muted-foreground" />
              <span>Reset Filter ({activeFunnelStage})</span>
            </button>
          )}
        </div>

        {/* Connected Horizontal Pipeline */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
          {[
            { code: 'FPB', num: 1, name: 'Permintaan / Verifikasi', color: 'emerald', sub: 'Belum Verifikasi' },
            { code: 'PCH', num: 2, name: 'Purchasing / PO', color: 'sky', sub: 'Delivery/FSTB Belum' },
            { code: 'LOG', num: 3, name: 'Logistik / Gudang', color: 'purple', sub: 'Menunggu TTB' },
            { code: 'LAP', num: 4, name: 'Lapangan / Fisik', color: 'orange', sub: 'Belum Diantar' },
            { code: 'ADM', num: 5, name: 'Administrasi / SPP', color: 'emerald', sub: 'SPP Belum Terbit' },
          ].map((stage, sIdx) => {
            const stuckCount = dailyMetrics.funnelCounts[stage.code as keyof typeof dailyMetrics.funnelCounts].stuck;
            const isSelected = activeFunnelStage === stage.code;
            const isClean = stuckCount === 0;

            return (
              <button
                key={stage.code}
                type="button"
                onClick={() => setActiveFunnelStage(isSelected ? null : stage.code)}
                className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                    : isClean
                    ? 'bg-muted/30 hover:bg-muted/60 border-border'
                    : 'bg-card hover:border-amber-400/80 border-border shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {stage.num}
                    </span>
                    <span className="text-xs font-bold font-mono text-foreground">
                      {stage.code}
                    </span>
                  </div>
                  {isClean ? (
                    <span className="size-2 rounded-full bg-emerald-500" title="Tuntas tanpa kendala" />
                  ) : (
                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" title="Ada berkas tertahan" />
                  )}
                </div>

                <div className="mt-2.5">
                  <div className="text-xl font-extrabold font-mono text-foreground">
                    {stuckCount}
                  </div>
                  <div className="text-[10px] font-mono leading-tight mt-0.5 truncate text-muted-foreground">
                    {isClean ? '✓ Tuntas Lancar' : stage.sub}
                  </div>
                </div>

                {/* Arrow Connector indicator (Desktop) */}
                {sIdx < 4 && (
                  <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/40">
                    ➔
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          4. INTERACTIVE DATA TABLE
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Table Toolbar Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/20 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground font-mono uppercase tracking-wider">
              Daftar Transaksi ({filteredList.length})
            </span>
            {trafficFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                Filter Status: {trafficFilter}
              </span>
            )}
            {activeFunnelStage && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Tahap Macet: {activeFunnelStage}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            Halaman {currentPage} dari {totalPages}
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
              <CalendarDays className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-semibold text-foreground">
                Tidak ada transaksi aktif pada {selectedFormattedDate}
              </h4>
              <p className="text-xs text-muted-foreground">
                Silakan ganti tanggal atau reset filter pencarian Anda.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                  <th className="py-3 px-3.5 whitespace-nowrap">No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Dokumen &amp; Entitas</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Armada / Kapal</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">PIC Bertanggung Jawab</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Progress Alur (5 Seksi)</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Bottleneck Terkini</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Durasi / SLA</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedList.map(({ item, wf, pendingBelumDetails, agingDays }, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const fpb = item.fpb || '-';
                  const po = item.po || (item as any).noPo || '-';
                  const armada = (item as any).armada || (item as any).deptArmada || '-';

                  // Badge warna SLA / Aging
                  const isSlaBreached = agingDays > 5;
                  const isSlaWarning = agingDays >= 3 && agingDays <= 5;
                  const slaBadgeClass = wf.isComplete
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : isSlaBreached
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                    : isSlaWarning
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';

                  return (
                    <tr
                      key={item.id || `${fpb}-${idx}`}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 font-mono text-muted-foreground text-[11px]">
                        {globalIdx}
                      </td>

                      {/* Dokumen & Entitas */}
                      <td className="py-3 px-3.5 min-w-[130px]">
                        <span className="font-bold font-mono text-foreground block truncate" title={fpb}>
                          {fpb}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                            {item.entity || 'CPG'}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            PO: {po !== '-' ? po : 'Belum Ada'}
                          </span>
                        </div>
                      </td>

                      {/* Armada / Kapal */}
                      <td className="py-3 px-3.5 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <Ship className="size-3 text-sky-500 shrink-0" />
                          <span className="font-medium text-foreground truncate" title={armada}>
                            {armada}
                          </span>
                        </div>
                      </td>

                      {/* PIC Bertanggung Jawab */}
                      <td className="py-3 px-3.5 min-w-[130px]">
                        <span className="font-medium text-foreground block truncate">
                          {item.picAktif || item.picPch || item.picTtb || '-'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {item.item ? item.item.slice(0, 20) : '-'}
                        </span>
                      </td>

                      {/* Progress Alur (5 Seksi) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center">
                          <WorkflowTrafficLight
                            item={item}
                            compact={true}
                            showBadge={true}
                            onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                          />
                        </div>
                      </td>

                      {/* Bottleneck Terkini */}
                      <td className="py-3 px-3.5 min-w-[210px] max-w-[280px]">
                        {wf.isComplete ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Tuntas Lengkap (5/5)</span>
                          </span>
                        ) : pendingBelumDetails.length > 0 ? (
                          <div className="space-y-0.5">
                            {pendingBelumDetails.slice(0, 2).map((det, dIdx) => (
                              <div
                                key={dIdx}
                                className="text-[10.5px] font-mono text-amber-700 dark:text-amber-300 leading-tight truncate"
                                title={`${det.stage}: ${det.text} [${det.detail}]`}
                              >
                                • <span className="font-bold">[{det.stage}]</span> {det.text}
                              </div>
                            ))}
                            {pendingBelumDetails.length > 2 && (
                              <span className="text-[10px] font-mono text-muted-foreground block">
                                +{pendingBelumDetails.length - 2} tahap belum selesai
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-muted-foreground italic">
                            Belum Dimulai
                          </span>
                        )}
                      </td>

                      {/* Durasi Macet / SLA Aging */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${slaBadgeClass}`}
                        >
                          <Clock className="size-3 shrink-0" />
                          <span>{wf.isComplete ? 'Selesai' : `${agingDays} Hari`}</span>
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                          className="h-7.5 px-3 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border text-[11px] font-medium transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
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
          <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20 flex-wrap gap-2">
            <span className="font-mono">
              Menampilkan {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredList.length)} dari {filteredList.length} transaksi
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2 font-mono font-bold text-foreground">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition"
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
