'use client';

import React from 'react';
import { ArmadaDataPoint } from './types';
import { BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';

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
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              Top Armada: Diminta vs Realisasi
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Komparasi kuantitas barang FPB (diminta) vs FSTB (realisasi).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-sky-500 shrink-0" />
            <span className="text-slate-300">Qty FPB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-teal-400 shrink-0" />
            <span className="text-slate-300">Realisasi FSTB</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {displayList.map((armada) => {
          const isSelected = selectedArmadaId === armada.name;
          const reqWidth = (armada.qtyFPB / maxQty) * 100;
          const relWidth = (armada.qtyFSTB / maxQty) * 100;
          const pctFulfillment = armada.qtyFPB > 0 ? Math.round((armada.qtyFSTB / armada.qtyFPB) * 100) : 0;

          return (
            <div
              key={armada.id}
              onClick={() => onSelectArmada(isSelected ? null : armada.name)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/50 shadow-md'
                  : selectedArmadaId
                  ? 'bg-slate-800/30 border-slate-800/60 opacity-60 hover:opacity-100 hover:bg-slate-800/80'
                  : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60'
              }`}
              title={`Klik untuk menyorot ${armada.name}`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                <span className="text-white truncate flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: armada.color }}
                  />
                  <span className="font-semibold">{armada.name}</span>
                </span>
                <span className="font-mono text-[11px] text-teal-400 shrink-0">
                  {pctFulfillment}% ({armada.qtyFSTB.toLocaleString('id-ID')} / {armada.qtyFPB.toLocaleString('id-ID')} unit)
                </span>
              </div>

              {/* Bar Stack */}
              <div className="space-y-1">
                {/* Bar Diminta (FPB) */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500/80 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, reqWidth))}%` }}
                  />
                </div>
                {/* Bar Realisasi (FSTB) */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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

