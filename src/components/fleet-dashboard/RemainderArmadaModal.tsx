'use client';

import React, { useState, useMemo } from 'react';
import { ArmadaDataPoint } from './types';
import {
  Ship,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Target,
  ExternalLink,
  ChevronRight,
  Anchor,
  Building,
} from 'lucide-react';

interface RemainderArmadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  remainderList: ArmadaDataPoint[];
  totalFpbAll: number;
  totalRemainderFpb: number;
  onSelectArmada: (name: string) => void;
  onFocusTop12Only: () => void;
}

export default function RemainderArmadaModal({
  isOpen,
  onClose,
  remainderList,
  totalFpbAll,
  totalRemainderFpb,
  onSelectArmada,
  onFocusTop12Only,
}: RemainderArmadaModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRemainder = useMemo(() => {
    if (!searchTerm.trim()) return remainderList;
    const q = searchTerm.toLowerCase().trim();
    return remainderList.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tag.toLowerCase().includes(q)
    );
  }, [remainderList, searchTerm]);

  if (!isOpen) return null;

  const remainderPct = totalFpbAll > 0 ? ((totalRemainderFpb / totalFpbAll) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Ship className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Rincian Armada di Luar 12 Besar (Armada Lainnya)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                  {remainderList.length} Unit
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total akumulasi pengajuan: <span className="text-sky-300 font-mono font-semibold">{totalRemainderFpb} FPB</span> ({remainderPct}% dari seluruh pengadaan).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Action Banner: Sembunyikan & Fokus 12 Besar */}
        <div className="px-5 py-3 bg-gradient-to-r from-sky-950/50 via-slate-900 to-indigo-950/50 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Ingin presentasi lebih fokus?</span> Sembunyikan kategori ini agar visual grafik &amp; perhitungan murni terkonsentrasi ke 12 armada teratas (skala 100%).
          </div>
          <button
            type="button"
            onClick={() => {
              onFocusTop12Only();
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shrink-0 shadow-sm transition cursor-pointer"
          >
            <Target className="size-3.5" />
            <span>Fokuskan ke 12 Besar Saja</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari armada di dalam kelompok lainnya..."
              className="w-full h-9 pl-9 pr-3 bg-slate-800/90 border border-slate-700/80 rounded-xl text-slate-100 text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-sky-400 focus:outline-hidden"
            />
            <Search className="size-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Remainder Table List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredRemainder.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Tidak ada armada yang sesuai dengan pencarian.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredRemainder.map((item, idx) => {
                const globalRank = 13 + idx;
                const pctFulfill = item.qtyFPB > 0 ? Math.round((item.qtyFSTB / item.qtyFPB) * 100) : 100;
                const isMarine = !item.name.toLowerCase().includes('office') && !item.name.toLowerCase().includes('site') && !item.name.toLowerCase().includes('dept');

                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between gap-3 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-400 w-8 shrink-0">
                        #{globalRank}
                      </span>

                      <div className="size-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0 text-slate-300">
                        {isMarine ? <Anchor className="size-4 text-sky-400" /> : <Building className="size-4 text-amber-400" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition">
                            {item.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-slate-700 text-slate-300">
                            {item.tag}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span>Realisasi: {pctFulfill}% ({item.qtyFSTB}/{item.qtyFPB} unit)</span>
                          {item.backlogQty > 0 && (
                            <span className="text-amber-400">Backlog: {item.backlogQty} unit</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-white">{item.fpbCount} FPB</div>
                        <div className="text-[10px] text-slate-400">
                          {totalFpbAll > 0 ? ((item.fpbCount / totalFpbAll) * 100).toFixed(1) : 0}%
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectArmada(item.name);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-sky-500 hover:text-slate-950 text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title={`Sorot ${item.name} di dashboard`}
                      >
                        <span>Sorot</span>
                        <ChevronRight className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Menampilkan {filteredRemainder.length} dari {remainderList.length} unit</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
