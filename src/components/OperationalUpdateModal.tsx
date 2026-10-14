'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  ClipboardCheck,
  UploadCloud,
  Check,
  Clock,
  AlertTriangle,
  X,
  FileText,
  ExternalLink,
  Trash2,
  Paperclip,
  Calendar,
  User,
  HardHat,
  Zap,
  CheckCircle2,
  FileImage,
  Loader2,
} from 'lucide-react';
import {
  OperationalAttachment,
  OperationalOverride,
  saveOperationalOverride,
  deleteOperationalOverride,
} from '@/utils/operationalProgressStorage';

interface OperationalUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  fpb: string;
  armada?: string;
  isJasaOnly?: boolean;
  isCampuran?: boolean;
  initialData?: {
    picTtb?: string;
    noTtb?: string;
    tglTtb?: string;
    picLap?: string;
    serviceReportNo?: string;
    tglDiantar?: string;
    tglKeTimLapangan?: string;
    tglTimLapKePicTtb?: string;
    tglTtbKePicPch?: string;
    attachments?: OperationalAttachment[];
    keterangan?: string;
  };
  onSave: (override: OperationalOverride) => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Format tanggal ke YYYY-MM-DD untuk input date HTML5
function toDateInputFormat(val?: string): string {
  if (!val || val === '-' || val.toLowerCase().includes('belum')) return '';
  // Jika sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Jika format DD/MM/YY atau DD/MM/YYYY
  const parts = val.split(/[-/]/);
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;
    if (day.length === 1) day = `0${day}`;
    if (month.length === 1) month = `0${month}`;
    return `${year}-${month}-${day}`;
  }
  return '';
}

