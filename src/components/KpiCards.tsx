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
    totalFpb > 0 ? ((totalFstb / totalFpb) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Total PO Berkas */}
      <div className="group relative flex flex-col justify-between rounded-xl bg-card p-4.5 border border-border shadow-xs hover:border-border/80 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Berkas PO
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
            <FileText className="size-3.5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {totalPo.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-muted-foreground">Berkas</span>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground truncate">
            Monitoring Layanan Armada
          </span>
          {totalPo > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <TrendingUp className="size-3" />
              Terdata
            </span>
          ) : (
            <span className="font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
              Menunggu Data
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Rata-rata Lapse Lapangan */}
      <div className="group relative flex flex-col justify-between rounded-xl bg-card p-4.5 border border-border shadow-xs hover:border-border/80 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Rata-rata Lapse Lapangan
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Clock className="size-3.5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {avgLapse}
          </span>
          <span className="text-xs font-medium text-muted-foreground">Hari Kerja</span>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground truncate">
            Target SLA &le; 4 hari kerja
          </span>
          {totalPo === 0 ? (
            <span className="font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
              Standby
            </span>
          ) : Number(avgLapse) <= 4 ? (
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <TrendingUp className="size-3" />
              SLA Normal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0">
              SLA Kritis
            </span>
          )}
        </div>
      </div>

      {/* Card 3: Penyelesaian Berkas SPP */}
      <div className="group relative flex flex-col justify-between rounded-xl bg-card p-4.5 border border-border shadow-xs hover:border-border/80 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Penyelesaian Berkas SPP
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <CheckCircle2 className="size-3.5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {financeDonePct}%
          </span>
          <span className="text-xs font-medium text-muted-foreground">Tervalidasi</span>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground truncate">
            {totalPo > 0
              ? `${financeDoneCount} dari ${totalPo} berkas di Keuangan`
              : 'Staf Keuangan CPG'}
          </span>
          {totalPo === 0 ? (
            <span className="font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
              0 Selesai
            </span>
          ) : financeDoneCount === totalPo ? (
            <span className="font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              100% Selesai
            </span>
          ) : (
            <span className="font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              {financeDoneCount} Selesai
            </span>
          )}
        </div>
      </div>

      {/* Card 4: Pemenuhan Layanan Armada */}
      <div className="group relative flex flex-col justify-between rounded-xl bg-card p-4.5 border border-border shadow-xs hover:border-border/80 hover:shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pemenuhan Layanan Armada
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <PackageCheck className="size-3.5" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground font-mono">
            {fulfillmentPct}%
          </span>
          <span className="text-xs font-medium text-muted-foreground">Tercapai</span>
        </div>

        <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground truncate">
            {totalFpb > 0
              ? `${totalFstb.toLocaleString()} dari ${totalFpb.toLocaleString()} unit terkirim`
              : 'Unit FPB & FSTB'}
          </span>
          {totalFpb === 0 ? (
            <span className="font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
              Standby
            </span>
          ) : totalFstb >= totalFpb ? (
            <span className="font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              QTY Match
            </span>
          ) : (
            <span className="font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
              Sisa {totalFpb - totalFstb} Unit
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
