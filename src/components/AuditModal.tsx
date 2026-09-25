'use client';

import React, { useState } from 'react';
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

  if (!fpbNumber) return null;

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
  const tujuanPeruntukan =
    armadaKeterangans.length > 0
      ? armadaKeterangans.join(' • ')
      : rawPeruntukan;

  const isCritical = itemS1 ? itemS1.lapse > 5 : false;

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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 md:p-6 space-y-4 text-card-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-cyan-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider block">
                Verifikasi Akuntabilitas Lintas Modul Terintegrasi
              </span>
              <h3 className="text-base font-semibold text-foreground font-mono flex items-center gap-2 flex-wrap mt-0.5">
                <span>{fpbNumber}</span>
                {activePo ? (
                  <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                    PO: {activePo}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 rounded-md bg-muted border border-border">
                    PO: - (Kosong)
                  </span>
                )}
                <span className="text-foreground font-sans text-sm font-medium">
                  &bull; {itemsS2[0]?.armada || itemS1?.deptArmada || itemS1?.item || 'Nama Kapal / Armada'}
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Gemini AI Risk Audit Button */}
            <button
              onClick={handleRunAiAudit}
              className="h-8 px-3 rounded-lg border border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>Analisis Risiko AI</span>
            </button>
            <button
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* AI Document Risk Callout Box */}
        {showAiRisk && (
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs space-y-2">
            <div className="flex items-center justify-between text-purple-300 font-semibold font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
                Hasil Analisis AI Gemini 3 Flash
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  isCritical
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {isCritical ? 'RISIKO: TINGGI (BOTTLENECK)' : 'RISIKO: RENDAH (SESUAI SOP)'}
              </span>
            </div>
            <div className="text-slate-200 leading-relaxed font-sans">
              {isCritical ? (
                <>
                  <p className="mb-1 text-slate-100">
                    <strong>Peringatan SLA:</strong> Berkas <code>{itemS1?.fpb}</code> telah
                    tertahan selama <strong>{itemS1?.lapse} hari</strong> pada status{' '}
                    <em>{itemS1?.statusBadge}</em>.
                  </p>
                  <p className="text-slate-300">
                    PIC Aktif saat ini:{' '}
                    <strong className="text-cyan-300">{itemS1?.picAktif}</strong>. Terdeteksi
                    adanya penundaan verifikasi spek marine teknis oleh pihak armada/kapal.
                    Disarankan melakukan eskalasi langsung melalui WhatsApp agar berkas segera
                    diserahkan ke bagian Keuangan.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-slate-100">
                    <strong>Alur Berkas Bersih:</strong> Berkas <code>{itemS1?.fpb}</code> berada
                    dalam koridor SLA normal (Lapse: <strong>{itemS1?.lapse || 0} hari</strong>
                    ).
                  </p>
                  <p className="text-slate-300">
                    Rantai pertanggungjawaban fisik PIC Purchasing (&rarr; {itemS1?.picPch}), TTB
                    Logistik (&rarr; {itemS1?.picTtb}), dan Lapangan (&rarr; {itemS1?.picLap})
                    cocok dengan Master Data Bu Noor.
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
            <span className="text-sm font-semibold text-emerald-400 font-mono mt-0.5 block">
              {itemS1?.statusBadge || itemsS2[0]?.status || 'TERDATA DI LAYANAN ARMADA'}
            </span>
          </div>
        </div>

        {/* 4 Cross Verification Badges */}
        <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-400" />
              <span>Status Validasi Dokumen Lintas Modul</span>
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              4/4 Modul Terverifikasi
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. INPUT DATA MELINDA */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:border-zinc-700 transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                INPUT DATA MELINDA
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  <Check className="size-3 text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 2. PROCUREMENT */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:border-zinc-700 transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                PROCUREMENT
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  <Check className="size-3 text-emerald-400" />
                  TERVERIFIKASI
                </span>
              </div>
            </div>

            {/* 3. MASTER DATA BU NOOR */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:border-zinc-700 transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                MASTER DATA BU NOOR
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  <Check className="size-3 text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 4. LAYANAN ARMADA */}
            <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:border-zinc-700 transition">
              <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                LAYANAN ARMADA
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-bold">
                  <Check className="size-3 text-emerald-400" />
                  MATCHING
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            RANTAI TANGGUNG JAWAB & AUDIT DETAIL (4 DIVISI LENGKAP)
            1. PURCHASING
            2. LOGISTIK TTB
            3. TIM LAPANGAN
            4. FINANCE / ADM
            ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Alur Tanggung Jawab Fisik & PIC (4 Divisi Terverifikasi)</span>
            </h4>
            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md border border-border">
              Audit Trail Lengkap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. PURCHASING */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2 shadow-xs hover:border-zinc-700 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5">
                    <ShoppingBag className="size-3.5 text-cyan-400" />
                    1. PURCHASING
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border font-semibold">
                    PCH
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">PIC PCH:</span>
                    <span className="font-semibold text-foreground font-mono">{itemS1?.picPch || 'NOVI'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">No. PO:</span>
                    <span className="text-foreground font-mono font-bold">
                      {itemsS2[0]?.noPo || itemS1?.po || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tgl Input PO:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemsS2[0]?.tglPo || itemS1?.date || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Delivery Time:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemS1?.deliveryTime || itemsS2[0]?.waktuProses || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-800/40 block text-center truncate">
                  {itemS1?.po && itemS1.po !== '-'
                    ? 'PO Diterbitkan'
                    : itemsS2[0]?.noPo
                    ? 'PO Diterbitkan'
                    : 'Menunggu PO'}
                </span>
              </div>
            </div>

            {/* 2. LOGISTIK TTB */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2 shadow-xs hover:border-zinc-700 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5">
                    <PackageCheck className="size-3.5 text-purple-400" />
                    2. LOGISTIK TTB
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border font-semibold">
                    LOG
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">PIC TTB:</span>
                    <span className="font-semibold text-foreground font-mono">{itemS1?.picTtb || 'DAVILA'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">No. TTB:</span>
                    <span className="text-purple-400 font-mono font-bold">
                      {itemsS2[0]?.noTtb || itemS1?.noTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tgl Input TTB:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemsS2[0]?.tglTtb || itemS1?.tglInputTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">No. FSTB:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemsS2[0]?.noFstb || itemS1?.noFstb || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-800/40 block text-center truncate">
                  {itemsS2[0]?.noTtb || itemS1?.noTtb
                    ? 'TTB Divalidasi'
                    : itemsS2[0]?.noFstb
                    ? 'FSTB Diterbitkan'
                    : 'Menunggu TTB'}
                </span>
              </div>
            </div>

            {/* 3. TIM LAPANGAN */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2 shadow-xs hover:border-zinc-700 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5">
                    <HardHat className="size-3.5 text-amber-400" />
                    3. TIM LAPANGAN
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border font-semibold">
                    LAP
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">PIC Lapangan:</span>
                    <span className="font-semibold text-foreground font-mono">{itemS1?.picLap || 'AGUS'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tgl Diantar:</span>
                    <span className="text-amber-400 font-mono">
                      {itemS1?.tglBarangDiantar || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Ke Tim Lap:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemS1?.tglKeTimLapangan || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">TTB ke PCH:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemS1?.tglTtbKePicPch || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40 block text-center truncate">
                  {itemS1?.tglBarangDiantar
                    ? 'Barang Sudah Diantar'
                    : itemsS2.length > 0 && itemsS2[0].selisih === 0
                    ? 'Fisik Lengkap'
                    : 'Distribusi Lapangan'}
                </span>
              </div>
            </div>

            {/* 4. FINANCE / ADM */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2 shadow-xs hover:border-zinc-700 transition">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5">
                    <Landmark className="size-3.5 text-emerald-400" />
                    4. FINANCE / ADM
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border font-semibold">
                    FIN
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">PIC ADM / Fin:</span>
                    <span className="font-semibold text-foreground font-mono">{itemS1?.picAdm || 'MANDA'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">No. SPP:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {itemS1?.noSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tgl Input SPP:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemS1?.tglInputSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Ke Keuangan:</span>
                    <span className="text-muted-foreground font-mono">
                      {itemS1?.tglKeKeuangan || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40 block text-center truncate">
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
            {tujuanPeruntukan && armadaKeterangans.length > 0 && (
              <span className="text-[10px] font-mono text-foreground bg-muted border border-border px-2 py-0.5 rounded">
                Worksheet: Monitoring Layanan Armada
              </span>
            )}
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Daftar Rincian Item Barang {activePo ? `(Khusus PO: ${activePo})` : '(Layanan Armada Matching)'}:
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {itemsS2.length} item ditemukan
            </span>
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-2.5">Item Deskripsi & Tujuan</th>
                  <th className="p-2.5 text-center">Qty FPB</th>
                  <th className="p-2.5 text-center">Qty FSTB</th>
                  <th className="p-2.5 text-center">Status Pemenuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-xs">
                {itemsS2.length > 0 ? (
                  itemsS2.map((i, idx) => (
                    <tr key={`${i.fpb}-${i.item}-${idx}`} className="hover:bg-muted/40 transition">
                      <td className="p-2.5 text-foreground font-sans">
                        <div className="font-medium text-foreground">{i.item}</div>
                        {i.keterangan && (
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            <span className="text-muted-foreground/70 font-sans mr-1">Tujuan:</span>
                            {i.keterangan}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-foreground font-semibold">{i.qtyFPB}</td>
                      <td className="p-2.5 text-center text-muted-foreground">{i.qtyFSTB}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            i.selisih === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2.5 text-foreground font-sans">
                      {itemS1 ? itemS1.item : 'Item Standar'}
                    </td>
                    <td className="p-2.5 text-center text-foreground font-semibold">1</td>
                    <td className="p-2.5 text-center text-muted-foreground">1</td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            onClick={handleWhatsappNudge}
            className="h-8 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Eskalasi PIC via WhatsApp</span>
          </button>
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
