'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSignature,
  FileText,
  FileCheck2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ShoppingBag,
  PackageCheck,
  Truck,
  ShieldCheck,
  ExternalLink,
  Download,
  Copy,
  Check,
  Boxes,
  Ship,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  DocumentValidationRecord,
  ValidationSummaryMetrics,
  OverallValidationStatus,
} from '@/types/documentValidation';
import ValidationSignatureModal from './ValidationSignatureModal';
import FstbValidationModal from './FstbValidationModal';
import { useAuth } from '@/context/AuthContext';

export interface ValidasiDokumenTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ValidasiDokumenTab({ showToast }: ValidasiDokumenTabProps) {
  const { user, canEdit, isAdmin } = useAuth();

  const [records, setRecords] = useState<DocumentValidationRecord[]>([]);
  const [metrics, setMetrics] = useState<ValidationSummaryMetrics>({
    totalDocuments: 0,
    totalFstb: 0,
    totalTtb: 0,
    menungguValidasi: 0,
    prosesValidasi: 0,
    siapKirimArmada: 0,
    sudahDiterimaArmada: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Filter & Search State
  const [filterType, setFilterType] = useState<'ALL' | 'FSTB' | 'TTB'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<DocumentValidationRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Fetch data dari /api/validasi-dokumen
  const fetchValidations = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg('');

      const res = await fetch(`/api/validasi-dokumen?_t=${Date.now()}`);
      if (!res.ok) throw new Error('Gagal menghubungi server validasi dokumen.');

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Gagal memuat data validasi.');

      setRecords(data.records || []);
      if (data.metrics) setMetrics(data.metrics);

      if (isManualRefresh && showToast) {
        showToast('Data validasi berhasil diperbarui dari Cloudflare R2!', 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat memuat data.';
      setErrorMsg(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchValidations();
  }, []);

  // Filter data di client-side
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (filterType !== 'ALL') {
      result = result.filter((r) => r.docType === filterType);
    }

    if (filterStatus !== 'ALL') {
      result = result.filter((r) => r.overallStatus === filterStatus);
    }

    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toUpperCase();
      result = result.filter(
        (r) =>
          r.docNumber.toUpperCase().includes(q) ||
          r.cleanDocNumber.toUpperCase().includes(q) ||
          r.armada.toUpperCase().includes(q) ||
          (r.poNumber && r.poNumber.toUpperCase().includes(q)) ||
          (r.fpbNumber && r.fpbNumber.toUpperCase().includes(q)) ||
          r.renamedFileName.toUpperCase().includes(q) ||
          (r.purchasingValidation.validatorName &&
            r.purchasingValidation.validatorName.toUpperCase().includes(q)) ||
          (r.logistikValidation.validatorName &&
            r.logistikValidation.validatorName.toUpperCase().includes(q)) ||
          (r.lapanganValidation.validatorName &&
            r.lapanganValidation.validatorName.toUpperCase().includes(q))
      );
    }

    return result;
  }, [records, filterType, filterStatus, searchKeyword]);

  const handleOpenValidation = (rec: DocumentValidationRecord) => {
    setSelectedRecord(rec);
    setIsModalOpen(true);
  };

