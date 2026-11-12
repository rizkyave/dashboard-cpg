'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Package,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Download,
  ExternalLink,
  Ship,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  Info,
  DollarSign,
  ChevronDown,
  X,
  ShieldAlert,
  Loader2,
  Calendar,
  Building2,
  Check,
  Copy,
  Plus,
  Send,
  ListFilter,
  Tag,
  ArrowUpDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TabType } from '@/types/procurement';
import { PurchasePlanningItem, PurchasePlanningResponse } from '@/app/api/purchase-planning/route';
import { PratenderPackage, PratenderPackageItem } from '@/types/pratender';
import ConfidentialMaskedValue from './ConfidentialMaskedValue';

interface PurchasePlanningTabProps {
  onNavigateTab?: (tab: TabType) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function PurchasePlanningTab({
  onNavigateTab,
  showToast,
}: PurchasePlanningTabProps) {
  const [data, setData] = useState<PurchasePlanningResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter & Sort States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedVessel, setSelectedVessel] = useState<string>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [selectedDataSource, setSelectedDataSource] = useState<'ALL' | 'DESKTOP_EXCEL' | 'EFPB_LIVE' | 'HYBRID_CONSOLIDATED'>('ALL');
  const [sortBy, setSortBy] = useState<'urgency' | 'category' | 'cost' | 'name' | 'reorderQty'>('urgency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Batch Upload Modal State
  const [isUploadBatchModalOpen, setIsUploadBatchModalOpen] = useState<boolean>(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'append' | 'merge' | 'replace'>('append');
  const [uploadBatchNo, setUploadBatchNo] = useState<string>('');
  const [isDeletingBatch, setIsDeletingBatch] = useState<string | null>(null);

  // Hybrid Sync State
  const [isSyncingHybrid, setIsSyncingHybrid] = useState<boolean>(false);

  // Multi-Selection State (Item konfirmasi siap PO / Pratender)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Selected item modal detail
  const [selectedItemDetail, setSelectedItemDetail] = useState<PurchasePlanningItem | null>(null);

  // Modal Bentuk Paket Pratender
  const [isCreatePratenderModalOpen, setIsCreatePratenderModalOpen] = useState<boolean>(false);
  const [pkgTitle, setPkgTitle] = useState<string>('');
  const [pkgCategory, setPkgCategory] = useState<string>('General');
  const [pkgClosingDate, setPkgClosingDate] = useState<string>('');
  const [pkgNotes, setPkgNotes] = useState<string>('');
  const [pkgVendor, setPkgVendor] = useState<string>('');
  const [customItemQtys, setCustomItemQtys] = useState<Record<string, number>>({});
  const [isSubmittingPkg, setIsSubmittingPkg] = useState<boolean>(false);

  // 1. Fetch data dari API
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/purchase-planning?_t=${Date.now()}`);
      if (res.ok) {
        const json: PurchasePlanningResponse = await res.json();
        if (json.success) {
          setData(json);
          if (isManual) {
            showToast?.('Data perencanaan pengadaan berhasil diperbarui.', 'success');
          }
        }
      }
    } catch {
      if (isManual) {
        showToast?.('Gagal memuat data perencanaan pengadaan.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. Pilih file Excel / CSV -> Buka Modal Opsi Multi-Batch
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hitung saran nomor batch berikutnya (mis. CPL-PP-2026-002)
    let maxSeq = data?.items && data.items.length > 0 ? 1 : 0;
    (data?.items || []).forEach((it) => {
      const matches = (it.batchNo || '').match(/CPL-PP-\d{4}-(\d+)/gi) || [];
      matches.forEach((m) => {
        const num = parseInt(m.split('-').pop() || '0', 10);
        if (num > maxSeq) maxSeq = num;
      });
    });
    const nextBatch = `CPL-PP-${new Date().getFullYear()}-${String(maxSeq + 1).padStart(3, '0')}`;

    setPendingUploadFile(file);
    setUploadBatchNo(nextBatch);
    setUploadMode(data?.items && data.items.length > 0 ? 'append' : 'replace');
    setIsUploadBatchModalOpen(true);

    if (e.target) e.target.value = '';
  };

  const handleConfirmBatchUpload = async () => {
    if (!pendingUploadFile) return;

    setIsUploading(true);
    setIsUploadBatchModalOpen(false);
    showToast?.(`Memproses ${pendingUploadFile.name} (${uploadBatchNo || 'Batch Baru'})...`, 'info');

    try {
      const formData = new FormData();
      formData.append('file', pendingUploadFile);
      formData.append('uploadMode', uploadMode);
      if (uploadBatchNo.trim()) {
        formData.append('batchNo', uploadBatchNo.trim());
      }

      const res = await fetch('/api/purchase-planning', {
        method: 'POST',
        body: formData,
      });

      const json: PurchasePlanningResponse = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setSelectedItemIds(new Set());
        if (uploadMode === 'append' && uploadBatchNo.trim()) {
          setSelectedBatch(uploadBatchNo.trim());
        } else {
          setSelectedBatch('ALL');
        }
        showToast?.(
          json.message || `✓ Berhasil mengimpor ${json.items.length.toLocaleString('id-ID')} item dari ${pendingUploadFile.name}!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal memproses file Excel.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Terjadi kesalahan saat mengunggah file.', 'error');
    } finally {
      setIsUploading(false);
      setPendingUploadFile(null);
    }
  };

