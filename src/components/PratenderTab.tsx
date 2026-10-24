'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Package,
  Search,
  Filter,
  CheckSquare,
  Square,
  Plus,
  ExternalLink,
  Download,
  Share2,
  Calendar,
  Ship,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Award,
  Trash2,
  Eye,
  RefreshCw,
  Copy,
  Printer,
  ShoppingBag,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import {
  PratenderOpenItem,
  PratenderPackage,
  PratenderPackageItem,
  PratenderRequestRef,
  PratenderStatus,
} from '@/types/pratender';
import { useAuth } from '@/context/AuthContext';

interface PratenderTabProps {
  procurementItems?: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  sisaLayananItems?: SisaLayananItem[];
  onOpenAudit?: (fpbOrPo: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Helper klasifikasi maritim cerdas
function classifyMaritimeItem(itemName: string, categoryName: string = ''): string {
  const text = `${itemName || ''} ${categoryName || ''}`.toLowerCase();

  if (
    text.includes('filter') || text.includes('engine') || text.includes('piston') ||
    text.includes('injector') || text.includes('gasket') || text.includes('liner') ||
    text.includes('turbo') || text.includes('nozzle') || text.includes('cooler') ||
    text.includes('bearing') || text.includes('v-belt') || text.includes('fanbelt') ||
    text.includes('fan belt') || text.includes('timing belt') || text.includes('cylinder') ||
    text.includes('crankshaft') || text.includes('camshaft') || text.includes('rocker arm') ||
    text.includes('oil seal') || text.includes('packing') || text.includes('radiator') ||
    text.includes('mesin') || text.includes('fip') || text.includes('exhaust valve')
  ) {
    return 'Suku Cadang Mesin';
  }

  if (
    text.includes('hose') || text.includes('selang') || text.includes('hydraulic') ||
    text.includes('hidrolik') || text.includes('pipa') || text.includes('pipe') ||
    text.includes('fitting') || text.includes('flange') || text.includes('niple') ||
    text.includes('elbow') || text.includes('tee') || text.includes('clamp') ||
    text.includes('klem') || text.includes('coupling') || text.includes('banjo')
  ) {
    return 'Pipa & Hose Hidrolik';
  }

  if (
    text.includes('pompa') || text.includes('pump') || text.includes('valve') ||
    text.includes('kran') || text.includes('impeller') || text.includes('mechanical seal') ||
    text.includes('strainer') || text.includes('solenoid')
  ) {
    return 'Pompa & Valve';
  }

  if (
    text.includes('kabel') || text.includes('lampu') || text.includes('accu') ||
    text.includes('aki') || text.includes('battery') || text.includes('mcb') ||
    text.includes('kontaktor') || text.includes('relay') || text.includes('trafo') ||
    text.includes('inverter') || text.includes('genset') || text.includes('dynamo') ||
    text.includes('dinamo') || text.includes('saklar') || text.includes('listrik')
  ) {
    return 'Peralatan Listrik';
  }

  if (
    text.includes('plat') || text.includes('besi') || text.includes('baja') ||
    text.includes('siku') || text.includes('hollow') || text.includes('unp') ||
    text.includes('kawat las') || text.includes('welding') || text.includes('elektroda') ||
    text.includes('gerinda') || text.includes('gurinda') || text.includes('amplas') ||
    text.includes('las')
  ) {
    return 'Material Logam & Las';
  }

  if (
    text.includes('cat') || text.includes('paint') || text.includes('primer') ||
    text.includes('thinner') || text.includes('tiner') || text.includes('epoxy') ||
    text.includes('antifouling') || text.includes('zinc anode') || text.includes('anode') ||
    text.includes('kuas') || text.includes('roller cat') || text.includes('dempul') ||
    text.includes('sika')
  ) {
    return 'Cat & Zinc Anode';
  }

  if (
    text.includes('tali') || text.includes('rope') || text.includes('tros') ||
    text.includes('sling') || text.includes('webbing') || text.includes('wire') ||
    text.includes('seling') || text.includes('jangkar') || text.includes('anchor') ||
    text.includes('rantai') || text.includes('shackle') || text.includes('segel') ||
    text.includes('turnbuckle') || text.includes('winch') || text.includes('fender') ||
    text.includes('terpal')
  ) {
    return 'Perlengkapan Deck & Tali';
  }

  if (
    text.includes('safety') || text.includes('pemadam') || text.includes('apar') ||
    text.includes('lifebuoy') || text.includes('lifejacket') || text.includes('pelampung') ||
    text.includes('helm') || text.includes('sepatu safety') || text.includes('sarung tangan') ||
    text.includes('glove') || text.includes('kacamata') || text.includes('ear plug') ||
    text.includes('scba') || text.includes('flare') || text.includes('smoke signal') ||
    text.includes('p3k') || text.includes('coverall') || text.includes('wearpack')
  ) {
    return 'Safety & K3 Maritim';
  }

  if (
    text.includes('navigasi') || text.includes('radio') || text.includes('radar') ||
    text.includes('gps') || text.includes('antena') || text.includes('kompas') ||
    text.includes('ais') || text.includes('sounder') || text.includes('ht') ||
    text.includes('vhf') || text.includes('cctv') || text.includes('printer') ||
    text.includes('tinta') || text.includes('hardisk')
  ) {
    return 'Navigasi & Komunikasi';
  }

  if (
    text.includes('kunci') || text.includes('obeng') || text.includes('tang') ||
    text.includes('palu') || text.includes('dongkrak') || text.includes('chain block') ||
    text.includes('bor') || text.includes('mata bor') || text.includes('gergaji') ||
    text.includes('tracker') || text.includes('manometer') || text.includes('kompresor')
  ) {
    return 'Alat Kerja Bengkel (Tools)';
  }

  if (
    text.includes('oli') || text.includes('pelumas') || text.includes('grease') ||
    text.includes('gemuk') || text.includes('degreaser') || text.includes('coolant') ||
    text.includes('rust remover') || text.includes('wd-40') || text.includes('meditran') ||
    text.includes('salyx') || text.includes('turalik')
  ) {
    return 'Pelumas & Oli';
  }

  if (
    text.includes('ac') || text.includes('kipas') || text.includes('kulkas') ||
    text.includes('kasur') || text.includes('bantal') || text.includes('kompor') ||
    text.includes('gas lpg') || text.includes('lpg') || text.includes('water heater') ||
    text.includes('akomodasi')
  ) {
    return 'Perlengkapan Akomodasi';
  }

  if (
    text.includes('baut') || text.includes('mur') || text.includes('washer') ||
    text.includes('majun') || text.includes('sabun') || text.includes('lem') ||
    text.includes('lakban') || text.includes('gembok') || text.includes('kertas') ||
    text.includes('atk') || text.includes('spidol') || text.includes('stempel') ||
    text.includes('bendera')
  ) {
    return 'Consumables & ATK';
  }

  return 'Umum / Lainnya';
}

export default function PratenderTab({
  procurementItems = [],
  armadaItems = [],
  sisaLayananItems = [],
  onOpenAudit,
  showToast,
}: PratenderTabProps) {
  const { user, isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'pool' | 'packages'>('pool');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedVessel, setSelectedVessel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMultiVesselOnly, setFilterMultiVesselOnly] = useState<boolean>(false);

  // Selection state untuk pembentukan paket tender
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Package modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedPackage, setSelectedPackage] = useState<PratenderPackage | null>(null);

  // Create form state
  const [pkgTitle, setPkgTitle] = useState<string>('');
  const [pkgCategory, setPkgCategory] = useState<string>('Suku Cadang Mesin');
  const [pkgClosingDate, setPkgClosingDate] = useState<string>('');
  const [pkgNotes, setPkgNotes] = useState<string>('');
  const [pkgEstimatedBudget, setPkgEstimatedBudget] = useState<string>('');
  const [isSubmittingPkg, setIsSubmittingPkg] = useState<boolean>(false);

  // Status update modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [statusToUpdate, setStatusToUpdate] = useState<PratenderStatus>('RFQ_SENT');
  const [awardedVendorName, setAwardedVendorName] = useState<string>('');
  const [awardedValueNum, setAwardedValueNum] = useState<string>('');
  const [poGenNumber, setPoGenNumber] = useState<string>('');

  // Packages list state
  const [packages, setPackages] = useState<PratenderPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState<boolean>(false);

  // Fetch created packages from API
  const fetchPackages = async () => {
    setIsLoadingPackages(true);
    try {
      const res = await fetch('/api/pratender');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.packages)) {
          setPackages(data.packages);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat paket pratender:', err);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  // 1. Agregasi Item Kebutuhan Terbuka (Unsupplied / Open Items Pool)
  const openItemsPool = useMemo(() => {
    const map = new Map<string, PratenderOpenItem>();

    // 1a. Proses dari Armada Items
    armadaItems.forEach((it) => {
      const qFpb = Number(it.qtyFPB) || 0;
      const qFstb = Number(it.qtyFSTB) || 0;
      const qRemaining = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

      const isStatusClose =
        it.status?.toUpperCase() === 'CLOSE' ||
        it.status?.toUpperCase().includes('LENGKAP') ||
        it.status?.toUpperCase().includes('SELESAI') ||
        it.status?.toUpperCase().includes('TUNTAS');

      // Filter: Hanya yang masih ada sisa kebutuhan atau belum closed
      const isUnsupplied = (qRemaining > 0 || !isStatusClose) && qFpb > 0;
      if (!isUnsupplied) return;

      const rawName = (it.item || '').trim();
      if (!rawName || rawName === '-' || rawName.length < 3) return;

      // Normalisasi nama barang
      const cleanName = rawName.toUpperCase().replace(/\s+/g, ' ');
      const normKey = cleanName.replace(/[^A-Z0-9]/g, '_');
      const category = classifyMaritimeItem(cleanName, it.kategori || '');
      const satuan = it.satuan || 'UNIT';
      const vessel = (it.armada || 'Armada CPG').trim();

      const reqRef: PratenderRequestRef = {
        fpb: it.fpb,
        armada: vessel,
        qtyRequested: qFpb,
        qtyFulfilled: qFstb,
        qtyRemaining: qRemaining > 0 ? qRemaining : qFpb,
        tglFpb: it.tglFpb || it.tglPo || (it as any).date,
        noPo: it.noPo || (it as any).po,
        status: it.status || 'PROSES',
        entity: it.entity,
        workOrderNo: it.workOrderNo,
      };

      if (!map.has(normKey)) {
        map.set(normKey, {
          id: normKey,
          cleanName,
          category,
          satuan,
          totalQtyRemaining: reqRef.qtyRemaining,
          totalQtyRequested: qFpb,
          vesselCount: 1,
          vessels: [vessel],
          requests: [reqRef],
        });
      } else {
        const existing = map.get(normKey)!;
        existing.totalQtyRemaining += reqRef.qtyRemaining;
        existing.totalQtyRequested += qFpb;
        if (!existing.vessels.includes(vessel)) {
          existing.vessels.push(vessel);
          existing.vesselCount = existing.vessels.length;
        }
        existing.requests.push(reqRef);
      }
    });

    // Periksa status apakah item ini sudah masuk ke salah satu paket pratender yang ada
    const packagedItemIds = new Map<string, { pkgId: string; pkgNumber: string }>();
    packages.forEach((pkg) => {
      if (pkg.status !== 'CANCELLED') {
        pkg.items.forEach((pItem) => {
          packagedItemIds.set(pItem.itemId, { pkgId: pkg.id, pkgNumber: pkg.packageNumber });
        });
      }
    });

    const result = Array.from(map.values()).map((item) => {
      const matchPkg = packagedItemIds.get(item.id);
      return {
        ...item,
        isPackaged: !!matchPkg,
        packageId: matchPkg?.pkgId,
        packageNumber: matchPkg?.pkgNumber,
      };
    });

    // Urutkan: item yang diminta banyak kapal terlebih dahulu, lalu kuantitas terbanyak
    return result.sort((a, b) => b.vesselCount - a.vesselCount || b.totalQtyRemaining - a.totalQtyRemaining);
  }, [armadaItems, packages]);

  // Kategori Maritim Unik dari Item Terbuka
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    openItemsPool.forEach((it) => set.add(it.category));
    return Array.from(set).sort();
  }, [openItemsPool]);

