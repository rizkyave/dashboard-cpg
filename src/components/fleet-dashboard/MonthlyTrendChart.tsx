'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { TrendingUp, X, Ship } from 'lucide-react';
import { MonthlyTrendPoint } from './types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
  activeMonth: string; // 'ALL' | '06' | '07' | '08' | '09' | '10'
  onSelectMonth: (monthKey: string) => void;
  selectedArmadaName?: string | null;
  onClearSelectedArmada?: () => void;
}

export default function MonthlyTrendChart({
  data,
  activeMonth,
  onSelectMonth,
  selectedArmadaName,
  onClearSelectedArmada,
}: MonthlyTrendChartProps) {
  const totalTrendFpb = useMemo(() => {
    return data.reduce((sum, d) => sum + d.totalFpb, 0);
  }, [data]);

  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.monthName),
      datasets: [
        {
          type: 'line' as const,
          label: selectedArmadaName ? `Tren ${selectedArmadaName}` : 'Tren Permintaan',
          data: data.map((d) => d.totalFpb),
          borderColor: selectedArmadaName ? '#38BDF8' : '#38BDF8',
          borderWidth: 2.5,
          tension: 0.35,
          pointBackgroundColor: data.map((d) =>
            d.monthKey === activeMonth ? '#10B981' : '#38BDF8'
          ),
          pointBorderColor: '#0f172a',
          pointBorderWidth: 2,
          pointRadius: data.map((d) => (d.monthKey === activeMonth ? 6 : 4)),
          pointHoverRadius: 7,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: selectedArmadaName ? `FPB ${selectedArmadaName}` : 'Total FPB',
          data: data.map((d) => d.totalFpb),
          backgroundColor: data.map((d) => {
            if (activeMonth === 'ALL') {
              return selectedArmadaName ? '#38BDF880' : '#0EA5E980';
            }
            return d.monthKey === activeMonth ? '#10B981' : '#33415550';
          }),
          borderColor: data.map((d) => {
            if (activeMonth === 'ALL') {
              return selectedArmadaName ? '#38BDF8' : '#0EA5E9';
            }
            return d.monthKey === activeMonth ? '#34D399' : '#475569';
          }),
          borderWidth: 1,
          borderRadius: 5,
          yAxisID: 'y',
        },
      ],
    };
  }, [data, activeMonth, selectedArmadaName]);

  const chartOptions = useMemo(() => {
    const maxVal = Math.max(...data.map((d) => d.totalFpb), 5);
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          titleColor: '#F8FAFC',
          bodyColor: '#38BDF8',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 8,
          boxPadding: 4,
          cornerRadius: 8,
          callbacks: {
            title: (items: any[]) => {
              const item = items[0];
              return item ? `${item.label} (Bulan ${item.label})` : '';
            },
            label: (context: any) => {
              const val = context.raw || 0;
              const unitLabel = selectedArmadaName ? ` [${selectedArmadaName}]` : '';
              return ` ${context.dataset.label}: ${val.toLocaleString('id-ID')} FPB${unitLabel}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#94A3B8',
            font: {
              size: 10,
              family: 'monospace',
            },
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.ceil(maxVal * 1.15),
          grid: {
            color: 'rgba(51, 65, 85, 0.3)',
          },
          ticks: {
            color: '#94A3B8',
            font: {
              size: 9.5,
              family: 'monospace',
            },
            precision: 0,
          },
        },
      },
      onClick: (event: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const clicked = data[idx];
          if (clicked) {
            onSelectMonth(clicked.monthKey === activeMonth ? 'ALL' : clicked.monthKey);
          }
        }
      },
    };
  }, [data, activeMonth, onSelectMonth, selectedArmadaName]);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-md backdrop-blur-md flex flex-col justify-between h-full space-y-2.5">
      {/* Header Tren Bulanan */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            {selectedArmadaName ? <Ship className="size-3.5 text-sky-400" /> : <TrendingUp className="size-3.5" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
              <span>{selectedArmadaName ? 'TREN BULANAN:' : 'TREN PERMINTAAN BULANAN'}</span>
              {selectedArmadaName && (
                <span className="text-sky-300 font-extrabold truncate max-w-[150px] sm:max-w-[220px]">
                  {selectedArmadaName}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400 truncate">
              {selectedArmadaName
                ? `Fluktuasi pengajuan FPB armada ${selectedArmadaName} (Jun – Okt 2026).`
                : 'Sinkron dengan total armada terpilih. Klik batang untuk filter bulan.'}
            </p>
          </div>
        </div>

        {/* Indikator Total & Reset Filter Armada */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
              selectedArmadaName
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Total FPB sepanjang periode aktif"
          >
            {totalTrendFpb.toLocaleString('id-ID')} FPB
          </span>

          {selectedArmadaName && onClearSelectedArmada && (
            <button
              type="button"
              onClick={onClearSelectedArmada}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-0.5 font-mono cursor-pointer transition"
              title="Reset pilihan armada (kembalikan ke seluruh armada)"
            >
              <X className="size-2.5" />
              <span>Reset</span>
            </button>
          )}

          {!selectedArmadaName && (
            <span className="hidden sm:inline px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/60">
              Jun – Okt 2026
            </span>
          )}
        </div>
      </div>

      {/* Area Grafik */}
      <div className="h-44 sm:h-48 w-full mt-auto">
        <Chart type="bar" data={chartData as any} options={chartOptions as any} />
      </div>
    </div>
  );
}
