'use client';

import React from 'react';
import { EntityCode } from '@/types/procurement';
import { ENTITIES } from '@/data/initialData';

interface EntityFilterBarProps {
  selectedEntity: EntityCode;
  onSelectEntity: (entity: EntityCode) => void;
}

export default function EntityFilterBar({
  selectedEntity,
  onSelectEntity,
}: EntityFilterBarProps) {
  return (
    <section className="bg-[#0b101f] border-b border-slate-800/90 px-4 lg:px-8 py-2.5">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between overflow-x-auto gap-2 no-scrollbar">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider mr-1 hidden sm:inline">
            Entitas Resmi CPG:
          </span>
          {ENTITIES.map((ent) => {
            const isActive = selectedEntity === ent.code;
            return (
              <button
                key={ent.code}
                onClick={() => onSelectEntity(ent.code as EntityCode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition font-mono whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {ent.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Data Synchronized &bull; CPG Holding
          </span>
        </div>
      </div>
    </section>
  );
}
