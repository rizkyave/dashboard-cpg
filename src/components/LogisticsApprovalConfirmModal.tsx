'use client';

import React from 'react';
import { X, ShieldCheck, AlertCircle, Check, Loader2 } from 'lucide-react';
import { FpbReviewRecord } from '@/types/fpbReview';

export interface LogisticsApprovalConfirmModalProps {
  isOpen: boolean;
  record: FpbReviewRecord | null;
  onClose: () => void;
  onConfirm: (record: FpbReviewRecord) => Promise<void> | void;
  isLoading?: boolean;
}

export default function LogisticsApprovalConfirmModal({
  isOpen,
  record,
  onClose,
  onConfirm,
  isLoading = false,
}: LogisticsApprovalConfirmModalProps) {
  if (!isOpen || !record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Konfirmasi Persetujuan Pengadaan
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Verifikasi izin pengadaan logistik untuk diteruskan ke Purchasing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body Ringkasan Berkas */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Nomor Dokumen FPB:</span>
              <span className="font-bold text-foreground font-mono">{record.fpbNo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Armada / Departemen:</span>
              <span className="font-semibold text-foreground">{record.armada || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tanggal Pengajuan:</span>
              <span className="text-foreground">{record.date || '-'}</span>
            </div>
            {record.purpose && (
              <div className="pt-1 border-t border-border/60">
                <span className="text-muted-foreground block text-[11px] mb-0.5">Keperluan:</span>
                <span className="font-medium text-foreground line-clamp-2">{record.purpose}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Tindakan ini akan menandai dokumen FPB sebagai <strong>Siap Pengadaan</strong> dan memberikan izin kepada Tim Purchasing untuk segera memproses penerbitan PO atau negosiasi vendor.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(record)}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                <span>Ya, Setujui Pengadaan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
