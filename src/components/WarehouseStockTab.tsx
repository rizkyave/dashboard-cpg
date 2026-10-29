'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  PackagePlus,
  PackageMinus,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Printer,
  ChevronDown,
  Building2,
  Anchor,
  User,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  MapPin,
  Tag,
  FileText,
  X,
  Plus,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Check,
  RotateCcw,
  Upload,
  Download,
  FileUp,
  ExternalLink,
  Globe,
  Truck,
  Eye,
  Info,
  Split,
  Columns2,
  Rows2,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  WarehouseStockItem,
  WarehouseMutation,
  WarehouseSummary,
  WarehouseCategory,
  StockStatus,
  MutationType,
} from '@/types/warehouseStock';
import { BudiTtbRecord, BudiSyncSummary } from '@/types/budiStockSync';
import {
  saveLocalWarehouseData,
  loadLocalWarehouseData,
} from '@/utils/warehouseStorage';
import { calculateWarehouseSummary } from '@/data/initialWarehouseData';

interface WarehouseStockTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Navigasi & Mode Tampilan
type MainView = 'simultan' | 'stok' | 'mutasi';
type SimultanLayout = 'stacked' | 'side-by-side';
type MutasiSubTab = 'ttb-armada' | 'riwayat-mutasi';
type ActiveForm = 'form-masuk' | 'form-keluar' | null;

const WAREHOUSE_CATEGORIES: WarehouseCategory[] = [
  'Pelumas & Kimia',
  'Filter & Separator',
  'Sparepart Mesin',
  'Deck, Tali & Jangkar',
  'Safety, LSA & FFA',
  'Kelistrikan & Navigasi',
  'Consumables, Cat & Tools',
  'Pipa & Katup (Valves)',
  'Lain-lain',
];

const FLEET_VESSELS = [
  'SPOB CINTIANA PRATAMA',
  'SPOB CINDARA',
  'TB. CINDARA PRATAMA 01',
  'TB. CINDARA PRATAMA 02',
  'TB. CINDARA PRATAMA 03',
  'TB. HANA 01',
  'TB. HANA 02',
  'TB. HANA 05',
  'TB. MANDAR OCEAN 01',
  'TB. MANDAR OCEAN 02',
  'TB. MANDAR OCEAN 05',
  'BG. CINDARA 3001',
  'BG. CINDARA 3002',
  'BG. MANDAR 300',
  'Bengkel Galangan GAJ (Slipway Somber)',
  'Workshop Maintenance MTC Kariangau',
  'Pool Operasional Somber',
];

export const BUDI_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=1826916113#gid=1826916113';

