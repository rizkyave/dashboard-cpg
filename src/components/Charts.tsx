'use client';

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
} from 'chart.js';
import { Doughnut, Bar, PolarArea } from 'react-chartjs-2';
import { ProcurementItem } from '@/types/procurement';
import { FileSpreadsheet } from 'lucide-react';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale
);

function EmptyChartPlaceholder({ message }: { message: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 gap-2">
      <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
        <FileSpreadsheet className="size-5" />
      </div>
      <p className="text-xs font-semibold text-foreground">{message}</p>
      <span className="text-[11px] text-muted-foreground">
        Unggah file Excel untuk memuat visualisasi
      </span>
    </div>
  );
}

export function EntityDonutChart({ data }: { data: ProcurementItem[] }) {
  if (data.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data entitas CPG" />;
  }

  const counts: Record<string, number> = {
    CPL: 0,
    PPI: 0,
    GAJ: 0,
    HL: 0,
    MIL: 0,
    SP: 0,
    SSK: 0,
  };

  data.forEach((item) => {
    if (counts[item.entity] !== undefined) {
      counts[item.entity]++;
    }
  });

  const chartData = {
    labels: [
      'CPL (Lines)',
      'PPI (Petro Perkasa)',
      'GAJ (Galangan)',
      'HL (Hana)',
      'MIL (Mapan)',
      'SP (Sinar Pasifik)',
      'SSK (Konstruksi)',
    ],
    datasets: [
      {
        data: [
          counts['CPL'],
          counts['PPI'],
          counts['GAJ'],
          counts['HL'],
          counts['MIL'],
          counts['SP'],
          counts['SSK'],
        ],
        backgroundColor: [
          '#06b6d4',
          '#3b82f6',
          '#f59e0b',
          '#ec4899',
          '#8b5cf6',
          '#10b981',
          '#64748b',
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
    },
    cutout: '72%',
  };

  return <Doughnut data={chartData} options={options} />;
}

export function PipelineBarChart({ data }: { data: ProcurementItem[] }) {
  if (data.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data alur pipeline berkas" />;
  }

  let pchCount = 0;
  let ttbCount = 0;
  let lapCount = 0;
  let spekCount = 0;
  let doneCount = 0;

  data.forEach((item) => {
    const s = (item.statusBadge || '').toUpperCase();
    if (s.includes('SELESAI')) doneCount++;
    else if (s.includes('SPEK')) spekCount++;
    else if (s.includes('LAPANGAN') || s.includes('FABRIKASI')) lapCount++;
    else if (s.includes('TTB')) ttbCount++;
    else pchCount++;
  });

  const chartData = {
    labels: [
      'Penerbitan PO',
      'Logistik TTB',
      'Tim Lapangan',
      'Verifikasi Spek',
      'Selesai Keuangan',
    ],
    datasets: [
      {
        label: 'Jumlah Berkas Fisik',
        data: [pchCount, ttbCount, lapCount, spekCount, doneCount],
        backgroundColor: ['#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981'],
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
      y: {
        grid: { color: 'rgba(128,128,128,0.12)' },
        ticks: { color: '#64748b', stepSize: 1, font: { family: 'JetBrains Mono, monospace' } },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function LapsePolarChart({ data }: { data: ProcurementItem[] }) {
  if (data.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data lapse lead time" />;
  }

  let instant = 0;
  let normal = 0;
  let warning = 0;
  let critical = 0;

  data.forEach((item) => {
    if (item.lapse === 0) instant++;
    else if (item.lapse <= 2) normal++;
    else if (item.lapse <= 4) warning++;
    else critical++;
  });

  const chartData = {
    labels: ['0 Hari (Instan)', '1 - 2 Hari', '3 - 4 Hari', '5+ Hari (Kritis)'],
    datasets: [
      {
        data: [instant, normal, warning, critical],
        backgroundColor: ['#10b981', '#06b6d4', '#f59e0b', '#f43f5e'],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
    },
    scales: {
      r: {
        grid: { color: 'rgba(128,128,128,0.15)' },
        ticks: { display: false },
      },
    },
  };

  return <PolarArea data={chartData} options={options} />;
}

export function PicWorkloadChart({ data }: { data: ProcurementItem[] }) {
  if (data.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data beban kerja PIC" />;
  }

  const pics: Record<string, number> = {
    'LUTFI (PCH)': 0,
    'PUTRI (PCH)': 0,
    'NOVI (PCH)': 0,
    'DAVILA (TTB)': 0,
    'FIFI (TTB)': 0,
    'AGUS (LAP)': 0,
    'HAMKA (LAP)': 0,
  };

  data.forEach((item) => {
    const pch = item.picPch?.toUpperCase() || '';
    const ttb = item.picTtb?.toUpperCase() || '';
    const lap = item.picLap?.toUpperCase() || '';

    if (pch.includes('LUTFI')) pics['LUTFI (PCH)']++;
    if (pch.includes('PUTRI')) pics['PUTRI (PCH)']++;
    if (pch.includes('NOVI')) pics['NOVI (PCH)']++;
    if (ttb.includes('DAVILA')) pics['DAVILA (TTB)']++;
    if (ttb.includes('FIFI')) pics['FIFI (TTB)']++;
    if (lap.includes('AGUS')) pics['AGUS (LAP)']++;
    if (lap.includes('HAMKA')) pics['HAMKA (LAP)']++;
  });

  const chartData = {
    labels: Object.keys(pics),
    datasets: [
      {
        label: 'PO Ditangani',
        data: Object.values(pics),
        backgroundColor: '#0284c7',
        borderRadius: 6,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: 'rgba(128,128,128,0.12)' },
        ticks: { color: '#64748b', stepSize: 1, font: { family: 'JetBrains Mono, monospace' } },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function FleetDemandBarChart({
  data,
}: {
  data: Array<{
    name: string;
    qtyFPB: number;
    qtyFSTB: number;
    fulfillmentRate: number;
  }>;
}) {
  if (!data || data.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data permintaan armada" />;
  }

  const topItems = data.slice(0, 8);
  const labels = topItems.map((d) => (d.name.length > 14 ? d.name.slice(0, 14) + '...' : d.name));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Qty Diminta (FPB)',
        data: topItems.map((d) => d.qtyFPB),
        backgroundColor: '#0284c7', // Sky Blue
        borderRadius: 4,
      },
      {
        label: 'Qty Realisasi (FSTB)',
        data: topItems.map((d) => d.qtyFSTB),
        backgroundColor: '#10b981', // Emerald Green
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 12, color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
      tooltip: {
        callbacks: {
          afterBody: (context: any) => {
            const index = context[0]?.dataIndex;
            if (index != null && topItems[index]) {
              return `Tingkat Pemenuhan: ${topItems[index].fulfillmentRate}%`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 9, family: 'Inter, sans-serif' } },
      },
      y: {
        grid: { color: 'rgba(128,128,128,0.12)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono, monospace', size: 10 } },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

export function FleetCategoryDonutChart({
  categories,
}: {
  categories: Record<string, number>;
}) {
  const entries = Object.entries(categories).filter(([_, count]) => count > 0);
  if (entries.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada rincian kategori suku cadang" />;
  }

  entries.sort((a, b) => b[1] - a[1]);
  const topCategories = entries.slice(0, 6);
  const otherCount = entries.slice(6).reduce((acc, curr) => acc + curr[1], 0);
  if (otherCount > 0) {
    topCategories.push(['Lainnya', otherCount]);
  }

  const chartData = {
    labels: topCategories.map(([cat]) => cat),
    datasets: [
      {
        data: topCategories.map(([_, count]) => count),
        backgroundColor: [
          '#06b6d4',
          '#3b82f6',
          '#f59e0b',
          '#8b5cf6',
          '#10b981',
          '#ec4899',
          '#64748b',
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { boxWidth: 10, color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
    },
    cutout: '68%',
  };

  return <Doughnut data={chartData} options={options} />;
}

export function FleetMonthlyTrendChart({
  monthlyData,
}: {
  monthlyData: Array<{ monthName: string; fpbCount: number; qtyTotal: number }>;
}) {
  if (!monthlyData || monthlyData.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data tren bulanan armada" />;
  }

  const chartData = {
    labels: monthlyData.map((d) => d.monthName),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Jumlah FPB',
        data: monthlyData.map((d) => d.fpbCount),
        backgroundColor: '#0ea5e9',
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'bar' as const,
        label: 'Total Kuantitas Barang (Unit)',
        data: monthlyData.map((d) => d.qtyTotal),
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 10, color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10, family: 'Inter, sans-serif' } },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: { color: 'rgba(128,128,128,0.12)' },
        ticks: { color: '#64748b', font: { size: 9, family: 'JetBrains Mono, monospace' } },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#8b5cf6', font: { size: 9, family: 'JetBrains Mono, monospace' } },
      },
    },
  };

  return <Bar data={chartData as any} options={options as any} />;
}
