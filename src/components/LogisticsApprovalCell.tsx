'use client';

import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { FpbReviewRecord } from '@/types/fpbReview';

export interface LogisticsApprovalCellProps {
  record: FpbReviewRecord;
  onApproveClick: (record: FpbReviewRecord) => void;
  isLoading?: boolean;
}

export default function LogisticsApprovalCell({
  record,
  onApproveClick,
  isLoading = false,
}: LogisticsApprovalCellProps) {
  // Kondisi 2: Sudah Disetujui (Approved) -> Badge status pasif berwarna hijau dengan centang
  if (record.isReceivedLogistik) {
    const approver = record.reviewedBy || 'Tim Logistik';
    const dateFormatted = record.reviewedAt
      ? new Date(record.reviewedAt).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 select-none shadow-2xs"
        title={`Disetujui oleh: ${approver}${dateFormatted ? ` pada ${dateFormatted}` : ''}`}
      >
        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Siap Pengadaan</span>
      </span>
    );
  }

  // Ketergantungan Alur Kerja:
  // Cek apakah masih dalam status "Menunggu Analisa"
  const isPendingAnalysis = !record.reviewStatus || record.reviewStatus === 'PENDING_REVIEW';

  // Kondisi 3: Tombol Nonaktif (Ketergantungan Alur Kerja)
  // Berwarna abu-abu dan tidak bisa diklik dengan tooltip peringatan
  if (isPendingAnalysis) {
    return (
      <div className="relative group inline-block" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] font-medium bg-muted/70 text-muted-foreground/60 border border-border/80 cursor-not-allowed select-none transition shadow-none"
          title="Menunggu Analisa Tim FPB selesai"
        >
          <Clock className="size-3 mr-1.5 opacity-50 shrink-0" />
          <span>Setujui Pengadaan</span>
        </button>

        {/* Floating Tooltip saat Hover */}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-30 animate-in fade-in duration-150">
          <div className="bg-popover text-popover-foreground text-[10px] font-medium px-2.5 py-1 rounded-md shadow-md border border-border whitespace-nowrap">
            Menunggu Analisa Tim FPB selesai
          </div>
          <div className="w-1.5 h-1.5 bg-popover border-r border-b border-border rotate-45 -mt-1" />
        </div>
      </div>
    );
  }

  // Kondisi 1: Belum Disetujui (Pending Approval) & Analisa Selesai
  // Tombol interaktif yang tegas (solid action button) dengan kata kerja "Setujui Pengadaan"
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onApproveClick(record)}
        disabled={isLoading}
        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        title="Klik untuk menyetujui pengadaan dokumen FPB ini ke Tim Purchasing"
      >
        <span>Setujui Pengadaan</span>
      </button>
    </div>
  );
}