// Format tanggal dari YYYY-MM-DD ke DD/MM/YY
function fromDateInputFormat(val: string): string {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${year}`;
  }
  return val;
}

const COMMON_TEKNISI = ['MUSTARING', 'BUDI', 'HENDRA', 'ARMAN', 'TIM MTC'];
const COMMON_PIC_TTB = ['FIFI', 'DAVILA', 'LOGISTIK GUDANG'];

export default function OperationalUpdateModal({
  isOpen,
  onClose,
  fpb,
  armada = 'ARMADA',
  isJasaOnly = false,
  isCampuran = false,
  initialData,
  onSave,
  showToast,
}: OperationalUpdateModalProps) {
  // State form fields
  const [picLap, setPicLap] = useState<string>('');
  const [serviceReportNo, setServiceReportNo] = useState<string>('');
  const [tglDiantar, setTglDiantar] = useState<string>('');
  const [tglKeTimLapangan, setTglKeTimLapangan] = useState<string>('');
  const [hasTlKeTtb, setHasTlKeTtb] = useState<boolean>(false);
  const [tglTimLapKePicTtb, setTglTimLapKePicTtb] = useState<string>('');
  const [hasTtbKePch, setHasTtbKePch] = useState<boolean>(false);
  const [tglTtbKePicPch, setTglTtbKePicPch] = useState<string>('');

  const [picTtb, setPicTtb] = useState<string>('');
  const [noTtb, setNoTtb] = useState<string>('');
  const [tglTtb, setTglTtb] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');

  // Lampiran file
  const [attachments, setAttachments] = useState<OperationalAttachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setPicLap(initialData?.picLap || '');
      setServiceReportNo(initialData?.serviceReportNo || '');
      setTglDiantar(toDateInputFormat(initialData?.tglDiantar));
      setTglKeTimLapangan(toDateInputFormat(initialData?.tglKeTimLapangan));
      
      const tlTtb = initialData?.tglTimLapKePicTtb;
      const hasTl = Boolean(tlTtb && tlTtb !== '-' && !tlTtb.toLowerCase().includes('belum'));
      setHasTlKeTtb(hasTl);
      setTglTimLapKePicTtb(toDateInputFormat(tlTtb));

      const ttbPch = initialData?.tglTtbKePicPch;
      const hasPch = Boolean(ttbPch && ttbPch !== '-' && !ttbPch.toLowerCase().includes('belum'));
      setHasTtbKePch(hasPch);
      setTglTtbKePicPch(toDateInputFormat(ttbPch));

      setPicTtb(initialData?.picTtb || (isJasaOnly ? 'FIFI' : 'DAVILA'));
      setNoTtb(initialData?.noTtb || '');
      setTglTtb(toDateInputFormat(initialData?.tglTtb));
      setKeterangan(initialData?.keterangan || '');
      setAttachments(initialData?.attachments || []);
    }
  }, [isOpen, initialData, isJasaOnly]);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Fitur Cepat: Tandai Pekerjaan Selesai Penuh Hari Ini
  const handleQuickMarkComplete = () => {
    if (!picLap) {
      setPicLap('MUSTARING');
    }
    setTglDiantar(todayStr);
    if (!tglKeTimLapangan) {
      setTglKeTimLapangan(todayStr);
    }
    setHasTlKeTtb(true);
    setTglTimLapKePicTtb(todayStr);
    setHasTtbKePch(true);
    setTglTtbKePicPch(todayStr);
    if (!tglTtb) {
      setTglTtb(todayStr);
    }
    if (!picTtb) {
      setPicTtb('FIFI');
    }
    if (showToast) {
      showToast('Otomatis mengisi tanggal selesai & centang serah terima hari ini.', 'info');
    }
  };

  // Upload file lampiran ke server / Google Drive API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('Mengunggah berkas ke Google Drive...');

    try {
      const scriptUrl =
        typeof window !== 'undefined'
          ? localStorage.getItem('cpg_drive_script_url') || ''
          : '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('noTtb', noTtb || fpb);
        formData.append('armada', armada || 'OFFICE');
        formData.append('receivedDate', tglDiantar ? fromDateInputFormat(tglDiantar) : todayStr);
        formData.append(
          'keterangan',
          `Dokumentasi BAST / Pelaksanaan Lapangan FPB: ${fpb}`
        );

        const res = await fetch(
          `/api/upload-ttb${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!res.ok) {
          throw new Error(`Upload gagal dengan status HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.uploadedFiles && data.uploadedFiles.length > 0) {
          const up = data.uploadedFiles[0];
          const newAtt: OperationalAttachment = {
            id: up.driveFileId || `${Date.now()}-${Math.random()}`,
            name: up.renamedFileName || file.name,
            url: up.fileUrl,
            viewUrl: up.driveViewUrl || up.fileUrl,
            driveViewUrl: up.driveViewUrl,
            driveFileId: up.driveFileId,
            uploadedAt: new Date().toISOString(),
          };
          setAttachments((prev) => [...prev, newAtt]);
        }
      }

      if (showToast) {
        showToast('Berkas berhasil diunggah ke Google Drive!', 'success');
      }
    } catch (err: any) {
      console.error('Error uploading attachment:', err);
      if (showToast) {
        showToast(`Gagal mengunggah berkas: ${err.message || 'Periksa koneksi'}`, 'error');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Simpan data
  const handleSave = () => {
    const isCompleted = Boolean(
      (picLap.trim() && tglDiantar) ||
      serviceReportNo.trim() ||
      (hasTlKeTtb && hasTtbKePch)
    );

    const finalData: OperationalOverride = {
      fpb,
      picTtb: picTtb.trim(),
      noTtb: noTtb.trim(),
      tglTtb: tglTtb ? fromDateInputFormat(tglTtb) : undefined,
      picLap: picLap.trim(),
      serviceReportNo: serviceReportNo.trim(),
      tglDiantar: tglDiantar ? fromDateInputFormat(tglDiantar) : undefined,
      tglKeTimLapangan: tglKeTimLapangan ? fromDateInputFormat(tglKeTimLapangan) : undefined,
      tglTimLapKePicTtb: hasTlKeTtb && tglTimLapKePicTtb ? fromDateInputFormat(tglTimLapKePicTtb) : undefined,
      tglTtbKePicPch: hasTtbKePch && tglTtbKePicPch ? fromDateInputFormat(tglTtbKePicPch) : undefined,
      isCompleted,
      attachments,
      keterangan: keterangan.trim(),
      updatedAt: new Date().toISOString(),
    };

    saveOperationalOverride(finalData);
    onSave(finalData);

    if (showToast) {
      showToast('Status operasional Fase 4 & 5 berhasil disimpan!', 'success');
    }
    onClose();
  };

  // Reset Override
  const handleReset = () => {
    if (confirm(`Yakin ingin mereset perubahan operasional untuk FPB ${fpb}? Data akan kembali mengikuti file Excel asli.`)) {
      deleteOperationalOverride(fpb);
      if (showToast) {
        showToast('Data override operasional telah direset.', 'info');
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              {isJasaOnly ? (
                <Wrench className="size-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <HardHat className="size-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-foreground font-mono truncate">
                  Pencatatan Operasional Lapangan & BAST
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Fase 4 & 5
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                No. FPB: <strong className="font-mono text-foreground">{fpb}</strong> • Armada:{' '}
                <strong className="font-mono text-foreground">{armada}</strong> •{' '}
                <span className="italic">
                  {isJasaOnly ? 'Layanan Jasa / Teknisi' : isCampuran ? 'Barang & Jasa' : 'Barang Fisik'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Quick Action Banner */}
        <div className="bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
            <Zap className="size-4 text-amber-600 shrink-0" />
            <span>Pekerjaan lapangan sudah tuntas dan berkas fisik sudah tiba di meja kantor?</span>
          </div>
          <button
            type="button"
            onClick={handleQuickMarkComplete}
            className="shrink-0 text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="Otomatis isi tanggal hari ini dan tandai alur lengkap"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Tandai Selesai Lengkap Hari Ini</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-[12px]">
          {/* BAGIAN 1: FASE 5 (TEKNISI / TIM LAPANGAN) */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 p-3.5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                <HardHat className="size-4 text-amber-600 dark:text-amber-400" />
                <span>5. TIM LAPANGAN & TEKNISI ({isJasaOnly ? 'JASA / TEKNISI' : 'SERAH TERIMA KAPAL'})</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Fase 5</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PIC Lapangan / Teknisi */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  {isJasaOnly ? 'Nama Teknisi Pelaksana:' : 'PIC Penerima Lapangan:'}
                </label>
                <input
                  type="text"
                  value={picLap}
                  onChange={(e) => setPicLap(e.target.value.toUpperCase())}
                  placeholder="Contoh: MUSTARING, BUDI, dst."
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {/* Suggestion Pills */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">Pilih Cepat:</span>
                  {COMMON_TEKNISI.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPicLap(name)}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-amber-500/20 text-foreground transition cursor-pointer border border-border"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* No. Service Report MTC */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  No. Service Report / SPK MTC: <span className="text-[10px] italic text-muted-foreground/80">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={serviceReportNo}
                  onChange={(e) => setServiceReportNo(e.target.value.toUpperCase())}
                  placeholder="Contoh: CPG-SRD-26-00123"
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Tanggal Selesai / Diantar */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  {isJasaOnly ? 'Tanggal Pekerjaan Selesai:' : 'Tanggal Barang Diantar ke Kapal:'}
                </label>
                <input
                  type="date"
                  value={tglDiantar}
                  onChange={(e) => setTglDiantar(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Tanggal Diterima TL */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Tanggal Berkas / Barang Diserahkan ke Lapangan:
                </label>
                <input
                  type="date"
                  value={tglKeTimLapangan}
                  onChange={(e) => setTglKeTimLapangan(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Checklist Rantai Berkas Fisik (Closed Loop Tracking) */}
            <div className="pt-2.5 border-t border-amber-500/20 space-y-2">
              <span className="text-[11px] font-medium text-foreground block">
                Pelacakan Berkas Fisik Kertas (TTB / BAST):
              </span>

              {/* TL ke TTB */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-background/60 border border-border">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasTlKeTtb}
                    onChange={(e) => {
                      setHasTlKeTtb(e.target.checked);
                      if (e.target.checked && !tglTimLapKePicTtb) setTglTimLapKePicTtb(todayStr);
                    }}
                    className="size-4 rounded text-amber-600 focus:ring-amber-500 border-border"
                  />
                  <span className="text-[11px] text-foreground font-medium">
                    Berkas telah ditandatangani kapal & dikembalikan ke Logistik (TL ke TTB)
                  </span>
                </label>
                {hasTlKeTtb && (
                  <input
                    type="date"
                    value={tglTimLapKePicTtb}
                    onChange={(e) => setTglTimLapKePicTtb(e.target.value)}
                    className="px-2 py-1 rounded border border-border bg-background text-foreground font-mono text-[10px] sm:w-36"
                  />
                )}
              </div>

              {/* TTB ke PCH */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-background/60 border border-border">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasTtbKePch}
                    onChange={(e) => {
                      setHasTtbKePch(e.target.checked);
                      if (e.target.checked && !tglTtbKePicPch) setTglTtbKePicPch(todayStr);
                    }}
                    className="size-4 rounded text-amber-600 focus:ring-amber-500 border-border"
                  />
                  <span className="text-[11px] text-foreground font-medium">
                    Berkas fisik telah diserahkan dari TTB ke Purchasing (TTB ke PCH)
                  </span>
                </label>
                {hasTtbKePch && (
                  <input
                    type="date"
                    value={tglTtbKePicPch}
                    onChange={(e) => setTglTtbKePicPch(e.target.value)}
                    className="px-2 py-1 rounded border border-border bg-background text-foreground font-mono text-[10px] sm:w-36"
                  />
                )}
              </div>
            </div>
          </div>

          {/* BAGIAN 2: FASE 4 (LOGISTIK TTB / ADMINISTRASI BAST) */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/10 p-3.5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                <ClipboardCheck className="size-4 text-purple-600 dark:text-purple-400" />
                <span>4. LOGISTIK TTB & VALIDASI BAST</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Fase 4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* PIC TTB */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  PIC Admin TTB / BAST:
                </label>
                <input
                  type="text"
                  value={picTtb}
                  onChange={(e) => setPicTtb(e.target.value.toUpperCase())}
                  placeholder="FIFI / DAVILA"
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {COMMON_PIC_TTB.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPicTtb(name)}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-purple-500/20 text-foreground transition cursor-pointer border border-border"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* No TTB / BAST */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  No. TTB / BAST:
                </label>
                <input
                  type="text"
                  value={noTtb}
                  onChange={(e) => setNoTtb(e.target.value.toUpperCase())}
                  placeholder="Contoh: MIL-TTB-26-00123"
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Tgl TTB / Validasi */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Tanggal Terbit TTB / BAST:
                </label>
                <input
                  type="date"
                  value={tglTtb}
                  onChange={(e) => setTglTtb(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* BAGIAN 3: LAMPIRAN FOTO / SCAN BAST / SERVICE REPORT (GOOGLE DRIVE SYNC) */}
          <div className="rounded-lg border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-mono text-[11px]">
                <Paperclip className="size-4 text-blue-600 dark:text-blue-400" />
                <span>DOKUMENTASI FOTO & BERKAS DIGITAL (GOOGLE DRIVE)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {attachments.length} berkas tersimpan
              </span>
            </div>

            {/* Upload Area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                  <UploadCloud className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">
                    Unggah Bukti Fisik / Scan BAST / Foto Pemasangan di Kapal
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Mendukung JPG, PNG, PDF. Langsung tersinkronisasi ke Google Drive Database.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>{uploadProgress || 'Mengunggah...'}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-3.5" />
                      <span>Pilih Berkas / Foto</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* List Berkas Terunggah */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileImage className="size-3.5 text-blue-600 shrink-0" />
                      <span className="font-mono font-medium truncate text-foreground" title={att.name}>
                        {att.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={att.driveViewUrl || att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-blue-600 hover:underline flex items-center gap-1"
                        title="Buka dokumen di Google Drive"
                      >
                        <span>Lihat</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 text-muted-foreground hover:text-red-500 rounded transition cursor-pointer"
                        title="Hapus lampiran"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catatan Lapangan */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Catatan Kondisi / Keterangan Tambahan:
            </label>
            <textarea
              rows={2}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Catatan kondisi serah terima, nama perwira kapal penerima, atau kendala pekerjaan..."
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-muted/30 flex items-center justify-between gap-2 shrink-0">
          <div>
            {initialData?.picLap || initialData?.tglDiantar ? (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-mono text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="size-3" />
                <span>Reset ke Data Excel Asli</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted font-mono text-[11px] font-medium transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[11px] font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Simpan & Perbarui Status Alur</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
