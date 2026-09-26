'use client';

import React, { useState, useMemo } from 'react';
import {
  Camera,
  ExternalLink,
  Search,
  Filter,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Settings,
  Boxes,
  Anchor,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { ArmadaItem, ProcurementItem, EntityCode } from '@/types/procurement';
import {
  extractFstbLast5,
  openTimemarkWithFstb,
  getTimemarkPortalUrl,
  setTimemarkPortalUrl,
  DEFAULT_TIMEMARK_PORTAL_URL,
} from '@/utils/timemark';
import TimemarkModal from './TimemarkModal';

interface TimemarkTabProps {
  armadaItems: ArmadaItem[];
  procurementItems: ProcurementItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface FstbRecord {
  id: string;
  noFstb: string;
  shortCode: string;
  tglFstb?: string;
  fpb: string;
  noPo?: string;
  armada?: string;
  item: string;
  qtyFSTB?: number;
  satuan?: string;
  entity?: string;
  picLap?: string;
  picTtb?: string;
  status?: string;
}

export default function TimemarkTab({
  armadaItems,
  procurementItems,
  onOpenAudit,
  showToast,
}: TimemarkTabProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal Detail TimeMark state
  const [selectedFstbRecord, setSelectedFstbRecord] = useState<FstbRecord | null>(null);

  // Settings URL state
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [portalUrl, setPortalUrlState] = useState<string>(getTimemarkPortalUrl());
  const [customInputUrl, setCustomInputUrl] = useState<string>(getTimemarkPortalUrl());

  // Aggregate all unique FSTB records from Armada and Procurement
  const allFstbRecords: FstbRecord[] = useMemo(() => {
    const map = new Map<string, FstbRecord>();

    // 1. From Armada Items
    armadaItems.forEach((it, idx) => {
      if (it.noFstb && it.noFstb.trim() && it.noFstb.trim() !== '-') {
        const fstbClean = it.noFstb.trim();
        const shortCode = extractFstbLast5(fstbClean);
        const key = `${fstbClean}__${it.fpb}__${it.item}`;
        if (!map.has(key)) {
          map.set(key, {
            id: `arm-${idx}-${fstbClean}`,
            noFstb: fstbClean,
            shortCode,
            tglFstb: it.tglFstb,
            fpb: it.fpb,
            noPo: it.noPo && it.noPo !== '-' ? it.noPo : undefined,
            armada: it.armada,
            item: it.item,
            qtyFSTB: it.qtyFSTB,
            satuan: it.satuan,
            entity: it.entity || 'CPL',
            picLap: it.picLap,
            picTtb: it.picTtb,
            status: it.status,
          });
        }
      }
    });

    // 2. From Procurement Items
    procurementItems.forEach((it, idx) => {
      if (it.noFstb && it.noFstb.trim() && it.noFstb.trim() !== '-') {
        const fstbClean = it.noFstb.trim();
        const shortCode = extractFstbLast5(fstbClean);
        const key = `${fstbClean}__${it.fpb}__${it.item}`;
        if (!map.has(key)) {
          map.set(key, {
            id: `proc-${idx}-${fstbClean}`,
            noFstb: fstbClean,
            shortCode,
            tglFstb: it.tglInputFstb || it.tglFstb,
            fpb: it.fpb,
            noPo: it.po && it.po !== '-' ? it.po : undefined,
            armada: it.deptArmada,
            item: it.item,
            qtyFSTB: it.qtyFSTB,
            satuan: it.satuan,
            entity: it.entity || 'CPL',
            picLap: it.picLap,
            picTtb: it.picTtb,
            status: it.statusBadge,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [armadaItems, procurementItems]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    let list = [...allFstbRecords];

    if (selectedEntity !== 'ALL') {
      list = list.filter((r) => r.entity?.trim().toUpperCase() === selectedEntity);
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.shortCode.toLowerCase().includes(q) ||
          r.noFstb.toLowerCase().includes(q) ||
          r.fpb?.toLowerCase().includes(q) ||
          r.noPo?.toLowerCase().includes(q) ||
          r.armada?.toLowerCase().includes(q) ||
          r.item?.toLowerCase().includes(q) ||
          r.picLap?.toLowerCase().includes(q) ||
          r.picTtb?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allFstbRecords, selectedEntity, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Statistics
  const totalFstbCount = allFstbRecords.length;
  const distinctArmadaCount = useMemo(() => {
    return new Set(allFstbRecords.map((r) => r.armada).filter(Boolean)).size;
  }, [allFstbRecords]);
  const distinctEntities = useMemo(() => {
    return Array.from(new Set(allFstbRecords.map((r) => r.entity).filter(Boolean)));
  }, [allFstbRecords]);

  const handleCopyCode = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast?.(`Kode "${code}" berhasil disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      showToast?.('Gagal menyalin kode ke clipboard.', 'warning');
    }
  };

  const handleOpenTimemarkDirect = (e: React.MouseEvent, fstb: string) => {
    e.stopPropagation();
    openTimemarkWithFstb(fstb, showToast);
  };

  const handleSaveConfig = () => {
    let target = customInputUrl.trim();
    if (!target) {
      target = DEFAULT_TIMEMARK_PORTAL_URL;
    } else if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    setTimemarkPortalUrl(target);
    setPortalUrlState(target);
    setIsConfigOpen(false);
    showToast?.('URL Portal TimeMark berhasil diperbarui!', 'success');
  };

  const handleResetConfig = () => {
    setTimemarkPortalUrl(DEFAULT_TIMEMARK_PORTAL_URL);
    setPortalUrlState(DEFAULT_TIMEMARK_PORTAL_URL);
    setCustomInputUrl(DEFAULT_TIMEMARK_PORTAL_URL);
    setIsConfigOpen(false);
    showToast?.('URL Portal TimeMark dikembalikan ke default.', 'info');
  };

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════
          1. HEADER & KPI CARDS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <span>Portal Verifikasi Foto TimeMark</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold">
                FSTB 5 Digit
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Hubungkan kode FSTB fisik dengan dokumentasi foto serah terima barang & watermark GPS lapangan.
            </p>
          </div>
        </div>

        {/* Quick Portal Action & Settings */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1.5 transition"
            title="Konfigurasi URL Portal TimeMark"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Pengaturan URL</span>
          </button>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs"
            title="Buka portal TimeMark web langsung"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Buka Portal TimeMark</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* Collapsible Config Portal URL */}
      {isConfigOpen && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Konfigurasi Tautan Portal Web TimeMark Tim Anda:</span>
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">Tersimpan di peramban</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customInputUrl}
              onChange={(e) => setCustomInputUrl(e.target.value)}
              placeholder="https://teamspace.timemark.com"
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetConfig}
                className="h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
              >
                Simpan Tautan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-muted-foreground font-medium block">Total FSTB Terdata</span>
          <div className="text-xl font-bold font-mono text-foreground">
            {totalFstbCount.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-muted-foreground">Baris transaksi berkas FSTB</span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-muted-foreground font-medium block">Siap Cek Foto</span>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {totalFstbCount.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Kode 5 digit belakang tervalidasi</span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-muted-foreground font-medium block">Unit Armada Aktif</span>
          <div className="text-xl font-bold font-mono text-foreground">
            {distinctArmadaCount}
          </div>
          <span className="text-[10px] text-muted-foreground">Kapal / unit operasional</span>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 shadow-xs">
          <span className="text-[11px] text-muted-foreground font-medium block">Portal TimeMark</span>
          <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 truncate">
            {portalUrl.replace(/^https?:\/\//, '')}
          </div>
          <span className="text-[10px] text-muted-foreground">Status tautan 1-klik aktif</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          2. FILTER & SEARCH CONTROLS
          ═══════════════════════════════════════════════════════════════ */}
      <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari 5 digit FSTB (contoh: 04044), nomor FPB, nomor PO, nama armada, atau barang..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Entity Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedEntity('ALL');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition ${
                selectedEntity === 'ALL'
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua Entitas
            </button>
            {['CPL', 'PPI', 'HL', 'GAJ', 'MIL', 'SP', 'SSK', 'MO'].map((ent) => (
              <button
                key={ent}
                type="button"
                onClick={() => {
                  setSelectedEntity(ent);
                  setCurrentPage(1);
                }}
                className={`h-7 px-2.5 rounded-md text-[11px] font-mono font-medium transition ${
                  selectedEntity === ent
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                }`}
              >
                {ent}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          3. FSTB & TIMEMARK DATA TABLE
          ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th className="p-3">Kode 5 Digit TimeMark</th>
                <th className="p-3">Nomor FSTB Lengkap</th>
                <th className="p-3">No. FPB & PO</th>
                <th className="p-3">Armada & Entitas</th>
                <th className="p-3">Deskripsi Barang & Qty</th>
                <th className="p-3">PIC Lapangan & TTB</th>
                <th className="p-3 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Camera className="w-8 h-8 text-muted-foreground/40" />
                      <p className="font-medium text-foreground">Tidak ada data FSTB yang cocok.</p>
                      <p className="text-[11px] text-muted-foreground">
                        Pastikan Anda telah mengunggah file Excel monitoring yang memiliki data nomor FSTB.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row) => {
                  const isCopied = copiedCode === row.shortCode;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedFstbRecord(row)}
                      className="hover:bg-muted/30 cursor-pointer transition group"
                    >
                      {/* 1. 5 Digit Shortcode Highlight */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            {row.shortCode || '-'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(e, row.shortCode)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Salin 5 digit kode ke clipboard"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 2. Full FSTB Number */}
                      <td className="p-3 whitespace-nowrap font-mono text-xs">
                        <span className="font-semibold text-foreground block">
                          {row.noFstb}
                        </span>
                        {row.tglFstb && (
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Tgl: {row.tglFstb}
                          </span>
                        )}
                      </td>

                      {/* 3. FPB & PO */}
                      <td className="p-3 whitespace-nowrap font-mono text-xs">
                        <div className="space-y-0.5">
                          <span className="text-foreground font-medium block">
                            {row.fpb}
                          </span>
                          <span className="text-muted-foreground text-[11px] block">
                            PO: {row.noPo || '-'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Armada & Entity */}
                      <td className="p-3">
                        <div className="font-medium text-foreground text-xs">
                          {row.armada || '-'}
                        </div>
                        <span className="inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border mt-0.5">
                          {row.entity}
                        </span>
                      </td>

                      {/* 5. Barang & Qty */}
                      <td className="p-3 max-w-[260px]">
                        <div className="font-medium text-xs text-foreground truncate" title={row.item}>
                          {row.item}
                        </div>
                        {row.qtyFSTB !== undefined && row.qtyFSTB > 0 && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            Qty FSTB: <strong>{row.qtyFSTB.toLocaleString('id-ID')}</strong> {row.satuan || ''}
                          </span>
                        )}
                      </td>

                      {/* 6. PIC Lapangan & TTB */}
                      <td className="p-3 text-[11px] font-mono whitespace-nowrap">
                        <div className="text-muted-foreground">
                          LAP: <strong className="text-foreground">{row.picLap || '-'}</strong>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          TTB: <strong className="text-foreground">{row.picTtb || '-'}</strong>
                        </div>
                      </td>

                      {/* 7. Action Buttons */}
                      <td className="p-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenTimemarkDirect(e, row.noFstb)}
                            className="h-7 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                            title={`Salin kode ${row.shortCode} dan buka portal TimeMark`}
                          >
                            <Camera className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Buka Foto ({row.shortCode})</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          {onOpenAudit && (
                            <button
                              type="button"
                              onClick={() => onOpenAudit(row.fpb, row.noPo)}
                              className="h-7 px-2 bg-background hover:bg-muted border border-border text-foreground rounded-lg text-xs font-medium transition"
                              title="Buka detail audit FPB"
                            >
                              Detail
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredRecords.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border text-xs text-muted-foreground">
            <div>
              Menampilkan{' '}
              <strong className="text-foreground">
                {((currentPage - 1) * pageSize + 1).toLocaleString('id-ID')}
              </strong>{' '}
              -{' '}
              <strong className="text-foreground">
                {Math.min(currentPage * pageSize, filteredRecords.length).toLocaleString('id-ID')}
              </strong>{' '}
              dari{' '}
              <strong className="text-foreground">
                {filteredRecords.length.toLocaleString('id-ID')}
              </strong>{' '}
              item berkas FSTB
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px]">Halaman:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-40 transition"
                  title="Halaman pertama"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-40 transition"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-foreground font-semibold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-40 transition"
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-md hover:bg-muted disabled:opacity-40 transition"
                  title="Halaman terakhir"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pop-up Box: Verifikasi Bukti Foto TimeMark */}
      {selectedFstbRecord && (
        <TimemarkModal
          isOpen={!!selectedFstbRecord}
          onClose={() => setSelectedFstbRecord(null)}
          noFstb={selectedFstbRecord.noFstb}
          fpb={selectedFstbRecord.fpb}
          armada={selectedFstbRecord.armada}
          item={selectedFstbRecord.item}
          showToast={showToast}
        />
      )}
    </div>
  );
}
