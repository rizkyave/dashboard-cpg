'use client';

import React from 'react';
import { ProcurementItem } from '@/types/procurement';
import { LapsePolarChart, PicWorkloadChart } from './Charts';

interface AnalyticsTabProps {
  items: ProcurementItem[];
}

export default function AnalyticsTab({ items }: AnalyticsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lapse Day Distribution Chart */}
        <div className="rounded-xl border border-border bg-card text-card-foreground p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Distribusi Lead Time / Lapse Day Lapangan
          </h3>
          <p className="text-xs text-muted-foreground">
            Analisis seberapa lama berkas fisik mengendap di lapangan sebelum kembali ke kantor pusat
          </p>
          <div className="h-64">
            <LapsePolarChart data={items} />
          </div>
        </div>

        {/* PIC Workload Performance Bar */}
        <div className="rounded-xl border border-border bg-card text-card-foreground p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Beban Kerja & Produktivitas PIC
          </h3>
          <p className="text-xs text-muted-foreground">
            Jumlah PO aktif yang ditangani oleh PIC Purchasing, TTB, dan Lapangan
          </p>
          <div className="h-64">
            <PicWorkloadChart data={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
