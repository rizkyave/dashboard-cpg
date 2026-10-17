'use client';

import React from 'react';
import { KPIMetrics } from './types';
import {
  Ship,
  PackageCheck,
  AlertTriangle,
  TrendingUp,
  Anchor,
  X,
} from 'lucide-react';

interface KPISummaryProps {
  metrics: KPIMetrics;
  selectedArmadaName?: string | null;
  onClearSelectedArmada?: () => void;
  periodLabel: string;
}

export default function KPISummary({
  metrics,
  selectedArmadaName,
  onClearSelectedArmada,
  periodLabel,
}: KPISummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Pengajuan Armada (Tinggi h-24 seragam) */}
      <div className="h-24 bg-slate-900/80 border border-slate-800/80 rounded-xl px-4 py-3 shadow-md flex items-center justify-between transition hover:border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            Total Pengajuan Armada
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {metrics.totalFpb.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-semibold text-slate-400">FPB</span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
            <span className="text-sky-400 font-semibold">{metrics.vesselCount} Unit</span> • {periodLabel}
          </p>
        </div>
        <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 ml-2">
          <Ship className="size-5" />
        </div>
      </div>

      {/* Card 2: Realisasi Suku Cadang (Tinggi h-24 seragam) */}
      <div className="h-24 bg-slate-900/80 border border-slate-800/80 rounded-xl px-4 py-3 shadow-md flex items-center justify-between transition hover:border-slate-700">
        <div className="flex-1 min-w-0 mr-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            Realisasi Suku Cadang
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold font-mono text-teal-400 tracking-tight">
              {metrics.totalQtyFSTB.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-400 font-mono truncate">
              / {metrics.totalQtyFPB.toLocaleString('id-ID')} unit
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, metrics.fulfillmentRate))}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-teal-400 shrink-0">
              {metrics.fulfillmentRate}%
            </span>
          </div>
        </div>
        <div className="size-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
          <PackageCheck className="size-5" />
        </div>
      </div>

      {/* Card 3: Total Selisih / Backlog (Tinggi h-24 seragam) */}
      <div className="h-24 bg-slate-900/80 border border-slate-800/80 rounded-xl px-4 py-3 shadow-md flex items-center justify-between transition hover:border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
            Total Selisih / Backlog
          </p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
              {metrics.totalBacklogQty.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-semibold text-slate-400">unit</span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
            {(metrics.backlogItemCount + metrics.partialItemCount).toLocaleString('id-ID')} item butuh pemenuhan
          </p>
        </div>
        <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 ml-2">
          <AlertTriangle className="size-5" />
        </div>
      </div>

      {/* Card 4: Armada Terpilih / Paling Intensif (Tinggi h-24 seragam) */}
      <div className={`h-24 border rounded-xl px-4 py-3 shadow-md flex items-center justify-between transition ${
        selectedArmadaName
          ? 'bg-sky-950/40 border-sky-500/50 hover:border-sky-400'
          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
      }`}>
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {selectedArmadaName ? 'Armada Terpilih' : 'Armada Paling Intensif'}
            </p>
            {selectedArmadaName && onClearSelectedArmada && (
              <button
                type="button"
                onClick={onClearSelectedArmada}
                className="text-[10px] font-mono text-sky-400 hover:text-white px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 flex items-center gap-0.5 cursor-pointer"
                title="Reset pilihan"
              >
                <X className="size-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <p className="text-base font-bold text-white truncate mt-0.5 tracking-tight">
            {selectedArmadaName || metrics.topVesselName || '-'}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
            {selectedArmadaName ? `${metrics.totalFpb} FPB di periode ini` : `${metrics.topVesselFpb} FPB diajukan`}
          </p>
        </div>
        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
          selectedArmadaName
            ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
            : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
        }`}>
          {selectedArmadaName ? <Anchor className="size-5" /> : <TrendingUp className="size-5" />}
        </div>
      </div>
    </div>
  );
}
