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
  PointElement,
  LineElement,
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
  RadialLinearScale,
  PointElement,
  LineElement
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
  defaultMode = 'bar',
}: {
  monthlyData: Array<{
    monthName: string;
    rawMonth?: string;
    year?: string;
    fpbCount: number;
    qtyTotal: number;
  }>;
  defaultMode?: 'bar' | 'combo';
}) {
  const [chartMode, setChartMode] = React.useState<'bar' | 'combo'>(defaultMode);

  if (!monthlyData || monthlyData.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data tren bulanan armada" />;
  }

  // Custom Data Labels Plugin to draw precision numbers directly above each bar / line point
  const precisionDataLabelsPlugin = {
    id: 'fleetPrecisionDataLabels',
    afterDatasetsDraw(chart: any) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;

        meta.data.forEach((element: any, index: number) => {
          const val = dataset.data[index];
          if (val === undefined || val === null || val === 0) return;
          const labelText = Number(val).toLocaleString('id-ID');

          ctx.save();
          ctx.font = '600 9px "JetBrains Mono", monospace, sans-serif';
          ctx.fillStyle = datasetIndex === 0 ? '#0284c7' : '#7c3aed';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Position text right above the top of the bar or point
          const yPos = typeof element.y === 'number' ? element.y - 4 : element.base - 4;
          ctx.fillText(labelText, element.x, yPos);
          ctx.restore();
        });
      });
    },
  };

  const chartData = {
    labels: monthlyData.map((d) => d.monthName),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Jumlah FPB',
        data: monthlyData.map((d) => d.fpbCount),
        backgroundColor: 'rgba(56, 189, 248, 0.9)', // Kotak / batang biru muda
        borderColor: '#0284c7',
        borderWidth: 1.5,
        borderRadius: 4,
        yAxisID: 'y',
        barPercentage: chartMode === 'bar' ? 0.72 : 0.45,
        categoryPercentage: 0.75,
      },
      {
        type: (chartMode === 'combo' ? 'line' : 'bar') as any,
        label: 'Total Kuantitas Barang (Unit)',
        data: monthlyData.map((d) => d.qtyTotal),
        backgroundColor: chartMode === 'combo' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.9)', // Kotak / batang ungu
        borderColor: '#7c3aed',
        borderWidth: chartMode === 'combo' ? 2.5 : 1.5,
        borderRadius: 4,
        yAxisID: 'y1',
        barPercentage: 0.72,
        categoryPercentage: 0.75,
        tension: 0.35,
        pointBackgroundColor: '#7c3aed',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: chartMode === 'combo' ? 4.5 : 0,
        pointHoverRadius: chartMode === 'combo' ? 6.5 : 0,
        fill: chartMode === 'combo' ? false : undefined,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 20, // Ruang untuk data labels di atas batang tertinggi
        right: 4,
        left: 4,
        bottom: 2,
      },
    },
    plugins: {
      legend: {
        display: false, // Ditampilkan via HTML legend di atas untuk kontrol dan presisi desain digital
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const val = context.raw || 0;
            return ` ${label}: ${Number(val).toLocaleString('id-ID')}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#475569',
          font: { size: 10, weight: '600', family: 'Inter, sans-serif' },
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        min: 0,
        suggestedMax: 1000,
        title: {
          display: true,
          text: 'Jumlah FPB',
          color: '#0284c7',
          font: { size: 10, weight: 'bold', family: 'Inter, sans-serif' },
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.85)', // Garis kisi horizontal abu-abu muda
        },
        ticks: {
          color: '#0284c7',
          font: { size: 9, family: 'JetBrains Mono, monospace' },
          stepSize: 200,
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        min: 0,
        suggestedMax: 1600,
        title: {
          display: true,
          text: 'Total Kuantitas Barang',
          color: '#7c3aed',
          font: { size: 10, weight: 'bold', family: 'Inter, sans-serif' },
        },
        grid: {
          drawOnChartArea: false, // Hindari garis kisi bertabrakan
        },
        ticks: {
          color: '#7c3aed',
          font: { size: 9, family: 'JetBrains Mono, monospace' },
          stepSize: 400,
        },
      },
    },
  };

  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Legenda Dua Kotak Warna & Mode Switcher */}
      <div className="flex items-center justify-between pb-2 mb-1 gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-[#38bdf8] border border-[#0284c7] shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Jumlah FPB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-[#a855f7] border border-[#7c3aed] shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Total Kuantitas Barang (Unit)
            </span>
          </div>
        </div>

        {/* Combo Chart / Grouped Bar Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-muted p-0.5 rounded-md border border-slate-200 dark:border-border text-[10px] font-medium">
          <button
            type="button"
            onClick={() => setChartMode('bar')}
            className={`px-2 py-0.5 rounded transition ${
              chartMode === 'bar'
                ? 'bg-white dark:bg-card text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Tampilkan sebagai Batang Grup (Grouped Bar Chart)"
          >
            Grouped Bar
          </button>
          <button
            type="button"
            onClick={() => setChartMode('combo')}
            className={`px-2 py-0.5 rounded transition ${
              chartMode === 'combo'
                ? 'bg-white dark:bg-card text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Tampilkan sebagai Combo Chart (Batang FPB + Garis Qty)"
          >
            Combo Chart
          </button>
        </div>
      </div>

      {/* Area Grafik Utama */}
      <div className="flex-1 min-h-[210px] w-full">
        <Bar data={chartData as any} options={options as any} plugins={[precisionDataLabelsPlugin]} />
      </div>
    </div>
  );
}
