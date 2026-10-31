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
  LineController,
  BarController,
} from 'chart.js';
import { Doughnut, Bar, PolarArea, Chart } from 'react-chartjs-2';
import { ProcurementItem } from '@/types/procurement';
import { FileSpreadsheet, Sparkles, Layers, ArrowLeft, ChevronRight, Database, Info, Filter } from 'lucide-react';
import { getCategoryColor } from '@/utils/procurementClassifier';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  LineController,
  BarController
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

  // Tampilkan top 7 armada agar spasi lega dan nama armada panjang terbaca utuh
  const topItems = (data || []).slice(0, 7);
  const labels = topItems.map((d) => (d.name && d.name.length > 28 ? d.name.slice(0, 27) + '…' : (d.name || '-')));

  // Custom data labels plugin untuk mencetak angka di ujung bar horizontal
  const horizontalDataLabelsPlugin = React.useMemo(
    () => ({
      id: 'fleetHorizontalDataLabels',
      afterDatasetsDraw(chart: any) {
        try {
          const { ctx } = chart;
          if (!ctx || !chart.data?.datasets) return;

          chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
            if (!chart.isDatasetVisible?.(datasetIndex)) return;
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta || meta.hidden || !Array.isArray(meta.data)) return;

            meta.data.forEach((element: any, index: number) => {
              if (
                !element ||
                typeof element.x !== 'number' ||
                typeof element.y !== 'number' ||
                isNaN(element.x) ||
                isNaN(element.y)
              ) {
                return;
              }
              const val = dataset.data?.[index];
              if (val === undefined || val === null || val === 0) return;
              const text = Number(val).toLocaleString('id-ID');

              ctx.save();
              ctx.font = '600 9px "JetBrains Mono", monospace, sans-serif';
              ctx.fillStyle = datasetIndex === 0 ? '#0284c7' : '#0d9488';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, element.x + 4, element.y);
              ctx.restore();
            });
          });
        } catch (err) {
          // Guard against canvas render race conditions
        }
      },
    }),
    []
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Qty Diminta (FPB)',
        data: topItems.map((d) => d.qtyFPB || 0),
        backgroundColor: '#0284c7', // Biru Sky
        borderColor: '#0369a1',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.82,
      },
      {
        label: 'Qty Realisasi (FSTB)',
        data: topItems.map((d) => d.qtyFSTB || 0),
        backgroundColor: '#0d9488', // Teal
        borderColor: '#0f766e',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.82,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const, // Horizontal Bar Chart agar nama panjang seperti DEPT. PROCUREMENT tidak terpotong
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        right: 36, // Ruang untuk data labels di sebelah kanan batang
        left: 0,
        top: 4,
        bottom: 2,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          color: '#334155',
          font: { size: 10, weight: '500', family: 'Inter, sans-serif' },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset?.label || '';
            const val = context.raw || 0;
            return ` ${label}: ${Number(val).toLocaleString('id-ID')} unit`;
          },
          afterBody: (context: any) => {
            const index = context?.[0]?.dataIndex;
            if (index != null && topItems[index]) {
              return ` Tingkat Pemenuhan: ${topItems[index].fulfillmentRate}%`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      y: {
        grid: { display: false },
        ticks: {
          color: '#1e293b',
          font: { size: 9.5, weight: '600', family: 'Inter, sans-serif' },
        },
      },
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.85)' },
        ticks: {
          color: '#64748b',
          font: { size: 9, family: 'JetBrains Mono, monospace' },
          callback: (value: any) => Number(value).toLocaleString('id-ID'),
        },
      },
    },
  };

  return <Bar data={chartData as any} options={options as any} plugins={[horizontalDataLabelsPlugin]} />;
}

export interface FleetCategoryDonutChartProps {
  categories: Record<string, number>;
  subCategories?: Record<string, number>;
  categoryDetails?: Record<
    string,
    {
      count: number;
      percentage: number;
      subCategories: Record<string, number>;
      topItems: { name: string; count: number }[];
    }
  >;
  intellectualMetrics?: {
    totalItems: number;
    classifiedCount: number;
    unclassifiedCount: number;
    classificationRate: number;
    dbMatchedCount: number;
    heuristicMatchedCount: number;
  };
  defaultView?: 'bar' | 'sub_category' | 'donut';
}

