'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileCheck2,
  Anchor,
  AlertTriangle,
  Filter,
  Building2,
  PanelLeftClose,
} from 'lucide-react';
import { TabType, LapseFilterType } from '@/types/procurement';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  selectedLapse: LapseFilterType;
  onSelectLapse: (lapse: LapseFilterType) => void;
  totalCount: number;
  criticalCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  selectedLapse,
  onSelectLapse,
  totalCount,
  criticalCount,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const menuItems = [
    {
      id: 'overview' as TabType,
      label: 'Dashboard Eksekutif & KPI',
      sublabel: 'Overview & Ringkasan Metrik',
      icon: LayoutDashboard,
      badge: 'Utama',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      id: 'procurement' as TabType,
      label: 'Monitoring Berkas Fisik & PIC',
      sublabel: 'Alur Dokumen PCH, TTB, Lapangan',
      icon: FileCheck2,
      badge: `${totalCount} Berkas`,
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      id: 'armada' as TabType,
      label: 'Layanan Armada & Stok Backlog',
      sublabel: 'Verifikasi QTY FPB vs FSTB',
      icon: Anchor,
      badge: 'FSTB Match',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      id: 'analytics' as TabType,
      label: 'Bottleneck & SLA Audit',
      sublabel: 'Distribusi Lapse & Beban PIC',
      icon: AlertTriangle,
      badge: criticalCount > 0 ? `${criticalCount} Kritis` : 'SLA Aman',
      badgeColor:
        criticalCount > 0
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
  ];

  return (
    <aside
      className={`flex-shrink-0 bg-[#080d19]/90 backdrop-blur-md border-slate-800/80 flex flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out select-none z-20 ${
        isCollapsed
          ? 'w-0 p-0 border-r-0 opacity-0 pointer-events-none -translate-x-8'
          : 'w-full md:w-72 lg:w-80 p-4 lg:p-5 border-r opacity-100 translate-x-0'
      }`}
      style={{
        willChange: 'width, padding, opacity, transform',
      }}
    >
      {/* Inner fixed-width container prevents awkward text wrapping during width animation */}
      <div className="w-[17rem] lg:w-[18.5rem] flex flex-col justify-between h-full gap-6">
        <div className="space-y-6">
          {/* Module Title with Sembunyikan Button */}
          <div className="flex items-center justify-between px-1 border-b border-slate-800/60 pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                MODUL KENDALI PENGADAAN
              </span>
              <h2 className="text-sm font-bold text-slate-200 mt-0.5">Navigasi Utama Sistem</h2>
            </div>
            <button
              onClick={onToggleCollapse}
              title="Sembunyikan Sidebar Navigasi"
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 flex items-center gap-1.5 text-[11px] font-medium transition group active:scale-95"
            >
              <PanelLeftClose className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Sembunyikan</span>
            </button>
          </div>

          {/* 4 Main Left Navigation Tabs */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3 border group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/60 border-cyan-500/50 shadow-lg shadow-cyan-950/30'
                      : 'bg-slate-900/40 hover:bg-slate-900/90 border-slate-800/70 hover:border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg transition-transform duration-200 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow scale-105'
                        : 'bg-slate-800 text-slate-400 group-hover:text-cyan-400 group-hover:bg-slate-800/80 group-hover:scale-105'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {item.sublabel}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-semibold border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-mono text-cyan-400 flex items-center gap-0.5">
                          &bull; Aktif
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Filter Lapse Day in Sidebar */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                <span>Filter Lapse Day</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Lead Time</span>
            </div>

            <div className="space-y-1 text-xs">
              {[
                { id: 'ALL' as LapseFilterType, label: 'Semua Durasi', desc: 'Seluruh PO' },
                {
                  id: 'NORMAL' as LapseFilterType,
                  label: 'Normal (0 - 2 Hari)',
                  desc: 'Alur Lancar',
                  tone: 'text-emerald-400',
                },
                {
                  id: 'WARNING' as LapseFilterType,
                  label: 'Perhatian (3 - 5 Hari)',
                  desc: 'Mendekati SLA',
                  tone: 'text-amber-400',
                },
                {
                  id: 'CRITICAL' as LapseFilterType,
                  label: 'Kritis (> 5 Hari)',
                  desc: 'Bottleneck',
                  tone: 'text-rose-400',
                },
              ].map((f) => {
                const isSelected = selectedLapse === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => onSelectLapse(f.id)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={f.tone || ''}>{f.label}</span>
                    <span className="text-[10px] font-mono text-slate-500">{f.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer Information */}
        <div className="p-3.5 rounded-xl bg-[#060a14] border border-slate-800/90 text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11px]">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>CPG Somber Hub</span>
          </div>
          <div className="text-[10px] text-slate-500 space-y-0.5 font-mono">
            <p>SLA Standar: &le; 4 Hari</p>
            <p>Dermaga Somber & Kariangau</p>
            <p className="text-emerald-400 flex items-center gap-1 pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              7 Entitas Terkoneksi
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
