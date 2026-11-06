'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Package,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  Ship,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  Info,
  DollarSign,
  ChevronDown,
  X,
  ShieldAlert,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';
import { TabType } from '@/types/procurement';
import { PurchasePlanningItem, PurchasePlanningResponse } from '@/app/api/purchase-planning/route';

interface PurchasePlanningTabProps {
  onNavigateTab?: (tab: TabType) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function PurchasePlanningTab({
  onNavigateTab,
  showToast,
}: PurchasePlanningTabProps) {
  const [data, setData] = useState<PurchasePlanningResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedVessel, setSelectedVessel] = useState<string>('ALL');

  // Selected item modal detail
  const [selectedItemDetail, setSelectedItemDetail] = useState<PurchasePlanningItem | null>(null);

  // 1. Fetch data dari API
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/purchase-planning?_t=${Date.now()}`);
      if (res.ok) {
        const json: PurchasePlanningResponse = await res.json();
        if (json.success) {
          setData(json);
          if (isManual) {
            showToast?.('Data perencanaan pengadaan berhasil diperbarui.', 'success');
          }
        }
      }
    } catch {
      if (isManual) {
        showToast?.('Gagal memuat data perencanaan pengadaan.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. Upload file Excel / CSV dari dialog file browser
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast?.(`Membaca dan memproses file ${file.name}...`, 'info');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/purchase-planning', {
        method: 'POST',
        body: formData,
      });

      const json: PurchasePlanningResponse = await res.json();
      if (res.ok && json.success) {
        setData(json);
        showToast?.(
          `✓ Berhasil mengimpor ${json.items.length.toLocaleString('id-ID')} item dari ${file.name}!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal memproses file Excel.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Terjadi kesalahan saat mengunggah file.', 'error');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // 3. Muat langsung dari file Desktop (PURCHASE_PLANNING_BATCH_001_CPG.xlsx)
  const handleLoadDesktop = async () => {
    setIsRefreshing(true);
    showToast?.('Membaca berkas PURCHASE_PLANNING_BATCH_001_CPG.xlsx dari Desktop...', 'info');

    try {
      const res = await fetch('/api/purchase-planning?action=load-desktop', {
        method: 'POST',
      });
      const json: PurchasePlanningResponse = await res.json();
      if (res.ok && json.success) {
        setData(json);
        showToast?.(
          `✓ Berhasil memuat ${json.items.length.toLocaleString('id-ID')} item rencana pembelian dari Desktop!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal memuat file dari Desktop.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Gagal membaca berkas di Desktop.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format IDR Currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Daftar armada unik
  const uniqueVessels = useMemo(() => {
    if (!data?.items) return [];
    const setV = new Set<string>();
    data.items.forEach((i) => i.requestingVessels.forEach((v) => setV.add(v)));
    return Array.from(setV).sort();
  }, [data]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      // Filter Category
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // Filter Urgency
      if (selectedUrgency !== 'ALL' && item.urgency !== selectedUrgency) return false;

      // Filter Vessel
      if (selectedVessel !== 'ALL' && !item.requestingVessels.includes(selectedVessel)) return false;

      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.itemName.toLowerCase().includes(q);
        const matchCode = item.itemCode.toLowerCase().includes(q);
        const matchVendor = item.suggestedVendor?.toLowerCase().includes(q) || false;
        const matchVessel = item.requestingVessels.some((v) => v.toLowerCase().includes(q));
        const matchFpb = item.fpbRefs.some((f) => f.toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchVendor && !matchVessel && !matchFpb) return false;
      }

      return true;
    });
  }, [data, selectedCategory, selectedUrgency, selectedVessel, searchQuery]);

  // Ekspor CSV
  const handleExportCsv = () => {
    if (!filteredItems || filteredItems.length === 0) {
      showToast?.('Tidak ada data yang dapat diekspor.', 'warning');
      return;
    }

    const headers = [
      'Kode Barang',
      'Nama Barang',
      'Kategori',
      'Satuan',
      'Stok Gudang Somber',
      'Kebutuhan Armada',
      'Rekomendasi Beli',
      'Estimasi Harga Satuan (Rp)',
      'Total Estimasi Biaya (Rp)',
      'Tingkat Urgensi',
      'Estimasi Lead Time (Hari)',
      'Potensi Hemat Bulk (%)',
      'Armada Peminta',
      'Referensi No. FPB',
      'Rekomendasi Vendor',
    ];

    const rows = filteredItems.map((i) => [
      `"${i.itemCode}"`,
      `"${i.itemName}"`,
      `"${i.category}"`,
      `"${i.unit}"`,
      i.currentStock,
      i.totalRequestedQty,
      i.recommendedOrderQty,
      i.avgUnitPrice,
      i.totalEstimatedCost,
      `"${i.urgency}"`,
      i.leadTimeDays,
      `${i.potentialBulkDiscount}%`,
      `"${i.requestingVessels.join(', ')}"`,
      `"${i.fpbRefs.join(', ')}"`,
      `"${i.suggestedVendor || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Plan_CPG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Rencana pengadaan berhasil diekspor ke CSV.', 'success');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ── HEADER MODUL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-5 rounded-3xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="size-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Perencanaan Pengadaan &amp; Peramalan Kebutuhan</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Forecast &bull; Net Demand
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Kalkulasi otomatis kebutuhan armada lintas kapal, evaluasi stok gudang, dan optimasi diskon volume tender.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Input File Tersembunyi untuk Upload Excel */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Tombol Muat dari Desktop */}
          <button
            type="button"
            onClick={handleLoadDesktop}
            disabled={isRefreshing || isUploading}
            className="h-9 px-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Muat langsung dari berkas PURCHASE_PLANNING_BATCH_001_CPG.xlsx di Desktop"
          >
            <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span>Muat dari Desktop</span>
          </button>

          {/* Tombol Import Excel Accurate / Batch */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRefreshing}
            className="h-9 px-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Import berkas Excel dari Accurate atau Purchase Planning Batch"
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin text-blue-500" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-blue-500" />
            )}
            <span>Import Excel Accurate</span>
          </button>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || isUploading}
            className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Segarkan data analisis pengadaan"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Unduh format tabel Excel / CSV"
          >
            <Download className="size-3.5 text-emerald-500" />
            <span>Ekspor CSV</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('pratender')}
              className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98"
              title="Buka modul Pratender Material untuk membuat paket tender bersama"
            >
              <Layers className="size-3.5" />
              <span>Paket Pratender</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BANNER SUMBER DATA AKTIF ── */}
      {data?.sourceFile && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-card to-card border border-blue-500/30 text-xs text-muted-foreground flex-wrap shadow-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <span>Sumber Data:</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold border border-blue-500/30">
                {data.sourceFile}
              </span>
            </span>
            <span>&bull;</span>
            <span>
              <strong className="text-foreground">{data.summary.totalItems.toLocaleString('id-ID')}</strong> Item Terkonsolidasi
            </span>
            <span>&bull;</span>
            <span>
              <strong className="text-foreground">{data.summary.activeVesselsCount}</strong> Armada / Unit Peminta
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground font-mono">
              Terakhir Dimuat: {new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* ── 4 KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Item Kritis */}
        <div className="p-4 rounded-2xl bg-card border border-rose-500/30 bg-rose-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">🚨 Item Kritis (Stok Habis)</span>
            <div className="size-7 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {data?.summary.criticalCount || 0} <span className="text-xs font-medium text-muted-foreground">Item</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stok gudang 0 &amp; mendesak dibutuhkan armada
            </p>
          </div>
        </div>

        {/* Card 2: Item Reorder */}
        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 bg-amber-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⚠️ Mendekati Batas Aman</span>
            <div className="size-7 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data?.summary.reorderCount || 0} <span className="text-xs font-medium text-muted-foreground">Item</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stok di bawah Reorder Point (ROP)
            </p>
          </div>
        </div>

        {/* Card 3: Estimasi Total Anggaran */}
        <div className="p-4 rounded-2xl bg-card border border-indigo-500/30 bg-indigo-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">💰 Est. Anggaran Pengadaan</span>
            <div className="size-7 rounded-xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {formatRupiah(data?.summary.totalEstimatedBudget || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Estimasi total belanja {data?.summary.totalItems || 0} item pengadaan
            </p>
          </div>
        </div>

        {/* Card 4: Potensi Penghematan Bulk */}
        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 bg-emerald-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🎯 Potensi Hemat Bulk Tender</span>
            <div className="size-7 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatRupiah(data?.summary.totalPotentialSavings || 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Efisiensi konsolidasi lintas {data?.summary.activeVesselsCount || 0} armada
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama barang, kode part, armada peminta, atau no. FPB..."
              className="w-full text-xs pl-8.5 pr-8 py-2 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Select Filter Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Kategori Material */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Semua Kategori ({data?.categories.length || 0})</option>
              {data?.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Filter Tingkat Urgensi */}
            <div className="inline-flex rounded-xl p-0.5 bg-muted border border-border text-xs">
              <button
                type="button"
                onClick={() => setSelectedUrgency('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedUrgency === 'ALL'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'CRITICAL'
                    ? 'bg-rose-500 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>🚨 Kritis</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('REORDER')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'REORDER'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>⚠️ Reorder</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('PLANNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'PLANNED'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>📅 Terencana</span>
              </button>
            </div>

            {/* Filter Armada */}
            {uniqueVessels.length > 0 && (
              <select
                value={selectedVessel}
                onChange={(e) => setSelectedVessel(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Armada ({uniqueVessels.length} Kapal)</option>
                {uniqueVessels.map((v) => (
                  <option key={v} value={v}>
                    🚢 {v}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── SMART REORDER MATRIX TABLE ── */}
      <div className="bg-card border border-border rounded-3xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-muted/40 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Tabel Matriks Rekomendasi Pengadaan ({filteredItems.length} Item)
            </span>
            <span className="text-[10px] text-muted-foreground">
              &bull; Perhitungan Net Demand Terintegrasi
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground font-mono">
            {filteredItems.length} dari {data?.items.length || 0} item ditampilkan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground text-[11px] border-b border-border">
              <tr>
                <th className="py-3 px-4 font-semibold min-w-[200px]">Item &amp; Kode Barang</th>
                <th className="py-3 px-3 font-semibold min-w-[130px]">Kategori</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[140px]">Stok vs Kebutuhan</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[110px]">Rekomendasi Beli</th>
                <th className="py-3 px-3 font-semibold min-w-[160px]">Armada yang Meminta</th>
                <th className="py-3 px-3 font-semibold text-right min-w-[130px]">Estimasi Biaya</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[100px]">Urgensi</th>
                <th className="py-3 px-4 font-semibold text-center min-w-[80px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                    <Loader2 className="size-6 animate-spin text-primary mx-auto" />
                    <p className="text-xs font-medium">Menganalisis data kebutuhan pengadaan...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                    <Package className="size-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">Tidak ada item pengadaan yang sesuai</p>
                    <p className="text-[11px] text-muted-foreground">Coba ubah kriteria filter atau pencarian Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isCritical = item.urgency === 'CRITICAL';
                  const isReorder = item.urgency === 'REORDER';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition cursor-pointer"
                      onClick={() => setSelectedItemDetail(item)}
                    >
                      {/* 1. Item Name & Code */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground text-xs leading-snug">
                          {item.itemName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {item.itemCode}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Lead Time: ~{item.leadTimeDays} Hari
                          </span>
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td className="py-3 px-3 text-[11px] text-muted-foreground">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground">
                          {item.category}
                        </span>
                      </td>

                      {/* 3. Stock vs Demand */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <span
                            className={`font-bold ${
                              item.currentStock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                            }`}
                          >
                            Stok: {item.currentStock}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Butuh: {item.totalRequestedQty}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ROP: {item.reorderPoint} {item.unit}
                        </div>
                      </td>

                      {/* 4. Recommended Qty */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-black text-xs font-mono">
                          +{item.recommendedOrderQty} {item.unit}
                        </span>
                      </td>

                      {/* 5. Requesting Vessels */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {item.requestingVessels.slice(0, 2).map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"
                            >
                              <Ship className="size-2.5" />
                              <span>{v}</span>
                            </span>
                          ))}
                          {item.requestingVessels.length > 2 && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              +{item.requestingVessels.length - 2} Kapal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Estimated Cost */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-xs text-foreground">
                          {formatRupiah(item.totalEstimatedCost)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          @{formatRupiah(item.avgUnitPrice)}
                        </div>
                      </td>

                      {/* 7. Urgency Badge */}
                      <td className="py-3 px-3 text-center">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                            KRITIS
                          </span>
                        ) : isReorder ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            REORDER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                            TERENCANA
                          </span>
                        )}
                      </td>

                      {/* 8. Action Button */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedItemDetail(item)}
                          className="size-7 rounded-lg bg-muted hover:bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer mx-auto"
                          title="Lihat Detail Analisis Pengadaan"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL RINCIAN DETAIL ANALISIS PENGADAAN ── */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-muted/60 border-b border-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">
                    Detail Perencanaan: {selectedItemDetail.itemName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Part Code: {selectedItemDetail.itemCode} &bull; {selectedItemDetail.category}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto min-h-0 text-xs">
              {/* Alasan Urgensi Callout */}
              <div
                className={`p-3.5 rounded-2xl border ${
                  selectedItemDetail.urgency === 'CRITICAL'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                    : selectedItemDetail.urgency === 'REORDER'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Analisis Urgensi: </span>
                    <span>{selectedItemDetail.urgencyReason}</span>
                  </div>
                </div>
              </div>

              {/* Grid Metrik Angka */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground">Stok Somber</span>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {selectedItemDetail.currentStock} {selectedItemDetail.unit}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground">Total Butuh</span>
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {selectedItemDetail.totalRequestedQty} {selectedItemDetail.unit}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground">Rekomendasi Beli</span>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{selectedItemDetail.recommendedOrderQty} {selectedItemDetail.unit}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/50 border border-border">
                  <span className="text-[10px] text-muted-foreground">Estimasi Lead Time</span>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    ~{selectedItemDetail.leadTimeDays} Hari
                  </div>
                </div>
              </div>

              {/* Biaya & Potensi Hemat */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground">Estimasi Total Biaya</span>
                  <div className="text-base font-black text-foreground">
                    {formatRupiah(selectedItemDetail.totalEstimatedCost)}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    @{formatRupiah(selectedItemDetail.avgUnitPrice)} per {selectedItemDetail.unit}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Potensi Hemat Skala Bulk ({selectedItemDetail.potentialBulkDiscount}%)
                  </span>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(selectedItemDetail.potentialSavingsAmount)}
                  </div>
                </div>
              </div>

              {/* Daftar Armada yang Membutuhkan */}
              <div className="space-y-1.5">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Ship className="size-3.5 text-blue-500" />
                  <span>Armada Kapal yang Mengajukan ({selectedItemDetail.requestingVessels.length} Kapal):</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedItemDetail.requestingVessels.map((v) => (
                    <span
                      key={v}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold"
                    >
                      🚢 {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Referensi FPB */}
              <div className="space-y-1.5">
                <span className="font-bold text-foreground">Nomor FPB Pemohon:</span>
                <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                  {selectedItemDetail.fpbRefs.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rekomendasi Vendor */}
              {selectedItemDetail.suggestedVendor && (
                <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground">Rekomendasi Rekanan / Vendor Terdaftar:</span>
                    <p className="font-bold text-foreground text-xs">{selectedItemDetail.suggestedVendor}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold cursor-pointer transition"
              >
                Tutup
              </button>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemDetail(null);
                    onNavigateTab('pratender');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  <span>Proses ke Pratender</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
