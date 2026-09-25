'use client';

import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Anchor,
  BarChart3,
  CirclePlus,
  Clock,
  AlertTriangle,
  AlertOctagon,
  List,
  Command,
  PanelLeftClose,
  Mail,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TabType, LapseFilterType, ProcurementItem, ArmadaItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import ThemeToggle from './ThemeToggle';

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
  onExcelUpload?: (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
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
  onExcelUpload,
  showToast,
}: SidebarProps) {
  const dashboards = [
    {
      id: 'overview' as TabType,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: 'Main',
    },
    {
      id: 'procurement' as TabType,
      label: 'Procurement Monitoring',
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
      label: 'Analytics & Lead Time',
      icon: BarChart3,
      badge: criticalCount > 0 ? `${criticalCount} Kritis` : undefined,
      badgeVariant: criticalCount > 0 ? 'destructive' : 'default',
    },
  ];

  const slaFilters: { id: LapseFilterType; label: string; icon: any; count?: number }[] = [
    { id: 'ALL', label: 'Semua Berkas', icon: List },
    { id: 'NORMAL', label: 'Normal (≤ 2 hari)', icon: Clock },
    { id: 'WARNING', label: 'Perhatian (3-5 hari)', icon: AlertTriangle },
    { id: 'CRITICAL', label: 'Kritis (> 5 hari)', icon: AlertOctagon, count: criticalCount },
  ];

  const handleSidebarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onExcelUpload) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const result = parseAndMergeWorkbook(workbook);

        if (result.procurement.length > 0 || result.armada.length > 0) {
          onExcelUpload({ procurement: result.procurement, armada: result.armada });
          showToast?.(
            `Data berhasil di-merge! (${result.procurement.length.toLocaleString()} total item).`,
            'success'
          );
        } else {
          showToast?.('Tidak ditemukan data valid pada sheet Excel.', 'warning');
        }
      } catch (err) {
        showToast?.('Gagal memproses file Excel.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <aside
      className={`shrink-0 bg-background border-r border-border flex flex-col justify-between transition-all duration-200 select-none z-30 min-h-screen ${
        isCollapsed
          ? 'w-0 p-0 border-r-0 opacity-0 pointer-events-none -translate-x-full'
          : 'w-64 p-3.5 md:p-4 opacity-100 translate-x-0'
      }`}
    >
      <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {/* Brand Header with CPG Admin branding in clean Studio Admin style */}
        <div className="flex items-center justify-between px-1.5 pt-0.5">
          <div className="flex items-center gap-2">
            <Command className="size-4.5 text-foreground" />
            <span className="font-bold text-sm tracking-tight text-foreground">
              CPG Admin
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            title="Sembunyikan Sidebar"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Quick Action Button matching Studio Admin screenshot: [ ⊕ Quick Create ] [ ✉ ] */}
        <div className="flex items-center gap-1.5">
          {onOpenNewRecord && (
            <button
              onClick={onOpenNewRecord}
              className="flex-1 h-9 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs active:scale-95"
            >
              <CirclePlus className="size-4" />
              <span>Quick Create</span>
            </button>
          )}

          {onExcelUpload ? (
            <label
              title="Unggah File Excel"
              className="size-9 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition shadow-xs shrink-0 active:scale-95"
            >
              <Upload className="size-4" />
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleSidebarFileUpload}
              />
            </label>
          ) : (
            <button
              className="size-9 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition shadow-xs shrink-0"
              title="Inbox Notifikasi"
            >
              <Mail className="size-4" />
            </button>
          )}
        </div>

        {/* Dashboards Section */}
        <div className="space-y-1 mt-1">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
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
                      ? 'bg-muted text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`size-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        item.badgeVariant === 'destructive'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-background text-muted-foreground border border-border'
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

        {/* Filter SLA */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Filter Lead Time SLA
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
                      ? 'bg-muted text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`size-3.5 ${
                        flt.id === 'CRITICAL'
                          ? 'text-rose-500'
                          : flt.id === 'WARNING'
                          ? 'text-amber-500'
                          : flt.id === 'NORMAL'
                          ? 'text-emerald-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                    <span>{flt.label}</span>
                  </div>
                  {flt.count !== undefined && flt.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      {flt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer User Info & Theme Toggle */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-bold text-white text-[11px]">
            H
          </div>
          <div className="grid leading-tight">
            <span className="text-foreground font-medium text-xs">Hermansyah</span>
            <span className="text-[10px] text-muted-foreground">CPG Admin</span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
