'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Upload,
  Download,
  RotateCcw,
  PanelLeft,
  X,
  SlidersHorizontal,
  Github,
  ChevronDown,
  Boxes,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem, InventoryItem, InventorySummary } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import { parseInventoryWorkbook } from '@/utils/inventoryParser';
import { determineCategory } from '@/utils/categoryClassifier';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  searchKeyword?: string;
  onSearch: (keyword: string) => void;
  onExcelUpload: (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => void;
  onExportCsv: () => void;
  onResetData: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  inventoryItems?: InventoryItem[];
  onInventoryUpload?: (items: InventoryItem[], summary?: InventorySummary) => void;
  onInventoryExport?: () => void;
}

export default function Header({
  searchKeyword,
  onSearch,
  onExcelUpload,
  onExportCsv,
  onResetData,
  showToast,
  isSidebarCollapsed,
  onToggleSidebar,
  inventoryItems,
  onInventoryUpload,
  onInventoryExport,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState<string>(searchKeyword || '');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchQuery(searchKeyword);
    }
  }, [searchKeyword]);

  // Click outside listener for action dropdown menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle Unggah Layanan (Procurement & Monitoring Layanan Armada)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        const result = parseAndMergeWorkbook(workbook);

        if (result.procurement.length > 0 || result.armada.length > 0) {
          onExcelUpload({ procurement: result.procurement, armada: result.armada });
          showToast(
            `Data berhasil di-merge! Acuan Utama: "Monitoring Layanan Armada" (${result.procurement.length.toLocaleString()} total item).`,
            'success'
          );
        } else {
          showToast(
            `Tidak ditemukan data valid pada sheet "Monitoring Layanan Armada" atau "PROCUREMENT". Sheet terdeteksi: ${workbook.SheetNames.join(
              ', '
            )}`,
            'warning'
          );
        }
      } catch (err: any) {
        console.error('Excel parse error:', err);
        showToast('Gagal memproses file Excel layanan. Pastikan format file tidak rusak.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
    setIsMenuOpen(false);
  };

  // Handle Unggah Stok (Daftar Barang Accurate)
  const handleStockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const result = parseInventoryWorkbook(workbook);

        if (result.items.length === 0) {
          showToast(
            'Format file Excel tidak cocok atau tidak ada baris data persediaan yang terbaca.',
            'error'
          );
          return;
        }

        if (onInventoryUpload) {
          onInventoryUpload(result.items, result.summary);
        }
        showToast(
          `Berhasil memuat ${result.items.length.toLocaleString('id-ID')} item persediaan stok dari Excel!`,
          'success'
        );
      } catch (err: any) {
        showToast(`Gagal membaca file Excel stok: ${err.message || 'Format tidak valid'}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
    setIsMenuOpen(false);
  };

  // Handle Ekspor Stok (Persediaan Barang Accurate)
  const handleExportStock = () => {
    if (onInventoryExport) {
      onInventoryExport();
      setIsMenuOpen(false);
      return;
    }

    if (!inventoryItems || inventoryItems.length === 0) {
      showToast('Tidak ada data persediaan stok untuk diekspor.', 'warning');
      setIsMenuOpen(false);
      return;
    }

    try {
      const exportRows = inventoryItems.map((it, idx) => ({
        No: idx + 1,
        Perusahaan: it.perusahaan,
        'No. Barang': it.itemCode,
        'Deskripsi Barang': it.description,
        Kuantitas: it.quantity,
        'Harga Satuan': it.unitPrice,
        'Tipe Barang': it.itemType,
        'Tipe Persediaan': it.inventoryType,
        Kategori:
          it.category || determineCategory(it.itemCode, it.description, it.itemType),
        'Status Stok': it.quantity > 0 ? 'Tersedia' : it.quantity === 0 ? 'Kosong' : 'Minus',
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Persediaan');
      XLSX.writeFile(
        wb,
        `Persediaan_Stok_Accurate_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      showToast(
        `Berhasil mengekspor ${exportRows.length.toLocaleString('id-ID')} item stok ke Excel!`,
        'success'
      );
    } catch (err: any) {
      showToast(`Gagal mengekspor file stok: ${err.message}`, 'error');
    }
    setIsMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/90 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Left side: Sidebar Toggle, Dropdown Menu (Kiri Atas), & Search Input */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 max-w-lg mr-2" ref={menuRef}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Buka Menu Navigasi' : 'Tutup Menu Navigasi'}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition outline-none touch-manipulation"
        >
          <PanelLeft className="size-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        {/* Dropdown Menu Kiri Atas */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`h-8 px-2 sm:px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-xs touch-manipulation ${
              isMenuOpen
                ? 'bg-muted ring-1 ring-border text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Menu Aksi & Pengaturan"
            aria-expanded={isMenuOpen}
          >
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <span className="font-medium text-xs">Menu</span>
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${
                isMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Clean Action Dropdown Popover */}
          {isMenuOpen && (
            <div className="absolute left-0 top-10 w-72 rounded-xl border border-border bg-card p-1.5 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User Profile Banner */}
              <div className="flex items-center gap-2.5 p-2.5 border-b border-border/80 mb-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs shadow-xs">
                  H
                </div>
                <div className="leading-tight min-w-0">
                  <p className="font-semibold text-foreground truncate">Hermansyah</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    CPG Administrator &bull; Somber HQ
                  </p>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-0.5">
                {/* Section Header: Layanan & Pengadaan */}
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Layanan &amp; Pengadaan
                </div>

                {/* 1. Unggah Layanan */}
                <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted cursor-pointer transition">
                  <Upload className="size-4 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Unggah Layanan</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Impor berkas pengadaan / armada (.xlsx)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {/* 2. Ekspor Layanan */}
                <button
                  type="button"
                  onClick={() => {
                    onExportCsv();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition"
                >
                  <Download className="size-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Ekspor Layanan</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Unduh CSV monitoring berkas &amp; PO
                    </span>
                  </div>
                </button>

                <div className="h-px bg-border my-1" />

                {/* Section Header: Persediaan Gudang (Stok Accurate) */}
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Persediaan Gudang</span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                    Accurate
                  </span>
                </div>

                {/* 3. Unggah Stok */}
                <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted cursor-pointer transition">
                  <Boxes className="size-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Unggah Stok</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Impor data persediaan Accurate (.xlsx)
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleStockUpload}
                  />
                </label>

                {/* 4. Ekspor Stok */}
                <button
                  type="button"
                  onClick={handleExportStock}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition"
                >
                  <FileSpreadsheet className="size-4 text-teal-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Ekspor Stok</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Unduh data persediaan stok{' '}
                      {inventoryItems && inventoryItems.length > 0
                        ? `(${inventoryItems.length.toLocaleString('id-ID')} item)`
                        : ''}
                    </span>
                  </div>
                </button>

                <div className="h-px bg-border my-1" />

                {/* Settings / Preference */}
                <button
                  type="button"
                  onClick={() => {
                    showToast('Pengaturan preferensi dashboard', 'info');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition"
                >
                  <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Preferensi Tampilan</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Atur filter &amp; preferensi
                    </span>
                  </div>
                </button>

                {/* GitHub Repository */}
                <a
                  href="https://github.com/rizkyave/dashboard-cpg.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition"
                >
                  <Github className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Repository GitHub</span>
                    <span className="text-[10px] text-muted-foreground block">
                      dashboard-cpg.git
                    </span>
                  </div>
                </a>
              </div>

              <div className="h-px bg-border my-1.5" />

              {/* Reset Data */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (confirm('Kosongkan seluruh data monitoring untuk pengujian upload baru?')) {
                    onResetData();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-left transition"
              >
                <RotateCcw className="size-4 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium block leading-tight">Reset Seluruh Data</span>
                  <span className="text-[10px] text-rose-500/70 block">
                    Kosongkan tabel &amp; mulai pengujian baru
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Cari FPB, PO, armada, stok..."
            className="w-full h-8 rounded-lg bg-muted/40 border border-transparent pl-8 pr-8 sm:pr-12 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border focus:bg-background transition"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onSearch('');
              }}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <div className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
              <kbd className="inline-flex h-4.5 select-none items-center rounded border border-border bg-muted/80 px-1 font-mono text-[9px] text-muted-foreground">
                ⌘ J
              </kbd>
            </div>
          )}
        </form>
      </div>

      {/* Right side Clean Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Theme Toggle Button (Light / Dark) */}
        <ThemeToggle />

        {/* User Profile Avatar (Clickable to open menu as well) */}
        <div
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs select-none shadow-xs cursor-pointer hover:opacity-90 transition active:scale-95 ml-0.5"
          title="Hermansyah - Administrator (Klik untuk menu)"
        >
          H
        </div>
      </div>
    </header>
  );
}
