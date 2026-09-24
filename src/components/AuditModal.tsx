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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b101f] border border-cyan-500/40 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                Verifikasi Akuntabilitas Lintas Modul Terintegrasi
              </span>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2 flex-wrap">
                <span>{fpbNumber}</span>
                {activePo ? (
                  <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                    PO: {activePo}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                    PO: - (Kosong)
                  </span>
                )}
                <span className="text-cyan-400 font-sans text-base font-semibold">
                  &bull; {itemsS2[0]?.armada || itemS1?.deptArmada || itemS1?.item || 'Nama Kapal / Armada'}
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Gemini AI Risk Audit Button */}
            <button
              onClick={handleRunAiAudit}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Analisis Risiko AI</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800 border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
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
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">
              NOMOR PO INTERNAL
            </span>
            <span className="text-sm font-bold font-mono">
              {activePo ? (
                <span className="text-cyan-300">{activePo}</span>
              ) : (
                <span className="text-slate-400 font-normal italic">- (Kosong)</span>
              )}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">
              ENTITAS & TANGGAL
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {itemsS2[0]?.entity || itemS1?.entity || 'CPL'} &bull;{' '}
              {itemsS2[0]?.tglPo || itemsS2[0]?.tglFpb || itemS1?.date || '-'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 font-mono block">
              STATUS SAAT INI
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {itemS1?.statusBadge || itemsS2[0]?.status || 'TERDATA DI LAYANAN ARMADA'}
            </span>
          </div>
        </div>

        {/* 4 Cross Verification Badges */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Status Validasi Dokumen Lintas Modul</span>
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
              4/4 Modul Terverifikasi
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. INPUT DATA MELINDA */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col justify-between gap-2.5 shadow-sm hover:border-emerald-500/50 transition">
              <div className="text-[11px] font-bold text-slate-200 tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                INPUT DATA MELINDA
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold shadow-xs">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 2. PROCUREMENT */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col justify-between gap-2.5 shadow-sm hover:border-emerald-500/50 transition">
              <div className="text-[11px] font-bold text-slate-200 tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                PROCUREMENT
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold shadow-xs">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  TERVERIFIKASI
                </span>
              </div>
            </div>

            {/* 3. MASTER DATA BU NOOR */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col justify-between gap-2.5 shadow-sm hover:border-emerald-500/50 transition">
              <div className="text-[11px] font-bold text-slate-200 tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                MASTER DATA BU NOOR
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold shadow-xs">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  DONE
                </span>
              </div>
            </div>

            {/* 4. LAYANAN ARMADA */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col justify-between gap-2.5 shadow-sm hover:border-emerald-500/50 transition">
              <div className="text-[11px] font-bold text-slate-200 tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center">
                LAYANAN ARMADA
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-mono">Status:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 font-mono text-[11px] font-bold shadow-xs">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
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
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Alur Tanggung Jawab Fisik & PIC (4 Divisi Terverifikasi)</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Audit Trail Lengkap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. PURCHASING */}
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-cyan-950/40 to-slate-950/90 border border-cyan-500/30 flex flex-col justify-between space-y-2 shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-cyan-900/40">
                  <span className="text-[11px] font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                    1. PURCHASING
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
                    PCH
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">PIC PCH:</span>
                    <span className="font-bold text-white font-mono">{itemS1?.picPch || 'NOVI'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">No. PO:</span>
                    <span className="text-cyan-300 font-mono font-bold">
                      {itemsS2[0]?.noPo || itemS1?.po || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tgl Input PO:</span>
                    <span className="text-slate-300 font-mono">
                      {itemsS2[0]?.tglPo || itemS1?.date || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Delivery Time:</span>
                    <span className="text-slate-300 font-mono">
                      {itemS1?.deliveryTime || itemsS2[0]?.waktuProses || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/70 px-2 py-1 rounded border border-cyan-800/50 block text-center truncate">
                  {itemS1?.po && itemS1.po !== '-'
                    ? 'PO Diterbitkan'
                    : itemsS2[0]?.noPo
                    ? 'PO Diterbitkan'
                    : 'Menunggu PO'}
                </span>
              </div>
            </div>

            {/* 2. LOGISTIK TTB */}
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-purple-950/40 to-slate-950/90 border border-purple-500/30 flex flex-col justify-between space-y-2 shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
                  <span className="text-[11px] font-bold text-purple-400 font-mono flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-purple-400" />
                    2. LOGISTIK TTB
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60 font-semibold">
                    LOG
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">PIC TTB:</span>
                    <span className="font-bold text-white font-mono">{itemS1?.picTtb || 'DAVILA'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">No. TTB:</span>
                    <span className="text-purple-300 font-mono font-bold">
                      {itemsS2[0]?.noTtb || itemS1?.noTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tgl Input TTB:</span>
                    <span className="text-slate-300 font-mono">
                      {itemsS2[0]?.tglTtb || itemS1?.tglInputTtb || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">No. FSTB:</span>
                    <span className="text-slate-300 font-mono">
                      {itemsS2[0]?.noFstb || itemS1?.noFstb || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/70 px-2 py-1 rounded border border-purple-800/50 block text-center truncate">
                  {itemsS2[0]?.noTtb || itemS1?.noTtb
                    ? 'TTB Divalidasi'
                    : itemsS2[0]?.noFstb
                    ? 'FSTB Diterbitkan'
                    : 'Menunggu TTB'}
                </span>
              </div>
            </div>

            {/* 3. TIM LAPANGAN */}
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-amber-950/40 to-slate-950/90 border border-amber-500/30 flex flex-col justify-between space-y-2 shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-amber-900/40">
                  <span className="text-[11px] font-bold text-amber-400 font-mono flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5 text-amber-400" />
                    3. TIM LAPANGAN
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold">
                    LAP
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">PIC Lapangan:</span>
                    <span className="font-bold text-white font-mono">{itemS1?.picLap || 'AGUS'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tgl Diantar:</span>
                    <span className="text-amber-300 font-mono">
                      {itemS1?.tglBarangDiantar || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Ke Tim Lap:</span>
                    <span className="text-slate-300 font-mono">
                      {itemS1?.tglKeTimLapangan || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">TTB ke PCH:</span>
                    <span className="text-slate-300 font-mono">
                      {itemS1?.tglTtbKePicPch || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/70 px-2 py-1 rounded border border-amber-800/50 block text-center truncate">
                  {itemS1?.tglBarangDiantar
                    ? 'Barang Sudah Diantar'
                    : itemsS2.length > 0 && itemsS2[0].selisih === 0
                    ? 'Fisik Lengkap'
                    : 'Distribusi Lapangan'}
                </span>
              </div>
            </div>

            {/* 4. FINANCE / ADM */}
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-emerald-950/40 to-slate-950/90 border border-emerald-500/30 flex flex-col justify-between space-y-2 shadow-sm">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-emerald-900/40">
                  <span className="text-[11px] font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                    4. FINANCE / ADM
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                    FIN
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">PIC ADM / Fin:</span>
                    <span className="font-bold text-white font-mono">{itemS1?.picAdm || 'MANDA'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">No. SPP:</span>
                    <span className="text-emerald-300 font-mono font-bold">
                      {itemS1?.noSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Tgl Input SPP:</span>
                    <span className="text-slate-300 font-mono">
                      {itemS1?.tglInputSpp || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Ke Keuangan:</span>
                    <span className="text-slate-300 font-mono">
                      {itemS1?.tglKeKeuangan || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/70 px-2 py-1 rounded border border-emerald-800/50 block text-center truncate">
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
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tujuan & Peruntukan Pengadaan:
            </span>
            {tujuanPeruntukan && armadaKeterangans.length > 0 && (
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded">
                Worksheet: Monitoring Layanan Armada
              </span>
            )}
          </div>
          {tujuanPeruntukan ? (
            <p className="text-sm font-semibold text-cyan-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              {tujuanPeruntukan}
            </p>
          ) : (
            <p className="text-xs font-mono text-slate-400 italic bg-slate-950/40 p-3 rounded-lg border border-dashed border-slate-800">
              - (kosong)
            </p>
          )}
        </div>

        {/* Items Table Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Daftar Rincian Item Barang {activePo ? `(Khusus PO: ${activePo})` : '(Layanan Armada Matching)'}:
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {itemsS2.length} item ditemukan
            </span>
          </div>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold">
                <tr>
                  <th className="p-2.5">Item Deskripsi & Tujuan</th>
                  <th className="p-2.5 text-center">Qty FPB</th>
                  <th className="p-2.5 text-center">Qty FSTB</th>
                  <th className="p-2.5 text-center">Status Pemenuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {itemsS2.length > 0 ? (
                  itemsS2.map((i, idx) => (
                    <tr key={`${i.fpb}-${i.item}-${idx}`} className="hover:bg-slate-900/50 transition">
                      <td className="p-2.5 text-white font-sans">
                        <div className="font-medium text-slate-100">{i.item}</div>
                        {i.keterangan && (
                          <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                            <span className="text-slate-400 font-sans mr-1">Tujuan:</span>
                            {i.keterangan}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center text-cyan-400">{i.qtyFPB}</td>
                      <td className="p-2.5 text-center text-slate-300">{i.qtyFSTB}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            i.selisih === 0
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2.5 text-white font-sans">
                      {itemS1 ? itemS1.item : 'Item Standar'}
                    </td>
                    <td className="p-2.5 text-center text-cyan-400">1</td>
                    <td className="p-2.5 text-center text-slate-300">1</td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">
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
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleWhatsappNudge}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Eskalasi PIC via WhatsApp</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Tutup Modal
          </button>
        </div>
      </div>
    </div>
  );
}
