'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ArmadaDataPoint } from './types';
import { Ship, PieChart, Sparkles, Filter, X, Check } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TopArmadaDonutChartProps {
  armadaList: ArmadaDataPoint[];
  totalFpb: number;
  selectedArmadaId: string | null;
  onSelectArmada: (armadaName: string | null) => void;
  periodLabel: string;
}

export default function TopArmadaDonutChart({
  armadaList,
  totalFpb,
  selectedArmadaId,
  onSelectArmada,
  periodLabel,
}: TopArmadaDonutChartProps) {
  // Chart.js Data Memoization
  const chartData = useMemo(() => {
    return {
      labels: armadaList.map((a) => a.name),
      datasets: [
        {
          data: armadaList.map((a) => a.fpbCount),
          backgroundColor: armadaList.map((a) => {
            if (!selectedArmadaId) return a.color;
            // Highlight selected slice, dim others
            return a.name === selectedArmadaId ? a.color : `${a.color}35`;
          }),
          borderColor: armadaList.map((a) => {
            if (!selectedArmadaId) return '#0f172a';
            return a.name === selectedArmadaId ? '#ffffff' : '#1e293b';
          }),
          borderWidth: armadaList.map((a) => (a.name === selectedArmadaId ? 3 : 1)),
          hoverOffset: 10,
          // Pull-out effect untuk irisan yang dipilih
          offset: armadaList.map((a) => (a.name === selectedArmadaId ? 14 : 0)),
        },
      ],
    };
  }, [armadaList, selectedArmadaId]);

  // Chart.js Options Memoization
  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      animation: {
        animateRotate: true,
        animateScale: false,
        duration: 500,
      },
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
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const val = context.raw || 0;
              const pct = totalFpb > 0 ? ((val / totalFpb) * 100).toFixed(1) : '0';
              return ` ${context.label}: ${val.toLocaleString('id-ID')} Tiket FPB (${pct}%)`;
            },
          },
        },
      },
      onClick: (event: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const clicked = armadaList[idx];
          if (clicked) {
            if (selectedArmadaId === clicked.name) {
              onSelectArmada(null);
            } else {
              onSelectArmada(clicked.name);
            }
          }
        } else {
          onSelectArmada(null);
        }
      },
    };
  }, [armadaList, selectedArmadaId, totalFpb, onSelectArmada]);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-4">
      {/* Header Donut Chart */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
            <PieChart className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>12 ARMADA DENGAN PERMINTAAN FPB TERBANYAK</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Modern 2D Donut
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Proporsi riil pengajuan FPB (12 armada teratas + Armada Lainnya). Klik irisan untuk memfilter sub-chart.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {periodLabel}
          </span>
          {selectedArmadaId && (
            <button
              type="button"
              onClick={() => onSelectArmada(null)}
              className="text-xs px-2.5 py-1 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-1 font-mono cursor-pointer transition"
            >
              <X className="size-3" />
              <span>Reset Pilihan</span>
            </button>
          )}
        </div>
      </div>

      {/* Konten Chart & Legenda Interaktif */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Kolom Donut Chart dengan Center Text Overlay */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
          <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-square relative flex items-center justify-center">
            {armadaList.length > 0 ? (
              <Doughnut data={chartData} options={chartOptions as any} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
                Tidak ada data pada periode ini
              </div>
            )}

            {/* Teks Agregat di Tengah Donut Cutout (Transparent 2D Center) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                TOTAL FPB
              </span>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight drop-shadow-md my-0.5">
                {totalFpb.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] font-semibold text-teal-400 truncate max-w-[190px]">
                {selectedArmadaId ? selectedArmadaId : '12 Armada + Lainnya'}
              </span>
              {selectedArmadaId && (
                <span className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse">
                  Klik untuk Reset
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Legenda Interaktif (Responsive Grid) */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {armadaList.map((item, idx) => {
              const isSelected = selectedArmadaId === item.name;
              const rankText = idx < 12 ? `#${idx + 1}` : '•';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (selectedArmadaId === item.name) {
                      onSelectArmada(null);
                    } else {
                      onSelectArmada(item.name);
                    }
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg ring-1 ring-sky-400/50'
                      : selectedArmadaId
                      ? 'bg-slate-800/40 border-slate-800/80 text-slate-400 opacity-60 hover:opacity-100 hover:bg-slate-800'
                      : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/60 text-slate-200'
                  }`}
                  title={`Klik untuk melihat detail ${item.name} (${item.fpbCount} FPB)`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    {/* Color Swatch Dot */}
                    <span
                      className="size-3 rounded-full shrink-0 border border-white/20 shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                      {rankText}
                    </span>
                    <span className="truncate font-medium text-[11px] group-hover:text-white transition">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                    <span className="font-bold text-white">
                      {item.fpbCount.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