  const handleValidationUpdated = (updated: DocumentValidationRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setSelectedRecord(updated);
    // Refresh re-metrics
    fetchValidations(false);
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (showToast) showToast('Nomor dokumen disalin ke clipboard!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900/30 via-primary/20 to-purple-900/30 border border-primary/25 rounded-2xl p-5 sm:p-6 backdrop-blur-sm relative overflow-hidden shadow-xs">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 size-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/25">
              <ShieldCheck className="size-3.5" />
              <span>Multi-Lini Quality Assurance &amp; Approval</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Validasi FSTB &amp; TTB Terpadu</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Verifikasi dan pengesahan tanda tangan digital dari 3 lini operasional:{' '}
              <strong className="text-cyan-700 dark:text-cyan-300 font-semibold">1. Purchasing</strong>,{' '}
              <strong className="text-purple-700 dark:text-purple-300 font-semibold">2. Logistik</strong>, dan{' '}
              <strong className="text-amber-700 dark:text-amber-300 font-semibold">3. Tim Lapangan</strong>{' '}
              sebelum berkas diserahterimakan ke armada kapal atau penerima akhir.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchValidations(true)}
              disabled={isRefreshing}
              className="h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Sinkronisasi dengan Cloudflare R2"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
              <span>{isRefreshing ? 'Sinkronisasi...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Dokumen */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Berkas
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-foreground">
              {metrics.totalDocuments}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {metrics.totalFstb} FSTB • {metrics.totalTtb} TTB
            </span>
          </div>
        </div>

        {/* Card 2: Menunggu Validasi */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Menunggu Validasi
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {metrics.menungguValidasi}
            </div>
            <span className="text-[10px] text-muted-foreground">0/3 Lini tervalidasi</span>
          </div>
        </div>

        {/* Card 3: Proses Validasi */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Dalam Proses
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {metrics.prosesValidasi}
            </div>
            <span className="text-[10px] text-muted-foreground">1-2 Lini telah sah</span>
          </div>
        </div>

        {/* Card 4: Siap Kirim Armada */}
        <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Siap Kirim Armada
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {metrics.siapKirimArmada}
            </div>
            <span className="text-[10px] text-muted-foreground">3/3 Lini sah &amp; lengkap</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Tipe Dokumen */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              Semua ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('FSTB')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer inline-flex items-center gap-1.5 ${
                filterType === 'FSTB'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              <Boxes className="size-3" />
              <span>FSTB ({metrics.totalFstb})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('TTB')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer inline-flex items-center gap-1.5 ${
                filterType === 'TTB'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              <PackageCheck className="size-3" />
              <span>TTB ({metrics.totalTtb})</span>
            </button>
          </div>

          {/* Filter Status & Search Input */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">Semua Status Validasi</option>
              <option value="MENUNGGU_VALIDASI">Menunggu Validasi (0/3)</option>
              <option value="PROSES_VALIDASI">Dalam Proses (1-2 Lini)</option>
              <option value="SIAP_KIRIM_ARMADA">Siap Kirim Armada (3/3 Sah)</option>
              <option value="SUDAH_DITERIMA_ARMADA">Sudah Diterima Armada</option>
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Cari FSTB, TTB, PO, Armada..."
                className="w-full h-8.5 pl-8 pr-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Data Berkas Validasi */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">No. Berkas Resmi</th>
                <th className="py-2.5 px-3">Armada / Unit</th>
                <th className="py-2.5 px-3">No. PO / DO</th>
                <th className="py-2.5 px-3">Persetujuan 3 Lini</th>
                <th className="py-2.5 px-3">Status Kelayakan</th>
                <th className="py-2.5 px-3">Tgl Update</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-primary" />
                      Memuat data berkas validasi dari Cloudflare R2...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    {searchKeyword
                      ? `Tidak ada berkas yang cocok dengan kata kunci "${searchKeyword}".`
                      : 'Belum ada berkas FSTB atau TTB yang terunggah untuk divalidasi.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition">
                    {/* Tipe Dokumen */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase ${
                          item.docType === 'FSTB'
                            ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                            : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                        }`}
                      >
                        {item.docType}
                      </span>
                    </td>

                    {/* No Berkas Resmi */}
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenValidation(item)}
                          className="hover:underline hover:text-primary transition truncate text-left"
                          title="Klik untuk buka matriks validasi & TTD"
                        >
                          {item.docNumber}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.docNumber, item.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Salin No Dokumen"
                        >
                          {copiedId === item.id ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Armada */}
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <Ship className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.armada || '-'}</span>
                      </div>
                    </td>

                    {/* No PO / DO */}
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {item.poNumber || '-'}
                    </td>

                    {/* Persetujuan 3 Lini Visual Bar */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {/* Lini 1: Purchasing */}
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border ${
                            item.purchasingValidation.isValidated
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                              : 'bg-muted/60 text-muted-foreground/60 border-border/40'
                          }`}
                          title={`1. Purchasing: ${
                            item.purchasingValidation.isValidated
                              ? `Sah (${item.purchasingValidation.validatorName || 'Disetujui'})`
                              : 'Menunggu'
                          }`}
                        >
                          <ShoppingBag className="size-2.5" />
                          <span>PCH</span>
                          {item.purchasingValidation.isValidated ? (
                            <Check className="size-2.5 text-cyan-600 dark:text-cyan-400" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                        </div>

                        {/* Lini 2: Logistik */}
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border ${
                            item.logistikValidation.isValidated
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                              : 'bg-muted/60 text-muted-foreground/60 border-border/40'
                          }`}
                          title={`2. Logistik: ${
                            item.logistikValidation.isValidated
                              ? `Sah (${item.logistikValidation.validatorName || 'Disetujui'})`
                              : 'Menunggu'
                          }`}
                        >
                          <PackageCheck className="size-2.5" />
                          <span>LOG</span>
                          {item.logistikValidation.isValidated ? (
                            <Check className="size-2.5 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                        </div>

                        {/* Lini 3: Tim Lapangan */}
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border ${
                            item.lapanganValidation.isValidated
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-muted/60 text-muted-foreground/60 border-border/40'
                          }`}
                          title={`3. Tim Lapangan: ${
                            item.lapanganValidation.isValidated
                              ? `Sah (${item.lapanganValidation.validatorName || 'Disetujui'})`
                              : 'Menunggu'
                          }`}
                        >
                          <Truck className="size-2.5" />
                          <span>LAP</span>
                          {item.lapanganValidation.isValidated ? (
                            <Check className="size-2.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Clock className="size-2.5" />
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status Kelayakan Keseluruhan */}
                    <td className="py-2.5 px-3">
                      {item.overallStatus === 'SUDAH_DITERIMA_ARMADA' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                          <CheckCircle2 className="size-3" />
                          Diterima Armada
                        </span>
                      ) : item.overallStatus === 'SIAP_KIRIM_ARMADA' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <ShieldCheck className="size-3" />
                          Siap Kirim Armada
                        </span>
                      ) : item.overallStatus === 'PROSES_VALIDASI' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          <Clock className="size-3" />
                          Proses ({item.completedLinesCount}/3)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <AlertCircle className="size-3" />
                          Menunggu (0/3)
                        </span>
                      )}
                    </td>

                    {/* Tanggal */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                      {item.updatedAt ? item.updatedAt.slice(0, 10) : item.receivedDate}
                    </td>

                    {/* Aksi */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenValidation(item)}
                          className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs inline-flex items-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                          title="Buka Form Validasi & Tanda Tangan"
                        >
                          <FileSignature className="size-3" />
                          <span>Validasi &amp; TTD</span>
                        </button>

                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition shadow-2xs"
                          title="Buka Berkas di Tab Baru"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Interaktif Validasi & Tanda Tangan Digital */}
      {isModalOpen && selectedRecord && (
        selectedRecord.docType === 'FSTB' ? (
          <FstbValidationModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedRecord(null);
            }}
            record={selectedRecord}
            onValidationSuccess={handleValidationUpdated}
            showToast={showToast}
          />
        ) : (
          <ValidationSignatureModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedRecord(null);
            }}
            record={selectedRecord}
            onValidationSuccess={handleValidationUpdated}
            showToast={showToast}
          />
        )
      )}
    </div>
  );
}