  const handleDeleteBatch = async (batchNoToDelete: string) => {
    setIsDeletingBatch(batchNoToDelete);
    try {
      const res = await fetch(
        `/api/purchase-planning?action=delete-batch&batchNo=${encodeURIComponent(batchNoToDelete)}`,
        { method: 'POST' }
      );
      const json: PurchasePlanningResponse = await res.json();
      if (res.ok && json.success) {
        setData(json);
        if (selectedBatch === batchNoToDelete) {
          setSelectedBatch('ALL');
        }
        setSelectedItemIds(new Set());
        showToast?.(json.message || `Batch ${batchNoToDelete} dihapus.`, 'info');
      } else {
        showToast?.(json.message || 'Gagal menghapus batch.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Terjadi kesalahan saat menghapus batch.', 'error');
    } finally {
      setIsDeletingBatch(null);
    }
  };

  // 3. Muat langsung dari file Desktop (PURCHASE_PLANNING_BATCH_001_CPG.xlsx)
  const handleLoadDesktop = async () => {
    setIsRefreshing(true);
    showToast?.('Membaca berkas PURCHASE_PLANNING_BATCH_001_CPG.xlsx dari Desktop...', 'info');

    try {
      const res = await fetch('/api/purchase-planning?action=load-desktop', {
        method: 'POST',
      });
      const json: PurchasePlanningResponse = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setSelectedItemIds(new Set());
        showToast?.(
          `✓ Berhasil memuat ${json.items.length.toLocaleString('id-ID')} item rencana pembelian dari Desktop!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal memuat file dari Desktop.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Gagal membaca berkas di Desktop.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Sinkronisasi Hybrid: Menggabungkan Excel Desktop + e-FPB Disetujui Logistik
  const handleSyncHybrid = async (reloadDesktop = false) => {
    setIsSyncingHybrid(true);
    showToast?.(
      reloadDesktop
        ? 'Membaca ulang Excel Desktop & menyinkronkan dengan e-FPB disetujui...'
        : 'Menyinkronkan item e-FPB yang telah disetujui Logistik ke rencana pengadaan...',
      'info'
    );

    try {
      const res = await fetch(`/api/purchase-planning?action=sync-hybrid&reloadDesktop=${reloadDesktop}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
        setSelectedItemIds(new Set());
        showToast?.(
          `✓ ${json.message || 'Sinkronisasi berhasil!'}`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal menyinkronkan data.', 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Terjadi kesalahan saat sinkronisasi hybrid.', 'error');
    } finally {
      setIsSyncingHybrid(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format IDR Currency
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Daftar armada unik
  const uniqueVessels = useMemo(() => {
    if (!data?.items) return [];
    const setV = new Set<string>();
    data.items.forEach((i) => i.requestingVessels.forEach((v) => setV.add(v)));
    return Array.from(setV).sort();
  }, [data]);

  // Daftar batch unik beserta ringkasan item & estimasi biaya
  const uniqueBatches = useMemo(() => {
    if (!data?.items) return [];
    const batchMap = new Map<string, { batchNo: string; count: number; budget: number }>();
    data.items.forEach((it) => {
      const rawBatch = it.batchNo || 'CPL-PP-2026-001';
      const tokens = rawBatch
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      tokens.forEach((b) => {
        const cur = batchMap.get(b) || { batchNo: b, count: 0, budget: 0 };
        cur.count += 1;
        cur.budget += it.totalEstimatedCost || 0;
        batchMap.set(b, cur);
      });
    });
    return Array.from(batchMap.values()).sort((a, b) => a.batchNo.localeCompare(b.batchNo));
  }, [data]);

  // Filter & Sort Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    let result = data.items.filter((item) => {
      // Filter Batch
      if (selectedBatch !== 'ALL') {
        const itemBatches = (item.batchNo || 'CPL-PP-2026-001')
          .split(',')
          .map((s) => s.trim());
        if (!itemBatches.includes(selectedBatch)) return false;
      }

      // Filter Category
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // Filter Urgency
      if (selectedUrgency !== 'ALL' && item.urgency !== selectedUrgency) return false;

      // Filter Vessel
      if (selectedVessel !== 'ALL' && !item.requestingVessels.includes(selectedVessel)) return false;

      // Filter Sumber Data (Hybrid, e-FPB, Desktop)
      if (selectedDataSource !== 'ALL') {
        const itemSource = item.dataSource || 'DESKTOP_EXCEL';
        if (itemSource !== selectedDataSource) return false;
      }

      // Filter Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.itemName.toLowerCase().includes(q);
        const matchCode = item.itemCode.toLowerCase().includes(q);
        const matchVendor = item.suggestedVendor?.toLowerCase().includes(q) || false;
        const matchVessel = item.requestingVessels.some((v) => v.toLowerCase().includes(q));
        const matchFpb = item.fpbRefs.some((f) => f.toLowerCase().includes(q));
        const matchBatch = item.batchNo?.toLowerCase().includes(q) || false;
        if (!matchName && !matchCode && !matchVendor && !matchVessel && !matchFpb && !matchBatch) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === 'urgency') {
        const weight: Record<string, number> = { CRITICAL: 3, REORDER: 2, PLANNED: 1 };
        valA = weight[a.urgency] || 0;
        valB = weight[b.urgency] || 0;
      } else if (sortBy === 'category') {
        valA = a.category;
        valB = b.category;
      } else if (sortBy === 'cost') {
        valA = a.totalEstimatedCost;
        valB = b.totalEstimatedCost;
      } else if (sortBy === 'name') {
        valA = a.itemName;
        valB = b.itemName;
      } else if (sortBy === 'reorderQty') {
        valA = a.recommendedOrderQty;
        valB = b.recommendedOrderQty;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, selectedCategory, selectedUrgency, selectedVessel, searchQuery, sortBy, sortOrder]);

  // Checkbox Selection Logic
  const isAllFilteredSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((it) => selectedItemIds.has(it.id));
  }, [filteredItems, selectedItemIds]);

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredItems.forEach((it) => next.delete(it.id));
      } else {
        filteredItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  };

