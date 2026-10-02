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
  RefreshCw,
  Settings2,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem, InventoryItem, InventorySummary, KapalPosisiItem } from '@/types/procurement';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import { parseInventoryWorkbook } from '@/utils/inventoryParser';
import { determineCategory } from '@/utils/categoryClassifier';
import ThemeToggle from './ThemeToggle';
import SyncEfpbModal from './SyncEfpbModal';
import ResetConfirmModal, { ResetScope } from './ResetConfirmModal';
import { mergeProcurementDatasets, mergeArmadaDatasets } from '@/utils/dataMerger';
interface HeaderProps {
  searchKeyword?: string;
  onSearch: (keyword: string) => void;
  onExcelUpload: (payload: { procurement: ProcurementItem[]; armada: ArmadaItem[] }) => void;
  onExportCsv: () => void;
  onResetData: () => void;
  onScopedReset?: (scope: ResetScope) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  procurementData?: ProcurementItem[];
  armadaData?: ArmadaItem[];
  inventoryItems?: InventoryItem[];
  onInventoryUpload?: (items: InventoryItem[], summary?: InventorySummary) => void;
  onInventoryExport?: () => void;
  onRefreshPosisiKapal?: () => void;
  isSyncingPosisiKapal?: boolean;
  kapalPosisiCount?: number;
}


const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit?gid=0#gid=0';
const DEFAULT_EFPB_FILES_URL = 'https://e-fpb.cindaragroup.com/FilesList';

