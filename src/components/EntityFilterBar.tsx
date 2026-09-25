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
    <section className="bg-background/90 border-b border-border px-4 lg:px-6 py-2 transition-colors">
      <div className="flex items-center justify-between overflow-x-auto gap-3 no-scrollbar max-w-[1850px] mx-auto">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1 hidden sm:inline">
            Entitas:
          </span>
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            {ENTITIES.map((ent) => {
              const isActive = selectedEntity === ent.code;
              return (
                <button
                  key={ent.code}
                  onClick={() => onSelectEntity(ent.code as EntityCode)}
                  className={`h-6.5 px-2.5 rounded-md text-xs font-medium transition whitespace-nowrap outline-none ${
                    isActive
                      ? 'bg-background text-foreground shadow-xs font-semibold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ent.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync Active &bull; Somber & Kariangau
          </span>
        </div>
      </div>
    </section>
  );
}
