'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileSignature,
  FileCheck2,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  Lock,
  Layers,
  Copy,
  Check,
  Ship,
  Info,
  PackageCheck,
  ShoppingBag,
  UserCheck,
} from 'lucide-react';
import { DocumentValidationRecord } from '@/types/documentValidation';
import { useAuth } from '@/context/AuthContext';
import { getUserActionForRecord, getStatusKelayakanConfig } from '@/utils/validationHelper';

export interface BatchSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: DocumentValidationRecord[];
  onBatchSuccess: (updatedRecords: DocumentValidationRecord[]) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function BatchSignatureModal({
  isOpen,
  onClose,
  selectedRecords,
  onBatchSuccess,
  showToast,
}: BatchSignatureModalProps) {
  const { user, isAdmin } = useAuth();

  const [notes, setNotes] = useState<string>('Pengesahan digital massal telah diperiksa dan disetujui.');
  const [isAgreed, setIsAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsAgreed(false);
      setNotes('Pengesahan digital massal telah diperiksa dan disetujui.');
    }
  }, [isOpen]);

  // Evaluasi slot yang akan disahkan untuk setiap dokumen yang dipilih
  const recordPlans = useMemo(() => {
    return selectedRecords.map((rec) => {
      const action = getUserActionForRecord(rec, user, Boolean(isAdmin));
      return {
        record: rec,
        action,
        targetSlot: action.nextPending,
      };
    });
  }, [selectedRecords, user, isAdmin]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExecuteBatchSign = async () => {
    if (!isAgreed) {
      setErrorMsg('Anda wajib menyetujui pernyataan integritas dan verifikasi keabsahan berkas.');
      return;
    }

    if (selectedRecords.length === 0) {
      setErrorMsg('Tidak ada berkas yang dipilih untuk divalidasi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const signerName = user?.name || user?.username || 'Pejabat Berwenang';
      const signerRole = user?.role || 'validator';
      const signerJabatan = user?.jabatan || (isAdmin ? 'Administrator Sistem' : 'Otoritas Validasi');
      const signerNik = user?.nik || undefined;

      const payload = {
        action: 'batch_sign',
        documentIds: selectedRecords.map((r) => r.id),
        validatorName: signerName,
        validatorUsername: user?.username,
        validatorRole: signerRole,
        validatorNik: signerNik,
        validatorJabatan: signerJabatan,
        signatureDataUrl: user?.signature?.signatureDataUrl || undefined,
        notes: notes.trim() || 'Pengesahan tanda tangan digital massal berhasil dilakukan.',
      };

      const res = await fetch('/api/validasi-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Terjadi kegagalan saat mengeksekusi tanda tangan massal.');
      }

      const updatedRecords: DocumentValidationRecord[] = data.records || [];
      onBatchSuccess(updatedRecords);

      if (showToast) {
        showToast(
          data.message || `Berhasil mengesahkan ${selectedRecords.length} berkas secara massal!`,
          'success'
        );
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses tanda tangan digital massal.';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary/20 via-teal-500/20 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <FileSignature className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground truncate">
                  Pengesahan Tanda Tangan Digital Massal
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                  {selectedRecords.length} Berkas TTB Dipilih
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Otorisasi serentak dan pembubuhan stempel digital kriptografis resmi Multi-Lini QA.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer disabled:opacity-50"
            title="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Profil Pejabat Penandatangan (Signer Identity Card) */}
          <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-teal-500/5 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/15 text-primary border border-primary/30 flex items-center justify-center font-bold text-sm shrink-0">
                  {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {user?.name || user?.username || 'Pejabat Berwenang'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                      {user?.role?.toUpperCase() || (isAdmin ? 'ADMIN' : 'VALIDATOR')}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    <span>{user?.jabatan || 'Otoritas Validasi Dokumen'}</span>
                    {user?.nik && <span className="ml-2 font-mono">NIK: {user.nik}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-muted-foreground block">Waktu Otorisasi:</span>
                  <span className="text-[11px] font-mono font-semibold text-foreground">
                    {new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    •{' '}
                    {new Date().toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Kredensial Terverifikasi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daftar Berkas yang Akan Ditandatangani */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                <span>Ringkasan {selectedRecords.length} Dokumen Target</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Semua berkas telah lolos verifikasi wewenang RBAC
              </span>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3">No.</th>
                      <th className="py-2 px-3">No. Berkas Resmi</th>
                      <th className="py-2 px-3">Armada / Unit</th>
                      <th className="py-2 px-3">No. FPB</th>
                      <th className="py-2 px-3">Tahap yang Disahkan</th>
                      <th className="py-2 px-3">Status Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {recordPlans.map(({ record: item, action, targetSlot }, index) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition">
                        <td className="py-2 px-3 text-muted-foreground font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-foreground">
                          <div className="flex items-center gap-1">
                            <span>{item.docNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.docNumber, item.id)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Salin nomor berkas"
                            >
                              {copiedId === item.id ? (
                                <Check className="size-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-2.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          <div className="flex items-center gap-1 truncate max-w-[160px]">
                            <Ship className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{item.armada || '-'}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-muted-foreground text-[11px]">
                          {item.fpbNumber || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {targetSlot ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/15 text-primary border border-primary/25">
                              <Sparkles className="size-2.5" />
                              <span>{targetSlot.code}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              <CheckCircle2 className="size-2.5" />
                              <span>Lengkap (4/4)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[10px]">
                          {(() => {
                            const cfg = getStatusKelayakanConfig(item.docType, action.completedCount);
                            const StatusIcon = cfg.icon;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${cfg.badgeClass}`}
                              >
                                <StatusIcon className="size-2.5 shrink-0" />
                                <span>{cfg.label}</span>
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Catatan Otorisasi Massal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Catatan / Keterangan Pengesahan Massal (Opsional):</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                Tercatat pada histori audit berkas
              </span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Seluruh barang fisik telah dicek kelengkapannya dan disetujui serentak."
              className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Legal / Security Compliance Checkbox */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="size-4 mt-0.5 rounded border-border accent-primary cursor-pointer shrink-0"
              />
              <span className="text-xs text-foreground leading-relaxed">
                <strong>Pernyataan Tanggung Jawab Hukum &amp; Operasional:</strong> Saya menyatakan
                dengan sadar dan bertanggung jawab penuh bahwa {selectedRecords.length} berkas TTB
                yang dipilih telah diperiksa keabsahan dan kesesuaian fisiknya, serta saya memiliki
                wewenang yang sah untuk menandatangani berkas tersebut secara digital.
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-muted/30 border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-primary" />
            <span>Kriptografi SHA-256 &amp; Token Digital Unik</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Batalkan
            </button>

            <button
              type="button"
              onClick={handleExecuteBatchSign}
              disabled={!isAgreed || isSubmitting || selectedRecords.length === 0}
              className="h-9 px-5 rounded-xl bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-600/90 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Mengesahkan {selectedRecords.length} Berkas...</span>
                </>
              ) : (
                <>
                  <FileSignature className="size-3.5" />
                  <span>Tanda Tangani Massal ({selectedRecords.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
