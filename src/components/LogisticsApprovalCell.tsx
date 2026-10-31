'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Clock,
  HelpCircle,
  XCircle,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';
import { FpbReviewRecord } from '@/types/fpbReview';
import {
  formatFpbApprovalWaMessage,
  generateFpbApprovalWaLink,
} from '@/utils/whatsappNotifier';

export interface LogisticsApprovalCellProps {
  record: FpbReviewRecord;
  onApproveClick?: (record: FpbReviewRecord) => void;
  isLoading?: boolean;
}

export default function LogisticsApprovalCell({
  record,
  onApproveClick,
  isLoading = false,
}: LogisticsApprovalCellProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const cleanFpb = (record.fpbNo || '').trim();
  const directEfpbUrl = `https://e-fpb.cindaragroup.com/FilesList?psearch=${encodeURIComponent(cleanFpb)}`;

  const hasExtractedItems = Array.isArray(record.items) && record.items.length > 0;
  const isPendingReview = !record.reviewStatus || record.reviewStatus === 'PENDING_REVIEW';
  const isApproved = record.reviewStatus === 'APPROVED_PO' || record.reviewStatus === 'FULFILL_STOCK';
  const isClarification = record.reviewStatus === 'NEED_CLARIFICATION';
  const isRejected = record.reviewStatus === 'REJECTED';
  const isReceivedLogistik = Boolean(record.isReceivedLogistik || record.pchLogistik === 'Received_Logistic');

  // Helper copy WA format message
  const handleCopyWa = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const text = formatFpbApprovalWaMessage(record);
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Gagal menyalin teks WA:', err);
    }
  };

  // 1. KONDISI: Ditolak oleh Tim Review
  if (isRejected) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 select-none shadow-2xs"
        title="Pengajuan FPB ini ditolak oleh Tim Review FPB."
      >
        <XCircle className="size-3 text-rose-600 dark:text-rose-400 shrink-0" />
        <span>Ditolak</span>
      </span>
    );
  }

  // 2. KONDISI: Perlu Klarifikasi ke armada
  if (isClarification) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 select-none shadow-2xs"
        title="Menunggu klarifikasi teknis/spesifikasi barang ke armada sebelum dapat diproses."
      >
        <HelpCircle className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Perlu Klarifikasi</span>
      </span>
    );
  }

  // 3. ATURAN BISNIS: Data item masih "Belum diekstrak"
  // Persetujuan Logistik TIDAK BOLEH "Siap Pengadaan" jika ekstraksi OCR/parsing belum selesai
  if (!hasExtractedItems) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 select-none shadow-2xs"
        title="Item barang belum diekstrak dari dokumen PDF e-FPB. Klik baris untuk mengekstrak item dan memulai analisa."
      >
        <Clock className="size-3 text-slate-500 shrink-0" />
        <span>Menunggu Review</span>
      </span>
    );
  }

  // 4. ATURAN BISNIS: Status Review Tim FPB masih "Menunggu Analisa"
  // Status Persetujuan Logistik bernilai "Menunggu Review" / "Pending" sampai Tim FPB memberikan status Disetujui
  if (isPendingReview) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 select-none shadow-2xs"
        title="Berkas masih dalam tahap analisa Tim FPB / Purchasing. Persetujuan logistik dibuka setelah disetujui tim review."
      >
        <Clock className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Menunggu Review</span>
      </span>
    );
  }

  // 5. ATURAN BISNIS: Tim FPB telah menyetujui (APPROVED_PO atau FULFILL_STOCK)
  if (isApproved) {
    const isApprovedPo = record.reviewStatus === 'APPROVED_PO';
    const waUrl = isApprovedPo ? generateFpbApprovalWaLink(record) : '';

    // Tombol Notifikasi WA ke Tim Purchasing (dengan No. TKB)
    const waButton = isApprovedPo ? (
      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs hover:shadow-xs transition select-none cursor-pointer"
          title={`Kirim notifikasi WhatsApp ke Tim Purchasing (FPB: ${cleanFpb}, No. TKB: ${record.tkbNo || '-'})`}
        >
          <MessageSquare className="size-3 shrink-0" />
          <span>Link WA Purchasing</span>
          {record.tkbNo && (
            <span className="font-mono text-[9px] bg-emerald-800/80 px-1 py-0.2 rounded text-emerald-100 font-bold">
              {record.tkbNo}
            </span>
          )}
        </a>
        <button
          type="button"
          onClick={handleCopyWa}
          className="p-1 rounded text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
          title="Salin teks format WhatsApp persetujuan PO & No. TKB ke clipboard"
        >
          {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
        </button>
      </div>
    ) : null;

    // 5A. Sudah disahkan di e-FPB (Received_Logistic telah ditekan & ttd tertera)
    if (isReceivedLogistik) {
      const approver = record.reviewedBy || 'Staf Logistik';
      const dateFormatted = record.reviewedAt
        ? new Date(record.reviewedAt).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '';

      return (
        <div className="flex flex-col items-start gap-0.5" onClick={(e) => e.stopPropagation()}>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 select-none shadow-2xs"
            title={`Telah disetujui tim review & disahkan di e-FPB (Tombol Received_Logistic telah ditekan)${
              approver ? ` - Disetujui: ${approver}` : ''
            }${dateFormatted ? ` (${dateFormatted})` : ''}`}
          >
            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Siap Pengadaan</span>
          </span>
          {waButton}
        </div>
      );
    }

    // 5B. Sudah disetujui Tim Review, tetapi tombol Received_Logistic di e-FPB belum ditekan
    return (
      <div className="flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={directEfpbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs hover:shadow transition-all cursor-pointer select-none"
          title="FPB telah disetujui tim review! Klik untuk membuka web e-FPB dan tekan tombol Received_Logistic agar tanda tangan logistik tertera dan pengadaan sah."
        >
          <span>Sahkan di e-FPB</span>
          <ExternalLink className="size-3 shrink-0 opacity-80" />
        </a>
        {waButton}
      </div>
    );
  }

  // 6. Default Fallback
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border select-none">
      <Clock className="size-3 shrink-0" />
      <span>Pending</span>
    </span>
  );
}