  // Daftar Kapal Peminta Unik
  const availableVessels = useMemo(() => {
    const set = new Set<string>();
    openItemsPool.forEach((it) => it.vessels.forEach((v) => set.add(v)));
    return Array.from(set).sort();
  }, [openItemsPool]);

  // Filter Pool Item Terbuka
  const filteredOpenItems = useMemo(() => {
    return openItemsPool.filter((it) => {
      if (selectedCategory !== 'ALL' && it.category !== selectedCategory) return false;
      if (selectedVessel !== 'ALL' && !it.vessels.includes(selectedVessel)) return false;
      if (filterMultiVesselOnly && it.vesselCount < 2) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = it.cleanName.toLowerCase().includes(q);
        const matchCat = it.category.toLowerCase().includes(q);
        const matchFpb = it.requests.some((r) => r.fpb.toLowerCase().includes(q));
        const matchVessel = it.vessels.some((v) => v.toLowerCase().includes(q));
        if (!matchName && !matchCat && !matchFpb && !matchVessel) return false;
      }
      return true;
    });
  }, [openItemsPool, selectedCategory, selectedVessel, filterMultiVesselOnly, searchQuery]);

  // KPI Metrics Summary
  const kpiMetrics = useMemo(() => {
    const totalItems = openItemsPool.length;
    const totalQty = openItemsPool.reduce((acc, curr) => acc + curr.totalQtyRemaining, 0);
    const multiVesselItems = openItemsPool.filter((it) => it.vesselCount >= 2).length;
    const activePackages = packages.filter((p) => p.status !== 'CANCELLED' && p.status !== 'COMPLETED').length;
    return { totalItems, totalQty, multiVesselItems, activePackages };
  }, [openItemsPool, packages]);

  // Toggle selection item
  const handleToggleSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedItemIds.size === filteredOpenItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredOpenItems.map((i) => i.id)));
    }
  };

  // Buka Modal Buat Paket Pratender dari Item Terpilih
  const handleOpenCreateModal = () => {
    if (selectedItemIds.size === 0) {
      showToast?.('Centang setidaknya 1 material terbuka untuk membentuk paket pratender.', 'warning');
      return;
    }

    const selectedItems = openItemsPool.filter((i) => selectedItemIds.has(i.id));
    // Tentukan kategori dominan
    const catFreq: Record<string, number> = {};
    selectedItems.forEach((i) => {
      catFreq[i.category] = (catFreq[i.category] || 0) + 1;
    });
    const domCat = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Suku Cadang Mesin';

    setPkgCategory(domCat);
    const dateStr = new Date().toISOString().slice(2, 4); // "26"
    const nextSeq = String(packages.length + 1).padStart(4, '0');
    setPkgTitle(`Paket Pengadaan ${domCat} Armada Q4 20${dateStr}`);
    setPkgNotes('Spesifikasi asli (OEM) bergaransi resmi, sertifikat asal barang (COO) terlampir.');
    setPkgClosingDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)); // Default 7 hari ke depan
    setPkgEstimatedBudget('');

    setIsCreateModalOpen(true);
  };

  // Submit Simpan Paket Pratender Baru
  const handleConfirmCreatePackage = async () => {
    if (!pkgTitle.trim()) {
      showToast?.('Judul paket tender wajib diisi.', 'warning');
      return;
    }

    const selectedItems = openItemsPool.filter((i) => selectedItemIds.has(i.id));
    if (selectedItems.length === 0) return;

    setIsSubmittingPkg(true);
    try {
      const dateStr = new Date().toISOString().slice(2, 4);
      const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
      const packageNumber = `CPG-TDR-${dateStr}-${randomSeq}`;

      const packageItems: PratenderPackageItem[] = selectedItems.map((item) => ({
        itemId: item.id,
        itemName: item.cleanName,
        category: item.category,
        satuan: item.satuan,
        totalQty: item.totalQtyRemaining,
        vessels: item.vessels,
        requestFpbs: item.requests.map((r) => r.fpb),
      }));

      const newPkg: PratenderPackage = {
        id: `pkg-${Date.now()}`,
        packageNumber,
        title: pkgTitle.trim(),
        category: pkgCategory,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'Staf Purchasing',
        targetClosingDate: pkgClosingDate || undefined,
        description: pkgNotes.trim() || undefined,
        items: packageItems,
        totalEstimatedBudget: pkgEstimatedBudget ? Number(pkgEstimatedBudget) : undefined,
      };

      const res = await fetch('/api/pratender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_PACKAGE',
          package: newPkg,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan paket pratender.');
      }

      showToast?.(`Paket tender ${packageNumber} berhasil dibuat dengan ${packageItems.length} item material!`, 'success');

      setPackages((prev) => [newPkg, ...prev]);
      setSelectedItemIds(new Set());
      setIsCreateModalOpen(false);
      setActiveSubTab('packages');
    } catch (err) {
      showToast?.((err as Error).message || 'Terjadi kesalahan.', 'error');
    } finally {
      setIsSubmittingPkg(false);
    }
  };

  // Update Status Paket Pratender (RFQ / Evaluasi / Pemenang)
  const handleUpdatePackageStatus = async () => {
    if (!selectedPackage) return;

    try {
      const res = await fetch('/api/pratender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          packageId: selectedPackage.id,
          status: statusToUpdate,
          awardedVendor: awardedVendorName.trim() || undefined,
          awardedValue: awardedValueNum ? Number(awardedValueNum) : undefined,
          poNumberGenerated: poGenNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memperbarui status paket.');
      }

      showToast?.(`Status paket ${selectedPackage.packageNumber} diperbarui menjadi ${statusToUpdate}.`, 'success');

      setPackages((prev) =>
        prev.map((p) => (p.id === selectedPackage.id ? { ...p, ...data.package } : p))
      );
      setSelectedPackage(data.package);
      setIsStatusModalOpen(false);
    } catch (err) {
      showToast?.((err as Error).message, 'error');
    }
  };

  // Hapus paket (Admin Only)
  const handleDeletePackage = async (packageId: string) => {
    if (!isAdmin) {
      showToast?.('Hanya administrator yang berwenang menghapus paket tender.', 'warning');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin menghapus paket pratender ini?')) return;

    try {
      const res = await fetch(`/api/pratender?id=${packageId}&role=${user?.role || ''}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menghapus paket.');
      }

      showToast?.('Paket tender berhasil dihapus.', 'info');
      setPackages((prev) => prev.filter((p) => p.id !== packageId));
      if (selectedPackage?.id === packageId) {
        setIsDetailModalOpen(false);
      }
    } catch (err) {
      showToast?.((err as Error).message, 'error');
    }
  };

  // Salin teks penawaran RFQ ke WhatsApp Vendor
  const handleCopyWaRfq = (pkg: PratenderPackage) => {
    const lines = [
      `*Yth. Mitra Vendor Rekanan PT CPG / Marine Group*`,
      `Berikut kami sampaikan Permintaan Penawaran Harga (*Request for Quotation / RFQ*):`,
      ``,
      `📋 *No. Paket Tender:* ${pkg.packageNumber}`,
      `📌 *Judul Pengadaan:* ${pkg.title}`,
      `🏷️ *Kategori Kebutuhan:* ${pkg.category}`,
      `📅 *Batas Akhir Penawaran:* ${pkg.targetClosingDate || '3 Hari Kerja'}`,
      ``,
      `*Daftar Rincian Material & Kuantitas Gabungan:*`,
      ...pkg.items.map(
        (it, idx) =>
          `${idx + 1}. *${it.itemName}* — Total: *${it.totalQty} ${it.satuan}* (Untuk: ${it.vessels.join(', ')})`
      ),
      ``,
      pkg.description ? `📝 *Syarat / Catatan Khusus:*\n${pkg.description}\n` : '',
      `Mohon dapat mengirimkan penawaran harga terbaik, ketersediaan stok, dan estimasi waktu pengiriman (lead time).`,
      `Terima kasih.`,
      `_Procurement & Sourcing Division CPG_`,
    ];

    const message = lines.filter(Boolean).join('\n');
    navigator.clipboard.writeText(message);
    showToast?.('Format penawaran RFQ berhasil disalin ke clipboard! Siap dikirim via WhatsApp.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Layers className="size-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                Pratender Material &amp; Konsolidasi Pengadaan
              </h2>
              <p className="text-xs text-muted-foreground">
                Agregasi kebutuhan material terbuka (open &amp; unsupplied) lintas armada kapal untuk pembentukan paket tender bersama (bulk purchasing).
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl self-start md:self-auto border border-border">
          <button
            type="button"
            onClick={() => setActiveSubTab('pool')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'pool'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="size-3.5 text-indigo-500" />
            <span>Pool Material Terbuka</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-mono">
              {openItemsPool.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('packages')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'packages'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="size-3.5 text-purple-500" />
            <span>Daftar Paket Tender</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/10 text-purple-600 font-mono">
              {packages.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Material Belum Suplai</span>
            <Package className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {kpiMetrics.totalItems.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-muted-foreground">Item unik membutuhkan pemenuhan</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Akumulasi Kuantitas</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {kpiMetrics.totalQty.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-muted-foreground">Total unit/meter/drum gabungan</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Kebutuhan Multi-Kapal</span>
            <Ship className="size-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono text-sky-600 dark:text-sky-400">
            {kpiMetrics.multiVesselItems.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-muted-foreground">Diminta oleh &ge; 2 kapal berbeda (Potensi Grosir)</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Paket Pratender Aktif</span>
            <Award className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono text-purple-600 dark:text-purple-400">
            {kpiMetrics.activePackages}
          </div>
          <p className="text-[11px] text-muted-foreground">Dalam proses RFQ &amp; evaluasi vendor</p>
        </div>
      </div>

      {/* VIEW 1: POOL MATERIAL TERBUKA (KONSOLIDASI ITEM UNTUK TENDER) */}
      {activeSubTab === 'pool' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-muted/40 border-b border-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama material, part number, FPB..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-background text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Kategori */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="ALL">Semua Kategori Maritim</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Filter Kapal */}
                <select
                  value={selectedVessel}
                  onChange={(e) => setSelectedVessel(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="ALL">Semua Kapal Peminta</option>
                  {availableVessels.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                {/* Checkbox Multi-Kapal */}
                <label className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-border bg-background text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterMultiVesselOnly}
                    onChange={(e) => setFilterMultiVesselOnly(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Kebutuhan Multi-Kapal Saja</span>
                </label>
              </div>
            </div>

            {/* Selection Status Banner */}
            {selectedItemIds.size > 0 && (
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 font-medium">
                  <CheckSquare className="size-4" />
                  <span>
                    <strong>{selectedItemIds.size} material</strong> terpilih untuk tender gabungan
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(new Set())}
                    className="text-xs text-muted-foreground hover:underline cursor-pointer"
                  >
                    Batal Pilih
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Bentuk Paket Pratender</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabel Pool Material */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="cursor-pointer"
                      title="Pilih Semua"
                    >
                      {selectedItemIds.size === filteredOpenItems.length && filteredOpenItems.length > 0 ? (
                        <CheckSquare className="size-4 text-purple-600" />
                      ) : (
                        <Square className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Rincian Material / Spesifikasi Suku Cadang</th>
                  <th className="py-2.5 px-3">Kategori Maritim</th>
                  <th className="py-2.5 px-3 text-right">Kuantitas Terbuka</th>
                  <th className="py-2.5 px-3">Kapal Peminta (Armada)</th>
                  <th className="py-2.5 px-3">Status Paket</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOpenItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Sparkles className="size-8 mx-auto mb-2 opacity-30 text-emerald-500" />
                      <p className="text-sm font-semibold text-foreground">Tidak Ada Kebutuhan Terbuka yang Cocok</p>
                      <p className="text-xs mt-1">
                        Seluruh material telah tersuplai atau tidak memenuhi filter pencarian saat ini.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOpenItems.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/40 transition ${
                          isSelected ? 'bg-purple-500/[0.06]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-4 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Square className="size-4 text-muted-foreground" />
                            )}
                          </button>
                        </td>

                        {/* Nama & Spesifikasi Barang */}
                        <td className="py-3 px-3 max-w-xs sm:max-w-md">
                          <div className="font-semibold text-foreground">{item.cleanName}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Dari {item.requests.length} pengajuan FPB: {item.requests.slice(0, 3).map((r) => r.fpb).join(', ')}
                            {item.requests.length > 3 ? ` (+${item.requests.length - 3})` : ''}
                          </div>
                        </td>

                        {/* Kategori Maritim */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            {item.category}
                          </span>
                        </td>

                        {/* Kuantitas Akumulasi */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="font-black text-foreground font-mono text-xs sm:text-sm">
                            {item.totalQtyRemaining.toLocaleString('id-ID')}
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase">{item.satuan}</span>
                        </td>

                        {/* Kapal Peminta */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.vessels.map((v) => (
                              <span
                                key={v}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Status Paket */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.isPackaged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              <span>{item.packageNumber}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Belum Masuk Paket
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.requests[0]?.fpb && onOpenAudit) {
                                onOpenAudit(item.requests[0].fpb);
                              }
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition cursor-pointer"
                            title="Audit Jejak FPB Dokumen"
                          >
                            <ExternalLink className="size-3.5" />
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
      )}

      {/* VIEW 2: DAFTAR PAKET PRATENDER YANG SUDAH DIBUAT */}
      {activeSubTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Daftar Paket Pengadaan Terbuka ({packages.length})
            </h3>
            <button
              type="button"
              onClick={fetchPackages}
              disabled={isLoadingPackages}
              className="px-2.5 py-1 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`size-3 ${isLoadingPackages ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {packages.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
              <Award className="size-10 mx-auto mb-2 opacity-30 text-purple-500" />
              <p className="text-sm font-semibold text-foreground">Belum Ada Paket Pratender</p>
              <p className="text-xs mt-1">
                Buka tab <strong>&quot;Pool Material Terbuka&quot;</strong>, centang item-item kebutuhan sejenis, dan klik &quot;Bentuk Paket Pratender Baru&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map((pkg) => {
                const getStatusBadge = (status: PratenderStatus) => {
                  switch (status) {
                    case 'DRAFT':
                      return { text: 'Draft Tender', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300' };
                    case 'RFQ_SENT':
                      return { text: 'RFQ Terbit (Tawaran Dibuka)', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
                    case 'EVALUATION':
                      return { text: 'Evaluasi Penawaran', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
                    case 'AWARDED':
                      return { text: 'Pemenang Ditetapkan', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
                    case 'COMPLETED':
                      return { text: 'Selesai (Sudah PO)', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
                    default:
                      return { text: status, color: 'bg-muted text-muted-foreground border-border' };
                  }
                };

                const badge = getStatusBadge(pkg.status);

                return (
                  <div
                    key={pkg.id}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-purple-500/40 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          {pkg.packageNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                          {badge.text}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                        {pkg.title}
                      </h4>

                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShoppingBag className="size-3 text-purple-500" />
                        <span>Kategori: <strong>{pkg.category}</strong></span>
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/60">
                        <span>{pkg.items.length} jenis material</span>
                        <span>Dibuat oleh {pkg.createdBy}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyWaRfq(pkg)}
                        className="p-1.5 rounded-lg border border-border bg-background hover:bg-emerald-500/10 hover:text-emerald-600 text-muted-foreground transition cursor-pointer"
                        title="Salin Pesan RFQ WhatsApp"
                      >
                        <Share2 className="size-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition cursor-pointer"
                            title="Hapus Paket"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setIsDetailModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="size-3" />
                          <span>Detail RFQ</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: BENTUK PAKET PRATENDER BARU */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-muted/50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 border border-purple-500/20">
                  <Award className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Bentuk Paket Pratender Baru
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Konsolidasi {selectedItemIds.size} material terbuka untuk pengadaan bersama
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Judul Paket Tender <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={pkgTitle}
                  onChange={(e) => setPkgTitle(e.target.value)}
                  placeholder="Contoh: Paket Pengadaan Cat Antifouling Q4 2026"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Kategori Utama</label>
                  <select
                    value={pkgCategory}
                    onChange={(e) => setPkgCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Batas Penawaran (RFQ Deadline)</label>
                  <input
                    type="date"
                    value={pkgClosingDate}
                    onChange={(e) => setPkgClosingDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Estimasi Total Anggaran / HPS (Opsional)</label>
                <input
                  type="number"
                  value={pkgEstimatedBudget}
                  onChange={(e) => setPkgEstimatedBudget(e.target.value)}
                  placeholder="Contoh: 150000000"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Spesifikasi &amp; Klausul Syarat Vendor</label>
                <textarea
                  value={pkgNotes}
                  onChange={(e) => setPkgNotes(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Rincian Item Terpilih */}
              <div>
                <label className="font-semibold text-foreground block mb-1.5">
                  Daftar Material Gabungan ({selectedItemIds.size} Item)
                </label>
                <div className="border border-border rounded-xl divide-y divide-border/60 max-h-44 overflow-y-auto">
                  {openItemsPool
                    .filter((i) => selectedItemIds.has(i.id))
                    .map((item, idx) => (
                      <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-foreground block truncate">
                            {idx + 1}. {item.cleanName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Kapal: {item.vessels.join(', ')}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-foreground">
                            {item.totalQtyRemaining} {item.satuan}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreatePackage}
                disabled={isSubmittingPkg || !pkgTitle.trim()}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Award className="size-4" />
                <span>{isSubmittingPkg ? 'Menyimpan Paket...' : 'Terbitkan Paket Pratender'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL PAKET & UPDATE STATUS TENDER */}
      {isDetailModalOpen && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-muted/50 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {selectedPackage.packageNumber}
                </span>
                <h3 className="text-base font-bold text-foreground mt-1">
                  {selectedPackage.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-muted/40 border border-border text-[11px]">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Status Tender</span>
                  <strong className="text-purple-600">{selectedPackage.status}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Kategori</span>
                  <strong>{selectedPackage.category}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Target Deadline</span>
                  <strong>{selectedPackage.targetClosingDate || '-'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Estimasi Nilai HPS</span>
                  <strong>
                    {selectedPackage.totalEstimatedBudget
                      ? `Rp ${selectedPackage.totalEstimatedBudget.toLocaleString('id-ID')}`
                      : '-'}
                  </strong>
                </div>
              </div>

              {selectedPackage.awardedVendor && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold block">Pemenang Tender Ditetapkan:</span>
                  <div>Vendor: <strong>{selectedPackage.awardedVendor}</strong></div>
                  {selectedPackage.poNumberGenerated && (
                    <div>No. PO Terbit: <strong>{selectedPackage.poNumberGenerated}</strong></div>
                  )}
                </div>
              )}

              {/* Rincian Material */}
              <div>
                <h4 className="font-bold text-foreground mb-1.5">
                  Daftar Kebutuhan Material Dalam Paket ({selectedPackage.items.length} Item)
                </h4>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Nama Material &amp; Spesifikasi</th>
                        <th className="py-2 px-3 text-right">Total Kuantitas</th>
                        <th className="py-2 px-3">Kapal Peminta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedPackage.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-foreground">{it.itemName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {it.totalQty} {it.satuan}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                            {it.vessels.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/40 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyWaRfq(selectedPackage)}
                className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs inline-flex items-center gap-1.5 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <Share2 className="size-3.5" />
                <span>Salin RFQ WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusToUpdate(selectedPackage.status);
                    setAwardedVendorName(selectedPackage.awardedVendor || '');
                    setAwardedValueNum(selectedPackage.awardedValue ? String(selectedPackage.awardedValue) : '');
                    setPoGenNumber(selectedPackage.poNumberGenerated || '');
                    setIsStatusModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Award className="size-3.5" />
                  <span>Update Status / Pemenang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE STATUS TENDER & PEMENANG VENDOR */}
      {isStatusModalOpen && selectedPackage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <h4 className="text-sm font-bold text-foreground">
              Perbarui Status Tender: {selectedPackage.packageNumber}
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Tahapan Status Tender</label>
                <select
                  value={statusToUpdate}
                  onChange={(e) => setStatusToUpdate(e.target.value as PratenderStatus)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="DRAFT">Draft Tender</option>
                  <option value="RFQ_SENT">RFQ Terbit (Minta Penawaran Vendor)</option>
                  <option value="EVALUATION">Evaluasi Penawaran Vendor</option>
                  <option value="AWARDED">Pemenang Ditetapkan</option>
                  <option value="COMPLETED">Selesai (Sudah Terbit PO)</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </select>
              </div>

              {(statusToUpdate === 'AWARDED' || statusToUpdate === 'COMPLETED') && (
                <>
                  <div>
                    <label className="font-semibold block mb-1">Nama Vendor Pemenang</label>
                    <input
                      type="text"
                      value={awardedVendorName}
                      onChange={(e) => setAwardedVendorName(e.target.value)}
                      placeholder="Contoh: PT Samudera Pelumas Utama"
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Nilai PO / Kesepakatan (Rp)</label>
                    <input
                      type="number"
                      value={awardedValueNum}
                      onChange={(e) => setAwardedValueNum(e.target.value)}
                      placeholder="Contoh: 142000000"
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Nomor PO Terbit</label>
                    <input
                      type="text"
                      value={poGenNumber}
                      onChange={(e) => setPoGenNumber(e.target.value)}
                      placeholder="Contoh: CPL-PO-26-05492"
                      className="w-full h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdatePackageStatus}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
