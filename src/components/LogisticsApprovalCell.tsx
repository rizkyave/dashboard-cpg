'use client';

import React from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { FpbReviewRecord } from '@/types/fpbReview';

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
  const cleanFpb = (record.fpbNo || '').trim();
  const directEfpbUrl = `https://e-fpb.cindaragroup.com/FilesList?psearch=${encodeURIComponent(cleanFpb)}`;

  // Kondisi 1: Sudah Disahkan di e-FPB -> Badge status hijau centang "Siap Pengadaan"
  if (record.isReceivedLogistik || record.pchLogistik === 'Received_Logistic') {
    const approver = record.reviewedBy || 'Staf Logistik di e-FPB';
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
        title={`Telah disahkan di e-FPB (Tombol Received_Logistic telah ditekan & tanda tangan sah tertera)${
          approver ? ` - PIC: ${approver}` : ''
        }${dateFormatted ? ` (${dateFormatted})` : ''}`}
      >
        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Siap Pengadaan</span>
      </span>
    );
  }

  // Kondisi 2: Belum Disahkan di e-FPB
  // Sesuai SOP: Berikan tombol shortcut langsung ke baris e-FPB untuk menekan Received_Logistic
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <a
        href={directEfpbUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs hover:shadow transition-all cursor-pointer select-none"
        title="Klik untuk membuka baris dokumen ini di web e-FPB. Tekan tombol Received_Logistic di e-FPB agar tombol menghilang dan tanda tangan resmi tertera."
      >
        <span>Sahkan di e-FPB</span>
        <ExternalLink className="size-3 shrink-0 opacity-80" />
      </a>
    </div>
  );
}
