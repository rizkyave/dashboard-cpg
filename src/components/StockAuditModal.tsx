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
} from 'lucide-react';
import { InventoryItem } from '@/types/procurement';
import { determineCategory } from '@/utils/categoryClassifier';

interface RequestedItem {
  id: string;
  name: string;
  code?: string;
  qty: number;
  unit: string;
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
  const matchedAnalysis = useMemo(() => {
    return requestedItems.map((req) => {
      const cleanReqName = (req.name || '').toUpperCase().trim();
      const cleanReqCode = (req.code || '').toUpperCase().trim();
      const words = cleanReqName
        .split(/[\s,./\-_()]+/)
        .filter(
          (w) =>
            w.length >= 3 &&
            !['DAN', 'UNTUK', 'DENGAN', 'SET', 'THE', 'PCS', 'UNIT', 'KAPAL'].includes(w)
        );

      const candidateMatches = inventoryItems
        .map((it) => {
          let score = 0;
          const itCode = String(it.itemCode || '').toUpperCase().trim();
          const itDesc = String(it.description || '').toUpperCase().trim();

          // Code match has highest weight
          if (cleanReqCode && itCode === cleanReqCode) {
            score += 100;
          } else if (cleanReqCode && itCode.includes(cleanReqCode)) {
            score += 65;
          }

          // Description matches
          if (itDesc === cleanReqName) {
            score += 95;
          } else if (itDesc.includes(cleanReqName) || cleanReqName.includes(itDesc)) {
            score += 75;
          } else if (words.length > 0) {
            let matchedWords = 0;
            for (const w of words) {
              if (itDesc.includes(w)) matchedWords++;
            }
            if (matchedWords > 0) {
              score += 30 + Math.round((matchedWords / words.length) * 45);
            }
          }

          return { item: it, score };
        })
        .filter((res) => res.score >= 30)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.item.quantity - a.item.quantity;
        })
        .slice(0, 3);

      const bestMatch = candidateMatches[0]?.item || null;
      const totalWarehouseStock = candidateMatches.reduce((acc, c) => acc + c.item.quantity, 0);
      const isAvailable = bestMatch ? bestMatch.quantity > 0 : false;
      const isFullStock = bestMatch ? bestMatch.quantity >= req.qty : false;

      return {
        requested: req,
        bestMatch,
        candidateMatches: candidateMatches.map((c) => c.item),
        totalWarehouseStock,
        isAvailable,
        isFullStock,
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
        readyPercentage: 0,
        leadTimeSaved: '0 Hari',
        actionAdvice: 'Cek lampiran fisik berkas FPB',
      };
    }

    const availableCount = matchedAnalysis.filter((m) => m.isAvailable).length;
    const totalCount = matchedAnalysis.length;
    const readyPercentage = Math.round((availableCount / totalCount) * 100);

    if (readyPercentage === 100) {
      return {
        status: 'FULL_READY',
        badge: 'BISA ALOKASI DARI GUDANG 100%',
        color: 'emerald',
        title: 'Rekomendasi: Alokasi Langsung dari Gudang Eksisting',
        description: `Seluruh (${totalCount}/${totalCount}) barang yang diajukan dalam FPB ini teridentifikasi memiliki stok fisik siap pakai di gudang konsolidasi Accurate. Disarankan langsung menerbitkan FSTB pengeluaran logistik tanpa perlu mengajukan Purchase Order (PO) baru ke supplier rekanan.`,
        readyPercentage: 100,
        leadTimeSaved: 'Hemat 3 - 7 Hari',
        actionAdvice: 'Terbitkan FSTB & Hubungi Logistik Lapangan Somber',
      };
    } else if (availableCount > 0) {
      return {
        status: 'PARTIAL_READY',
        badge: 'STOK TERSEDIA SEBAGIAN',
        color: 'amber',
        title: 'Rekomendasi: Alokasi Parsial & Proses PO Selisih Kebutuhan',
        description: `${availableCount} dari ${totalCount} item memiliki stok di gudang. Segera alokasikan stok yang tersedia untuk mencegah berhentinya operasional kapal ${armadaName}, lalu terbitkan PO baru hanya untuk sisa item yang belum tercukupi.`,
        readyPercentage,
        leadTimeSaved: 'Hemat 2 - 4 Hari',
        actionAdvice: 'Kombinasi FSTB Parsial + PO Tambahan',
      };
    } else {
      return {
        status: 'OUT_OF_STOCK',
        badge: 'STOK KOSONG (0) - WAJIB PO',
        color: 'rose',
        title: 'Rekomendasi: Segera Proses Purchase Order (PO) Prioritas',
        description: `Tidak ditemukan stok fisik yang mencukupi di gudang CPL, Hana Lines, maupun Mandar Ocean untuk barang yang diminta. Berkas perlu diprioritaskan oleh tim Purchasing untuk segera diverifikasi dan diterbitkan PO ke vendor.`,
        readyPercentage: 0,
        leadTimeSaved: 'Standar Vendor SLA (3-5 Hari)',
        actionAdvice: 'Terbitkan PO ke Vendor Rekanan Terdaftar',
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
Tingkat Kesiapan Stok: ${aiDecision.readyPercentage}%
Rekomendasi Aksi: ${aiDecision.actionAdvice}
Catatan: ${aiDecision.description}

Daftar Barang & Stok:
${matchedAnalysis
  .map(
    (m, i) =>
      `${i + 1}. ${m.requested.name} (FPB: ${m.requested.qty} ${m.requested.unit}) -> Stok Gudang: ${
        m.bestMatch
          ? `${m.bestMatch.description} [${m.bestMatch.perusahaan}] = ${m.bestMatch.quantity.toLocaleString('id-ID')} unit`
          : 'Tidak Ada Stok di Gudang'
      }`
  )
  .join('\n')}

Sumber: Accurate Accounting System (10.049 Item Konsolidasi)`;

    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    showToast?.('Ringkasan rekomendasi berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedText(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-card border border-border rounded-2xl max-w-4xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Boxes className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-foreground truncate">
                  Pengecekan Stok Gudang & Hasil Analisis
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Accurate 10k Items
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* SECTION 1: STOCK ADVISORY BANNER & KEY DECISION */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              aiDecision.color === 'emerald'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : aiDecision.color === 'amber'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-amber-500" />
                <span className="font-bold text-sm tracking-tight text-foreground">
                  {aiDecision.title}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] self-start sm:self-auto border ${
                  aiDecision.color === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : aiDecision.color === 'amber'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                {aiDecision.badge}
              </span>
            </div>

            <p className="mt-2.5 text-xs text-foreground leading-relaxed">
              {aiDecision.description}
            </p>

            {/* 3 Quick Takeaway Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-border/40">
              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                  <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Kesiapan Stok Gudang
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {aiDecision.readyPercentage}% Siap
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                  <Clock className="size-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Efisiensi Lead Time
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {aiDecision.leadTimeSaved}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                  <Coins className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    Rekomendasi Dokumen
                  </span>
                  <span className="font-semibold text-xs text-foreground truncate block">
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
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border select-none uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Item Diminta (FPB)</th>
                      <th className="py-2.5 px-3 text-center w-24">Qty FPB</th>
                      <th className="py-2.5 px-3">Hasil Cocok di Gudang Accurate</th>
                      <th className="py-2.5 px-3 text-right w-28">Stok Gudang</th>
                      <th className="py-2.5 px-3 text-center w-28">Status & Aksi</th>
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
                            <td className="py-3 px-3 text-center font-mono text-muted-foreground text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-foreground block">
                                {row.requested.name}
                              </span>
                              {row.requested.code && (
                                <span className="font-mono text-[10px] text-muted-foreground block">
                                  Ref: {row.requested.code}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-foreground">
                              {row.requested.qty.toLocaleString('id-ID')} {row.requested.unit}
                            </td>
                            <td className="py-3 px-3">
                              {row.bestMatch ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground">
                                      {row.bestMatch.description}
                                    </span>
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                      {row.bestMatch.itemCode}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Building2 className="size-3 text-muted-foreground" />
                                      {row.bestMatch.perusahaan}
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                      Kategori:{' '}
                                      {row.bestMatch.category ||
                                        determineCategory(
                                          row.bestMatch.itemCode,
                                          row.bestMatch.description,
                                          row.bestMatch.itemType
                                        )}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  Tidak ada barang serupa di katalog Accurate
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {row.bestMatch ? (
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
                                  <span className="text-[10px] text-muted-foreground">
                                    {row.bestMatch.quantity > 0 ? 'Tersedia' : 'Habis (0)'}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {row.isFullStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  <CheckCircle2 className="size-3 shrink-0" />
                                  Alokasi FSTB
                                </span>
                              ) : row.isAvailable ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                  <AlertTriangle className="size-3 shrink-0" />
                                  Parsial / PO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                  <PackageX className="size-3 shrink-0" />
                                  Wajib PO
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
                  quickSearchResults.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground truncate">
                            {item.description}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({item.itemCode})
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {item.perusahaan} &bull;{' '}
                          {item.category ||
                            determineCategory(item.itemCode, item.description, item.itemType)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
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
                      </div>
                    </div>
                  ))
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
              className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <Copy className="size-3.5 text-primary" />
              <span>Salin Rekomendasi</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-foreground text-background font-semibold transition active:scale-95 shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
