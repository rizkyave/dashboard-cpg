'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Award,
  TrendingDown,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  DollarSign,
  Scale,
  ShieldCheck,
  Send,
  Printer,
  Copy,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  FileText,
  BadgePercent,
  Check,
  Truck,
  Calendar,
  Download,
  Lock,
  Unlock,
  Trophy,
} from 'lucide-react';
import {
  generatePoAwardDocumentPdf,
  triggerBrowserPdfDownload,
} from '@/utils/tenderDocumentGenerator';
import {
  PratenderPackage,
  VendorBidSubmission,
  VendorBidItem,
  ProcurementMethod,
  TenderEvaluationSummary,
} from '@/types/pratender';
import { sanitizeTenderPackage } from '@/utils/tenderSanitizer';
import {
  getStoredTenderApprovalSettings,
  determineRequiredApprovalTier,
  checkUserCanReleaseTier,
  TenderApprovalTierConfig,
} from '@/utils/tenderApprovalConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  packageData: PratenderPackage;
  onSavePackage: (updated: PratenderPackage) => Promise<void>;
  userRole?: string;
  userName?: string;
}

type CbtSubTab = 'matrix' | 'scoring' | 'negotiation' | 'awarding';

export default function CommercialBidTabulationModal({
  isOpen,
  onClose,
  packageData: rawPackageData,
  onSavePackage,
  userRole = 'staf_purchasing',
  userName = 'Staf Pengadaan',
}: Props) {
  const packageData = useMemo(() => sanitizeTenderPackage(rawPackageData), [rawPackageData]);
  const [activeTab, setActiveTab] = useState<CbtSubTab>('matrix');
  const [bids, setBids] = useState<VendorBidSubmission[]>(
    packageData.vendorBids || []
  );
  const [isAddingBid, setIsAddingBid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form New Bid State
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPic, setNewVendorPic] = useState('');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [newQuotationRef, setNewQuotationRef] = useState('');
  const [newTop, setNewTop] = useState('NET 30 Hari');
  const [newLeadTime, setNewLeadTime] = useState(7);
  const [newDeliveryPoint, setNewDeliveryPoint] = useState('Franco Dermaga Somber Balikpapan');
  const [newDeliveryFee, setNewDeliveryFee] = useState(0);
  const [newPpnPercent, setNewPpnPercent] = useState<number>(11);
  const [newItemPrices, setNewItemPrices] = useState<Record<string, number>>({});
  const [newItemBrands, setNewItemBrands] = useState<Record<string, string>>({});

  // Negotiation BAFO State
  const [negotiatedTotals, setNegotiatedTotals] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    bids.forEach((b) => {
      map[b.id] = b.negotiatedGrandTotal || b.grandTotal;
    });
    return map;
  });
  const [negotiationNotes, setNegotiationNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    bids.forEach((b) => {
      map[b.id] = b.negotiationNotes || '';
    });
    return map;
  });

  // Technical Evaluation State (Status Kategori 1: 'PASSED' = Lolos Syarat Teknis, 'FAILED' = Tidak Lolos Evaluasi I)
  const [technicalStatuses, setTechnicalStatuses] = useState<Record<string, 'PASSED' | 'FAILED'>>(() => {
    const map: Record<string, 'PASSED' | 'FAILED'> = {};
    bids.forEach((b) => {
      map[b.id] = b.technicalStatus || 'PASSED';
    });
    return map;
  });

  // Awarding & Approval State: null = otomatis mengikuti harga BAFO terendah peringkat 1 (rekomendasi sistem)
  const [manualOverrideWinnerId, setManualOverrideWinnerId] = useState<string | null>(
    packageData.evaluationSummary?.winningVendorId || null
  );
  const [approvalNotes, setApprovalNotes] = useState<string>(
    packageData.evaluationSummary?.approvalNotes || ''
  );

  // SAP Release Status State
  const [evalApprovalStatus, setEvalApprovalStatus] = useState<'PENDING_APPROVAL' | 'APPROVED'>(
    packageData.evaluationSummary?.approvalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL'
  );
  const [evalApprovedBy, setEvalApprovedBy] = useState<string | undefined>(
    packageData.evaluationSummary?.approvedBy
  );
  const [evalApprovedAt, setEvalApprovedAt] = useState<string | undefined>(
    packageData.evaluationSummary?.approvedAt
  );

  // Masa Sanggah 3 Hari State (Standstill Period)
  const [standstillStatus, setStandstillStatus] = useState<'IN_PROGRESS' | 'COMPLETED_NO_DISPUTE' | 'DISPUTED'>(
    packageData.evaluationSummary?.standstillStatus || 'IN_PROGRESS'
  );
  const [disputeNotes, setDisputeNotes] = useState<string>(
    packageData.evaluationSummary?.disputeNotes || ''
  );

  // Switch Technical Status with Winner Auto-Correction
  const handleSetTechnicalStatus = (bidId: string, status: 'PASSED' | 'FAILED') => {
    setTechnicalStatuses((prev) => {
      const updated = { ...prev, [bidId]: status };
      if (status === 'FAILED' && manualOverrideWinnerId === bidId) {
        setManualOverrideWinnerId(null);
      }
      return updated;
    });
  };

  // Calculate HPS Total
  const totalHps = useMemo(() => {
    if (packageData.ownerEstimateHps && packageData.ownerEstimateHps > 0) {
      return packageData.ownerEstimateHps;
    }
    if (packageData.totalEstimatedBudget && packageData.totalEstimatedBudget > 0) {
      return packageData.totalEstimatedBudget;
    }
    return packageData.items.reduce((acc, it) => acc + (it.targetTotalPrice || (it.targetPrice || 0) * it.totalQty), 0);
  }, [packageData]);

  // Ranking Bids: Evaluasi Kategori 1 (Syarat Teknis Pass/Fail) -> Kategori 2 (Harga Terendah Responsif)
  const rankedBids = useMemo(() => {
    const passedList = bids.filter((b) => (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'PASSED');
    const failedList = bids.filter((b) => (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'FAILED');

    passedList.sort((a, b) => {
      const priceA = negotiatedTotals[a.id] !== undefined ? negotiatedTotals[a.id] : (a.negotiatedGrandTotal || a.grandTotal);
      const priceB = negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : (b.negotiatedGrandTotal || b.grandTotal);
      return priceA - priceB;
    });

    failedList.sort((a, b) => {
      const priceA = negotiatedTotals[a.id] !== undefined ? negotiatedTotals[a.id] : (a.negotiatedGrandTotal || a.grandTotal);
      const priceB = negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : (b.negotiatedGrandTotal || b.grandTotal);
      return priceA - priceB;
    });

    const rankedPassed = passedList.map((bid, idx) => ({
      ...bid,
      ranking: idx + 1,
      isDisqualified: false,
      technicalStatus: 'PASSED' as const,
    }));

    const rankedFailed = failedList.map((bid, idx) => ({
      ...bid,
      ranking: passedList.length + idx + 1,
      isDisqualified: true,
      technicalStatus: 'FAILED' as const,
    }));

    return [...rankedPassed, ...rankedFailed];
  }, [bids, negotiatedTotals, technicalStatuses]);

  // Find lowest price per item across all bids
  const lowestPricePerItem = useMemo(() => {
    const map: Record<string, number> = {};
    packageData.items.forEach((item) => {
      let min = Infinity;
      bids.forEach((b) => {
        const line = b.items.find((i) => i.itemId === item.itemId);
        if (line && line.unitPrice > 0 && line.unitPrice < min) {
          min = line.unitPrice;
        }
      });
      if (min !== Infinity) map[item.itemId] = min;
    });
    return map;
  }, [bids, packageData.items]);

  if (!isOpen) return null;

  // Handler: Pre-fill realistic mock vendors (like Pertamina / PTK / SAP simulation)
  const handlePreFillMockBids = () => {
    const mockVendors: VendorBidSubmission[] = [
      {
        id: `bid-1-${Date.now()}`,
        vendorName: 'PT. Samudra Bahari Teknik',
        vendorPic: 'Bpk. Hendra Gunawan',
        vendorContact: '+62 812-8877-6655',
        quotationRefNo: `SBT/QUO/${new Date().getFullYear()}/0421`,
        bidDate: new Date().toISOString().split('T')[0],
        termOfPayment: 'NET 30 Hari',
        deliveryLeadTimeDays: 5,
        francoDeliveryPoint: 'Franco Dermaga Somber Balikpapan',
        validityDays: 30,
        subtotal: 0,
        ppnPercent: 11,
        ppnAmount: 0,
        deliveryFee: 1500000,
        grandTotal: 0,
        status: 'SUBMITTED',
        items: [],
      },
      {
        id: `bid-2-${Date.now()}`,
        vendorName: 'CV. Cipta Marine Mandiri',
        vendorPic: 'Ibu Ratna Dewi',
        vendorContact: '+62 813-9988-1122',
        quotationRefNo: `CMM-RFQ-26-891`,
        bidDate: new Date().toISOString().split('T')[0],
        termOfPayment: 'NET 45 Hari',
        deliveryLeadTimeDays: 7,
        francoDeliveryPoint: 'Franco Dermaga Somber Balikpapan',
        validityDays: 30,
        subtotal: 0,
        ppnPercent: 11,
        ppnAmount: 0,
        deliveryFee: 2000000,
        grandTotal: 0,
        status: 'SUBMITTED',
        items: [],
      },
      {
        id: `bid-3-${Date.now()}`,
        vendorName: 'PT. Pelayaran Global Nusantara Supply',
        vendorPic: 'Bpk. Dimas Pratama',
        vendorContact: '+62 821-4433-2211',
        quotationRefNo: `PGN/P/2026/019`,
        bidDate: new Date().toISOString().split('T')[0],
        termOfPayment: 'COD / 14 Hari',
        deliveryLeadTimeDays: 4,
        francoDeliveryPoint: 'Franco Gudang Transit Balikpapan',
        validityDays: 14,
        subtotal: 0,
        ppnPercent: 11,
        ppnAmount: 0,
        deliveryFee: 1000000,
        grandTotal: 0,
        status: 'SUBMITTED',
        items: [],
      },
    ];

    // Variasi harga realistis (Vendor 1 ~ 95% HPS, Vendor 2 ~ 102% HPS, Vendor 3 ~ 92% HPS)
    const factorProfiles = [0.94, 1.03, 0.91];

    mockVendors.forEach((v, vIdx) => {
      const factor = factorProfiles[vIdx] || 1.0;
      let sub = 0;
      v.items = packageData.items.map((it, itIdx) => {
        const baseHps = it.targetPrice && it.targetPrice > 0 ? it.targetPrice : 75000;
        // berikan sedikit variasi tiap item
        const jitter = 1 + ((itIdx % 3) - 1) * 0.03;
        const uPrice = Math.round((baseHps * factor * jitter) / 500) * 500;
        const tot = uPrice * it.totalQty;
        sub += tot;
        return {
          itemId: it.itemId,
          itemName: it.itemName,
          qty: it.totalQty,
          unitPrice: uPrice,
          totalPrice: tot,
          brandOffered: 'Original / Sesuai RKS Spek',
          compliance: 'COMPLIANT',
        };
      });
      v.subtotal = sub;
      v.ppnAmount = Math.round((sub * v.ppnPercent) / 100);
      v.grandTotal = v.subtotal + v.ppnAmount + v.deliveryFee;
      v.negotiatedGrandTotal = v.grandTotal;
      v.technicalStatus = 'PASSED';
    });

    const newTechMap: Record<string, 'PASSED' | 'FAILED'> = {};
    mockVendors.forEach((v) => {
      newTechMap[v.id] = 'PASSED';
    });
    setTechnicalStatuses(newTechMap);

    setBids(mockVendors);
    setManualOverrideWinnerId(null); // Otomatis pilih vendor terendah
    setSuccessMsg('Simulasi 3 penawaran rekanan berhasil dimuat!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Handler: Add Single Vendor Bid
  const handleSaveNewBid = () => {
    if (!newVendorName.trim()) {
      alert('Nama Vendor / Rekanan wajib diisi!');
      return;
    }

    let subtotal = 0;
    const bidItems: VendorBidItem[] = packageData.items.map((it) => {
      const uPrice = Number(newItemPrices[it.itemId] || 0);
      const total = uPrice * it.totalQty;
      subtotal += total;
      return {
        itemId: it.itemId,
        itemName: it.itemName,
        qty: it.totalQty,
        unitPrice: uPrice,
        totalPrice: total,
        brandOffered: newItemBrands[it.itemId] || 'Sesuai Spesifikasi RKS',
        compliance: 'COMPLIANT',
      };
    });

    const ppnAmount = Math.round((subtotal * newPpnPercent) / 100);
    const grandTotal = subtotal + ppnAmount + Number(newDeliveryFee || 0);

    const newBid: VendorBidSubmission = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      vendorName: newVendorName.trim(),
      vendorPic: newVendorPic.trim() || undefined,
      vendorContact: newVendorContact.trim() || undefined,
      quotationRefNo: newQuotationRef.trim() || undefined,
      bidDate: new Date().toISOString().split('T')[0],
      termOfPayment: newTop,
      deliveryLeadTimeDays: Number(newLeadTime) || 7,
      francoDeliveryPoint: newDeliveryPoint,
      validityDays: 30,
      items: bidItems,
      subtotal,
      ppnPercent: newPpnPercent,
      ppnAmount,
      deliveryFee: Number(newDeliveryFee || 0),
      grandTotal,
      negotiatedGrandTotal: grandTotal,
      technicalStatus: 'PASSED',
      status: 'SUBMITTED',
    };

    const updated = [...bids, newBid];
    setBids(updated);
    setTechnicalStatuses((prev) => ({ ...prev, [newBid.id]: 'PASSED' }));
    setIsAddingBid(false);

    // Reset Form
    setNewVendorName('');
    setNewVendorPic('');
    setNewVendorContact('');
    setNewQuotationRef('');
    setNewDeliveryFee(0);
    setNewItemPrices({});
    setNewItemBrands({});

    setSuccessMsg(`Penawaran ${newBid.vendorName} berhasil ditambahkan ke matriks!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDeleteBid = (bidId: string) => {
    if (!confirm('Hapus penawaran rekanan ini dari matriks tabulasi?')) return;
    const updated = bids.filter((b) => b.id !== bidId);
    setBids(updated);
    if (manualOverrideWinnerId === bidId) {
      setManualOverrideWinnerId(null);
    }
  };

  // Toggle Kunci / Buka Kunci Portal Rekanan (Option 3)
  const handleToggleLockBid = async (bidId: string) => {
    const target = bids.find((b) => b.id === bidId);
    if (!target) return;

    const willLock = !target.isLocked;
    const confirmMsg = willLock
      ? `Kunci portal penawaran untuk ${target.vendorName}? Rekanan tidak akan dapat mengubah penawarannya.`
      : `Buka kunci portal penawaran untuk ${target.vendorName}? Rekanan akan dapat mengakses portal kembali untuk melakukan perbaikan/input ulang.`;

    if (!confirm(confirmMsg)) return;

    const updatedBids = bids.map((b) => {
      if (b.id === bidId) {
        return {
          ...b,
          isLocked: willLock,
          lockedAt: willLock ? new Date().toISOString() : b.lockedAt,
          unlockedAt: !willLock ? new Date().toISOString() : undefined,
          unlockedBy: !willLock ? userName : undefined,
        };
      }
      return b;
    });

    setBids(updatedBids);
    const updatedPkg: PratenderPackage = {
      ...packageData,
      vendorBids: updatedBids,
    };

    try {
      await onSavePackage(updatedPkg);
      setSuccessMsg(
        willLock
          ? `Portal rekanan ${target.vendorName} berhasil dikunci!`
          : `Kunci portal ${target.vendorName} dibuka! Rekanan dapat menginput ulang.`
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Gagal memperbarui status kunci penawaran:', err);
    }
  };

  // Save full state back to Package and API
  const handleSaveAllToPackage = async (
    finalStatus?: 'EVALUATION' | 'AWARDED' | 'COMPLETED',
    extraOverrides?: Partial<TenderEvaluationSummary>
  ) => {
    // Validasi SAP Release Strategy: Tidak boleh terbitkan PO jika belum di-release oleh pejabat tier terkait
    if (finalStatus === 'COMPLETED' && evalApprovalStatus !== 'APPROVED') {
      alert(
        `Penerbitan PO Dikunci!\n\nNilai kontrak sebesar Rp ${(winningBidValue || 0).toLocaleString(
          'id-ID'
        )} memerlukan otorisasi release resmi dari ${requiredTier.authorizedRoleLabel} (${
          requiredTier.name
        }) sebelum PO dapat diterbitkan ke sistem ERP.`
      );
      return;
    }

    // Validasi Masa Sanggah: Tidak boleh terbitkan PO jika ada tangguhan rekanan yang belum selesai
    if (finalStatus === 'COMPLETED' && standstillStatus === 'DISPUTED') {
      alert(
        `Penerbitan PO Ditahan!\n\nPaket ini masih dalam status Sanggahan Rekanan (Disputed).\nCatatan: "${disputeNotes}"\n\nSelesaikan tindak lanjut sanggahan terlebih dahulu sebelum menerbitkan Purchase Order.`
      );
      return;
    }

    setIsSaving(true);
    try {
      // Find winning vendor details (strictly from technically eligible bids)
      const winner = winningBid;
      const winVal = winningBidValue;
      const costSaving = totalHps > 0 && winVal ? totalHps - winVal : 0;
      const costSavingPct = totalHps > 0 && winVal ? Math.round((costSaving / totalHps) * 1000) / 10 : 0;

      // Inisiasi Masa Sanggah 3 Hari Kalender
      const now = new Date();
      const stStarted = packageData.evaluationSummary?.standstillStartedAt || (finalStatus === 'AWARDED' ? now.toISOString() : undefined);
      const stEnds = packageData.evaluationSummary?.standstillEndsAt || (finalStatus === 'AWARDED' ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : undefined);
      let stStatus = standstillStatus;
      if (finalStatus === 'COMPLETED') {
        stStatus = 'COMPLETED_NO_DISPUTE';
      }

      const evalSummary: TenderEvaluationSummary = {
        evaluatedBy: userName,
        evaluatedAt: new Date().toISOString(),
        recommendationNotes: `Direkomendasikan pemenang tender kepada ${winner?.vendorName || '-'} berdasarkan evaluasi komparasi harga terendah responsif (CBT) dan kepatuhan RKS.`,
        winningVendorId: winner?.id,
        winningVendorName: winner?.vendorName,
        winningAmount: winVal,
        costSavingVsHps: costSaving,
        costSavingPercent: costSavingPct,
        approvalLevel:
          requiredTier.authorizedRole === 'supervisor'
            ? 'SUPERVISOR'
            : requiredTier.authorizedRole === 'manager'
            ? 'MANAGER'
            : 'DIREKSI',
        approvalStatus: evalApprovalStatus,
        approvedBy: evalApprovedBy,
        approvedAt: evalApprovedAt,
        releaseTierId: requiredTier.id,
        releaseTierName: requiredTier.name,
        isPoReleased: evalApprovalStatus === 'APPROVED',
        poReleasedAt: evalApprovalStatus === 'APPROVED' ? evalApprovedAt : undefined,
        poReleasedBy: evalApprovalStatus === 'APPROVED' ? evalApprovedBy : undefined,
        approvalNotes: approvalNotes,
        baepNumber: `BAEP-${packageData.packageNumber.replace('PKG-', '')}`,
        standstillStartedAt: stStarted,
        standstillEndsAt: stEnds,
        standstillStatus: stStatus,
        disputeNotes: disputeNotes,
        ...(extraOverrides || {}),
      };

      // Prepare updated bids with negotiation values and technical evaluation status
      const updatedBids = bids.map((b) => {
        const isFailed = (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'FAILED';
        return {
          ...b,
          technicalStatus: isFailed ? ('FAILED' as const) : ('PASSED' as const),
          negotiatedGrandTotal: negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : b.grandTotal,
          negotiationNotes: negotiationNotes[b.id] || b.negotiationNotes,
          status: isFailed
            ? ('REJECTED' as const)
            : b.id === winner?.id
            ? ('RECOMMENDED' as const)
            : ('UNDER_EVALUATION' as const),
        };
      });

      let newStatus = finalStatus || packageData.status;
      if (bids.length > 0 && newStatus === 'DRAFT') {
        newStatus = 'EVALUATION';
      }

      // If completing, auto-generate PO
      let generatedPo = packageData.poNumberGenerated;
      if (finalStatus === 'COMPLETED' && !generatedPo) {
        const entityPrefix = packageData.items[0]?.vessels[0]?.split(' ')[0] || 'CPL';
        const poSeq = Math.floor(10000 + Math.random() * 90000);
        generatedPo = `${entityPrefix}-PO-26-${poSeq}`;
      }

      const updatedPackage: PratenderPackage = {
        ...packageData,
        status: newStatus,
        vendorBids: updatedBids,
        evaluationSummary: evalSummary,
        awardedVendor: winner?.vendorName,
        awardedValue: winVal,
        poNumberGenerated: generatedPo,
        updatedAt: new Date().toISOString(),
      };

      await onSavePackage(updatedPackage);

      // Jika aksi Terbitkan PO (COMPLETED), otomatis unduhkan berkas PDF Purchase Order resmi kepada pemenang
      if (finalStatus === 'COMPLETED' && generatedPo) {
        try {
          const poBytes = await generatePoAwardDocumentPdf(updatedPackage, generatedPo);
          triggerBrowserPdfDownload(poBytes, `PURCHASE_ORDER_${generatedPo}_${winner?.vendorName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        } catch (pdfErr) {
          console.warn('Gagal mengunduh otomatis PDF PO:', pdfErr);
        }
      }

      setSuccessMsg(
        finalStatus === 'COMPLETED'
          ? `✓ Purchase Order ${generatedPo} berhasil diterbitkan & dokumen PDF PO resmi otomatis diunduh!`
          : 'Seluruh matriks komparasi & penetapan tender berhasil disahkan!'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Copy Berita Acara Evaluasi Pengadaan
  const handleCopyBaep = () => {
    const eligibleBids = rankedBids.filter((b) => !b.isDisqualified);
    const winner = (selectedWinnerId ? eligibleBids.find((b) => b.id === selectedWinnerId) : null) || eligibleBids[0] || rankedBids[0];
    const winVal = winner
      ? (negotiatedTotals[winner.id] !== undefined
          ? negotiatedTotals[winner.id]
          : (winner.negotiatedGrandTotal || winner.grandTotal))
      : 0;
    const saving = totalHps - winVal;

    const baepText = `================================================
BERITA ACARA EVALUASI PENGADAAN & PENETAPAN PEMENANG (BAEP)
No. Dokumen: BAEP-${packageData.packageNumber}
================================================
Paket Tender   : ${packageData.title}
No. Paket      : ${packageData.packageNumber}
Kategori       : ${packageData.category}
Metode Seleksi : ${packageData.procurementMethod || 'Tender Terbatas (Selected Bidding)'}
Owner Estimate : Rp ${totalHps.toLocaleString('id-ID')}
Tanggal Evaluasi : ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}

RINGKASAN HASIL EVALUASI KOMERSIAL & PENAWARAN (CBT SAP):
${rankedBids
  .map(
    (b, idx) => {
      const bPrice = negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : (b.negotiatedGrandTotal || b.grandTotal);
      const isFailed = (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'FAILED';
      const statusKet = isFailed ? 'TIDAK LOLOS EVALUASI I (GUGUR TEKNIS)' : 'LOLOS SYARAT TEKNIS';
      return `${idx + 1}. ${b.vendorName} [${statusKet}]\n   - Penawaran Awal : Rp ${b.grandTotal.toLocaleString('id-ID')}\n   - Negosiasi/BAFO : Rp ${bPrice.toLocaleString('id-ID')}\n   - TOP / LeadTime : ${b.termOfPayment} / ${b.deliveryLeadTimeDays} hari\n   - Deviasi vs HPS : ${totalHps > 0 ? (((bPrice) - totalHps) / totalHps * 100).toFixed(1) + '%' : '-'}`;
    }
  )
  .join('\n\n')}

USULAN PENETAPAN PEMENANG TENDER:
1. Pemenang I : ${winner?.vendorName || '-'} (Nilai: Rp ${winVal.toLocaleString('id-ID')})
2. Cadangan I : ${eligibleBids[1]?.vendorName || 'Tidak Ada'}
Total Efisiensi Biaya (Cost Saving) : Rp ${saving.toLocaleString('id-ID')} (${totalHps > 0 ? ((saving / totalHps) * 100).toFixed(1) : 0}%)

Disahkan Oleh Tim Pengadaan (Purchasing Desk)
PT. Cipta Sarana Transindo - CPG Group
================================================`;

    navigator.clipboard.writeText(baepText);
    setSuccessMsg('Naskah resmi Berita Acara Evaluasi (BAEP) berhasil disalin ke clipboard!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const eligibleBids = useMemo(() => rankedBids.filter((b) => !b.isDisqualified), [rankedBids]);
  const defaultTopWinner = eligibleBids[0] || rankedBids[0];

  // Calon Pemenang: otomatis penawar terendah pasca-negosiasi (defaultTopWinner),
  // kecuali panitia memilih kandidat lain secara manual di Tab 4.
  const winningBid = useMemo(() => {
    if (manualOverrideWinnerId) {
      const match = eligibleBids.find((b) => b.id === manualOverrideWinnerId);
      if (match) return match;
    }
    return defaultTopWinner;
  }, [manualOverrideWinnerId, eligibleBids, defaultTopWinner]);

  const selectedWinnerId = winningBid?.id || '';
  const winningBidValue = winningBid
    ? (negotiatedTotals[winningBid.id] !== undefined
        ? negotiatedTotals[winningBid.id]
        : (winningBid.negotiatedGrandTotal || winningBid.grandTotal))
    : 0;

  // Konfigurasi Matriks Otorisasi Berjenjang (SAP Release Strategy)
  const approvalSettings = useMemo(() => getStoredTenderApprovalSettings(), []);
  const requiredTier = useMemo(() => {
    return determineRequiredApprovalTier(winningBidValue, approvalSettings);
  }, [winningBidValue, approvalSettings]);

  const canRelease = useMemo(() => {
    return checkUserCanReleaseTier(userRole, requiredTier);
  }, [userRole, requiredTier]);

  // Handler: Release Otorisasi Persetujuan PO (SAP Release Strategy)
  const handleReleaseApproval = async () => {
    if (!canRelease.allowed) {
      alert(`Akses Ditolak: ${canRelease.reason}`);
      return;
    }

    const confirmMsg = `Otorisasi & Release Persetujuan Penerbitan PO?\n\n- Rekanan Calon Pemenang: ${winningBid?.vendorName}\n- Nilai Kontrak Akhir: Rp ${winningBidValue.toLocaleString('id-ID')}\n- Kategori Otorisasi: ${requiredTier.name} (${requiredTier.authorizedRoleLabel})\n- Di-release Oleh: ${userName} (${userRole || 'Otorisator'})\n\nSetelah di-release, panitia dapat langsung mencetak/menerbitkan Purchase Order (PO). Lanjutkan?`;
    if (!confirm(confirmMsg)) return;

    const nowIso = new Date().toISOString();
    setEvalApprovalStatus('APPROVED');
    setEvalApprovedBy(userName);
    setEvalApprovedAt(nowIso);

    // Otomatis simpan status release ke paket
    await handleSaveAllToPackage('AWARDED', {
      approvalStatus: 'APPROVED',
      approvedBy: userName,
      approvedAt: nowIso,
      releaseTierId: requiredTier.id,
      releaseTierName: requiredTier.name,
      isPoReleased: true,
      poReleasedAt: nowIso,
      poReleasedBy: userName,
    });

    setSuccessMsg(`✓ Persetujuan berhasil di-release oleh ${userName} (${requiredTier.authorizedRoleLabel})! Tombol Terbitkan PO kini aktif.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handler: Batalkan Release Otorisasi PO
  const handleRevokeRelease = async () => {
    if (!confirm('Batalkan status release persetujuan untuk paket ini? Penerbitan Purchase Order akan dikunci kembali.')) return;
    setEvalApprovalStatus('PENDING_APPROVAL');
    setEvalApprovedBy(undefined);
    setEvalApprovedAt(undefined);

    await handleSaveAllToPackage('EVALUATION', {
      approvalStatus: 'PENDING_APPROVAL',
      approvedBy: undefined,
      approvedAt: undefined,
      isPoReleased: false,
    });

    setSuccessMsg('Status release otorisasi berhasil dibatalkan.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Status Data Frozen / Read-Only demi tertib administrasi & audit pasca pemenang disahkan
  const isDataFrozen = packageData.status === 'AWARDED' || packageData.status === 'COMPLETED';

  // Perhitungan sisa waktu masa sanggah (3 hari kalender)
  const standstillStartedAt = packageData.evaluationSummary?.standstillStartedAt;
  const standstillEndsAt = packageData.evaluationSummary?.standstillEndsAt;

  const standstillInfo = useMemo(() => {
    if (!standstillEndsAt) {
      return { isEnded: true, remainingText: 'Belum diaktifkan (Aktif otomatis setelah Sahkan Pemenang)', remainingDays: 0, endsAtFormatted: '-' };
    }
    const endMs = new Date(standstillEndsAt).getTime();
    const nowMs = Date.now();
    const diffMs = endMs - nowMs;
    if (diffMs <= 0 || standstillStatus === 'COMPLETED_NO_DISPUTE') {
      return { isEnded: true, remainingText: 'Telah Berakhir (3 Hari Selesai / Bebas Tangguhan)', remainingDays: 0, endsAtFormatted: new Date(standstillEndsAt).toLocaleDateString('id-ID') };
    }
    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const h = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isEnded: false,
      remainingText: `Sisa ${d} Hari ${h} Jam ${m} Menit`,
      remainingDays: d,
      endsAtFormatted: new Date(standstillEndsAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [standstillEndsAt, standstillStatus]);

  // Handler: Konfirmasi Bebas Sanggahan / Percepat Penerbitan PO
  const handleConfirmNoDispute = async () => {
    if (
      !confirm(
        'Konfirmasi bahwa seluruh rekanan bidder tidak memiliki tangguhan/sanggahan tertulis?\n\nMasa Sanggah akan dinyatakan tuntas (Final & Inkracht) dan paket siap diterbitkan Purchase Order (PO).'
      )
    )
      return;

    setStandstillStatus('COMPLETED_NO_DISPUTE');
    await handleSaveAllToPackage('AWARDED', {
      standstillStatus: 'COMPLETED_NO_DISPUTE',
    });
    setSuccessMsg('✓ Masa Sanggah 3 hari dinyatakan tuntas & bebas tangguhan. PO siap diterbitkan.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Handler: Catat Sanggahan Rekanan
  const handleRecordDispute = async () => {
    const note = prompt(
      'Masukkan rincian / No. Surat Sanggahan dari rekanan bidder:\n(Contoh: Surat Sanggah No. 012/EXT/XI/2026 dari PT B terkait kualifikasi teknis)',
      disputeNotes || ''
    );
    if (note === null) return;

    setDisputeNotes(note);
    setStandstillStatus('DISPUTED');
    await handleSaveAllToPackage('AWARDED', {
      standstillStatus: 'DISPUTED',
      disputeNotes: note,
    });
    setSuccessMsg('⚠️ Sanggahan rekanan berhasil dicatat. Penerbitan PO ditahan untuk peninjauan.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Handler: Selesaikan Sanggahan Rekanan
  const handleResolveDispute = async () => {
    if (
      !confirm(
        'Nyatakan sanggahan rekanan telah selesai diklarifikasi dan diputuskan resmi oleh Panitia Pengadaan?'
      )
    )
      return;

    const resolvedNote = `${disputeNotes} [Diselesaikan resmi oleh Panitia Pengadaan pada ${new Date().toLocaleDateString('id-ID')}]`;
    setDisputeNotes(resolvedNote);
    setStandstillStatus('COMPLETED_NO_DISPUTE');
    await handleSaveAllToPackage('AWARDED', {
      standstillStatus: 'COMPLETED_NO_DISPUTE',
      disputeNotes: resolvedNote,
    });
    setSuccessMsg('✓ Sanggahan rekanan telah diselesaikan. Proses tender dilanjutkan.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* HEADER MODAL */}
        <div className="p-4 sm:p-5 bg-muted/60 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600 border border-purple-500/25 shrink-0">
              <Scale className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {packageData.packageNumber}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  {packageData.procurementMethod || 'TENDER TERBATAS (PTK/SAP)'}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  HPS / OE: <strong className="text-foreground">Rp {totalHps.toLocaleString('id-ID')}</strong>
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
                {packageData.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bids.length === 0 && (
              <button
                type="button"
                onClick={handlePreFillMockBids}
                className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                title="Muat 3 penawaran vendor contoh untuk simulasi langsung"
              >
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">Simulasi 3 Vendor (Demo)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* SUB-NAVIGASI TAHAPAN TENDER SAP (PTK WORKFLOW) */}
        <div className="bg-muted/30 border-b border-border px-4 py-2 flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <FileSpreadsheet className="size-3.5" />
              <span>1. Matriks CBT (ME49)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 text-white">
                {bids.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scoring')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'scoring'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Scale className="size-3.5" />
              <span>2. Evaluasi 2 Kategori</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('negotiation')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'negotiation'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <TrendingDown className="size-3.5" />
              <span>3. Negosiasi &amp; BAFO</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('awarding')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'awarding'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Award className="size-3.5" />
              <span>4. Penetapan Pemenang &amp; PO</span>
            </button>
          </div>

          {/* Quick Notification Alert */}
          {successMsg && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg animate-in fade-in">
              <CheckCircle2 className="size-3.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* MODAL BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* ============================================================== */}
          {/* TAB 1: MATRIKS TABULASI KOMPARASI PENAWARAN (CBT - SAP ME49)   */}
          {/* ============================================================== */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {/* BANNER DATA FROZEN JIKA SUDAH DISAHKAN */}
              {isDataFrozen && (
                <div className="p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200 text-xs flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
                      <Lock className="size-4" />
                    </div>
                    <div>
                      <strong className="block text-foreground">Data Penawaran Dikunci &amp; Dibekukan (Data Sealed):</strong>
                      <span className="text-[11px] opacity-90">Pemenang tender telah disahkan. Seluruh nilai komparasi penawaran rekanan dikunci demi tertib administrasi &amp; kepatuhan audit.</span>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0">
                    Read-Only
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet className="size-4 text-purple-600" />
                    <span>Commercial Bid Tabulation (CBT) Side-by-Side</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Perbandingan rincian harga satuan, total penawaran, termin pembayaran, dan deviasi terhadap HPS.
                  </p>
                </div>

                {!isDataFrozen && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingBid(!isAddingBid)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>{isAddingBid ? 'Tutup Form Input' : 'Tambah Penawaran Rekanan'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* FORM TAMBAH PENAWARAN VENDOR BARU */}
              {isAddingBid && (
                <div className="bg-muted/40 border-2 border-dashed border-purple-500/40 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="size-4 text-purple-600" />
                      <span>Form Pemasukan Penawaran Vendor (Dokumen Penawaran Masuk)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingBid(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Nama Perusahaan Rekanan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newVendorName}
                        onChange={(e) => setNewVendorName(e.target.value)}
                        placeholder="Contoh: PT. Bintang Samudra Niaga"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        No. Surat Penawaran Resmi
                      </label>
                      <input
                        type="text"
                        value={newQuotationRef}
                        onChange={(e) => setNewQuotationRef(e.target.value)}
                        placeholder="Contoh: BSN/SP/2026/04"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Nama PIC / Sales
                      </label>
                      <input
                        type="text"
                        value={newVendorPic}
                        onChange={(e) => setNewVendorPic(e.target.value)}
                        placeholder="Contoh: Bpk. Kurniawan"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        No. WhatsApp / Kontak
                      </label>
                      <input
                        type="text"
                        value={newVendorContact}
                        onChange={(e) => setNewVendorContact(e.target.value)}
                        placeholder="+62 812-xxxx-xxxx"
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Term of Payment (TOP)
                      </label>
                      <select
                        value={newTop}
                        onChange={(e) => setNewTop(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      >
                        <option value="CBD (Cash Before Delivery)">CBD (Cash Before Delivery)</option>
                        <option value="COD (Cash on Delivery)">COD (Cash on Delivery)</option>
                        <option value="NET 14 Hari">NET 14 Hari</option>
                        <option value="NET 30 Hari">NET 30 Hari</option>
                        <option value="NET 45 Hari">NET 45 Hari</option>
                        <option value="NET 60 Hari">NET 60 Hari</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Lead Time Pengiriman (Hari)
                      </label>
                      <input
                        type="number"
                        value={newLeadTime}
                        onChange={(e) => setNewLeadTime(Number(e.target.value))}
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Franco Titik Penyerahan
                      </label>
                      <input
                        type="text"
                        value={newDeliveryPoint}
                        onChange={(e) => setNewDeliveryPoint(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      />
                    </div>
                  </div>

                  {/* Input Harga Satuan Tiap Item */}
                  <div className="space-y-2 pt-2">
                    <label className="font-bold text-xs text-foreground block">
                      Rincian Penawaran Harga Satuan per Material:
                    </label>
                    <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted text-muted-foreground text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Material</th>
                            <th className="py-2 px-3 text-center">Qty &amp; Satuan</th>
                            <th className="py-2 px-3">Merek / Alternatif</th>
                            <th className="py-2 px-3 text-right">Harga Satuan (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {packageData.items.map((it) => (
                            <tr key={it.itemId}>
                              <td className="py-2 px-3 font-medium text-foreground max-w-xs truncate">
                                {it.itemName}
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                <div>{it.totalQty} {it.satuan}</div>
                                {it.originalQty !== undefined && Math.abs(it.totalQty - it.originalQty) > 0.001 && (
                                  <div className="text-[9px] font-normal text-muted-foreground font-sans">
                                    (FPB: {it.originalQty})
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  placeholder="Merek yang ditawarkan"
                                  value={newItemBrands[it.itemId] || ''}
                                  onChange={(e) =>
                                    setNewItemBrands({
                                      ...newItemBrands,
                                      [it.itemId]: e.target.value,
                                    })
                                  }
                                  className="w-full h-7 px-2 rounded border border-border bg-background text-[11px]"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="relative inline-flex items-center">
                                  <span className="absolute left-2 text-[10px] font-mono text-muted-foreground pointer-events-none select-none">
                                    Rp
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={newItemPrices[it.itemId] ? Number(newItemPrices[it.itemId]).toLocaleString('id-ID') : ''}
                                    onChange={(e) => {
                                      const rawDigits = e.target.value.replace(/\D/g, '');
                                      setNewItemPrices({
                                        ...newItemPrices,
                                        [it.itemId]: rawDigits ? Number(rawDigits) : 0,
                                      });
                                    }}
                                    className="w-36 h-7 pl-7 pr-2 rounded border border-border bg-background text-right font-mono text-xs font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Biaya Pengiriman / Ekspedisi Franco Dermaga (Rp)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs font-mono font-bold text-muted-foreground select-none pointer-events-none">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newDeliveryFee ? Number(newDeliveryFee).toLocaleString('id-ID') : ''}
                          onChange={(e) => {
                            const rawDigits = e.target.value.replace(/\D/g, '');
                            setNewDeliveryFee(rawDigits ? Number(rawDigits) : 0);
                          }}
                          placeholder="0"
                          className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1 text-foreground">
                        Tarif Pajak PPN
                      </label>
                      <select
                        value={newPpnPercent}
                        onChange={(e) => setNewPpnPercent(Number(e.target.value))}
                        className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
                      >
                        <option value={11}>PPN 11% (Perusahaan PKP)</option>
                        <option value={0}>Non-PPN / PPN 0%</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setIsAddingBid(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNewBid}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                    >
                      <Check className="size-3.5" />
                      <span>Simpan ke Matriks Komparasi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TABEL SIDE-BY-SIDE CBT MATRIX */}
              {bids.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground space-y-3">
                  <FileSpreadsheet className="size-10 mx-auto text-purple-500 opacity-40" />
                  <p className="text-sm font-bold text-foreground">Belum Ada Rekanan yang Memasukkan Penawaran</p>
                  <p className="text-xs max-w-md mx-auto">
                    Klik <strong>&quot;Tambah Penawaran Rekanan&quot;</strong> untuk memasukkan harga vendor, atau klik tombol <strong>&quot;Simulasi 3 Vendor (Demo)&quot;</strong> di pojok kanan atas untuk melihat simulasi format SAP langsung.
                  </p>
                </div>
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="py-3 px-3 w-10 text-center sticky left-0 bg-muted/90 z-10 border-r border-border">
                            No
                          </th>
                          <th className="py-3 px-4 min-w-[220px] sticky left-10 bg-muted/90 z-10 border-r border-border">
                            Material &amp; Spesifikasi
                          </th>
                          <th className="py-3 px-3 text-center min-w-[80px] border-r border-border">
                            Volume
                          </th>

                          {/* Kolom Tiap Vendor */}
                          {bids.map((bid, bIdx) => {
                            const isLowest = rankedBids[0]?.id === bid.id;
                            return (
                              <th
                                key={bid.id}
                                className={`py-3 px-4 min-w-[200px] border-r border-border ${
                                  isLowest ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div>
                                    <div className="font-bold text-foreground text-xs normal-case">
                                      {bid.vendorName}
                                    </div>
                                    <div className="text-[10px] font-mono font-normal lowercase opacity-80">
                                      {bid.quotationRefNo || `Vendor #${bIdx + 1}`}
                                    </div>
                                    {/* Badge Status Kunci 1x Submit & Tombol Buka Kunci */}
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      {bid.isLocked ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold text-[9px] border border-amber-500/30">
                                          <Lock className="size-2.5" />
                                          <span>Terkunci 1x</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[9px] border border-emerald-500/30">
                                          <Unlock className="size-2.5" />
                                          <span>Terbuka</span>
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleToggleLockBid(bid.id)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition inline-flex items-center gap-0.5 ${
                                          bid.isLocked
                                            ? 'border-sky-500/40 text-sky-600 hover:bg-sky-500/10'
                                            : 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
                                        }`}
                                        title={
                                          bid.isLocked
                                            ? 'Buka Kunci agar Rekanan dapat membuka kembali tautan & input ulang'
                                            : 'Kunci penawaran rekanan'
                                        }
                                      >
                                        {bid.isLocked ? (
                                          <>
                                            <Unlock className="size-2.5" />
                                            <span>Buka Kunci</span>
                                          </>
                                        ) : (
                                          <>
                                            <Lock className="size-2.5" />
                                            <span>Kunci</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  {!isDataFrozen && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBid(bid.id)}
                                      className="text-rose-500 hover:text-rose-700 p-1 transition"
                                      title="Hapus Rekanan dari Matriks"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border/60">
                        {packageData.items.map((it, idx) => {
                          const lowestPrice = lowestPricePerItem[it.itemId];

                          return (
                            <tr key={it.itemId} className="hover:bg-muted/20">
                              <td className="py-2.5 px-3 text-center font-mono text-[11px] sticky left-0 bg-card z-10 border-r border-border">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-foreground sticky left-10 bg-card z-10 border-r border-border">
                                <div>{it.itemName}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Kapal: {it.vessels.slice(0, 2).join(', ')}
                                  {it.vessels.length > 2 ? ` +${it.vessels.length - 2}` : ''}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold border-r border-border">
                                <div>{it.totalQty} {it.satuan}</div>
                                {it.originalQty !== undefined && Math.abs(it.totalQty - it.originalQty) > 0.001 && (
                                  <div className="text-[9px] font-normal text-muted-foreground font-sans">
                                    (FPB: {it.originalQty})
                                  </div>
                                )}
                              </td>

                              {/* Nilai Harga Satuan Tiap Vendor */}
                              {bids.map((bid) => {
                                const line = bid.items.find((i) => i.itemId === it.itemId);
                                const uPrice = line?.unitPrice || 0;
                                const isLowest = lowestPrice && uPrice === lowestPrice;

                                return (
                                  <td
                                    key={bid.id}
                                    className={`py-2.5 px-4 font-mono text-right border-r border-border ${
                                      isLowest
                                        ? 'bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300'
                                        : 'text-foreground'
                                    }`}
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      {isLowest && (
                                        <span className="text-[9px] px-1 rounded bg-emerald-500 text-white font-sans font-bold">
                                          Best
                                        </span>
                                      )}
                                      <span>Rp {uPrice.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-sans">
                                      Tot: Rp {(uPrice * it.totalQty).toLocaleString('id-ID')}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* ROW: SUBTOTAL MATERIAL */}
                        <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                          <td colSpan={3} className="py-2.5 px-4 text-right sticky left-0 bg-muted/30 z-10 border-r border-border">
                            Subtotal Barang (Excl. Tax &amp; Ongkir)
                          </td>
                          {bids.map((bid) => (
                            <td key={bid.id} className="py-2.5 px-4 text-right font-mono border-r border-border">
                              Rp {bid.subtotal.toLocaleString('id-ID')}
                            </td>
                          ))}
                        </tr>

                        {/* ROW: ONGKIR FRANCO DERMAGA */}
                        <tr className="text-muted-foreground">
                          <td colSpan={3} className="py-2 px-4 text-right sticky left-0 bg-card z-10 border-r border-border">
                            Biaya Pengiriman (Franco Dermaga)
                          </td>
                          {bids.map((bid) => (
                            <td key={bid.id} className="py-2 px-4 text-right font-mono text-foreground border-r border-border">
                              Rp {bid.deliveryFee.toLocaleString('id-ID')}
                            </td>
                          ))}
                        </tr>

                        {/* ROW: PPN 11% */}
                        <tr className="text-muted-foreground">
                          <td colSpan={3} className="py-2 px-4 text-right sticky left-0 bg-card z-10 border-r border-border">
                            PPN (11%)
                          </td>
                          {bids.map((bid) => (
                            <td key={bid.id} className="py-2 px-4 text-right font-mono text-foreground border-r border-border">
                              Rp {bid.ppnAmount.toLocaleString('id-ID')}
                            </td>
                          ))}
                        </tr>

                        {/* ROW: GRAND TOTAL PENAWARAN */}
                        <tr className="bg-purple-500/10 text-foreground font-bold border-t-2 border-purple-500/30">
                          <td colSpan={3} className="py-3 px-4 text-right text-xs uppercase sticky left-0 bg-purple-500/10 z-10 border-r border-border">
                            Grand Total Penawaran Komersial
                          </td>
                          {bids.map((bid) => {
                            const isRank1 = rankedBids[0]?.id === bid.id;
                            const currentTotal =
                              negotiatedTotals[bid.id] !== undefined
                                ? negotiatedTotals[bid.id]
                                : bid.negotiatedGrandTotal || bid.grandTotal;
                            const hasNegotiation =
                              negotiatedTotals[bid.id] !== undefined && negotiatedTotals[bid.id] !== bid.grandTotal;

                            return (
                              <td
                                key={bid.id}
                                className={`py-3 px-4 text-right font-mono text-sm border-r border-border ${
                                  isRank1 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : ''
                                }`}
                              >
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {isRank1 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-sans font-bold inline-flex items-center gap-0.5">
                                      <Trophy className="size-2.5" /> Peringkat 1
                                    </span>
                                  )}
                                  <span>Rp {currentTotal.toLocaleString('id-ID')}</span>
                                  {hasNegotiation && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-sans block w-full">
                                      (Hasil BAFO)
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* ROW: SELISIH VS HPS */}
                        <tr className="text-xs">
                          <td colSpan={3} className="py-2.5 px-4 text-right sticky left-0 bg-card z-10 border-r border-border text-muted-foreground">
                            Deviasi terhadap HPS (Rp {totalHps.toLocaleString('id-ID')})
                          </td>
                          {bids.map((bid) => {
                            const currentTotal =
                              negotiatedTotals[bid.id] !== undefined
                                ? negotiatedTotals[bid.id]
                                : bid.negotiatedGrandTotal || bid.grandTotal;
                            const diff = currentTotal - totalHps;
                            const diffPct = totalHps > 0 ? (diff / totalHps) * 100 : 0;
                            const isUnderHps = diff <= 0;

                            return (
                              <td
                                key={bid.id}
                                className={`py-2.5 px-4 text-right font-mono text-[11px] font-bold border-r border-border ${
                                  isUnderHps
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isUnderHps ? 'Hemat ' : 'Di atas HPS +'}
                                {Math.abs(diffPct).toFixed(1)}% (
                                {diff <= 0 ? '-' : '+'}Rp {Math.abs(diff).toLocaleString('id-ID')})
                              </td>
                            );
                          })}
                        </tr>

                        {/* ROW: SYARAT KOMERSIAL & LEAD TIME */}
                        <tr className="bg-muted/20 text-xs">
                          <td colSpan={3} className="py-2.5 px-4 text-right sticky left-0 bg-muted/20 z-10 border-r border-border text-muted-foreground">
                            Termin Pembayaran (TOP) &amp; Lead Time
                          </td>
                          {bids.map((bid) => (
                            <td key={bid.id} className="py-2.5 px-4 text-left border-r border-border text-[11px]">
                              <div><strong>TOP:</strong> {bid.termOfPayment}</div>
                              <div><strong>Lead Time:</strong> {bid.deliveryLeadTimeDays} Hari</div>
                              <div className="text-[10px] text-muted-foreground truncate" title={bid.francoDeliveryPoint}>
                                {bid.francoDeliveryPoint}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EVALUASI 2 KATEGORI (ADMINISTRASI, TEKNIS, KOMERSIAL)   */}
          {/* ============================================================== */}
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Scale className="size-4 text-purple-600" />
                  <span>Sistem Evaluasi 2 Kategori (Standar PTK / SAP)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pemeriksaan kualifikasi teknis/maritim (Kategori 1) sebelum pembukaan harga komersial (Kategori 2).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kategori 1 Teknis */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <ShieldCheck className="size-4 text-sky-600" />
                    <h4 className="text-xs font-bold text-foreground uppercase">
                      Kategori 1: Evaluasi Administrasi &amp; Teknis
                    </h4>
                  </div>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Legalitas &amp; NIB Rekanan:</strong> Izin usaha aktif dan terdaftar di AVL internal.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Sertifikasi Maritim:</strong> Kesesuaian spesifikasi klas BKI/ABS, CoA, atau Surat Keagenan Resmi OEM.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Kesiapan Pengantaran:</strong> Waktu sampai (Lead Time) memenuhi jadwal pelayaran kapal.</span>
                    </li>
                  </ul>
                </div>

                {/* Kategori 2 Komersial */}
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <DollarSign className="size-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-foreground uppercase">
                      Kategori 2: Evaluasi Komersial &amp; Finansial
                    </h4>
                  </div>
                  <ul className="text-xs space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Kewajaran Harga vs HPS:</strong> Evaluasi penawaran wajar di bawah atau setara HPS Owner Estimate.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Fleksibilitas Pembayaran:</strong> Term of Payment (prioritas kredit 30–60 hari setelah TTB diterima).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span><strong>Formula Bobot Akhir:</strong> 30% Skor Teknis + 70% Skor Komersial/Harga.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Tabel Evaluasi Status Rekanan */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Peringkat</th>
                      <th className="py-2.5 px-4">Nama Rekanan</th>
                      <th className="py-2.5 px-3">Status Kategori 1</th>
                      <th className="py-2.5 px-3">Termin Pembayaran</th>
                      <th className="py-2.5 px-3 text-right">Nilai Penawaran</th>
                      <th className="py-2.5 px-4 text-center">Status Rekomendasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rankedBids.map((b) => {
                      const isFailed = (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'FAILED';
                      return (
                        <tr
                          key={b.id}
                          className={isFailed ? 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08] transition-colors' : 'hover:bg-muted/20 transition-colors'}
                        >
                          <td className="py-3 px-4 font-mono font-bold">
                            {isFailed ? (
                              <span
                                className="inline-flex items-center justify-center size-6 rounded-full text-xs font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                title="Tidak Lolos Evaluasi I"
                              >
                                ✕
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center justify-center size-6 rounded-full text-xs ${
                                  b.ranking === 1
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : b.ranking === 2
                                    ? 'bg-sky-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {b.ranking}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{b.vendorName}</span>
                              {isFailed && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                  GUGUR TEKNIS
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              PIC: {b.vendorPic || '-'} ({b.vendorContact || '-'})
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {b.isLocked ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                  <Lock className="size-2.5" /> Terkunci 1x
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                  <Unlock className="size-2.5" /> Terbuka
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleToggleLockBid(b.id)}
                                className="text-[9px] text-sky-600 hover:underline font-bold"
                              >
                                {b.isLocked ? 'Buka Kunci' : 'Kunci'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {/* DROPDOWN STATUS KATEGORI 1 */}
                            <div className="relative inline-flex items-center">
                              <select
                                value={technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED'}
                                onChange={(e) =>
                                  handleSetTechnicalStatus(b.id, e.target.value as 'PASSED' | 'FAILED')
                                }
                                className={`text-[11px] font-bold py-1.5 pl-3 pr-7 rounded-full border appearance-none cursor-pointer transition-all shadow-xs focus:outline-none focus:ring-2 ${
                                  !isFailed
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 focus:ring-emerald-500/20'
                                    : 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 focus:ring-rose-500/20'
                                }`}
                              >
                                <option value="PASSED" className="bg-background text-foreground font-semibold">
                                  ✓ Lolos Syarat Teknis
                                </option>
                                <option value="FAILED" className="bg-background text-rose-600 dark:text-rose-400 font-semibold">
                                  ✕ Tidak Lolos Evaluasi I
                                </option>
                              </select>
                              <ChevronDown
                                className={`size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                                  !isFailed
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono">{b.termOfPayment}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                            <div>
                              Rp {(negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : (b.negotiatedGrandTotal || b.grandTotal)).toLocaleString('id-ID')}
                            </div>
                            {negotiatedTotals[b.id] !== undefined && negotiatedTotals[b.id] !== b.grandTotal && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-normal">
                                (BAFO Negosiasi)
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isFailed ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                Gugur Evaluasi I
                              </span>
                            ) : b.ranking === 1 ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                Calon Pemenang Utama
                              </span>
                            ) : b.ranking === 2 ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                                Cadangan I
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Memenuhi Syarat</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: NEGOSIASI HARGA & BAFO (BEST AND FINAL OFFER)            */}
          {/* ============================================================== */}
          {activeTab === 'negotiation' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="size-4 text-purple-600" />
                  <span>Klarifikasi Teknis &amp; Negosiasi Harga (BAFO)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Catat hasil kesepakatan negosiasi harga final (Best and Final Offer) untuk memaksimalkan efisiensi anggaran pengadaan armada.
                </p>
              </div>

              <div className="space-y-3">
                {rankedBids.map((b, idx) => {
                  const initialPrice = b.grandTotal;
                  const currentNeg = negotiatedTotals[b.id] !== undefined ? negotiatedTotals[b.id] : initialPrice;
                  const saving = initialPrice - currentNeg;
                  const isFailed = (technicalStatuses[b.id] ?? b.technicalStatus ?? 'PASSED') === 'FAILED';

                  return (
                    <div
                      key={b.id}
                      className={`rounded-2xl p-4 shadow-sm space-y-3 transition-all ${
                        isFailed
                          ? 'bg-card border border-rose-500/30 bg-rose-500/[0.02]'
                          : idx === 0
                          ? 'border-2 border-emerald-500 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] shadow-md ring-1 ring-emerald-500/20'
                          : 'bg-card border border-border'
                      }`}
                    >
                      {isFailed && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2">
                          <AlertCircle className="size-3.5 shrink-0 text-rose-600" />
                          <span>Rekanan Tidak Lolos Evaluasi I (Gugur Syarat Teknis). Negosiasi tidak mempengaruhi nominasi pemenang.</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`size-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                              isFailed
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                : idx === 0
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isFailed ? '✕' : b.ranking}
                          </span>
                          <h4 className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                            <span>{b.vendorName}</span>
                            {!isFailed && idx === 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-xs animate-in fade-in">
                                <Trophy className="size-3 text-amber-200" />
                                <span>POTENSI JUARA / PEMENANG I (TERENDAH BAFO)</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Tidak Lolos Evaluasi I
                              </span>
                            )}
                          </h4>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>Penawaran Awal: <strong className="font-mono text-foreground">Rp {initialPrice.toLocaleString('id-ID')}</strong></span>
                          {!isFailed && idx === 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              Terendah Saat Ini
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-semibold block mb-1 text-foreground">
                            Harga Hasil Negosiasi Final / BAFO (Rp):
                          </label>
                          <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-xs font-mono font-bold text-muted-foreground select-none pointer-events-none">
                              Rp
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={currentNeg ? Number(currentNeg).toLocaleString('id-ID') : ''}
                              onChange={(e) => {
                                const rawDigits = e.target.value.replace(/\D/g, '');
                                const numVal = rawDigits ? Number(rawDigits) : 0;
                                setNegotiatedTotals({
                                  ...negotiatedTotals,
                                  [b.id]: numVal,
                                });
                              }}
                              disabled={isDataFrozen}
                              placeholder="0"
                              className={`w-full h-8 pl-8 pr-2.5 rounded-lg border border-border font-mono font-bold text-xs focus:ring-1 focus:ring-primary focus:outline-none ${
                                isDataFrozen ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                              }`}
                            />
                          </div>
                          {saving > 0 && (
                            <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
                              ✓ Berhasil dinegosiasikan turun Rp {saving.toLocaleString('id-ID')}
                            </span>
                          )}
                          {!isFailed && idx === 0 && rankedBids[1] && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium mt-1">
                              ★ Lebih hemat Rp {Math.max(0, (negotiatedTotals[rankedBids[1].id] !== undefined ? negotiatedTotals[rankedBids[1].id] : rankedBids[1].grandTotal) - currentNeg).toLocaleString('id-ID')} dibanding penawar terdekat ({rankedBids[1].vendorName})
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="font-semibold block mb-1 text-foreground">
                            Catatan Klarifikasi &amp; Kesepakatan Negosiasi:
                          </label>
                          <input
                            type="text"
                            disabled={isDataFrozen}
                            placeholder="Contoh: Disepakati diskon volume 3% dan bebas ongkos angkut Franco Dermaga."
                            value={negotiationNotes[b.id] || ''}
                            onChange={(e) =>
                              setNegotiationNotes({
                                ...negotiationNotes,
                                [b.id]: e.target.value,
                              })
                            }
                            className={`w-full h-8 px-2.5 rounded-lg border border-border text-xs ${
                              isDataFrozen ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: PENETAPAN PEMENANG & APPROVAL TENDER (AWARDING & PO)    */}
          {/* ============================================================== */}
          {activeTab === 'awarding' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Award className="size-4 text-purple-600" />
                  <span>Penetapan Pemenang Tender &amp; Otorisasi Berjenjang (SAP Release)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pembuatan Berita Acara Evaluasi Pengadaan (BAEP), otorisasi manajemen, dan penerbitan Purchase Order (PO).
                </p>
              </div>

              {/* SELECTOR PEMENANG TENDER DENGAN AUTO-LOWEST BAFO */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div>
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <Trophy className="size-4 text-amber-500" />
                    <span>Penetapan Calon Pemenang Tender Resmi:</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {manualOverrideWinnerId
                      ? '⚠️ Panitia mengalihkan pemenang secara manual (bukan penawar terendah rekomendasi).'
                      : '✓ Sistem otomatis menetapkan penawar harga BAFO terendah sebagai calon pemenang.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={winningBid?.id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === defaultTopWinner?.id) {
                        setManualOverrideWinnerId(null);
                      } else {
                        setManualOverrideWinnerId(val);
                      }
                    }}
                    className="h-9 px-3 rounded-xl border border-purple-500/30 bg-background text-foreground font-bold text-xs focus:ring-1 focus:ring-purple-500"
                  >
                    {eligibleBids.map((b, idx) => {
                      const bPrice =
                        negotiatedTotals[b.id] !== undefined
                          ? negotiatedTotals[b.id]
                          : b.negotiatedGrandTotal || b.grandTotal;
                      const isLowest = idx === 0;
                      return (
                        <option key={b.id} value={b.id}>
                          {isLowest ? '🏆 [Peringkat 1 Terendah BAFO] ' : `[Peringkat ${idx + 1}] `}
                          {b.vendorName} — Rp {bPrice.toLocaleString('id-ID')}
                        </option>
                      );
                    })}
                  </select>

                  {manualOverrideWinnerId && (
                    <button
                      type="button"
                      onClick={() => setManualOverrideWinnerId(null)}
                      className="px-3 py-1.5 rounded-xl border border-border bg-muted hover:bg-muted/80 text-[11px] text-foreground font-bold transition cursor-pointer"
                      title="Kembalikan ke Peringkat 1 Otomatis (Rekomendasi Terendah)"
                    >
                      ↺ Reset ke Terendah
                    </button>
                  )}
                </div>
              </div>

              {/* CARD RINGKASAN PEMENANG */}
              <div className="bg-gradient-to-r from-purple-500/10 via-emerald-500/10 to-sky-500/10 border border-purple-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block flex items-center gap-1">
                      <Trophy className="size-3 text-amber-500" />
                      <span>
                        {manualOverrideWinnerId
                          ? 'Pemenang Pilihan Manual Panitia'
                          : 'Rekomendasi Pemenang Tender (Peringkat 1 Terendah BAFO)'}
                      </span>
                    </span>
                    <h3 className="text-lg font-extrabold text-foreground mt-0.5">
                      {winningBid?.vendorName || '-'}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Nilai Kontrak / PO Akhir</span>
                    <span className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      Rp {winningBidValue.toLocaleString('id-ID')}
                    </span>
                    {winningBid && winningBid.grandTotal !== winningBidValue && (
                      <span className="text-[10px] text-muted-foreground block line-through">
                        Awal: Rp {winningBid.grandTotal.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Owner Estimate (HPS)</span>
                    <strong className="font-mono">Rp {totalHps.toLocaleString('id-ID')}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Efisiensi Total (Saving)</span>
                    <strong className="font-mono text-emerald-600">
                      Rp {(totalHps - winningBidValue).toLocaleString('id-ID')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Term of Payment</span>
                    <strong>{winningBid?.termOfPayment || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Lead Time Franco</span>
                    <strong>{winningBid?.deliveryLeadTimeDays || 7} Hari</strong>
                  </div>
                </div>
              </div>

              {/* KARTU MASA SANGGAH (STANDSTILL PERIOD - 3 HARI) */}
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="size-4 text-purple-600" />
                    <span>Masa Sanggah Tender (Standstill Period 3 Hari Kalender)</span>
                  </h4>

                  {standstillStatus === 'DISPUTED' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                      <AlertCircle className="size-3.5" />
                      Status: Terdapat Sanggahan Rekanan (On Hold)
                    </span>
                  ) : standstillInfo.isEnded || standstillStatus === 'COMPLETED_NO_DISPUTE' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      <CheckCircle2 className="size-3.5" />
                      Status: Masa Sanggah Selesai (Final &amp; Inkracht)
                    </span>
                  ) : isDataFrozen ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                      <Clock className="size-3.5" />
                      Status: {standstillInfo.remainingText}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Otomatis aktif 3 hari setelah Pemenang Tender disahkan
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-muted-foreground leading-relaxed">
                      {standstillStatus === 'DISPUTED' ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          ⚠️ Terdapat catatan tangguhan dari peserta tender: &quot;{disputeNotes}&quot;. Penerbitan PO ditahan hingga klarifikasi selesai.
                        </span>
                      ) : standstillInfo.isEnded || standstillStatus === 'COMPLETED_NO_DISPUTE' ? (
                        <span>
                          ✓ Masa sanggah 3 hari kalender telah berakhir tanpa tangguhan dari bidder lain. Paket tender dinyatakan <strong>selesai secara teknis dan administratif</strong>, sah untuk penerbitan PO.
                        </span>
                      ) : isDataFrozen ? (
                        <span>
                          ⏳ Masa sanggah sedang berjalan hingga <strong>{standstillInfo.endsAtFormatted} WIB</strong> ({standstillInfo.remainingText}). Seluruh portal penawaran vendor telah dikunci total untuk menjamin integritas data.
                        </span>
                      ) : (
                        <span>
                          Setelah tombol <em>&quot;Sahkan Pemenang Tender&quot;</em> ditekan, sistem otomatis membekukan data dan memberikan waktu 3 hari kalender bagi bidder lain untuk menyampaikan tangguhan jika ada ketidaksesuaian.
                        </span>
                      )}
                    </p>

                    {isDataFrozen && (
                      <div className="flex items-center gap-2 shrink-0">
                        {standstillStatus === 'DISPUTED' ? (
                          <button
                            type="button"
                            onClick={handleResolveDispute}
                            disabled={isSaving}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-sm transition cursor-pointer"
                          >
                            <Check className="size-3.5" />
                            <span>Selesaikan Sanggahan</span>
                          </button>
                        ) : standstillStatus === 'IN_PROGRESS' && !standstillInfo.isEnded ? (
                          <>
                            <button
                              type="button"
                              onClick={handleConfirmNoDispute}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-600/30 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                              title="Seluruh bidder mengonfirmasi tidak ada tangguhan, selesaikan masa sanggah lebih awal"
                            >
                              <Check className="size-3.5" />
                              <span>Bebas Sanggahan</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRecordDispute}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                              title="Catat jika terdapat surat sanggahan dari rekanan"
                            >
                              <AlertCircle className="size-3.5" />
                              <span>Catat Sanggahan</span>
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BERITA ACARA EVALUASI PENGADAAN (BAEP) ACTION */}
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Berita Acara Evaluasi Pengadaan (BAEP-{packageData.packageNumber})
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Format naskah audit resmi hasil tabulasi komparasi penawaran rekanan untuk arsip pengadaan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const winner = winningBid;
                        const mockPkg: PratenderPackage = {
                          ...packageData,
                          awardedVendor: winner?.vendorName,
                          awardedValue: winningBidValue,
                          poNumberGenerated: packageData.poNumberGenerated || `CPL-PO-26-${Math.floor(10000 + Math.random() * 90000)}`,
                          evaluationSummary: {
                            ...(packageData.evaluationSummary || {}),
                            winningVendorId: winner?.id,
                            winningVendorName: winner?.vendorName,
                            winningAmount: winningBidValue,
                            approvalStatus: evalApprovalStatus,
                            approvedBy: evalApprovedBy,
                            approvedAt: evalApprovedAt,
                            releaseTierId: requiredTier.id,
                            releaseTierName: requiredTier.name,
                            isPoReleased: evalApprovalStatus === 'APPROVED',
                            poReleasedAt: evalApprovalStatus === 'APPROVED' ? evalApprovedAt : undefined,
                            poReleasedBy: evalApprovalStatus === 'APPROVED' ? evalApprovedBy : undefined,
                          },
                        };
                        const poBytes = await generatePoAwardDocumentPdf(mockPkg, mockPkg.poNumberGenerated);
                        triggerBrowserPdfDownload(poBytes, `PURCHASE_ORDER_${mockPkg.poNumberGenerated}_${winner?.vendorName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
                        setSuccessMsg(`✓ Berkas Purchase Order (PO Award) ${mockPkg.poNumberGenerated} berhasil diunduh!`);
                        setTimeout(() => setSuccessMsg(null), 3000);
                      } catch (err: any) {
                        alert(`Gagal unduh PO: ${err.message}`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 transition cursor-pointer"
                    title="Pratinjau & Unduh Dokumen Purchase Order (PO Award) Resmi untuk Pemenang Tender"
                  >
                    <Download className="size-3.5" />
                    <span>Unduh PDF PO Award</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBaep}
                    className="px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="size-3.5" />
                    <span>Salin Naskah BAEP</span>
                  </button>
                </div>
              </div>

              {/* OTORISASI BERJENJANG MATRIKS APPROVAL (SAP RELEASE STRATEGY) */}
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-purple-600" />
                    <span>Matriks Otorisasi Berjenjang (SAP Release Strategy)</span>
                  </h4>
                  {evalApprovalStatus === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                      <CheckCircle2 className="size-3.5" />
                      Status: Released &amp; Disetujui (PO Unlocked)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                      <Lock className="size-3.5" />
                      Status: Menunggu Release Otorisasi ({requiredTier.name})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Tier 1 Card */}
                  {(() => {
                    const isTierActive = requiredTier.id === 'tier-1';
                    const isPassed = requiredTier.id === 'tier-2' || requiredTier.id === 'tier-3';
                    return (
                      <div
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isTierActive
                            ? evalApprovalStatus === 'APPROVED'
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/20'
                              : 'border-purple-500 bg-purple-500/5 shadow-md ring-2 ring-purple-500/30'
                            : isPassed
                            ? 'border-border/60 bg-muted/30 opacity-60'
                            : 'border-border/60 bg-muted/20 opacity-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              Tier 1 &bull; Nilai &le; Rp {(approvalSettings.tier1.maxAmount || 5000000).toLocaleString('id-ID')}
                            </span>
                            {isTierActive && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white">
                                TIER AKTIF
                              </span>
                            )}
                          </div>
                          <strong className="text-foreground block text-sm">{approvalSettings.tier1.authorizedRoleLabel}</strong>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{approvalSettings.tier1.scopeDescription}</p>
                        </div>

                        {isTierActive && (
                          <div className="mt-3 pt-3 border-t border-border/80">
                            {evalApprovalStatus === 'APPROVED' ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                                  <Check className="size-3.5" />
                                  <span>Telah Di-release Resmi</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Oleh: <strong className="text-foreground">{evalApprovedBy || 'Pejabat Berwenang'}</strong>
                                  {evalApprovedAt && ` (${new Date(evalApprovedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleRevokeRelease}
                                  disabled={isSaving}
                                  className="text-[10px] text-red-500 hover:underline inline-block mt-1 font-medium cursor-pointer"
                                >
                                  Batalkan Release
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={handleReleaseApproval}
                                  disabled={!canRelease.allowed || isSaving}
                                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title={canRelease.allowed ? 'Klik untuk release otorisasi penerbitan PO' : canRelease.reason}
                                >
                                  <ShieldCheck className="size-4" />
                                  <span>Otorisasi &amp; Release PO</span>
                                </button>
                                {!canRelease.allowed && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                    {canRelease.reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Tier 2 Card */}
                  {(() => {
                    const isTierActive = requiredTier.id === 'tier-2';
                    const isBypassed = requiredTier.id === 'tier-3';
                    return (
                      <div
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isTierActive
                            ? evalApprovalStatus === 'APPROVED'
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/20'
                              : 'border-purple-500 bg-purple-500/5 shadow-md ring-2 ring-purple-500/30'
                            : isBypassed
                            ? 'border-border/60 bg-muted/30 opacity-60'
                            : 'border-border/60 bg-muted/20 opacity-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                              Tier 2 &bull; &le; Rp {(approvalSettings.tier2.maxAmount || 30000000).toLocaleString('id-ID')}
                            </span>
                            {isTierActive && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white">
                                TIER AKTIF
                              </span>
                            )}
                          </div>
                          <strong className="text-foreground block text-sm">{approvalSettings.tier2.authorizedRoleLabel}</strong>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{approvalSettings.tier2.scopeDescription}</p>
                        </div>

                        {isTierActive && (
                          <div className="mt-3 pt-3 border-t border-border/80">
                            {evalApprovalStatus === 'APPROVED' ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                                  <Check className="size-3.5" />
                                  <span>Telah Di-release Resmi</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Oleh: <strong className="text-foreground">{evalApprovedBy || 'Pejabat Berwenang'}</strong>
                                  {evalApprovedAt && ` (${new Date(evalApprovedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleRevokeRelease}
                                  disabled={isSaving}
                                  className="text-[10px] text-red-500 hover:underline inline-block mt-1 font-medium cursor-pointer"
                                >
                                  Batalkan Release
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={handleReleaseApproval}
                                  disabled={!canRelease.allowed || isSaving}
                                  className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title={canRelease.allowed ? 'Klik untuk release otorisasi penerbitan PO' : canRelease.reason}
                                >
                                  <ShieldCheck className="size-4" />
                                  <span>Otorisasi &amp; Release PO</span>
                                </button>
                                {!canRelease.allowed && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                    {canRelease.reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Tier 3 Card */}
                  {(() => {
                    const isTierActive = requiredTier.id === 'tier-3';
                    return (
                      <div
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isTierActive
                            ? evalApprovalStatus === 'APPROVED'
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-2 ring-emerald-500/20'
                              : 'border-purple-500 bg-purple-500/5 shadow-md ring-2 ring-purple-500/30'
                            : 'border-border/60 bg-muted/20 opacity-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                              Tier 3 &bull; &gt; Rp {(approvalSettings.tier2.maxAmount || 30000000).toLocaleString('id-ID')}
                            </span>
                            {isTierActive && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white">
                                TIER AKTIF
                              </span>
                            )}
                          </div>
                          <strong className="text-foreground block text-sm">{approvalSettings.tier3.authorizedRoleLabel}</strong>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{approvalSettings.tier3.scopeDescription}</p>
                        </div>

                        {isTierActive && (
                          <div className="mt-3 pt-3 border-t border-border/80">
                            {evalApprovalStatus === 'APPROVED' ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                                  <Check className="size-3.5" />
                                  <span>Telah Di-release Resmi</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  Oleh: <strong className="text-foreground">{evalApprovedBy || 'Pejabat Berwenang'}</strong>
                                  {evalApprovedAt && ` (${new Date(evalApprovedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})`}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleRevokeRelease}
                                  disabled={isSaving}
                                  className="text-[10px] text-red-500 hover:underline inline-block mt-1 font-medium cursor-pointer"
                                >
                                  Batalkan Release
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={handleReleaseApproval}
                                  disabled={!canRelease.allowed || isSaving}
                                  className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title={canRelease.allowed ? 'Klik untuk release otorisasi penerbitan PO' : canRelease.reason}
                                >
                                  <ShieldCheck className="size-4" />
                                  <span>Otorisasi &amp; Release PO</span>
                                </button>
                                {!canRelease.allowed && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                    {canRelease.reason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="font-semibold block mb-1 text-xs text-foreground">
                    Catatan Keputusan Otorisasi / Rekomendasi Tender:
                  </label>
                  <textarea
                    rows={2}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Contoh: Disetujui pemenang tender kepada rekanan peringkat 1 dengan harga negosiasi final dan siap diterbitkan PO."
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-4 bg-muted/60 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Tutup
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveAllToPackage('EVALUATION')}
              disabled={isSaving || bids.length === 0}
              className="px-4 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Simpan Evaluasi CBT</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAllToPackage('AWARDED')}
              disabled={isSaving || bids.length === 0}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Award className="size-3.5" />
              <span>Sahkan Pemenang Tender</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAllToPackage('COMPLETED')}
              disabled={isSaving || bids.length === 0 || evalApprovalStatus !== 'APPROVED' || standstillStatus === 'DISPUTED'}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50 ${
                evalApprovalStatus === 'APPROVED' && standstillStatus !== 'DISPUTED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-muted text-muted-foreground border border-border cursor-not-allowed'
              }`}
              title={
                standstillStatus === 'DISPUTED'
                  ? 'Ditahan: Terdapat sanggahan rekanan yang belum diselesaikan'
                  : evalApprovalStatus === 'APPROVED'
                  ? 'Terbitkan nomor PO resmi ERP untuk dimasukkan ke alur FSTB & TTB'
                  : `Terkunci: Memerlukan otorisasi release dari ${requiredTier.authorizedRoleLabel} (${requiredTier.name})`
              }
            >
              {evalApprovalStatus === 'APPROVED' && standstillStatus !== 'DISPUTED' ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <Lock className="size-3.5 text-amber-500" />
              )}
              <span>Terbitkan Purchase Order (PO)</span>
              {standstillStatus === 'DISPUTED' ? (
                <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 ml-1">
                  Ada Sanggahan
                </span>
              ) : evalApprovalStatus !== 'APPROVED' ? (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 ml-1">
                  Terkunci
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

