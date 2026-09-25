'use client';

import React from 'react';
import { FileText, Clock, CheckCircle2, PackageCheck } from 'lucide-react';
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
    totalFpb > 0 ? ((totalFstb / totalFpb) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* ── Card 1: Total Berkas PO ── */}
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:border-foreground/20">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
              <FileText className="size-4" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Total Berkas PO
            </span>
          </div>
          {totalPo > 0 ? (
            <span className="inline-flex items-center font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              Aktif
            </span>
          ) : (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
              0 Berkas
            </span>
          )}
        </div>

        <div className="my-2.5 flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {totalPo.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground font-medium">berkas</span>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground truncate">
          Acuan: Monitoring Layanan Armada
        </div>
      </div>

      {/* ── Card 2: Rata-rata Lapse Lapangan ── */}
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:border-foreground/20">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Clock className="size-4" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Rata-rata Lapse
            </span>
          </div>
          {totalPo === 0 ? (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
              Standby
            </span>
          ) : Number(avgLapse) <= 4 ? (
            <span className="inline-flex items-center font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              Normal
            </span>
          ) : (
            <span className="inline-flex items-center font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0">
              Kritis
            </span>
          )}
        </div>

        <div className="my-2.5 flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {avgLapse}
          </span>
          <span className="text-xs text-muted-foreground font-medium">hari kerja</span>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground truncate">
          Target SLA fisik &le; 4 hari kerja
        </div>
      </div>

      {/* ── Card 3: Penyelesaian Berkas SPP ── */}
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:border-foreground/20">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Penyelesaian SPP
            </span>
          </div>
          {totalPo === 0 ? (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
              0 Berkas
            </span>
          ) : financeDoneCount === totalPo ? (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              100% Selesai
            </span>
          ) : (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              {financeDoneCount} Selesai
            </span>
          )}
        </div>

        <div className="my-2.5 flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {financeDonePct}%
          </span>
          <span className="text-xs text-muted-foreground font-medium">tervalidasi</span>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground truncate">
          {totalPo > 0
            ? `${financeDoneCount} dari ${totalPo} berkas di Keuangan`
            : 'Dokumen masuk ke Keuangan CPG'}
        </div>
      </div>

      {/* ── Card 4: Pemenuhan Layanan Armada ── */}
      <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:border-foreground/20">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <PackageCheck className="size-4" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Pemenuhan Armada
            </span>
          </div>
          {totalFpb === 0 ? (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
              Standby
            </span>
          ) : totalFstb >= totalFpb ? (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              Match
            </span>
          ) : (
            <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
              Sisa {totalFpb - totalFstb} Unit
            </span>
          )}
        </div>

        <div className="my-2.5 flex items-baseline gap-1.5">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {fulfillmentPct}%
          </span>
          <span className="text-xs text-muted-foreground font-medium">tercapai</span>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground truncate">
          {totalFpb > 0
            ? `${totalFstb.toLocaleString()} dari ${totalFpb.toLocaleString()} unit terkirim`
            : 'Realisasi unit FPB & FSTB'}
        </div>
      </div>
    </div>
  );
}
