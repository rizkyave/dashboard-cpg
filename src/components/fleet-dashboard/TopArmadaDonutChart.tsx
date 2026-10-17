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
import { PieChart, X } from 'lucide-react';

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
            return a.name === selectedArmadaId ? a.color : `${a.color}35`;
          }),
          borderColor: armadaList.map((a) => {
            if (!selectedArmadaId) return '#0f172a';
            return a.name === selectedArmadaId ? '#ffffff' : '#1e293b';
          }),
          borderWidth: armadaList.map((a) => (a.name === selectedArmadaId ? 2.5 : 1)),
          hoverOffset: 8,
          offset: armadaList.map((a) => (a.name === selectedArmadaId ? 10 : 0)),
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
        duration: 400,
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
          padding: 8,
          boxPadding: 4,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (context: any) => {
              const val = context.raw || 0;
              const pct = totalFpb > 0 ? ((val / totalFpb) * 100).toFixed(1) : '0';
              return ` ${context.label}: ${val.toLocaleString('id-ID')} FPB (${pct}%)`;
            },
          },
        },
      },
      onClick: (event: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const clicked = armadaList[idx];
          if (clicked) {
            onSelectArmada(selectedArmadaId === clicked.name ? null : clicked.name);
          }
        } else {
          onSelectArmada(null);
        }
      },
    };
  }, [armadaList, selectedArmadaId, totalFpb, onSelectArmada]);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-md backdrop-blur-md flex flex-col justify-between h-full">
      {/* Header Donut Chart Compact */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 gap-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
            <PieChart className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>12 ARMADA DENGAN PERMINTAAN FPB TERBANYAK</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                2D Donut
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Proporsi riil pengajuan FPB armada. Klik irisan atau nama untuk memfilter.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {periodLabel}
          </span>
          {selectedArmadaId && (
            <button
              type="button"
              onClick={() => onSelectArmada(null)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-0.5 font-mono cursor-pointer transition"
            >
              <X className="size-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Konten Horizontal Inline: Donut Kiri + 2 Kolom Legenda Kanan */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
        {/* Sisi Kiri: Donut Chart Proporsional (~200px - 220px) */}
        <div className="w-[200px] h-[200px] sm:w-[210px] sm:h-[210px] relative shrink-0 flex items-center justify-center">
          {armadaList.length > 0 ? (
            <Doughnut data={chartData} options={chartOptions as any} />
          ) : (
            <div className="text-slate-500 text-xs font-mono">Tidak ada data</div>
          )}

          {/* Teks Agregat di Tengah Donut Cutout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
            <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              TOTAL FPB
            </span>
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight drop-shadow-sm my-0.5">
              {totalFpb.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-semibold text-teal-400 truncate max-w-[130px]">
              {selectedArmadaId ? selectedArmadaId : '12 Armada + Lainnya'}
            </span>
          </div>
        </div>

        {/* Sisi Kanan: 2 Kolom List Legenda Armada yang Padat (py-1 text-xs) */}
        <div className="flex-1 w-full grid grid-cols-2 gap-1.5 text-xs">
          {armadaList.map((item, idx) => {
            const isSelected = selectedArmadaId === item.name;
            const rankText = idx < 12 ? `#${idx + 1}` : '•';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectArmada(selectedArmadaId === item.name ? null : item.name)}
                className={`flex items-center justify-between py-1 px-2 rounded-lg border text-left transition cursor-pointer group ${
                  isSelected
                    ? 'bg-sky-500/25 border-sky-400 text-white shadow-sm ring-1 ring-sky-400/50'
                    : selectedArmadaId
                    ? 'bg-slate-800/40 border-slate-800/80 text-slate-500 opacity-60 hover:opacity-100 hover:bg-slate-800'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                }`}
                title={`${item.name} (${item.fpbCount} FPB - ${item.percentage.toFixed(1)}%)`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1.5">
                  <span
                    className="size-2 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono text-[9px] text-slate-400 font-bold shrink-0">
                    {rankText}
                  </span>
                  <span className="truncate text-[11px] font-medium group-hover:text-white transition">
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                  <span className="font-bold text-white">
                    {item.fpbCount}
                  </span>
                  <span className="text-slate-400 text-[9px]">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
