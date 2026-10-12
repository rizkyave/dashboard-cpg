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
  X,
  Building2,
  Package,
  User,
  Filter,
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

type TrafficFilterType = 'ALL' | 'COMPLETE' | 'STUCK';
type FunnelStageCode = 'FPB' | 'PCH' | 'LOG' | 'LAP' | 'ADM';

interface PrimaryBottleneck {
  stageCode: FunnelStageCode | 'NONE';
  stageName: string;
  reason: string;
  responsiblePic: string;
  isStuck: boolean;
}

export default function DailyAnalyticsReport({
  items,
  armadaItems = [],
  onOpenAudit,
  showToast,
  className = '',
}: DailyAnalyticsReportProps) {
  // 1. Gabungkan seluruh data transaksi unik tanpa duplikasi
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

  // 2. Kumpulkan daftar tanggal unik berurutan kronologis descending
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
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [trafficFilter, setTrafficFilter] = useState<TrafficFilterType>('ALL');
  const [activeFunnelStage, setActiveFunnelStage] = useState<FunnelStageCode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const pageSize = 12;

  const selectedFormattedDate = useMemo(() => formatDateDdMmYy(selectedIsoDate), [selectedIsoDate]);

  // Filter transaksi berdasarkan tanggal aktivitas terpilih
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
  }, [allTransactions, selectedIsoDate, entityFilter]);

  // Evaluasi mendalam alur 5 seksi & deteksi Primary Bottleneck yang akurat
  const dailyEvaluatedItems = useMemo(() => {
    return dailyTransactions.map((item) => {
      const wf = evaluateFiveDivisionWorkflow(item);

      // Hitung lapse / aging days
      let agingDays = typeof item.lapse === 'number' && item.lapse > 0 ? item.lapse : 0;
      if (!agingDays && item.tglPo) {
        const poDate = extractDateInfo(item.tglPo).timestamp;
        if (poDate > 0) {
          agingDays = Math.max(0, Math.floor((Date.now() - poDate) / (1000 * 60 * 60 * 24)));
        }
      }

      // Tentukan PRIMARY BOTTLENECK secara presisi & berurutan (FPB -> PCH -> LOG -> LAP -> ADM)
      let primaryBottleneck: PrimaryBottleneck;

      if (wf.isComplete) {
        primaryBottleneck = {
          stageCode: 'NONE',
          stageName: 'Tuntas',
          reason: 'Lengkap 5/5 Seksi',
          responsiblePic: '-',
          isStuck: false,
        };
      } else {
        // Cari tahapan pertama yang parsial (ada tulisan "Belum")
        const partialStage = wf.stages.find((s) => s.isPartial);

        if (partialStage) {
          let pic = item.picAktif || '-';
          if (partialStage.code === 'FPB') pic = item.picAktif || 'Pemohon';
          else if (partialStage.code === 'PCH') pic = item.picPch || item.picAktif || 'Purchasing';
          else if (partialStage.code === 'LOG') pic = item.picTtb || item.picAktif || 'Gudang';
          else if (partialStage.code === 'LAP') pic = item.picLap || item.picAktif || 'Lapangan';
          else if (partialStage.code === 'ADM') pic = item.picAdm || item.picAktif || 'Finance/Kasir';

          primaryBottleneck = {
            stageCode: partialStage.code as FunnelStageCode,
            stageName: partialStage.name,
            reason: partialStage.statusText,
            responsiblePic: pic,
            isStuck: true,
          };
        } else {
          // Jika tidak ada yang parsial, cari tahapan pertama yang belum dimulai
          const firstUnpassedStage = wf.stages.find((s) => !s.isPassed);
          if (firstUnpassedStage) {
            let pic = item.picAktif || '-';
            let reasonText = `Menunggu ${firstUnpassedStage.name}`;
            if (firstUnpassedStage.code === 'PCH') {
              pic = item.picPch || item.picAktif || 'Purchasing';
              reasonText = 'Menunggu Penerbitan PO';
            } else if (firstUnpassedStage.code === 'LOG') {
              pic = item.picTtb || item.picAktif || 'Gudang';
              reasonText = 'Menunggu Penerimaan TTB';
            } else if (firstUnpassedStage.code === 'LAP') {
              pic = item.picLap || item.picAktif || 'Lapangan';
              reasonText = 'Menunggu Diantar ke Kapal';
            } else if (firstUnpassedStage.code === 'ADM') {
              pic = item.picAdm || item.picAktif || 'Finance/Kasir';
              reasonText = 'Menunggu SPP Kasir';
            }

            primaryBottleneck = {
              stageCode: firstUnpassedStage.code as FunnelStageCode,
              stageName: firstUnpassedStage.name,
              reason: reasonText,
              responsiblePic: pic,
              isStuck: true,
            };
          } else {
            primaryBottleneck = {
              stageCode: 'NONE',
              stageName: 'Tuntas',
              reason: 'Selesai',
              responsiblePic: '-',
              isStuck: false,
            };
          }
        }
      }

      return {
        item,
        wf,
        primaryBottleneck,
        agingDays,
      };
    });
  }, [dailyTransactions]);

  // Metrik KPI Eksekutif & Bottleneck Funnel Tracker
  const dailyMetrics = useMemo(() => {
    const total = dailyEvaluatedItems.length;
    let completeCount = 0;
    let stuckCount = 0;

    const funnelCounts: Record<FunnelStageCode, { stuck: 0; name: string; action: string }> = {
      FPB: { stuck: 0, name: 'FPB Permintaan', action: 'Verifikasi Pemohon' },
      PCH: { stuck: 0, name: 'PCH Purchasing', action: 'Delivery PO / FSTB' },
      LOG: { stuck: 0, name: 'LOG Gudang', action: 'Penerimaan TTB' },
      LAP: { stuck: 0, name: 'LAP Lapangan', action: 'Serah Terima Fisik' },
      ADM: { stuck: 0, name: 'ADM Administrasi', action: 'Penerbitan SPP Kasir' },
    };

    const vesselsSet = new Set<string>();

    for (const { item, primaryBottleneck, wf } of dailyEvaluatedItems) {
      if (wf.isComplete) {
        completeCount++;
      } else {
        stuckCount++;
      }

      if (primaryBottleneck.isStuck && primaryBottleneck.stageCode !== 'NONE') {
        funnelCounts[primaryBottleneck.stageCode].stuck++;
      }

      const vessel = (item as any).armada || (item as any).deptArmada || '';
      if (vessel && vessel !== '-' && vessel.trim().toLowerCase() !== 'non-armada') {
        vesselsSet.add(vessel.trim());
      }
    }

    const completionRate = total > 0 ? Math.round((completeCount / total) * 100) : 0;

    return {
      total,
      completeCount,
      stuckCount,
      completionRate,
      funnelCounts,
      vesselsCount: vesselsSet.size,
      vesselList: Array.from(vesselsSet),
    };
  }, [dailyEvaluatedItems]);

  // Filter daftar data berdasarkan interaksi pengguna
  const filteredList = useMemo(() => {
    return dailyEvaluatedItems.filter(({ item, wf, primaryBottleneck }) => {
      // Filter KPI
      if (trafficFilter === 'COMPLETE' && !wf.isComplete) return false;
      if (trafficFilter === 'STUCK' && wf.isComplete) return false;

      // Filter Funnel Stage
      if (activeFunnelStage && primaryBottleneck.stageCode !== activeFunnelStage) {
        return false;
      }

      // Filter Pencarian Global
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpb = (item.fpb || '').toLowerCase();
        const po = (item.po || (item as any).noPo || '').toLowerCase();
        const itName = (item.item || '').toLowerCase();
        const pic = (item.picAktif || item.picPch || item.picTtb || primaryBottleneck.responsiblePic || '').toLowerCase();
        const armada = ((item as any).armada || (item as any).deptArmada || '').toLowerCase();
        const ent = (item.entity || '').toLowerCase();
        const bottleneckText = primaryBottleneck.reason.toLowerCase();

        return (
          fpb.includes(q) ||
          po.includes(q) ||
          itName.includes(q) ||
          pic.includes(q) ||
          armada.includes(q) ||
          ent.includes(q) ||
          bottleneckText.includes(q)
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

  // Navigasi Tanggal
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

  // Reset semua filter
  const handleResetFilters = () => {
    setTrafficFilter('ALL');
    setActiveFunnelStage(null);
    setSearchQuery('');
    setEntityFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    trafficFilter !== 'ALL' ||
    activeFunnelStage !== null ||
    searchQuery.trim() !== '' ||
    entityFilter !== 'ALL';

  // Salin Rekap WhatsApp
  const handleCopyWhatsApp = () => {
    const topStuckItems = dailyEvaluatedItems
      .filter(({ wf }) => !wf.isComplete)
      .slice(0, 4);

    const text = `📋 *LAPORAN HARIAN SUPPLY CHAIN & LOGISTIK CPG*
📅 *Tanggal Aktivitas:* ${selectedFormattedDate} (${selectedIsoDate})
🏢 *Filter Entitas:* ${entityFilter === 'ALL' ? 'Semua Entitas' : entityFilter}

📊 *RINGKASAN EKSEKUTIF:*
• Total Berkas Aktif: *${dailyMetrics.total} Dokumen*
• 🟢 Tuntas Lengkap (100%): *${dailyMetrics.completeCount} Dokumen (${dailyMetrics.completionRate}%)*
• ⚠️ Tertahan / Butuh Tindak Lanjut: *${dailyMetrics.stuckCount} Dokumen*
• 🚢 Armada Terdampak: *${dailyMetrics.vesselsCount} Kapal/Unit*

🚦 *DISTRIBUSI KENDALA PER TAHAP:*
1. FPB (Permintaan): ${dailyMetrics.funnelCounts.FPB.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.FPB.stuck} berkas* (Verifikasi Pemohon)` : '✅ Lancar'}
2. PCH (Purchasing): ${dailyMetrics.funnelCounts.PCH.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.PCH.stuck} berkas* (Delivery/FSTB Belum)` : '✅ Lancar'}
3. LOG (Gudang/TTB): ${dailyMetrics.funnelCounts.LOG.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.LOG.stuck} berkas* (Menunggu TTB)` : '✅ Lancar'}
4. LAP (Lapangan): ${dailyMetrics.funnelCounts.LAP.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.LAP.stuck} berkas* (Serah Terima Fisik)` : '✅ Lancar'}
5. ADM (SPP Kasir): ${dailyMetrics.funnelCounts.ADM.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.ADM.stuck} berkas* (SPP Belum Terbit)` : '✅ Lancar'}
${
  topStuckItems.length > 0
    ? `\n🚨 *PRIORITAS PERCEPATAN HARI INI:*
${topStuckItems
  .map(
    ({ item, primaryBottleneck, agingDays }, idx) =>
      `${idx + 1}. *FPB:* ${item.fpb} (${(item as any).armada || (item as any).deptArmada || '-'})
   └ Kendala: [${primaryBottleneck.stageCode}] ${primaryBottleneck.reason}
   └ PIC: ${primaryBottleneck.responsiblePic} | Aging: ${agingDays} Hari`
  )
  .join('\n')}`
    : '\n✅ Seluruh dokumen pada tanggal ini berstatus tuntas!'
}

_Dashboard Operasional CPG - Sistem Monitoring Alur 5 Seksi_`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        showToast?.('Format pesan WhatsApp berhasil disalin ke clipboard!', 'success');
      });
    }
  };

  // Unduh CSV
  const handleDownloadCsv = () => {
    if (filteredList.length === 0) {
      showToast?.('Tidak ada data transaksi untuk diekspor.', 'warning');
      return;
    }
    const headers = [
      'NO',
      'NO FPB',
      'ENTITAS',
      'ARMADA',
      'ITEM / DESKRIPSI',
      'NO PO',
      'TGL PO',
      'PIC TANGGUNG JAWAB',
      'STATUS PROGRESS',
      'KENDALA TERKINI',
      'AGING (HARI)',
    ];
    const rows = filteredList.map(({ item, wf, primaryBottleneck, agingDays }, idx) => [
      idx + 1,
      `"${item.fpb || '-'}"`,
      `"${item.entity || '-'}"`,
      `"${(item as any).armada || (item as any).deptArmada || '-'}"`,
      `"${(item.item || '').replace(/"/g, '""')}"`,
      `"${item.po || (item as any).noPo || '-'}"`,
      `"${formatDateDdMmYy(item.tglPo || item.date)}"`,
      `"${primaryBottleneck.responsiblePic || '-'}"`,
      `"${wf.summaryBadge}"`,
      `"${primaryBottleneck.reason}"`,
      agingDays,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Harian_CPG_${selectedIsoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('File CSV berhasil diunduh.', 'success');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ═══════════════════════════════════════════════════════════
          1. HEADER & CONTROL HUB
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Baris Atas: Judul & Tombol Aksi Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
                Monitoring berkas aktif, pipeline kendala seksi, dan aging SLA operasional armada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title="Salin ringkasan pesan ke clipboard format WhatsApp"
            >
              {isCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              <span>{isCopied ? 'Tersalin ke WA!' : 'Salin Ringkasan WhatsApp'}</span>
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

        {/* Baris Bawah: Unified Filter Toolbar */}
        <div className="pt-3 border-t border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segment Filter Tanggal */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                disabled={currentIdx >= availableDates.length - 1}
                className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Hari Sebelumnya"
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
                title="Hari Berikutnya"
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
              className={`h-8.5 px-2.5 rounded-xl text-xs font-mono font-medium border transition ${
                selectedIsoDate === defaultIsoDate
                  ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
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
              className="h-8.5 px-2.5 rounded-xl text-xs font-mono font-medium bg-card hover:bg-muted text-muted-foreground border border-border transition"
            >
              Hari Ini
            </button>
          </div>

          {/* Segment Filter Entitas & Global Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari FPB, PO, Kapal, PIC, Kendala..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8.5 pl-8 pr-7 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8.5 pl-3 pr-8 rounded-xl bg-card border border-border text-xs text-foreground font-medium focus:outline-hidden cursor-pointer"
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

        {/* Active Filter Chips / Reset Bar */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                <Filter className="size-3 text-primary" />
                Filter Aktif:
              </span>

              {entityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-muted border border-border text-foreground">
                  Entitas: {entityFilter}
                  <button onClick={() => setEntityFilter('ALL')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {trafficFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-primary/10 border border-primary/20 text-primary">
                  Status: {trafficFilter === 'COMPLETE' ? 'Tuntas 100%' : 'Tertahan'}
                  <button onClick={() => setTrafficFilter('ALL')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {activeFunnelStage && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                  Tahap: {activeFunnelStage}
                  <button onClick={() => setActiveFunnelStage(null)} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-muted border border-border text-foreground">
                  &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        )}
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
          onClick={() => setTrafficFilter(trafficFilter === 'COMPLETE' ? 'ALL' : 'COMPLETE')}
          className={`p-4.5 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-emerald-500/60 ${
            trafficFilter === 'COMPLETE'
              ? 'ring-2 ring-emerald-500/40 border-emerald-500 bg-emerald-500/5'
              : 'border-emerald-500/30'
          }`}
          title="Klik untuk memfilter berkas tuntas"
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold">
            <span>BERKAS TUNTAS (100%)</span>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {dailyMetrics.completeCount}
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
          onClick={() => setTrafficFilter(trafficFilter === 'STUCK' ? 'ALL' : 'STUCK')}
          className={`p-4.5 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-amber-500/60 ${
            trafficFilter === 'STUCK'
              ? 'ring-2 ring-amber-500/40 border-amber-500 bg-amber-500/5'
              : 'border-amber-500/30'
          }`}
          title="Klik untuk memfilter berkas tertahan"
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-mono font-bold">
            <span>TERTAHAN / BUTUH ACTION</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                {dailyMetrics.stuckCount}
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
              {dailyMetrics.vesselList.length > 0
                ? `${dailyMetrics.vesselList.slice(0, 2).join(', ')}${
                    dailyMetrics.vesselList.length > 2 ? ` +${dailyMetrics.vesselList.length - 2} lainnya` : ''
                  }`
                : 'Tidak ada armada aktif'}
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
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Klik pada salah satu tahapan pipeline untuk memfilter tabel ke berkas yang tertahan di tahap tersebut:
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

        {/* Pipeline Stepper Horizontal */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
          {[
            { code: 'FPB' as FunnelStageCode, num: 1, name: 'Permintaan FPB', sub: 'Verifikasi' },
            { code: 'PCH' as FunnelStageCode, num: 2, name: 'Purchasing / PO', sub: 'Delivery/FSTB' },
            { code: 'LOG' as FunnelStageCode, num: 3, name: 'Logistik / Gudang', sub: 'Dokumen TTB' },
            { code: 'LAP' as FunnelStageCode, num: 4, name: 'Tim Lapangan', sub: 'Serah Terima' },
            { code: 'ADM' as FunnelStageCode, num: 5, name: 'Administrasi', sub: 'SPP Kasir' },
          ].map((stage) => {
            const stuckCount = dailyMetrics.funnelCounts[stage.code].stuck;
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
                    ? 'bg-muted/20 hover:bg-muted/40 border-border/80'
                    : 'bg-card hover:border-amber-400/80 border-border shadow-xs'
                }`}
              >
                {/* Header Kartu Stepper */}
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

                {/* Angka & Status */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-extrabold font-mono text-foreground">
                      {stuckCount}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded ${
                        isClean
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {isClean ? 'Lancar' : 'Tertahan'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono leading-tight mt-1 truncate text-muted-foreground">
                    {stage.sub}
                  </div>
                </div>
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
                Filter: {trafficFilter === 'COMPLETE' ? 'Tuntas 100%' : 'Tertahan'}
              </span>
            )}
            {activeFunnelStage && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Tahap: {activeFunnelStage}
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
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Tidak ada transaksi yang cocok
              </h4>
              <p className="text-xs text-muted-foreground">
                Tidak ditemukan data dengan filter saat ini pada tanggal {selectedFormattedDate}.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                  <th className="py-3 px-3 text-center whitespace-nowrap w-12">No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[140px]">Dokumen &amp; Entitas</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[140px]">Armada / Kapal</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[180px] max-w-[240px]">Deskripsi Barang</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[130px]">PIC Bertanggung Jawab</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap min-w-[150px]">Progress (5 Seksi)</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[200px]">Bottleneck Terkini</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap w-28">Aging SLA</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedList.map(({ item, wf, primaryBottleneck, agingDays }, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const fpb = item.fpb || '-';
                  const po = item.po || (item as any).noPo || '-';
                  const armada = (item as any).armada || (item as any).deptArmada || '-';
                  const itemName = item.item || '-';

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
                      {/* 1. No */}
                      <td className="py-3 px-3 font-mono text-muted-foreground text-[11px] text-center">
                        {globalIdx}
                      </td>

                      {/* 2. Dokumen & Entitas */}
                      <td className="py-3 px-3.5">
                        <span className="font-bold font-mono text-foreground block truncate" title={fpb}>
                          {fpb}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                            {item.entity || 'CPG'}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            PO: {po !== '-' ? po : 'Belum'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Armada / Kapal */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <Ship className="size-3 text-sky-500 shrink-0" />
                          <span className="font-medium text-foreground truncate" title={armada}>
                            {armada}
                          </span>
                        </div>
                      </td>

                      {/* 4. Deskripsi Barang */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-start gap-1.5">
                          <Package className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-foreground block truncate font-medium" title={itemName}>
                              {itemName}
                            </span>
                            {(item.qtyFPB || item.qtyPO) && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Qty: {item.qtyPO || item.qtyFPB}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. PIC Bertanggung Jawab */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground truncate" title={primaryBottleneck.responsiblePic}>
                            {primaryBottleneck.responsiblePic !== '-' ? primaryBottleneck.responsiblePic : (item.picAktif || '-')}
                          </span>
                        </div>
                      </td>

                      {/* 6. Progress Alur (5 Seksi) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center">
                          <WorkflowTrafficLight
                            item={item}
                            compact={true}
                            showBadge={false}
                            onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                          />
                        </div>
                      </td>

                      {/* 7. Bottleneck Terkini */}
                      <td className="py-3 px-3.5">
                        {wf.isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Tuntas Lengkap (5/5)</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 max-w-full">
                            <span className="font-bold shrink-0">[{primaryBottleneck.stageCode}]</span>
                            <span className="truncate" title={primaryBottleneck.reason}>
                              {primaryBottleneck.reason}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 8. Durasi Macet / SLA Aging */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${slaBadgeClass}`}
                        >
                          <Clock className="size-3 shrink-0" />
                          <span>{wf.isComplete ? 'Selesai' : `${agingDays} Hari`}</span>
                        </span>
                      </td>

                      {/* 9. Aksi Audit */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                          className="h-7 px-2.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border text-[11px] font-medium transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
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
