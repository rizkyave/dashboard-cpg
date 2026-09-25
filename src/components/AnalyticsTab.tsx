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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Lapse Day Distribution Chart */}
        <div className="bg-card p-5 rounded-xl border border-border space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Distribusi Lead Time / Lapse Day Lapangan
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Analisis seberapa lama berkas fisik mengendap di lapangan sebelum kembali ke kantor pusat
            </p>
          </div>
          <div className="h-64 pt-2">
            <LapsePolarChart data={items} />
          </div>
        </div>

        {/* PIC Workload Performance Bar */}
        <div className="bg-card p-5 rounded-xl border border-border space-y-3 shadow-xs">
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Beban Kerja & Produktivitas PIC
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Jumlah PO aktif yang ditangani oleh PIC Purchasing, TTB, dan Lapangan
            </p>
          </div>
          <div className="h-64 pt-2">
            <PicWorkloadChart data={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
