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
  Globe,
  ExternalLink,
  MoreVertical,
  User,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
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
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState<string>(searchKeyword || '');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchQuery(searchKeyword);
    }
  }, [searchKeyword]);

  // Click outside listener for mobile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

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
        showToast('Gagal memproses file Excel. Pastikan format file tidak rusak.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
    setIsMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/90 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Left side: Sidebar Toggle & Search Input */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-md mr-2">
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Buka Menu' : 'Tutup Menu'}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition outline-none touch-manipulation"
        >
          <PanelLeft className="size-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

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
            placeholder="Cari FPB, PO, armada..."
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

      {/* Right side Desktop Actions (screens >= sm) */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {/* Quick Upload Excel */}
        <label
          className="cursor-pointer inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Unggah File Excel"
        >
          <Upload className="size-4" />
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {/* Export CSV */}
        <button
          onClick={onExportCsv}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Ekspor CSV"
        >
          <Download className="size-4" />
        </button>

        {/* Reset / Settings */}
        <button
          onClick={() => {
            if (confirm('Kosongkan seluruh data monitoring untuk pengujian upload baru?')) {
              onResetData();
            }
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Reset Data"
        >
          <RotateCcw className="size-4" />
        </button>

        {/* Customizer / Settings Icon */}
        <button
          onClick={() => showToast('Pengaturan preferensi dashboard', 'info')}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Settings"
        >
          <SlidersHorizontal className="size-4" />
        </button>

        {/* e-FPB Cindara Group Portal Link */}
        <a
          href="https://e-fpb.cindaragroup.com/Menu2#"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-medium transition"
          title="Buka Portal e-FPB Cindara Group (e-fpb.cindaragroup.com)"
        >
          <Globe className="size-3.5" />
          <span className="font-mono font-semibold">e-FPB</span>
          <ExternalLink className="size-3 opacity-70" />
        </a>

        {/* Theme Toggle Button (Light / Dark) */}
        <ThemeToggle />

        {/* GitHub Repository Link */}
        <a
          href="https://github.com/rizkyave/dashboard-cpg.git"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          title="Lihat Repository GitHub"
        >
          <Github className="size-4" />
        </a>

        {/* User Profile Avatar Circle */}
        <div
          className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs select-none shadow-xs ml-1"
          title="Hermansyah - Administrator"
        >
          H
        </div>
      </div>

      {/* Right side Mobile Actions (screens < sm) */}
      <div className="flex sm:hidden items-center gap-1 shrink-0 relative" ref={mobileMenuRef}>
        <ThemeToggle />

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className={`inline-flex size-8 items-center justify-center rounded-lg transition active:scale-95 touch-manipulation ${
            isMobileMenuOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title="Menu Aksi Lainnya"
          aria-expanded={isMobileMenuOpen}
        >
          <MoreVertical className="size-4" />
        </button>

        {/* Mobile Dropdown Popover */}
        {isMobileMenuOpen && (
          <div className="absolute right-0 top-10 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
            {/* User Profile Banner */}
            <div className="flex items-center gap-2 p-2 border-b border-border/80 mb-1">
              <div className="flex size-7 items-center justify-center rounded-full bg-linear-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs">
                H
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-foreground">Hermansyah</p>
                <p className="text-[10px] text-muted-foreground">CPG Administrator</p>
              </div>
            </div>

            {/* Upload Excel */}
            <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted cursor-pointer transition">
              <Upload className="size-4 text-sky-500" />
              <span>Unggah File Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {/* Export CSV */}
            <button
              type="button"
              onClick={() => {
                onExportCsv();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition"
            >
              <Download className="size-4 text-emerald-500" />
              <span>Ekspor Data CSV</span>
            </button>

            {/* Portal e-FPB */}
            <a
              href="https://e-fpb.cindaragroup.com/Menu2#"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-muted transition"
            >
              <div className="flex items-center gap-2.5">
                <Globe className="size-4" />
                <span>Portal e-FPB</span>
              </div>
              <ExternalLink className="size-3 opacity-60" />
            </a>

            {/* GitHub Repo */}
            <a
              href="https://github.com/rizkyave/dashboard-cpg.git"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-2.5 py-2 rounded-lg text-foreground hover:bg-muted transition"
            >
              <div className="flex items-center gap-2.5">
                <Github className="size-4" />
                <span>Repository GitHub</span>
              </div>
              <ExternalLink className="size-3 opacity-60" />
            </a>

            <div className="h-px bg-border my-1" />

            {/* Reset Data */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (confirm('Kosongkan seluruh data monitoring untuk pengujian upload baru?')) {
                  onResetData();
                }
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-left transition"
            >
              <RotateCcw className="size-4" />
              <span>Reset Seluruh Data</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
