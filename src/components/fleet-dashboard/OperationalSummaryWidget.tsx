'use client';

import React from 'react';
import { KPIMetrics } from './types';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowDown,
  Timer,
  ChevronRight,
} from 'lucide-react';

interface OperationalSummaryWidgetProps {
  metrics: KPIMetrics;
  selectedPeriod: string;
  onScrollToGantt?: () => void;
}

export default function OperationalSummaryWidget({
  metrics,
  selectedPeriod,
  onScrollToGantt,
}: OperationalSummaryWidgetProps) {
  const processCount =
    metrics.processItemCount !== undefined
      ? metrics.processItemCount
      : 0;

  const total =
    metrics.completeItemCount +
    metrics.partialItemCount +
    metrics.backlogItemCount +
    processCount || 1;

  const pctLengkap = Math.round((metrics.completeItemCount / total) * 100);
  const pctParsial = Math.round((metrics.partialItemCount / total) * 100);
  const pctBacklog = Math.round((metrics.backlogItemCount / total) * 100);
  const pctProses = Math.max(0, 100 - pctLengkap - pctParsial - pctBacklog);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-md flex flex-col justify-between space-y-3 h-full">
      {/* Header Widget */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              STATUS OPERASIONAL &amp; SLA
            </h4>
            <p className="text-[11px] text-slate-400">
              Distribusi status berkas dan kepatuhan SLA siklus pengadaan.
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
          SLA Terpantau
        </span>
      </div>

      {/* Multi-Segment Distribution Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">Tingkat Penyelesaian Berkas</span>
          <span className="text-emerald-400 font-bold">{pctLengkap}% Selesai</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
            style={{ width: `${pctLengkap}%` }}
            title={`Lengkap: ${metrics.completeItemCount} (${pctLengkap}%)`}
          />
          <div
            className="h-full bg-sky-500"
            style={{ width: `${pctProses}%` }}
            title={`Proses: ${pctProses}%`}
          />
          <div
            className="h-full bg-amber-500"
            style={{ width: `${pctParsial}%` }}
            title={`Parsial: ${metrics.partialItemCount} (${pctParsial}%)`}
          />
          <div
            className="h-full bg-rose-500"
            style={{ width: `${pctBacklog}%` }}
            title={`Backlog: ${metrics.backlogItemCount} (${pctBacklog}%)`}
          />
        </div>
      </div>

      {/* 4 Status Pill Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-1.5">
          <div className="text-emerald-400 font-bold text-sm">{metrics.completeItemCount}</div>
          <div className="text-[10px] text-slate-400 font-sans">Selesai</div>
        </div>
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-1.5">
          <div className="text-sky-400 font-bold text-sm">
            {processCount}
          </div>
          <div className="text-[10px] text-slate-400 font-sans">Proses</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5">
          <div className="text-amber-400 font-bold text-sm">{metrics.partialItemCount}</div>
          <div className="text-[10px] text-slate-400 font-sans">Parsial</div>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-1.5">
          <div className="text-rose-400 font-bold text-sm">{metrics.backlogItemCount}</div>
          <div className="text-[10px] text-slate-400 font-sans">Backlog</div>
        </div>
      </div>

      {/* Mini-Gantt SLA Preview Ticker */}
      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1 font-mono">
            <Timer className="size-3 text-teal-400" />
            <span>Target SLA Siklus Rata-rata:</span>
          </span>
          <span className="font-mono font-bold text-teal-300">4 Hari Kerja</span>
        </div>

        <button
          type="button"
          onClick={onScrollToGantt}
          className="w-full py-1.5 px-3 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-lg text-xs font-medium flex items-center justify-between transition cursor-pointer group"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-teal-400" />
            <span>Lihat Jadwal Gantt Timeline Lengkap</span>
          </span>
          <ChevronRight className="size-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

