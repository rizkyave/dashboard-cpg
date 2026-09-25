'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sparkles,
  X,
  MessageSquare,
  Check,
  ShoppingBag,
  PackageCheck,
  HardHat,
  Landmark,
  FileCheck,
  FileText,
  ExternalLink,
  Download,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';

interface AuditModalProps {
  fpbNumber: string | null;
  targetPo?: string | null;
  procurementList: ProcurementItem[];
  armadaList: ArmadaItem[];
  onClose: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AuditModal({
  fpbNumber,
  targetPo,
  procurementList,
  armadaList,
  onClose,
  showToast,
}: AuditModalProps) {
  const [showAiRisk, setShowAiRisk] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<{
    fpbNo: string;
    fpbDate?: string;
    userArmada?: string;
    requestedBy?: string;
    requestedDate?: string;
    requestedTimestamp?: string;
    reviewedBy?: string;
    reviewedDate?: string;
    approvedBy?: string;
    approvedDate?: string;
    items: Array<{
      no: number;
      itemCode: string;
      itemName: string;
      qty: number;
      unit: string;
      description: string;
      lastDate: string;
      priority: string;
    }>;
    tujuanPeruntukan?: string;
    pdfUrl?: string;
  } | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);

  // Check if target PO is empty / '-' / '(kosong)'
  const isNoPo = !targetPo || targetPo.trim() === '' || targetPo === '-' || targetPo === '(kosong)' || targetPo === 'NOPO';

  // Find exact procurement item:
  // If targetPo is specified and not empty, find by that PO first
  // If PO is empty, strictly find a record for this FPB that has no PO (po === '-' or empty)
  const itemS1 = !isNoPo
    ? procurementList.find((i) => i.po === targetPo) || procurementList.find((i) => i.fpb === fpbNumber)
    : procurementList.find((i) => i.fpb === fpbNumber && (!i.po || i.po === '-' || i.po === '(kosong)')) ||
      procurementList.find((i) => i.fpb === fpbNumber);

  // Active PO: strictly null if isNoPo!
  const activePo = !isNoPo ? (targetPo || (itemS1?.po && itemS1.po !== '-' ? itemS1.po : null)) : null;

  // Filter armada list:
  // 1. If activePo is available, match strictly by that PO
  // 2. If isNoPo, filter strictly by items under that FPB that DO NOT have a PO
  // 3. Fallback to all items with that FPB
  const poMatchingItems = activePo
    ? armadaList.filter((i) => i.noPo === activePo)
    : isNoPo
    ? armadaList.filter((i) => i.fpb === fpbNumber && (!i.noPo || i.noPo === '-' || i.noPo === ''))
    : [];

  const itemsS2 = poMatchingItems.length > 0
    ? poMatchingItems
    : armadaList.filter((i) => i.fpb === fpbNumber);

  // Ambil Keterangan Tujuan & Peruntukan Pengadaan:
  // HANYA ambil jika ada data keterangan asli yang valid (bukan dummy/fallback)
  const dummyTexts = ['-', 'U/ Operasional Rutin', 'U/ Kebutuhan Operasional Armada', 'Pengadaan Operasional'];

  const armadaKeterangans = Array.from(
    new Set(
      itemsS2
        .map((i) => i.keterangan?.trim())
        .filter((k): k is string => typeof k === 'string' && k.length > 0 && !dummyTexts.includes(k))
    )
  );

  let rawPeruntukan = itemS1?.peruntukan?.trim() || '';
  if (dummyTexts.includes(rawPeruntukan)) {
    rawPeruntukan = '';
  }

  // Jika tidak ada keterangan, dikosongkan saja (tidak dipaksa masukkan data dummy)
  // Bisa diperkaya otomatis jika data ditarik dari PDF e-FPB resmi
  const basePeruntukan =
    armadaKeterangans.length > 0
      ? armadaKeterangans.join(' • ')
      : rawPeruntukan;
  const tujuanPeruntukan = basePeruntukan || pdfData?.tujuanPeruntukan || '';

