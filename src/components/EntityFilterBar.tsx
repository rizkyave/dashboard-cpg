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
    <section className="bg-background/95 border-b border-border px-4 lg:px-6 py-2">
      <div className="flex items-center justify-between overflow-x-auto gap-2 no-scrollbar">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1.5 hidden sm:inline">
            Entitas CPG:
          </span>
          {ENTITIES.map((ent) => {
            const isActive = selectedEntity === ent.code;
            return (
              <button
                key={ent.code}
                onClick={() => onSelectEntity(ent.code as EntityCode)}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap outline-none ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {ent.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sync Active &bull; CPG Holding
          </span>
        </div>
      </div>
    </section>
  );
}
