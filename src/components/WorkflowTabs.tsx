'use client';

import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

export type WorkflowTabType = 'ACTIVE' | 'COMPLETED';

export interface WorkflowTabsProps {
  currentTab: WorkflowTabType;
  onChange: (tab: WorkflowTabType) => void;
  activeCount: number;
  completedCount: number;
}

export const WorkflowTabs: React.FC<WorkflowTabsProps> = ({
  currentTab,
  onChange,
  activeCount,
  completedCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3.5 mb-3.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('ACTIVE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer ${
            currentTab === 'ACTIVE'
              ? 'bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground shadow-sm ring-2 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60'
          }`}
        >
          <Clock className={`size-4 ${currentTab === 'ACTIVE' ? 'text-amber-400' : 'text-amber-500'}`} />
          <span>Perlu Tindakan</span>
          <span
            className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full transition-colors ${
              currentTab === 'ACTIVE'
                ? 'bg-amber-500 text-white'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange('COMPLETED')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer ${
            currentTab === 'COMPLETED'
              ? 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white shadow-sm ring-2 ring-emerald-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60'
          }`}
        >
          <CheckCircle2 className={`size-4 ${currentTab === 'COMPLETED' ? 'text-white' : 'text-emerald-500'}`} />
          <span>Selesai / Lengkap Administrasi</span>
          <span
            className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full transition-colors ${
              currentTab === 'COMPLETED'
                ? 'bg-emerald-800 text-emerald-100'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {completedCount}
          </span>
        </button>
      </div>

      <div className="text-[11px] text-muted-foreground hidden lg:flex items-center gap-1.5">
        {currentTab === 'ACTIVE' ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            Dokumen aktif yang membutuhkan otorisasi tanda tangan (Tahap 0/4 s/d 3/4)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Arsip berkas selesai yang telah diverifikasi lengkap 4 PIC hingga kru armada
          </span>
        )}
      </div>
    </div>
  );
};

export default WorkflowTabs;