export function FleetCategoryDonutChart({
  categories,
  subCategories = {},
  categoryDetails = {},
  intellectualMetrics,
  defaultView = 'bar',
}: FleetCategoryDonutChartProps) {
  const [viewMode, setViewMode] = React.useState<'bar' | 'sub_category' | 'donut'>(defaultView);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  const safeCategories = categories || {};
  const entries = Object.entries(safeCategories).filter(([_, count]) => typeof count === 'number' && count > 0);
  if (entries.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada rincian kategori suku cadang" />;
  }

  entries.sort((a, b) => b[1] - a[1]);
  const totalItems = entries.reduce((acc, curr) => acc + (curr[1] || 0), 0);

  // Sub-categories sorted
  const subEntries = Object.entries(subCategories || {}).filter(([_, count]) => typeof count === 'number' && count > 0);
  subEntries.sort((a, b) => b[1] - a[1]);

  // Selected Category Detail Drilldown View
  if (selectedCategory && categoryDetails[selectedCategory]) {
    const detail = categoryDetails[selectedCategory];
    const subList = Object.entries(detail.subCategories || {}).sort((a, b) => b[1] - a[1]);
    const catColor = getCategoryColor(selectedCategory);

    return (
      <div className="w-full h-full flex flex-col justify-between space-y-2.5 animate-in fade-in duration-200">
        {/* Drilldown Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Kembali ke Overview Kategori</span>
          </button>
          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            {Number(detail.count).toLocaleString('id-ID')} item ({detail.percentage}%)
          </span>
        </div>

        {/* Category Identity */}
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: catColor }}></span>
          <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-foreground tracking-tight">
            {selectedCategory}
          </h5>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">
            {subList.length} Sub-Kategori Teridentifikasi
          </span>
        </div>

        {/* Sub-Category Progress List */}
        <div className="flex-1 overflow-y-auto max-h-[190px] pr-1.5 space-y-2 divide-y divide-border/40">
          {subList.map(([subName, count], idx) => {
            const pct = detail.count > 0 ? Math.round((count / detail.count) * 100) : 0;
            return (
              <div key={idx} className="pt-1.5 first:pt-0 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                    {subName}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-muted-foreground shrink-0">
                    {Number(count).toLocaleString('id-ID')} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-muted/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, pct)}%`,
                      backgroundColor: catColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Sample Items Identified */}
        {detail.topItems && detail.topItems.length > 0 && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sampel Barang Teridentifikasi:
            </span>
            <div className="flex flex-wrap gap-1">
              {detail.topItems.slice(0, 4).map((item, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-slate-100 dark:bg-muted/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-border truncate max-w-[200px]"
                  title={item.name}
                >
                  {item.name} ({item.count})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Intelligence Validation Footer */}
        <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground/80 pt-1 border-t border-border/40">
          <Sparkles className="size-3 text-amber-500 shrink-0" />
          <span className="truncate">
            Divalidasi Master Inventory CPG (10.024 Items) & Taksonomi Maritim.
          </span>
        </div>
      </div>
    );
  }

  // 1. Donut Data & Options
  const topCategories = entries.slice(0, 8);
  const otherCount = entries.slice(8).reduce((acc, curr) => acc + curr[1], 0);
  if (otherCount > 0) {
    topCategories.push(['Lainnya', otherCount]);
  }

  const donutData = {
    labels: topCategories.map(([cat]) => cat),
    datasets: [
      {
        data: topCategories.map(([_, count]) => count),
        backgroundColor: topCategories.map(([cat]) => getCategoryColor(cat)),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { boxWidth: 10, color: '#475569', font: { size: 9, family: 'Inter, sans-serif' } },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const count = context.raw || 0;
            const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
            return ` ${context.label}: ${Number(count).toLocaleString('id-ID')} item (${pct}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

  // 2. Sub-Kategori Detail Data & Options (Top 10 Granular Maritime Subcategories)
  const displaySubs = subEntries.slice(0, 10);
  const subLabels = displaySubs.map(([s]) => s);
  const subCounts = displaySubs.map(([_, c]) => c);

  const subCategoryLabelsPlugin = {
    id: 'subCategoryLabelsPlugin',
    afterDatasetsDraw(chart: any) {
      try {
        const { ctx } = chart;
        if (!ctx || !chart.isDatasetVisible?.(0)) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || meta.hidden || !Array.isArray(meta.data)) return;

        meta.data.forEach((element: any, index: number) => {
          if (!element || typeof element.x !== 'number' || typeof element.y !== 'number') return;
          const val = subCounts[index];
          if (val === undefined || val === null) return;
          const pct = totalItems > 0 ? Math.round((val / totalItems) * 100) : 0;
          const text = `${Number(val).toLocaleString('id-ID')} (${pct}%)`;

          ctx.save();
          ctx.font = '600 9px "JetBrains Mono", monospace, sans-serif';
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, element.x + 6, element.y);
          ctx.restore();
        });
      } catch (err) {
        // Guard
      }
    },
  };

  const subBarData = {
    labels: subLabels,
    datasets: [
      {
        label: 'Kuantitas Sub-Kategori',
        data: subCounts,
        backgroundColor: subLabels.map((_, idx) => {
          const colors = ['#0284c7', '#0d9488', '#7c3aed', '#f97316', '#8b5cf6', '#06b6d4', '#ea580c', '#ec4899', '#eab308', '#14b8a6'];
          return colors[idx % colors.length];
        }),
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.85,
      },
    ],
  };

  const subBarOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: 50, left: 0, top: 2, bottom: 2 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const count = context.raw || 0;
            const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
            return ` Sub-Kategori: ${Number(count).toLocaleString('id-ID')} item (${pct}% dari total)`;
          },
        },
      },
    },
    scales: {
      y: {
        grid: { display: false },
        ticks: {
          color: '#1e293b',
          font: { size: 9, weight: '600', family: 'Inter, sans-serif' },
        },
      },
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.85)' },
        ticks: {
          color: '#64748b',
          font: { size: 9, family: 'JetBrains Mono, monospace' },
          callback: (value: any) => Number(value).toLocaleString('id-ID'),
        },
      },
    },
  };

  // View Mode: Primary Categories Bar Chart (Default)
  const displayCategories = entries.slice(0, 10);
  const labels = displayCategories.map(([cat]) => cat);
  const counts = displayCategories.map(([_, count]) => count);

  const categoryLabelsPlugin = React.useMemo(
    () => ({
      id: 'categoryHorizontalLabels',
      afterDatasetsDraw(chart: any) {
        try {
          const { ctx } = chart;
          if (!ctx || !chart.isDatasetVisible?.(0)) return;
          const meta = chart.getDatasetMeta(0);
          if (!meta || meta.hidden || !Array.isArray(meta.data)) return;

          meta.data.forEach((element: any, index: number) => {
            if (
              !element ||
              typeof element.x !== 'number' ||
              typeof element.y !== 'number' ||
              isNaN(element.x) ||
              isNaN(element.y)
            ) {
              return;
            }
            const val = counts[index];
            if (val === undefined || val === null) return;
            const pct = totalItems > 0 ? Math.round((val / totalItems) * 100) : 0;
            const text = `${Number(val).toLocaleString('id-ID')} (${pct}%)`;

            ctx.save();
            ctx.font = '600 9px "JetBrains Mono", monospace, sans-serif';
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, element.x + 6, element.y);
            ctx.restore();
          });
        } catch (err) {
          // Guard against canvas render race conditions
        }
      },
    }),
    [counts, totalItems]
  );

  const barData = {
    labels,
    datasets: [
      {
        label: 'Kuantitas Permintaan',
        data: counts,
        backgroundColor: labels.map((cat) => getCategoryColor(cat)),
        borderRadius: 4,
        barPercentage: 0.72,
        categoryPercentage: 0.85,
      },
    ],
  };

  const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        right: 48,
        left: 0,
        top: 2,
        bottom: 2,
      },
    },
    onClick: (event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clickedCat = labels[idx];
        if (clickedCat && categoryDetails[clickedCat]) {
          setSelectedCategory(clickedCat);
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const count = context.raw || 0;
            const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
            return ` Jumlah: ${Number(count).toLocaleString('id-ID')} item (${pct}% dari total) • Klik untuk drilldown`;
          },
        },
      },
    },
    scales: {
      y: {
        grid: { display: false },
        ticks: {
          color: '#1e293b',
          font: { size: 9.5, weight: '600', family: 'Inter, sans-serif' },
        },
      },
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.85)' },
        ticks: {
          color: '#64748b',
          font: { size: 9, family: 'JetBrains Mono, monospace' },
          callback: (value: any) => Number(value).toLocaleString('id-ID'),
        },
      },
    },
  };

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="flex items-center justify-between pb-1.5 text-[10px]">
        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-muted p-0.5 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              viewMode === 'bar'
                ? 'bg-white dark:bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Kategori
          </button>
          <button
            type="button"
            onClick={() => setViewMode('sub_category')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              viewMode === 'sub_category'
                ? 'bg-white dark:bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sub-Kategori
          </button>
          <button
            type="button"
            onClick={() => setViewMode('donut')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              viewMode === 'donut'
                ? 'bg-white dark:bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Donut
          </button>
        </div>

        {/* Click hint or validation indicator */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="hidden sm:inline text-sky-600 dark:text-sky-400 font-medium">Klik bar untuk detail &rarr;</span>
          {intellectualMetrics && (
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/50">
              {intellectualMetrics.classificationRate}% Valid
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[190px]">
        {viewMode === 'donut' && (
          <Doughnut data={donutData as any} options={donutOptions as any} />
        )}
        {viewMode === 'sub_category' && (
          <Bar data={subBarData as any} options={subBarOptions as any} plugins={[subCategoryLabelsPlugin]} />
        )}
        {viewMode === 'bar' && (
          <Bar data={barData as any} options={barOptions as any} plugins={[categoryLabelsPlugin]} />
        )}
      </div>
    </div>
  );
}

export function FleetMonthlyTrendChart({
  monthlyData,
  defaultMode = 'combo',
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

  const safeMonthlyData = monthlyData || [];
  if (safeMonthlyData.length === 0) {
    return <EmptyChartPlaceholder message="Belum ada data tren bulanan armada" />;
  }

  // Custom Data Labels Plugin to draw precision numbers directly above each bar / line point
  const precisionDataLabelsPlugin = React.useMemo(
    () => ({
      id: 'fleetPrecisionDataLabels',
      afterDatasetsDraw(chart: any) {
        try {
          const { ctx } = chart;
          if (!ctx || !chart.data?.datasets) return;

          chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
            if (!chart.isDatasetVisible?.(datasetIndex)) return;
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta || meta.hidden || !Array.isArray(meta.data)) return;

            meta.data.forEach((element: any, index: number) => {
              if (!element || typeof element.x !== 'number' || isNaN(element.x)) return;
              const yVal =
                typeof element.y === 'number' && !isNaN(element.y)
                  ? element.y
                  : typeof element.base === 'number' && !isNaN(element.base)
                  ? element.base
                  : null;
              if (yVal === null) return;

              const val = dataset.data?.[index];
              if (val === undefined || val === null || val === 0) return;
              const labelText = Number(val).toLocaleString('id-ID');

              ctx.save();
              ctx.font = '600 9px "JetBrains Mono", monospace, sans-serif';
              ctx.fillStyle = datasetIndex === 0 ? '#0284c7' : '#7c3aed';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';

              // Position text right above the top of the bar or point
              const yPos = yVal - 4;
              ctx.fillText(labelText, element.x, yPos);
              ctx.restore();
            });
          });
        } catch (err) {
          // Guard against canvas render race conditions
        }
      },
    }),
    []
  );

  const chartData = {
    labels: safeMonthlyData.map((d) => d.monthName),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Jumlah FPB',
        data: safeMonthlyData.map((d) => d.fpbCount || 0),
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
        data: safeMonthlyData.map((d) => d.qtyTotal || 0),
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
            const label = context.dataset?.label || '';
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
            className={`px-2 py-0.5 rounded transition cursor-pointer ${
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
            className={`px-2 py-0.5 rounded transition cursor-pointer ${
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
        <Chart
          key={chartMode}
          type="bar"
          data={chartData as any}
          options={options as any}
          plugins={[precisionDataLabelsPlugin]}
        />
      </div>
    </div>
  );
}
