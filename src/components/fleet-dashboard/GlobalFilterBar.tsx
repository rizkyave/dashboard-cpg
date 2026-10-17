'use client';

import React from 'react';
import { GlobalFilterState } from './types';
import {
  Calendar,
  Filter,
  Search,
  RotateCcw,
  Building2,
  Ship,
  Sparkles,
  Layers,
  X,
} from 'lucide-react';
import { MONTH_NAMES_ID } from './utils';

interface GlobalFilterBarProps {
  filterState: GlobalFilterState;
  onFilterChange: (updates: Partial<GlobalFilterState>) => void;
  availableYears?: string[];
  availableEntities?: string[];
  totalFpbCount: number;
  totalVesselCount: number;
}

export default function GlobalFilterBar({
  filterState,
  onFilterChange,
  availableYears = ['2026', '2025'],
  availableEntities = ['CPL', 'PPI', 'GAJ', 'HL', 'MIL'],
  totalFpbCount,
  totalVesselCount,
}: GlobalFilterBarProps) {
  const isPeriodFiltered = filterState.bulan !== 'ALL' || filterState.tahun !== 'ALL';
  const hasActiveFilters =
    isPeriodFiltered ||
    filterState.entitas !== 'ALL' ||
    filterState.statusFilter !== 'ALL' ||
    filterState.selectedArmadaId !== null ||
    filterState.searchTerm.trim() !== '';

  const activePeriodLabel =
    filterState.bulan !== 'ALL'
      ? `${MONTH_NAMES_ID[filterState.bulan] || filterState.bulan} ${filterState.tahun !== 'ALL' ? filterState.tahun : '2026'}`
      : filterState.tahun !== 'ALL'
      ? `Tahun ${filterState.tahun}`
      : 'Semua Periode (Jun – Okt 2026)';

  const handleResetFilters = () => {
    onFilterChange({
      tahun: '2026',
      bulan: '10', // Default Oktober 2026
      entitas: 'ALL',
      selectedArmadaId: null,
      statusFilter: 'ALL',
      searchTerm: '',
    });
  };

  return (
    <div className="bg-slate-900/95 dark:bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-4">
      {/* Baris 1: Header Judul & Status Filter Terpusat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <Filter className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
              <span>FILTER GLOBAL OPERASIONAL ARMADA</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Single Source of Truth
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sinkronisasi real-time metrik KPI, tren bulanan, Donut Chart, dan jadwal Gantt per tiket.
            </p>
          </div>
        </div>

        {/* Status Indikator Periode Aktif */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 flex items-center gap-2 font-mono">
            <Calendar className="size-3.5 text-sky-400 shrink-0" />
            <span className="text-[11px]">
              Aktif: <strong className="text-white">{activePeriodLabel}</strong>
            </span>
          </div>

          {filterState.selectedArmadaId && (
            <div className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center gap-1.5 font-mono text-[11px]">
              <Ship className="size-3 text-sky-400" />
              <span>Armada: <strong>{filterState.selectedArmadaId}</strong></span>
              <button
                type="button"
                onClick={() => onFilterChange({ selectedArmadaId: null })}
                className="hover:text-white p-0.5 rounded cursor-pointer transition"
                title="Hapus filter armada terpilih"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
              title="Reset ke pengaturan default (Oktober 2026)"
            >
              <RotateCcw className="size-3 text-slate-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Baris 2: Kontrol Filter Grid Interaktif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        {/* Dropdown 1: Tahun */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Calendar className="size-3 text-sky-400" />
            <span>Tahun:</span>
          </label>
          <select
            value={filterState.tahun}
            onChange={(e) => onFilterChange({ tahun: e.target.value })}
            className="w-full h-8.5 px-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Tahun</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                Tahun {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown 2: Bulan */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Calendar className="size-3 text-teal-400" />
            <span>Periode Bulan:</span>
          </label>
          <select
            value={filterState.bulan}
            onChange={(e) => onFilterChange({ bulan: e.target.value })}
            className="w-full h-8.5 px-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs font-semibold focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Bulan (Jun – Okt)</option>
            <option value="06">06 - Juni 2026</option>
            <option value="07">07 - Juli 2026</option>
            <option value="08">08 - Agustus 2026</option>
            <option value="09">09 - September 2026</option>
            <option value="10">10 - Oktober 2026</option>
          </select>
        </div>

        {/* Dropdown 3: Entitas CPG */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Building2 className="size-3 text-indigo-400" />
            <span>Entitas:</span>
          </label>
          <select
            value={filterState.entitas}
            onChange={(e) => onFilterChange({ entitas: e.target.value })}
            className="w-full h-8.5 px-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Entitas CPG</option>
            {availableEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown 4: Status Pemenuhan */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Layers className="size-3 text-amber-400" />
            <span>Status Tiket:</span>
          </label>
          <select
            value={filterState.statusFilter}
            onChange={(e) => onFilterChange({ statusFilter: e.target.value as any })}
            className="w-full h-8.5 px-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="LENGKAP">🟢 Lengkap / Selesai</option>
            <option value="PROSES">🔵 Proses PO / Gudang</option>
            <option value="PARSIAL">🟠 Parsial (Sebagian)</option>
            <option value="BACKLOG">🔴 Backlog / Kritis</option>
          </select>
        </div>

        {/* Input 5: Pencarian Cepat */}
        <div className="space-y-1 sm:col-span-2 md:col-span-1">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Search className="size-3 text-purple-400" />
            <span>Pencarian Cepat:</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={filterState.searchTerm}
              onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
              placeholder="Armada, barang, FPB..."
              className="w-full h-8.5 pl-7 pr-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-teal-400 focus:outline-hidden"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

