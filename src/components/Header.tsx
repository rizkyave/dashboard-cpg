'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';

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
  const [clock, setClock] = useState<string>('--:--:-- WITA');
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
        hour12: false,
      });
      setClock(`${timeStr} WITA`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // File Upload Handler (Client-Side Parsing & Merge)
  // Acuan Utama: Sheet "Monitoring Layanan Armada"
  // ─────────────────────────────────────────────────────────────
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



  return (
    <header className="sticky top-0 z-40 bg-[#090d19]/95 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all shadow-xl">
      <div className="max-w-[1850px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand, Sidebar Toggle & Entity Title */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Sidebar Hide/Show Toggle Button */}
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Tampilkan Sidebar Navigasi' : 'Sembunyikan Sidebar Navigasi'}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-cyan-950/80 text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 transition flex items-center justify-center shadow-sm group active:scale-95"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 group-hover:scale-110 transition-transform" />
            )}
          </button>

          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#090d19] rounded-[10px] flex items-center justify-center overflow-hidden">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-mono text-base tracking-wider">
                CPG
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                CPG PROCUREMENT COMMAND CENTER
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                v2.9 MLA-MASTER
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>PT Cindara Pratama Lines & Group (Somber - Balikpapan)</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-cyan-400 font-mono text-[11px]">{clock}</span>
            </p>
          </div>
        </div>

        {/* Actions: Refresh, Excel Upload, CSV Export & Search */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Quick Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(searchQuery);
              const input = e.currentTarget.querySelector('input');
              input?.blur();
              if (searchQuery.trim()) {
                showToast(`Mencari: "${searchQuery}"`, 'info');
              }
            }}
            className="flex items-center gap-1.5 relative flex-1 sm:w-72 md:w-80"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                placeholder="Cari FPB, PO, Item, Armada, PIC..."
                className="w-full bg-slate-900/90 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-7 py-2 rounded-lg border border-slate-700/80 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  onSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch('');
                  }}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow active:scale-95 whitespace-nowrap"
              title="Tekan Enter atau klik untuk mencari"
            >
              <span>Cari</span>
            </button>
          </form>


          {/* Manual File Upload Button */}
          <label className="cursor-pointer px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg border border-emerald-400/40 flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40 active:scale-95">
            <Upload className="w-4 h-4" />
            <span>Unggah Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {/* CSV Export */}
          <button
            onClick={onExportCsv}
            className="px-3 py-2 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-medium rounded-lg flex items-center gap-1.5 transition active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          {/* Reset Data Button */}
          <button
            onClick={onResetData}
            title="Kosongkan / Reset Data"
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
