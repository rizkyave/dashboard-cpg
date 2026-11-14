'use client';

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Package,
  Lock,
  Unlock,
  ShieldAlert,
  AlertTriangle,
  Printer,
  Check,
  X,
  Award,
  Trophy,
} from 'lucide-react';
import { PratenderPackage, VendorBidSubmission, VendorBidItem } from '@/types/pratender';
import { generateRksDocumentPdf, triggerBrowserPdfDownload } from '@/utils/tenderDocumentGenerator';
import { generateTenderBiddingExcel, parseTenderBiddingExcel } from '@/utils/tenderExcelBidding';
import { isNonMaterialOrSignature } from '@/utils/tenderSanitizer';

function VendorTenderPortalContent() {
  const searchParams = useSearchParams();
  const pkgId = searchParams.get('pkg');
  const searchToken = searchParams.get('token') || '';
  const searchPhone = searchParams.get('vphone') || '';
  const searchName = searchParams.get('vname') || '';

  const [packageData, setPackageData] = useState<PratenderPackage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stepper State
  const [activeStep, setActiveStep] = useState<'download' | 'pricing' | 'documents'>('pricing');

  // Vendor Identity
  const [vendorName, setVendorName] = useState(searchName);
  const [vendorPic, setVendorPic] = useState('');
  const [vendorContact, setVendorContact] = useState(searchPhone);
  const [quotationRefNo, setQuotationRefNo] = useState('');
  const [termOfPayment, setTermOfPayment] = useState('NET 30 Hari');
  const [deliveryLeadTimeDays, setDeliveryLeadTimeDays] = useState(7);
  const [francoDeliveryPoint, setFrancoDeliveryPoint] = useState('Gudang Somber Balikpapan / Dermaga CPG');

  // Item Bids State
  const [items, setItems] = useState<VendorBidItem[]>([]);

  // Uploaded Official Doc (PDF)
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingRks, setIsDownloadingRks] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [submissionReceiptId, setSubmissionReceiptId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Confirmation Modal Before Locking (Option 3)
  const [showConfirmLockModal, setShowConfirmLockModal] = useState(false);
  const [agreeLockFinal, setAgreeLockFinal] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Sync params if filled via URL
  useEffect(() => {
    if (searchName && !vendorName) setVendorName(searchName);
    if (searchPhone && !vendorContact) setVendorContact(searchPhone);
  }, [searchName, searchPhone]);

  // Fetch Package Info
  useEffect(() => {
    if (!pkgId) {
      setIsLoading(false);
      setLoadError('Tautan tender tidak valid atau parameter paket tidak disertakan.');
      return;
    }

    const loadPkg = async () => {
      try {
        const res = await fetch(`/api/pratender?_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.packages)) {
            const match = json.packages.find((p: PratenderPackage) => p.id === pkgId);
            if (match) {
              setPackageData(match);
              const validItems = (match.items || []).filter(
                (it: any) => !isNonMaterialOrSignature(it.itemName, it.itemId)
              );
              setItems(
                validItems.map((it: any) => ({
                  itemId: it.itemId,
                  itemName: it.itemName,
                  qty: it.totalQty,
                  unitPrice: 0,
                  totalPrice: 0,
                  brandOffered: '',
                  compliance: 'COMPLIANT',
                  notes: '',
                }))
              );
            } else {
              setLoadError(`Paket tender "${pkgId}" tidak ditemukan atau sudah ditutup.`);
            }
          }
        }
      } catch (err: any) {
        setLoadError(`Gagal menghubungi server tender: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadPkg();
  }, [pkgId]);

  // Deteksi apakah rekanan ini sudah pernah submit & statusnya terkunci (Option 3)
  const lockedBid = useMemo(() => {
    if (!packageData || !packageData.vendorBids || packageData.vendorBids.length === 0) return null;
    const cleanCurrentPhone = (vendorContact || searchPhone || '').replace(/[^0-9]/g, '');
    const cleanCurrentName = (vendorName || searchName || '').toLowerCase().trim();

    return packageData.vendorBids.find((b) => {
      if (!b.isLocked) return false;
      if (searchToken && b.token && b.token === searchToken) return true;
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
  }, [packageData, vendorContact, vendorName, searchToken, searchPhone, searchName]);

  // Deteksi apakah batas akhir penawaran telah lewat (Deadline Passed -> Masuk Masa Evaluasi)
  const isDeadlinePassed = useMemo(() => {
    if (!packageData || !packageData.targetClosingDate) return false;
    const raw = packageData.targetClosingDate;
    const closingDate = new Date(raw);
    if (isNaN(closingDate.getTime())) return false;
    // Jika format hanya YYYY-MM-DD, set ke akhir hari 23:59:59
    if (raw.length === 10) {
      closingDate.setHours(23, 59, 59, 999);
    }
    return Date.now() > closingDate.getTime();
  }, [packageData]);

  // Calculations
  const subtotal = items.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
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
    if (!packageData) return;
    setIsDownloadingRks(true);
    try {
      const pdfBytes = await generateRksDocumentPdf(packageData);
      triggerBrowserPdfDownload(pdfBytes, `DOKUMEN_RKS_RFQ_${packageData.packageNumber}.pdf`);
      showToast('Dokumen RKS & Syarat Tender berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengunduh RKS.', 'error');
    } finally {
      setIsDownloadingRks(false);
    }
  };

  // Handle download Excel Template
  const handleDownloadExcelTemplate = () => {
    if (!packageData) return;
    try {
      generateTenderBiddingExcel(packageData, vendorName);
      showToast('Template Excel Penawaran Harga berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat file Excel.', 'error');
    }
  };

  // Handle Upload Excel
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!packageData) return;
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

          showToast(
            `✓ Berhasil membaca penawaran Excel! Total Rp ${res.grandTotal?.toLocaleString('id-ID')}`,
            'success'
          );
        } else {
          showToast(res.message || 'Gagal membaca format Excel penawaran.', 'error');
        }
      } catch (err: any) {
        showToast(`Kesalahan membaca Excel: ${err.message}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle Document Upload
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas penawaran maksimal 15MB.', 'error');
      return;
    }

    setUploadedDocName(file.name);
    showToast(`Dokumen penawaran resmi "${file.name}" terpilih!`, 'success');
  };

  // Validasi & Buka Modal Konfirmasi Kunci 1x (Option 3)
  const handleInitiateSubmit = () => {
    if (!packageData) return;

    if (!vendorName.trim()) {
      showToast('Nama perusahaan rekanan wajib diisi.', 'error');
      setActiveStep('pricing');
      return;
    }

    if (!vendorContact.trim()) {
      showToast('Nomor WhatsApp kontak PIC rekanan wajib diisi.', 'error');
      setActiveStep('pricing');
      return;
    }

    if (items.some((it) => it.unitPrice <= 0)) {
      showToast('Semua item pengadaan wajib diisi harga penawarannya.', 'error');
      setActiveStep('pricing');
      return;
    }

    // Cek apakah nomor WA / perusahaan ini sudah terkunci
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
      showToast(
        `Nomor WhatsApp / Perusahaan ini sudah pernah mengirimkan penawaran resmi dan berstatus Terkunci.`,
        'error'
      );
      return;
    }

    setAgreeLockFinal(false);
    setShowConfirmLockModal(true);
  };

  // Submit Bid directly to CPG server & Permanently Lock (Option 3)
  const handleConfirmSubmitBid = async () => {
    if (!packageData || !agreeLockFinal) return;

    setIsSubmitting(true);
    setShowConfirmLockModal(false);

    const cleanNo = packageData.packageNumber.replace(/[^a-zA-Z0-9]/g, '');
    const receiptNo = `REC-CPG-${cleanNo}-${Date.now().toString(36).toUpperCase()}`;
    const cleanPhone = vendorContact.replace(/[^0-9]/g, '');
    const currentToken = searchToken || `VND-${cleanPhone || Date.now().toString(36).toUpperCase()}`;

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
      ppnPercent: 11,
      ppnAmount,
      deliveryFee: 0,
      grandTotal,
      technicalStatus: 'PASSED',
      status: 'SUBMITTED',
      negotiatedGrandTotal: grandTotal,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      receiptNumber: receiptNo,
      token: currentToken,
      officialDocName: uploadedDocName || undefined,
    };

    const existingBids = packageData.vendorBids || [];
    const updatedBids = [
      ...existingBids.filter(
        (b) =>
          b.vendorName.toLowerCase().trim() !== newSubmission.vendorName.toLowerCase().trim() &&
          (!newSubmission.vendorContact || b.vendorContact !== newSubmission.vendorContact)
      ),
      newSubmission,
    ];

    const updatedPkg: PratenderPackage = {
      ...packageData,
      status: packageData.status === 'DRAFT' || packageData.status === 'RFQ_SENT' ? 'EVALUATION' : packageData.status,
      vendorBids: updatedBids,
    };

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
        setSubmissionReceiptId(receiptNo);
        setIsSubmittedSuccess(true);
        setPackageData(updatedPkg);
        showToast('Penawaran resmi berhasil dikirim dan tautan telah dikunci!', 'success');
      } else {
        showToast('Gagal mengirimkan penawaran ke server.', 'error');
      }
    } catch (err: any) {
      showToast(`Kesalahan server: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="size-10 rounded-full border-3 border-sky-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Menghubungkan ke Portal Tender PT Cindara Pratama Lines...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !packageData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="size-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
            <Building2 className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Akses Portal Tidak Ditemukan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {loadError || 'Paket tender tidak ditemukan.'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            Silakan hubungi Tim Pengadaan PT Cindara Pratama Lines via WhatsApp untuk verifikasi tautan penawaran Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between text-xs">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-600'
              : toastMsg.type === 'error'
              ? 'bg-rose-500 text-white border-rose-600'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Portal Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 py-4 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Building2 className="size-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                PT CINDARA PRATAMA LINES
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Portal Resmi Pengadaan Barang &amp; Jasa Armada &bull; Electronic Bidding System
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20">
              {packageData.packageNumber}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Tender Package Banner */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {packageData.packageNumber}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Kategori: {packageData.category}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                {packageData.title}
              </h2>
            </div>

            <div className="text-left sm:text-right text-xs">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                Batas Akhir Penawaran
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {packageData.targetClosingDate || 'Sesuai Jadwal RKS'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {packageData.description ||
              'Pengadaan material operasional armada PT Cindara Pratama Lines. Rekanan diundang untuk menyampaikan penawaran harga resmi.'}
          </p>
        </div>

        {/* VIEW JIKA TENDER TELAH SELESAI & MASUK MASA SANGGAH / PO TERBIT */}
        {(packageData.status === 'AWARDED' || packageData.status === 'COMPLETED') ? (
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center border-2 border-purple-500/25 shadow-xs">
                <Award className="size-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-500/30">
                  <ShieldCheck className="size-3.5" />
                  <span>PROSES TENDER SELESAI &bull; PEMENANG TELAH DITETAPKAN</span>
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                  Paket {packageData.packageNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Evaluasi tabulasi harga komparasi (CBT) dan verifikasi teknis telah tuntas dilaksanakan oleh Panitia Pengadaan PT Cindara Pratama Lines.
                </p>
              </div>
            </div>

            {/* Informasi Hasil & Masa Sanggah */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Pemenang Tender:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {packageData.awardedVendor || packageData.evaluationSummary?.winningVendorName || 'PT Rekanan Terpilih'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Status Tahapan:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {packageData.status === 'COMPLETED'
                    ? 'Purchase Order (PO) Telah Diterbitkan'
                    : 'Masa Sanggah 3 Hari Kalender'}
                </span>
              </div>
              {packageData.evaluationSummary?.standstillEndsAt && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Batas Akhir Sanggahan:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {new Date(packageData.evaluationSummary.standstillEndsAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
                  </span>
                </div>
              )}
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Seluruh formulir penawaran harga rekanan telah <strong>DITUTUP PERMANEN</strong> demi menjaga tertib administrasi dan integritas audit proses pengadaan.
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        ) : isDeadlinePassed ? (
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border-2 border-amber-500/25 shadow-xs">
                <Clock className="size-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30">
                  <Lock className="size-3.5" />
                  <span>PEMASUKAN PENAWARAN DITUTUP &bull; TAHAP EVALUASI</span>
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                  Paket {packageData.packageNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Batas waktu penawaran telah resmi berakhir. Seluruh berkas yang masuk sedang dalam tahap <strong>Evaluasi Teknis &amp; Tabulasi Komparasi (SLA 1–2 Hari Kerja)</strong> oleh Panitia Pengadaan.
                </p>
              </div>
            </div>

            {/* Informasi Penutupan & SLA */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Batas Akhir Penawaran:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {packageData.targetClosingDate ? new Date(packageData.targetClosingDate).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Telah Berakhir'} WIB
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Status Tahapan:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  Evaluasi Administrasi &amp; Teknis (SLA 1-2 Hari)
                </span>
              </div>
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Sesuai tata tertib pengadaan tender, dokumen atau revisi harga susulan yang disampaikan setelah batas waktu <strong>tidak dapat diterima</strong> demi kepatuhan SOP pengadaan armada.
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        ) : lockedBid || isSubmittedSuccess ? (
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
            {/* Header Lock Icon & Badge */}
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border-2 border-amber-500/25 shadow-xs">
                <Lock className="size-8" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30">
                  <ShieldCheck className="size-3.5" />
                  <span>TAUTAN TERKUNCI &bull; SATU KALI PENGISIAN</span>
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2">
                  {lockedBid?.vendorName || vendorName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Penawaran resmi rekanan telah berhasil dicatat oleh sistem pengadaan PT Cindara Pratama Lines. Untuk menjaga integritas proses tender, tautan ini telah <strong>DIKUNCI PERMANEN</strong>.
                </p>
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Nomor Tanda Terima:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {lockedBid?.receiptNumber || submissionReceiptId || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Waktu Penguncian:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lockedBid?.lockedAt
                    ? new Date(lockedBid.lockedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                    : new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Kontak PIC / WhatsApp:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lockedBid?.vendorPic || vendorPic || '-'} ({lockedBid?.vendorContact || vendorContact || '-'})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Surat Penawaran Resmi:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Check className="size-3 text-emerald-600" />
                  <span className="truncate max-w-[200px]">
                    {lockedBid?.officialDocName || uploadedDocName || 'Dokumen Penawaran Terlampir'}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-sm font-bold">
                <span className="text-slate-700 dark:text-slate-300">Total Penawaran (Inc. PPN):</span>
                <span className="text-emerald-600 font-mono">
                  Rp {(lockedBid?.grandTotal || grandTotal).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadRks}
                disabled={isDownloadingRks}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="size-3.5 text-sky-500" />
                <span>Unduh Dokumen RKS</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Printer className="size-3.5" />
                <span>Cetak Bukti Tanda Terima</span>
              </button>
            </div>

            {/* Notice Bantuan Admin Unlock */}
            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-left text-xs space-y-1">
              <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-sky-600" />
                <span>Permohonan Pembukaan Kunci (Unlock)</span>
              </div>
              <p className="text-[11px] text-sky-700/80 dark:text-sky-400 leading-relaxed">
                Jika terdapat kesalahan teknis fatal pada file lampiran atau harga sebelum batas akhir penawaran, silakan hubungi <strong>Panitia Pengadaan PT Cindara Pratama Lines</strong> via WhatsApp. Panitia memiliki wewenang untuk membuka kembali akses formulir rekanan secara resmi.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Download Berkas Pengadaan */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="size-4 text-sky-500" />
                <span>1. Unduh Berkas &amp; Ketentuan Tender</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="size-6 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Dokumen RKS &amp; Spesifikasi (PDF)</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ketentuan umum, syarat kualifikasi, dan spesifikasi teknis barang.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadRks}
                    disabled={isDownloadingRks}
                    className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="size-3.5" />
                    <span>{isDownloadingRks ? 'Membuat PDF...' : 'Unduh Dokumen RKS'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="size-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs">Template Excel Penawaran Harga</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Blanko resmi {packageData.items.length} item material. Tinggal isi kolom harga satuan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="w-full py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    <span>Unduh Template Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Data Rekanan & Input Harga */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="size-4 text-sky-500" />
                <span>2. Data Perusahaan &amp; Penawaran Harga Rekanan</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nama Perusahaan Rekanan *
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="PT. Pelayaran Rekanan..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nama PIC Rekanan
                  </label>
                  <input
                    type="text"
                    value={vendorPic}
                    onChange={(e) => setVendorPic(e.target.value)}
                    placeholder="Nama kontak penanggung jawab"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    No. WhatsApp PIC
                  </label>
                  <input
                    type="text"
                    value={vendorContact}
                    onChange={(e) => setVendorContact(e.target.value)}
                    placeholder="0812..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nomor Surat Penawaran (Quotation Ref)
                  </label>
                  <input
                    type="text"
                    value={quotationRefNo}
                    onChange={(e) => setQuotationRefNo(e.target.value)}
                    placeholder="QTN/..."
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Syarat Pembayaran (TOP)
                  </label>
                  <select
                    value={termOfPayment}
                    onChange={(e) => setTermOfPayment(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    <option value="COD / 14 Hari">COD / 14 Hari</option>
                    <option value="NET 30 Hari">NET 30 Hari</option>
                    <option value="NET 45 Hari">NET 45 Hari</option>
                    <option value="NET 60 Hari">NET 60 Hari</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Lead Time Pengiriman (Hari)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={deliveryLeadTimeDays}
                    onChange={(e) => setDeliveryLeadTimeDays(Number(e.target.value) || 1)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Upload Excel Quick Fill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Daftar Penawaran Harga Material ({items.length} Item)
                </span>
                <label className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                  <Upload className="size-3.5" />
                  <span>Upload Excel Bidding yang Sudah Diisi</span>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Items Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-10 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">No</th>
                        <th className="py-2 px-3">Kode &amp; Nama Material</th>
                        <th className="py-2 px-3 text-center w-24">Kebutuhan</th>
                        <th className="py-2 px-3 w-40">Merk Ditawarkan</th>
                        <th className="py-2 px-3 text-right w-44">Harga Satuan (Rp)</th>
                        <th className="py-2 px-3 text-right w-44">Total (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {items.map((it, idx) => (
                        <tr key={it.itemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{it.itemName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{it.itemId}</div>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold">
                            {it.qty} {packageData.items[idx]?.satuan || 'PCS'}
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={it.brandOffered || ''}
                              onChange={(e) => handleItemBrandChange(it.itemId, e.target.value)}
                              placeholder="Merk/Tipe"
                              className="w-full h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={it.unitPrice || ''}
                              onChange={(e) => handleItemPriceChange(it.itemId, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full h-7 px-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-right font-mono font-semibold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            Rp {(it.totalPrice || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    Franco: <strong>{francoDeliveryPoint}</strong>
                  </span>
                  <div className="space-y-1 text-right">
                    <div className="flex justify-between sm:justify-end gap-6 text-[11px] text-slate-500">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        Rp {subtotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between sm:justify-end gap-6 text-[11px] text-slate-500">
                      <span>PPN 11%:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        Rp {ppnAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between sm:justify-end gap-6 text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-600">
                        Rp {grandTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Unggah Dokumen Resmi & Submit */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="size-4 text-sky-500" />
                <span>3. Unggah Surat Penawaran Resmi &amp; Pengiriman</span>
              </h3>

              <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center space-y-2">
                {uploadedDocName ? (
                  <p className="font-bold text-emerald-600 text-xs">
                    ✓ Berkas Terpilih: {uploadedDocName}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Unggah scan surat penawaran resmi bertanda tangan &amp; stempel (Format PDF / Gambar, Maks 15MB)
                  </p>
                )}
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf, .png, .jpg, .jpeg"
                  onChange={handleDocUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
                >
                  {uploadedDocName ? 'Ganti Berkas PDF' : 'Pilih Berkas PDF'}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleInitiateSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Lock className="size-4" />
                  <span>{isSubmitting ? 'Mengirimkan...' : 'Kirimkan & Kunci Penawaran Resmi'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI FINAL KUNCI 1X SUBMIT (OPTION 3) */}
        {showConfirmLockModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setShowConfirmLockModal(false)}
          >
            <div
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/25">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Konfirmasi Pengiriman &amp; Kunci Penawaran
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paket Tender: <strong className="font-mono">{packageData.packageNumber}</strong>
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

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Perusahaan Rekanan:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor WhatsApp PIC:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{vendorContact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Surat Penawaran:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{uploadedDocName || 'Sudah dilampirkan'}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200 dark:border-slate-800 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Total Penawaran:</span>
                  <span className="text-emerald-600 font-mono">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeLockFinal}
                  onChange={(e) => setAgreeLockFinal(e.target.checked)}
                  className="size-4 rounded text-emerald-600 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  Saya menyatakan data penawaran di atas telah diverifikasi dengan benar, disetujui manajemen perusahaan, dan saya setuju bahwa tautan ini akan langsung dikunci secara permanen.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConfirmLockModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
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
      </main>

      {/* Portal Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-center text-[11px] text-slate-400">
        &copy; {new Date().getFullYear()} PT Cindara Pratama Lines &bull; Divisi Pengadaan &amp; Logistik Armada
      </footer>
    </div>
  );
}

export default function VendorTenderPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="size-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <VendorTenderPortalContent />
    </Suspense>
  );
}
