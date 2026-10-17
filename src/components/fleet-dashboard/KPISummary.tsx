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
  CheckCircle2,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Total Pengajuan Armada */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-xl transition hover:border-slate-700/80 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Total Pengajuan Armada</span>
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {metrics.totalFpb.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-semibold text-slate-400">FPB</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400 font-mono">
              <span className="text-sky-400 font-semibold">
                {metrics.vesselCount} {selectedArmadaName ? 'Unit Terpilih' : 'Armada Aktif'}
              </span>
              <span>•</span>
              <span className="text-slate-300">{periodLabel}</span>
            </div>
          </div>
          <div className="size-11 sm:size-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Ship className="size-5 sm:size-6" />
          </div>
        </div>
      </div>

      {/* Card 2: Realisasi Suku Cadang & Fulfillment Rate */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-xl transition hover:border-slate-700/80 group">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Realisasi Suku Cadang
            </p>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-teal-400 tracking-tight">
                {metrics.totalQtyFSTB.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-400 font-mono truncate">
                / {metrics.totalQtyFPB.toLocaleString('id-ID')} unit
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, metrics.fulfillmentRate))}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-teal-400 shrink-0">
                {metrics.fulfillmentRate}%
              </span>
            </div>
          </div>
          <div className="size-11 sm:size-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <PackageCheck className="size-5 sm:size-6" />
          </div>
        </div>
      </div>

      {/* Card 3: Total Sisa Selisih / Backlog */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-xl transition hover:border-slate-700/80 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Selisih / Backlog
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400 tracking-tight">
                {metrics.totalBacklogQty.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-semibold text-slate-400">unit</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {(metrics.backlogItemCount + metrics.partialItemCount).toLocaleString('id-ID')} item butuh pemenuhan
            </p>
          </div>
          <div className="size-11 sm:size-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <AlertTriangle className="size-5 sm:size-6" />
          </div>
        </div>
      </div>

      {/* Card 4: Armada Terpilih / Paling Intensif */}
      <div className={`border rounded-2xl p-4 sm:p-4.5 shadow-xl transition group ${
        selectedArmadaName
          ? 'bg-sky-950/40 border-sky-500/50 hover:border-sky-400/80'
          : 'bg-slate-900/95 border-slate-800 hover:border-slate-700/80'
      }`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-2">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                {selectedArmadaName ? 'Armada Terpilih' : 'Armada Paling Intensif'}
              </p>
              {selectedArmadaName && onClearSelectedArmada && (
                <button
                  type="button"
                  onClick={onClearSelectedArmada}
                  className="text-[10px] font-mono text-sky-400 hover:text-white px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 flex items-center gap-1 cursor-pointer transition"
                  title="Kembali ke semua armada"
                >
                  <X className="size-2.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <p
              className="text-sm sm:text-base font-bold text-white truncate mt-1.5 tracking-tight"
              title={selectedArmadaName || metrics.topVesselName || '-'}
            >
              {selectedArmadaName || metrics.topVesselName || '-'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate font-mono">
              {selectedArmadaName
                ? `${metrics.totalFpb} FPB di periode ini`
                : `${metrics.topVesselFpb} FPB diajukan`}
            </p>
          </div>

          <div className={`size-11 sm:size-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
            selectedArmadaName
              ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
              : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
          }`}>
            {selectedArmadaName ? <Anchor className="size-5 sm:size-6" /> : <TrendingUp className="size-5 sm:size-6" />}
          </div>
        </div>
      </div>
    </div>
  );
}

