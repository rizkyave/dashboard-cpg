'use client';

import React, { useState } from 'react';
import {
  MessageCircle,
  ExternalLink,
  Check,
  Copy,
  Send,
  Users,
  ShieldCheck,
  X,
  FileText,
} from 'lucide-react';
import { formatFstbWaMessage, generateDirectWaLink } from '@/utils/whatsappNotifier';

interface FstbSuccessWaModalProps {
  isOpen: boolean;
  onClose: () => void;
  noFstb: string;
  noPo?: string;
  noFpb?: string;
  armada?: string;
  uploaderName: string;
  uploaderRole?: string;
  fileCount?: number;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Kontak default tim PIC TTB untuk pemilihan cepat
const PIC_TTB_CONTACTS = [
  { name: 'Grup WA Tim TTB / Logistik', phone: '', note: 'Pilih kontak/grup langsung di WhatsApp' },
  { name: 'Davila Zalianti (Admin Logistik TTB)', phone: '081234567890', note: 'PIC TTB' },
  { name: 'Idham Khalid (Admin Logistik TTB)', phone: '081234567891', note: 'PIC TTB' },
  { name: 'Nurul Hafifah (Admin Logistik TTB)', phone: '081234567892', note: 'PIC TTB' },
];

export default function FstbSuccessWaModal({
  isOpen,
  onClose,
  noFstb,
  noPo,
  noFpb,
  armada,
  uploaderName,
  uploaderRole,
  fileCount,
  showToast,
}: FstbSuccessWaModalProps) {
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const payload = {
    noFstb,
    noPo,
    noFpb,
    armada,
    uploaderName,
    uploaderRole,
    fileCount,
  };

  const messageText = formatFstbWaMessage(payload);

  const targetPhoneNumber = customPhone.trim() || selectedPhone;
  const directWaUrl = generateDirectWaLink(payload, targetPhoneNumber || undefined);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      showToast?.('Teks notifikasi WhatsApp berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast?.('Gagal menyalin teks.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20">
              <MessageCircle className="size-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">FSTB Berhasil Diunggah! 🎉</h3>
              <p className="text-[11px] text-emerald-100">
                Kirim notifikasi pekerjaan WhatsApp langsung ke Tim PIC TTB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition cursor-pointer text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4.5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Info Ringkasan Berkas */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-foreground font-bold text-xs">
                <FileText className="size-3.5 text-emerald-600" />
                <span>{noFstb}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {armada || 'Semua Unit'} &bull; PO: {noPo || '-'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
              {fileCount || 1} Berkas Tersimpan
            </span>
          </div>

          {/* Preview Pesan WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <span>Format Pesan WhatsApp Otomatis:</span>
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-all border border-zinc-800">
              {messageText}
            </div>
          </div>

          {/* Opsi Target WhatsApp */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-foreground">
              Pilih Tujuan Pengiriman WhatsApp:
            </label>

            {/* Quick Selection Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPhone('');
                  setCustomPhone('');
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  !targetPhoneNumber
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <div>
                  <p className="text-xs">Buka WhatsApp (Pilih Bebas)</p>
                  <p className="text-[10px] text-muted-foreground">Kirim ke Grup / Kontak manapun</p>
                </div>
                {!targetPhoneNumber && <Check className="size-4 text-emerald-600" />}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPhone('081234567890')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  selectedPhone === '081234567890' && !customPhone
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <div>
                  <p className="text-xs">Tim PIC TTB</p>
                  <p className="text-[10px] text-muted-foreground">Davila / Idham / Hafifah</p>
                </div>
                {selectedPhone === '081234567890' && !customPhone && (
                  <Check className="size-4 text-emerald-600" />
                )}
              </button>
            </div>

            {/* Input Manual Nomor WA Tujuan (Opsional) */}
            <div className="pt-1">
              <label className="text-[10px] text-muted-foreground">
                Atau masukkan nomor WhatsApp tujuan spesifik:
              </label>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="Contoh: 081234567890 (kosongkan jika ingin memilih di WhatsApp)"
                className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-muted/60 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer font-medium"
          >
            Selesai / Tutup
          </button>

          <a
            href={directWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              showToast?.('Membuka WhatsApp...', 'info');
              setTimeout(onClose, 800);
            }}
            className="flex-1 max-w-[220px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageCircle className="size-4" />
            <span>Kirim Notifikasi WA</span>
            <ExternalLink className="size-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
}