export default function Header({
  searchKeyword,
  onSearch,
  onExcelUpload,
  onExportCsv,
  onResetData,
  onScopedReset,
  showToast,
  isSidebarCollapsed,
  onToggleSidebar,
  procurementData,
  armadaData,
  inventoryItems,
  onInventoryUpload,
  onInventoryExport,
  onRefreshPosisiKapal,
  isSyncingPosisiKapal,
  kapalPosisiCount,
}: HeaderProps) {

  const [searchQuery, setSearchQuery] = useState<string>(searchKeyword || '');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // State untuk sinkronisasi Google Sheets
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [sheetUrl, setSheetUrl] = useState<string>(DEFAULT_SHEET_URL);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // State untuk sinkronisasi e-FPB Accurate
  const [isEfpbModalOpen, setIsEfpbModalOpen] = useState<boolean>(false);
  const [isSyncingStock, setIsSyncingStock] = useState<boolean>(false);

  // State untuk sinkronisasi e-FPB FilesList (No. FPB Terbaru)
  const [isSyncingEfpbFiles, setIsSyncingEfpbFiles] = useState<boolean>(false);
  const [isSyncingEfpbFull, setIsSyncingEfpbFull] = useState<boolean>(false);
  const [isEfpbFilesConfigOpen, setIsEfpbFilesConfigOpen] = useState<boolean>(false);
  const [efpbFilesUrl, setEfpbFilesUrl] = useState<string>(DEFAULT_EFPB_FILES_URL);
  const [lastEfpbFilesSyncedTime, setLastEfpbFilesSyncedTime] = useState<string>('');
  const [lastEfpbFullSyncCount, setLastEfpbFullSyncCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('CPG_GOOGLE_SHEET_URL');
      if (savedUrl) setSheetUrl(savedUrl);
      const savedTime = localStorage.getItem('CPG_LAST_SYNC_TIME');
      if (savedTime) setLastSyncedTime(savedTime);
      const savedFilesUrl = localStorage.getItem('CPG_EFPB_FILES_URL');
      if (savedFilesUrl) setEfpbFilesUrl(savedFilesUrl);
      const savedFilesTime = localStorage.getItem('CPG_LAST_EFPB_FILES_SYNC_TIME');
      if (savedFilesTime) setLastEfpbFilesSyncedTime(savedFilesTime);
      const savedFullCount = localStorage.getItem('CPG_EFPB_FULL_SYNC_COUNT');
      if (savedFullCount) setLastEfpbFullSyncCount(parseInt(savedFullCount, 10) || 0);
    }
  }, []);

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

  // Handle Refresh Layanan Langsung dari Link Google Sheets
  const handleRefreshFromGoogleSheets = async () => {
    setIsSyncing(true);
    showToast('Menghubungkan ke Google Sheets & mengunduh data layanan terbaru...', 'info');

    try {
      const res = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error(
          `Server tidak mengembalikan format JSON yang valid (${res.status}: ${res.statusText}).`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyinkronkan data Google Sheets.');
      }

      if (data.procurement?.length > 0 || data.armada?.length > 0) {
        onExcelUpload({
          procurement: data.procurement || [],
          armada: data.armada || [],
        });

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        setLastSyncedTime(timeStr);
        if (typeof window !== 'undefined') {
          localStorage.setItem('CPG_LAST_SYNC_TIME', timeStr);
        }

        showToast(
          data.message ||
            `Berhasil memperbarui ${data.procurement.length.toLocaleString('id-ID')} data procurement terbaru dari Google Sheets!`,
          'success'
        );
        setIsMenuOpen(false);
      } else {
        showToast('Tidak ada data procurement yang dapat dibaca dari tautan Google Sheets.', 'warning');
      }
    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      showToast(
        err.message || 'Gagal memperbarui data dari Google Sheets. Pastikan link dapat diakses publik.',
        'error'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Refresh No. FPB from e-FPB FilesList (shared logic for quick & full modes)
  const handleRefreshFromEfpbFiles = async (mode: 'quick' | 'full' = 'quick') => {
    const isFullMode = mode === 'full';
    if (isFullMode) {
      setIsSyncingEfpbFull(true);
    } else {
      setIsSyncingEfpbFiles(true);
    }

    const toastMsg = isFullMode
      ? '🔄 Full Sync: Mengunduh seluruh data FPB dari e-FPB (~25.000 record, estimasi ~90 detik)...'
      : 'Menghubungkan ke e-FPB FilesList & memindai nomor FPB terbaru...';
    showToast(toastMsg, 'info');

    try {
      const savedUser =
        (typeof window !== 'undefined' && localStorage.getItem('EFPB_USERNAME')) || 'Hermansyah';
      const savedPass =
        (typeof window !== 'undefined' && localStorage.getItem('EFPB_PASSWORD')) || 'Biocpl24!@#';

      const res = await fetch('/api/sync-efpb-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: efpbFilesUrl,
          username: savedUser,
          password: savedPass,
          mode,
        }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error(
          `Server tidak mengembalikan respons yang valid (${res.status}: ${res.statusText}).`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyinkronkan data dari e-FPB FilesList.');
      }

      const incomingProc: ProcurementItem[] = data.newItems || data.procurement || [];
      const incomingArm: ArmadaItem[] = data.newArmada || data.armada || [];

      if (incomingProc.length > 0) {
        onExcelUpload({
          procurement: incomingProc,
          armada: incomingArm,
        });

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        setLastEfpbFilesSyncedTime(timeStr);
        if (typeof window !== 'undefined') {
          localStorage.setItem('CPG_LAST_EFPB_FILES_SYNC_TIME', timeStr);
          if (isFullMode) {
            localStorage.setItem('CPG_EFPB_FULL_SYNC_COUNT', String(data.totalEfpb || incomingProc.length));
            setLastEfpbFullSyncCount(data.totalEfpb || incomingProc.length);
          }
        }

        const companyBreakdown = data.byCompany
          ? Object.entries(data.byCompany as Record<string, number>)
              .map(([co, count]) => `${co}: ${count}`)
              .join(', ')
          : '';

        const msg = isFullMode
          ? `✅ Full Sync selesai! ${data.totalEfpb || incomingProc.length} FPB unik dimuat.${companyBreakdown ? ` [${companyBreakdown}]` : ''}`
          : `Berhasil menyinkronkan e-FPB! ${incomingProc.length} berkas FPB ditambahkan/diperbarui.`;

        showToast(msg, 'success');
        setIsMenuOpen(false);
      } else {
        showToast('Tidak ada data FPB yang ditemukan dari e-FPB FilesList.', 'warning');
      }
    } catch (err: any) {
      console.error('e-FPB FilesList sync error:', err);
      showToast(
        err.message || 'Gagal menyinkronkan data dari e-FPB FilesList. Periksa koneksi ke server e-FPB.',
        'error'
      );
    } finally {
      setIsSyncingEfpbFiles(false);
      setIsSyncingEfpbFull(false);
    }
  };

  // Handle Refresh Persediaan Stok dari link e-FPB
  const handleRefreshStockFromEfpb = async () => {
    if (typeof window === 'undefined') return;
    const savedUser = localStorage.getItem('EFPB_USERNAME') || 'Hermansyah';
    const savedPass = localStorage.getItem('EFPB_PASSWORD') || 'Biocpl24!@#';
    const savedSess = localStorage.getItem('EFPB_SESSION_ID') || '';
    const savedUrl =
      localStorage.getItem('EFPB_URL') ||
      'https://e-fpb.cindaragroup.com/KodeItemForAccurateList';

    setIsSyncingStock(true);
    showToast('Menghubungkan ke e-FPB & mengunduh stok Accurate...', 'info');

    try {
      const payload: Record<string, any> = { url: savedUrl };
      if (savedUser && savedPass) {
        payload.username = savedUser;
        payload.password = savedPass;
      } else if (savedSess) {
        payload.sessionId = savedSess;
      }

      const res = await fetch('/api/sync-efpb-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error(
          `Server tidak mengembalikan respons yang valid (${res.status}: ${res.statusText}).`
        );
      }

      if (data.requiresAuth || !res.ok) {
        setIsEfpbModalOpen(true);
        setIsMenuOpen(false);
        showToast(data.message || 'Sesi e-FPB memerlukan login ulang.', 'warning');
        return;
      }

      if (data.success && data.items) {
        if (onInventoryUpload) {
          onInventoryUpload(data.items, data.summary);
        }
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        localStorage.setItem('EFPB_LAST_SYNC_TIME', timeStr);
        showToast(
          data.message ||
            `Berhasil memperbarui ${data.items.length.toLocaleString('id-ID')} item persediaan dari e-FPB!`,
          'success'
        );
        setIsMenuOpen(false);
      }
    } catch (err: any) {
      console.error('Error syncing stock from e-FPB:', err);
      showToast('Gagal menyinkronkan e-FPB. Buka modal pengaturan.', 'error');
      setIsEfpbModalOpen(true);
      setIsMenuOpen(false);
    } finally {
      setIsSyncingStock(false);
    }
  };

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
          const { merged: finalProc, stats: procStats } = mergeProcurementDatasets(
            procurementData || [],
            result.procurement
          );
          const { merged: finalArm } = mergeArmadaDatasets(
            armadaData || [],
            result.armada || []
          );

          onExcelUpload({ procurement: finalProc, armada: finalArm });
          showToast(
            `Data berhasil di-merge! ${procStats.added} berkas baru ditambahkan, ${procStats.updated} diperkaya dari file Excel (${finalProc.length.toLocaleString('id-ID')} total item).`,
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
            {isSyncing ? (
              <RefreshCw className="size-3.5 text-sky-500 animate-spin" />
            ) : (
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            )}
            <span className="font-medium text-xs">{isSyncing ? 'Sinkron...' : 'Menu'}</span>
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${
                isMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Clean Action Dropdown Popover */}
          {isMenuOpen && (
            <div className="absolute left-0 top-10 w-80 rounded-xl border border-border bg-card p-1.5 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
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
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Layanan &amp; Pengadaan</span>
                  <span className="text-[9px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-1 py-0.2 rounded border border-sky-500/20">
                    Live Sync
                  </span>
                </div>

                {/* 1. Refresh Layanan Langsung dari Link Google Sheets */}
                <div className="rounded-lg hover:bg-muted/80 transition p-1 border border-transparent hover:border-border/60">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={handleRefreshFromGoogleSheets}
                      disabled={isSyncing}
                      className="flex-1 flex items-center gap-2.5 px-1.5 py-1.5 text-left text-foreground transition disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw
                        className={`size-4 text-sky-500 shrink-0 ${isSyncing ? 'animate-spin text-sky-600' : ''}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold block leading-tight text-xs text-foreground">
                            {isSyncing ? 'Menyinkronkan...' : 'Refresh Layanan'}
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
                            Google Sheets
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {lastSyncedTime
                            ? `Terakhir disinkron: ${lastSyncedTime}`
                            : 'Tarik data procurement terbaru dari link'}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsConfigOpen((prev) => !prev);
                      }}
                      title="Pengaturan URL Google Sheets"
                      className={`size-7 flex items-center justify-center rounded-md transition shrink-0 ${
                        isConfigOpen
                          ? 'bg-sky-500/15 text-sky-600'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Settings2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Expandable URL Config inside menu */}
                  {isConfigOpen && (
                    <div className="mt-1.5 p-2 rounded-lg bg-background border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-foreground">Link Spreadsheet:</span>
                        <a
                          href={sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5"
                        >
                          Buka Google Sheet <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                      <input
                        type="text"
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="w-full h-6 px-1.5 text-[10px] font-mono rounded bg-muted/50 border border-border focus:border-sky-500 focus:outline-none"
                      />
                      <div className="flex justify-between items-center pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSheetUrl(DEFAULT_SHEET_URL);
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('CPG_GOOGLE_SHEET_URL');
                            }
                            showToast('URL Google Sheets direset ke default', 'info');
                          }}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Reset Default
                        </button>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('CPG_GOOGLE_SHEET_URL', sheetUrl);
                              }
                              setIsConfigOpen(false);
                              showToast('Link Google Sheets berhasil disimpan!', 'success');
                            }}
                            className="text-[10px] bg-sky-500 hover:bg-sky-600 text-white font-medium px-2 py-0.5 rounded shadow-xs"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Refresh No. FPB Terbaru Langsung dari Link e-FPB FilesList */}
                <div className="rounded-lg hover:bg-muted/80 transition p-1 border border-transparent hover:border-border/60">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleRefreshFromEfpbFiles('quick')}
                      disabled={isSyncingEfpbFiles || isSyncingEfpbFull}
                      className="flex-1 flex items-center gap-2.5 px-1.5 py-1.5 text-left text-foreground transition disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw
                        className={`size-4 text-emerald-500 shrink-0 ${
                          isSyncingEfpbFiles ? 'animate-spin text-emerald-600' : ''
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold block leading-tight text-xs text-foreground">
                            {isSyncingEfpbFiles ? 'Menyinkronkan...' : 'Refresh FPB Terbaru'}
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            e-FPB Live
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {lastEfpbFilesSyncedTime
                            ? `Terakhir disinkron: ${lastEfpbFilesSyncedTime}`
                            : 'Tarik nomor FPB terbaru dari FilesList'}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEfpbFilesConfigOpen((prev) => !prev);
                      }}
                      title="Pengaturan URL e-FPB FilesList"
                      className={`size-7 flex items-center justify-center rounded-md transition shrink-0 ${
                        isEfpbFilesConfigOpen
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Settings2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Expandable URL Config inside menu */}
                  {isEfpbFilesConfigOpen && (
                    <div className="mt-1.5 p-2 rounded-lg bg-background border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-foreground">Link e-FPB FilesList:</span>
                        <a
                          href={efpbFilesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-500 hover:underline flex items-center gap-0.5"
                        >
                          Buka FilesList <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                      <input
                        type="text"
                        value={efpbFilesUrl}
                        onChange={(e) => setEfpbFilesUrl(e.target.value)}
                        placeholder="https://e-fpb.cindaragroup.com/FilesList"
                        className="w-full h-6 px-1.5 text-[10px] font-mono rounded bg-muted/50 border border-border focus:border-emerald-500 focus:outline-none"
                      />
                      <div className="flex justify-between items-center pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEfpbFilesUrl(DEFAULT_EFPB_FILES_URL);
                            if (typeof window !== 'undefined') {
                              localStorage.removeItem('CPG_EFPB_FILES_URL');
                            }
                            showToast('URL e-FPB FilesList direset ke default', 'info');
                          }}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Reset Default
                        </button>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('CPG_EFPB_FILES_URL', efpbFilesUrl);
                              }
                              setIsEfpbFilesConfigOpen(false);
                              showToast('Link e-FPB FilesList berhasil disimpan!', 'success');
                            }}
                            className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-2 py-0.5 rounded shadow-xs"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2b. Full Sync - Tarik SEMUA data FPB dari e-FPB */}
                <button
                  type="button"
                  onClick={() => handleRefreshFromEfpbFiles('full')}
                  disabled={isSyncingEfpbFull || isSyncingEfpbFiles}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted/80 text-left transition disabled:opacity-60 cursor-pointer border border-transparent hover:border-border/60"
                >
                  <Boxes
                    className={`size-4 text-purple-500 shrink-0 ${
                      isSyncingEfpbFull ? 'animate-pulse' : ''
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold block leading-tight text-xs text-foreground">
                        {isSyncingEfpbFull ? 'Full Sync Berjalan...' : 'Full Sync Seluruh FPB'}
                      </span>
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400">
                        ~25.000
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {isSyncingEfpbFull
                        ? 'Mengunduh seluruh halaman e-FPB (~90 detik)...'
                        : lastEfpbFullSyncCount > 0
                          ? `Terakhir dimuat: ${lastEfpbFullSyncCount.toLocaleString('id-ID')} FPB unik`
                          : 'Tarik semua nomor FPB dari seluruh halaman e-FPB'}
                    </span>
                  </div>
                </button>

                {/* 3. Unggah Layanan */}
                <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted cursor-pointer transition">
                  <Upload className="size-4 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block leading-tight">Unggah Layanan</span>
                    <span className="text-[10px] text-muted-foreground block">
                      Impor berkas pengadaan manual (.xlsx)
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

                {/* Section Header: Posisi Kapal (Daily Report FMS) */}
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Operasional Kapal</span>
                  <span className="text-[9px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-1 py-0.2 rounded border border-sky-500/20">
                    FMS
                  </span>
                </div>

                {/* Refresh Posisi Kapal Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onRefreshPosisiKapal) {
                      onRefreshPosisiKapal();
                    }
                    setIsMenuOpen(false);
                  }}
                  disabled={isSyncingPosisiKapal}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition disabled:opacity-60 cursor-pointer"
                >
                  <Navigation
                    className={`size-4 text-sky-500 shrink-0 ${
                      isSyncingPosisiKapal ? 'animate-spin text-sky-600' : ''
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold block leading-tight text-xs text-foreground">
                        {isSyncingPosisiKapal ? 'Menyinkronkan...' : 'Refresh Posisi Kapal'}
                      </span>
                      <span className="text-[9px] font-bold px-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        Daily Report
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {kapalPosisiCount && kapalPosisiCount > 0
                        ? `Terpantau ${kapalPosisiCount} unit kapal aktif`
                        : 'Tarik laporan posisi & aktivitas kapal'}
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


                {/* 3. Refresh Stok dari e-FPB Link */}
                <button
                  type="button"
                  onClick={handleRefreshStockFromEfpb}
                  disabled={isSyncingStock}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-foreground hover:bg-muted text-left transition disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw
                    className={`size-4 text-indigo-500 shrink-0 ${isSyncingStock ? 'animate-spin text-indigo-600' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold block leading-tight text-xs text-foreground">
                        {isSyncingStock ? 'Menyinkronkan...' : 'Refresh Stok (e-FPB)'}
                      </span>
                      <span className="text-[9px] font-bold px-1 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                        Live Link
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      Tarik langsung dari KodeItemForAccurateList
                    </span>
                  </div>
                </button>

                {/* 4. Unggah Stok */}
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

              {/* Reset Data (Mode Uji Coba) */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsResetModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-left transition cursor-pointer"
              >
                <RotateCcw className="size-4 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium block leading-tight">Reset Data (Mode Uji Coba)</span>
                  <span className="text-[10px] text-rose-500/70 block">
                    Pilihan kosongkan data untuk pengujian baru
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

      {/* Modal Sinkronisasi e-FPB */}
      <SyncEfpbModal
        isOpen={isEfpbModalOpen}
        onClose={() => setIsEfpbModalOpen(false)}
        onSuccess={(newItems, newSummary) => {
          if (onInventoryUpload) {
            onInventoryUpload(newItems, newSummary || undefined);
          }
        }}
        showToast={showToast}
      />

      {/* Modal Konfirmasi Reset Data (Mode Uji Coba) */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={(scope) => {
          if (onScopedReset) {
            onScopedReset(scope);
          } else {
            onResetData();
          }
        }}
        procurementCount={procurementData?.length || 0}
        inventoryCount={inventoryItems?.length || 0}
      />
    </header>
  );
}
