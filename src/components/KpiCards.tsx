'use client';

import React from 'react';
import { FileText, Clock, CheckCircle2, Box } from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';

interface KpiCardsProps {
  procurementList: ProcurementItem[];
  armadaList: ArmadaItem[];
}

export default function KpiCards({ procurementList, armadaList }: KpiCardsProps) {
  const totalPo = procurementList.length;

  const avgLapse =
    totalPo > 0
      ? (
          procurementList.reduce((acc, c) => acc + (c.lapse || 0), 0) / totalPo
        ).toFixed(1)
      : '0.0';

  const financeDoneCount = procurementList.filter(
    (c) => c.statusBadge === 'SELESAI DI KEUANGAN'
  ).length;

  const financeDonePct =
    totalPo > 0 ? ((financeDoneCount / totalPo) * 100).toFixed(1) : '0.0';

  const totalFpb = armadaList.reduce((acc, i) => acc + (i.qtyFPB || 0), 0);
  const totalFstb = armadaList.reduce((acc, i) => acc + (i.qtyFSTB || 0), 0);
  const fulfillmentPct =
    totalFpb > 0 ? ((totalFstb / totalFpb) * 100).toFixed(1) : '100.0';

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total PO Berkas */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/40 transition group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Total Berkas PO Aktif
          </span>
          <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-3xl font-extrabold text-white font-mono">{totalPo}</h2>
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
            &bull; 100% Tercatat
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Dokumen pengadaan terintegrasi 7 anak perusahaan
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
      </div>

      {/* Card 2: Kecepatan Alur / Lead Time */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-slate-800 hover:border-emerald-500/40 transition group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Rata-rata Lapse Lapangan
          </span>
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Clock className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-3xl font-extrabold text-white font-mono">
            {avgLapse}{' '}
            <span className="text-lg font-normal text-slate-400">Hari</span>
          </h2>
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            SLA Aman
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Standar target perputaran berkas &le; 4 hari kerja
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
      </div>

      {/* Card 3: Status Selesai Keuangan */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-slate-800 hover:border-purple-500/40 transition group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Penyelesaian Berkas SPP
          </span>
          <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-3xl font-extrabold text-white font-mono">
            {financeDonePct}%
          </h2>
          <span className="text-xs text-purple-300 font-semibold">
            Tervalidasi Keuangan
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {financeDoneCount} dari {totalPo} berkas telah lolos verifikasi SPP & Adm
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
      </div>

      {/* Card 4: Pemenuhan Fisik (FSTB vs FPB) */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-slate-800 hover:border-amber-500/40 transition group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Fulfillment Barang (FSTB)
          </span>
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Box className="w-5 h-5" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-3xl font-extrabold text-white font-mono">
            {fulfillmentPct}%
          </h2>
          <span className="text-xs text-amber-300 font-semibold">Backlog Minim</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Pemenuhan fisik armada kapal & truk tangki operasional
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
      </div>
    </section>
  );
}