export default function WarehouseStockTab({ showToast }: WarehouseStockTabProps) {
  const [items, setItems] = useState<WarehouseStockItem[]>([]);
  const [mutations, setMutations] = useState<WarehouseMutation[]>([]);
  const [summary, setSummary] = useState<WarehouseSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Main View: 'simultan' (Menampilkan kedua data sekaligus), 'stok' (Data 1 saja), 'mutasi' (Data 2 saja)
  const [activeMainView, setActiveMainView] = useState<MainView>('simultan');

  // Layout untuk mode simultan: 'stacked' (Atas-Bawah) atau 'side-by-side' (Berdampingan 2 Kolom)
  const [simultanLayout, setSimultanLayout] = useState<SimultanLayout>('stacked');

  // Sub-tab di dalam Data 2 Mutasi Barang
  const [mutasiSubTab, setMutasiSubTab] = useState<MutasiSubTab>('ttb-armada');

  // Active form slide-in / accordion
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  // Filter & Search Terpisah (Independen)
  const [searchQueryStock, setSearchQueryStock] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [searchQueryMutasi, setSearchQueryMutasi] = useState<string>('');
  const [selectedPtBudi, setSelectedPtBudi] = useState<string>('ALL');
  const [selectedStatusBudi, setSelectedStatusBudi] = useState<string>('ALL');
  const [selectedSheetBudi, setSelectedSheetBudi] = useState<string>('ALL');

  const [searchQueryLedger, setSearchQueryLedger] = useState<string>('');
  const [selectedMutationType, setSelectedMutationType] = useState<string>('ALL');

  // Google Sheet TTB Sync State
  const [budiTtbRecords, setBudiTtbRecords] = useState<BudiTtbRecord[]>([]);
  const [budiSyncSummary, setBudiSyncSummary] = useState<BudiSyncSummary | null>(null);
  const [isSyncingBudiSheet, setIsSyncingBudiSheet] = useState<boolean>(false);
  const [lastBudiSyncTime, setLastBudiSyncTime] = useState<string>('');
  const [selectedDetailTtb, setSelectedDetailTtb] = useState<BudiTtbRecord | null>(null);

  // Modal State for Slip Print
  const [selectedSlipMutation, setSelectedSlipMutation] = useState<WarehouseMutation | null>(null);

  // Modal State for Add New SKU
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState<boolean>(false);
  const [newSkuForm, setNewSkuForm] = useState({
    kodeBarang: '',
    namaBarang: '',
    kategori: 'Sparepart Mesin' as WarehouseCategory,
    satuan: 'PCS',
    lokasiRak: 'Rak Suku Cadang A-01 Somber',
    minStock: 5,
    saldoAwal: 10,
    kondisi: 'Baru' as 'Baru' | 'Rekondisi' | 'Baik',
    hargaSatuanPerkiraan: 0,
    keterangan: '',
  });

  // Modal State for Import File
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importTarget, setImportTarget] = useState<'items' | 'mutations'>('items');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedPreviewItems, setParsedPreviewItems] = useState<Partial<WarehouseStockItem>[]>([]);
  const [parsedPreviewMutations, setParsedPreviewMutations] = useState<Partial<WarehouseMutation>[]>([]);
  const [isParsingImport, setIsParsingImport] = useState<boolean>(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Inbound (+ Masuk)
  const [inboundForm, setInboundForm] = useState({
    itemId: '',
    tanggal: new Date().toISOString().split('T')[0],
    waktu: '09:00',
    qty: 1,
    noDokumenRef: '',
    entitas: 'HOLDING' as any,
    sumberAtauTujuan: '',
    picGudang: 'Budi Agustiansyah (Staf Gudang Somber)',
    picPenerimaPengambil: '',
    keperluan: 'Penerimaan barang dari PO pengadaan pusat',
    catatan: '',
  });

  // Form State for Outbound (- Keluar)
  const [outboundForm, setOutboundForm] = useState({
    itemId: '',
    tanggal: new Date().toISOString().split('T')[0],
    waktu: '10:00',
    qty: 1,
    noDokumenRef: '',
    entitas: 'CPL' as any,
    sumberAtauTujuan: 'TB. CINDARA PRATAMA 01',
    picGudang: 'Budi Agustiansyah (Staf Gudang Somber)',
    picPenerimaPengambil: '',
    keperluan: 'Kebutuhan operasional armada kapal rutin',
    catatan: '',
  });

  // 1. Initial Load from Local Cache & Server
  useEffect(() => {
    const localData = loadLocalWarehouseData();
    if (localData.items && localData.items.length > 0) {
      setItems(localData.items);
      setMutations(localData.mutations);
      setSummary(localData.summary);
      setIsLoading(false);
    }

    // Fetch warehouse stock items
    fetch('/api/warehouse-stock')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
          setMutations(data.mutations || []);
          setSummary(data.summary || calculateWarehouseSummary(data.items, data.mutations || []));
          saveLocalWarehouseData(data.items, data.mutations || []);
        }
      })
      .catch((err) => {
        console.warn('Gagal sync ke /api/warehouse-stock:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Fetch synced TTB records from Google Sheet endpoint
    fetch('/api/sync-budi-stock')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.records)) {
          setBudiTtbRecords(data.records);
          setBudiSyncSummary(data.summary);
          if (data.summary?.lastSyncedAt) {
            setLastBudiSyncTime(new Date(data.summary.lastSyncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat cache /api/sync-budi-stock:', err);
      });
  }, []);

  const handleRefreshServer = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/warehouse-stock');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setMutations(data.mutations);
        setSummary(data.summary);
        saveLocalWarehouseData(data.items, data.mutations);
        showToast?.('Data stok gudang berhasil diperbarui dari server.', 'success');
      } else {
        showToast?.('Gagal memuat dari server.', 'warning');
      }
    } catch {
      showToast?.('Koneksi server terputus, menampilkan data lokal.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync Live Google Sheet TTB Pak Budi
  const handleSyncBudiGoogleSheet = async () => {
    setIsSyncingBudiSheet(true);
    try {
      const res = await fetch('/api/sync-budi-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: BUDI_SHEET_URL }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setBudiTtbRecords(data.records);
        setBudiSyncSummary(data.summary);
        const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        setLastBudiSyncTime(timeNow);
        showToast?.(
          `Berhasil menyinkronkan ${data.records.length} data TTB Pak Budi dari Google Sheet!`,
          'success'
        );
      } else {
        showToast?.(data.error || 'Gagal menyinkronkan Google Sheet.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan saat sinkronisasi Google Sheet.', 'error');
    } finally {
      setIsSyncingBudiSheet(false);
    }
  };

  // Helper to open Inbound Form with pre-selected item
  const handleOpenInboundForItem = (item: WarehouseStockItem) => {
    setInboundForm((prev) => ({
      ...prev,
      itemId: item.id,
      noDokumenRef: '',
      sumberAtauTujuan: '',
    }));
    setActiveForm('form-masuk');
  };

  // Helper to open Outbound Form with pre-selected item
  const handleOpenOutboundForItem = (item: WarehouseStockItem) => {
    setOutboundForm((prev) => ({
      ...prev,
      itemId: item.id,
      noDokumenRef: '',
      qty: 1,
    }));
    setActiveForm('form-keluar');
  };

  // Submit Inbound (+ Masuk)
  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundForm.itemId) {
      showToast?.('Pilih barang yang diterima terlebih dahulu!', 'warning');
      return;
    }
    if (inboundForm.qty <= 0) {
      showToast?.('Jumlah penerimaan harus lebih dari 0!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/warehouse-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-mutation',
          mutation: {
            ...inboundForm,
            jenis: 'MASUK',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setMutations(data.mutations);
        setSummary(data.summary);
        saveLocalWarehouseData(data.items, data.mutations);
        showToast?.(data.message || 'Penerimaan barang berhasil dicatat!', 'success');
        setActiveForm(null);
        // Reset form
        setInboundForm((prev) => ({
          ...prev,
          itemId: '',
          qty: 1,
          noDokumenRef: '',
          sumberAtauTujuan: '',
          picPenerimaPengambil: '',
          catatan: '',
        }));
      } else {
        showToast?.(data.error || 'Gagal menyimpan penerimaan.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan jaringan saat menyimpan data.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Outbound (- Keluar)
  const handleSubmitOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundForm.itemId) {
      showToast?.('Pilih barang yang dikeluarkan terlebih dahulu!', 'warning');
      return;
    }
    if (outboundForm.qty <= 0) {
      showToast?.('Jumlah pengeluaran harus lebih dari 0!', 'warning');
      return;
    }

    const selectedItem = items.find((i) => i.id === outboundForm.itemId);
    if (selectedItem && outboundForm.qty > selectedItem.sisaStok) {
      showToast?.(
        `Stok tidak mencukupi! Sisa stok saat ini ${selectedItem.sisaStok} ${selectedItem.satuan}.`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/warehouse-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-mutation',
          mutation: {
            ...outboundForm,
            jenis: 'KELUAR',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setMutations(data.mutations);
        setSummary(data.summary);
        saveLocalWarehouseData(data.items, data.mutations);
        showToast?.(data.message || 'Pengeluaran barang berhasil dicatat!', 'success');
        setActiveForm(null);
        // Reset form
        setOutboundForm((prev) => ({
          ...prev,
          itemId: '',
          qty: 1,
          noDokumenRef: '',
          picPenerimaPengambil: '',
          catatan: '',
        }));
      } else {
        showToast?.(data.error || 'Gagal menyimpan pengeluaran.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan jaringan saat menyimpan data.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Add New SKU
  const handleSubmitNewSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuForm.kodeBarang || !newSkuForm.namaBarang) {
      showToast?.('Kode barang dan nama barang wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/warehouse-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-item',
          item: newSkuForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setMutations(data.mutations);
        setSummary(data.summary);
        saveLocalWarehouseData(data.items, data.mutations);
        showToast?.(data.message || 'SKU barang baru berhasil ditambahkan!', 'success');
        setIsAddSkuModalOpen(false);
        // Reset form
        setNewSkuForm({
          kodeBarang: '',
          namaBarang: '',
          kategori: 'Sparepart Mesin',
          satuan: 'PCS',
          lokasiRak: 'Rak Suku Cadang A-01 Somber',
          minStock: 5,
          saldoAwal: 10,
          kondisi: 'Baru',
          hargaSatuanPerkiraan: 0,
          keterangan: '',
        });
      } else {
        showToast?.(data.error || 'Gagal menambahkan SKU baru.', 'error');
      }
    } catch {
      showToast?.('Gagal menghubungi server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      // Sheet 1: Kartu Stok Fisik
      const stockExport = items.map((i, idx) => ({
        No: idx + 1,
        'Kode Barang': i.kodeBarang,
        'Nama Barang': i.namaBarang,
        Kategori: i.kategori,
        Satuan: i.satuan,
        'Lokasi Rak': i.lokasiRak,
        'Batas Minimum': i.minStock,
        'Saldo Awal': i.saldoAwal,
        'Total Masuk': i.totalMasuk,
        'Total Keluar': i.totalKeluar,
        'Sisa Stok Fisik': i.sisaStok,
        'Status Stok': i.status,
        Kondisi: i.kondisi,
        'Est. Harga Satuan (IDR)': i.hargaSatuanPerkiraan || 0,
        'Tgl Mutasi Terakhir': i.lastMutationDate,
        Keterangan: i.keterangan || '',
      }));

      // Sheet 2: Jurnal Mutasi
      const mutationExport = mutations.map((m, idx) => ({
        No: idx + 1,
        'ID Mutasi': m.id,
        Tanggal: m.tanggal,
        Waktu: m.waktu,
        'Jenis Mutasi': m.jenis === 'MASUK' ? 'PENERIMAAN MASUK (+)' : 'PENGAMBILAN KELUAR (-)',
        'Kode Barang': m.kodeBarang,
        'Nama Barang': m.namaBarang,
        Kategori: m.kategori,
        'Jumlah Qty': m.qty,
        Satuan: m.satuan,
        'Saldo Sebelum': m.saldoSebelum,
        'Saldo Sesudah': m.saldoSesudah,
        'No. Dokumen Ref': m.noDokumenRef,
        Entitas: m.entitas,
        'Tujuan / Sumber': m.sumberAtauTujuan,
        'PIC Petugas Gudang': m.picGudang,
        'PIC Penerima / Pengambil': m.picPenerimaPengambil,
        Keperluan: m.keperluan,
        Catatan: m.catatan || '',
      }));

      // Sheet 3: Mutasi TTB Google Sheet
      const ttbExport = budiTtbRecords.map((r, idx) => ({
        No: idx + 1,
        'No. TTB Accurate': r.ttbAccurate,
        PT: r.pt,
        'Dept / Armada': r.deptArmada,
        'No. FPB Acuan': r.noFpb,
        'No. PO Terkait': r.noPo || '-',
        'PIC TTB': r.picTtb,
        'Tgl Input TTB': r.tanggalInputTtb,
        'Tgl Ke Tim Lapangan': r.tanggalKeTimLapangan,
        'PIC Lapangan': r.picLapangan,
        'Tgl Barang Diantar': r.tanggalBarangDiantar,
        'Status Pengantaran': r.statusPengantaran,
        'Keterangan Lapangan': r.keteranganLapangan,
        'Keterangan Diantar': r.keteranganDiantar,
        'Sumber Sheet': r.sumberSheet,
      }));

      const wb = XLSX.utils.book_new();
      const wsStock = XLSX.utils.json_to_sheet(stockExport);
      const wsMut = XLSX.utils.json_to_sheet(mutationExport);
      const wsTtb = XLSX.utils.json_to_sheet(ttbExport);

      XLSX.utils.book_append_sheet(wb, wsStock, 'Kartu Stok Gudang');
      XLSX.utils.book_append_sheet(wb, wsMut, 'Riwayat Mutasi');
      XLSX.utils.book_append_sheet(wb, wsTtb, 'TTB Armada Google Sheet');

      const fileName = `Rekap_Stok_Gudang_Pusat_Somber_Pak_Budi_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast?.(`File Excel berhasil diunduh: ${fileName}`, 'success');
    } catch {
      showToast?.('Gagal mengekspor data ke Excel.', 'error');
    }
  };

  // Download Official Excel Template
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Template 1: Master Stok Barang
      const sampleStockData = [
        {
          'Kode Barang': 'LUB-MED-040',
          'Nama Barang': 'OLI MESIN MEDITRAN S SAE 40 (PERTAMINA)',
          Kategori: 'Pelumas & Kimia',
          Satuan: 'DRUM',
          'Lokasi Rak': 'Pallet Pelumas B-01 Somber',
          'Saldo Awal': 15,
          'Min Stock': 5,
          'Harga Satuan': 6200000,
          Kondisi: 'Baru',
          Keterangan: 'Pelumas mesin induk armada TB & SPOB CPG',
        },
        {
          'Kode Barang': 'FLT-YAN-6AY',
          'Nama Barang': 'FILTER OLI YANMAR 6AYM-ETE',
          Kategori: 'Filter & Separator',
          Satuan: 'PCS',
          'Lokasi Rak': 'Rak Suku Cadang A-03 Somber',
          'Saldo Awal': 30,
          'Min Stock': 8,
          'Harga Satuan': 385000,
          Kondisi: 'Baru',
          Keterangan: 'Filter genuine mesin kapal seri 6AY',
        },
        {
          'Kode Barang': 'DCK-TRS-PP8',
          'Nama Barang': 'TALI TROSS PP 8-STRAND CIR 8 INCH',
          Kategori: 'Deck, Tali & Jangkar',
          Satuan: 'ROLL',
          'Lokasi Rak': 'Gudang Terbuka C-01 Somber',
          'Saldo Awal': 4,
          'Min Stock': 2,
          'Harga Satuan': 18500000,
          Kondisi: 'Baru',
          Keterangan: 'Tali tambat utama tongkang batubara',
        },
      ];

      // Template 2: Mutasi Transaksi
      const sampleMutationData = [
        {
          Tanggal: '2026-10-25',
          Waktu: '10:30',
          'Jenis Mutasi': 'MASUK',
          'Kode Barang': 'LUB-MED-040',
          'Nama Barang': 'OLI MESIN MEDITRAN S SAE 40 (PERTAMINA)',
          Kategori: 'Pelumas & Kimia',
          'Jumlah Qty': 10,
          Satuan: 'DRUM',
          'No Dokumen Ref': 'PO-CPG-26-002194',
          'Tujuan / Sumber': 'PT. Pertamina Lubricants',
          'PIC Penerima': 'Supir Ekspedisi Dwi',
          Keperluan: 'Penerimaan PO resmi bulanan',
          Catatan: 'Segel utuh di Pallet B-01',
        },
        {
          Tanggal: '2026-10-25',
          Waktu: '14:15',
          'Jenis Mutasi': 'KELUAR',
          'Kode Barang': 'FLT-YAN-6AY',
          'Nama Barang': 'FILTER OLI YANMAR 6AYM-ETE',
          Kategori: 'Filter & Separator',
          'Jumlah Qty': 4,
          Satuan: 'PCS',
          'No Dokumen Ref': 'TTB-CPL-26-004390',
          'Tujuan / Sumber': 'TB. CINDARA PRATAMA 01',
          'PIC Penerima': 'Chief Eng. Bambang',
          Keperluan: 'Pergantian oli berkala mesin induk',
          Catatan: 'Diserahkan langsung di Dermaga Somber',
        },
      ];

      const wsStock = XLSX.utils.json_to_sheet(sampleStockData);
      const wsMut = XLSX.utils.json_to_sheet(sampleMutationData);

      XLSX.utils.book_append_sheet(wb, wsStock, 'Template Stok Barang');
      XLSX.utils.book_append_sheet(wb, wsMut, 'Template Mutasi Transaksi');

      XLSX.writeFile(wb, 'Template_Import_Stok_Gudang_Somber.xlsx');
      showToast?.('Template file Excel berhasil diunduh.', 'success');
    } catch {
      showToast?.('Gagal mengunduh template.', 'error');
    }
  };

  // Process File Upload for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsParsingImport(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        if (wb.SheetNames.length === 0) {
          showToast?.('File Excel tidak memiliki lembar kerja (sheet).', 'error');
          setIsParsingImport(false);
          return;
        }

        let targetSheetName = wb.SheetNames[0];
        if (importTarget === 'mutations') {
          const mutSheet = wb.SheetNames.find((s) => s.toLowerCase().includes('mutasi'));
          if (mutSheet) targetSheetName = mutSheet;
        } else {
          const stockSheet = wb.SheetNames.find((s) => s.toLowerCase().includes('stok') || s.toLowerCase().includes('barang'));
          if (stockSheet) targetSheetName = stockSheet;
        }

        const ws = wb.Sheets[targetSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast?.('Tidak ada baris data yang terbaca pada sheet Excel.', 'warning');
          setIsParsingImport(false);
          return;
        }

        if (importTarget === 'items') {
          const mappedItems: Partial<WarehouseStockItem>[] = [];

          rawJson.forEach((row) => {
            const keys = Object.keys(row);
            const getVal = (patterns: string[]) => {
              for (const p of patterns) {
                const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p));
                if (found && row[found] !== undefined && row[found] !== '') {
                  return row[found];
                }
              }
              return '';
            };

            const kode = String(getVal(['kodebarang', 'partnumber', 'partno', 'nobarang', 'kode', 'sku']) || '').trim();
            const nama = String(getVal(['namabarang', 'deskripsibarang', 'deskripsi', 'itemname', 'nama', 'material']) || '').trim();

            if (!kode && !nama) return;

            const kategoriRaw = String(getVal(['kategori', 'category', 'tipepersediaan', 'tipebarang']) || '');
            let kategori: WarehouseCategory = 'Sparepart Mesin';
            for (const cat of WAREHOUSE_CATEGORIES) {
              if (kategoriRaw.toLowerCase().includes(cat.toLowerCase().split(' ')[0])) {
                kategori = cat;
                break;
              }
            }

            const satuan = String(getVal(['satuan', 'unit', 'uom']) || 'PCS').toUpperCase().trim();
            const lokasiRak = String(getVal(['lokasirak', 'lokasigudang', 'lokasi', 'rak', 'bin']) || 'Gudang Somber').trim();
            const minStock = Number(getVal(['minstock', 'batasminimum', 'minimum', 'min'])) || 2;
            const saldoAwal = Number(getVal(['saldoawal', 'kuantitas', 'qty', 'stok', 'sisastok', 'stokfisik'])) || 0;
            const harga = Number(getVal(['hargasatuan', 'harga', 'price', 'unitprice'])) || 0;
            const kondisi = String(getVal(['kondisi']) || 'Baru') as any;
            const keterangan = String(getVal(['keterangan', 'notes', 'catatan', 'remark']) || '').trim();

            mappedItems.push({
              kodeBarang: kode || `BRG-${mappedItems.length + 1}`,
              namaBarang: nama || kode,
              kategori,
              satuan: satuan || 'PCS',
              lokasiRak: lokasiRak || 'Gudang Somber',
              minStock,
              saldoAwal,
              sisaStok: saldoAwal,
              hargaSatuanPerkiraan: harga,
              kondisi: kondisi === 'Rekondisi' || kondisi === 'Baik' ? kondisi : 'Baru',
              keterangan,
            });
          });

          setParsedPreviewItems(mappedItems);
          setParsedPreviewMutations([]);
          showToast?.(`Berhasil membaca ${mappedItems.length} baris data barang dari Excel!`, 'success');
        } else {
          const mappedMutations: Partial<WarehouseMutation>[] = [];

          rawJson.forEach((row) => {
            const keys = Object.keys(row);
            const getVal = (patterns: string[]) => {
              for (const p of patterns) {
                const found = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p));
                if (found && row[found] !== undefined && row[found] !== '') {
                  return row[found];
                }
              }
              return '';
            };

            const tgl = String(getVal(['tanggal', 'date', 'tgl']) || new Date().toISOString().split('T')[0]).trim();
            const waktu = String(getVal(['waktu', 'time', 'jam']) || '10:00').trim();
            const jenisRaw = String(getVal(['jenismutasi', 'jenis', 'type', 'arah']) || 'MASUK').toUpperCase();
            const jenis: MutationType = jenisRaw.includes('KELUAR') || jenisRaw.includes('OUT') ? 'KELUAR' : 'MASUK';

            const kode = String(getVal(['kodebarang', 'partnumber', 'nobarang', 'kode', 'sku']) || '').trim();
            const nama = String(getVal(['namabarang', 'deskripsi', 'nama']) || '').trim();
            const qty = Number(getVal(['jumlahqty', 'qty', 'jumlah', 'volume'])) || 1;
            const satuan = String(getVal(['satuan', 'unit']) || 'PCS').toUpperCase().trim();
            const noDok = String(getVal(['nodokumenref', 'nodokumen', 'nopo', 'nofstb', 'nottb', 'suratjalan']) || '-').trim();
            const tujuan = String(getVal(['tujuansumber', 'tujuan', 'sumber', 'kapal', 'armada', 'supplier']) || '-').trim();
            const penerima = String(getVal(['penerimapengambil', 'penerima', 'pengambil', 'kru']) || '-').trim();
            const keperluan = String(getVal(['keperluan', 'alasan']) || '-').trim();
            const catatan = String(getVal(['catatan', 'keterangan']) || '').trim();

            if (!kode && !nama && !noDok) return;

            mappedMutations.push({
              tanggal: tgl,
              waktu,
              jenis,
              kodeBarang: kode || '-',
              namaBarang: nama || kode,
              qty,
              satuan,
              noDokumenRef: noDok,
              sumberAtauTujuan: tujuan,
              picPenerimaPengambil: penerima,
              keperluan,
              catatan,
            });
          });

          setParsedPreviewMutations(mappedMutations);
          setParsedPreviewItems([]);
          showToast?.(`Berhasil membaca ${mappedMutations.length} baris riwayat mutasi dari Excel!`, 'success');
        }
      } catch (err: any) {
        showToast?.('Gagal memproses file Excel: ' + (err?.message || 'Format tidak valid'), 'error');
      } finally {
        setIsParsingImport(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Submit Import to Server
  const handleConfirmImport = async () => {
    if (importTarget === 'items' && parsedPreviewItems.length === 0) {
      showToast?.('Tidak ada data barang yang valid untuk diimpor.', 'warning');
      return;
    }
    if (importTarget === 'mutations' && parsedPreviewMutations.length === 0) {
      showToast?.('Tidak ada data mutasi yang valid untuk diimpor.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload =
        importTarget === 'items'
          ? {
              action: 'import-items',
              items: parsedPreviewItems,
              mode: importMode,
            }
          : {
              action: 'import-mutations',
              mutations: parsedPreviewMutations,
            };

      const res = await fetch('/api/warehouse-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setMutations(data.mutations);
        setSummary(data.summary);
        saveLocalWarehouseData(data.items, data.mutations);
        showToast?.(data.message || 'Data berhasil diimpor ke sistem!', 'success');
        setIsImportModalOpen(false);
        setImportFile(null);
        setParsedPreviewItems([]);
        setParsedPreviewMutations([]);
      } else {
        showToast?.(data.error || 'Gagal menyimpan data impor.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan jaringan saat menyimpan data impor.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Items for Stock Card (Data 1)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !searchQueryStock ||
        item.namaBarang.toLowerCase().includes(searchQueryStock.toLowerCase()) ||
        item.kodeBarang.toLowerCase().includes(searchQueryStock.toLowerCase()) ||
        item.lokasiRak.toLowerCase().includes(searchQueryStock.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' || item.kategori === selectedCategory;

      const matchStatus =
        selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, searchQueryStock, selectedCategory, selectedStatus]);

  // Filtered Google Sheet TTB Records (Data 2)
  const filteredBudiTtbRecords = useMemo(() => {
    return budiTtbRecords.filter((r) => {
      const matchSearch =
        !searchQueryMutasi ||
        r.ttbAccurate.toLowerCase().includes(searchQueryMutasi.toLowerCase()) ||
        r.deptArmada.toLowerCase().includes(searchQueryMutasi.toLowerCase()) ||
        r.noFpb.toLowerCase().includes(searchQueryMutasi.toLowerCase()) ||
        (r.noPo && r.noPo.toLowerCase().includes(searchQueryMutasi.toLowerCase())) ||
        r.picTtb.toLowerCase().includes(searchQueryMutasi.toLowerCase()) ||
        r.picLapangan.toLowerCase().includes(searchQueryMutasi.toLowerCase()) ||
        r.keteranganLapangan.toLowerCase().includes(searchQueryMutasi.toLowerCase());

      const matchPt = selectedPtBudi === 'ALL' || r.pt.toUpperCase() === selectedPtBudi.toUpperCase();
      const matchStatus = selectedStatusBudi === 'ALL' || r.statusPengantaran === selectedStatusBudi;
      const matchSheet = selectedSheetBudi === 'ALL' || r.sumberSheet === selectedSheetBudi;

      return matchSearch && matchPt && matchStatus && matchSheet;
    });
  }, [budiTtbRecords, searchQueryMutasi, selectedPtBudi, selectedStatusBudi, selectedSheetBudi]);

  // Filtered Mutations for Ledger
  const filteredMutations = useMemo(() => {
    return mutations.filter((m) => {
      const matchSearch =
        !searchQueryLedger ||
        m.namaBarang.toLowerCase().includes(searchQueryLedger.toLowerCase()) ||
        m.kodeBarang.toLowerCase().includes(searchQueryLedger.toLowerCase()) ||
        m.noDokumenRef.toLowerCase().includes(searchQueryLedger.toLowerCase()) ||
        m.sumberAtauTujuan.toLowerCase().includes(searchQueryLedger.toLowerCase()) ||
        m.picPenerimaPengambil.toLowerCase().includes(searchQueryLedger.toLowerCase());

      const matchType =
        selectedMutationType === 'ALL' || m.jenis === selectedMutationType;

      return matchSearch && matchType;
    });
  }, [mutations, searchQueryLedger, selectedMutationType]);

  // Selected item detail for forms
  const selectedInboundItem = useMemo(() => {
    return items.find((i) => i.id === inboundForm.itemId);
  }, [items, inboundForm.itemId]);

  const selectedOutboundItem = useMemo(() => {
    return items.find((i) => i.id === outboundForm.itemId);
  }, [items, outboundForm.itemId]);

  // =========================================================================
  // RENDER SECTION 1: DATA 1 - STOK BARANG
  // =========================================================================
  const renderStockTableContent = (isSplit = false) => (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-full">
      {/* Section Header Card */}
      <div className="p-4 border-b border-border bg-emerald-500/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Boxes className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs md:text-sm font-bold text-foreground">
                Data 1: Stok Barang Fisik Gudang Pusat
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                {items.length} SKU
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Katalog persediaan, saldo awal, penerimaan (+), pengeluaran (-), sisa stok &amp; posisi rak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSplit && (
            <button
              onClick={() => setActiveMainView('stok')}
              className="h-7 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium flex items-center gap-1.5 transition text-muted-foreground hover:text-foreground"
              title="Perbesar Tampilan Data 1 (Layar Penuh)"
            >
              <Maximize2 className="size-3" />
              <span className="hidden sm:inline">Layar Penuh</span>
            </button>
          )}

          <button
            onClick={() => setIsAddSkuModalOpen(true)}
            className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer"
          >
            <Plus className="size-3" />
            <span>Tambah SKU</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="p-3.5 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/20">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama barang, kode SKU, atau lokasi rak..."
            value={searchQueryStock}
            onChange={(e) => setSearchQueryStock(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {searchQueryStock && (
            <button
              onClick={() => setSearchQueryStock('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              &times;
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Kategori</option>
            {WAREHOUSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Status Stok</option>
            <option value="AMAN">Aman (Stok Cukup)</option>
            <option value="MENIPIS">Menipis (Low Stock)</option>
            <option value="HABIS">Habis (Out of Stock)</option>
          </select>
        </div>
      </div>

      {/* Table Data 1 */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-10 text-center">No</th>
              <th className="py-2.5 px-3">Kode &amp; Nama Barang</th>
              <th className="py-2.5 px-3">Kategori</th>
              <th className="py-2.5 px-3">Lokasi Rak Somber</th>
              <th className="py-2.5 px-3 text-right">Min. Stok</th>
              <th className="py-2.5 px-3 text-right">Saldo Awal</th>
              <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Masuk (+)</th>
              <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">Keluar (-)</th>
              <th className="py-2.5 px-3 text-right font-bold text-foreground">Sisa Stok Fisik</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Boxes className="size-7 text-muted-foreground/40" />
                    <p className="font-medium text-xs">Tidak ada data barang yang sesuai kriteria pencarian.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.namaBarang}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-mono">
                      <span className="font-medium text-foreground/80">{item.kodeBarang}</span>
                      <span>&bull;</span>
                      <span>Satuan: <strong className="text-foreground">{item.satuan}</strong></span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                      {item.kategori}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-foreground/80 text-[11px]">
                      <MapPin className="size-3 text-muted-foreground shrink-0" />
                      <span>{item.lokasiRak}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground text-[11px]">
                    {item.minStock} {item.satuan}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground text-[11px]">
                    {item.saldoAwal}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                    +{item.totalMasuk}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                    -{item.totalKeluar}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="font-mono font-bold text-xs text-foreground">
                      {item.sisaStok} <span className="text-[10px] text-muted-foreground font-normal">{item.satuan}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {item.status === 'AMAN' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Aman
                      </span>
                    )}
                    {item.status === 'MENIPIS' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 animate-pulse">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Menipis
                      </span>
                    )}
                    {item.status === 'HABIS' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        Habis
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenInboundForItem(item)}
                        className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition cursor-pointer"
                        title={`Catat Penerimaan Masuk (+) untuk ${item.namaBarang}`}
                      >
                        <PackagePlus className="size-3" />
                      </button>
                      <button
                        onClick={() => handleOpenOutboundForItem(item)}
                        disabled={item.sisaStok <= 0}
                        className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={
                          item.sisaStok > 0
                            ? `Catat Pengambilan Keluar (-) untuk ${item.namaBarang}`
                            : 'Stok habis, tidak bisa dikeluarkan'
                        }
                      >
                        <PackageMinus className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Data 1 */}
      <div className="p-2.5 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Menampilkan <strong>{filteredItems.length}</strong> dari <strong>{items.length}</strong> SKU barang</span>
        <span className="font-mono">Gudang Pusat Somber &bull; Pak Budi</span>
      </div>
    </div>
  );

  // =========================================================================
  // RENDER SECTION 2: DATA 2 - MUTASI BARANG (GOOGLE SHEET & JURNAL)
  // =========================================================================
  const renderMutasiSection = (isSplit = false) => (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col h-full space-y-0">
      {/* Google Sheet Live Header Banner */}
      <div className="p-4 border-b border-border bg-blue-500/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="size-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xs md:text-sm font-bold text-foreground">
              Data 2: Mutasi Barang Stock Gudang Pak Budi (Google Sheet)
            </h2>
            <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
              gid: 1826916113
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sinkronisasi spreadsheet resmi operasional CPG: nomor TTB Accurate, FPB kapal acuan, tim pengantar &amp; tanggal fisik barang.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSplit && (
            <button
              onClick={() => setActiveMainView('mutasi')}
              className="h-7 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium flex items-center gap-1.5 transition text-muted-foreground hover:text-foreground"
              title="Perbesar Tampilan Data 2 (Layar Penuh)"
            >
              <Maximize2 className="size-3" />
              <span className="hidden sm:inline">Layar Penuh</span>
            </button>
          )}

          <a
            href={BUDI_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="h-7 px-2.5 rounded-md border border-border bg-card hover:bg-muted text-[11px] font-medium flex items-center gap-1.5 transition text-foreground"
          >
            <ExternalLink className="size-3 text-muted-foreground" />
            <span>Buka Google Sheet</span>
          </a>

          <button
            onClick={handleSyncBudiGoogleSheet}
            disabled={isSyncingBudiSheet}
            className="h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${isSyncingBudiSheet ? 'animate-spin' : ''}`} />
            <span>{isSyncingBudiSheet ? 'Sync...' : 'Sinkronkan'}</span>
          </button>
        </div>
      </div>

      {/* Subtab Mutasi Selector: TTB Armada Google Sheet vs Jurnal Mutasi Internal */}
      <div className="px-3.5 pt-2.5 pb-2 bg-muted/10 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-muted/70 p-0.5 rounded-lg">
          <button
            onClick={() => setMutasiSubTab('ttb-armada')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              mutasiSubTab === 'ttb-armada'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Anchor className="size-3" />
            <span>Mutasi TTB Armada (Google Sheet)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              mutasiSubTab === 'ttb-armada' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {budiTtbRecords.length}
            </span>
          </button>

          <button
            onClick={() => setMutasiSubTab('riwayat-mutasi')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              mutasiSubTab === 'riwayat-mutasi'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="size-3" />
            <span>Jurnal Mutasi Lengkap Internal</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
              mutasiSubTab === 'riwayat-mutasi' ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
            }`}>
              {mutations.length}
            </span>
          </button>
        </div>

        {mutasiSubTab === 'ttb-armada' && (
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
            <span>Terakhir sync: {lastBudiSyncTime || 'Hari ini'}</span>
          </div>
        )}
      </div>

      {/* Tab Content A: Mutasi TTB Google Sheet */}
      {mutasiSubTab === 'ttb-armada' && (
        <div className="flex flex-col flex-1">
          {/* Controls Bar */}
          <div className="p-3.5 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/20">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nomor TTB, FPB, nama kapal, atau PIC lapangan..."
                value={searchQueryMutasi}
                onChange={(e) => setSearchQueryMutasi(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQueryMutasi && (
                <button
                  onClick={() => setSearchQueryMutasi('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedPtBudi}
                onChange={(e) => setSelectedPtBudi(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Semua PT / Entitas</option>
                <option value="CPL">CPL (Cindara)</option>
                <option value="HL">HL (Hana Lines)</option>
                <option value="MO">MO (Mandar)</option>
                <option value="GAJ">GAJ (Galangan)</option>
                <option value="MIL">MIL (Mapan)</option>
              </select>

              <select
                value={selectedStatusBudi}
                onChange={(e) => setSelectedStatusBudi(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="TERKIRIM">Terkirim ke Kapal</option>
                <option value="DALAM_PENGANTARAN">Dalam Pengantaran</option>
                <option value="PROSES_GUDANG">Proses Gudang</option>
              </select>

              <select
                value={selectedSheetBudi}
                onChange={(e) => setSelectedSheetBudi(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Semua Sumber Sheet</option>
                <option value="STOCK GUDANG PAK BUDI">Stock Gudang Pak Budi</option>
                <option value="STOCK TALI">Stock Tali</option>
              </select>
            </div>
          </div>

          {/* Table TTB Armada */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">No. TTB Accurate</th>
                  <th className="py-2.5 px-3 text-center">PT</th>
                  <th className="py-2.5 px-3">Armada Kapal / Unit</th>
                  <th className="py-2.5 px-3">No. FPB Acuan</th>
                  <th className="py-2.5 px-3">PIC TTB</th>
                  <th className="py-2.5 px-3">Tgl Keluar Gudang</th>
                  <th className="py-2.5 px-3">PIC &amp; Tgl Diantar</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBudiTtbRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Anchor className="size-7 text-muted-foreground/40" />
                        <p className="font-medium text-xs">Tidak ada data TTB armada yang cocok dengan filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBudiTtbRecords.map((r, idx) => (
                    <tr key={r.id + '-' + idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-foreground font-mono">{r.ttbAccurate}</div>
                        <div className="text-[10px] text-muted-foreground">{r.sumberSheet}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                          {r.pt}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Anchor className="size-3.5 text-blue-500 shrink-0" />
                          <span>{r.deptArmada}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.noFpb && r.noFpb !== '-' ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className="inline-flex items-center gap-1 font-mono font-bold text-xs text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded border border-primary/20 transition"
                              title={`No. FPB Acuan: ${r.noFpb}${r.isEnriched ? ' (Tersinkronisasi otomatis dengan data sistem CPG)' : ''}`}
                            >
                              <FileText className="size-3 text-primary/70 shrink-0" />
                              <span>{r.noFpb}</span>
                            </span>
                            {r.noPo && r.noPo !== '-' && (
                              <span className="text-[10px] text-muted-foreground font-mono pl-0.5" title={`No. PO: ${r.noPo}`}>
                                PO: {r.noPo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-muted-foreground font-medium">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{r.picTtb}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                        {r.tanggalInputTtb || '-'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">{r.picLapangan || r.keteranganLapangan || '-'}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.tanggalBarangDiantar ? `Diantar: ${r.tanggalBarangDiantar}` : 'Belum diantar'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {r.statusPengantaran === 'TERKIRIM' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            Terkirim
                          </span>
                        )}
                        {r.statusPengantaran === 'DALAM_PENGANTARAN' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 animate-pulse">
                            <Truck className="size-3 text-blue-500" />
                            Diantar
                          </span>
                        )}
                        {r.statusPengantaran === 'PROSES_GUDANG' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <Clock className="size-3 text-amber-500" />
                            Gudang
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedDetailTtb(r)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
                          title="Lihat Detail Alur Penyerahan"
                        >
                          <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer TTB Armada */}
          <div className="p-2.5 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Menampilkan <strong>{filteredBudiTtbRecords.length}</strong> dari <strong>{budiTtbRecords.length}</strong> mutasi TTB Google Sheet</span>
            <span className="font-mono">Sinkronisasi Live Google Sheet &bull; Pak Budi</span>
          </div>
        </div>
      )}

      {/* Tab Content B: Jurnal Mutasi Internal */}
      {mutasiSubTab === 'riwayat-mutasi' && (
        <div className="flex flex-col flex-1">
          {/* Controls Bar Jurnal */}
          <div className="p-3.5 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-muted/20">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari transaksi, no. dokumen, kapal tujuan, atau penerima..."
                value={searchQueryLedger}
                onChange={(e) => setSearchQueryLedger(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQueryLedger && (
                <button
                  onClick={() => setSearchQueryLedger('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedMutationType('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  selectedMutationType === 'ALL'
                    ? 'bg-foreground text-background font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua ({mutations.length})
              </button>
              <button
                onClick={() => setSelectedMutationType('MASUK')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedMutationType === 'MASUK'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                <ArrowDownRight className="size-3" />
                <span>Masuk (+)</span>
              </button>
              <button
                onClick={() => setSelectedMutationType('KELUAR')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  selectedMutationType === 'KELUAR'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                <ArrowUpRight className="size-3" />
                <span>Keluar (-)</span>
              </button>
            </div>
          </div>

          {/* Table Jurnal */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Waktu &amp; ID Mutasi</th>
                  <th className="py-2.5 px-3 text-center">Jenis</th>
                  <th className="py-2.5 px-3">Nama &amp; Kode Barang</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Qty</th>
                  <th className="py-2.5 px-3 text-center">Mutasi Saldo</th>
                  <th className="py-2.5 px-3">Dokumen Acuan</th>
                  <th className="py-2.5 px-3">Tujuan / Sumber</th>
                  <th className="py-2.5 px-3">Penerima</th>
                  <th className="py-2.5 px-3 text-center">Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMutations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers className="size-7 text-muted-foreground/40" />
                        <p className="font-medium text-xs">Belum ada riwayat mutasi internal yang tercatat.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMutations.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground font-mono text-[11px]">{m.id}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span>{m.tanggal}</span>
                          <span>&bull;</span>
                          <span>{m.waktu} WITA</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {m.jenis === 'MASUK' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <ArrowDownRight className="size-3" />
                            MASUK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <ArrowUpRight className="size-3" />
                            KELUAR
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground">{m.namaBarang}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{m.kodeBarang}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs ${
                            m.jenis === 'MASUK'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {m.jenis === 'MASUK' ? `+${m.qty}` : `-${m.qty}`} {m.satuan}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-[10px]">
                        <span className="text-muted-foreground">{m.saldoSebelum}</span>
                        <span className="mx-1 text-muted-foreground">&rarr;</span>
                        <span className="font-bold text-foreground">{m.saldoSesudah}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-foreground font-medium text-[11px]">{m.noDokumenRef}</div>
                        <div className="text-[10px] text-muted-foreground">{m.keperluan}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          {m.jenis === 'KELUAR' ? (
                            <Anchor className="size-3 text-muted-foreground" />
                          ) : (
                            <Building2 className="size-3 text-muted-foreground" />
                          )}
                          <span>{m.sumberAtauTujuan}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-foreground text-[11px]">{m.picPenerimaPengambil}</div>
                        <div className="text-[10px] text-muted-foreground">Petugas: Pak Budi</div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedSlipMutation(m)}
                          className="p-1 rounded-md border border-border bg-card hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
                          title="Cetak Bukti Transaksi Gudang (BPBG)"
                        >
                          <Printer className="size-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Jurnal */}
          <div className="p-2.5 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Total <strong>{filteredMutations.length}</strong> transaksi jurnal mutasi tercatat</span>
            <span className="font-mono">Audit Trail Gudang Somber</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Profile of Pak Budi */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-card via-card to-emerald-500/5 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5">
            <div className="size-12 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Boxes className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                  Stok Gudang Pusat Somber
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  PT Cindara Pratama Lines &amp; Group
                </span>
                {lastBudiSyncTime && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
                    Sync TTB: {lastBudiSyncTime} WITA
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Pengendalian persediaan fisik, penerimaan barang PO masuk &amp; mutasi pengeluaran ke armada kapal (Terintegrasi Google Sheet TTB)
              </p>
            </div>
          </div>

          {/* PIC Gudang Badge: Pak Budi Agustiansyah */}
          <div className="flex items-center gap-3 bg-muted/60 dark:bg-muted/30 border border-border px-3.5 py-2.5 rounded-xl self-start md:self-auto shrink-0">
            <div className="size-9 rounded-full bg-linear-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              B
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">BUDI AGUSTIANSYAH</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-300">
                  Staf Gudang
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                NIK: <span className="font-mono text-foreground font-semibold">MP-DAO-0281</span> &bull; Somber Balikpapan
              </div>
            </div>
          </div>
        </div>

        {/* Action Header: 2 Tab Utama + Mode Tampilan Simultan + Quick Buttons */}
        <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
          {/* Main Tabs Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted/70 p-1 rounded-xl">
              {/* TAB 1: STOK BARANG */}
              <button
                onClick={() => {
                  setActiveMainView('stok');
                  setActiveForm(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  activeMainView === 'stok'
                    ? 'bg-background text-foreground shadow-xs font-bold border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Boxes className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Data 1: Stok Barang</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted-foreground/10 text-muted-foreground font-mono">
                  {items.length}
                </span>
              </button>

              {/* TAB 2: MUTASI BARANG */}
              <button
                onClick={() => {
                  setActiveMainView('mutasi');
                  setActiveForm(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  activeMainView === 'mutasi'
                    ? 'bg-background text-foreground shadow-xs font-bold border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="size-3.5 text-blue-600 dark:text-blue-400" />
                <span>Data 2: Mutasi Barang</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                  {budiTtbRecords.length > 0 ? budiTtbRecords.length : '449+'}
                </span>
              </button>

              <div className="h-4 w-px bg-border mx-1" />

              {/* TAMPILAN SIMULTAN (2 DATA) */}
              <button
                onClick={() => {
                  setActiveMainView('simultan');
                  setActiveForm(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                  activeMainView === 'simultan'
                    ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-bold'
                    : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
                }`}
                title="Menampilkan 2 data (Stok Barang dan Mutasi Barang) secara simultan bersamaan di satu layar"
              >
                <Split className="size-3.5" />
                <span>Tampilan Simultan (2 Data)</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold tracking-wider ${
                  activeMainView === 'simultan' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                }`}>
                  Dual View
                </span>
              </button>
            </div>

            {/* Quick Action Buttons: Masuk & Keluar Form */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveForm(activeForm === 'form-masuk' ? null : 'form-masuk')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeForm === 'form-masuk'
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                }`}
              >
                <PackagePlus className="size-3.5" />
                <span>+ Masuk</span>
              </button>

              <button
                onClick={() => setActiveForm(activeForm === 'form-keluar' ? null : 'form-keluar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeForm === 'form-keluar'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20'
                }`}
              >
                <PackageMinus className="size-3.5" />
                <span>- Keluar</span>
              </button>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sync Live Google Sheet TTB */}
            <button
              onClick={handleSyncBudiGoogleSheet}
              disabled={isSyncingBudiSheet}
              className="h-8.5 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Sinkronkan data TTB pengeluaran armada langsung dari Google Sheet resmi Pak Budi"
            >
              <RefreshCw className={`size-3.5 text-emerald-600 dark:text-emerald-400 ${isSyncingBudiSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingBudiSheet ? 'Menyinkronkan...' : 'Sync Sheet TTB'}</span>
            </button>

            {/* Tambah SKU Manual */}
            <button
              onClick={() => setIsAddSkuModalOpen(true)}
              className="h-8.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Tambah SKU</span>
            </button>

            {/* Impor File Excel / CSV */}
            <button
              onClick={() => {
                setIsImportModalOpen(true);
                setImportFile(null);
                setParsedPreviewItems([]);
                setParsedPreviewMutations([]);
              }}
              className="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Impor Data Persediaan atau Riwayat Mutasi dari File Excel (.xlsx / .csv)"
            >
              <Upload className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>Impor File</span>
            </button>

            {/* Ekspor Excel */}
            <button
              onClick={handleExportExcel}
              className="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Unduh Rekap Excel Lengkap (Kartu Stok, Riwayat Mutasi & TTB Armada)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>

            {/* Refresh */}
            <button
              onClick={handleRefreshServer}
              disabled={isLoading}
              className="size-8.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition shadow-xs cursor-pointer disabled:opacity-50"
              title="Sinkronisasi Ulang Data Server"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total SKU */}
        <div
          onClick={() => {
            setActiveMainView('stok');
            setSelectedStatus('ALL');
            setSelectedCategory('ALL');
          }}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk membuka Data 1 (Stok Barang)"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total SKU Barang</span>
            <Boxes className="size-4 text-emerald-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1.5 font-mono">
            {summary?.totalSKU || items.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Katalog Terdaftar</div>
        </div>

        {/* Total Unit Fisik */}
        <div
          onClick={() => setActiveMainView('stok')}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk membuka Data 1 (Stok Barang)"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Stok Fisik Tersedia</span>
            <Building2 className="size-4 text-blue-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
            {summary?.totalFisikUnit?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Unit di Gudang Somber</div>
        </div>

        {/* Transaksi Masuk */}
        <div
          onClick={() => setActiveForm('form-masuk')}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk membuka Form Penerimaan Masuk (+)"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Penerimaan Masuk</span>
            <ArrowDownRight className="size-4 text-emerald-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
            +{summary?.totalQtyMasuk || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary?.totalTransaksiMasuk || 0} Bukti Masuk
          </div>
        </div>

        {/* Transaksi Keluar */}
        <div
          onClick={() => setActiveForm('form-keluar')}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk membuka Form Pengambilan Keluar (-)"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Pengambilan Keluar</span>
            <ArrowUpRight className="size-4 text-amber-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
            -{summary?.totalQtyKeluar || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary?.totalTransaksiKeluar || 0} Mutasi Manual
          </div>
        </div>

        {/* TTB Google Sheet Synced */}
        <div
          onClick={() => {
            setActiveMainView('mutasi');
            setMutasiSubTab('ttb-armada');
          }}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk membuka Data 2 (Mutasi TTB Armada Google Sheet)"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>TTB Armada Sync</span>
            <Anchor className="size-4 text-indigo-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 font-mono">
            {budiTtbRecords.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {budiSyncSummary?.totalArmada || 112} Kapal Dilayani
          </div>
        </div>

        {/* Stok Habis / Kritis */}
        <div
          onClick={() => {
            setActiveMainView('stok');
            setSelectedStatus('HABIS');
          }}
          className="bg-card hover:bg-muted/40 transition border border-border rounded-xl p-3.5 shadow-xs cursor-pointer group"
          title="Klik untuk memfilter stok barang habis/kritis"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Stok Habis / Kritis</span>
            <AlertOctagon className="size-4 text-rose-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5 font-mono">
            {summary?.itemOutOfStock || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Perlu Order PO Baru</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORM MODUL: FORM MASUK (+)                                               */}
      {/* ========================================================================= */}
      {activeForm === 'form-masuk' && (
        <div className="max-w-3xl mx-auto bg-card border-2 border-emerald-500/30 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 duration-200">
          <div className="p-4 border-b border-border bg-emerald-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <PackagePlus className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Form Pencatatan Penerimaan Barang Masuk</h3>
                <p className="text-[11px] text-muted-foreground">
                  Catat barang masuk dari Supplier / PO Pengadaan / Retur Armada ke Gudang Somber
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveForm(null)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitInbound} className="p-5 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Pilih Barang Persediaan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={inboundForm.itemId}
                onChange={(e) => setInboundForm({ ...inboundForm, itemId: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Pilih Barang dari Gudang --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.kodeBarang}] {i.namaBarang} (Stok Saat Ini: {i.sisaStok} {i.satuan}) - {i.lokasiRak}
                  </option>
                ))}
              </select>
            </div>

            {selectedInboundItem && (
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">{selectedInboundItem.namaBarang}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Kode: <span className="font-mono font-semibold">{selectedInboundItem.kodeBarang}</span> &bull; Lokasi: {selectedInboundItem.lokasiRak}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Saldo Saat Ini</div>
                  <div className="font-mono font-bold text-sm text-foreground">
                    {selectedInboundItem.sisaStok} {selectedInboundItem.satuan}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Jumlah Qty Masuk <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={inboundForm.qty}
                    onChange={(e) => setInboundForm({ ...inboundForm, qty: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-muted-foreground shrink-0 px-2">
                    {selectedInboundItem?.satuan || 'UNIT'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  No. Dokumen Acuan (PO / FSTB / Surat Jalan) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PO-CPG-26-002194 / SJ-7819"
                  value={inboundForm.noDokumenRef}
                  onChange={(e) => setInboundForm({ ...inboundForm, noDokumenRef: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tanggal Masuk
                </label>
                <input
                  type="date"
                  required
                  value={inboundForm.tanggal}
                  onChange={(e) => setInboundForm({ ...inboundForm, tanggal: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Waktu (WITA)
                </label>
                <input
                  type="time"
                  required
                  value={inboundForm.waktu}
                  onChange={(e) => setInboundForm({ ...inboundForm, waktu: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Entitas Perusahaan
                </label>
                <select
                  value={inboundForm.entitas}
                  onChange={(e) => setInboundForm({ ...inboundForm, entitas: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="HOLDING">HOLDING (CPG)</option>
                  <option value="CPL">CPL (Cindara)</option>
                  <option value="HL">HL (Hana Lines)</option>
                  <option value="MO">MO (Mandar Ocean)</option>
                  <option value="GAJ">GAJ (Galangan)</option>
                  <option value="MIL">MIL (Mapan)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Sumber Pengirim / Supplier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT. Pertamina Lubricants / CV. Berkat Jaya"
                  value={inboundForm.sumberAtauTujuan}
                  onChange={(e) => setInboundForm({ ...inboundForm, sumberAtauTujuan: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Pengantar / Supir / Kurir
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dwi Supir Ekspedisi"
                  value={inboundForm.picPenerimaPengambil}
                  onChange={(e) => setInboundForm({ ...inboundForm, picPenerimaPengambil: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Petugas Penerima Gudang Somber
                </label>
                <input
                  type="text"
                  disabled
                  value={inboundForm.picGudang}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Catatan / Lokasi Penyimpanan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Barang diletakkan di Rak Suku Cadang A-03"
                  value={inboundForm.catatan}
                  onChange={(e) => setInboundForm({ ...inboundForm, catatan: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {selectedInboundItem && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border flex items-center justify-between">
                <span>Prediksi Sisa Stok Setelah Penerimaan:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedInboundItem.sisaStok} + {inboundForm.qty} ={' '}
                  {selectedInboundItem.sisaStok + inboundForm.qty} {selectedInboundItem.satuan}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="h-8.5 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-8.5 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <PackagePlus className="size-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan Masuk'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM MODUL: FORM KELUAR (-)                                              */}
      {/* ========================================================================= */}
      {activeForm === 'form-keluar' && (
        <div className="max-w-3xl mx-auto bg-card border-2 border-amber-500/30 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-50 duration-200">
          <div className="p-4 border-b border-border bg-amber-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                <PackageMinus className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Form Pengeluaran Barang / Mutasi Armada</h3>
                <p className="text-[11px] text-muted-foreground">
                  Catat pengeluaran barang untuk armada kapal / workshop kebon / galangan somber
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveForm(null)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitOutbound} className="p-5 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Pilih Barang yang Dikeluarkan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={outboundForm.itemId}
                onChange={(e) => setOutboundForm({ ...outboundForm, itemId: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Pilih Barang dari Gudang --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.sisaStok <= 0}>
                    [{i.kodeBarang}] {i.namaBarang} (Sisa Stok: {i.sisaStok} {i.satuan}) {i.sisaStok <= 0 ? '- [HABIS]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedOutboundItem && (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">{selectedOutboundItem.namaBarang}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Kode: <span className="font-mono font-semibold">{selectedOutboundItem.kodeBarang}</span> &bull; Lokasi: {selectedOutboundItem.lokasiRak}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Sisa Stok Fisik</div>
                  <div className={`font-mono font-bold text-sm ${selectedOutboundItem.sisaStok <= 2 ? 'text-rose-600' : 'text-foreground'}`}>
                    {selectedOutboundItem.sisaStok} {selectedOutboundItem.satuan}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Jumlah Qty Keluar <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedOutboundItem?.sisaStok || 9999}
                    required
                    value={outboundForm.qty}
                    onChange={(e) => setOutboundForm({ ...outboundForm, qty: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-muted-foreground shrink-0 px-2">
                    {selectedOutboundItem?.satuan || 'UNIT'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  No. Dokumen Acuan (TTB / FPB Acuan) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CPL-TTB-26-0004576 / FPB-029"
                  value={outboundForm.noDokumenRef}
                  onChange={(e) => setOutboundForm({ ...outboundForm, noDokumenRef: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tanggal Pengeluaran
                </label>
                <input
                  type="date"
                  required
                  value={outboundForm.tanggal}
                  onChange={(e) => setOutboundForm({ ...outboundForm, tanggal: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Waktu (WITA)
                </label>
                <input
                  type="time"
                  required
                  value={outboundForm.waktu}
                  onChange={(e) => setOutboundForm({ ...outboundForm, waktu: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Entitas Pemilik Armada
                </label>
                <select
                  value={outboundForm.entitas}
                  onChange={(e) => setOutboundForm({ ...outboundForm, entitas: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="CPL">CPL (Cindara)</option>
                  <option value="HL">HL (Hana Lines)</option>
                  <option value="MO">MO (Mandar Ocean)</option>
                  <option value="GAJ">GAJ (Galangan)</option>
                  <option value="MIL">MIL (Mapan)</option>
                  <option value="HOLDING">HOLDING (CPG)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Armada Kapal / Unit Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={outboundForm.sumberAtauTujuan}
                  onChange={(e) => setOutboundForm({ ...outboundForm, sumberAtauTujuan: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Pilih Armada Kapal / Workshop --</option>
                  {FLEET_VESSELS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Penerima / Pengambil Barang di Dermaga <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chief Engineer Bambang / Mandor Agus"
                  value={outboundForm.picPenerimaPengambil}
                  onChange={(e) => setOutboundForm({ ...outboundForm, picPenerimaPengambil: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Alasan / Keperluan Pengambilan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Kebutuhan operasional armada kapal rutin / penggantian darurat di dermaga."
                value={outboundForm.keperluan}
                onChange={(e) => setOutboundForm({ ...outboundForm, keperluan: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {selectedOutboundItem && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border flex items-center justify-between">
                <span>Sisa Stok Fisik Setelah Pengeluaran:</span>
                <span
                  className={`font-mono font-bold ${
                    selectedOutboundItem.sisaStok - outboundForm.qty < 0
                      ? 'text-rose-600'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {selectedOutboundItem.sisaStok} - {outboundForm.qty} ={' '}
                  {selectedOutboundItem.sisaStok - outboundForm.qty} {selectedOutboundItem.satuan}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="h-8.5 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (selectedOutboundItem && selectedOutboundItem.sisaStok < outboundForm.qty)}
                className="h-8.5 px-5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <PackageMinus className="size-3.5" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Keluarkan Barang'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN UTAMA (MODE SIMULTAN / TAB TERPISAH)                             */}
      {/* ========================================================================= */}
      {activeMainView === 'simultan' && (
        <div className="space-y-4">
          {/* Layout Controller Bar for Simultaneous Mode */}
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <Split className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-foreground">Mode Tampilan Simultan Aktif: </span>
                <span className="text-muted-foreground">
                  Menampilkan <strong>Data 1 (Stok Barang)</strong> &amp; <strong>Data 2 (Mutasi Barang)</strong> secara bersamaan.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">Pilihan Tata Letak:</span>
              <div className="flex items-center gap-1 bg-background/80 border border-border p-0.5 rounded-lg">
                <button
                  onClick={() => setSimultanLayout('stacked')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    simultanLayout === 'stacked'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Tampilan Bertingkat: Data 1 di atas, Data 2 di bawah (Lebar tabel maksimal 100%)"
                >
                  <Rows2 className="size-3.5" />
                  <span>Bertingkat (Atas-Bawah)</span>
                </button>

                <button
                  onClick={() => setSimultanLayout('side-by-side')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    simultanLayout === 'side-by-side'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Tampilan Berdampingan: 2 Kolom berdampingan split screen"
                >
                  <Columns2 className="size-3.5" />
                  <span>Berdampingan (2 Kolom)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Simultaneous View: Stacked Layout (Atas - Bawah) */}
          {simultanLayout === 'stacked' && (
            <div className="space-y-6">
              {/* Bagian Atas: Data 1 Stok Barang */}
              <div>{renderStockTableContent(true)}</div>

              {/* Bagian Bawah: Data 2 Mutasi Barang */}
              <div>{renderMutasiSection(true)}</div>
            </div>
          )}

          {/* Simultaneous View: Side-by-Side Layout (2 Kolom) */}
          {simultanLayout === 'side-by-side' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* Kolom Kiri: Data 1 Stok Barang */}
              <div className="h-full">{renderStockTableContent(true)}</div>

              {/* Kolom Kanan: Data 2 Mutasi Barang */}
              <div className="h-full">{renderMutasiSection(true)}</div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN TAB TUNGGAL: DATA 1 STOK BARANG SAJA                            */}
      {/* ========================================================================= */}
      {activeMainView === 'stok' && (
        <div className="space-y-4">
          {renderStockTableContent(false)}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN TAB TUNGGAL: DATA 2 MUTASI BARANG SAJA                          */}
      {/* ========================================================================= */}
      {activeMainView === 'mutasi' && (
        <div className="space-y-4">
          {renderMutasiSection(false)}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAIL ALUR SERAH TERIMA TTB GOOGLE SHEET                         */}
      {/* ========================================================================= */}
      {selectedDetailTtb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in-50 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between bg-blue-500/10">
              <div className="flex items-center gap-2.5">
                <Anchor className="size-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Detail Alur Pengeluaran TTB Armada</h3>
                  <p className="text-[11px] font-mono text-muted-foreground">{selectedDetailTtb.ttbAccurate}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailTtb(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground">Entitas PT:</span>
                  <div className="font-bold text-foreground">{selectedDetailTtb.pt}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Armada Kapal / Unit:</span>
                  <div className="font-bold text-blue-600 dark:text-blue-400">{selectedDetailTtb.deptArmada}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">No. FPB Acuan:</span>
                  <div className="font-mono font-bold text-primary flex items-center gap-1.5 mt-0.5">
                    {selectedDetailTtb.noFpb && selectedDetailTtb.noFpb !== '-' ? (
                      <>
                        <FileText className="size-3.5 text-primary" />
                        <span>{selectedDetailTtb.noFpb}</span>
                        {selectedDetailTtb.isEnriched && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-sans font-medium">
                            Tersinkron
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground font-normal">-</span>
                    )}
                  </div>
                  {selectedDetailTtb.noPo && (
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      PO: {selectedDetailTtb.noPo}
                    </div>
                  )}
                  {selectedDetailTtb.noFstb && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      FSTB: {selectedDetailTtb.noFstb}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Status Pengantaran:</span>
                  <div>
                    {selectedDetailTtb.statusPengantaran === 'TERKIRIM' && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                        <CheckCircle2 className="size-3" />
                        Terkirim ke Kapal
                      </span>
                    )}
                    {selectedDetailTtb.statusPengantaran === 'DALAM_PENGANTARAN' && (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                        <Truck className="size-3" />
                        Dalam Pengantaran Lapangan
                      </span>
                    )}
                    {selectedDetailTtb.statusPengantaran === 'PROSES_GUDANG' && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                        <Clock className="size-3" />
                        Proses Gudang Somber
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Step Timeline */}
              <div className="space-y-3 pt-2">
                <div className="font-semibold text-foreground text-[11px]">Milestone Perjalanan Fisik Dokumen &amp; Barang:</div>
                <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                  <div className="relative">
                    <span className="absolute -left-6 top-0.5 size-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">1</span>
                    <div className="font-medium text-foreground">Input TTB Accurate &amp; Pengeluaran Gudang</div>
                    <div className="text-[11px] text-muted-foreground">
                      Tanggal: <strong className="text-foreground">{selectedDetailTtb.tanggalInputTtb || '-'}</strong> &bull; PIC TTB: {selectedDetailTtb.picTtb}
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-6 top-0.5 size-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[9px] font-bold">2</span>
                    <div className="font-medium text-foreground">Diserahkan ke Tim Lapangan Pengantar</div>
                    <div className="text-[11px] text-muted-foreground">
                      Tanggal: <strong className="text-foreground">{selectedDetailTtb.tanggalKeTimLapangan || '-'}</strong> &bull; Petugas: {selectedDetailTtb.picLapangan || selectedDetailTtb.keteranganLapangan || '-'}
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-6 top-0.5 size-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold">3</span>
                    <div className="font-medium text-foreground">Barang Fisik Tiba &amp; Diantar ke Kapal</div>
                    <div className="text-[11px] text-muted-foreground">
                      Tanggal: <strong className="text-foreground">{selectedDetailTtb.tanggalBarangDiantar || 'Belum diantar'}</strong>
                      {selectedDetailTtb.keteranganDiantar && ` (${selectedDetailTtb.keteranganDiantar})`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              <span className="text-[10px] text-muted-foreground">Sumber Sheet: {selectedDetailTtb.sumberSheet}</span>
              <button
                type="button"
                onClick={() => setSelectedDetailTtb(null)}
                className="h-8 px-4 rounded-lg bg-foreground text-background font-semibold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPOR FILE EXCEL / CSV                                            */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in-50 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Upload className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Impor Data ke Gudang Pusat Somber
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Unggah file Excel (.xlsx, .xls) atau CSV untuk memperbarui stok barang atau mutasi transaksi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Type and Template Download Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Target Impor Data:</span>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setImportTarget('items');
                        setParsedPreviewItems([]);
                        setParsedPreviewMutations([]);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        importTarget === 'items'
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Boxes className="size-3.5" />
                      <span>Master Stok Barang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportTarget('mutations');
                        setParsedPreviewItems([]);
                        setParsedPreviewMutations([]);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        importTarget === 'mutations'
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Layers className="size-3.5" />
                      <span>Riwayat Mutasi</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition text-foreground self-start sm:self-auto"
                >
                  <Download className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-blue-500/50 rounded-2xl p-6 text-center cursor-pointer transition bg-muted/10 hover:bg-muted/30 group"
              >
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center group-hover:scale-105 transition">
                  <FileUp className="size-6" />
                </div>
                <div className="mt-3">
                  <span className="font-semibold text-foreground text-sm">
                    {importFile ? importFile.name : 'Klik untuk memilih file Excel atau drag file ke sini'}
                  </span>
                  <p className="text-muted-foreground text-[11px] mt-1">
                    Mendukung format .xlsx, .xls, .csv (Template Resmi CPG, Export Accurate, atau File Excel Custom)
                  </p>
                </div>
                {isParsingImport && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-primary font-medium">
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menganalisis baris data...</span>
                  </div>
                )}
              </div>

              {/* Import Options (Only for Stock Items) */}
              {importTarget === 'items' && parsedPreviewItems.length > 0 && (
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                  <div className="font-semibold text-foreground text-xs">Metode Penerapan Data:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2.5 transition ${
                        importMode === 'merge'
                          ? 'border-blue-500/50 bg-blue-500/5 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div className="leading-tight">
                        <div className="font-bold text-foreground text-xs">Gabungkan (Merge &amp; Update)</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Perbarui saldo/data pada kode barang yang cocok, dan tambahkan barang baru yang belum ada.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2.5 transition ${
                        importMode === 'replace'
                          ? 'border-rose-500/50 bg-rose-500/5 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5 text-rose-600"
                      />
                      <div className="leading-tight">
                        <div className="font-bold text-rose-600 dark:text-rose-400 text-xs">Gantikan Semua (Replace All)</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Hapus katalog barang lama dan gantikan sepenuhnya dengan isi file Excel ini.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview Table: Stock Items */}
              {importTarget === 'items' && parsedPreviewItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Pratinjau Data Barang ({parsedPreviewItems.length} baris terdeteksi):
                    </span>
                    <span className="text-[11px] text-muted-foreground">Menampilkan 5 baris pertama</span>
                  </div>
                  <div className="border border-border rounded-xl overflow-x-auto max-h-48">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-muted/50 border-b border-border sticky top-0 text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2">Kode</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2">Kategori</th>
                          <th className="p-2 text-right">Saldo Fisik</th>
                          <th className="p-2">Satuan</th>
                          <th className="p-2">Lokasi Rak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsedPreviewItems.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2 font-mono font-medium text-foreground">{row.kodeBarang}</td>
                            <td className="p-2 font-medium text-foreground">{row.namaBarang}</td>
                            <td className="p-2 text-muted-foreground">{row.kategori}</td>
                            <td className="p-2 text-right font-mono font-bold text-foreground">
                              {row.saldoAwal ?? row.sisaStok}
                            </td>
                            <td className="p-2 font-mono text-muted-foreground">{row.satuan}</td>
                            <td className="p-2 text-muted-foreground">{row.lokasiRak}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Preview Table: Mutations */}
              {importTarget === 'mutations' && parsedPreviewMutations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Pratinjau Mutasi Transaksi ({parsedPreviewMutations.length} baris terdeteksi):
                    </span>
                    <span className="text-[11px] text-muted-foreground">Menampilkan 5 baris pertama</span>
                  </div>
                  <div className="border border-border rounded-xl overflow-x-auto max-h-48">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-muted/50 border-b border-border sticky top-0 text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2 text-center">Jenis</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2">No. Dokumen</th>
                          <th className="p-2">Tujuan / Sumber</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parsedPreviewMutations.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2 whitespace-nowrap text-muted-foreground">{row.tanggal}</td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.jenis === 'MASUK'
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {row.jenis}
                              </span>
                            </td>
                            <td className="p-2 font-medium text-foreground">{row.namaBarang}</td>
                            <td className="p-2 text-right font-mono font-bold text-foreground">
                              {row.qty} {row.satuan}
                            </td>
                            <td className="p-2 font-mono text-muted-foreground">{row.noDokumenRef}</td>
                            <td className="p-2 text-muted-foreground">{row.sumberAtauTujuan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20 shrink-0">
              <span className="text-[11px] text-muted-foreground">
                Gudang Somber Balikpapan &bull; Budi Agustiansyah
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmitting ||
                    (importTarget === 'items' && parsedPreviewItems.length === 0) ||
                    (importTarget === 'mutations' && parsedPreviewMutations.length === 0)
                  }
                  onClick={handleConfirmImport}
                  className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="size-3.5" />
                  <span>
                    {isSubmitting
                      ? 'Menyimpan...'
                      : `Terapkan Impor (${
                          importTarget === 'items' ? parsedPreviewItems.length : parsedPreviewMutations.length
                        } Data)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH SKU BARU                                                   */}
      {/* ========================================================================= */}
      {isAddSkuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in-50 duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Boxes className="size-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Tambah SKU Barang Baru ke Gudang Somber</h3>
              </div>
              <button
                onClick={() => setIsAddSkuModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewSku} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Kode Barang (SKU) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: LUB-MED-040"
                    value={newSkuForm.kodeBarang}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, kodeBarang: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs uppercase font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Kategori Barang <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newSkuForm.kategori}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, kategori: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {WAREHOUSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Lengkap Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: FILTER OLI YANMAR 6AYM-ETE (152623-35150)"
                  value={newSkuForm.namaBarang}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, namaBarang: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Satuan Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: DRUM, PCS, ROLL"
                    value={newSkuForm.satuan}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, satuan: e.target.value.toUpperCase() })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs uppercase font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Saldo Awal Fisik
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newSkuForm.saldoAwal}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, saldoAwal: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSkuForm.minStock}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, minStock: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Lokasi Rak di Somber
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Rak Suku Cadang A-03 Somber"
                    value={newSkuForm.lokasiRak}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, lokasiRak: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Estimasi Harga Satuan (IDR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newSkuForm.hargaSatuanPerkiraan}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, hargaSatuanPerkiraan: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Keterangan Tambahan / Spesifikasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Kompatibel dengan mesin induk Yanmar / TB CPG"
                  value={newSkuForm.keterangan}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, keterangan: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSkuModalOpen(false)}
                  className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CETAK SLIP BUKTI MUTASI GUDANG (PRINTABLE)                        */}
      {/* ========================================================================= */}
      {selectedSlipMutation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in-50 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">
                  Cetak Bukti Transaksi Gudang Pusat Somber
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Cetak / Print</span>
                </button>
                <button
                  onClick={() => setSelectedSlipMutation(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-6 md:p-8 overflow-y-auto bg-white text-black font-sans text-xs space-y-4">
              {/* Kop Surat */}
              <div className="border-b-2 border-black pb-3 flex items-start justify-between">
                <div>
                  <div className="font-extrabold text-base tracking-wide text-black">
                    PT. CINDARA PRATAMA LINES &amp; GROUP
                  </div>
                  <div className="text-[11px] font-semibold text-gray-700">
                    DEPARTEMEN LOGISTIK &amp; PERGUDANGAN PUSAT SOMBER
                  </div>
                  <p className="text-[10px] text-gray-600">
                    Jl. Somber RT. 38, Batu Ampar, Balikpapan Utara, Kalimantan Timur &bull; Telp / WA: 08115986581
                  </p>
                </div>
                <div className="text-right">
                  <div className="border border-black px-2 py-1 text-center font-bold text-[10px] uppercase">
                    {selectedSlipMutation.jenis === 'MASUK'
                      ? 'BUKTI PENERIMAAN BARANG GUDANG'
                      : 'BON PENGELUARAN BARANG GUDANG (BPBG)'}
                  </div>
                  <div className="font-mono text-[10px] font-bold mt-1">
                    No: {selectedSlipMutation.id}
                  </div>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <div>
                    <span className="text-gray-600">Tanggal Transaksi:</span>{' '}
                    <strong>{selectedSlipMutation.tanggal} ({selectedSlipMutation.waktu} WITA)</strong>
                  </div>
                  <div>
                    <span className="text-gray-600">Dokumen Acuan:</span>{' '}
                    <strong className="font-mono">{selectedSlipMutation.noDokumenRef}</strong>
                  </div>
                  <div>
                    <span className="text-gray-600">Entitas Perusahaan:</span>{' '}
                    <strong>{selectedSlipMutation.entitas}</strong>
                  </div>
                </div>
                <div>
                  <div>
                    <span className="text-gray-600">
                      {selectedSlipMutation.jenis === 'MASUK' ? 'Sumber / Supplier:' : 'Unit / Armada Tujuan:'}
                    </span>{' '}
                    <strong>{selectedSlipMutation.sumberAtauTujuan}</strong>
                  </div>
                  <div>
                    <span className="text-gray-600">Petugas Gudang:</span>{' '}
                    <strong>{selectedSlipMutation.picGudang}</strong>
                  </div>
                  <div>
                    <span className="text-gray-600">
                      {selectedSlipMutation.jenis === 'MASUK' ? 'Pengantar / Kurir:' : 'Penerima / Pengambil:'}
                    </span>{' '}
                    <strong>{selectedSlipMutation.picPenerimaPengambil}</strong>
                  </div>
                </div>
              </div>

              {/* Item Details Table */}
              <table className="w-full border-collapse border border-black text-[11px] my-3">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-center font-bold">
                    <th className="border border-black p-2 w-8">No</th>
                    <th className="border border-black p-2">Kode Barang</th>
                    <th className="border border-black p-2 text-left">Nama &amp; Spesifikasi Barang</th>
                    <th className="border border-black p-2">Kategori</th>
                    <th className="border border-black p-2 w-20">Jumlah</th>
                    <th className="border border-black p-2 w-16">Satuan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-2 text-center">1</td>
                    <td className="border border-black p-2 font-mono text-center">
                      {selectedSlipMutation.kodeBarang}
                    </td>
                    <td className="border border-black p-2">
                      <div className="font-bold">{selectedSlipMutation.namaBarang}</div>
                      <div className="text-[10px] text-gray-600">
                        Keperluan: {selectedSlipMutation.keperluan}
                      </div>
                    </td>
                    <td className="border border-black p-2 text-center">
                      {selectedSlipMutation.kategori}
                    </td>
                    <td className="border border-black p-2 text-center font-mono font-bold">
                      {selectedSlipMutation.qty}
                    </td>
                    <td className="border border-black p-2 text-center uppercase">
                      {selectedSlipMutation.satuan}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Notes */}
              <div className="text-[10px] text-gray-700 bg-gray-50 border border-gray-300 p-2.5 rounded">
                <strong>Catatan Gudang Somber:</strong> {selectedSlipMutation.catatan || 'Kondisi barang telah dicek fisik dalam keadaan baik dan lengkap.'}
              </div>

              {/* Signature Columns */}
              <div className="pt-6 grid grid-cols-3 gap-4 text-center text-[10px]">
                <div>
                  <p className="text-gray-600">Dikelola / Diserahkan Oleh:</p>
                  <div className="h-16 flex items-end justify-center font-bold">
                    Budi Agustiansyah
                  </div>
                  <p className="text-[9px] text-gray-500 border-t border-gray-300 pt-1 mt-1">
                    Staf Gudang Somber (MP-DAO-0281)
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">Diterima / Diambil Oleh:</p>
                  <div className="h-16 flex items-end justify-center font-bold">
                    {selectedSlipMutation.picPenerimaPengambil || '( .......................... )'}
                  </div>
                  <p className="text-[9px] text-gray-500 border-t border-gray-300 pt-1 mt-1">
                    Kru Kapal / Mandor Penerima
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">Mengetahui (Head of Logistic):</p>
                  <div className="h-16 flex items-end justify-center font-bold">
                    ( .......................... )
                  </div>
                  <p className="text-[9px] text-gray-500 border-t border-gray-300 pt-1 mt-1">
                    Supervisor / Dept. Head
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/30 shrink-0">
              <span className="text-[11px] text-muted-foreground font-mono">
                ID Dokumen: {selectedSlipMutation.id}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSlipMutation(null)}
                className="h-8 px-4 rounded-lg bg-foreground text-background font-semibold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
