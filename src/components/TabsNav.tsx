'use client';

import React from 'react';
import { TabType, LapseFilterType } from '@/types/procurement';

interface TabsNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  selectedLapse: LapseFilterType;
  onSelectLapse: (lapse: LapseFilterType) => void;
}

export default function TabsNav({
  activeTab,
  onSelectTab,
  selectedLapse,
  onSelectLapse,
}: TabsNavProps) {
  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Dashboard Eksekutif & KPI' },
    { id: 'procurement', label: 'Monitoring Berkas Fisik & PIC' },
    { id: 'armada', label: 'Layanan Armada & Belum Terpenuhi' },
    { id: 'analytics', label: 'Bottleneck & SLA Audit' },
  ];

  return (
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-3">
      <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isActive
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-400">Filter Lapse Day:</span>
        <select
          value={selectedLapse}
          onChange={(e) => onSelectLapse(e.target.value as LapseFilterType)}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400 font-mono"
        >
          <option value="ALL">Semua Durasi</option>
          <option value="NORMAL">Normal (0 - 2 Hari)</option>
          <option value="WARNING">Perhatian (3 - 5 Hari)</option>
          <option value="CRITICAL">Kritis (&gt; 5 Hari)</option>
        </select>
      </div>
    </div>
  );
}
