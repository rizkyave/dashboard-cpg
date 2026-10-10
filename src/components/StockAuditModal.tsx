'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Search,
  Copy,
  Check,
  Building2,
  Clock,
  Coins,
  PackageCheck,
  PackageX,
  FileSpreadsheet,
  Wrench,
  FileText,
  ClipboardCheck,
  Printer,
} from 'lucide-react';
import { InventoryItem } from '@/types/procurement';
import { determineCategory } from '@/utils/categoryClassifier';
import { isItemJasa, normalizeJasaUnit } from '@/utils/jasaClassifier';

interface RequestedItem {
  id: string;
  name: string;
  code?: string;
  qty: number;
  unit: string;
  rawUnit?: string;
}

interface StockAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  fpbNumber: string;
  armadaName?: string;
  requestedItems: RequestedItem[];
  inventoryItems: InventoryItem[];
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function StockAuditModal({
  isOpen,
  onClose,
  fpbNumber,
  armadaName = 'Armada Kapal',
  requestedItems,
  inventoryItems,
  showToast,
}: StockAuditModalProps) {
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [quickSearch, setQuickSearch] = useState<string>('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('ALL');

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Match each requested item against the 10,049 inventory items
  // Aturan: Hanya cocokkan jika kode barang/ref sama persis (tidak ada pencocokan fuzzy deskripsi)
  const matchedAnalysis = useMemo(() => {
    return requestedItems.map((req) => {
      const cleanReqCode = (req.code || '')
        .replace(/^REF:\s*/i, '')
        .trim()
        .toUpperCase();

      // Deteksi apakah item yang diminta merupakan kategori Jasa
      const reqIsJasa = isItemJasa({
        code: req.code,
        name: req.name,
        unit: req.unit,
      });

      // Hanya cocok jika memiliki kode/ref yang valid dan sama persis dengan itemCode di katalog Accurate
      const candidateMatches =
        cleanReqCode && cleanReqCode !== '-'
          ? inventoryItems
              .filter((it) => {
                const itCode = String(it.itemCode || '')
                  .replace(/^REF:\s*/i, '')
                  .trim()
                  .toUpperCase();
                return itCode === cleanReqCode;
              })
              .sort((a, b) => b.quantity - a.quantity)
          : [];

      const bestMatch = candidateMatches[0] || null;

      const bestMatchIsJasa = bestMatch
        ? bestMatch.category === 'Jasa' ||
          determineCategory(bestMatch.itemCode, bestMatch.description, bestMatch.itemType) === 'Jasa' ||
          isItemJasa({ code: bestMatch.itemCode, name: bestMatch.description, category: bestMatch.category })
        : false;

      const isJasa = reqIsJasa || bestMatchIsJasa;

      // Normalisasi satuan operasional jika item adalah Jasa (misal: 'PCS' -> 'unit'/'alat'/'job')
      const displayUnit = isJasa ? normalizeJasaUnit(req.unit, req.name) : req.unit || 'unit';

      // PENTING: Layanan Jasa tidak memiliki wujud fisik di rak gudang logistik!
      // Nilai kuantitas di Accurate untuk master jasa hanyalah pencatatan non-stok/non-fisik.
      const rawWarehouseStock = candidateMatches.reduce((acc, c) => acc + c.quantity, 0);
      const totalWarehouseStock = isJasa ? 0 : rawWarehouseStock;
      const isAvailable = isJasa ? false : bestMatch ? totalWarehouseStock > 0 : false;
      const isFullStock = isJasa ? false : bestMatch ? totalWarehouseStock >= req.qty : false;

      return {
        requested: {
          ...req,
          unit: displayUnit,
          rawUnit: req.rawUnit || req.unit,
        },
        bestMatch,
        candidateMatches,
        rawWarehouseStock,
        totalWarehouseStock,
        isAvailable,
        isFullStock,
        isJasa,
      };
    });
  }, [requestedItems, inventoryItems]);

  // Overall Evaluation & Decision
  const aiDecision = useMemo(() => {
    if (matchedAnalysis.length === 0) {
      return {
        status: 'EMPTY',
        badge: 'DATA BARANG NIHIL',
        color: 'slate',
        title: 'Belum Ada Data Rincian Barang',
        description:
          'Daftar barang pada berkas FPB ini belum teridentifikasi. Silakan gunakan fitur pencarian cepat di bawah untuk mengecek stok barang gudang.',
        readinessLabel: 'Kesiapan Stok Gudang',
        readinessValue: '0% Siap',
        leadTimeSaved: '0 Hari',
        docLabel: 'Rekomendasi Dokumen',
        actionAdvice: 'Cek lampiran fisik berkas FPB',
      };
    }

    const totalCount = matchedAnalysis.length;
    const jasaCount = matchedAnalysis.filter((m) => m.isJasa).length;
    const physicalItems = matchedAnalysis.filter((m) => !m.isJasa);
    const availablePhysicalCount = physicalItems.filter((m) => m.isAvailable).length;

    // KASUS 1: SELURUH PERMINTAAN ADALAH LAYANAN JASA (Pure Service Request)
    if (jasaCount === totalCount) {
      return {
        status: 'SERVICE_ONLY',
        badge: 'PENGADAAN JASA / SPK VENDOR',
        color: 'sky',
        title: 'Rekomendasi: Terbitkan SPK atau PO Jasa ke Vendor Rekanan',
        description: `Seluruh (${totalCount}/${totalCount}) permintaan dalam FPB ini teridentifikasi sebagai layanan non-fisik (Jasa). Layanan jasa tidak disimpan sebagai persediaan di rak gudang logistik dan tidak memerlukan pengeluaran fisik (FSTB). Disarankan tim Procurement segera menerbitkan Surat Perintah Kerja (SPK) atau Purchase Order (PO) Jasa kepada vendor / laboratorium kalibrasi rekanan terdaftar.`,
        readinessLabel: 'Kategori Pengadaan',
        readinessValue: 'Non-Fisik (Jasa)',
        leadTimeSaved: 'SLA Vendor (1 - 3 Hari)',
        docLabel: 'Rekomendasi Dokumen',
        actionAdvice: 'Terbitkan SPK / PO Jasa Vendor',
      };
    }

    // KASUS 2: KOMBINASI CAMPURAN (Hybrid: Barang Fisik + Layanan Jasa)
    if (jasaCount > 0 && physicalItems.length > 0) {
      const physicalReadyPercentage = Math.round((availablePhysicalCount / physicalItems.length) * 100);

      if (physicalReadyPercentage === 100) {
        return {
          status: 'HYBRID_READY',
          badge: 'KOMBINASI FSTB & SPK/PO JASA',
          color: 'indigo',
          title: 'Rekomendasi: Alokasi FSTB Gudang & Terbitkan SPK/PO Jasa',
          description: `Permintaan terdiri dari ${physicalItems.length} barang fisik dan ${jasaCount} layanan jasa. Stok barang fisik 100% siap di gudang (terbitkan FSTB), sedangkan layanan jasa harus diproses dengan penerbitan SPK atau PO Jasa ke vendor rekanan.`,
          readinessLabel: 'Kesiapan Stok Fisik',
          readinessValue: `${physicalReadyPercentage}% Siap (Fisik)`,
          leadTimeSaved: 'Hemat 3 - 5 Hari (Barang)',
          docLabel: 'Rekomendasi Dokumen',
          actionAdvice: 'FSTB (Barang) + SPK (Jasa)',
        };
      } else if (availablePhysicalCount > 0) {
        return {
          status: 'HYBRID_PARTIAL',
          badge: 'STOK FISIK PARSIAL + SPK/PO JASA',
          color: 'amber',
          title: 'Rekomendasi: FSTB Parsial + PO Barang + SPK/PO Jasa',
          description: `Terdapat ${availablePhysicalCount} dari ${physicalItems.length} barang fisik yang tersedia di gudang. Alokasikan barang yang ada dengan FSTB, proses PO untuk kekurangan barang, dan terbitkan SPK/PO Jasa untuk pekerjaan jasa.`,
          readinessLabel: 'Kesiapan Stok Fisik',
          readinessValue: `${physicalReadyPercentage}% Siap (Fisik)`,
          leadTimeSaved: 'Hemat 2 - 4 Hari',
          docLabel: 'Rekomendasi Dokumen',
          actionAdvice: 'Kombinasi FSTB + PO + SPK Jasa',
        };
      } else {
        return {
          status: 'HYBRID_PO',
          badge: 'PO BARANG & SPK JASA',
          color: 'rose',
          title: 'Rekomendasi: Proses PO Barang & SPK/PO Jasa ke Vendor',
          description: `Tidak ditemukan stok fisik gudang untuk barang yang diminta, dan terdapat ${jasaCount} item jasa. Disarankan segera memproses PO pengadaan barang dan SPK/PO Jasa ke vendor rekanan.`,
          readinessLabel: 'Kesiapan Stok Fisik',
          readinessValue: 'Stok Kosong (0%)',
          leadTimeSaved: 'Standar SLA (3 - 5 Hari)',
          docLabel: 'Rekomendasi Dokumen',
          actionAdvice: 'Proses PO Barang & SPK Jasa',
        };
      }
    }

    // KASUS 3: SELURUH PERMINTAAN ADALAH BARANG FISIK
    const readyPercentage = Math.round((availablePhysicalCount / totalCount) * 100);

    if (readyPercentage === 100) {
      return {
        status: 'FULL_READY',
        badge: 'BISA ALOKASI DARI GUDANG 100%',
        color: 'emerald',
        title: 'Rekomendasi: Alokasi Langsung dari Gudang Eksisting',
        description: `Seluruh (${totalCount}/${totalCount}) barang yang diajukan dalam FPB ini teridentifikasi memiliki stok fisik siap pakai di gudang konsolidasi Accurate. Disarankan langsung menerbitkan FSTB pengeluaran logistik tanpa perlu mengajukan Purchase Order (PO) baru ke supplier rekanan.`,
        readinessLabel: 'Kesiapan Stok Gudang',
        readinessValue: '100% Siap',
        leadTimeSaved: 'Hemat 3 - 7 Hari',
        docLabel: 'Rekomendasi Dokumen',
        actionAdvice: 'Terbitkan FSTB Pengeluaran Gudang',
      };
    } else if (availablePhysicalCount > 0) {
      return {
        status: 'PARTIAL_READY',
        badge: 'STOK TERSEDIA SEBAGIAN',
        color: 'amber',
        title: 'Rekomendasi: Alokasi Parsial & Proses PO Selisih Kebutuhan',
        description: `${availablePhysicalCount} dari ${totalCount} item memiliki stok di gudang. Segera alokasikan stok yang tersedia untuk mencegah berhentinya operasional kapal ${armadaName}, lalu terbitkan PO baru hanya untuk sisa item yang belum tercukupi.`,
        readinessLabel: 'Kesiapan Stok Gudang',
        readinessValue: `${readyPercentage}% Siap`,
        leadTimeSaved: 'Hemat 2 - 4 Hari',
        docLabel: 'Rekomendasi Dokumen',
        actionAdvice: 'Kombinasi FSTB Parsial + PO',
      };
    } else {
      return {
        status: 'OUT_OF_STOCK',
        badge: 'STOK KOSONG (0) - REKOMENDASI PENGADAAN',
        color: 'rose',
        title: 'Rekomendasi: Segera Proses Purchase Order (PO) Prioritas',
        description: `Tidak ditemukan stok fisik yang mencukupi di gudang CPL, Hana Lines, maupun Mandar Ocean untuk barang yang diminta. Berkas perlu diprioritaskan oleh tim Purchasing untuk segera diverifikasi dan diproses pengadaan ke vendor.`,
        readinessLabel: 'Kesiapan Stok Gudang',
        readinessValue: 'Stok Kosong (0%)',
        leadTimeSaved: 'Standar SLA (3 - 5 Hari)',
        docLabel: 'Rekomendasi Dokumen',
        actionAdvice: 'Proses PO ke Vendor Rekanan',
      };
    }
  }, [matchedAnalysis, armadaName]);

  // Quick live search across all 10,049 inventory items
  const quickSearchResults = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.toLowerCase().trim();

    return inventoryItems
      .filter((it) => {
        if (selectedCompanyFilter !== 'ALL' && it.perusahaan !== selectedCompanyFilter) {
          return false;
        }
        return (
          it.itemCode.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.perusahaan.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [quickSearch, inventoryItems, selectedCompanyFilter]);

  // Copy Summary to clipboard
  const handleCopyAiSummary = () => {
    const summaryText = `*RINGKASAN CEK STOK GUDANG & REKOMENDASI ANALISIS*
Berkas: ${fpbNumber}
Unit/Armada: ${armadaName}
Status: ${aiDecision.badge}
${aiDecision.readinessLabel}: ${aiDecision.readinessValue}
Efisiensi / Lead Time: ${aiDecision.leadTimeSaved}
Rekomendasi Dokumen: ${aiDecision.actionAdvice}
Catatan: ${aiDecision.description}

Daftar Barang & Analisis:
${matchedAnalysis
  .map((m, i) => {
    const stockReport = m.isJasa
      ? 'Non-Fisik (Layanan Jasa - Memerlukan SPK / PO Jasa Vendor)'
      : m.bestMatch
      ? `${m.bestMatch.description} [${m.bestMatch.perusahaan}] = ${m.bestMatch.quantity.toLocaleString('id-ID')} unit`
      : 'N/A (-)';
    return `${i + 1}. ${m.requested.name} (FPB: ${m.requested.qty} ${m.requested.unit}) -> ${stockReport}`;
  })
  .join('\n')}

Sumber: Accurate Accounting System & Klasifikasi Pengadaan`;

    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    showToast?.('Ringkasan rekomendasi berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedText(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 printable-modal-overlay">
      <div
        className="bg-card border border-border rounded-2xl max-w-4xl xl:max-w-5xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh] min-w-0 printable-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Boxes className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-bold text-base text-foreground truncate min-w-0">
                  Pengecekan Stok Gudang &amp; Hasil Analisis
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  Accurate 10k Items
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate min-w-0">
                Berkas: <strong className="text-foreground font-mono">{fpbNumber}</strong> &bull;
                Armada: <strong className="text-foreground">{armadaName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyAiSummary}
              className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              title="Salin ringkasan analisis untuk memo / WhatsApp"
            >
              {copiedText ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Salin Hasil</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
              title="Tutup (ESC)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs min-w-0">
          {/* SECTION 1: STOCK ADVISORY BANNER & KEY DECISION */}
          <div
            className={`p-4 rounded-xl border transition-all min-w-0 ${
              aiDecision.color === 'emerald'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : aiDecision.color === 'sky'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200'
                : aiDecision.color === 'indigo'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
                : aiDecision.color === 'amber'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40 min-w-0 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Sparkles className="size-4 shrink-0 text-amber-500" />
                <span className="font-bold text-sm tracking-tight text-foreground break-words min-w-0">
                  {aiDecision.title}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] self-start sm:self-auto border shrink-0 ${
                  aiDecision.color === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : aiDecision.color === 'sky'
                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30'
                    : aiDecision.color === 'indigo'
                    ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                    : aiDecision.color === 'amber'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                {aiDecision.badge}
              </span>
            </div>

            <p className="mt-2.5 text-xs text-foreground leading-relaxed break-words">
              {aiDecision.description}
            </p>

            {/* 3 Quick Takeaway Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-border/40 min-w-0">
              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
                  {aiDecision.color === 'sky' ? (
                    <Wrench className="size-4 text-sky-600 dark:text-sky-400" />
                  ) : (
                    <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {aiDecision.readinessLabel}
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground block break-words leading-tight">
                    {aiDecision.readinessValue}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
                  <Clock className="size-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground block truncate">
                    Efisiensi / Lead Time
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground block break-words leading-tight">
                    {aiDecision.leadTimeSaved}
                  </span>
                </div>
              </div>

              {/* Rekomendasi Dokumen: Ruang fleksibel tanpa truncate paksa agar teks utuh terbaca */}
              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-start gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
                  <Coins className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {aiDecision.docLabel}
                  </span>
                  <span
                    className="font-semibold text-xs text-foreground block leading-snug break-words"
                    title={aiDecision.actionAdvice}
                  >
                    {aiDecision.actionAdvice}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: MATCHING TABLE (FPB REQUEST VS WAREHOUSE STOCK) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="size-3.5 text-primary" />
                Daftar Barang FPB vs Hasil Pencocokan Gudang
              </h4>
              <span className="text-[11px] text-muted-foreground font-mono">
                {matchedAnalysis.length} item permintaan
              </span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden shadow-xs bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border select-none uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center whitespace-nowrap">No</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Item Diminta (FPB)</th>
                      <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">Qty FPB</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Hasil Cocok di Gudang Accurate</th>
                      <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Stok Gudang</th>
                      <th className="py-2.5 px-3 text-center min-w-[150px] whitespace-nowrap">Status &amp; Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matchedAnalysis.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          <PackageX className="size-6 mx-auto mb-1 opacity-50" />
                          <p>Tidak ada rincian barang yang dapat dicocokkan untuk berkas ini.</p>
                        </td>
                      </tr>
                    ) : (
                      matchedAnalysis.map((row, idx) => {
                        return (
                          <tr key={row.requested.id || idx} className="hover:bg-muted/30 transition">
                            <td className="py-3 px-3 text-center font-mono text-muted-foreground text-[11px] whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 min-w-[180px] max-w-[280px] break-words">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground break-words">
                                  {row.requested.name}
                                </span>
                                {row.isJasa && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold shrink-0"
                                    title="Item Kategori Jasa (Layanan Non-Fisik)"
                                  >
                                    <Wrench className="size-2.5" />
                                    JASA
                                  </span>
                                )}
                              </div>
                              {row.requested.code && (
                                <span className="font-mono text-[10px] text-muted-foreground block truncate">
                                  Ref: {row.requested.code}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-foreground whitespace-nowrap">
                              {row.requested.qty.toLocaleString('id-ID')} {row.requested.unit}
                              {row.isJasa &&
                                row.requested.rawUnit &&
                                ['PCS', 'PC', 'BUAH', 'BH'].includes(row.requested.rawUnit.toUpperCase()) && (
                                  <span
                                    className="block text-[9px] font-normal text-muted-foreground"
                                    title="Satuan standar operasional untuk pekerjaan/alat (mengoreksi input PCS)"
                                  >
                                    (standar: {row.requested.unit})
                                  </span>
                                )}
                            </td>
                            <td className="py-3 px-3 min-w-[220px] max-w-[320px] break-words">
                              {row.bestMatch ? (
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className="font-semibold text-foreground break-words">
                                      {row.bestMatch.description}
                                    </span>
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border shrink-0">
                                      {row.bestMatch.itemCode}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap min-w-0">
                                    <span className="flex items-center gap-1 shrink-0">
                                      <Building2 className="size-3 text-muted-foreground" />
                                      {row.bestMatch.perusahaan}
                                    </span>
                                    <span>&bull;</span>
                                    <span className="truncate">
                                      Kategori:{' '}
                                      <span className={row.isJasa ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                        {row.bestMatch.category ||
                                          determineCategory(
                                            row.bestMatch.itemCode,
                                            row.bestMatch.description,
                                            row.bestMatch.itemType
                                          )}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-xs text-muted-foreground">
                                  N/A
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {row.isJasa ? (
                                <div>
                                  <span className="font-semibold text-xs text-sky-600 dark:text-sky-400 block">
                                    Non-Fisik
                                  </span>
                                  <span
                                    className="text-[10px] text-muted-foreground block"
                                    title="Layanan jasa tidak disimpan di rak gudang logistik"
                                  >
                                    Layanan Jasa (Non-Stok)
                                  </span>
                                </div>
                              ) : row.bestMatch ? (
                                <div>
                                  <span
                                    className={`font-mono font-bold text-sm block ${
                                      row.bestMatch.quantity > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {row.bestMatch.quantity.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
                                    {row.bestMatch.quantity > 0 ? 'Tersedia' : 'Habis (0)'}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono font-semibold text-muted-foreground text-sm">-</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {row.isJasa ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 shrink-0">
                                  <ClipboardCheck className="size-3 shrink-0" />
                                  Proses SPK / PO Jasa
                                </span>
                              ) : row.isFullStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                                  <CheckCircle2 className="size-3 shrink-0" />
                                  Alokasi FSTB
                                </span>
                              ) : row.isAvailable ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
                                  <AlertTriangle className="size-3 shrink-0" />
                                  Parsial / PO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 shrink-0">
                                  <PackageX className="size-3 shrink-0" />
                                  Rekomendasi Pengadaan
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 3: QUICK SEARCH & LOOKUP ACROSS 10,049 INVENTORY ITEMS */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Search className="size-3.5 text-primary" />
                  Cari Suku Cadang atau Barang Pengganti di Gudang:
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Ingin mengecek spesifikasi lain atau stok alternatif? Ketik kata kunci untuk mencari
                  di 10.049 item Accurate.
                </p>
              </div>

              {/* Company filter for search */}
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg bg-background border border-border text-foreground font-medium self-start sm:self-auto"
              >
                <option value="ALL">Semua Perusahaan</option>
                <option value="PT CINDARA PRATAMA LINES">PT Cindara Pratama Lines (CPL)</option>
                <option value="PT MANDAR OCEAN">PT Mandar Ocean (MO)</option>
                <option value="PT HANA LINES">PT Hana Lines (HL)</option>
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Ketik no. barang atau nama (contoh: BIOSOLAR, MEDITRAN, FILTER, AKI, CAT)..."
                className="w-full h-9 pl-9 pr-8 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {quickSearch && (
                <button
                  onClick={() => setQuickSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Quick Search Results List */}
            {quickSearch.trim() !== '' && (
              <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
                {quickSearchResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-3 text-[11px]">
                    Tidak ditemukan barang dengan kata kunci &ldquo;{quickSearch}&rdquo;.
                  </p>
                ) : (
                  quickSearchResults.map((item) => {
                    const itIsJasa =
                      item.category === 'Jasa' ||
                      determineCategory(item.itemCode, item.description, item.itemType) === 'Jasa' ||
                      isItemJasa({ code: item.itemCode, name: item.description, category: item.category });
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between gap-3 text-xs min-w-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-bold text-foreground truncate max-w-full">
                              {item.description}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                              ({item.itemCode})
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {item.perusahaan} &bull;{' '}
                            <span className={itIsJasa ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                              {item.category ||
                                determineCategory(item.itemCode, item.description, item.itemType)}
                            </span>
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          {itIsJasa ? (
                            <div>
                              <span className="font-semibold text-xs text-sky-600 dark:text-sky-400 block">
                                Non-Fisik
                              </span>
                              <span className="block text-[9px] text-muted-foreground font-medium">
                                Layanan Jasa (Non-Stok)
                              </span>
                            </div>
                          ) : (
                            <>
                              <span
                                className={`font-mono font-bold text-xs ${
                                  item.quantity > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {item.quantity.toLocaleString('id-ID')} unit
                              </span>
                              <span
                                className={`block text-[9px] font-semibold ${
                                  item.quantity > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {item.quantity > 0 ? 'Siap Pakai' : 'Stok 0'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0 text-xs">
          <span className="text-muted-foreground text-[11px] hidden sm:inline">
            Status: Data disinkronkan dengan modul persediaan Accurate
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCopyAiSummary}
              className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs print:hidden"
            >
              <Copy className="size-3.5 text-primary" />
              <span>Salin Rekomendasi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="h-8 px-3.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer print:hidden"
              title="Cetak atau simpan modul ini ke format PDF"
            >
              <Printer className="size-3.5 text-primary" />
              <span>Print PDF</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-foreground text-background font-bold tracking-wide transition active:scale-95 shadow-xs cursor-pointer print:hidden"
            >
              TUTUP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
