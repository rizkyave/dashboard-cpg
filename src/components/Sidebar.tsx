'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Anchor,
  BarChart3,
  CirclePlus,
  Command,
  PanelLeftClose,
  Mail,
  Upload,
  Boxes,
  Images,
  Navigation,
  ShieldCheck,
  LogOut,
  ShieldAlert,
  FileSpreadsheet,
  ExternalLink,
  Wrench,
  Layers,
  UploadCloud,
  Users,
  Truck,
  PackageCheck,
  FileSignature,
  ClipboardCheck,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { TabType, LapseFilterType, ProcurementItem, ArmadaItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { canAccessTab, getRoleDisplayName } from '@/types/auth';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  selectedLapse?: LapseFilterType;
  onSelectLapse?: (lapse: LapseFilterType) => void;
  totalCount: number;
  criticalCount: number;
  inventoryCount?: number;
  kapalPosisiCount?: number;
  workOrderCount?: number;
  serviceMaintenanceCount?: number;
  sisaLayananCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNewRecord?: () => void;
  onExcelUpload?: (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  totalCount,
  criticalCount,
  inventoryCount,
  kapalPosisiCount,
  workOrderCount,
  serviceMaintenanceCount,
  sisaLayananCount,
  isCollapsed,
  onToggleCollapse,
  onOpenNewRecord,
  onExcelUpload,
  showToast,
}: SidebarProps) {
  const { user, isAdmin, isVisitor, logout } = useAuth();

  const [, setRbacRevision] = useState<number>(0);
  useEffect(() => {
    const handleRbacUpdate = () => setRbacRevision((prev) => prev + 1);
    window.addEventListener('cpg-rbac-updated', handleRbacUpdate);
    return () => window.removeEventListener('cpg-rbac-updated', handleRbacUpdate);
  }, []);

  interface DashboardNavItem {
    id: TabType;
    label: string;
    icon: any;
    badge?: string;
    badgeVariant?: 'default' | 'destructive' | string;
    title?: string;
  }

  const allDashboards: DashboardNavItem[] = [
    {
      id: 'overview' as TabType,
      label: 'Ringkasan',
      icon: LayoutDashboard,
      badge: isVisitor ? 'Tamu' : 'Utama',
      title: 'Ringkasan Monitoring Pengadaan (Terintegrasi Database Barang Sisa Layanan 2026)',
    },
    {
      id: 'review-fpb' as TabType,
      label: 'Review & Analisa FPB',
      icon: ClipboardCheck,
      badge: 'E-FPB',
      title: 'Sinkronisasi e-FPB, Review Ketersediaan Stok Gudang & Analisa Duplikasi Permintaan Armada',
    },
    {
      id: 'pratender' as TabType,
      label: 'Pratender Material',
      icon: Layers,
      badge: 'Sourcing',
      title: 'Konsolidasi & Agregasi Kebutuhan Material Terbuka (Open/Unsupplied) Lintas Armada untuk Paket Tender Bersama',
    },
    {
      id: 'monitoring-internal' as TabType,
      label: 'Monitoring Internal',
      icon: FileSpreadsheet,
      badge: 'Sheet',
      title: 'Monitoring Berkas Internal Pengadaan (Selesai Purchasing, Waktu Kirim & Serah Terima PIC TTB)',
    },
    {
      id: 'procurement' as TabType,
      label: 'Pengadaan',
      icon: ShoppingBag,
      badge: totalCount > 0 ? (totalCount >= 1000 ? `${(totalCount / 1000).toFixed(0)}k` : `${totalCount}`) : undefined,
      title: 'Monitoring Alur Pengadaan & Waktu Tunggu (Hover FPB / Item untuk Nama Barang Sisa Layanan)',
    },
    {
      id: 'armada' as TabType,
      label: 'Layanan Armada',
      icon: Anchor,
      badge: 'FSTB',
      title: 'Monitoring Layanan Armada & FSTB (Hover FPB / Item untuk Nama Barang Sisa Layanan)',
    },
    {
      id: 'upload-fstb' as TabType,
      label: 'Unggah FSTB',
      icon: PackageCheck,
      badge: 'R2',
      title: 'Unggah Dokumen FSTB ke Cloudflare R2 dengan Format Otomatis Sesuai No. FSTB',
    },
    {
      id: 'upload-ttb' as TabType,
      label: 'Unggah TTB',
      icon: UploadCloud,
      badge: 'R2',
      title: 'Unggah Dokumen TTB ke Cloudflare R2 dengan Format Otomatis Sesuai No. TTB',
    },
    {
      id: 'validasi-dokumen' as TabType,
      label: 'Validasi FSTB & TTB',
      icon: FileSignature,
      badge: 'Multi-Lini',
      title: 'Validasi Tanda Tangan Digital Multi-Lini (Purchasing, Logistik, Lapangan) Dokumen FSTB & TTB',
    },
    {
      id: 'serah-terima-lapangan' as TabType,
      label: 'Serah Terima Lap.',
      icon: Truck,
      badge: 'Tim Lap',
      title: 'Portal Tim Lapangan: Upload Bukti Foto Penyerahan Barang Berdasarkan Referensi TTB Resmi',
    },
    {
      id: 'galeri-ttb' as TabType,
      label: 'Galeri Foto TTB',
      icon: Images,
      badge: 'Blob',
      title: 'Galeri Arsip Foto TTB dari Lapangan',
    },
  ];

  const dashboards: DashboardNavItem[] = allDashboards.filter((item) =>
    canAccessTab(user?.role, item.id)
  );

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
        className={`h-screen overflow-y-auto shrink-0 bg-background border-r border-border flex flex-col justify-between transition-all duration-300 select-none z-50 lg:z-30 fixed inset-y-0 left-0 lg:relative ${
          isCollapsed
            ? '-translate-x-full lg:w-0 lg:p-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none'
            : 'w-72 max-w-[85vw] lg:w-64 p-3.5 md:p-4 opacity-100 translate-x-0 shadow-2xl lg:shadow-none'
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Brand Header with CPG Procurement Monitoring System */}
          <div className="flex items-center justify-between px-1.5 pt-0.5 gap-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Command className="size-4.5 text-foreground shrink-0" />
              <span className="font-bold text-xs tracking-tight text-foreground leading-tight">
                Sistem Monitoring Pengadaan CPG
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

          {/* Quick Action Button or Role Banner */}
          {isVisitor ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">Mode Tamu &bull; Hanya Baca</span>
            </div>
          ) : user?.role === 'staf_ttb' ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
              <span className="size-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span className="truncate">Staf Dokumen TTB</span>
            </div>
          ) : user?.role === 'staf_lapangan' ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-medium">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="truncate">Staf Lapangan &amp; Serah Terima</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {onOpenNewRecord && (
                <button
                  onClick={handleQuickCreate}
                  className="flex-1 h-9 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs active:scale-95 touch-manipulation cursor-pointer"
                >
                  <CirclePlus className="size-4" />
                  <span>Catat Baru</span>
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
            Menu Utama
          </div>
          <nav className="space-y-0.5">
            {dashboards.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  title={(item as any).title || item.label}
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

        {/* Modul Tambahan - Disaring Berdasarkan RBAC canAccessTab */}
        {(['inventory', 'stok-gudang', 'pos-kapal', 'crew-kapal', 'work-order', 'list-sm', 'sisa-layanan'] as TabType[]).some(
          (t) => canAccessTab(user?.role, t)
        ) && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Modul Tambahan</span>
              <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                Eksternal &amp; Live
              </span>
            </div>
            <nav className="space-y-0.5">
              {canAccessTab(user?.role, 'inventory') && (
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
              )}


              {/* Stok Gudang Pusat (Pak Budi - Somber) */}
              {canAccessTab(user?.role, 'stok-gudang') && (
                <button
                  onClick={() => handleSelectTab('stok-gudang')}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                    activeTab === 'stok-gudang'
                      ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Stok Gudang Pusat Somber: Penerimaan Masuk PO & Pengeluaran ke Armada (Pak Budi Agustiansyah)"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Boxes
                      className={`size-4 shrink-0 ${
                        activeTab === 'stok-gudang' ? 'text-teal-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">Stok Gudang Pusat</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                    Pak Budi
                  </span>
                </button>
              )}

              {/* Posisi Kapal FMS */}
              {canAccessTab(user?.role, 'pos-kapal') && (
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
              )}

              {/* Crew & Armada */}
              {canAccessTab(user?.role, 'crew-kapal') && (
                <button
                  onClick={() => handleSelectTab('crew-kapal')}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                    activeTab === 'crew-kapal'
                      ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Buka Modul Data Crew & Monitoring Awak Armada Kapal (60 Kapal, 633 Kru)"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Users
                      className={`size-4 shrink-0 ${
                        activeTab === 'crew-kapal' ? 'text-blue-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">Awak &amp; Armada</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    60 Kpl
                  </span>
                </button>
              )}

              {/* List WO */}
              {canAccessTab(user?.role, 'work-order') && (
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
                    <span className="truncate whitespace-nowrap">Daftar WO</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {workOrderCount !== undefined && workOrderCount > 0
                      ? `${workOrderCount}`
                      : 'Sync'}
                  </span>
                </button>
              )}

              {/* List SM */}
              {canAccessTab(user?.role, 'list-sm') && (
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
                    <span className="truncate whitespace-nowrap">Daftar SM</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {serviceMaintenanceCount !== undefined && serviceMaintenanceCount > 0
                      ? `${serviceMaintenanceCount}`
                      : 'Vendor'}
                  </span>
                </button>
              )}

              {/* Sisa Layanan */}
              {canAccessTab(user?.role, 'sisa-layanan') && (
                <button
                  onClick={() => handleSelectTab('sisa-layanan')}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                    activeTab === 'sisa-layanan'
                      ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Buka Modul Laporan Sisa Layanan Gabungan Semua Unit (FPB-PO-FSTB-TTB)"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Layers
                      className={`size-4 shrink-0 ${
                        activeTab === 'sisa-layanan' ? 'text-indigo-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">Sisa Layanan</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {sisaLayananCount !== undefined && sisaLayananCount > 0
                      ? sisaLayananCount >= 1000
                        ? `${(sisaLayananCount / 1000).toFixed(0)}k`
                        : `${sisaLayananCount}`
                      : '28k'}
                  </span>
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Modul Khusus (Analytics & Admin Settings) - Disaring Berdasarkan RBAC */}
        {(['analytics', 'admin-settings'] as TabType[]).some((t) => canAccessTab(user?.role, t)) && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Modul Khusus</span>
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                Sistem &amp; SLA
              </span>
            </div>
            <nav className="space-y-0.5">
              {/* Analytics */}
              {canAccessTab(user?.role, 'analytics') && (
                <button
                  onClick={() => handleSelectTab('analytics')}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Analisis Lead Time SLA, Bottleneck & Kinerja PIC Procurement"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BarChart3
                      className={`size-4 shrink-0 ${
                        activeTab === 'analytics' ? 'text-purple-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">Analisis SLA</span>
                  </div>
                  {criticalCount > 0 ? (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {criticalCount >= 1000 ? `${(criticalCount / 1000).toFixed(0)}k` : `${criticalCount}`}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium leading-none whitespace-nowrap bg-background text-muted-foreground border border-border">
                      SLA
                    </span>
                  )}
                </button>
              )}

              {/* Admin Settings (Khusus Admin) */}
              {canAccessTab(user?.role, 'admin-settings') && (
                <button
                  onClick={() => handleSelectTab('admin-settings')}
                  className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition touch-manipulation cursor-pointer ${
                    activeTab === 'admin-settings'
                      ? 'bg-muted text-foreground font-semibold shadow-xs ring-1 ring-border'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Pengaturan Administrator & Manajemen Pengguna"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck
                      className={`size-4 shrink-0 ${
                        activeTab === 'admin-settings' ? 'text-indigo-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">Pengaturan Admin</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold leading-none whitespace-nowrap bg-background text-muted-foreground border border-border">
                    Pengguna
                  </span>
                </button>
              )}
            </nav>
          </div>
        )}
      </div>


      {/* Footer User Info, Logout & Theme Toggle */}
      <div className="pt-3 border-t border-border flex items-center justify-between text-xs pb-safe gap-1.5 shrink-0 mt-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`size-7 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0 ${
              isAdmin
                ? 'bg-linear-to-tr from-purple-600 to-indigo-600'
                : isVisitor
                ? 'bg-linear-to-tr from-emerald-600 to-teal-600'
                : user?.role === 'staf_ttb'
                ? 'bg-linear-to-tr from-blue-600 to-cyan-600'
                : user?.role === 'staf_lapangan'
                ? 'bg-linear-to-tr from-amber-600 to-emerald-600'
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
              {getRoleDisplayName(user?.role)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              if (window.confirm('Apakah Anda yakin ingin keluar?')) {
                logout();
              }
            }}
            title="Keluar"
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
