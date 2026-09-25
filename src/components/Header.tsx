'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Upload,
  Download,
  RotateCcw,
  PanelLeft,
  Clock,
  X,
  Building2,
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
  const [clock, setClock] = useState<string>('--:-- WITA');
  const [searchQuery, setSearchQuery] = useState<string>(searchKeyword || '');

  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchQuery(searchKeyword);
    }
  }, [searchKeyword]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setClock(`${timeStr} WITA`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // File Upload Handler (Client-Side Parsing & Merge)
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
            `Data berhasil di-merge! Acuan Utama: "Monitoring Layanan Armada" (${result.procurement.length.toLocaleString()} total transaksi/item terintegrasi).`,
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
      {/* Left side: Sidebar Toggle, Separator, and Breadcrumbs / Quick Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition outline-none"
        >
          <PanelLeft className="size-4" />
          <span className="sr-only">Toggle Sidebar</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
            <Building2 className="size-3.5 text-primary" />
            CPG Group
          </span>
          <span className="text-border">/</span>
          <span>Command Center</span>
        </div>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* Global Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Search FPB, PO, kapal, barang, PIC..."
            className="w-full h-8 rounded-lg border border-border bg-muted/40 pl-8 pr-14 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:bg-background transition"
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
              <kbd className="inline-flex h-4.5 select-none items-center rounded border border-border bg-muted px-1 font-mono text-[9px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          )}
        </form>
      </div>

      {/* Right side: Action Buttons, Theme Toggle, Clock, and User Avatar */}
      <div className="flex items-center gap-2">
        {/* Quick Upload Excel Button */}
        <label className="cursor-pointer inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition shadow-xs active:scale-95">
          <Upload className="size-3.5" />
          <span className="hidden sm:inline">Unggah Excel</span>
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
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted transition active:scale-95"
          title="Ekspor Data ke CSV"
        >
          <Download className="size-3.5 text-muted-foreground" />
          <span className="hidden md:inline">Ekspor CSV</span>
        </button>

        {/* Reset Data Button */}
        <button
          onClick={() => {
            if (confirm('Kosongkan seluruh data monitoring untuk pengujian upload baru?')) {
              onResetData();
            }
          }}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
          title="Reset / Kosongkan Data"
        >
          <RotateCcw className="size-3.5" />
        </button>

        {/* Theme Toggle Button (Light / Dark) */}
        <ThemeToggle />

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* Clock WITA Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-[11px] font-mono text-muted-foreground">
          <Clock className="size-3 text-muted-foreground" />
          <span>{clock}</span>
        </div>

        {/* User Profile Avatar */}
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-bold text-xs text-foreground select-none"
          title="Hermansyah - Purchasing Admin"
        >
          HA
        </div>
      </div>
    </header>
  );
}
