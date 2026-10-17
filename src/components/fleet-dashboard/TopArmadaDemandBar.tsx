'use client';

import React from 'react';
import { ArmadaDataPoint } from './types';
import { BarChart3 } from 'lucide-react';

interface TopArmadaDemandBarProps {
  armadaList: ArmadaDataPoint[];
  selectedArmadaId: string | null;
  onSelectArmada: (armadaName: string | null) => void;
}

export default function TopArmadaDemandBar({
  armadaList,
  selectedArmadaId,
  onSelectArmada,
}: TopArmadaDemandBarProps) {
  // Ambil top 8 armada untuk komparasi bar horizontal
  const displayList = armadaList.slice(0, 8);
  const maxQty = Math.max(...displayList.map((a) => Math.max(a.qtyFPB, a.qtyFSTB, 1)), 100);

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 shadow-md backdrop-blur-md flex flex-col justify-between space-y-2.5 h-full">
      {/* Header Compact */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <BarChart3 className="size-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              TOP ARMADA: DIMINTA VS REALISASI
            </h4>
            <p className="text-[11px] text-slate-400">
              Komparasi kuantitas barang FPB (diminta) vs FSTB (realisasi).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-[10px] font-mono shrink-0">
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-500 shrink-0" />
            <span className="text-slate-300">Qty FPB</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-teal-400 shrink-0" />
            <span className="text-slate-300">Realisasi FSTB</span>
          </div>
        </div>
      </div>

      {/* List Horizontal Bar Compact */}
      <div className="space-y-1.5 flex-1 flex flex-col justify-between">
        {displayList.map((armada) => {
          const isSelected = selectedArmadaId === armada.name;
          const reqWidth = (armada.qtyFPB / maxQty) * 100;
          const relWidth = (armada.qtyFSTB / maxQty) * 100;
          const pctFulfillment = armada.qtyFPB > 0 ? Math.round((armada.qtyFSTB / armada.qtyFPB) * 100) : 0;

          return (
            <div
              key={armada.id}
              onClick={() => onSelectArmada(isSelected ? null : armada.name)}
              className={`py-1 px-2 rounded-lg border transition cursor-pointer ${
                isSelected
                  ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/50 shadow-sm'
                  : selectedArmadaId
                  ? 'bg-slate-800/30 border-slate-800/60 opacity-60 hover:opacity-100 hover:bg-slate-800'
                  : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60'
              }`}
              title={`Klik untuk menyorot ${armada.name}`}
            >
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                <span className="text-white truncate flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: armada.color }}
                  />
                  <span className="font-semibold text-xs">{armada.name}</span>
                </span>
                <span className="font-mono text-[10px] text-teal-400 shrink-0">
                  {pctFulfillment}% ({armada.qtyFSTB.toLocaleString('id-ID')} / {armada.qtyFPB.toLocaleString('id-ID')} unit)
                </span>
              </div>

              {/* Bar Stack */}
              <div className="space-y-0.5">
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500/80 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, reqWidth))}%` }}
                  />
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, relWidth))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
