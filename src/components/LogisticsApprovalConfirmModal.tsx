'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Check,
  Loader2,
  UserCheck,
  Stamp,
  ExternalLink,
  Globe,
  KeyRound,
  Zap,
} from 'lucide-react';
import { FpbReviewRecord } from '@/types/fpbReview';
import { OPERATIONAL_STAFF_LIST, OperationalStaff } from '@/utils/fpbSignatureAssets';

export interface LogisticsApprovalConfirmModalProps {
  isOpen: boolean;
  record: FpbReviewRecord | null;
  onClose: () => void;
  onConfirm: (record: FpbReviewRecord, signerName: string, sessionId?: string) => Promise<void> | void;
  isLoading?: boolean;
  efpbSessionId?: string;
  onOpenSyncModal?: () => void;
}

export default function LogisticsApprovalConfirmModal({
  isOpen,
  record,
  onClose,
  onConfirm,
  isLoading = false,
  efpbSessionId = '',
  onOpenSyncModal,
}: LogisticsApprovalConfirmModalProps) {
  const [selectedStaff, setSelectedStaff] = useState<OperationalStaff>(OPERATIONAL_STAFF_LIST[0]);
  const [customSessionId, setCustomSessionId] = useState<string>('');
  const [showSessionInput, setShowSessionInput] = useState<boolean>(false);

  useEffect(() => {
    if (record) {
      if (record.reviewedBy?.toLowerCase().includes('melinda')) {
        setSelectedStaff(OPERATIONAL_STAFF_LIST[1]);
      } else {
        setSelectedStaff(OPERATIONAL_STAFF_LIST[0]);
      }
    }
    if (efpbSessionId) {
      setCustomSessionId(efpbSessionId);
    }
  }, [record, efpbSessionId]);

  if (!isOpen || !record) return null;

  const cleanFpb = (record.fpbNo || '').trim();
  const directEfpbUrl = `https://e-fpb.cindaragroup.com/FilesList?psearch=${encodeURIComponent(cleanFpb)}`;
  const hasActiveSession = Boolean(customSessionId.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
                Persetujuan &amp; Tanda Tangan e-FPB
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Memicu tombol <em>Received_Logistic</em> di e-FPB &amp; mengesahkan Siap Pengadaan
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
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Metadata FPB */}
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
              <div className="pt-1.5 border-t border-border/60">
                <span className="text-muted-foreground block text-[11px] mb-0.5">Keperluan:</span>
                <span className="font-medium text-foreground line-clamp-2">{record.purpose}</span>
              </div>
            )}
          </div>

          {/* Pemilihan Staf Operasional / Adm. Logistik Penandatangan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Pilih Staf Logistik Penandatangan (Received By):</span>
              </label>
              <span className="text-[10px] text-muted-foreground font-medium">Resmi e-FPB CPG</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {OPERATIONAL_STAFF_LIST.map((staff) => {
                const isSelected = selectedStaff.id === staff.id;
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedStaff(staff)}
                    disabled={isLoading}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30'
                        : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="font-bold text-foreground text-xs">{staff.name}</p>
                        <p className="text-[10px] text-muted-foreground">{staff.role}</p>
                      </div>
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <Check className="size-2.5 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Signature Preview Thumbnail */}
                    <div className="h-10 w-full bg-white dark:bg-zinc-900 rounded border border-border/60 flex items-center justify-center p-1 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={staff.signatureBase64}
                        alt={`Tanda Tangan ${staff.name}`}
                        className="max-h-full max-w-full object-contain filter dark:invert"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SINKRONISASI TOMBOL e-FPB */}
          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <span className="font-bold text-xs text-foreground">
                  Aksi Tombol Received_Logistic di e-FPB
                </span>
              </div>
              <a
                href={directEfpbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                title="Buka baris dokumen ini di web e-FPB FilesList"
              >
                <span>Buka di e-FPB</span>
                <ExternalLink className="size-3" />
              </a>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Saat disetujui, sistem akan otomatis mengirimkan sinyal persetujuan untuk menekan tombol <strong>Received_Logistic</strong> pada baris FPB ini di web e-FPB, membubuhkan tanda tangan staf secara sah, dan mengubah status di dashboard menjadi <strong>Siap Pengadaan</strong>.
            </p>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${
                    hasActiveSession ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-muted-foreground">
                  {hasActiveSession ? 'Sesi e-FPB aktif terhubung' : 'Sesi e-FPB (Opsional / Standby)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionInput(!showSessionInput)}
                className="text-primary hover:underline font-medium text-[11px] cursor-pointer"
              >
                {showSessionInput ? 'Sembunyikan Cookie' : 'Atur Cookie PHPSESSID'}
              </button>
            </div>

            {showSessionInput && (
              <div className="pt-2 space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                  <KeyRound className="size-3" />
                  <span>Cookie PHPSESSID Browser e-FPB (dari browser):</span>
                </label>
                <input
                  type="text"
                  value={customSessionId}
                  onChange={(e) => setCustomSessionId(e.target.value)}
                  placeholder="Contoh: us04j0rcujqntjltp9qf9n4j39"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
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
            onClick={() => onConfirm(record, selectedStaff.name, customSessionId.trim())}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Memproses &amp; Menekan Tombol e-FPB...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                <span>Setujui &amp; Tekan Received_Logistic</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
