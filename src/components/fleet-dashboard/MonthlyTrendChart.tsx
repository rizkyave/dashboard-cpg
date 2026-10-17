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
import { TrendingUp, Calendar } from 'lucide-react';
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
}

export default function MonthlyTrendChart({
  data,
  activeMonth,
  onSelectMonth,
}: MonthlyTrendChartProps) {
  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.monthName),
      datasets: [
        {
          type: 'line' as const,
          label: 'Tren Kebutuhan',
          data: data.map((d) => d.totalFpb),
          borderColor: '#38BDF8', // sky-400
          borderWidth: 2.5,
          tension: 0.35,
          pointBackgroundColor: data.map((d) =>
            d.monthKey === activeMonth ? '#06B6D4' : '#38BDF8'
          ),
          pointBorderColor: '#0f172a',
          pointBorderWidth: 2,
          pointRadius: data.map((d) => (d.monthKey === activeMonth ? 6 : 4)),
          pointHoverRadius: 7,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Total Tiket FPB',
          data: data.map((d) => d.totalFpb),
          backgroundColor: data.map((d) => {
            if (activeMonth === 'ALL') return '#0EA5E980';
            return d.monthKey === activeMonth ? '#10B981' : '#33415560';
          }),
          borderColor: data.map((d) => {
            if (activeMonth === 'ALL') return '#0EA5E9';
            return d.monthKey === activeMonth ? '#34D399' : '#475569';
          }),
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: 'y',
        },
      ],
    };
  }, [data, activeMonth]);

  const chartOptions = useMemo(() => {
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
          padding: 10,
          boxPadding: 6,
          cornerRadius: 10,
          callbacks: {
            label: (context: any) => {
              const val = context.raw || 0;
              return ` ${context.dataset.label}: ${val.toLocaleString('id-ID')} FPB`;
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
              size: 11,
              family: 'monospace',
            },
          },
        },
        y: {
          grid: {
            color: 'rgba(51, 65, 85, 0.4)',
          },
          ticks: {
            color: '#94A3B8',
            font: {
              size: 10,
              family: 'monospace',
            },
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
  }, [data, activeMonth, onSelectMonth]);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3 flex flex-col">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              TREN PERMINTAAN BULANAN
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Sinkron dengan total donut chart. Klik batang bulan untuk memfilter.
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
          Jun – Okt 2026
        </span>
      </div>

      <div className="h-56 w-full mt-auto">
        <Chart type="bar" data={chartData as any} options={chartOptions as any} />
      </div>
    </div>
  );
}

