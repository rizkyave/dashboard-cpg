'use client';

import React from 'react';
import { FileText, Clock, CheckCircle2, PackageCheck, TrendingUp } from 'lucide-react';
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Total PO Berkas */}
      <div className="group/card flex flex-col justify-between gap-3 rounded-xl bg-card p-4.5 text-card-foreground border border-border shadow-xs hover:shadow-subtle transition">
        <div className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
            <FileText className="size-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="size-3" />
            100% Tercatat
          </span>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Total Berkas PO Terdata
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-semibold text-2xl lg:text-3xl tabular-nums leading-none tracking-tight text-foreground">
              {totalPo.toLocaleString()}
            </div>
            <span className="text-xs text-muted-foreground font-mono">Berkas</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Acuan Utama: Monitoring Layanan Armada
          </p>
        </div>
      </div>

      {/* Card 2: Rata-rata Lapse Lapangan */}
      <div className="group/card flex flex-col justify-between gap-3 rounded-xl bg-card p-4.5 text-card-foreground border border-border shadow-xs hover:shadow-subtle transition">
        <div className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
            <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="size-3" />
            SLA Normal
          </span>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Rata-rata Lapse Lapangan
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-semibold text-2xl lg:text-3xl tabular-nums leading-none tracking-tight text-foreground">
              {avgLapse}
            </div>
            <span className="text-xs text-muted-foreground font-mono">Hari Kerja</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Target perputaran SLA fisik &le; 4 hari kerja
          </p>
        </div>
      </div>

      {/* Card 3: Penyelesaian Berkas SPP */}
      <div className="group/card flex flex-col justify-between gap-3 rounded-xl bg-card p-4.5 text-card-foreground border border-border shadow-xs hover:shadow-subtle transition">
        <div className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
            <CheckCircle2 className="size-4 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            {financeDoneCount} Selesai
          </span>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Penyelesaian Berkas SPP
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-semibold text-2xl lg:text-3xl tabular-nums leading-none tracking-tight text-foreground">
              {financeDonePct}%
            </div>
            <span className="text-xs text-muted-foreground font-mono">Tervalidasi</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Dokumen telah masuk ke Staf Keuangan CPG
          </p>
        </div>
      </div>

      {/* Card 4: Pemenuhan Item Armada */}
      <div className="group/card flex flex-col justify-between gap-3 rounded-xl bg-card p-4.5 text-card-foreground border border-border shadow-xs hover:shadow-subtle transition">
        <div className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
            <PackageCheck className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            QTY Match
          </span>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            Pemenuhan Layanan Armada
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="font-semibold text-2xl lg:text-3xl tabular-nums leading-none tracking-tight text-foreground">
              {fulfillmentPct}%
            </div>
            <span className="text-xs text-muted-foreground font-mono">Tercapai</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Total {totalFstb.toLocaleString()} dari {totalFpb.toLocaleString()} unit terkirim
          </p>
        </div>
      </div>
    </div>
  );
}
