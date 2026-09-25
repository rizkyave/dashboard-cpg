'use client';

import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Anchor,
  BarChart3,
  CirclePlus,
  CheckCircle2,
  FileText,
  Database,
  Ship,
  Clock,
  AlertTriangle,
  AlertOctagon,
  List,
  Command,
  MoreVertical,
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
  onOpenNewRecord?: () => void;
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
  onOpenNewRecord,
}: SidebarProps) {
  const dashboards = [
    {
      id: 'overview' as TabType,
      label: 'Default (Overview)',
      icon: LayoutDashboard,
      badge: 'Main',
    },
    {
      id: 'procurement' as TabType,
      label: 'Procurement PO',
      icon: ShoppingBag,
      badge: totalCount > 0 ? `${totalCount}` : undefined,
    },
    {
      id: 'armada' as TabType,
      label: 'Layanan Armada',
      icon: Anchor,
      badge: 'FSTB',
    },
    {
      id: 'analytics' as TabType,
      label: 'Analytics & SLA',
      icon: BarChart3,
      badge: criticalCount > 0 ? `${criticalCount} Kritis` : undefined,
      badgeVariant: criticalCount > 0 ? 'destructive' : 'default',
    },
  ];

  const validationModules = [
    { label: 'INPUT DATA MELINDA', badge: 'DONE', color: 'emerald' },
    { label: 'PROCUREMENT', badge: 'TERVERIFIKASI', color: 'emerald' },
    { label: 'MASTER DATA BU NOOR', badge: 'DONE', color: 'emerald' },
    { label: 'LAYANAN ARMADA', badge: 'MATCHING', color: 'emerald' },
  ];

  const slaFilters: { id: LapseFilterType; label: string; icon: any; count?: number }[] = [
    { id: 'ALL', label: 'Semua Berkas', icon: List },
    { id: 'NORMAL', label: 'Normal (≤ 2 hari)', icon: Clock },
    { id: 'WARNING', label: 'Perhatian (3-5 hari)', icon: AlertTriangle },
    { id: 'CRITICAL', label: 'Kritis (> 5 hari)', icon: AlertOctagon, count: criticalCount },
  ];

  return (
    <aside
      className={`shrink-0 bg-background border-r border-border flex flex-col justify-between transition-all duration-200 select-none z-30 ${
        isCollapsed
          ? 'w-0 p-0 border-r-0 opacity-0 pointer-events-none -translate-x-full'
          : 'w-64 p-3 md:p-4 opacity-100 translate-x-0'
      }`}
    >
      <div className="flex flex-col gap-5 overflow-y-auto no-scrollbar">
        {/* Brand / Logo Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7.5 items-center justify-center rounded-lg border border-border bg-card shadow-xs text-foreground">
              <Command className="size-4 text-cyan-400" />
            </div>
            <div className="grid leading-tight">
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Studio Admin
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                CPG Procurement v2.4
              </span>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            title="Sembunyikan Sidebar"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Quick Action Button */}
        {onOpenNewRecord && (
          <button
            onClick={onOpenNewRecord}
            className="w-full h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <CirclePlus className="size-3.5" />
            <span>Quick Create (Input PO)</span>
          </button>
        )}

        {/* Group 1: Dashboards */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Dashboards
          </div>
          <nav className="space-y-0.5">
            {dashboards.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`size-4 ${isActive ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        item.badgeVariant === 'destructive'
                          ? 'bg-destructive/20 text-rose-400 border border-destructive/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Group 2: Status Validasi 4 Modul */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Modul Terverifikasi
          </div>
          <div className="space-y-1 px-1">
            {validationModules.map((mod, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-border/80 text-[11px]"
              >
                <span className="font-semibold text-zinc-300 truncate max-w-[125px]">
                  {mod.label}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                  {mod.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Group 3: Filter SLA */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Filter SLA / Urgensi
          </div>
          <nav className="space-y-0.5">
            {slaFilters.map((flt) => {
              const Icon = flt.icon;
              const isActive = selectedLapse === flt.id;
              return (
                <button
                  key={flt.id}
                  onClick={() => onSelectLapse(flt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`size-3.5 ${
                        flt.id === 'CRITICAL'
                          ? 'text-rose-400'
                          : flt.id === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <span>{flt.label}</span>
                  </div>
                  {flt.count !== undefined && flt.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {flt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer: User Card */}
      <div className="pt-3 border-t border-border mt-3">
        <div className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-muted border border-border font-bold text-xs text-foreground">
              HA
            </div>
            <div className="grid leading-tight min-w-0">
              <span className="font-medium text-xs text-foreground truncate">
                Hermansyah
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                admin@cindarapratama.com
              </span>
            </div>
          </div>
          <MoreVertical className="size-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </aside>
  );
}
