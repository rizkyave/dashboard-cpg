'use client';

import React, { useState } from 'react';
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
  Boxes,
  Camera,
  Images,
  Navigation,
  ChevronDown,
  ShieldCheck,
  LogOut,
  ShieldAlert,
  FileSpreadsheet,
  ExternalLink,
  Wrench,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { TabType, LapseFilterType, ProcurementItem, ArmadaItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  selectedLapse: LapseFilterType;
  onSelectLapse: (lapse: LapseFilterType) => void;
  totalCount: number;
  criticalCount: number;
  inventoryCount?: number;
  kapalPosisiCount?: number;
  workOrderCount?: number;
  serviceMaintenanceCount?: number;
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
  inventoryCount,
  kapalPosisiCount,
  workOrderCount,
  serviceMaintenanceCount,
  isCollapsed,
  onToggleCollapse,
  onOpenNewRecord,
  onExcelUpload,
  showToast,
}: SidebarProps) {
  const { user, isAdmin, isVisitor, logout } = useAuth();

  const [isLeadTimeHidden, setIsLeadTimeHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cpg_hide_lead_time_filter') === 'true';
    }
    return false;
  });

  const toggleHideLeadTime = () => {
    setIsLeadTimeHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('cpg_hide_lead_time_filter', String(next));
      }
      return next;
    });
  };

  const dashboards = isVisitor
    ? [
        {
          id: 'overview' as TabType,
          label: 'Overview',
          icon: LayoutDashboard,
          badge: 'Visitor',
        },
        {
          id: 'galeri-ttb' as TabType,
          label: 'Galeri Foto TTB',
          icon: Images,
          badge: 'Blob',
        },
        {
          id: 'timemark' as TabType,
          label: 'Foto TimeMark',
          icon: Camera,
          badge: '5 Digit',
        },
      ]
    : [
        {
          id: 'overview' as TabType,
          label: 'Overview',
          icon: LayoutDashboard,
          badge: 'Main',
        },
        {
          id: 'procurement' as TabType,
          label: 'Procurement',
          icon: ShoppingBag,
          badge: totalCount > 0 ? (totalCount >= 1000 ? `${(totalCount / 1000).toFixed(0)}k` : `${totalCount}`) : undefined,
        },
        {
          id: 'armada' as TabType,
          label: 'Layanan Armada',
          icon: Anchor,
          badge: 'FSTB',
        },
        {
          id: 'galeri-ttb' as TabType,
          label: 'Galeri Foto TTB',
          icon: Images,
          badge: 'Blob',
        },
        {
          id: 'timemark' as TabType,
          label: 'Foto TimeMark',
          icon: Camera,
          badge: '5 Digit',
        },
        {
          id: 'analytics' as TabType,
          label: 'Analytics',
          icon: BarChart3,
          badge: criticalCount > 0 ? (criticalCount >= 1000 ? `${(criticalCount / 1000).toFixed(0)}k` : `${criticalCount}`) : undefined,
          badgeVariant: criticalCount > 0 ? 'destructive' : 'default',
        },
        ...(isAdmin
          ? [
              {
                id: 'admin-settings' as TabType,
                label: 'Admin Settings',
                icon: ShieldCheck,
                badge: 'Users',
                badgeVariant: 'default' as const,
              },
            ]
          : []),
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

  const handleSelectTab = (tab: TabType) => {
    onSelectTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggleCollapse();
    }
  };

  const handleSelectLapse = (lapse: LapseFilterType) => {
    onSelectLapse(lapse);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggleCollapse();
    }
  };

  const handleQuickCreate = () => {
    if (onOpenNewRecord) {
      onOpenNewRecord();
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        onToggleCollapse();
      }
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {!isCollapsed && (
        <div
          onClick={onToggleCollapse}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={`shrink-0 bg-background border-r border-border flex flex-col justify-between transition-all duration-300 select-none z-50 lg:z-30 min-h-screen fixed inset-y-0 left-0 lg:relative ${
          isCollapsed
            ? '-translate-x-full lg:w-0 lg:p-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none'
            : 'w-72 max-w-[85vw] lg:w-64 p-3.5 md:p-4 opacity-100 translate-x-0 shadow-2xl lg:shadow-none'
        }`}
      >
        <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar">
          {/* Brand Header with CPG Procurement Monitoring System */}
          <div className="flex items-center justify-between px-1.5 pt-0.5 gap-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Command className="size-4.5 text-foreground shrink-0" />
              <span className="font-bold text-xs tracking-tight text-foreground leading-tight">
                CPG Procurement Monitoring System
              </span>
            </div>
            <button
              onClick={onToggleCollapse}
              title="Tutup Navigasi"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition touch-manipulation shrink-0"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>

          {/* Quick Action Button or Visitor Badge */}
          {isVisitor ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">Mode Visitor &bull; Read-Only</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {onOpenNewRecord && (
                <button
                  onClick={handleQuickCreate}
                  className="flex-1 h-9 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs active:scale-95 touch-manipulation cursor-pointer"
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
          )}

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
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation ${
                    isActive
                      ? 'bg-muted text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`size-4 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium leading-none whitespace-nowrap ${
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
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground select-none">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">Filter Lead Time SLA</span>
              {isLeadTimeHidden && selectedLapse !== 'ALL' && (
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  {selectedLapse === 'CRITICAL'
                    ? 'Kritis'
                    : selectedLapse === 'WARNING'
                    ? 'Perhatian'
                    : 'Normal'}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={toggleHideLeadTime}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-muted transition shrink-0 cursor-pointer"
              title={isLeadTimeHidden ? 'Tampilkan Filter Lead Time' : 'Sembunyikan Filter Lead Time'}
            >
              <span>{isLeadTimeHidden ? 'Tampilkan' : 'Sembunyikan'}</span>
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${
                  isLeadTimeHidden ? '-rotate-90' : ''
                }`}
              />
            </button>
          </div>

          {!isLeadTimeHidden && (
            <nav className="space-y-0.5 animate-in fade-in-50 duration-150">
              {slaFilters.map((flt) => {
                const Icon = flt.icon;
                const isActive = selectedLapse === flt.id;
                return (
                  <button
                    key={flt.id}
                    onClick={() => handleSelectLapse(flt.id)}
                    className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation ${
                      isActive
                        ? 'bg-muted text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`size-3.5 shrink-0 ${
                          flt.id === 'CRITICAL'
                            ? 'text-rose-500'
                            : flt.id === 'WARNING'
                            ? 'text-amber-500'
                            : flt.id === 'NORMAL'
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                      <span className="truncate whitespace-nowrap">{flt.label}</span>
                    </div>
                    {flt.count !== undefined && flt.count > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap leading-none">
                        {flt.count >= 1000 ? `${(flt.count / 1000).toFixed(0)}k` : flt.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Modul Tambahan (Cek Persediaan, Posisi Kapal, List WO) - Khusus Admin & User */}
        {!isVisitor && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Modul Tambahan</span>
              <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                Eksternal &amp; Live
              </span>
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleSelectTab('inventory')}
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation ${
                  activeTab === 'inventory'
                    ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Boxes
                    className={`size-4 shrink-0 ${
                      activeTab === 'inventory' ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">Cek Persediaan</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {inventoryCount !== undefined && inventoryCount > 0
                    ? inventoryCount >= 1000
                      ? `${(inventoryCount / 1000).toFixed(0)}k`
                      : `${inventoryCount}`
                    : '10k'}
                </span>
              </button>

              {/* Posisi Kapal FMS (Tepat di paling bawah Cek Persediaan) */}
              <button
                onClick={() => handleSelectTab('pos-kapal')}
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation ${
                  activeTab === 'pos-kapal'
                    ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Navigation
                    className={`size-4 shrink-0 ${
                      activeTab === 'pos-kapal' ? 'text-sky-500' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">Posisi Kapal</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {kapalPosisiCount !== undefined && kapalPosisiCount > 0
                    ? `${kapalPosisiCount}`
                    : 'Live'}
                </span>
              </button>

              {/* Modul Baru: List WO (Work Order Dashboard Langsung di Web) */}
              <button
                onClick={() => handleSelectTab('work-order')}
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                  activeTab === 'work-order'
                    ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Buka Modul Monitoring Work Order (WO)"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet
                    className={`size-4 shrink-0 ${
                      activeTab === 'work-order' ? 'text-blue-500' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">List WO</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {workOrderCount !== undefined && workOrderCount > 0
                    ? `${workOrderCount}`
                    : 'Sync'}
                </span>
              </button>

              {/* Modul Baru: List SM (Service & Maintenance Bengkel Rekanan) */}
              <button
                onClick={() => handleSelectTab('list-sm')}
                className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                  activeTab === 'list-sm'
                    ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Buka Modul Monitoring Service & Maintenance (SM) Bengkel Vendor"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Wrench
                    className={`size-4 shrink-0 ${
                      activeTab === 'list-sm' ? 'text-amber-500' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">List SM</span>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {serviceMaintenanceCount !== undefined && serviceMaintenanceCount > 0
                    ? `${serviceMaintenanceCount}`
                    : 'Vendor'}
                </span>
              </button>
            </nav>
          </div>
        )}
      </div>


      {/* Footer User Info, Logout & Theme Toggle */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs pb-safe gap-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`size-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0 ${
              isAdmin
                ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                : isVisitor
                ? 'bg-linear-to-tr from-emerald-600 to-teal-600'
                : 'bg-linear-to-tr from-sky-500 to-indigo-500'
            }`}
          >
            {user?.avatar || (user?.name ? user.name[0]?.toUpperCase() : 'U')}
          </div>
          <div className="grid leading-tight min-w-0 flex-1">
            <span className="text-foreground font-semibold text-xs truncate">
              {user?.name || 'Pengguna'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {isAdmin ? 'CPG Admin' : isVisitor ? 'Visitor (Read-Only)' : 'Staff User'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (window.confirm('Apakah Anda yakin ingin keluar (logout)?')) {
                logout();
              }
            }}
            title="Keluar / Logout"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <LogOut className="size-3.5" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
    </>
  );
}
