'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Package,
  Layers,
  Search,
  Plus,
  RefreshCw,
  Printer,
  FileText,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Send,
  Building,
  User,
  Filter,
  Trash2,
  ExternalLink,
  ChevronRight,
  Calendar,
  Sparkles,
} from 'lucide-react';

import {
  CargoShipment,
  CargoServiceType,
  CargoStatus,
  CargoSummaryMetrics,
  CargoFilterState,
} from '@/types/kargo';
import { INITIAL_CARGO_SHIPMENTS } from '@/data/initialCargoData';
import OrderEntryModal from './kargo/OrderEntryModal';
import KargoWorkflowModal from './kargo/KargoWorkflowModal';
import ShippingLabelModal from './kargo/ShippingLabelModal';

interface KargoLogistikTabProps {
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const STORAGE_KEY = 'cpg_cargo_shipments_v1';

export default function KargoLogistikTab({ showToast }: KargoLogistikTabProps) {
  // Navigation sub-tab: 'dashboard' | 'orders' | 'tracking'
  const [subTab, setSubTab] = useState<'dashboard' | 'orders' | 'tracking'>('dashboard');

  // Main shipments state
  const [shipments, setShipments] = useState<CargoShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [filter, setFilter] = useState<CargoFilterState>({
    searchQuery: '',
    status: 'ALL',
    layanan: 'ALL',
    kotaTujuan: 'ALL',
  });

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [workflowShipment, setWorkflowShipment] = useState<CargoShipment | null>(null);
  const [labelShipment, setLabelShipment] = useState<CargoShipment | null>(null);

  // Public Tracking Portal state
  const [trackingSearchResi, setTrackingSearchResi] = useState('');
  const [trackedShipment, setTrackedShipment] = useState<CargoShipment | null>(null);
  const [hasSearchedTracking, setHasSearchedTracking] = useState(false);

  // 1. Initial Load: check localStorage or fetch /api/kargo
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setShipments(parsed);
            setIsLoading(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal membaca kargo dari localStorage:', e);
    }

    // Fallback: fetch from API or INITIAL_CARGO_SHIPMENTS
    fetch('/api/kargo')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setShipments(data.data);
          saveToLocalStorage(data.data);
        } else {
          setShipments(INITIAL_CARGO_SHIPMENTS);
          saveToLocalStorage(INITIAL_CARGO_SHIPMENTS);
        }
      })
      .catch(() => {
        setShipments(INITIAL_CARGO_SHIPMENTS);
        saveToLocalStorage(INITIAL_CARGO_SHIPMENTS);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveToLocalStorage = (data: CargoShipment[]) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Gagal menyimpan kargo ke localStorage:', e);
    }
  };

  // 2. Metrics calculation for Manager View
  const metrics: CargoSummaryMetrics = useMemo(() => {
    const totalPengiriman = shipments.length;
    let aktif = 0;
    let dalamPerjalanan = 0;
    let selesai = 0;
    let draft = 0;
    let totalPendapatan = 0;
    let totalBiaya = 0;

    shipments.forEach((s) => {
      totalPendapatan += s.ongkir || 0;
      totalBiaya += s.biayaOperasional || 0;

      if (s.status === 'Selesai') selesai++;
      else if (s.status === 'Dalam Perjalanan') dalamPerjalanan++;
      else if (s.status === 'Draft') draft++;

      if (s.status !== 'Selesai') aktif++;
    });

    const totalLabaKotor = totalPendapatan - totalBiaya;
    const onTimeRate = totalPengiriman > 0 ? Math.round((selesai / totalPengiriman) * 100) : 100;

    return {
      totalPengiriman,
      aktif,
      dalamPerjalanan,
      selesai,
      draft,
      totalPendapatan,
      totalBiaya,
      totalLabaKotor,
      onTimeRate: Math.max(88, onTimeRate), // standard corporate SLA floor demo
    };
  }, [shipments]);

  // Distinct cities list for filter
  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    shipments.forEach((s) => {
      if (s.penerima?.kotaTujuan) cities.add(s.penerima.kotaTujuan);
    });
    return Array.from(cities).sort();
  }, [shipments]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (filter.status !== 'ALL' && s.status !== filter.status) return false;
      if (filter.layanan !== 'ALL' && s.layanan !== filter.layanan) return false;
      if (filter.kotaTujuan !== 'ALL' && s.penerima?.kotaTujuan !== filter.kotaTujuan) return false;

      if (filter.searchQuery.trim()) {
        const q = filter.searchQuery.toLowerCase().trim();
        const resi = (s.resi || '').toLowerCase();
        const sender = (s.pengirim?.nama || '').toLowerCase();
        const receiver = (s.penerima?.nama || '').toLowerCase();
        const kota = (s.penerima?.kotaTujuan || '').toLowerCase();
        const barang = (s.barang?.jenis || '').toLowerCase();
        const pic = (s.alurPic?.tahap2?.picPurchasing || '').toLowerCase();

        return (
          resi.includes(q) ||
          sender.includes(q) ||
          receiver.includes(q) ||
          kota.includes(q) ||
          barang.includes(q) ||
          pic.includes(q)
        );
      }
      return true;
    });
  }, [shipments, filter]);

  // Handlers
  const handleCreateShipment = (newShipment: CargoShipment) => {
    const updated = [newShipment, ...shipments];
    setShipments(updated);
    saveToLocalStorage(updated);

    // Call API asynchronous (non-blocking)
    fetch('/api/kargo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShipment),
    }).catch(() => {});

    showToast?.(`Resi baru ${newShipment.resi} berhasil dibuat!`, 'success');
  };

  const handleUpdateShipment = (updatedShipment: CargoShipment) => {
    const updated = shipments.map((s) => (s.id === updatedShipment.id ? updatedShipment : s));
    setShipments(updated);
    saveToLocalStorage(updated);

    // If currently tracked, update tracked view too
    if (trackedShipment?.id === updatedShipment.id) {
      setTrackedShipment(updatedShipment);
    }

    // Call API asynchronous
    fetch('/api/kargo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedShipment),
    }).catch(() => {});

    showToast?.(`Data alur kerja ${updatedShipment.resi} berhasil diperbarui!`, 'success');
  };

  const handleDeleteShipment = (id: string, resi: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus arsip pengiriman ${resi}?`)) {
      const updated = shipments.filter((s) => s.id !== id);
      setShipments(updated);
      saveToLocalStorage(updated);

      if (trackedShipment?.id === id) {
        setTrackedShipment(null);
      }

      fetch(`/api/kargo?id=${id}`, { method: 'DELETE' }).catch(() => {});
      showToast?.(`Pengiriman ${resi} telah dihapus.`, 'info');
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Muat ulang data contoh kargo logistik awal?')) {
      setShipments(INITIAL_CARGO_SHIPMENTS);
      saveToLocalStorage(INITIAL_CARGO_SHIPMENTS);
      showToast?.('Data kargo telah di-reset ke default.', 'info');
    }
  };

  // Tracking Search Execution
  const executeTrackingSearch = (resiToSearch?: string) => {
    const target = (resiToSearch || trackingSearchResi).trim().toUpperCase();
    if (!target) {
      showToast?.('Harap masukkan nomor resi pengiriman.', 'warning');
      return;
    }
    setHasSearchedTracking(true);
    const found = shipments.find((s) => s.resi.toUpperCase() === target);
    setTrackedShipment(found || null);
    if (!found) {
      showToast?.(`Resi ${target} tidak ditemukan dalam database.`, 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: CargoStatus) => {
    switch (status) {
      case 'Selesai':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Tiba di Tujuan':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      case 'Dalam Perjalanan':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      case 'Diproses':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getLayananBadge = (layanan: CargoServiceType) => {
    switch (layanan) {
      case 'Express':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'Kargo Laut':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      case 'Kargo Darat':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Sub-Header Navigation Banner */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-linear-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-md shrink-0">
            <Truck className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Sistem Operasional Kargo & Angkutan Barang
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Hub CPG
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kelola pesanan kargo harian, sinkronisasi penugasan PIC 6 fase operasional, dan pelacakan resi publik real-time.
            </p>
          </div>
        </div>

        {/* Sub-Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-lg border border-border shrink-0 self-start md:self-center overflow-x-auto max-w-full">
          <button
            onClick={() => setSubTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition touch-manipulation cursor-pointer ${
              subTab === 'dashboard'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="size-3.5 text-sky-500" />
            <span>Dashboard Manajer</span>
          </button>

          <button
            onClick={() => setSubTab('orders')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition touch-manipulation cursor-pointer ${
              subTab === 'orders'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="size-3.5 text-teal-500" />
            <span>Manajemen Resi</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground font-mono">
              {shipments.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('tracking')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition touch-manipulation cursor-pointer ${
              subTab === 'tracking'
                ? 'bg-card text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Search className="size-3.5 text-emerald-500" />
            <span>Lacak Resi (Publik)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: DASHBOARD UTAMA (MANAGER VIEW) */}
      {/* ========================================================================= */}
      {subTab === 'dashboard' && (
        <div className="space-y-5">
          {/* Top 4 KPI Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Pengiriman Aktif */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Pengiriman Aktif</span>
                <Truck className="size-4 text-sky-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {metrics.aktif}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  dari {metrics.totalPengiriman} total
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                <Clock className="size-3.5" />
                <span>Monitoring live pergerakan armada</span>
              </div>
            </div>

            {/* Card 2: Dalam Perjalanan */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Dalam Perjalanan (In-Transit)</span>
                <MapPin className="size-4 text-blue-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {metrics.dalamPerjalanan}
                </span>
                <span className="text-[11px] text-muted-foreground">kargo armada</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                <ArrowRight className="size-3.5" />
                <span>Antarpulau & door-to-door</span>
              </div>
            </div>

            {/* Card 3: Paket Selesai & Ketepatan (SLA) */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Selesai / Terkirim</span>
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {metrics.selesai}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {metrics.onTimeRate}% SLA
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="size-3.5" />
                <span>TTB & Serah Terima Lengkap</span>
              </div>
            </div>

            {/* Card 4: Omset & Margin */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Pendapatan (Omset)</span>
                <DollarSign className="size-4 text-teal-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-foreground">
                  {formatCurrency(metrics.totalPendapatan)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  Laba Kotor: <strong className="text-teal-600 dark:text-teal-400">{formatCurrency(metrics.totalLabaKotor)}</strong>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  ({metrics.totalPendapatan > 0 ? Math.round((metrics.totalLabaKotor / metrics.totalPendapatan) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Status Breakdown & Quick Action Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status Breakdown Progress Bars */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Distribusi Status Operasional Kargo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Rekapitulasi tahapan paket dari pemesanan awal hingga selesai serah terima.
                  </p>
                </div>
                <button
                  onClick={() => setSubTab('orders')}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Kelola Semua Resi</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Dalam Perjalanan (In-Transit)',
                    count: shipments.filter((s) => s.status === 'Dalam Perjalanan').length,
                    color: 'bg-sky-500',
                  },
                  {
                    label: 'Diproses di Gudang Hub / Transit',
                    count: shipments.filter((s) => s.status === 'Diproses').length,
                    color: 'bg-amber-500',
                  },
                  {
                    label: 'Tiba di Kota Tujuan',
                    count: shipments.filter((s) => s.status === 'Tiba di Tujuan').length,
                    color: 'bg-teal-500',
                  },
                  {
                    label: 'Selesai & Diterima Penerima',
                    count: shipments.filter((s) => s.status === 'Selesai').length,
                    color: 'bg-emerald-500',
                  },
                  {
                    label: 'Draft / Menunggu Booking Armada',
                    count: shipments.filter((s) => s.status === 'Draft').length,
                    color: 'bg-slate-400',
                  },
                ].map((item, idx) => {
                  const pct =
                    metrics.totalPengiriman > 0
                      ? Math.round((item.count / metrics.totalPengiriman) * 100)
                      : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="font-mono text-muted-foreground">
                          {item.count} paket ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Synchronized PIC rule banner */}
              <div className="mt-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs flex items-start gap-2.5">
                <Sparkles className="size-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="text-foreground">
                  <strong className="text-sky-700 dark:text-sky-400">Aturan Operasional Terintegrasi:</strong> Bagian <strong>Fase 2 (Purchasing/Booking)</strong> dan <strong>Fase 3 (FSTB)</strong> secara otomatis dikerjakan oleh PIC yang sama untuk memastikan keselarasan penerbitan dokumen dan ruang muatan kargo.
                </div>
              </div>
            </div>

            {/* Layanan & Hub Summary */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Distribusi Layanan Pengiriman</h3>
                <p className="text-xs text-muted-foreground">
                  Porsi moda transportasi kargo CPG
                </p>

                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  {(['Express', 'Reguler', 'Kargo Darat', 'Kargo Laut'] as CargoServiceType[]).map(
                    (lay) => {
                      const count = shipments.filter((s) => s.layanan === lay).length;
                      return (
                        <div
                          key={lay}
                          className="p-3 rounded-lg border border-border bg-muted/40 flex flex-col justify-between"
                        >
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {lay}
                          </span>
                          <span className="text-lg font-bold font-mono text-foreground mt-1">
                            {count}{' '}
                            <span className="text-[10px] font-normal text-muted-foreground">resi</span>
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <button
                  onClick={() => setIsOrderModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Input Order Resi Baru</span>
                </button>
                <button
                  onClick={() => setSubTab('tracking')}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer"
                >
                  <Search className="size-3.5 text-muted-foreground" />
                  <span>Buka Portal Lacak Resi Pelanggan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Recent Shipments Table (Manager Overview) */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Aktivitas Pengiriman Kargo Terkini
                </h3>
                <p className="text-xs text-muted-foreground">
                  Daftar transaksi resi aktif dengan status alur 6 fase operasional.
                </p>
              </div>
              <button
                onClick={() => setSubTab('orders')}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat Seluruh Data</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">No. Resi & Tgl</th>
                    <th className="py-2.5 px-4">Layanan</th>
                    <th className="py-2.5 px-4">Rute Pengiriman</th>
                    <th className="py-2.5 px-4">Muatan & Berat</th>
                    <th className="py-2.5 px-4 text-center">Alur 6 Fase</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shipments.slice(0, 5).map((s) => (
                    <tr key={s.id} className="hover:bg-muted/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-foreground">{s.resi}</div>
                        <div className="text-[10px] text-muted-foreground">{s.tglOrder}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getLayananBadge(
                            s.layanan
                          )}`}
                        >
                          {s.layanan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {s.pengirim.kota} &rarr;{' '}
                          <span className="text-sky-600 dark:text-sky-400 font-bold">
                            {s.penerima.kotaTujuan}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          Penerima: {s.penerima.nama}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground truncate max-w-[180px]">
                          {s.barang.jenis}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {s.barang.beratKg} kg &bull; {s.barang.koli} koli
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {/* Mini 6-Phase Bulbs */}
                        <div className="flex items-center justify-center gap-1.5">
                          {[
                            { label: 'FPB', done: s.alurPic.tahap1.selesai, color: 'bg-blue-500' },
                            {
                              label: 'PCH',
                              done: s.alurPic.tahap2.selesai,
                              color: 'bg-indigo-500',
                            },
                            {
                              label: 'FSTB',
                              done: s.alurPic.tahap3.selesai,
                              color: 'bg-amber-500',
                            },
                            {
                              label: 'TTB',
                              done: s.alurPic.tahap4.selesai,
                              color: 'bg-purple-500',
                            },
                            {
                              label: 'LAP',
                              done: s.alurPic.tahap5.selesai,
                              color: 'bg-cyan-500',
                            },
                            {
                              label: 'ADM',
                              done: s.alurPic.tahap6.selesai,
                              color: 'bg-emerald-500',
                            },
                          ].map((b, idx) => (
                            <span
                              key={idx}
                              title={`Fase ${idx + 1} (${b.label}): ${b.done ? 'Selesai' : 'Belum Selesai'}`}
                              className={`size-2.5 rounded-full transition-all ${
                                b.done ? `${b.color} shadow-xs` : 'bg-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-[9px] text-center text-muted-foreground font-mono mt-1">
                          PIC: {s.alurPic.tahap2.picPurchasing || 'Belum Ditugaskan'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                            s.status
                          )}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setWorkflowShipment(s)}
                            className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground transition cursor-pointer"
                            title="Buka Alur Penugasan PIC 6 Fase"
                          >
                            Alur 6 Fase
                          </button>
                          <button
                            onClick={() => setLabelShipment(s)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                            title="Cetak Surat Jalan & Label"
                          >
                            <Printer className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-TAB: INPUT & MANAJEMEN RESI / PENGIRIMAN */}
      {/* ========================================================================= */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOrderModalOpen(true)}
                  className="flex items-center gap-2 py-2 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Input Order Baru (+ Resi)</span>
                </button>

                <button
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Reset contoh dataset"
                >
                  <RefreshCw className="size-3.5" />
                  <span className="hidden sm:inline">Reset Default</span>
                </button>
              </div>

              {/* Quick Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari resi, nama, kota, pic..."
                  value={filter.searchQuery}
                  onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
              <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                <Filter className="size-3" /> Filter Status:
              </span>

              {(['ALL', 'Draft', 'Diproses', 'Dalam Perjalanan', 'Tiba di Tujuan', 'Selesai'] as (
                | 'ALL'
                | CargoStatus
              )[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilter({ ...filter, status: st })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    filter.status === st
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {st === 'ALL' ? 'Semua Status' : st}
                </button>
              ))}

              <div className="h-4 w-px bg-border mx-1" />

              <span className="text-muted-foreground text-[11px] font-medium">Layanan:</span>
              {(['ALL', 'Express', 'Reguler', 'Kargo Darat', 'Kargo Laut'] as (
                | 'ALL'
                | CargoServiceType
              )[]).map((lay) => (
                <button
                  key={lay}
                  onClick={() => setFilter({ ...filter, layanan: lay })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    filter.layanan === lay
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {lay === 'ALL' ? 'Semua' : lay}
                </button>
              ))}

              {cityOptions.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  <span className="text-muted-foreground text-[11px] font-medium">Kota:</span>
                  <select
                    value={filter.kotaTujuan}
                    onChange={(e) => setFilter({ ...filter, kotaTujuan: e.target.value })}
                    className="px-2 py-0.5 rounded border border-border bg-card text-[11px] text-foreground focus:outline-none"
                  >
                    <option value="ALL">Semua Kota</option>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Master Resi Table */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Menampilkan {filteredShipments.length} dari {shipments.length} Arsip Resi
              </span>
              <span className="text-muted-foreground text-[11px]">
                Klik <strong>Alur 6 Fase</strong> untuk memperbarui progres PIC atau status barang
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">No. Resi</th>
                    <th className="py-2.5 px-4">Layanan</th>
                    <th className="py-2.5 px-4">Pengirim & Penerima</th>
                    <th className="py-2.5 px-4">Rute Tujuan</th>
                    <th className="py-2.5 px-4">Muatan Barang</th>
                    <th className="py-2.5 px-4 text-center">Alur 6 Fase (PIC)</th>
                    <th className="py-2.5 px-4">Tarif (Ongkir)</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        <Package className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="font-semibold">Tidak ada data resi pengiriman yang cocok.</p>
                        <p className="text-[11px] mt-0.5">
                          Ubah kata kunci pencarian atau klik tombol Input Order Baru.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-foreground">{s.resi}</div>
                          <div className="text-[10px] text-muted-foreground">{s.tglOrder}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getLayananBadge(
                              s.layanan
                            )}`}
                          >
                            {s.layanan}
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            Est: {s.estimasiHari}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground">
                            <span className="font-semibold">{s.pengirim.nama}</span>
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                              {s.pengirim.telepon}
                            </span>
                          </div>
                          <div className="mt-1 pt-1 border-t border-border/50 text-foreground">
                            <span className="font-semibold text-sky-700 dark:text-sky-300">
                              &rarr; {s.penerima.nama}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate max-w-[150px]">
                              {s.penerima.telepon}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">
                            {s.pengirim.kota} &rarr;{' '}
                            <span className="text-sky-600 dark:text-sky-400 font-bold uppercase">
                              {s.penerima.kotaTujuan}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {s.penerima.alamat}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground truncate max-w-[170px]">
                            {s.barang.jenis}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {s.barang.beratKg} kg &bull; {s.barang.koli} koli &bull;{' '}
                            {s.barang.volumeCbm.toFixed(3)} m³
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {[
                              { label: 'FPB', done: s.alurPic.tahap1.selesai, color: 'bg-blue-500' },
                              {
                                label: 'PCH',
                                done: s.alurPic.tahap2.selesai,
                                color: 'bg-indigo-500',
                              },
                              {
                                label: 'FSTB',
                                done: s.alurPic.tahap3.selesai,
                                color: 'bg-amber-500',
                              },
                              {
                                label: 'TTB',
                                done: s.alurPic.tahap4.selesai,
                                color: 'bg-purple-500',
                              },
                              {
                                label: 'LAP',
                                done: s.alurPic.tahap5.selesai,
                                color: 'bg-cyan-500',
                              },
                              {
                                label: 'ADM',
                                done: s.alurPic.tahap6.selesai,
                                color: 'bg-emerald-500',
                              },
                            ].map((b, idx) => (
                              <span
                                key={idx}
                                title={`Fase ${idx + 1} (${b.label}): ${b.done ? 'Selesai' : 'Belum Selesai'}`}
                                className={`size-2.5 rounded-full transition-all ${
                                  b.done ? `${b.color} shadow-xs` : 'bg-muted-foreground/30'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="text-[9px] text-center text-muted-foreground font-mono mt-1 truncate max-w-[120px] mx-auto">
                            {s.alurPic.tahap2.picPurchasing || 'Belum Ditugaskan'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold text-foreground">
                            {formatCurrency(s.ongkir)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            Biaya: {formatCurrency(s.biayaOperasional)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                              s.status
                            )}`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setWorkflowShipment(s)}
                              className="px-2 py-1 rounded bg-sky-600/10 hover:bg-sky-600/20 text-sky-600 dark:text-sky-400 font-medium text-[11px] transition cursor-pointer"
                              title="Buka Alur Penugasan PIC & Berkas"
                            >
                              Alur 6 Fase
                            </button>
                            <button
                              onClick={() => setLabelShipment(s)}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                              title="Cetak Surat Jalan & Label"
                            >
                              <Printer className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setTrackingSearchResi(s.resi);
                                setSubTab('tracking');
                                executeTrackingSearch(s.resi);
                              }}
                              className="p-1.5 rounded text-muted-foreground hover:text-emerald-500 hover:bg-muted transition cursor-pointer"
                              title="Lacak Paket di Portal Publik"
                            >
                              <Search className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteShipment(s.id, s.resi)}
                              className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-muted transition cursor-pointer"
                              title="Hapus Resi"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-TAB: FITUR LACAK RESI (PUBLIC TRACKING) */}
      {/* ========================================================================= */}
      {subTab === 'tracking' && (
        <div className="space-y-5">
          {/* Public Portal Hero Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-xs text-center max-w-3xl mx-auto space-y-4">
            <div className="size-12 rounded-2xl bg-linear-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white mx-auto shadow-md">
              <Search className="size-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground">
                Lacak Status Paket & Resi Pengiriman
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto">
                Pelanggan dan mitra dapat memantau pergerakan kargo secara transparan dari titik pick-up hingga serah terima di tujuan akhir.
              </p>
            </div>

            {/* Tracking Search Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeTrackingSearch();
              }}
              className="flex items-center gap-2 max-w-md mx-auto"
            >
              <div className="relative flex-1">
                <Package className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Contoh: CRG-2026-00101"
                  value={trackingSearchResi}
                  onChange={(e) => setTrackingSearchResi(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-muted/30 text-sm font-mono uppercase text-foreground placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                type="submit"
                className="py-2.5 px-5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Search className="size-3.5" />
                <span>Lacak</span>
              </button>
            </form>

            {/* Quick Test Shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
              <span>Coba cek resi aktif:</span>
              {shipments.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setTrackingSearchResi(s.resi);
                    executeTrackingSearch(s.resi);
                  }}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-sky-600 dark:text-sky-400 border border-border transition cursor-pointer"
                >
                  {s.resi} ({s.penerima.kotaTujuan})
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Result View */}
          {hasSearchedTracking && (
            <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-300">
              {trackedShipment ? (
                <>
                  {/* Status Banner */}
                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-foreground">
                          {trackedShipment.resi}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                            trackedShipment.status
                          )}`}
                        >
                          {trackedShipment.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Layanan:{' '}
                        <strong className="text-foreground">{trackedShipment.layanan}</strong> &bull;
                        Estimasi Tiba:{' '}
                        <strong className="text-foreground">{trackedShipment.estimasiHari}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLabelShipment(trackedShipment)}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition cursor-pointer"
                      >
                        <Printer className="size-3.5 text-muted-foreground" />
                        <span>Cetak Bukti Resi</span>
                      </button>
                      <button
                        onClick={() => setWorkflowShipment(trackedShipment)}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        <Layers className="size-3.5" />
                        <span>Update Alur PIC</span>
                      </button>
                    </div>
                  </div>

                  {/* Route & Shipper/Consignee Info Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origin */}
                    <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase mb-2">
                        <MapPin className="size-3.5 text-sky-500" />
                        <span>Kota Asal (Pengirim)</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {trackedShipment.pengirim.nama}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {trackedShipment.pengirim.alamat}
                      </p>
                      <div className="mt-2 text-xs font-semibold text-foreground">
                        {trackedShipment.pengirim.kota} &bull; Telp: {trackedShipment.pengirim.telepon}
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase mb-2">
                        <MapPin className="size-3.5 text-sky-500" />
                        <span>Kota Tujuan (Penerima)</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {trackedShipment.penerima.nama}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {trackedShipment.penerima.alamat}
                      </p>
                      <div className="mt-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase">
                        {trackedShipment.penerima.kotaTujuan} &bull; Telp:{' '}
                        {trackedShipment.penerima.telepon}
                      </div>
                    </div>
                  </div>

                  {/* Goods Specs */}
                  <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted-foreground">Muatan Barang:</span>
                      <strong className="block text-sm text-foreground mt-0.5">
                        {trackedShipment.barang.jenis}
                      </strong>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-muted-foreground text-[11px]">Berat & Koli:</span>
                      <strong className="block text-foreground mt-0.5">
                        {trackedShipment.barang.beratKg} Kg &bull; {trackedShipment.barang.koli} Koli
                      </strong>
                    </div>
                  </div>

                  {/* Rich Visual Tracking Timeline (Checkpoints) */}
                  <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="size-4 text-emerald-500" />
                      <span>Riwayat Perjalanan Paket (Tracking Timeline)</span>
                    </h3>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {trackedShipment.riwayatTracking.map((evt, idx) => {
                        const isLatest = idx === trackedShipment.riwayatTracking.length - 1;
                        return (
                          <div key={idx} className="relative group">
                            {/* Circle bullet */}
                            <div
                              className={`absolute -left-6 top-1 size-3 rounded-full border-2 transition-all ${
                                isLatest
                                  ? 'bg-emerald-500 border-white ring-4 ring-emerald-500/20'
                                  : 'bg-muted-foreground border-card'
                              }`}
                            />

                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {evt.timestamp}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                                  {evt.lokasi}
                                </span>
                                <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                                  PIC: {evt.pic}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-foreground mt-1">
                                {evt.status}
                              </div>
                              <p className="text-xs text-muted-foreground">{evt.keterangan}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                  <AlertCircle className="size-10 text-amber-500 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-foreground">
                    Nomor Resi Tidak Ditemukan
                  </h3>
                  <p className="text-xs mt-1">
                    Pastikan Anda memasukkan nomor resi yang valid (contoh format: <strong>CRG-2026-XXXXX</strong>).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Modal Input Order Resi Baru */}
      <OrderEntryModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSave={handleCreateShipment}
        showToast={showToast}
      />

      {/* 2. Modal Alur Penugasan PIC & Berkas 6 Fase */}
      <KargoWorkflowModal
        shipment={workflowShipment}
        isOpen={!!workflowShipment}
        onClose={() => setWorkflowShipment(null)}
        onUpdate={handleUpdateShipment}
        showToast={showToast}
      />

      {/* 3. Modal Cetak Surat Jalan & Thermal Shipping Label */}
      <ShippingLabelModal
        shipment={labelShipment}
        isOpen={!!labelShipment}
        onClose={() => setLabelShipment(null)}
        showToast={showToast}
      />
    </div>
  );
}

