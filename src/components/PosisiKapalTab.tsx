'use client';

import React, { useState, useMemo } from 'react';
import {
  Navigation,
  RefreshCw,
  Search,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Anchor,
  Clock,
  Compass,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Ship,
  Wrench,
  Calendar,
  X,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';

interface PosisiKapalTabProps {
  items: KapalPosisiItem[];
  summary: KapalPosisiSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function PosisiKapalTab({
  items,
  summary,
  isLoading,
  onRefresh,
  showToast,
}: PosisiKapalTabProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, ON, SB, MT, BD, DK
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Advanced Search Specific Filters
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [searchKapal, setSearchKapal] = useState<string>('');
  const [searchPosisi, setSearchPosisi] = useState<string>('');
  const [searchActivity, setSearchActivity] = useState<string>('');
  const [searchKerusakan, setSearchKerusakan] = useState<string>('');

  const hasActiveAdvancedSearch = Boolean(
    searchKapal || searchPosisi || searchActivity || searchKerusakan
  );

  // Status Badge Styling Helper
  const getStatusBadge = (statusKode: string, detailStatus?: string) => {
    switch (statusKode) {
      case 'ON':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          label: 'ON - Operating / Beroperasi',
        };
      case 'SB':
        return {
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500',
          label: detailStatus ? `SB (${detailStatus}) - Standby` : 'SB - Standby',
        };
      case 'MT':
        return {
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          dot: 'bg-amber-500',
          label: 'MT - Maintenance',
        };
      case 'BD':
        return {
          bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500',
          label: 'BD - Breakdown',
        };
      case 'DK':
        return {
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
          label: 'DK - Docking',
        };
      default:
        return {
          bg: 'bg-muted text-muted-foreground border-border',
          dot: 'bg-muted-foreground',
          label: statusKode || 'Unknown',
        };
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && item.statusKode !== statusFilter) {
        return false;
      }

      // 2. Global Search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchNama = item.namaKapal.toLowerCase().includes(q);
        const matchCall = item.callsign?.toLowerCase().includes(q);
        const matchPos = item.posisi.toLowerCase().includes(q);
        const matchAct = item.activity.toLowerCase().includes(q);
        const matchKer = item.kerusakan?.toLowerCase().includes(q);
        const matchKet = item.keterangan?.toLowerCase().includes(q);
        const matchStat = item.statusKode.toLowerCase().includes(q);
        const matchDetail = item.detailStatus?.toLowerCase().includes(q);

        if (
          !matchNama &&
          !matchCall &&
          !matchPos &&
          !matchAct &&
          !matchKer &&
          !matchKet &&
          !matchStat &&
          !matchDetail
        ) {
          return false;
        }
      }

      // 3. Advanced Search: Spesifik Nama Kapal
      if (searchKapal.trim() !== '') {
        const qk = searchKapal.toLowerCase().trim();
        const matchNama = item.namaKapal.toLowerCase().includes(qk);
        const matchCall = item.callsign?.toLowerCase().includes(qk);
        if (!matchNama && !matchCall) return false;
      }

      // 4. Advanced Search: Spesifik Posisi Kapal
      if (searchPosisi.trim() !== '') {
        const qp = searchPosisi.toLowerCase().trim();
        if (!item.posisi.toLowerCase().includes(qp)) return false;
      }

      // 5. Advanced Search: Spesifik Aktivitas / Rute
      if (searchActivity.trim() !== '') {
        const qa = searchActivity.toLowerCase().trim();
        if (!item.activity.toLowerCase().includes(qa)) return false;
      }

      // 6. Advanced Search: Spesifik Kerusakan / Keterangan
      if (searchKerusakan.trim() !== '') {
        const qk = searchKerusakan.toLowerCase().trim();
        const matchKer = item.kerusakan?.toLowerCase().includes(qk);
        const matchKet = item.keterangan?.toLowerCase().includes(qk);
        if (!matchKer && !matchKet) return false;
      }

      return true;
    });
  }, [
    items,
    statusFilter,
    searchTerm,
    searchKapal,
    searchPosisi,
    searchActivity,
    searchKerusakan,
  ]);

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════
          HEADER & KPI METRICS
          ═══════════════════════════════════════════════════════════ */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-card via-card to-card/80 border border-border shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <Navigation className="size-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span>Daily Report Posisi Kapal</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold border border-sky-500/20">
                    FMS Live
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Data pemantauan posisi terkini, aktivitas harian, dan status armada kapal
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer ${
                isLoading
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 cursor-wait'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Menyinkronkan...' : 'Refresh Posisi Kapal'}</span>
            </button>

            <a
              href="https://cindara.beruangmadutech.web.id/voyage/daily_index"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition"
            >
              <span>FMS Portal</span>
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-border/60">
          {/* Total Kapal */}
          <div className="p-2.5 rounded-xl bg-background border border-border/80">
            <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Ship className="size-3 text-muted-foreground" />
              <span>Total Armada</span>
            </div>
            <div className="text-lg font-bold text-foreground mt-0.5 font-mono">
              {items.length} <span className="text-xs font-normal text-muted-foreground">Unit</span>
            </div>
          </div>

          {/* ON (Operating) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'ON' ? 'ALL' : 'ON')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'ON'
                ? 'bg-emerald-500/15 border-emerald-500/40'
                : 'bg-background hover:bg-emerald-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              <span>Operasi (ON)</span>
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
              {summary ? summary.totalON : items.filter((i) => i.statusKode === 'ON').length}
            </div>
          </div>

          {/* SB (Standby) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'SB' ? 'ALL' : 'SB')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'SB'
                ? 'bg-blue-500/15 border-blue-500/40'
                : 'bg-background hover:bg-blue-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-blue-500"></span>
              <span>Standby (SB)</span>
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
              {summary ? summary.totalSB : items.filter((i) => i.statusKode === 'SB').length}
            </div>
          </div>

          {/* MT (Maintenance) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'MT' ? 'ALL' : 'MT')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'MT'
                ? 'bg-amber-500/15 border-amber-500/40'
                : 'bg-background hover:bg-amber-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500"></span>
              <span>Maintenance (MT)</span>
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
              {summary ? summary.totalMT : items.filter((i) => i.statusKode === 'MT').length}
            </div>
          </div>

          {/* BD (Breakdown) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'BD' ? 'ALL' : 'BD')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'BD'
                ? 'bg-rose-500/15 border-rose-500/40'
                : 'bg-background hover:bg-rose-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-rose-500"></span>
              <span>Breakdown (BD)</span>
            </div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
              {summary ? summary.totalBD : items.filter((i) => i.statusKode === 'BD').length}
            </div>
          </div>

          {/* DK (Docking) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'DK' ? 'ALL' : 'DK')}
            className={`p-2.5 rounded-xl border cursor-pointer transition ${
              statusFilter === 'DK'
                ? 'bg-purple-500/15 border-purple-500/40'
                : 'bg-background hover:bg-purple-500/5 border-border/80'
            }`}
          >
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              <span className="size-2 rounded-full bg-purple-500"></span>
              <span>Docking (DK)</span>
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
              {summary ? summary.totalDK : items.filter((i) => i.statusKode === 'DK').length}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FILTER & ADVANCED SEARCH CONTROLS
          ═══════════════════════════════════════════════════════════ */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        {/* Row 1: Search Bar & Toggle Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama kapal, call sign, posisi, atau aktivitas..."
                className="w-full h-8 pl-8 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Advanced Search Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedSearch((prev) => !prev)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
                hasActiveAdvancedSearch
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                  : showAdvancedSearch
                  ? 'bg-muted text-foreground border-border'
                  : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Advanced Search</span>
              <span className="sm:hidden">Adv</span>
              {hasActiveAdvancedSearch && <span className="size-1.5 rounded-full bg-amber-500"></span>}
              <ChevronDown
                className={`size-3 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="size-3" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`h-7 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                  viewMode === 'card'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="size-3" />
                <span>Kartu</span>
              </button>
            </div>

            {(statusFilter !== 'ALL' || searchTerm || hasActiveAdvancedSearch) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchTerm('');
                  setSearchKapal('');
                  setSearchPosisi('');
                  setSearchActivity('');
                  setSearchKerusakan('');
                }}
                className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Search Collapsible Panel */}
        {showAdvancedSearch && (
          <div className="p-3 rounded-xl bg-muted/30 border border-border/80 space-y-2.5 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3 text-amber-500" />
                <span>Pencarian Spesifik Kolom Posisi Kapal</span>
              </span>
              {hasActiveAdvancedSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKapal('');
                    setSearchPosisi('');
                    setSearchActivity('');
                    setSearchKerusakan('');
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-400 flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="size-3" />
                  <span>Bersihkan Filter Kolom</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Nama Kapal / Call Sign:
                </label>
                <input
                  type="text"
                  value={searchKapal}
                  onChange={(e) => setSearchKapal(e.target.value)}
                  placeholder="Cth: Cindara, Amber, PNUA..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Posisi / Lokasi / Jetty:
                </label>
                <input
                  type="text"
                  value={searchPosisi}
                  onChange={(e) => setSearchPosisi(e.target.value)}
                  placeholder="Cth: Balikpapan, GAJ, Jetty UKM..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Aktivitas / Kegiatan:
                </label>
                <input
                  type="text"
                  value={searchActivity}
                  onChange={(e) => setSearchActivity(e.target.value)}
                  placeholder="Cth: Bunker, Loading, Perawatan..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Status Terakhir / Keterangan:
                </label>
                <input
                  type="text"
                  value={searchKerusakan}
                  onChange={(e) => setSearchKerusakan(e.target.value)}
                  placeholder="Cth: Pompa, Main Engine, Ovrh..."
                  className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Filter Status Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1 shrink-0">
            Status Kapal:
          </span>
          {[
            { id: 'ALL', label: `Semua (${items.length})` },
            { id: 'ON', label: 'Operasi (ON)' },
            { id: 'SB', label: 'Standby (SB)' },
            { id: 'MT', label: 'Maintenance (MT)' },
            { id: 'BD', label: 'Breakdown (BD)' },
            { id: 'DK', label: 'Docking (DK)' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border shrink-0 ${
                statusFilter === st.id
                  ? 'bg-foreground text-background border-foreground font-semibold'
                  : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DATA VIEW (TABLE OR CARDS)
          ═══════════════════════════════════════════════════════════ */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
          <Ship className="size-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">Tidak Ada Data Posisi Kapal</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {items.length === 0
              ? 'Data belum ditarik dari server Fleet Management System. Silakan klik tombol "Refresh Posisi Kapal" di atas.'
              : 'Tidak ditemukan data kapal yang cocok dengan filter atau kata kunci pencarian Anda.'}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="mt-2 h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tarik Data Sekarang</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Nama Kapal</th>
                  <th className="p-3.5">Posisi / Lokasi</th>
                  <th className="p-3.5">Activity Terkini</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Status Terakhir</th>
                  <th className="p-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const badge = getStatusBadge(item.statusKode, item.detailStatus);
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition">
                      {/* Nama Kapal & Call Sign */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Ship className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{item.namaKapal}</span>
                        </div>
                        {item.callsign && (
                          <div className="mt-0.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium">
                              {item.callsign}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Posisi */}
                      <td className="p-3.5">
                        <div className="font-medium text-foreground flex items-center gap-1">
                          <Compass className="size-3 text-muted-foreground shrink-0" />
                          <span>{item.posisi}</span>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="p-3.5 max-w-[260px]">
                        <div className="text-foreground leading-snug">{item.activity}</div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                        >
                          <span className={`size-1.5 rounded-full ${badge.dot}`}></span>
                          <span>{item.statusKode}</span>
                          {item.detailStatus && (
                            <span className="text-[9px] opacity-80">({item.detailStatus})</span>
                          )}
                        </span>
                      </td>

                      {/* Kerusakan */}
                      <td className="p-3.5 max-w-[240px]">
                        {item.kerusakan && item.kerusakan !== '-' ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Wrench className="size-3 shrink-0" />
                            <span>{item.kerusakan}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>

                      {/* Keterangan */}
                      <td className="p-3.5 max-w-[200px] text-muted-foreground">
                        {item.keterangan && item.keterangan !== '-' ? (
                          <span>{item.keterangan}</span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => {
            const badge = getStatusBadge(item.statusKode, item.detailStatus);
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-card border border-border shadow-xs hover:border-border/80 transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Ship className="size-4 text-sky-500 shrink-0" />
                      <span>{item.namaKapal}</span>
                    </h4>
                    {item.callsign && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {item.callsign}
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.bg}`}
                  >
                    <span className={`size-1.5 rounded-full ${badge.dot}`}></span>
                    <span>{item.statusKode}</span>
                    {item.detailStatus && <span>({item.detailStatus})</span>}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs pt-1 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Compass className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{item.posisi}</span>
                  </div>

                  <div className="text-muted-foreground text-[11px] leading-snug pl-5">
                    {item.activity}
                  </div>
                </div>

                {item.kerusakan && item.kerusakan !== '-' && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-amber-500 font-sans flex items-center gap-1">
                      <Wrench className="size-3" />
                      <span>{item.kerusakan}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
