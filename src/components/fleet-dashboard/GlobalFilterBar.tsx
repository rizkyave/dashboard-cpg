'use client';

import React from 'react';
import { GlobalFilterState } from './types';
import {
  Filter,
  Search,
  RotateCcw,
  Ship,
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
      : 'Semua Periode';

  const handleResetFilters = () => {
    onFilterChange({
      tahun: '2026',
      bulan: '10',
      entitas: 'ALL',
      selectedArmadaId: null,
      statusFilter: 'ALL',
      searchTerm: '',
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3 py-2 shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between gap-2.5 flex-wrap xl:flex-nowrap">
        {/* Label Filter Compact */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="size-7 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <Filter className="size-3.5" />
          </div>
          <span className="text-xs font-bold text-white tracking-tight shrink-0 hidden sm:inline">
            FILTER GLOBAL
          </span>
        </div>

        {/* Kontrol Dropdown Sejajar 1 Baris */}
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap min-w-0">
          {/* Dropdown 1: Tahun */}
          <div className="relative shrink-0 w-24 sm:w-28">
            <select
              value={filterState.tahun}
              onChange={(e) => onFilterChange({ tahun: e.target.value })}
              className="w-full h-8 pl-2 pr-4 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-200 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Thn: Semua</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 2: Periode Bulan */}
          <div className="relative shrink-0 w-32 sm:w-36">
            <select
              value={filterState.bulan}
              onChange={(e) => onFilterChange({ bulan: e.target.value })}
              className="w-full h-8 pl-2 pr-4 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs font-semibold focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Bln: Semua (Jun-Okt)</option>
              <option value="06">06 - Juni 2026</option>
              <option value="07">07 - Juli 2026</option>
              <option value="08">08 - Agustus 2026</option>
              <option value="09">09 - September 2026</option>
              <option value="10">10 - Oktober 2026</option>
            </select>
          </div>

          {/* Dropdown 3: Entitas */}
          <div className="relative shrink-0 w-28 sm:w-32">
            <select
              value={filterState.entitas}
              onChange={(e) => onFilterChange({ entitas: e.target.value })}
              className="w-full h-8 pl-2 pr-4 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-200 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Entitas: Semua</option>
              {availableEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 4: Status Tiket */}
          <div className="relative shrink-0 w-28 sm:w-32">
            <select
              value={filterState.statusFilter}
              onChange={(e) => onFilterChange({ statusFilter: e.target.value as any })}
              className="w-full h-8 pl-2 pr-4 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-200 text-xs font-medium focus:ring-1 focus:ring-teal-400 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Status: Semua</option>
              <option value="LENGKAP">🟢 Lengkap</option>
              <option value="PROSES">🔵 Proses</option>
              <option value="PARSIAL">🟠 Parsial</option>
              <option value="BACKLOG">🔴 Backlog</option>
            </select>
          </div>

          {/* Input 5: Pencarian Cepat */}
          <div className="relative flex-1 min-w-[130px]">
            <input
              type="text"
              value={filterState.searchTerm}
              onChange={(e) => onFilterChange({ searchTerm: e.target.value })}
              placeholder="Cari armada, FPB..."
              className="w-full h-8 pl-7 pr-2.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-100 text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-teal-400 focus:outline-hidden"
            />
            <Search className="size-3.5 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Indikator Periode & Reset */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {filterState.selectedArmadaId && (
            <div className="h-8 px-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center gap-1 font-mono text-[11px]">
              <Ship className="size-3 text-sky-400 shrink-0" />
              <span className="truncate max-w-[110px] font-semibold">{filterState.selectedArmadaId}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ selectedArmadaId: null })}
                className="hover:text-white p-0.5 rounded cursor-pointer"
                title="Hapus filter armada"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          <div className="h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 shrink-0">
            <span className="size-1.5 rounded-full bg-teal-400 shrink-0" />
            <span className="truncate">{activePeriodLabel}</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shrink-0"
              title="Reset Filter"
            >
              <RotateCcw className="size-3 text-slate-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
