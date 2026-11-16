'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { DocumentValidationRecord } from '@/types/documentValidation';
import { useAuth } from '@/context/AuthContext';

interface RevisionUploadModalProps {
  isOpen: boolean;
  record: DocumentValidationRecord | null;
  onClose: () => void;
  onSuccess: (updatedRecord: DocumentValidationRecord) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function RevisionUploadModal({
  isOpen,
  record,
  onClose,
  onSuccess,
  showToast,
}: RevisionUploadModalProps) {
  const { user, isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reason, setReason] = useState<string>('Koreksi salah penempatan posisi tanda tangan supervisor');
  const [resetMode, setResetMode] = useState<'keep_staff' | 'reset_all'>('keep_staff');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setErrorMsg('Hanya berkas berformat PDF yang diperbolehkan.');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Silakan pilih berkas PDF pengganti yang masih bersih.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Mohon isi alasan revisi/penggantian berkas untuk jejak audit.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('docNumber', record.docNumber || record.cleanDocNumber);
      formData.append('cleanDocNumber', record.cleanDocNumber || record.docNumber);
      formData.append('docType', record.docType);
      formData.append('reason', reason.trim());
      formData.append('resetMode', resetMode);
      formData.append('userName', user?.name || 'Administrator');
      formData.append('userRole', user?.role || 'admin');

      const res = await fetch('/api/validasi-dokumen/replace-file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mengunggah berkas pengganti.');
      }

      if (showToast) {
        showToast(
          'Berkas bersih berhasil diunggah! Seluruh tanda tangan yang salah letak telah dibersihkan.',
          'success'
        );
      }

      onSuccess(data.record);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan sistem saat revisi berkas.';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                Revisi &amp; Upload Berkas Bersih
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-primary/10 text-primary border border-primary/20">
                  {record.docType}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Nomor: <span className="font-mono font-medium text-foreground">{record.cleanDocNumber || record.docNumber}</span> ({record.armada})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Pembersihan Tanda Tangan Salah Letak</span>
            </div>
            <p className="leading-relaxed opacity-90">
              Mengunggah berkas PDF bersih akan <strong>mengganti fisik PDF lama</strong> di storage. Tanda tangan yang salah letak akan hilang bersih tanpa bekas tumpukan cap, dan sistem akan membuka kembali slot pengesahan untuk ditandatangani ulang oleh pihak yang berwenang.
            </p>
          </div>

          {/* File Upload Drop Area */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Berkas PDF Pengganti (Bersih)</span>
              <span className="text-[10px] text-muted-foreground">Format .PDF</span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                selectedFile
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <FileCheck2 className="size-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground break-all">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Klik untuk mengganti berkas
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <UploadCloud className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Klik atau tarik berkas PDF bersih ke sini</p>
                    <p className="text-[11px] text-muted-foreground">Pilih file scan TTB/FSTB yang belum ada cap yang salah</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mode Reset Pengesahan */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Pengaturan Status Tanda Tangan:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition ${
                  resetMode === 'keep_staff'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="resetMode"
                  value="keep_staff"
                  checked={resetMode === 'keep_staff'}
                  onChange={() => setResetMode('keep_staff')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="font-semibold text-foreground">Pertahankan TTD Staf</p>
                  <p className="text-[11px] leading-tight opacity-80 mt-0.5">
                    Tanda tangan Staf Pembuat tetap sah. Slot SPV &amp; Manager dikosongkan untuk di-TTD ulang.
                  </p>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition ${
                  resetMode === 'reset_all'
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="resetMode"
                  value="reset_all"
                  checked={resetMode === 'reset_all'}
                  onChange={() => setResetMode('reset_all')}
                  className="mt-0.5 text-primary"
                />
                <div>
                  <p className="font-semibold text-foreground">Reset Total (0/4)</p>
                  <p className="text-[11px] leading-tight opacity-80 mt-0.5">
                    Kosongkan seluruh kolom tanda tangan dari awal (jika berkas PDF benar-benar polos).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Alasan Revisi (Audit Trail) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Alasan Revisi / Catatan Audit <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-muted-foreground">Tercatat di riwayat</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Koreksi salah letak tanda tangan SPV Purchasing pada kolom Logistic Supervisor"
              required
              className="w-full text-xs rounded-xl border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="size-3.5 animate-spin" />
                  <span>Mengunggah &amp; Membersihkan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Unggah &amp; Bersihkan TTD</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
