'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Upload,
  Download,
  RotateCcw,
  PanelLeft,
  X,
  SlidersHorizontal,
  Github,
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

  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchQuery(searchKeyword);
    }
  }, [searchKeyword]);

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
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/85 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Left side: Sidebar Toggle, Separator, and Studio Admin Style Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition outline-none"
        >
          <PanelLeft className="size-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Global Search Bar with ⌘ J keyboard badge */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Search"
            className="w-full h-8 rounded-lg bg-muted/40 border border-transparent pl-8 pr-12 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border focus:bg-background transition"
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
            <div className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-0.5">
              <kbd className="inline-flex h-4.5 select-none items-center rounded border border-border bg-muted/80 px-1 font-mono text-[9px] text-muted-foreground">
                ⌘ J
              </kbd>
            </div>
          )}
        </form>
      </div>

      {/* Right side: Studio Admin Style Icon Actions */}
      <div className="flex items-center gap-1.5">
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
    </header>
  );
}