  // Pilih semua item dalam kategori tertentu (Per Kategori)
  const handleSelectByCategory = (catName: string) => {
    if (!data?.items) return;
    const catItems = data.items.filter((it) => it.category === catName);
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const isAllCatSelected = catItems.every((it) => next.has(it.id));
      if (isAllCatSelected) {
        catItems.forEach((it) => next.delete(it.id));
        showToast?.(`Batal memilih kategori "${catName}".`, 'info');
      } else {
        catItems.forEach((it) => next.add(it.id));
        showToast?.(`✓ ${catItems.length} item kategori "${catName}" berhasil dipilih!`, 'success');
      }
      return next;
    });
  };

  // Item terpilih dalam array
  const selectedItemsList = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((it) => selectedItemIds.has(it.id));
  }, [data, selectedItemIds]);

  const selectedTotalCost = useMemo(() => {
    return selectedItemsList.reduce((sum, it) => sum + it.totalEstimatedCost, 0);
  }, [selectedItemsList]);

  // Buka Modal Pembuatan Paket Pratender
  const handleOpenCreatePratenderModal = () => {
    if (selectedItemsList.length === 0) {
      showToast?.('Pilih setidaknya 1 item yang konfirm untuk dibentuk menjadi paket pratender.', 'warning');
      return;
    }

    // Tentukan kategori dominan dari item terpilih
    const catCount: Record<string, number> = {};
    const initQtys: Record<string, number> = {};
    selectedItemsList.forEach((it) => {
      catCount[it.category] = (catCount[it.category] || 0) + 1;
      initQtys[it.id] = it.recommendedOrderQty;
    });

    const dominantCategory = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
    setPkgCategory(dominantCategory);

    const yearStr = new Date().getFullYear().toString().slice(-2);
    setPkgTitle(`Paket Pengadaan ${dominantCategory} Armada Q4 20${yearStr}`);
    setPkgClosingDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setPkgNotes('Spesifikasi asli bergaransi resmi, pengiriman langsung ke Gudang Somber / Galangan CPG.');
    setPkgVendor(selectedItemsList[0]?.suggestedVendor || '');
    setCustomItemQtys(initQtys);

    setIsCreatePratenderModalOpen(true);
  };

  // Simpan Paket Pratender Baru ke API
  const handleConfirmCreatePratenderPackage = async () => {
    if (!pkgTitle.trim()) {
      showToast?.('Judul paket tender wajib diisi.', 'warning');
      return;
    }

    if (selectedItemsList.length === 0) return;

    setIsSubmittingPkg(true);
    try {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
      const packageNumber = `CPG-TDR-${yearStr}-${randomSeq}`;

      let calculatedBudget = 0;
      const packageItems: PratenderPackageItem[] = selectedItemsList.map((item) => {
        const qty = customItemQtys[item.id] !== undefined ? customItemQtys[item.id] : item.recommendedOrderQty;
        const targetTotalPrice = qty * item.avgUnitPrice;
        calculatedBudget += targetTotalPrice;

        return {
          itemId: item.itemCode || item.id,
          itemName: item.itemName,
          category: item.category,
          satuan: item.unit,
          totalQty: qty,
          originalQty: item.totalRequestedQty,
          targetPrice: item.avgUnitPrice,
          targetTotalPrice,
          notes: item.urgencyReason || undefined,
          vessels: item.requestingVessels,
          requestFpbs: item.fpbRefs,
        };
      });

      const newPkg: PratenderPackage = {
        id: `pkg-${Date.now()}`,
        packageNumber,
        title: pkgTitle.trim(),
        category: pkgCategory,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        createdBy: 'Staf Purchasing & PPIC',
        targetClosingDate: pkgClosingDate || undefined,
        description: pkgNotes.trim() || undefined,
        items: packageItems,
        totalEstimatedBudget: calculatedBudget,
        invitedVendors: pkgVendor ? [pkgVendor] : undefined,
      };

      const res = await fetch('/api/pratender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_PACKAGE',
          package: newPkg,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast?.(`✓ Paket Pratender "${packageNumber}" berhasil dibentuk dan disimpan!`, 'success');
        setIsCreatePratenderModalOpen(false);
        setSelectedItemIds(new Set());

        if (onNavigateTab) {
          onNavigateTab('pratender');
        }
      } else {
        throw new Error(json.error || 'Gagal menyimpan paket pratender.');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Terjadi kesalahan saat menyimpan paket.', 'error');
    } finally {
      setIsSubmittingPkg(false);
    }
  };

  // Salin Rangkuman Item Konfirmasi Siap PO
  const handleCopyPoSummary = async () => {
    if (selectedItemsList.length === 0) return;

    const lines = [
      `DAFTAR ITEM KONFIRMASI SIAP PO (PURCHASE PLANNING CPG)`,
      `Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      `Total Item Terkonfirmasi: ${selectedItemsList.length} item`,
      `Total Estimasi Anggaran: ${formatRupiah(selectedTotalCost)}`,
      `============================================================`,
      ...selectedItemsList.map(
        (it, idx) =>
          `${idx + 1}. [${it.itemCode}] ${it.itemName}\n   - Kategori: ${it.category}\n   - Qty Beli: ${it.recommendedOrderQty} ${it.unit}\n   - Est. Biaya: ${formatRupiah(it.totalEstimatedCost)} (@${formatRupiah(it.avgUnitPrice)})\n   - Peminta: ${it.requestingVessels.join(', ')}\n   - Ref FPB: ${it.fpbRefs.join(', ')}\n   - Catatan: ${it.urgencyReason}`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n\n'));
      showToast?.(`✓ Rincian ${selectedItemsList.length} item siap PO berhasil disalin ke clipboard!`, 'success');
    } catch {
      showToast?.('Gagal menyalin rincian PO.', 'error');
    }
  };

  // Ekspor CSV
  const handleExportCsv = () => {
    if (!filteredItems || filteredItems.length === 0) {
      showToast?.('Tidak ada data yang dapat diekspor.', 'warning');
      return;
    }

    const headers = [
      'Kode Barang',
      'Batch ID',
      'Nama Barang',
      'Kategori',
      'Satuan',
      'Stok Gudang Somber',
      'Kebutuhan Armada',
      'Rekomendasi Beli',
      'Estimasi Harga Satuan (Rp)',
      'Total Estimasi Biaya (Rp)',
      'Tingkat Urgensi',
      'Estimasi Lead Time (Hari)',
      'Potensi Hemat Bulk (%)',
      'Armada Peminta',
      'Referensi No. FPB',
      'Rekomendasi Vendor',
    ];

    const rows = filteredItems.map((i) => [
      `"${i.itemCode}"`,
      `"${i.batchNo || 'CPL-PP-2026-001'}"`,
      `"${i.itemName}"`,
      `"${i.category}"`,
      `"${i.unit}"`,
      i.currentStock,
      i.totalRequestedQty,
      i.recommendedOrderQty,
      i.avgUnitPrice,
      i.totalEstimatedCost,
      `"${i.urgency}"`,
      i.leadTimeDays,
      `${i.potentialBulkDiscount}%`,
      `"${i.requestingVessels.join(', ')}"`,
      `"${i.fpbRefs.join(', ')}"`,
      `"${i.suggestedVendor || '-'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Plan_CPG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Rencana pengadaan berhasil diekspor ke CSV.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ── HEADER UTAMA ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="size-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Perencanaan Pengadaan &amp; Peramalan Kebutuhan</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Forecast &bull; Net Demand
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Kalkulasi otomatis kebutuhan armada lintas kapal, evaluasi stok gudang, dan pembentukan paket Pratender per satuan item atau per kategori.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Input File Tersembunyi untuk Upload Excel */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Tombol Muat dari Desktop */}
          <button
            type="button"
            onClick={handleLoadDesktop}
            disabled={isRefreshing || isUploading}
            className="h-9 px-3 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Muat langsung dari berkas PURCHASE_PLANNING_BATCH_001_CPG.xlsx di Desktop"
          >
            <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span>Muat dari Desktop</span>
          </button>

          {/* Tombol Import Excel Accurate / Batch */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRefreshing}
            className="h-9 px-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Import berkas Excel dari Accurate atau Purchase Planning Batch"
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin text-blue-500" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-blue-500" />
            )}
            <span>Import Excel Accurate</span>
          </button>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing || isUploading}
            className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            title="Segarkan data analisis pengadaan"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Unduh format tabel Excel / CSV"
          >
            <Download className="size-3.5 text-emerald-500" />
            <span>Ekspor CSV</span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('pratender')}
              className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-98"
              title="Buka modul Pratender Material untuk membuat paket tender bersama"
            >
              <Layers className="size-3.5" />
              <span>Menu Pratender</span>
            </button>
          )}
        </div>
      </div>

      {/* ── BANNER SINKRONISASI HYBRID (DESKTOP + LIVE e-FPB) ── */}
      {data && (
        <div className="space-y-2.5">
          {/* Bar Kontrol & Status Sinkronisasi */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-card to-card border border-indigo-500/30 text-xs shadow-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">Sinkronisasi Hybrid:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-bold border border-blue-500/30" title="File Excel Master Desktop">
                  <FileSpreadsheet className="size-3 text-blue-500" />
                  <span>{data.syncStats?.desktopFileName || 'PURCHASE_PLANNING_BATCH_001_CPG.xlsx'}</span>
                </span>
                <span className="text-muted-foreground">+</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 font-mono text-[11px] font-bold border border-purple-500/30" title="Data persetujuan e-FPB dari modul Review Logistik">
                  <Sparkles className="size-3 text-purple-500" />
                  <span>e-FPB Live Sync</span>
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-muted-foreground text-[11px] border-l border-border pl-3">
                <span>
                  📁 <strong className="text-foreground">{data.syncStats?.desktopCount ?? data.summary.totalItems}</strong> Desktop
                </span>
                <span>&bull;</span>
                <span>
                  🌐 <strong className="text-foreground">{data.syncStats?.efpbCount ?? 0}</strong> e-FPB Baru
                </span>
                <span>&bull;</span>
                <span>
                  🔄 <strong className="text-foreground">{data.syncStats?.hybridCount ?? 0}</strong> Terkonsolidasi
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Tombol Tarik & Sinkronkan e-FPB */}
              <button
                type="button"
                onClick={() => handleSyncHybrid(false)}
                disabled={isSyncingHybrid || isRefreshing}
                className="h-8 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                title="Tarik data item e-FPB yang telah disetujui Logistik (keputusan PO) dan gabungkan ke rencana pembelian"
              >
                {isSyncingHybrid ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                <span>Tarik e-FPB Disetujui</span>
                {data.syncStats && data.syncStats.pendingPoItemsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
                    +{data.syncStats.pendingPoItemsCount}
                  </span>
                )}
              </button>

              {/* Tombol Muat Ulang Excel Desktop & Merge */}
              <button
                type="button"
                onClick={() => handleSyncHybrid(true)}
                disabled={isSyncingHybrid || isRefreshing}
                className="h-8 px-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                title="Baca ulang file Excel di Desktop jika ada perubahan manual, lalu otomatis gabungkan kembali dengan e-FPB disetujui"
              >
                <Sparkles className="size-3.5 text-blue-500" />
                <span>Muat Ulang Excel &amp; Gabung</span>
              </button>
            </div>
          </div>

          {/* Notifikasi Alert jika ada e-FPB baru yang siap disinkronkan */}
          {data.syncStats && data.syncStats.pendingPoItemsCount > 0 && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-xs flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span>
                  Terdapat <strong>{data.syncStats.pendingPoItemsCount} item barang</strong> dari <strong>{data.syncStats.pendingApprovedFpbsCount} berkas e-FPB</strong> yang telah disetujui Tim Logistik (keputusan Beli Baru/PO) dan siap ditarik ke dalam perencanaan pembelian.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSyncHybrid(false)}
                disabled={isSyncingHybrid}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs disabled:opacity-60"
              >
                {isSyncingHybrid ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                <span>Sinkronkan Sekarang</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 4 KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Item Kritis */}
        <div className="p-4 rounded-2xl bg-card border border-rose-500/30 bg-rose-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">🚨 Item Kritis (Stok Habis)</span>
            <div className="size-7 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {data?.summary.criticalCount || 0} <span className="text-xs font-medium text-muted-foreground">Item</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stok gudang 0 &amp; mendesak dibutuhkan armada
            </p>
          </div>
        </div>

        {/* Card 2: Item Reorder */}
        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 bg-amber-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⚠️ Mendekati Batas Aman</span>
            <div className="size-7 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data?.summary.reorderCount || 0} <span className="text-xs font-medium text-muted-foreground">Item</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stok di bawah Reorder Point (ROP)
            </p>
          </div>
        </div>

        {/* Card 3: Estimasi Total Anggaran */}
        <div className="p-4 rounded-2xl bg-card border border-indigo-500/30 bg-indigo-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">💰 Est. Anggaran Pengadaan</span>
            <div className="size-7 rounded-xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
              <ConfidentialMaskedValue
                value={data?.summary.totalEstimatedBudget || 0}
                showToast={showToast}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Estimasi total belanja {data?.summary.totalItems || 0} item pengadaan
            </p>
          </div>
        </div>

        {/* Card 4: Potensi Penghematan Bulk */}
        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 bg-emerald-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🎯 Potensi Hemat Bulk Tender</span>
            <div className="size-7 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              <ConfidentialMaskedValue
                value={data?.summary.totalPotentialSavings || 0}
                showToast={showToast}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Efisiensi konsolidasi lintas {data?.summary.activeVesselsCount || 0} armada
            </p>
          </div>
        </div>
      </div>

      {/* ── PILIHAN PER KATEGORI (CATEGORY QUICK SELECTOR BAR) ── */}
      {data?.categories && data.categories.length > 0 && (
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Tag className="size-3.5 text-purple-500" />
              <span>Sortir &amp; Pilih Cepat per Kategori Material:</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Klik kategori untuk memfilter, atau gunakan tombol centang untuk memilih satu kategori sekaligus.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <span>Semua Kategori</span>
              <span className="font-mono text-[10px] opacity-80 font-bold">({data.items.length})</span>
            </button>

            {data.categories.map((cat) => {
              const countInCat = data.items.filter((i) => i.category === cat).length;
              const isSelectedCat = selectedCategory === cat;
              const catItems = data.items.filter((i) => i.category === cat);
              const isAllCatChecked = catItems.length > 0 && catItems.every((it) => selectedItemIds.has(it.id));

              return (
                <div
                  key={cat}
                  className={`inline-flex items-center rounded-xl border text-xs overflow-hidden transition ${
                    isSelectedCat
                      ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(isSelectedCat ? 'ALL' : cat)}
                    className="px-2.5 py-1.5 hover:text-foreground cursor-pointer flex items-center gap-1"
                    title={`Filter tabel ke kategori ${cat}`}
                  >
                    <span>{cat}</span>
                    <span className="font-mono text-[10px] bg-muted/60 px-1.5 py-0.2 rounded font-bold text-foreground">
                      {countInCat}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectByCategory(cat);
                    }}
                    className={`px-2 py-1.5 border-l border-border/80 hover:bg-primary/20 cursor-pointer transition flex items-center justify-center ${
                      isAllCatChecked ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={isAllCatChecked ? `Batal pilih semua item ${cat}` : `Centang semua ${countInCat} item kategori ${cat}`}
                  >
                    {isAllCatChecked ? <Check className="size-3" /> : <Plus className="size-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FILTER & SEARCH BAR ── */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama barang, kode part, armada peminta, atau no. FPB..."
              className="w-full text-xs pl-8.5 pr-8 py-2 rounded-xl bg-background border border-border text-foreground placeholder-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Select Filter Group */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tingkat Urgensi */}
            <div className="inline-flex rounded-xl p-0.5 bg-muted border border-border text-xs">
              <button
                type="button"
                onClick={() => setSelectedUrgency('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  selectedUrgency === 'ALL'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'CRITICAL'
                    ? 'bg-rose-500 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>🚨 Kritis</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('REORDER')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'REORDER'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>⚠️ Reorder</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrgency('PLANNED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedUrgency === 'PLANNED'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>📅 Terencana</span>
              </button>
            </div>

            {/* Filter Armada */}
            {uniqueVessels.length > 0 && (
              <select
                value={selectedVessel}
                onChange={(e) => setSelectedVessel(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary max-w-[160px]"
              >
                <option value="ALL">Semua Unit ({uniqueVessels.length})</option>
                {uniqueVessels.map((v) => (
                  <option key={v} value={v}>
                    🚢 {v}
                  </option>
                ))}
              </select>
            )}

            {/* Filter Batch */}
            {uniqueBatches.length > 0 && (
              <div className="inline-flex items-center gap-1">
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-emerald-500 max-w-[190px]"
                  title="Filter item berdasarkan Batch Upload"
                >
                  <option value="ALL">Semua Batch ({uniqueBatches.length})</option>
                  {uniqueBatches.map((b) => (
                    <option key={b.batchNo} value={b.batchNo}>
                      📦 {b.batchNo} ({b.count})
                    </option>
                  ))}
                </select>
                {selectedBatch !== 'ALL' && uniqueBatches.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Hapus semua item di ${selectedBatch}? Batch lain tidak akan terpengaruh.`)) {
                        handleDeleteBatch(selectedBatch);
                      }
                    }}
                    disabled={isDeletingBatch === selectedBatch}
                    className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer disabled:opacity-50"
                    title={`Hapus batch ${selectedBatch}`}
                  >
                    {isDeletingBatch === selectedBatch ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Filter Sumber Data */}
            <select
              value={selectedDataSource}
              onChange={(e) => setSelectedDataSource(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Semua Jalur Sumber</option>
              <option value="DESKTOP_EXCEL">📁 Excel Desktop</option>
              <option value="EFPB_LIVE">🌐 e-FPB Disetujui</option>
              <option value="HYBRID_CONSOLIDATED">🔄 Konsolidasi Hybrid</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-background border border-border text-foreground font-medium cursor-pointer shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="urgency">Urut: Tingkat Urgensi</option>
              <option value="category">Urut: Kategori Material</option>
              <option value="cost">Urut: Estimasi Biaya</option>
              <option value="reorderQty">Urut: Kuantitas Rekomendasi</option>
              <option value="name">Urut: Nama Barang</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title={sortOrder === 'asc' ? 'Urutan Naik (A-Z)' : 'Urutan Turun (Z-A)'}
            >
              <ArrowUpDown className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── FLOATING SELECTION ACTION BAR (PILIHAN PERSATUAN ITEM & PER KATEGORI) ── */}
      {selectedItemIds.size > 0 && (
        <div className="sticky bottom-4 z-30 p-4 rounded-2xl bg-card/95 backdrop-blur-md border-2 border-primary/50 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-mono font-bold text-sm shadow-sm">
              {selectedItemIds.size}
            </div>
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-2 flex-wrap">
                <span>{selectedItemIds.size} Item Terkonfirmasi Dipilih untuk PO / Pratender</span>
                <span className="text-primary font-mono text-sm font-black">
                  <ConfidentialMaskedValue
                    value={selectedTotalCost}
                    showToast={showToast}
                  />
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Item-item ini siap dibentuk langsung menjadi paket Pratender tender bersama atau diteruskan ke penerbitan PO.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Tombol Bentuk Paket Pratender */}
            <button
              type="button"
              onClick={handleOpenCreatePratenderModal}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-98"
              title="Bentuk paket pratender resmi dari item terpilih"
            >
              <Package className="size-4" />
              <span>Bentuk Paket Pratender ({selectedItemIds.size})</span>
            </button>

            {/* Tombol Salin Ringkasan PO */}
            <button
              type="button"
              onClick={handleCopyPoSummary}
              className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Salin rincian item siap PO ke clipboard untuk pengadaan"
            >
              <Copy className="size-3.5 text-blue-500" />
              <span>Salin Daftar Siap PO</span>
            </button>

            {/* Tombol Batal */}
            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              className="px-3 py-2 rounded-xl border border-border bg-background hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
              title="Batalkan semua pilihan item"
            >
              <X className="size-3.5" />
              <span>Batal</span>
            </button>
          </div>
        </div>
      )}

      {/* ── SMART REORDER MATRIX TABLE ── */}
      <div className="bg-card border border-border rounded-3xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-muted/40 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground">
              Tabel Matriks Rekomendasi Pengadaan ({filteredItems.length} Item)
            </span>
            <span className="text-[10px] text-muted-foreground">
              &bull; Centang item untuk konfirmasi PO &amp; Pratender
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <>
                  <CheckSquare className="size-3.5" />
                  <span>Batal Pilih Semua</span>
                </>
              ) : (
                <>
                  <Square className="size-3.5" />
                  <span>Pilih Semua yang Tampil ({filteredItems.length})</span>
                </>
              )}
            </button>
            <span className="text-muted-foreground font-mono text-[11px]">
              {selectedItemIds.size} terpilih
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground text-[11px] border-b border-border">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                    title={isAllFilteredSelected ? 'Batal pilih semua' : 'Pilih semua item yang tampil'}
                  />
                </th>
                <th className="py-3 px-3 font-semibold min-w-[200px]">Item &amp; Kode Barang</th>
                <th className="py-3 px-3 font-semibold min-w-[130px]">Kategori</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[140px]">Stok vs Kebutuhan</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[110px]">Rekomendasi Beli</th>
                <th className="py-3 px-3 font-semibold min-w-[160px]">Unit / Armada Peminta</th>
                <th className="py-3 px-3 font-semibold text-right min-w-[130px]">Estimasi Biaya</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[100px]">Urgensi</th>
                <th className="py-3 px-3 font-semibold text-center min-w-[70px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground space-y-2">
                    <Loader2 className="size-6 animate-spin text-primary mx-auto" />
                    <p className="text-xs font-medium">Menganalisis data kebutuhan pengadaan...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground space-y-2">
                    <Package className="size-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">Tidak ada item pengadaan yang sesuai</p>
                    <p className="text-[11px] text-muted-foreground">Coba ubah kriteria filter atau pencarian Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isCritical = item.urgency === 'CRITICAL';
                  const isReorder = item.urgency === 'REORDER';
                  const isChecked = selectedItemIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition cursor-pointer ${
                        isChecked
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/30'
                      }`}
                      onClick={() => handleToggleSelectItem(item.id)}
                    >
                      {/* Checkbox Persatuan Item */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                        />
                      </td>

                      {/* 1. Item Name & Code */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground text-xs leading-snug">
                          {item.itemName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {item.itemCode}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Lead Time: ~{item.leadTimeDays} Hari
                          </span>
                        </div>
                        {/* Batch Number & Sumber Data di bawah kode barang */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                            <Layers className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Batch:</span>
                            <span className="font-semibold">{item.batchNo || 'CPL-PP-2026-001'}</span>
                          </span>

                          {/* Badge Sumber Data */}
                          {item.dataSource === 'EFPB_LIVE' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded" title="Item ditarik dari e-FPB yang telah disetujui Logistik">
                              <Sparkles className="size-2.5 text-purple-500" />
                              <span>e-FPB Live</span>
                            </span>
                          ) : item.dataSource === 'HYBRID_CONSOLIDATED' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded" title="Konsolidasi gabungan Excel Desktop + Kebutuhan baru dari e-FPB disetujui">
                              <RefreshCw className="size-2.5 text-teal-500" />
                              <span>Konsolidasi Hybrid</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-muted-foreground bg-muted/60 border border-border px-1.5 py-0.5 rounded" title="Berasal dari berkas Excel Desktop">
                              <FileSpreadsheet className="size-2.5 text-muted-foreground" />
                              <span>Excel Desktop</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td className="py-3 px-3 text-[11px] text-muted-foreground">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground">
                          {item.category}
                        </span>
                      </td>

                      {/* 3. Stock vs Demand */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <span
                            className={`font-bold ${
                              item.currentStock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                            }`}
                          >
                            Stok: {item.currentStock}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Butuh: {item.totalRequestedQty}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ROP: {item.reorderPoint} {item.unit}
                        </div>
                      </td>

                      {/* 4. Recommended Qty */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-black text-xs font-mono">
                          +{item.recommendedOrderQty} {item.unit}
                        </span>
                      </td>

                      {/* 5. Requesting Vessels / Unit */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {item.requestingVessels.slice(0, 2).map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"
                            >
                              <Ship className="size-2.5" />
                              <span>{v}</span>
                            </span>
                          ))}
                          {item.requestingVessels.length > 2 && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              +{item.requestingVessels.length - 2} Unit
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Estimated Cost */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-xs text-foreground">
                          <ConfidentialMaskedValue
                            value={item.totalEstimatedCost}
                            showToast={showToast}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          <ConfidentialMaskedValue
                            value={item.avgUnitPrice}
                            prefix="@ "
                            showLockToggle={false}
                            showToast={showToast}
                          />
                        </div>
                      </td>

                      {/* 7. Urgency Badge */}
                      <td className="py-3 px-3 text-center">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                            KRITIS
                          </span>
                        ) : isReorder ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            REORDER
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                            TERENCANA
                          </span>
                        )}
                      </td>

                      {/* 8. Action Button */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedItemDetail(item)}
                          className="size-7 rounded-lg bg-muted hover:bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer mx-auto"
                          title="Lihat Detail Analisis Pengadaan"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: BENTUK PAKET PRATENDER DARI ITEM TERPILIH ── */}
      {isCreatePratenderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-gradient-to-r from-purple-500/10 via-card to-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <Package className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Bentuk Paket Pratender Baru ({selectedItemsList.length} Item Terpilih)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Paket ini akan diterbitkan ke modul Pratender Material untuk proses Request for Quotation (RFQ) ke vendor.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatePratenderModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Judul Paket */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground">Judul Paket Pengadaan / Tender *</label>
                  <input
                    type="text"
                    value={pkgTitle}
                    onChange={(e) => setPkgTitle(e.target.value)}
                    placeholder="Contoh: Paket Pengadaan Mooring Rope Q4 2026 Armada"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Kategori Paket */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Kategori Material *</label>
                  <select
                    value={pkgCategory}
                    onChange={(e) => setPkgCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden cursor-pointer"
                  >
                    {data?.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Konsolidasi Lintas Kategori">Konsolidasi Lintas Kategori</option>
                  </select>
                </div>

                {/* Target Closing RFQ */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Batas Waktu Penawaran (Closing Date)</label>
                  <input
                    type="date"
                    value={pkgClosingDate}
                    onChange={(e) => setPkgClosingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Rekomendasi Vendor */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground">Rekomendasi Vendor / Rekanan Utama</label>
                  <input
                    type="text"
                    value={pkgVendor}
                    onChange={(e) => setPkgVendor(e.target.value)}
                    placeholder="Contoh: PT. Samudra Tali Indo / Distributor Resmi"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Catatan / Keterangan */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-foreground">Catatan Spesifikasi Pengadaan</label>
                  <textarea
                    rows={2}
                    value={pkgNotes}
                    onChange={(e) => setPkgNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-hidden resize-none"
                  />
                </div>
              </div>

              {/* Tabel Item yang Masuk Paket */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Rincian Item yang Masuk dalam Paket:</span>
                  <span className="font-mono text-primary font-bold">
                    Est. Total Anggaran: {formatRupiah(selectedTotalCost)}
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground text-[10px] border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Nama Barang</th>
                        <th className="py-2 px-2 text-center">Satuan</th>
                        <th className="py-2 px-2 text-center">Qty Beli</th>
                        <th className="py-2 px-3 text-right">Harga Satuan</th>
                        <th className="py-2 px-3 text-right">Total Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedItemsList.map((item) => {
                        const currentQty =
                          customItemQtys[item.id] !== undefined
                            ? customItemQtys[item.id]
                            : item.recommendedOrderQty;
                        const subtotal = currentQty * item.avgUnitPrice;

                        return (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-foreground">{item.itemName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                                <span>{item.itemCode}</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">• Batch: {item.batchNo || 'CPL-PP-2026-001'}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center text-muted-foreground">{item.unit}</td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={1}
                                value={currentQty}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  setCustomItemQtys((prev) => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-16 px-1.5 py-1 rounded-md border border-border text-center font-mono font-bold text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                              {formatRupiah(item.avgUnitPrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                              {formatRupiah(subtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreatePratenderModalOpen(false)}
                disabled={isSubmittingPkg}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmCreatePratenderPackage}
                disabled={isSubmittingPkg || !pkgTitle.trim()}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-md disabled:opacity-60"
              >
                {isSubmittingPkg ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menerbitkan Paket...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    <span>Terbitkan Paket Pratender</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL ITEM TUNGGAL ── */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                    {selectedItemDetail.itemCode}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/20">
                    {selectedItemDetail.category}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 flex items-center gap-1">
                    <Layers className="size-3" />
                    <span>Batch: {selectedItemDetail.batchNo || 'CPL-PP-2026-001'}</span>
                  </span>
                  {selectedItemDetail.dataSource === 'EFPB_LIVE' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20 flex items-center gap-1">
                      <Sparkles className="size-3" />
                      <span>Sumber: e-FPB Disetujui</span>
                    </span>
                  ) : selectedItemDetail.dataSource === 'HYBRID_CONSOLIDATED' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold border border-teal-500/20 flex items-center gap-1">
                      <RefreshCw className="size-3" />
                      <span>Sumber: Konsolidasi Hybrid</span>
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-border flex items-center gap-1">
                      <FileSpreadsheet className="size-3" />
                      <span>Sumber: Excel Desktop</span>
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedItemDetail.itemName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Urgency Alert Box */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  selectedItemDetail.urgency === 'CRITICAL'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                    : selectedItemDetail.urgency === 'REORDER'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {selectedItemDetail.urgency === 'CRITICAL' ? (
                    <AlertTriangle className="size-4 text-rose-500" />
                  ) : selectedItemDetail.urgency === 'REORDER' ? (
                    <Clock className="size-4 text-amber-500" />
                  ) : (
                    <Info className="size-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <div className="font-bold">
                    Status: {selectedItemDetail.urgency === 'CRITICAL' ? 'Prioritas Kritis (Mendesak)' : selectedItemDetail.urgency === 'REORDER' ? 'Perlu Dipesan Ulang (ROP)' : 'Pengadaan Terencana'}
                  </div>
                  <p className="mt-1 leading-relaxed opacity-90">{selectedItemDetail.urgencyReason}</p>
                </div>
              </div>

              {/* 4 Cards Ringkasan Kuantitas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold">Stok Saat Ini</div>
                  <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                    {selectedItemDetail.currentStock} {selectedItemDetail.unit}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold">Total Diminta</div>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                    {selectedItemDetail.totalRequestedQty} {selectedItemDetail.unit}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-center">
                  <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold">Rekomendasi Beli</div>
                  <div className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-0.5 font-mono">
                    +{selectedItemDetail.recommendedOrderQty} {selectedItemDetail.unit}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold">Lead Time</div>
                  <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                    ~{selectedItemDetail.leadTimeDays} Hari
                  </div>
                </div>
              </div>

              {/* Estimasi Keuangan & Diskon Bulk */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
                <div className="font-bold text-foreground">Analisis Biaya &amp; Efisiensi Pengadaan Kolektif:</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Harga Satuan Wajar:</span>
                    <div className="font-mono font-bold text-foreground">{formatRupiah(selectedItemDetail.avgUnitPrice)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Anggaran Dibutuhkan:</span>
                    <div className="font-mono font-bold text-foreground">{formatRupiah(selectedItemDetail.totalEstimatedCost)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estimasi Diskon Borongan:</span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedItemDetail.potentialBulkDiscount}% ({formatRupiah(selectedItemDetail.potentialSavingsAmount)})
                    </div>
                  </div>
                </div>
              </div>

              {/* Armada & Nomor FPB Peminta */}
              <div className="space-y-2">
                <div className="font-bold text-foreground">Armada / Unit Peminta ({selectedItemDetail.requestingVessels.length} Unit):</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItemDetail.requestingVessels.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-semibold"
                    >
                      <Ship className="size-3" />
                      <span>{v}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Referensi Nomor FPB */}
              <div className="space-y-2">
                <div className="font-bold text-foreground">Referensi Nomor FPB Terbuka ({selectedItemDetail.fpbRefs.length} FPB):</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItemDetail.fpbRefs.map((f) => (
                    <span
                      key={f}
                      className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted border border-border text-foreground font-semibold"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Vendor Rekomendasi */}
              {selectedItemDetail.suggestedVendor && (
                <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                  <div className="text-[10px] text-muted-foreground font-semibold">Vendor / Distributor Rekomendasi:</div>
                  <div className="font-bold text-foreground">{selectedItemDetail.suggestedVendor}</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold cursor-pointer transition"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleToggleSelectItem(selectedItemDetail.id);
                    setSelectedItemDetail(null);
                    showToast?.(`Item "${selectedItemDetail.itemName}" telah ditandai untuk paket PO/Pratender.`, 'success');
                  }}
                  className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1 cursor-pointer transition ${
                    selectedItemIds.has(selectedItemDetail.id)
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                      : 'border-primary/40 bg-primary/10 text-primary'
                  }`}
                >
                  {selectedItemIds.has(selectedItemDetail.id) ? (
                    <>
                      <X className="size-3.5" />
                      <span>Batal Centang</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      <span>Centang Item Ini</span>
                    </>
                  )}
                </button>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemDetail(null);
                      onNavigateTab('pratender');
                    }}
                    className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                  >
                    <span>Buka Pratender</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL KONFIRMASI UPLOAD MULTI-BATCH (APPEND / MERGE / REPLACE)
          ═══════════════════════════════════════════════════════════ */}
      {isUploadBatchModalOpen && pendingUploadFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => {
            setIsUploadBatchModalOpen(false);
            setPendingUploadFile(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-blue-500/10 via-card to-emerald-500/10 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  <FileSpreadsheet className="size-3" /> Upload Multi-Batch Excel
                </span>
                <h3 className="text-base font-bold text-foreground truncate max-w-[380px]">
                  {pendingUploadFile.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pilih cara menggabungkan berkas baru dengan data Batch yang sudah ada ({data?.items.length || 0} item saat ini).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadBatchModalOpen(false);
                  setPendingUploadFile(null);
                }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Input Nomor Batch */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Label / Nomor Batch</span>
                  <span className="text-[10px] font-normal text-muted-foreground font-mono">
                    Contoh: CPL-PP-2026-002
                  </span>
                </label>
                <input
                  type="text"
                  value={uploadBatchNo}
                  onChange={(e) => setUploadBatchNo(e.target.value)}
                  placeholder="CPL-PP-2026-002"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm font-mono font-semibold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Pilihan Mode Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Mode Pemrosesan Batch</label>

                <button
                  type="button"
                  onClick={() => setUploadMode('append')}
                  className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    uploadMode === 'append'
                      ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/40'
                      : 'bg-background border-border hover:bg-muted/40'
                  }`}
                >
                  <div className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    uploadMode === 'append' ? 'border-emerald-500' : 'border-muted-foreground/40'
                  }`}>
                    {uploadMode === 'append' && <div className="size-2 rounded-full bg-emerald-500" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      <span>Tambah sebagai Batch Baru (Append)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] uppercase">
                        Direkomendasikan
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Batch I tetap tersimpan utuh. Seluruh item dari file ini masuk sebagai batch baru sehingga bisa difilter terpisah.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('merge')}
                  className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    uploadMode === 'merge'
                      ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/40'
                      : 'bg-background border-border hover:bg-muted/40'
                  }`}
                >
                  <div className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    uploadMode === 'merge' ? 'border-sky-500' : 'border-muted-foreground/40'
                  }`}>
                    {uploadMode === 'merge' && <div className="size-2 rounded-full bg-sky-500" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground">
                      Konsolidasi Item Sama (Smart Merge)
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Jika kode/nama barang sama dengan Batch sebelumnya, kuantitas & anggaran digabung otomatis untuk negosiasi grosir.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode('replace')}
                  className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    uploadMode === 'replace'
                      ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/40'
                      : 'bg-background border-border hover:bg-muted/40'
                  }`}
                >
                  <div className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    uploadMode === 'replace' ? 'border-rose-500' : 'border-muted-foreground/40'
                  }`}>
                    {uploadMode === 'replace' && <div className="size-2 rounded-full bg-rose-500" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground">
                      Ganti Total (Replace Semua Data Lama)
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Menghapus seluruh data Batch sebelumnya dan menggantinya hanya dengan isi file ini.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUploadBatchModalOpen(false);
                  setPendingUploadFile(null);
                }}
                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchUpload}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
              >
                <Check className="size-3.5" />
                <span>Proses Upload Batch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
