'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Gavel,
  Search,
  Filter,
  Plus,
  Scale,
  FileText,
  Download,
  Share2,
  Calendar,
  Building2,
  TrendingDown,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Users,
  Send,
  Link2,
  Copy,
  Check,
  Package,
  X,
  Lock,
  Unlock,
  ShieldAlert,
  Phone,
  User,
} from 'lucide-react';
import {
  PratenderPackage,
  PratenderStatus,
  VendorBidSubmission,
} from '@/types/pratender';
import { sanitizeTenderPackages } from '@/utils/tenderSanitizer';
import CommercialBidTabulationModal from './CommercialBidTabulationModal';
import VendorTenderPortalModal from './VendorTenderPortalModal';
import {
  generateRksDocumentPdf,
  generateBaepDocumentPdf,
  generatePoAwardDocumentPdf,
  triggerBrowserPdfDownload,
} from '@/utils/tenderDocumentGenerator';
import { useAuth } from '@/context/AuthContext';

interface Props {
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  onNavigateTab?: (tab: any) => void;
}

export default function TenderManagementTab({ showToast, onNavigateTab }: Props) {
  const { user } = useAuth();

  // Data States
  const [packages, setPackages] = useState<PratenderPackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal States
  const [isCbtModalOpen, setIsCbtModalOpen] = useState<boolean>(false);
  const [selectedCbtPackage, setSelectedCbtPackage] = useState<PratenderPackage | null>(null);

  const [isVendorPortalOpen, setIsVendorPortalOpen] = useState<boolean>(false);
  const [selectedPortalPackage, setSelectedPortalPackage] = useState<PratenderPackage | null>(null);

  const [generatingDocType, setGeneratingDocType] = useState<string | null>(null);

  // WhatsApp Blast Modal State
  const [waBlastPackage, setWaBlastPackage] = useState<PratenderPackage | null>(null);
  const [waGroupLink, setWaGroupLink] = useState<string>('');
  const [waBlastMode, setWaBlastMode] = useState<'group' | 'personal'>('group');
  const [personalVendorName, setPersonalVendorName] = useState<string>('');
  const [personalVendorPhone, setPersonalVendorPhone] = useState<string>('');

  // Fetch Packages from server
  const fetchPackages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/pratender?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.packages)) {
          setPackages(sanitizeTenderPackages(json.packages));
        }
      }
    } catch (err: any) {
      if (showToast) showToast('Gagal memuat daftar tender.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  // Filtered Packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = pkg.title.toLowerCase().includes(q);
        const matchNo = pkg.packageNumber.toLowerCase().includes(q);
        const matchCat = pkg.category.toLowerCase().includes(q);
        const matchItem = pkg.items.some((it) => it.itemName.toLowerCase().includes(q));
        if (!matchTitle && !matchNo && !matchCat && !matchItem) return false;
      }
      if (statusFilter !== 'ALL' && pkg.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && pkg.category !== categoryFilter) return false;
      return true;
    });
  }, [packages, searchQuery, statusFilter, categoryFilter]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    packages.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [packages]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = packages.length;
    const rfqActive = packages.filter((p) => p.status === 'RFQ_SENT' || p.status === 'DRAFT').length;
    const inEvaluation = packages.filter((p) => p.status === 'EVALUATION').length;
    const completed = packages.filter((p) => p.status === 'AWARDED' || p.status === 'COMPLETED').length;

    let totalSavings = 0;
    packages.forEach((p) => {
      if (p.evaluationSummary?.costSavingVsHps && p.evaluationSummary.costSavingVsHps > 0) {
        totalSavings += p.evaluationSummary.costSavingVsHps;
      }
    });

    return { total, rfqActive, inEvaluation, completed, totalSavings };
  }, [packages]);

  // Handle Save CBT package (e.g. from CBT modal)
  const handleSaveCbtPackage = async (updatedPkg: PratenderPackage) => {
    try {
      const res = await fetch('/api/pratender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_PACKAGE',
          package: updatedPkg,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setPackages((prev) =>
            prev.map((p) => (p.id === updatedPkg.id ? updatedPkg : p))
          );
          if (showToast) showToast('Data evaluasi komparasi tender (CBT SAP) berhasil disimpan.', 'success');
        }
      }
    } catch (err: any) {
      if (showToast) showToast(`Gagal menyimpan data tender: ${err.message}`, 'error');
    }
  };

  // Handle 1x Winner Announcement Blast (Locked afterwards)
  const handleSendWinnerBlast = async (waUrl: string, targetPkg: PratenderPackage) => {
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    const nowIso = new Date().toISOString();
    const endsIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const updatedPkg: PratenderPackage = {
      ...targetPkg,
      isWinnerBlasted: true,
      winnerBlastedAt: nowIso,
      winnerBlastedBy: user?.name || 'Tim Pengadaan CPG',
      evaluationSummary: targetPkg.evaluationSummary
        ? {
            ...targetPkg.evaluationSummary,
            standstillStartedAt: targetPkg.evaluationSummary.standstillStartedAt || nowIso,
            standstillEndsAt: targetPkg.evaluationSummary.standstillEndsAt || endsIso,
            standstillStatus: targetPkg.evaluationSummary.standstillStatus || 'IN_PROGRESS',
          }
        : undefined,
    };

    await handleSaveCbtPackage(updatedPkg);
    setWaBlastPackage(null);
    if (showToast) {
      showToast('Pengumuman pemenang berhasil disiarkan & tombol blast telah dikunci permanen.', 'success');
    }
  };

  // Handle Bid Submitted from Vendor Portal
  const handleVendorBidSubmitted = async (submission: VendorBidSubmission) => {
    if (!selectedPortalPackage) return;

    const existingBids = selectedPortalPackage.vendorBids || [];
    const updatedBids = [...existingBids.filter((b) => b.vendorName.toLowerCase() !== submission.vendorName.toLowerCase()), submission];

    const updatedPkg: PratenderPackage = {
      ...selectedPortalPackage,
      status: selectedPortalPackage.status === 'DRAFT' || selectedPortalPackage.status === 'RFQ_SENT' ? 'EVALUATION' : selectedPortalPackage.status,
      vendorBids: updatedBids,
    };

    await handleSaveCbtPackage(updatedPkg);
  };

  // Helper Download Dokumen Pendukung Tender (RKS RFQ, BAEP, PO)
  const handleDownloadTenderDoc = async (pkg: PratenderPackage, type: 'RKS' | 'BAEP' | 'PO') => {
    setGeneratingDocType(`${type}-${pkg.id}`);
    try {
      if (type === 'RKS') {
        const bytes = await generateRksDocumentPdf(pkg);
        triggerBrowserPdfDownload(bytes, `DOKUMEN_RKS_RFQ_${pkg.packageNumber}.pdf`);
        if (showToast) showToast(`✓ Dokumen RKS RFQ ${pkg.packageNumber} berhasil diunduh!`, 'success');
      } else if (type === 'BAEP') {
        const bytes = await generateBaepDocumentPdf(pkg);
        triggerBrowserPdfDownload(bytes, `BERITA_ACARA_BAEP_${pkg.packageNumber}.pdf`);
        if (showToast) showToast(`✓ Berita Acara BAEP ${pkg.packageNumber} berhasil diunduh!`, 'success');
      } else if (type === 'PO') {
        const bytes = await generatePoAwardDocumentPdf(pkg);
        triggerBrowserPdfDownload(bytes, `PO_AWARD_${pkg.packageNumber}.pdf`);
        if (showToast) showToast(`✓ Dokumen Purchase Order (PO Award) ${pkg.packageNumber} berhasil diunduh!`, 'success');
      }
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal membuat dokumen tender.', 'error');
    } finally {
      setGeneratingDocType(null);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: PratenderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Draft RKS
          </span>
        );
      case 'RFQ_SENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 animate-pulse">
            Bidding Dibuka (RFQ)
          </span>
        );
      case 'EVALUATION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Evaluasi CBT SAP
          </span>
        );
      case 'AWARDED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Pemenang Ditetapkan
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Selesai (Terbit PO)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Dibatalkan
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 text-xs animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
              <Gavel className="size-5" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                Sistem Manajemen Tender &amp; Portal Rekanan
              </h1>
              <p className="text-xs text-muted-foreground">
                Pengadaan strategis armada CPG, komparasi penawaran rekanan CBT (SAP ME49), dan penerbitan PO Award.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchPackages}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Muat Ulang Daftar Paket Tender"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
            <span>Segarkan</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('pratender')}
              className="px-3.5 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Ambil kebutuhan material dari Pratender"
            >
              <Package className="size-3.5" />
              <span>Sourcing Pratender</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Total Paket Tender</span>
          <div className="text-xl sm:text-2xl font-bold text-foreground font-mono">{metrics.total}</div>
          <span className="text-[10px] text-muted-foreground">Paket resmi terdaftar</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Bidding / RFQ Dibuka</span>
          <div className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono">{metrics.rfqActive}</div>
          <span className="text-[10px] text-sky-600/80">Menunggu submission vendor</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Evaluasi CBT ME49</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{metrics.inEvaluation}</div>
          <span className="text-[10px] text-amber-600/80">Proses tabulasi &amp; scoring</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Pemenang / Terbit PO</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{metrics.completed}</div>
          <span className="text-[10px] text-emerald-600/80">PO Award disahkan</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-1 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-medium text-muted-foreground block">Total Efisiensi (Saving)</span>
          <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 font-mono truncate">
            Rp {metrics.totalSavings.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-purple-600/80">Penghematan anggaran vs HPS</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor tender (CPG-TDR-...), judul paket, kategori, atau nama item..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
          >
            <option value="ALL">Semua Tahapan Status</option>
            <option value="DRAFT">Draft RKS</option>
            <option value="RFQ_SENT">Bidding Dibuka (RFQ)</option>
            <option value="EVALUATION">Evaluasi CBT SAP</option>
            <option value="AWARDED">Pemenang Ditetapkan</option>
            <option value="COMPLETED">Selesai (Terbit PO)</option>
          </select>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
            >
              <option value="ALL">Semua Kategori Pengadaan</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* List of Tender Packages */}
      <div className="space-y-4">
        {filteredPackages.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-2">
            <Gavel className="size-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-bold text-foreground text-sm">Tidak Ada Paket Tender Ditemukan</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'Tidak ada paket tender yang cocok dengan kriteria filter pencarian Anda.'
                : 'Belum ada paket tender resmi yang dibuat. Buat paket tender baru melalui modul Pratender Material.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredPackages.map((pkg) => {
              const vendorBidsCount = pkg.vendorBids?.length || 0;
              const hasWinner = pkg.status === 'AWARDED' || pkg.status === 'COMPLETED';

              return (
                <div
                  key={pkg.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-xs hover:border-purple-500/40 transition flex flex-col justify-between space-y-4"
                >
                  {/* Top Bar Paket */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                          {pkg.packageNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                          Kategori: {pkg.category}
                        </span>
                        {renderStatusBadge(pkg.status)}
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">{pkg.title}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Dibuat oleh <span className="font-semibold text-foreground">{pkg.createdBy}</span> &bull;{' '}
                        {new Date(pkg.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <div className="text-left sm:text-right space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                        Nilai HPS / OE
                      </span>
                      <span className="font-mono text-base font-bold text-foreground">
                        Rp {(pkg.ownerEstimateHps || pkg.totalEstimatedBudget || 0).toLocaleString('id-ID')}
                      </span>
                      {pkg.targetClosingDate && (
                        <p className="text-[11px] text-muted-foreground">
                          Batas Penawaran:{' '}
                          <span className="font-medium text-foreground">{pkg.targetClosingDate}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle Info & Bidding Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Item Kebutuhan</span>
                      <span className="font-semibold text-foreground text-xs">
                        {pkg.items.length} Macam Material / Jasa
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">Partisipasi Rekanan</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Users className="size-3.5 text-sky-500" />
                        <span className="font-bold text-xs text-foreground">
                          {vendorBidsCount} Penawaran Masuk
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">Status Pemenang Tender</span>
                      {hasWinner && pkg.awardedVendor ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs truncate block">
                          ✓ {pkg.awardedVendor}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">
                          Dalam evaluasi / belum penetapan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    {/* Dokumen RKS & BAEP Downloads */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleDownloadTenderDoc(pkg, 'RKS')}
                        disabled={generatingDocType === `RKS-${pkg.id}`}
                        className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Unduh Dokumen RKS / Ketentuan Tender (PDF)"
                      >
                        <FileText className="size-3 text-sky-500" />
                        <span>RKS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadTenderDoc(pkg, 'BAEP')}
                        disabled={generatingDocType === `BAEP-${pkg.id}`}
                        className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Unduh Berita Acara Evaluasi Pengadaan (BAEP PDF)"
                      >
                        <Award className="size-3 text-amber-500" />
                        <span>BAEP</span>
                      </button>

                      {hasWinner && (
                        <button
                          type="button"
                          onClick={() => handleDownloadTenderDoc(pkg, 'PO')}
                          disabled={generatingDocType === `PO-${pkg.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Unduh Surat Purchase Order (PO Award) Resmi (PDF)"
                        >
                          <Download className="size-3 text-emerald-600" />
                          <span>PO Award</span>
                        </button>
                      )}

                      {/* Button Blast WA / Blast Pemenang (1x Click Protected) */}
                      {(() => {
                        const isAwarded =
                          pkg.status === 'AWARDED' ||
                          pkg.status === 'COMPLETED' ||
                          Boolean(pkg.evaluationSummary?.winningVendorName || pkg.awardedVendor);

                        if (isAwarded) {
                          if (pkg.isWinnerBlasted) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/70 text-muted-foreground text-xs font-semibold inline-flex items-center gap-1 cursor-not-allowed opacity-80"
                                title={`Pengumuman pemenang telah disiarkan ke seluruh rekanan via WA pada ${
                                  pkg.winnerBlastedAt
                                    ? new Date(pkg.winnerBlastedAt).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '-'
                                } oleh ${pkg.winnerBlastedBy || 'Tim Pengadaan'}`}
                              >
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                <span>Pengumuman Terkirim</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setWaBlastPackage(pkg);
                                setWaGroupLink(pkg.waGroupInviteLink || '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs animate-pulse"
                              title="Blast Pengumuman Pemenang Tender ke Seluruh Rekanan Peserta (1x kirim)"
                            >
                              <Award className="size-3.5 text-amber-600" />
                              <span>Blast Pemenang</span>
                            </button>
                          );
                        }

                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setWaBlastPackage(pkg);
                              setWaGroupLink(pkg.waGroupInviteLink || '');
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                            title="Blast WhatsApp Undangan Tender ke Rekanan"
                          >
                            <Share2 className="size-3 text-emerald-600" />
                            <span>Blast WA</span>
                          </button>
                        );
                      })()}
                    </div>

                    {/* Primary Tender Actions */}
                    <div className="flex items-center gap-2">
                      {/* Button CBT SAP ME49 Evaluation */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCbtPackage(pkg);
                          setIsCbtModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Buka Evaluasi Komparasi Penawaran CBT (SAP ME49)"
                      >
                        <Scale className="size-3.5" />
                        <span>CBT SAP (ME49)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: CBT SAP EVALUATION (COMMERCIAL BID TABULATION - ME49) */}
      {isCbtModalOpen && selectedCbtPackage && (
        <CommercialBidTabulationModal
          isOpen={isCbtModalOpen}
          onClose={() => {
            setIsCbtModalOpen(false);
            setSelectedCbtPackage(null);
          }}
          packageData={selectedCbtPackage}
          onSavePackage={handleSaveCbtPackage}
          userRole={user?.role}
          userName={user?.name || user?.username}
        />
      )}

      {/* MODAL 2: VENDOR TENDER PORTAL (E-QUOTATION & DOCUMENT SUBMISSION) */}
      {isVendorPortalOpen && selectedPortalPackage && (
        <VendorTenderPortalModal
          isOpen={isVendorPortalOpen}
          onClose={() => {
            setIsVendorPortalOpen(false);
            setSelectedPortalPackage(null);
          }}
          packageData={selectedPortalPackage}
          onBidSubmitted={handleVendorBidSubmitted}
          showToast={showToast}
        />
      )}

      {/* MODAL 3: WHATSAPP BLAST & INVITE LINK / WINNER ANNOUNCEMENT */}
      {waBlastPackage && (() => {
        const isWinnerAnnouncement =
          waBlastPackage.status === 'AWARDED' ||
          waBlastPackage.status === 'COMPLETED' ||
          Boolean(waBlastPackage.evaluationSummary?.winningVendorName || waBlastPackage.awardedVendor);

        const winnerVendorName =
          waBlastPackage.evaluationSummary?.winningVendorName ||
          waBlastPackage.awardedVendor ||
          '-';

        const winnerAmount =
          waBlastPackage.evaluationSummary?.winningAmount ||
          waBlastPackage.awardedValue ||
          0;

        const standstillEndDate = waBlastPackage.evaluationSummary?.standstillEndsAt
          ? new Date(waBlastPackage.evaluationSummary.standstillEndsAt)
          : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        const standstillFormatted = standstillEndDate.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cpg-procurement.com';
        const portalLink = `${origin}/vendor/tender?pkg=${waBlastPackage.id}`;

        const winnerMessageText = `*PENGUMUMAN RESMI PENETAPAN PEMENANG TENDER*
PT CIPTA SARANA TRANSINDO (CPG GROUP)

Kepada Yth. Seluruh Rekanan Peserta Tender,

Berdasarkan hasil evaluasi kualifikasi, teknis, dan komersial (CBT) yang telah disahkan oleh Manajemen CPG Group, dengan ini kami umumkan penetapan pemenang untuk paket pengadaan:

📦 *Paket:* ${waBlastPackage.title}
📋 *No. Tender:* ${waBlastPackage.packageNumber}
🏷️ *Kategori:* ${waBlastPackage.category}

🏆 *REKANAN PEMENANG TERPILIH:*
- *Nama Perusahaan:* ${winnerVendorName}
- *Nilai Penawaran Disahkan:* Rp ${Number(winnerAmount).toLocaleString('id-ID')}

⏳ *MASA SANGGAH (STANDSTILL PERIOD):*
Sesuai prosedur PTK/SAP CPG Group, masa sanggah dibuka selama *3 (tiga) hari kalender* terhitung sejak pengumuman ini diterbitkan hingga *${standstillFormatted}*. Sanggahan resmi dapat disampaikan tertulis kepada Tim Pengadaan CPG.

🔗 *Transparansi Hasil Pengumuman:*
${portalLink}
${waGroupLink ? `\nGrup WhatsApp Koordinasi:\n${waGroupLink}\n` : ''}
Kami menyampaikan apresiasi dan terima kasih yang sebesar-besarnya atas partisipasi, dedikasi, serta kerja sama seluruh rekanan peserta tender.

Salam hormat,
*Tim Pengadaan PT Cindara Pratama Lines*`;

        const winnerWaUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(winnerMessageText)}`;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setWaBlastPackage(null)}
          >
            <div
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  {isWinnerAnnouncement ? (
                    <Award className="size-5 text-amber-600" />
                  ) : (
                    <Share2 className="size-4 text-emerald-600" />
                  )}
                  <h3 className="font-bold text-foreground text-sm">
                    {isWinnerAnnouncement
                      ? 'Blast Pengumuman Pemenang Tender'
                      : 'Blast Undangan Tender & Portal Rekanan'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWaBlastPackage(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {isWinnerAnnouncement ? (
                  <>
                    Siarkan pengumuman resmi penetapan pemenang paket <strong>{waBlastPackage.packageNumber}</strong> ke seluruh rekanan peserta tender via WhatsApp Group beserta ketentuan Masa Sanggah (3 hari kalender).
                  </>
                ) : (
                  <>
                    Kirimkan pengumuman tender resmi untuk paket <strong>{waBlastPackage.packageNumber}</strong> ke Group Rekanan WhatsApp beserta tautan pengisian penawaran online.
                  </>
                )}
              </p>

              {/* TAMPILAN KHUSUS JIKA SUDAH PENETAPAN PEMENANG */}
              {isWinnerAnnouncement ? (
                <div className="space-y-3">
                  {/* Kartu Ringkasan Pemenang */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        Rekanan Pemenang Terpilih
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                        HASIL EVALUASI SAH
                      </span>
                    </div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <Award className="size-4 text-amber-600 shrink-0" />
                      <span>{winnerVendorName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1.5 text-[11px] text-muted-foreground border-t border-amber-500/20">
                      <div>
                        <span>Nilai PO Disahkan:</span>
                        <p className="font-mono font-bold text-foreground">
                          Rp {Number(winnerAmount).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div>
                        <span>Masa Sanggah (3 Hari):</span>
                        <p className="font-semibold text-foreground">
                          s.d. {standstillFormatted}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Jika sudah pernah di-blast */}
                  {waBlastPackage.isWinnerBlasted ? (
                    <div className="p-4 rounded-xl bg-muted/60 border border-border text-center space-y-2">
                      <CheckCircle2 className="size-7 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-foreground">Pengumuman Pemenang Sudah Disiarkan</p>
                      <p className="text-[11px] text-muted-foreground">
                        Telah disiarkan ke WhatsApp rekanan pada{' '}
                        <strong>
                          {waBlastPackage.winnerBlastedAt
                            ? new Date(waBlastPackage.winnerBlastedAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </strong>{' '}
                        oleh <strong>{waBlastPackage.winnerBlastedBy || 'Tim Pengadaan CPG'}</strong>.
                      </p>
                      <div className="p-2 rounded-lg bg-background border border-border text-[11px] text-muted-foreground text-left flex items-start gap-1.5">
                        <Lock className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Sesuai tata kelola GCG, pengumuman hanya disiarkan 1 kali untuk menjaga ketertiban administrasi dan mencegah pesan berulang / spam ke rekanan.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Input Link Grup WhatsApp Tender */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Link2 className="size-3.5 text-amber-600" />
                          <span>Tautan Grup WhatsApp Rekanan Tender (Opsional):</span>
                        </label>
                        <input
                          type="text"
                          value={waGroupLink}
                          onChange={(e) => setWaGroupLink(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-amber-500 font-mono"
                        />
                      </div>

                      {/* Notifikasi Proteksi 1x Blast */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <Lock className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Proteksi 1x Klik Aktif:</strong> Tombol siaran ini hanya dapat diklik <strong>1 (satu) kali</strong>. Setelah diklik dan link WhatsApp Web dibuka, sistem akan otomatis mengunci tombol dan mengaktifkan Masa Sanggah 3 Hari Kalender.
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* TAMPILAN STANDAR JIKA TAHAP PENAWARAN (UNDANGAN TENDER) */
                <div className="space-y-3">
                  {/* Pilihan Mode Undangan WhatsApp */}
                  <div className="flex rounded-xl bg-muted p-1 gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setWaBlastMode('group')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                        waBlastMode === 'group'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Grup WhatsApp Rekanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaBlastMode('personal')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold transition cursor-pointer text-center ${
                        waBlastMode === 'personal'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Tautan Khusus Rekanan (1x Input)
                    </button>
                  </div>

                  {waBlastMode === 'group' ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <Link2 className="size-3.5 text-emerald-600" />
                        <span>Tautan Undangan Grup WhatsApp Tender (Opsional):</span>
                      </label>
                      <input
                        type="text"
                        value={waGroupLink}
                        onChange={(e) => setWaGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2.5 p-3 rounded-xl border border-border bg-muted/20">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Building2 className="size-3 text-sky-600" />
                          <span>Nama Perusahaan Rekanan:</span>
                        </label>
                        <input
                          type="text"
                          value={personalVendorName}
                          onChange={(e) => setPersonalVendorName(e.target.value)}
                          placeholder="Contoh: PT. Pelayaran Bahari Global"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                          <Phone className="size-3 text-emerald-600" />
                          <span>Nomor WhatsApp PIC Rekanan:</span>
                        </label>
                        <input
                          type="text"
                          value={personalVendorPhone}
                          onChange={(e) => setPersonalVendorPhone(e.target.value)}
                          placeholder="Contoh: 081234567890 atau 62812..."
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <Lock className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Proteksi 1x Upload Aktif:</strong> Rekanan yang menginput penawaran lewat tautan ini akan langsung dikunci otomatis. Tidak dapat menginput ulang dengan nomor WA atau nama yang sama.
                    </span>
                  </div>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setWaBlastPackage(null)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs"
                >
                  Tutup
                </button>

                {isWinnerAnnouncement ? (
                  !waBlastPackage.isWinnerBlasted && (
                    <button
                      type="button"
                      onClick={() => handleSendWinnerBlast(winnerWaUrl, waBlastPackage)}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Send className="size-3.5" />
                      <span>Siarkan Pengumuman via WhatsApp Web</span>
                    </button>
                  )
                ) : (
                  (() => {
                    const cleanPhone = personalVendorPhone.replace(/[^0-9]/g, '');
                    const waPhoneTarget = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

                    const invitePortalLink =
                      waBlastMode === 'personal' && personalVendorPhone
                        ? `${origin}/vendor/tender?pkg=${waBlastPackage.id}&vphone=${cleanPhone}&vname=${encodeURIComponent(
                            personalVendorName
                          )}`
                        : `${origin}/vendor/tender?pkg=${waBlastPackage.id}`;

                    const messageText =
                      waBlastMode === 'personal' && personalVendorName
                        ? `*UNDANGAN RESMI TENDER PENGADAAN CPG*\n\nKepada Yth. Pimpinan / PIC Komersial\n*${personalVendorName}*\n\nPT Cindara Pratama Lines mengundang perusahaan Anda untuk berpartisipasi dalam paket pengadaan:\n- Nomor: ${waBlastPackage.packageNumber}\n- Paket: ${waBlastPackage.title}\n- Kategori: ${waBlastPackage.category}\n- Batas Penawaran: ${waBlastPackage.targetClosingDate || 'Sesuai RKS'}\n\n*TAUTAN RESMI PENAWARAN (KHUSUS ${personalVendorName}):*\n${invitePortalLink}\n\n⚠️ *PENTING (KETENTUAN 1X INPUT):*\nSetiap rekanan hanya memiliki *1 (satu) kali kesempatan submit*. Setelah formulir dikirim, tautan akan *SEKETIKA DIKUNCI PERMANEN* demi menjaga objektivitas tender.\n\nSalam hormat,\n*Tim Pengadaan PT Cindara Pratama Lines*`
                        : `*PENGUMUMAN TENDER PENGADAAN CPG*\n\nNomor: ${waBlastPackage.packageNumber}\nPaket: ${waBlastPackage.title}\nKategori: ${waBlastPackage.category}\nBatas Penawaran: ${waBlastPackage.targetClosingDate || 'Sesuai RKS'}\n\nRekanan dapat mengakses dokumen RKS dan menyampaikan penawaran resmi melalui link berikut:\n${invitePortalLink}\n${waGroupLink ? `\nGabung Grup WhatsApp Tender:\n${waGroupLink}\n` : ''}\n⚠️ *CATATAN:* Setiap rekanan hanya memiliki *1 (satu) kali kesempatan pengisian*. Tautan langsung dikunci setelah submit.\n\nPT Cindara Pratama Lines`;

                    const waUrl =
                      waBlastMode === 'personal' && waPhoneTarget
                        ? `https://web.whatsapp.com/send?phone=${waPhoneTarget}&text=${encodeURIComponent(messageText)}`
                        : `https://web.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setWaBlastPackage(null)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Send className="size-3.5" />
                        <span>
                          {waBlastMode === 'personal' ? 'Kirim WA Personal ke Vendor' : 'Kirim via WhatsApp Web'}
                        </span>
                      </a>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
