'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Database, Boxes, Camera, RefreshCw } from 'lucide-react';

export type ResetScope = 'all' | 'procurement' | 'inventory' | 'photos';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: (scope: ResetScope) => void;
  procurementCount: number;
  inventoryCount: number;
}

export default function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirmReset,
  procurementCount,
  inventoryCount,
}: ResetConfirmModalProps) {
  const [selectedScope, setSelectedScope] = useState<ResetScope>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-destructive/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-destructive/20 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Reset Data (Mode Uji Coba)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Kosongkan data untuk memulai pengujian dari awal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-4 space-y-2.5">
          <span className="text-xs font-semibold text-foreground block">
            Pilih data yang ingin di-reset:
          </span>

          {/* Option: Reset All */}
          <label
            onClick={() => setSelectedScope('all')}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedScope === 'all'
                ? 'border-destructive bg-destructive/5 dark:bg-destructive/10 text-foreground'
                : 'border-border hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <input
              type="radio"
              name="reset-scope"
              checked={selectedScope === 'all'}
              onChange={() => setSelectedScope('all')}
              className="mt-0.5 text-destructive focus:ring-destructive"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <Trash2 className="size-3.5 text-destructive" />
                <span>Reset Seluruh Data (Full Reset)</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-destructive/20 text-destructive font-bold">
                  Semua
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Mengosongkan semua data pengadaan ({procurementCount.toLocaleString('id-ID')} item), stok Accurate ({inventoryCount.toLocaleString('id-ID')} item), dan foto lapangan.
              </p>
            </div>
          </label>

          {/* Option: Procurement Only */}
          <label
            onClick={() => setSelectedScope('procurement')}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedScope === 'procurement'
                ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-foreground'
                : 'border-border hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <input
              type="radio"
              name="reset-scope"
              checked={selectedScope === 'procurement'}
              onChange={() => setSelectedScope('procurement')}
              className="mt-0.5 text-amber-500 focus:ring-amber-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <Database className="size-3.5 text-amber-500" />
                <span>Hanya Data Pengadaan &amp; Layanan FPB</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Mengosongkan {procurementCount.toLocaleString('id-ID')} berkas pengadaan &amp; armada. Stok persediaan gudang tetap tersimpan.
              </p>
            </div>
          </label>

          {/* Option: Inventory Only */}
          <label
            onClick={() => setSelectedScope('inventory')}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedScope === 'inventory'
                ? 'border-sky-500 bg-sky-500/5 dark:bg-sky-500/10 text-foreground'
                : 'border-border hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <input
              type="radio"
              name="reset-scope"
              checked={selectedScope === 'inventory'}
              onChange={() => setSelectedScope('inventory')}
              className="mt-0.5 text-sky-500 focus:ring-sky-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <Boxes className="size-3.5 text-sky-500" />
                <span>Hanya Persediaan Stok (Accurate)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Mengosongkan {inventoryCount.toLocaleString('id-ID')} item persediaan stok gudang. Data berkas FPB tetap aman.
              </p>
            </div>
          </label>

          {/* Option: Photos Only */}
          <label
            onClick={() => setSelectedScope('photos')}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedScope === 'photos'
                ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 text-foreground'
                : 'border-border hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <input
              type="radio"
              name="reset-scope"
              checked={selectedScope === 'photos'}
              onChange={() => setSelectedScope('photos')}
              className="mt-0.5 text-purple-500 focus:ring-purple-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <Camera className="size-3.5 text-purple-500" />
                <span>Hanya Dokumentasi Foto Lapangan</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Menghapus seluruh arsip foto serah terima barang dari memori browser.
              </p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 bg-muted/30 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmReset(selectedScope);
              onClose();
            }}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            Konfirmasi Reset
          </button>
        </div>
      </div>
    </div>
  );
}