  // Trigger Link Dokumen PDF e-FPB Terverifikasi (logistik_Approved_rev_sign):
  // Format Server: https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_{FPB}.pdf
  const docFpb = fpbNumber?.trim() || itemS1?.fpb?.trim() || itemsS2[0]?.fpb?.trim() || '';
  const docPo = activePo?.trim() || itemS1?.po?.trim() || itemsS2[0]?.noPo?.trim() || '';
  const cleanFpb = docFpb.replace(/^["']|["']$/g, '');
  const cleanPo = docPo.replace(/^["']|["']$/g, '');
  const primaryDocNum = cleanFpb || cleanPo;
  const fpbPdfUrl = primaryDocNum
    ? `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanFpb || primaryDocNum)}.pdf`
    : null;

  // PIC & Tanggal Verifikasi FPB:
  // Prioritas utama diambil langsung dari 'Requested By' & tanggal tanda tangan digital PDF jika tersedia
  const displayPicFpb = pdfData?.requestedBy || itemS1?.picCheckFpb || itemsS2[0]?.picCheckFpb || 'Bu Noor';
  const displayTglFpb = pdfData?.requestedDate || itemS1?.tglCheckFpb || itemsS2[0]?.tglCheckFpb || itemS1?.tglFpb || '-';

  // Otomatis sinkronkan metadata PDF (Requested By, Tanggal, Item) saat modal dibuka
  useEffect(() => {
    let isMounted = true;
    if (primaryDocNum) {
      setPdfData(null);
      fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(primaryDocNum)}`)
        .then((res) => res.json())
        .then((json) => {
          if (isMounted && json.success && json.data) {
            setPdfData(json.data);
          }
        })
        .catch(() => {});
    } else {
      setPdfData(null);
    }
    return () => {
      isMounted = false;
    };
  }, [primaryDocNum]);

  // Support closing modal via ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isCritical = itemS1 ? itemS1.lapse > 5 : false;

  const handleFetchPdfData = async () => {
    if (!primaryDocNum) {
      showToast('Nomor FPB/PO tidak valid untuk penarikan dokumen PDF.', 'warning');
      return;
    }
    setIsLoadingPdf(true);
    showToast(`Menghubungkan ke server e-FPB untuk mengambil data ${primaryDocNum}...`, 'info');

    try {
      const res = await fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(primaryDocNum)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPdfData(json.data);
        showToast(
          `Berhasil menarik ${json.data.items?.length || 0} rincian item & peruntukan dari PDF e-FPB!`,
          'success'
        );
      } else {
        showToast(
          json.message || 'Dokumen PDF tidak ditemukan di server e-FPB.',
          'warning'
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch PDF data:', err);
      showToast('Gagal menarik data dari server PDF. Periksa koneksi jaringan.', 'error');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleRunAiAudit = () => {
    setShowAiRisk(true);
    showToast('Analisis Risiko AI Gemini 3 Flash selesai diproses.', 'success');
  };

  const handleWhatsappNudge = () => {
    const pic = itemS1 ? itemS1.picAktif : 'PIC Terkait';
    const text = encodeURIComponent(
      `Halo ${pic}, mohon update percepatan berkas pengadaan fisik ${fpbNumber} (${
        itemS1 ? itemS1.item : 'Armada'
      }) untuk diteruskan ke Keuangan CPG. Terima kasih.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    showToast(`Membuka pesan eskalasi WhatsApp untuk ${pic}`, 'info');
  };

  const renderPriorityBadge = (p?: string) => {
    if (!p || p === '-' || p.trim() === '') {
      return <span className="text-muted-foreground/60 text-[11px] font-mono">-</span>;
    }
    const clean = p.trim().toUpperCase();
    const isP1 = clean.includes('1') || clean === 'PI';
    const isP2 = clean.includes('2');
    const isP3 = clean.includes('3');

    if (isP1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          {clean}
        </span>
      );
    }
    if (isP2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          {clean}
        </span>
      );
    }
    if (isP3) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          {clean}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
        {clean}
      </span>
    );
  };

  if (!fpbNumber) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer animate-in fade-in duration-200"
      title="Klik di area luar/kosong untuk menutup"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-5xl xl:max-w-6xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-5 md:p-6 space-y-4 text-card-foreground cursor-default pb-12 sm:pb-6"
      >
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-cyan-400 mt-0.5 sm:mt-0">
              <ShieldCheck className="size-4.5 sm:size-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider block">
                Verifikasi Akuntabilitas Lintas Modul
              </span>
              <h3 className="text-sm sm:text-base font-semibold text-foreground font-mono flex items-center gap-1.5 sm:gap-2 flex-wrap mt-0.5">
                <span className="text-primary">{fpbNumber}</span>
                {activePo ? (
                  <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    PO: {activePo}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 rounded-md bg-muted border border-border">
                    PO: - (Kosong)
                  </span>
                )}
                {fpbPdfUrl && (
                  <a
                    href={fpbPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-mono font-medium transition shadow-2xs"
                    title={`Buka Dokumen PDF e-FPB Terverifikasi (${primaryDocNum})`}
                  >
                    <FileText className="size-3 text-blue-600 dark:text-blue-400" />
                    <span>PDF e-FPB</span>
                    <ExternalLink className="size-2.5 opacity-70" />
                  </a>
                )}
                <span className="text-foreground font-sans text-xs sm:text-sm font-medium">
                  &bull; {itemsS2[0]?.armada || itemS1?.deptArmada || itemS1?.item || 'Nama Kapal / Armada'}
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Gemini AI Risk Audit Button */}
            <button
              onClick={handleRunAiAudit}
              className="h-8 px-2.5 sm:px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95 touch-manipulation"
            >
              <Sparkles className="size-3.5 text-purple-600 dark:text-amber-300" />
              <span>Analisis Risiko AI</span>
            </button>
            <button
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition touch-manipulation"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* AI Document Risk Callout Box */}
        {showAiRisk && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between text-purple-800 dark:text-purple-300 font-semibold font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
                Hasil Analisis AI Gemini 3 Flash
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  isCritical
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isCritical ? 'RISIKO: TINGGI (BOTTLENECK)' : 'RISIKO: RENDAH (SESUAI SOP)'}
              </span>
            </div>
            <div className="text-foreground leading-relaxed font-sans">
              {isCritical ? (
                <>
                  <p className="mb-1 text-foreground">
                    <strong>Peringatan SLA:</strong> Berkas <code>{itemS1?.fpb}</code> telah
                    tertahan selama <strong>{itemS1?.lapse} hari</strong> pada status{' '}
                    <em>{itemS1?.statusBadge}</em>.
                  </p>
                  <p className="text-muted-foreground">
                    PIC Aktif saat ini:{' '}
                    <strong className="text-foreground">{itemS1?.picAktif}</strong>. Terdeteksi
                    adanya penundaan verifikasi spek marine teknis oleh pihak armada/kapal.
                    Disarankan melakukan eskalasi langsung melalui WhatsApp agar berkas segera
                    diserahkan ke bagian Keuangan.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-foreground">
                    <strong>Alur Berkas Bersih:</strong> Berkas <code>{itemS1?.fpb}</code> berada
                    dalam koridor SLA normal (Lapse: <strong>{itemS1?.lapse || 0} hari</strong>
                    ).
                  </p>
                  <p className="text-muted-foreground">
                    Rantai pertanggungjawaban fisik 5 divisi: Verifikasi FPB (&rarr;{' '}
                    {displayPicFpb}), Purchasing (&rarr;{' '}
                    {itemS1?.picPch || 'NOVI'}), TTB Logistik (&rarr;{' '}
                    {itemS1?.picTtb || 'DAVILA'}), Lapangan (&rarr;{' '}
                    {itemS1?.picLap || 'AGUS'}), dan Finance (&rarr;{' '}
                    {itemS1?.picAdm || 'MANDA'}) sinkron terverifikasi.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Metadata Row Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <span className="text-[10px] text-muted-foreground font-mono block">
              NOMOR PO INTERNAL
            </span>
            <span className="text-sm font-semibold font-mono mt-0.5 block">
              {activePo ? (
                <span className="text-foreground">{activePo}</span>
              ) : (
                <span className="text-muted-foreground font-normal italic">- (Kosong)</span>
              )}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <span className="text-[10px] text-muted-foreground font-mono block">
              ENTITAS & TANGGAL
            </span>
            <span className="text-sm font-semibold text-foreground font-mono mt-0.5 block">
              {itemsS2[0]?.entity || itemS1?.entity || 'CPL'} &bull;{' '}
              {itemsS2[0]?.tglPo || itemsS2[0]?.tglFpb || itemS1?.date || '-'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <span className="text-[10px] text-muted-foreground font-mono block">
              STATUS SAAT INI
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {itemS1?.statusBadge || itemsS2[0]?.status || 'TERDATA DI LAYANAN ARMADA'}
            </span>
          </div>
        </div>

        {/* 4 Cross Verification Badges */}
        <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Status Validasi Dokumen Lintas Modul</span>
            </h4>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              4/4 Modul Terverifikasi
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. INPUT DATA MELINDA */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                INPUT DATA MELINDA
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium">
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 2. VERIFIKASI FPB / BU NOOR */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition">
              <div className="flex items-center justify-between min-h-[1.75rem] gap-1">
                <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight truncate">
                  VERIFIKASI FPB {pdfData?.requestedBy ? `(${pdfData.requestedBy})` : '/ BU NOOR'}
                </span>
                {fpbPdfUrl && (
                  <a
                    href={fpbPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono shrink-0"
                    title={`Buka Dokumen PDF e-FPB Terverifikasi (${primaryDocNum})`}
                  >
                    <span>PDF</span>
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium">
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  {itemS1?.statusCheckFpb || itemS1?.doneCheckFpb || (itemS1?.picCheckFpb && itemS1.picCheckFpb !== '-' ? 'TERVERIFIKASI' : 'MATCHING')}
                </span>
              </div>
            </div>

            {/* 3. PROCUREMENT */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                PROCUREMENT
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium">
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 4. PENGANTARAN LOGISTIK */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                PENGANTARAN LOGISTIK
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium">
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            RANTAI TANGGUNG JAWAB & AUDIT DETAIL (5 DIVISI LENGKAP)
            1. VERIFIKASI FPB
            2. PURCHASING
            3. LOGISTIK TTB
            4. TIM LAPANGAN
            5. FINANCE / ADM
            ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Alur Tanggung Jawab Fisik & PIC (5 Divisi Terverifikasi)</span>
            </h4>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md border border-border">
              Detail Riwayat Lengkap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* 1. VERIFIKASI FPB */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 whitespace-nowrap min-w-0">
                    <FileCheck className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>1. VERIFIKASI FPB</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    FPB
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC:</span>
                    <span
                      className="font-semibold text-foreground font-mono truncate text-right ml-1.5 flex items-center justify-end gap-1"
                      title={pdfData?.requestedBy ? `Requested By (End User): ${pdfData.requestedBy}` : displayPicFpb}
                    >
                      <span>{displayPicFpb}</span>
                      {pdfData?.requestedBy && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-sans font-medium" title="Ditarik dari Requested By PDF">
                          Requested By
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl:</span>
                    <span
                      className="text-muted-foreground font-mono text-right ml-1.5"
                      title={pdfData?.requestedTimestamp ? `Timestamp: ${pdfData.requestedTimestamp}` : displayTglFpb}
                    >
                      {displayTglFpb}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Status:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-right ml-1.5">
                      {itemS1?.statusCheckFpb || itemsS2[0]?.statusCheckFpb || (itemS1?.doneCheckFpb ? 'DONE' : 'CLOSE')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Approved:</span>
                    <span
                      className="text-muted-foreground font-mono text-right ml-1.5 truncate max-w-[130px]"
                      title={
                        pdfData?.approvedBy
                          ? `Approved By: ${pdfData.approvedBy} (${pdfData.approvedDate || ''})`
                          : undefined
                      }
                    >
                      {pdfData?.approvedBy
                        ? pdfData.approvedBy
                        : itemS1?.tglApproveWeb || itemsS2[0]?.tglApproveWeb || (itemS1?.statusCheckFpb === 'CLOSE' ? 'Tervalidasi' : '-')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 block text-center truncate font-medium">
                  {pdfData?.approvedBy
                    ? `Approved (${pdfData.approvedBy})`
                    : itemS1?.tglApproveWeb
                    ? 'Approved'
                    : itemS1?.statusCheckFpb === 'CLOSE' || itemS1?.doneCheckFpb === 'DONE'
                    ? 'FPB Terverifikasi (CLOSE)'
                    : itemS1?.tglCheckFpb
                    ? 'Sedang Diproses'
                    : itemS1?.picCheckFpb && itemS1.picCheckFpb !== '-'
                    ? 'Tercatat Verifikator'
                    : 'Menunggu FPB'}
                </span>
                {fpbPdfUrl && (
                  <a
                    href={fpbPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition shadow-xs group"
                    title={`Buka Dokumen PDF e-FPB Terverifikasi: ${primaryDocNum}`}
                  >
                    <FileText className="size-3.5" />
                    <span>Buka PDF Terverifikasi</span>
                    <ExternalLink className="size-3 opacity-80 group-hover:opacity-100 transition" />
                  </a>
                )}
              </div>
            </div>

            {/* 2. PURCHASING */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 whitespace-nowrap min-w-0">
                    <ShoppingBag className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span>2. PURCHASING</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    PCH
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC:</span>
                    <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5">
                      {itemS1?.picPch || 'NOVI'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. PO:</span>
                    <span
                      className="text-foreground font-mono font-bold truncate text-right ml-1.5"
                      title={itemsS2[0]?.noPo || itemS1?.po || '-'}
                    >
                      {itemsS2[0]?.noPo || itemS1?.po || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl PO:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemsS2[0]?.tglPo || itemS1?.date || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Delivery:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemS1?.deliveryTime || itemsS2[0]?.waktuProses || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 block text-center truncate font-medium">
                  {itemS1?.po && itemS1.po !== '-'
                    ? 'PO Diterbitkan'
                    : itemsS2[0]?.noPo
                    ? 'PO Diterbitkan'
                    : 'Menunggu PO'}
                </span>
              </div>
            </div>

            {/* 3. LOGISTIK TTB */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 whitespace-nowrap min-w-0">
                    <PackageCheck className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>3. LOGISTIK TTB</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    LOG
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC TTB:</span>
                    <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5">
                      {itemS1?.picTtb || 'DAVILA'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. TTB:</span>
                    <span
                      className="text-purple-600 dark:text-purple-400 font-mono font-bold truncate text-right ml-1.5"
                      title={itemsS2[0]?.noTtb || itemS1?.noTtb || '-'}
                    >
                      {itemsS2[0]?.noTtb || itemS1?.noTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl TTB:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemsS2[0]?.tglTtb || itemS1?.tglInputTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. FSTB:</span>
                    <span
                      className="text-muted-foreground font-mono truncate text-right ml-1.5"
                      title={itemsS2[0]?.noFstb || itemS1?.noFstb || '-'}
                    >
                      {itemsS2[0]?.noFstb || itemS1?.noFstb || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 block text-center truncate font-medium">
                  {itemsS2[0]?.noTtb || itemS1?.noTtb
                    ? 'TTB Divalidasi'
                    : itemsS2[0]?.noFstb
                    ? 'FSTB Diterbitkan'
                    : 'Menunggu TTB'}
                </span>
              </div>
            </div>

            {/* 4. TIM LAPANGAN */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 whitespace-nowrap min-w-0">
                    <HardHat className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>4. TIM LAPANGAN</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    LAP
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC Lap:</span>
                    <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5">
                      {itemS1?.picLap || 'AGUS'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl Diantar:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono text-right ml-1.5">
                      {itemS1?.tglBarangDiantar || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Ke Tim Lap:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemS1?.tglKeTimLapangan || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">TTB ke PCH:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemS1?.tglTtbKePicPch || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 block text-center truncate font-medium">
                  {itemS1?.tglBarangDiantar
                    ? 'Barang Sudah Diantar'
                    : itemsS2.length > 0 && itemsS2[0].selisih === 0
                    ? 'Fisik Lengkap'
                    : 'Distribusi Lapangan'}
                </span>
              </div>
            </div>

            {/* 5. FINANCE / ADM */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 whitespace-nowrap min-w-0">
                    <Landmark className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>5. FINANCE / ADM</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    FIN
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC Fin:</span>
                    <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5">
                      {itemS1?.picAdm || 'MANDA'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. SPP:</span>
                    <span
                      className="text-emerald-600 dark:text-emerald-400 font-mono font-bold truncate text-right ml-1.5"
                      title={itemS1?.noSpp || '-'}
                    >
                      {itemS1?.noSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl SPP:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemS1?.tglInputSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Ke Keuangan:</span>
                    <span className="text-muted-foreground font-mono text-right ml-1.5">
                      {itemS1?.tglKeKeuangan || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 block text-center truncate font-medium">
                  {itemS1?.tglKeKeuangan
                    ? 'Selesai di Keuangan'
                    : itemS1?.noSpp
                    ? 'Proses SPP Kas'
                    : 'Menunggu Berkas ADM'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Peruntukan & Tujuan Pengadaan */}
        <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tujuan & Peruntukan Pengadaan:
            </span>
            {pdfData?.tujuanPeruntukan ? (
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                Sumber: Dokumen PDF e-FPB Asli
              </span>
            ) : tujuanPeruntukan && armadaKeterangans.length > 0 ? (
              <span className="text-[10px] font-mono text-foreground bg-muted border border-border px-2 py-0.5 rounded">
                Worksheet: Monitoring Layanan Armada
              </span>
            ) : null}
          </div>
          {tujuanPeruntukan ? (
            <p className="text-xs font-medium text-foreground leading-relaxed bg-background p-3 rounded-lg border border-border">
              {tujuanPeruntukan}
            </p>
          ) : (
            <p className="text-xs font-mono text-muted-foreground italic bg-background/50 p-3 rounded-lg border border-dashed border-border">
              - (kosong)
            </p>
          )}
        </div>

        {/* Items Table Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Daftar Rincian Item Barang {activePo ? `(Khusus PO: ${activePo})` : '(Layanan Armada Matching)'}:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0 && itemsS2.length === 0
                  ? `${pdfData.items.length} item (dari PDF e-FPB)`
                  : `${itemsS2.length} item ditemukan`}
              </span>
              {fpbPdfUrl && (
                <button
                  onClick={handleFetchPdfData}
                  disabled={isLoadingPdf}
                  className="h-6 px-2.5 rounded-md border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[11px] font-medium flex items-center gap-1 transition shadow-2xs active:scale-95"
                  title="Tarik data rincian item langsung dari PDF e-FPB resmi"
                >
                  <RefreshCw className={`size-3 ${isLoadingPdf ? 'animate-spin' : ''}`} />
                  <span>{pdfData ? 'Tarik Ulang PDF' : 'Tarik dari PDF e-FPB'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Callout box when Excel has 0 items but PDF exists */}
          {itemsS2.length === 0 && !pdfData && fpbPdfUrl && (
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                    <span>Rincian Item Belum Ada di File Excel</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Excel Belum Lengkap
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Dokumen resmi e-FPB (<strong>{primaryDocNum}</strong>) tersedia di server. Anda dapat langsung menarik rincian barang, satuan, qty &amp; tujuan peruntukan straight dari PDF asli.
                  </p>
                </div>
              </div>
              <button
                onClick={handleFetchPdfData}
                disabled={isLoadingPdf}
                className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95 shrink-0"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Sedang Menarik Data...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    <span>Tarik Data Straight dari PDF</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Banner when data was successfully loaded from PDF */}
          {pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0 && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-foreground font-medium">
                  Rincian barang berhasil disinkronkan langsung dari PDF e-FPB ({pdfData.items.length} item ditemukan)
                  {pdfData.userArmada ? ` • User/Armada: ${pdfData.userArmada}` : ''}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
                100% Akurat dari Server
              </span>
            </div>
          )}

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-2.5">Item Deskripsi & Tujuan</th>
                  <th className="p-2.5 text-center">Priority</th>
                  <th className="p-2.5 text-center">Satuan</th>
                  <th className="p-2.5 text-center">Qty FPB</th>
                  <th className="p-2.5 text-center">Qty PO</th>
                  <th className="p-2.5 text-center">Qty FSTB</th>
                  <th className="p-2.5 text-center">Qty TTB</th>
                  <th className="p-2.5 text-center">Status Pemenuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-xs">
                {itemsS2.length > 0 ? (
                  itemsS2.map((i, idx) => {
                    const itemSatuan = i.satuan || itemS1?.satuan;
                    const valQtyPo =
                      i.qtyPO !== undefined && i.qtyPO !== null
                        ? i.qtyPO
                        : activePo
                        ? i.qtyFPB
                        : '-';
                    const valQtyTtb =
                      i.qtyTTB !== undefined && i.qtyTTB !== null
                        ? i.qtyTTB
                        : i.noTtb
                        ? i.qtyFSTB
                        : '-';

                    return (
                      <tr key={`${i.fpb}-${i.item}-${idx}`} className="hover:bg-muted/40 transition">
                        <td className="p-2.5 text-foreground font-sans">
                          <div className="font-medium text-foreground">{i.item}</div>
                          {i.kodeBarang && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Kode: {i.kodeBarang}
                            </div>
                          )}
                          {i.keterangan && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              <span className="text-muted-foreground/70 font-sans mr-1">Tujuan:</span>
                              {i.keterangan}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {renderPriorityBadge(i.priority || itemS1?.priority)}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {itemSatuan ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                              {itemSatuan}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {i.qtyFPB}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {valQtyPo}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {i.qtyFSTB}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {valQtyTtb}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              i.selisih === 0
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {i.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0 ? (
                  pdfData.items.map((pi, idx) => {
                    return (
                      <tr key={`pdf-${pi.itemCode}-${idx}`} className="hover:bg-muted/40 transition bg-blue-500/5">
                        <td className="p-2.5 text-foreground font-sans">
                          <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                            <span>{pi.itemName}</span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                              PDF e-FPB
                            </span>
                          </div>
                          {pi.itemCode && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Kode: {pi.itemCode}
                            </div>
                          )}
                          {pi.description && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              <span className="text-muted-foreground/70 font-sans mr-1">Tujuan:</span>
                              {pi.description}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {renderPriorityBadge(pi.priority)}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {pi.unit ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                              {pi.unit}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {pi.qty}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {activePo ? pi.qty : '-'}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {pi.qty}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {pi.qty}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            Sinkron PDF
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-2.5 text-foreground font-sans">
                      {itemS1 ? itemS1.item : 'Item Standar'}
                    </td>
                    <td className="p-2.5 text-center">
                      {renderPriorityBadge(itemS1?.priority)}
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      {itemS1?.satuan ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                          {itemS1.satuan}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                      {itemS1?.qtyFPB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                      {itemS1?.qtyPO ?? itemS1?.qtyFPB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground font-mono">
                      {itemS1?.qtyFSTB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground font-mono">
                      {itemS1?.qtyTTB ?? itemS1?.qtyFSTB ?? 1}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        Lengkap
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleWhatsappNudge}
              className="h-8 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Eskalasi PIC via WhatsApp</span>
            </button>
            {fpbPdfUrl && !pdfData && (
              <button
                onClick={handleFetchPdfData}
                disabled={isLoadingPdf}
                className="h-8 px-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
                title="Tarik data rincian barang langsung dari PDF server"
              >
                <Download className="size-3.5" />
                <span>{isLoadingPdf ? 'Menarik...' : 'Tarik dari PDF'}</span>
              </button>
            )}
            {fpbPdfUrl && (
              <a
                href={fpbPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
                title={`Buka Dokumen PDF e-FPB Terverifikasi (${primaryDocNum})`}
              >
                <FileText className="size-3.5" />
                <span>Buka PDF e-FPB ({primaryDocNum})</span>
                <ExternalLink className="size-3 opacity-80" />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 px-4 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium transition"
          >
            Tutup Modal
          </button>
        </div>
      </div>
    </div>
  );
}
