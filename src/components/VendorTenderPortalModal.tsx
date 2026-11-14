'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Sparkles,
  Phone,
  User,
  ShieldCheck,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Unlock,
  ShieldAlert,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { PratenderPackage, VendorBidSubmission, VendorBidItem } from '@/types/pratender';
import { generateRksDocumentPdf, triggerBrowserPdfDownload } from '@/utils/tenderDocumentGenerator';
import { generateTenderBiddingExcel, parseTenderBiddingExcel } from '@/utils/tenderExcelBidding';
import { isNonMaterialOrSignature } from '@/utils/tenderSanitizer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  packageData: PratenderPackage;
  onBidSubmitted: (submission: VendorBidSubmission) => Promise<void>;
  prefilledVendorName?: string;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export default function VendorTenderPortalModal({
  isOpen,
  onClose,
  packageData,
  onBidSubmitted,
  prefilledVendorName = '',
  showToast,
}: Props) {
  // Stepper / Tab
  const [activeStep, setActiveStep] = useState<'download' | 'pricing' | 'documents' | 'review'>('pricing');

  // Vendor Identity
  const [vendorName, setVendorName] = useState(prefilledVendorName);
  const [vendorPic, setVendorPic] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [quotationRefNo, setQuotationRefNo] = useState('');
  const [termOfPayment, setTermOfPayment] = useState('NET 30 Hari');
  const [deliveryLeadTimeDays, setDeliveryLeadTimeDays] = useState(7);
  const [francoDeliveryPoint, setFrancoDeliveryPoint] = useState('Gudang Somber Balikpapan / Dermaga CPG');

  // Item Bids State (hanya item material valid)
  const [items, setItems] = useState<VendorBidItem[]>(() =>
    (packageData.items || [])
      .filter((it) => !isNonMaterialOrSignature(it.itemName, it.itemId))
      .map((it) => ({
        itemId: it.itemId,
        itemName: it.itemName,
        qty: it.totalQty,
        unitPrice: it.targetPrice || 0,
        totalPrice: (it.targetPrice || 0) * it.totalQty,
        brandOffered: '',
        compliance: 'COMPLIANT',
        notes: '',
      }))
  );

  // Uploaded Official Doc (PDF)
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [uploadedDocDataUrl, setUploadedDocDataUrl] = useState<string | null>(null);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingRks, setIsDownloadingRks] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [submissionReceiptId, setSubmissionReceiptId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Confirmation Modal Before Locking (Option 3)
  const [showConfirmLockModal, setShowConfirmLockModal] = useState(false);
  const [agreeLockFinal, setAgreeLockFinal] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Deteksi apakah vendor ini sudah terkunci (Option 3)
  const lockedBid = useMemo(() => {
    if (!packageData || !packageData.vendorBids || packageData.vendorBids.length === 0) return null;
    const cleanCurrentPhone = vendorContact.replace(/[^0-9]/g, '');
    const cleanCurrentName = vendorName.toLowerCase().trim();

    return packageData.vendorBids.find((b) => {
      if (!b.isLocked) return false;
      const bPhone = (b.vendorContact || '').replace(/[^0-9]/g, '');
      if (
        cleanCurrentPhone.length >= 8 &&
        bPhone.length >= 8 &&
        (bPhone === cleanCurrentPhone || bPhone.endsWith(cleanCurrentPhone) || cleanCurrentPhone.endsWith(bPhone))
      ) {
        return true;
      }
      if (cleanCurrentName && b.vendorName && b.vendorName.toLowerCase().trim() === cleanCurrentName) {
        return true;
      }
      return false;
    });
  }, [packageData, vendorContact, vendorName]);

  if (!isOpen) return null;

  // Calculations
  const subtotal = items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  const ppnPercent = 11;
  const ppnAmount = Math.round(subtotal * 0.11);
  const grandTotal = subtotal + ppnAmount;

  // Handle single item price update
  const handleItemPriceChange = (itemId: string, newUnitPrice: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.itemId === itemId) {
          const total = it.qty * newUnitPrice;
          return { ...it, unitPrice: newUnitPrice, totalPrice: total };
        }
        return it;
      })
    );
  };

  // Handle single item brand update
  const handleItemBrandChange = (itemId: string, brand: string) => {
    setItems((prev) =>
      prev.map((it) => (it.itemId === itemId ? { ...it, brandOffered: brand } : it))
    );
  };

  // Handle download RKS PDF
  const handleDownloadRks = async () => {
    setIsDownloadingRks(true);
    try {
      const pdfBytes = await generateRksDocumentPdf(packageData);
      triggerBrowserPdfDownload(pdfBytes, `DOKUMEN_RKS_RFQ_${packageData.packageNumber}.pdf`);
      if (showToast) showToast('Dokumen RKS & Syarat Tender berhasil diunduh.', 'success');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal mengunduh RKS.', 'error');
    } finally {
      setIsDownloadingRks(false);
    }
  };

  // Handle download Excel Template
  const handleDownloadExcelTemplate = () => {
    try {
      generateTenderBiddingExcel(packageData, vendorName);
      if (showToast) showToast('Template Excel Penawaran Harga berhasil diunduh.', 'success');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Gagal membuat file Excel.', 'error');
    }
  };

  // Handle Upload Excel Filled by Vendor
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const res = parseTenderBiddingExcel(buffer, packageData);

        if (res.success && res.items && res.items.length > 0) {
          setItems(res.items);
          if (res.vendorName && !vendorName) setVendorName(res.vendorName);
          if (res.quotationRefNo) setQuotationRefNo(res.quotationRefNo);
          if (res.termOfPayment) setTermOfPayment(res.termOfPayment);
          if (res.leadTimeDays) setDeliveryLeadTimeDays(res.leadTimeDays);

          if (showToast) {
            showToast(
              `Berhasil membaca penawaran dari Excel! Total Rp ${res.grandTotal?.toLocaleString('id-ID')}`,
              'success'
            );
          }
        } else {
          if (showToast) showToast(res.message || 'Gagal membaca format Excel penawaran.', 'error');
        }
      } catch (err: any) {
        if (showToast) showToast(`Kesalahan saat membaca Excel: ${err.message}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle Upload Official Signed Quotation Doc (PDF)
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      if (showToast) showToast('Ukuran berkas penawaran maksimal 15MB.', 'error');
      return;
    }

    setUploadedDocName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedDocDataUrl(event.target?.result as string);
      if (showToast) showToast(`Dokumen penawaran resmi "${file.name}" berhasil diunggah!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Validasi & Buka Konfirmasi Kunci Permanen (Option 3)
  const handleInitiateSubmit = () => {
    if (!vendorName.trim()) {
      if (showToast) showToast('Nama perusahaan rekanan wajib diisi.', 'error');
      setActiveStep('pricing');
      return;
    }

    if (!vendorContact.trim()) {
      if (showToast) showToast('Nomor WhatsApp kontak PIC rekanan wajib diisi.', 'error');
      setActiveStep('pricing');
      return;
    }

    if (items.some((it) => it.unitPrice <= 0)) {
      if (showToast) showToast('Semua item pengadaan wajib diisi harga penawarannya.', 'warning');
      setActiveStep('pricing');
      return;
    }

    // Cek duplikasi kunci
    const cleanPhone = vendorContact.replace(/[^0-9]/g, '');
    const alreadyLocked = (packageData.vendorBids || []).find((b) => {
      if (!b.isLocked) return false;
      const bPhone = (b.vendorContact || '').replace(/[^0-9]/g, '');
      const bName = b.vendorName.toLowerCase().trim();
      return (
        (cleanPhone.length >= 8 && bPhone.length >= 8 && bPhone === cleanPhone) ||
        (vendorName.trim().toLowerCase() === bName)
      );
    });

    if (alreadyLocked) {
      if (showToast)
        showToast(
          'Nomor WhatsApp atau Perusahaan ini sudah pernah mengirimkan penawaran resmi dan berstatus Terkunci.',
          'error'
        );
      return;
    }

    setAgreeLockFinal(false);
    setShowConfirmLockModal(true);
  };

  // Handle Final Submit to CPG & Lock (Option 3)
  const handleConfirmSubmitBid = async () => {
    if (!agreeLockFinal) return;

    setIsSubmitting(true);
    setShowConfirmLockModal(false);

    const cleanNo = packageData.packageNumber.replace(/[^a-zA-Z0-9]/g, '');
    const receiptNo = `REC-CPG-${cleanNo}-${Date.now().toString(36).toUpperCase()}`;

    const newSubmission: VendorBidSubmission = {
      id: `bid-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
      vendorName: vendorName.trim(),
      vendorPic: vendorPic.trim() || undefined,
      vendorContact: vendorContact.trim() || undefined,
      quotationRefNo: quotationRefNo.trim() || receiptNo,
      bidDate: new Date().toISOString().split('T')[0],
      termOfPayment,
      deliveryLeadTimeDays,
      francoDeliveryPoint,
      items,
      subtotal,
      ppnPercent,
      ppnAmount,
      deliveryFee: 0,
      grandTotal,
      technicalStatus: 'PASSED',
      status: 'SUBMITTED',
      negotiatedGrandTotal: grandTotal,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      receiptNumber: receiptNo,
      officialDocName: uploadedDocName || undefined,
    };

    try {
      await onBidSubmitted(newSubmission);
      setSubmissionReceiptId(receiptNo);
      setIsSubmittedSuccess(true);
      if (showToast) showToast('Penawaran harga resmi berhasil dikirimkan dan tautan telah dikunci!', 'success');
    } catch (err: any) {
      if (showToast) showToast(`Gagal mengirimkan penawaran: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy portal link
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/vendor/tender?pkg=${packageData.id}`
    : `https://cpg-procurement.com/vendor/tender?pkg=${packageData.id}`;

  const handleCopyPortalLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      if (showToast) showToast('Tautan portal tender berhasil disalin!', 'success');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Portal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-linear-to-r from-sky-600/10 via-background to-indigo-600/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                  {packageData.packageNumber}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Portal Rekanan &bull; E-Quotation
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                {packageData.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPortalLink}
              title="Salin Tautan Portal Peserta untuk Vendor"
              className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Tersalin' : 'Salin Tautan'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-5 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between text-xs overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveStep('download')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeStep === 'download'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Download className="size-3.5" />
              <span>1. Unduh Berkas Tender</span>
            </button>
            <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
            <button
              type="button"
              onClick={() => setActiveStep('pricing')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeStep === 'pricing'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <DollarSign className="size-3.5" />
              <span>2. Input Penawaran Harga</span>
            </button>
            <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
            <button
              type="button"
              onClick={() => setActiveStep('documents')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeStep === 'documents'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload className="size-3.5" />
              <span>3. Unggah Berkas Resmi</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3.5 text-amber-500" />
            <span>Batas: {packageData.targetClosingDate || 'Sesuai RKS'}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 text-xs space-y-5 flex-1">
          {/* KONDISI TERKUNCI (ONE-TIME SUBMITTED - OPTION 3) */}
          {lockedBid || isSubmittedSuccess ? (
            <div className="py-6 text-center space-y-5 max-w-lg mx-auto animate-in fade-in duration-200">
              <div className="size-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border-2 border-amber-500/25 shadow-xs">
                <Lock className="size-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30">
                  <ShieldCheck className="size-3.5" />
                  <span>TAUTAN TERKUNCI &bull; PENAWARAN RESMI DITERIMA</span>
                </span>
                <h3 className="text-lg font-bold text-foreground mt-2">
                  {lockedBid?.vendorName || vendorName}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                  Penawaran resmi rekanan telah berhasil dicatat oleh sistem pengadaan PT Cindara Pratama Lines. Tautan ini telah <strong>DIKUNCI PERMANEN</strong> untuk mencegah pengunggahan ganda.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/40 text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">Nomor Tanda Terima:</span>
                  <span className="font-mono font-bold text-foreground">
                    {lockedBid?.receiptNumber || submissionReceiptId || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">Waktu Penguncian:</span>
                  <span className="font-medium text-foreground">
                    {lockedBid?.lockedAt
                      ? new Date(lockedBid.lockedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                      : new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">Kontak PIC / WhatsApp:</span>
                  <span className="font-medium text-foreground">
                    {lockedBid?.vendorPic || vendorPic || '-'} ({lockedBid?.vendorContact || vendorContact || '-'})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">Dokumen Resmi:</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">
                    {lockedBid?.officialDocName || uploadedDocName || 'Surat Penawaran Terunggah'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 text-sm font-bold">
                  <span className="text-foreground">Total Penawaran (Inc. PPN):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    Rp {(lockedBid?.grandTotal || grandTotal).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadRks}
                  disabled={isDownloadingRks}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="size-3.5 text-sky-500" />
                  <span>Unduh Dokumen RKS</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-foreground text-background text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Printer className="size-3.5" />
                  <span>Cetak Tanda Terima</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-left text-xs space-y-1">
                <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-sky-600" />
                  <span>Permohonan Pembukaan Kunci (Unlock)</span>
                </div>
                <p className="text-[11px] text-sky-700/80 dark:text-sky-400 leading-relaxed">
                  Jika terdapat kekeliruan dokumen teknis yang fatal sebelum deadline, silakan hubungi Panitia Pengadaan CPG untuk permohonan pembukaan kunci portal.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: DOWNLOAD BERKAS TENDER */}
              {activeStep === 'download' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-xs">
                      <Sparkles className="size-4 text-sky-600 dark:text-sky-400" />
                      <span>Panduan Dokumen Pengadaan Rekanan</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Silakan unduh dokumen RKS untuk mempelajari ruang lingkup pengadaan, spesifikasi teknis barang,
                      serta format penawaran harga. Anda dapat menggunakan Template Excel resmi untuk pengisian harga cepat.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Kartu RKS PDF */}
                    <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          <FileText className="size-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-xs">Dokumen RKS &amp; Syarat Tender</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Rencana Kerja &amp; Syarat-syarat Pengadaan resmi PT Cindara Pratama Lines (Format PDF).
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadRks}
                        disabled={isDownloadingRks}
                        className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                      >
                        <Download className="size-3.5" />
                        <span>{isDownloadingRks ? 'Membuat PDF...' : 'Unduh Dokumen RKS (PDF)'}</span>
                      </button>
                    </div>

                    {/* Kartu Template Excel Bidding */}
                    <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <FileSpreadsheet className="size-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-xs">Blanko Penawaran Harga (Excel)</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Template formulir resmi {packageData.items.length} item material. Tinggal isi kolom harga satuan.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadExcelTemplate}
                        className="w-full py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Download className="size-3.5" />
                        <span>Unduh Blanko Penawaran (Excel)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('pricing')}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs inline-flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>Lanjut: Isi Penawaran Harga</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: INPUT PENAWARAN HARGA */}
              {activeStep === 'pricing' && (
                <div className="space-y-4">
                  {/* Identitas Rekanan Form */}
                  <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="font-bold text-foreground flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="size-4 text-sky-500" />
                        <span>Data Perusahaan Rekanan &amp; Ketentuan Penawaran</span>
                      </div>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        * Wajib diisi lengkap
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Nama Perusahaan Rekanan *
                        </label>
                        <input
                          type="text"
                          value={vendorName}
                          onChange={(e) => setVendorName(e.target.value)}
                          placeholder="Contoh: PT. Pelayaran Global Nusantara"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Nama PIC Rekanan
                        </label>
                        <input
                          type="text"
                          value={vendorPic}
                          onChange={(e) => setVendorPic(e.target.value)}
                          placeholder="Contoh: Budi Santoso (Marketing)"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Kontak WhatsApp PIC
                        </label>
                        <input
                          type="text"
                          value={vendorContact}
                          onChange={(e) => setVendorContact(e.target.value)}
                          placeholder="Contoh: 081234567890"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Nomor Surat Penawaran (Quotation Ref)
                        </label>
                        <input
                          type="text"
                          value={quotationRefNo}
                          onChange={(e) => setQuotationRefNo(e.target.value)}
                          placeholder="Contoh: QTN/PGN/2026/041"
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Syarat Pembayaran (TOP)
                        </label>
                        <select
                          value={termOfPayment}
                          onChange={(e) => setTermOfPayment(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        >
                          <option value="CBD (Cash Before Delivery)">CBD (Cash Before Delivery)</option>
                          <option value="COD / 14 Hari">COD / 14 Hari</option>
                          <option value="NET 30 Hari">NET 30 Hari</option>
                          <option value="NET 45 Hari">NET 45 Hari</option>
                          <option value="NET 60 Hari">NET 60 Hari</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Lead Time Pengiriman (Hari)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={deliveryLeadTimeDays}
                          onChange={(e) => setDeliveryLeadTimeDays(Number(e.target.value) || 1)}
                          className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toolbar Tabel Penawaran & Upload Excel Shortcut */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div>
                      <h4 className="font-bold text-foreground text-xs">Rincian Penawaran Harga ({items.length} Item)</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Masukkan harga satuan atau unggah kembali template Excel penawaran yang sudah diisi.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadExcelTemplate}
                        className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                        title="Unduh Template Excel untuk diisi offline"
                      >
                        <Download className="size-3.5" />
                        <span>Unduh Excel</span>
                      </button>

                      <label
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Upload file Excel yang sudah Anda isi"
                      >
                        <Upload className="size-3.5" />
                        <span>Upload Excel Bidding</span>
                        <input
                          ref={excelInputRef}
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleExcelUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Tabel Rincian Item */}
                  <div className="rounded-xl border border-border overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-muted/70 text-foreground sticky top-0 z-10 font-bold border-b border-border">
                          <tr>
                            <th className="py-2 px-3 text-center w-10">No</th>
                            <th className="py-2 px-3">Kode &amp; Nama Material</th>
                            <th className="py-2 px-3 text-center w-20">Volume</th>
                            <th className="py-2 px-3 w-40">Merk Ditawarkan</th>
                            <th className="py-2 px-3 text-right w-44">Harga Satuan (Rp)</th>
                            <th className="py-2 px-3 text-right w-44">Total (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 bg-card">
                          {items.map((it, idx) => (
                            <tr key={it.itemId} className="hover:bg-muted/30 transition">
                              <td className="py-2 px-3 text-center text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-foreground">{it.itemName}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{it.itemId}</div>
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-semibold">
                                {it.qty.toLocaleString('id-ID')} {packageData.items[idx]?.satuan || 'PCS'}
                              </td>
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={it.brandOffered || ''}
                                  onChange={(e) => handleItemBrandChange(it.itemId, e.target.value)}
                                  placeholder="Merk/Spesifikasi"
                                  className="w-full h-7 px-2 rounded border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={it.unitPrice || ''}
                                  onChange={(e) => handleItemPriceChange(it.itemId, Number(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full h-7 px-2 rounded border border-border bg-background text-foreground text-xs text-right font-mono font-semibold focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                Rp {(it.totalPrice || 0).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-[11px] text-muted-foreground">
                        Franco: <span className="font-semibold text-foreground">{francoDeliveryPoint}</span>
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="flex justify-between sm:justify-end gap-6 text-[11px] text-muted-foreground">
                          <span>Subtotal Penawaran:</span>
                          <span className="font-mono font-bold text-foreground">
                            Rp {subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between sm:justify-end gap-6 text-[11px] text-muted-foreground">
                          <span>PPN 11%:</span>
                          <span className="font-mono font-bold text-foreground">
                            Rp {ppnAmount.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between sm:justify-end gap-6 text-sm font-bold text-foreground pt-1 border-t border-border/80">
                          <span>Grand Total Penawaran:</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            Rp {grandTotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('download')}
                      className="px-3.5 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium text-xs transition cursor-pointer"
                    >
                      Kembali ke Berkas
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveStep('documents')}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs inline-flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>Lanjut: Unggah Dokumen Resmi</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: UNGGAH BERKAS DOKUMEN RESMI */}
              {activeStep === 'documents' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <FileText className="size-4 text-sky-500" />
                      <span>Surat Penawaran Resmi Bertanda Tangan &amp; Cap Vendor</span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Unggah scan surat penawaran harga resmi (Quotation Letter), brosur teknis, atau dokumen jaminan
                      keaslian barang dalam format PDF / Gambar (Maks. 15MB).
                    </p>

                    <div className="p-4 border-2 border-dashed border-border rounded-xl text-center space-y-2 hover:border-sky-500/50 transition">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                        <Upload className="size-5" />
                      </div>
                      {uploadedDocName ? (
                        <div className="space-y-1">
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            ✓ Berkas Terpilih: {uploadedDocName}
                          </p>
                          <button
                            type="button"
                            onClick={() => docInputRef.current?.click()}
                            className="text-[11px] text-sky-600 underline cursor-pointer"
                          >
                            Ganti file lain
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-medium text-foreground text-xs">
                            Tarik berkas PDF ke sini atau klik tombol di bawah
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Format yang didukung: PDF, PNG, JPG (Maks 15MB)
                          </p>
                        </div>
                      )}

                      <input
                        ref={docInputRef}
                        type="file"
                        accept=".pdf, .png, .jpg, .jpeg"
                        onChange={handleDocUpload}
                        className="hidden"
                      />

                      {!uploadedDocName && (
                        <button
                          type="button"
                          onClick={() => docInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold transition cursor-pointer"
                        >
                          Pilih Dokumen PDF
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ringkasan Akhir Sebelum Submit */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 space-y-2 text-xs">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      <span>Konfirmasi Pengiriman Penawaran Resmi</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        Perusahaan: <strong>{vendorName || '(Belum diisi)'}</strong>
                      </div>
                      <div>
                        PIC Kontak: <strong>{vendorPic || '-'} ({vendorContact || '-'})</strong>
                      </div>
                      <div>
                        Total Penawaran: <strong className="font-mono">Rp {grandTotal.toLocaleString('id-ID')}</strong> (Inc. PPN 11%)
                      </div>
                      <div>
                        Lampiran Dokumen: <strong>{uploadedDocName || 'Menggunakan data penawaran web'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep('pricing')}
                      className="px-3.5 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-medium text-xs transition cursor-pointer"
                    >
                      Kembali ke Harga
                    </button>
                    <button
                      type="button"
                      onClick={handleInitiateSubmit}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Lock className="size-4" />
                      <span>{isSubmitting ? 'Mengunci Penawaran...' : 'Kirimkan & Kunci Penawaran'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL KONFIRMASI FINAL KUNCI 1X SUBMIT (OPTION 3) */}
        {showConfirmLockModal && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setShowConfirmLockModal(false)}
          >
            <div
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Konfirmasi Pengiriman &amp; Kunci Penawaran
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paket: <strong className="font-mono text-foreground">{packageData.packageNumber}</strong>
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-800 dark:text-rose-300 text-xs space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-rose-600" />
                  <span>PERHATIAN: PENGISIAN HANYA 1 (SATU) KALI</span>
                </div>
                <p className="text-[11px]">
                  Setelah Anda menekan tombol di bawah, tautan penawaran ini akan <strong>SEKETIKA DIKUNCI PERMANEN</strong>. Anda tidak dapat lagi mengubah harga satuan, merk, ataupun mengunggah ulang dokumen penawaran dari tautan ini.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Perusahaan Rekanan:</span>
                  <span className="font-bold text-foreground">{vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nomor WhatsApp PIC:</span>
                  <span className="font-mono text-foreground">{vendorContact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dokumen Resmi:</span>
                  <span className="font-medium text-foreground">{uploadedDocName || 'Sudah dilampirkan'}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-border text-sm">
                  <span className="text-foreground">Total Penawaran:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeLockFinal}
                  onChange={(e) => setAgreeLockFinal(e.target.checked)}
                  className="size-4 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                />
                <span className="text-[11px] text-foreground font-medium leading-relaxed">
                  Saya menyatakan data penawaran di atas telah diverifikasi dengan benar, disetujui manajemen perusahaan, dan saya setuju bahwa tautan ini akan langsung dikunci secara permanen.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowConfirmLockModal(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-semibold cursor-pointer"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmitBid}
                  disabled={!agreeLockFinal || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lock className="size-3.5" />
                  <span>{isSubmitting ? 'Mengunci Penawaran...' : 'Ya, Kirim & Kunci Penawaran'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
          <span>PT Cindara Pratama Lines &bull; Electronic Bidding System</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
