'use client';

import React, { useState } from 'react';
import { KPIMetrics, ArmadaDataPoint } from './types';
import {
  Sparkles,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  TrendingUp,
  Target,
  Anchor,
  Package,
} from 'lucide-react';

interface ExecutiveTalkingPointsProps {
  metrics: KPIMetrics;
  topArmadas: ArmadaDataPoint[];
  focusTop12Only: boolean;
  fleetTypeFilter: 'ALL' | 'MARINE' | 'OFFICE_SITE';
  periodLabel: string;
  totalAllFpb: number;
  presentationMode: boolean;
  onTogglePresentationMode: () => void;
}

export default function ExecutiveTalkingPoints({
  metrics,
  topArmadas,
  focusTop12Only,
  fleetTypeFilter,
  periodLabel,
  totalAllFpb,
  presentationMode,
  onTogglePresentationMode,
}: ExecutiveTalkingPointsProps) {
  const [copied, setCopied] = useState(false);

  // Top 12 metrics calculation
  const top12Count = Math.min(topArmadas.filter((a) => a.id !== 'OTHERS').length, 12);
  const top12Fpb = topArmadas
    .filter((a) => a.id !== 'OTHERS')
    .slice(0, 12)
    .reduce((sum, a) => sum + a.fpbCount, 0);

  const concentrationPct = totalAllFpb > 0 ? ((top12Fpb / totalAllFpb) * 100).toFixed(1) : '100';

  const topVessel = topArmadas[0];
  const topVesselFpb = topVessel?.fpbCount || 0;
  const topVesselShare = top12Fpb > 0 ? ((topVesselFpb / top12Fpb) * 100).toFixed(1) : '0';
  const topVesselRealization =
    topVessel && topVessel.qtyFPB > 0
      ? Math.round((topVessel.qtyFSTB / topVessel.qtyFPB) * 100)
      : 100;

  const typeLabel =
    fleetTypeFilter === 'MARINE'
      ? 'Khusus Kapal Laut (Marine Fleet)'
      : fleetTypeFilter === 'OFFICE_SITE'
      ? 'Khusus Unit Kantor & Site'
      : 'Semua Unit (Kapal + Kantor + Site)';

  // Build text to copy
  const handleCopyText = () => {
    const textLines = [
      `📊 RINGKASAN PRESENTASI EKSEKUTIF - 12 BESAR PERMINTAAN ARMADA`,
      `Periode: ${periodLabel} | Filter: ${typeLabel}`,
      `Skala Tampilan: ${focusTop12Only ? 'Fokus 12 Besar Murni (100%)' : 'Proporsi Global (+ Armada Lainnya)'}`,
      ``,
      `1. KONSENTRASI PERMINTAAN:`,
      `   • 12 armada teratas menyerap ${concentrationPct}% dari total seluruh pengajuan perusahaan (${top12Fpb.toLocaleString('id-ID')} dari ${totalAllFpb.toLocaleString('id-ID')} FPB).`,
      ``,
      `2. ARMADA TERAKTIF:`,
      `   • Unit tertinggi: ${topVessel?.name || '-'} dengan ${topVesselFpb.toLocaleString('id-ID')} FPB (${topVesselShare}% dari total 12 besar).`,
      `   • Realisasi suku cadang unit teraktif: ${topVesselRealization}% (${topVessel?.qtyFSTB || 0}/${topVessel?.qtyFPB || 0} unit).`,
      ``,
      `3. REALISASI & BACKLOG:`,
      `   • Rasio pemenuhan kelompok 12 besar: ${metrics.fulfillmentRate}% (${metrics.totalQtyFSTB.toLocaleString('id-ID')} dari ${metrics.totalQtyFPB.toLocaleString('id-ID')} unit barang).`,
      `   • Total sisa backlog barang yang masih dalam proses pemenuhan: ${metrics.totalBacklogQty.toLocaleString('id-ID')} unit (${metrics.backlogItemCount + metrics.partialItemCount} item).`,
      ``,
      `Sumber: CPG Procurement & Fleet Analytics Dashboard`,
    ].join('\n');

    navigator.clipboard.writeText(textLines);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-sky-500/30 rounded-2xl p-3.5 sm:p-4 shadow-lg backdrop-blur-md space-y-3 transition">
      {/* Header Talking Points */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">
                POIN NARASI PRESENTASI EKSEKUTIF (TOP 12)
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {focusTop12Only ? '🎯 Skala 100% Top 12' : '🌐 Skala Global (+ Lainnya)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Poin ringkasan otomatis siap-baca untuk bahan presentasi ke direksi atau manajemen operasional.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyText}
            className="h-8 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            title="Salin narasi teks ke clipboard untuk slide PowerPoint atau WhatsApp"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-slate-400" />
                <span>Salin Narasi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onTogglePresentationMode}
            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
              presentationMode
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={presentationMode ? 'Kembali ke tampilan standar' : 'Aktifkan mode presentasi bersih'}
          >
            {presentationMode ? (
              <>
                <Minimize2 className="size-3.5" />
                <span>Mode Standar</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Mode Presentasi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Executive Insight Bullets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Bullet 1: Konsentrasi Permintaan */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5">
          <div className="size-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
            <Target className="size-4" />
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-sky-400 mb-0.5">
              Konsentrasi Kebutuhan
            </span>
            <span className="font-semibold text-white">{top12Count} armada teratas</span> menyerap{' '}
            <span className="font-bold font-mono text-sky-300">{concentrationPct}%</span> dari seluruh permintaan FPB (
            <span className="font-mono text-white">{top12Fpb.toLocaleString('id-ID')}</span> dari{' '}
            <span className="font-mono text-slate-400">{totalAllFpb.toLocaleString('id-ID')}</span> FPB).
          </div>
        </div>

        {/* Bullet 2: Armada Teraktif */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5">
          <div className="size-7 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
            <Anchor className="size-4" />
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-pink-400 mb-0.5">
              Armada Paling Aktif
            </span>
            Unit tertinggi adalah{' '}
            <span className="font-bold text-white">{topVessel?.name || '-'}</span> dengan{' '}
            <span className="font-bold font-mono text-pink-300">{topVesselFpb} FPB</span> (
            <span className="font-mono text-slate-300">{topVesselShare}%</span> porsi 12 besar), realisasi{' '}
            <span className="font-bold font-mono text-emerald-400">{topVesselRealization}%</span>.
          </div>
        </div>

        {/* Bullet 3: Realisasi & Backlog */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5">
          <div className="size-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
            <Package className="size-4" />
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-teal-400 mb-0.5">
              Realisasi &amp; Backlog
            </span>
            Tingkat pemenuhan kelompok ini{' '}
            <span className="font-bold font-mono text-teal-300">{metrics.fulfillmentRate}%</span>, dengan backlog tertunda{' '}
            <span className="font-bold font-mono text-amber-400">{metrics.totalBacklogQty.toLocaleString('id-ID')} unit</span> barang (
            <span className="font-mono text-slate-300">{metrics.backlogItemCount + metrics.partialItemCount} item</span>).
          </div>
        </div>
      </div>
    </div>
  );
}
