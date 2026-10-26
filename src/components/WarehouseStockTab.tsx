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
import {
  saveLocalWarehouseData,
  loadLocalWarehouseData,
} from '@/utils/warehouseStorage';
import { calculateWarehouseSummary } from '@/data/initialWarehouseData';

interface WarehouseStockTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type ViewMode = 'kartu-stok' | 'form-masuk' | 'form-keluar' | 'riwayat-mutasi';

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

export default function WarehouseStockTab({ showToast }: WarehouseStockTabProps) {
  const [items, setItems] = useState<WarehouseStockItem[]>([]);
  const [mutations, setMutations] = useState<WarehouseMutation[]>([]);
  const [summary, setSummary] = useState<WarehouseSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active View
  const [activeView, setActiveView] = useState<ViewMode>('kartu-stok');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMutationType, setSelectedMutationType] = useState<string>('ALL');

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

    // Background fetch to sync with server API
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

  // Helper to open Inbound Form with pre-selected item
  const handleOpenInboundForItem = (item: WarehouseStockItem) => {
    setInboundForm((prev) => ({
      ...prev,
      itemId: item.id,
      noDokumenRef: '',
      sumberAtauTujuan: '',
    }));
    setActiveView('form-masuk');
  };

  // Helper to open Outbound Form with pre-selected item
  const handleOpenOutboundForItem = (item: WarehouseStockItem) => {
    setOutboundForm((prev) => ({
      ...prev,
      itemId: item.id,
      noDokumenRef: '',
      qty: 1,
    }));
    setActiveView('form-keluar');
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
        setActiveView('riwayat-mutasi');
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
        setActiveView('riwayat-mutasi');
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

      const wb = XLSX.utils.book_new();
      const wsStock = XLSX.utils.json_to_sheet(stockExport);
      const wsMut = XLSX.utils.json_to_sheet(mutationExport);

      XLSX.utils.book_append_sheet(wb, wsStock, 'Kartu Stok Gudang');
      XLSX.utils.book_append_sheet(wb, wsMut, 'Riwayat Mutasi');

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

        // Check if there is a specific sheet name matching import target
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
          // Parse as Stock Items
          const mappedItems: Partial<WarehouseStockItem>[] = [];

          rawJson.forEach((row) => {
            // Smart column search
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

            if (!kode && !nama) return; // Skip empty row

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
          // Parse as Mutations
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
        if (importTarget === 'items') {
          setActiveView('kartu-stok');
        } else {
          setActiveView('riwayat-mutasi');
        }
      } else {
        showToast?.(data.error || 'Gagal menyimpan data impor.', 'error');
      }
    } catch {
      showToast?.('Terjadi kesalahan jaringan saat menyimpan data impor.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Items for Stock Card
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.kodeBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.lokasiRak.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' || item.kategori === selectedCategory;

      const matchStatus =
        selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  // Filtered Mutations for Ledger
  const filteredMutations = useMemo(() => {
    return mutations.filter((m) => {
      const matchSearch =
        !searchQuery ||
        m.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.kodeBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.noDokumenRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sumberAtauTujuan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.picPenerimaPengambil.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType =
        selectedMutationType === 'ALL' || m.jenis === selectedMutationType;

      return matchSearch && matchType;
    });
  }, [mutations, searchQuery, selectedMutationType]);

  // Selected item detail for forms
  const selectedInboundItem = useMemo(() => {
    return items.find((i) => i.id === inboundForm.itemId);
  }, [items, inboundForm.itemId]);

  const selectedOutboundItem = useMemo(() => {
    return items.find((i) => i.id === outboundForm.itemId);
  }, [items, outboundForm.itemId]);

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
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Pengendalian persediaan fisik, penerimaan barang PO masuk &amp; mutasi pengeluaran ke armada kapal
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

        {/* Action Header Buttons & Subtab Switcher */}
        <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
          {/* Subnav Pills */}
          <div className="flex items-center gap-1.5 bg-muted/70 p-1 rounded-xl overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveView('kartu-stok')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                activeView === 'kartu-stok'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Boxes className="size-3.5" />
              <span>Kartu Stok &amp; Saldo</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted-foreground/10 text-muted-foreground font-mono">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveView('form-masuk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                activeView === 'form-masuk'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <PackagePlus className="size-3.5" />
              <span>Penerimaan Masuk (+)</span>
            </button>

            <button
              onClick={() => setActiveView('form-keluar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                activeView === 'form-keluar'
                  ? 'bg-amber-600 text-white shadow-xs font-semibold'
                  : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <PackageMinus className="size-3.5" />
              <span>Pengambilan Keluar (-)</span>
            </button>

            <button
              onClick={() => setActiveView('riwayat-mutasi')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                activeView === 'riwayat-mutasi'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5" />
              <span>Jurnal Riwayat Mutasi</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted-foreground/10 text-muted-foreground font-mono">
                {mutations.length}
              </span>
            </button>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Tambah SKU Manual */}
            <button
              onClick={() => setIsAddSkuModalOpen(true)}
              className="h-8.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Tambah SKU Baru</span>
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
              title="Unduh Rekap Excel Lengkap (Kartu Stok & Riwayat Mutasi)"
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
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total SKU Barang</span>
            <Boxes className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1.5 font-mono">
            {summary?.totalSKU || items.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Katalog Terdaftar</div>
        </div>

        {/* Total Unit Fisik */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Stok Fisik Tersedia</span>
            <Building2 className="size-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1.5 font-mono">
            {summary?.totalFisikUnit?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Unit di Gudang Somber</div>
        </div>

        {/* Transaksi Masuk */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Penerimaan Masuk</span>
            <ArrowDownRight className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono">
            +{summary?.totalQtyMasuk || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary?.totalTransaksiMasuk || 0} Bukti Masuk
          </div>
        </div>

        {/* Transaksi Keluar */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Pengambilan Keluar</span>
            <ArrowUpRight className="size-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
            -{summary?.totalQtyKeluar || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary?.totalTransaksiKeluar || 0} Mutasi Armada
          </div>
        </div>

        {/* Stok Menipis */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Stok Menipis</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
            {summary?.itemLowStock || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Mendekati Batas Minimum</div>
        </div>

        {/* Stok Habis */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Stok Habis</span>
            <AlertOctagon className="size-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5 font-mono">
            {summary?.itemOutOfStock || 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Perlu Order PO Baru</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: KARTU STOK & SALDO FISIK                                         */}
      {/* ========================================================================= */}
      {activeView === 'kartu-stok' && (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/20">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama barang, kode SKU, atau lokasi rak..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">Semua Status Stok</option>
                <option value="AMAN">🟢 Aman</option>
                <option value="MENIPIS">🟡 Menipis (Low Stock)</option>
                <option value="HABIS">🔴 Habis (Out of Stock)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3.5">Kode &amp; Nama Barang</th>
                  <th className="py-3 px-3.5">Kategori</th>
                  <th className="py-3 px-3.5">Lokasi Rak Somber</th>
                  <th className="py-3 px-3.5 text-right">Min. Stok</th>
                  <th className="py-3 px-3.5 text-right">Saldo Awal</th>
                  <th className="py-3 px-3.5 text-right text-emerald-600 dark:text-emerald-400">Masuk (+)</th>
                  <th className="py-3 px-3.5 text-right text-amber-600 dark:text-amber-400">Keluar (-)</th>
                  <th className="py-3 px-3.5 text-right font-bold text-foreground">Sisa Stok Fisik</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Boxes className="size-8 text-muted-foreground/40" />
                        <p className="font-medium">Tidak ada barang yang cocok dengan kriteria pencarian.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="py-3 px-3.5 text-center text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.namaBarang}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                          <span className="font-medium text-foreground/80">{item.kodeBarang}</span>
                          <span>&bull;</span>
                          <span>Satuan: <strong className="text-foreground">{item.satuan}</strong></span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-muted-foreground whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-foreground/80">
                          <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{item.lokasiRak}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-foreground">
                        {item.minStock} {item.satuan}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-muted-foreground">
                        {item.saldoAwal}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{item.totalMasuk}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
                        -{item.totalKeluar}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-mono font-bold text-sm text-foreground">
                          {item.sisaStok} <span className="text-[10px] text-muted-foreground font-normal">{item.satuan}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
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
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenInboundForItem(item)}
                            className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition cursor-pointer"
                            title={`Catat Penerimaan Masuk untuk ${item.namaBarang}`}
                          >
                            <PackagePlus className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenOutboundForItem(item)}
                            disabled={item.sisaStok <= 0}
                            className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              item.sisaStok > 0
                                ? `Catat Pengeluaran untuk ${item.namaBarang}`
                                : 'Stok habis, tidak bisa dikeluarkan'
                            }
                          >
                            <PackageMinus className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Menampilkan <strong>{filteredItems.length}</strong> dari <strong>{items.length}</strong> barang terdaftar</span>
            <span className="font-mono text-[11px]">Gudang Pusat Somber &bull; PIC: Pak Budi</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FORM PENERIMAAN MASUK (+ INBOUND)                                */}
      {/* ========================================================================= */}
      {activeView === 'form-masuk' && (
        <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <PackagePlus className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Form Pencatatan Penerimaan Barang Masuk</h2>
                <p className="text-xs text-muted-foreground">
                  Catat barang masuk dari Supplier / PO Pengadaan / Retur Armada ke Gudang Somber
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('kartu-stok')}
              className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              Kembali ke Stok
            </button>
          </div>

          <form onSubmit={handleSubmitInbound} className="p-5 md:p-6 space-y-4">
            {/* Barang Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Pilih Barang Persediaan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={inboundForm.itemId}
                onChange={(e) => setInboundForm({ ...inboundForm, itemId: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">-- Pilih Barang dari Gudang --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.kodeBarang}] {i.namaBarang} (Stok Saat Ini: {i.sisaStok} {i.satuan}) - {i.lokasiRak}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Live Preview */}
            {selectedInboundItem && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">{selectedInboundItem.namaBarang}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Kode: <span className="font-mono font-semibold">{selectedInboundItem.kodeBarang}</span> &bull; Lokasi: {selectedInboundItem.lokasiRak}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Saldo Saat Ini</div>
                  <div className="font-mono font-bold text-sm text-foreground">
                    {selectedInboundItem.sisaStok} {selectedInboundItem.satuan}
                  </div>
                </div>
              </div>
            )}

            {/* Grid 2 Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Jumlah Qty Masuk <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={inboundForm.qty}
                    onChange={(e) => setInboundForm({ ...inboundForm, qty: Number(e.target.value) })}
                    className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="px-3 h-10 rounded-lg border border-border bg-muted flex items-center text-xs font-semibold text-muted-foreground">
                    {selectedInboundItem ? selectedInboundItem.satuan : 'SATUAN'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  No. Dokumen Acuan (PO / FSTB / Surat Jalan) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PO-CPG-26-002199 atau SJ-SUPPLIER-123"
                  value={inboundForm.noDokumenRef}
                  onChange={(e) => setInboundForm({ ...inboundForm, noDokumenRef: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Sumber Pengirim / Nama Supplier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT. Sumber Sarana Maritim / PT. Pertamina"
                  value={inboundForm.sumberAtauTujuan}
                  onChange={(e) => setInboundForm({ ...inboundForm, sumberAtauTujuan: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Kurir / Supir Pengantar
                </label>
                <input
                  type="text"
                  placeholder="Nama pengantar / ekspedisi"
                  value={inboundForm.picPenerimaPengambil}
                  onChange={(e) => setInboundForm({ ...inboundForm, picPenerimaPengambil: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tanggal &amp; Jam Penerimaan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={inboundForm.tanggal}
                    onChange={(e) => setInboundForm({ ...inboundForm, tanggal: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="time"
                    required
                    value={inboundForm.waktu}
                    onChange={(e) => setInboundForm({ ...inboundForm, waktu: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Petugas Penerima Gudang
                </label>
                <input
                  type="text"
                  disabled
                  value={inboundForm.picGudang}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Catatan Penerimaan / Kondisi Kemasan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Barang diterima kondisi baik dan segel utuh, disimpan di Pallet A-02 Somber."
                value={inboundForm.catatan}
                onChange={(e) => setInboundForm({ ...inboundForm, catatan: e.target.value })}
                className="w-full p-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Calculations preview */}
            {selectedInboundItem && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between">
                <span>Saldo Baru Setelah Penerimaan:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedInboundItem.sisaStok} + {inboundForm.qty} = {selectedInboundItem.sisaStok + inboundForm.qty} {selectedInboundItem.satuan}
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveView('kartu-stok')}
                className="h-10 px-4 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <PackagePlus className="size-4" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan Masuk'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: FORM PENGAMBILAN KELUAR (- OUTBOUND)                             */}
      {/* ========================================================================= */}
      {activeView === 'form-keluar' && (
        <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                <PackageMinus className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Form Pencatatan Pengeluaran Barang Keluar</h2>
                <p className="text-xs text-muted-foreground">
                  Catat pengeluaran barang dari Stok Pak Budi ke Armada Kapal / Bengkel MTC Somber
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('kartu-stok')}
              className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              Kembali ke Stok
            </button>
          </div>

          <form onSubmit={handleSubmitOutbound} className="p-5 md:p-6 space-y-4">
            {/* Barang Selector */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Pilih Barang yang Dikeluarkan <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={outboundForm.itemId}
                onChange={(e) => setOutboundForm({ ...outboundForm, itemId: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Pilih Barang dari Stok Gudang --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.sisaStok <= 0}>
                    [{i.kodeBarang}] {i.namaBarang} (Tersedia: {i.sisaStok} {i.satuan}) {i.sisaStok <= 0 ? ' - [HABIS]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Live Preview */}
            {selectedOutboundItem && (
              <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">{selectedOutboundItem.namaBarang}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Kode: <span className="font-mono font-semibold">{selectedOutboundItem.kodeBarang}</span> &bull; Lokasi: {selectedOutboundItem.lokasiRak}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">Stok Tersedia Saat Ini</div>
                  <div className={`font-mono font-bold text-sm ${selectedOutboundItem.sisaStok <= 0 ? 'text-rose-600' : 'text-foreground'}`}>
                    {selectedOutboundItem.sisaStok} {selectedOutboundItem.satuan}
                  </div>
                </div>
              </div>
            )}

            {/* Grid 2 Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Jumlah Qty Keluar <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedOutboundItem ? selectedOutboundItem.sisaStok : 9999}
                    required
                    value={outboundForm.qty}
                    onChange={(e) => setOutboundForm({ ...outboundForm, qty: Number(e.target.value) })}
                    className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="px-3 h-10 rounded-lg border border-border bg-muted flex items-center text-xs font-semibold text-muted-foreground">
                    {selectedOutboundItem ? selectedOutboundItem.satuan : 'SATUAN'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  No. TTB / FPB / Bon Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TTB-CPL-26-004390 atau FPB-HL-26-000850"
                  value={outboundForm.noDokumenRef}
                  onChange={(e) => setOutboundForm({ ...outboundForm, noDokumenRef: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Armada Kapal / Unit Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={outboundForm.sumberAtauTujuan}
                  onChange={(e) => setOutboundForm({ ...outboundForm, sumberAtauTujuan: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Pilih Armada / Unit --</option>
                  {FLEET_VESSELS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Kru Penerima / Pengambil <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chief Eng. Bambang / Mualim 1 Hendra"
                  value={outboundForm.picPenerimaPengambil}
                  onChange={(e) => setOutboundForm({ ...outboundForm, picPenerimaPengambil: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tanggal &amp; Jam Pengeluaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={outboundForm.tanggal}
                    onChange={(e) => setOutboundForm({ ...outboundForm, tanggal: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="time"
                    required
                    value={outboundForm.waktu}
                    onChange={(e) => setOutboundForm({ ...outboundForm, waktu: e.target.value })}
                    className="h-10 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Petugas Gudang Penyerah
                </label>
                <input
                  type="text"
                  disabled
                  value={outboundForm.picGudang}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Alasan / Keperluan Pengambilan
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Maintenance berkala kamar mesin kapal atau penggantian darurat di dermaga."
                value={outboundForm.keperluan}
                onChange={(e) => setOutboundForm({ ...outboundForm, keperluan: e.target.value })}
                className="w-full p-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Calculations preview */}
            {selectedOutboundItem && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between">
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

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveView('kartu-stok')}
                className="h-10 px-4 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (selectedOutboundItem && selectedOutboundItem.sisaStok < outboundForm.qty)}
                className="h-10 px-6 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <PackageMinus className="size-4" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Keluarkan Barang'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: JURNAL RIWAYAT MUTASI LENGKAP                                    */}
      {/* ========================================================================= */}
      {activeView === 'riwayat-mutasi' && (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/20">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari transaksi, no. dokumen, kapal tujuan, atau penerima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Filter by Type */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMutationType('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedMutationType === 'ALL'
                    ? 'bg-foreground text-background font-semibold'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Semua Mutasi ({mutations.length})
              </button>
              <button
                onClick={() => setSelectedMutationType('MASUK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  selectedMutationType === 'MASUK'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                }`}
              >
                <ArrowDownRight className="size-3.5" />
                <span>Masuk (+)</span>
              </button>
              <button
                onClick={() => setSelectedMutationType('KELUAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  selectedMutationType === 'KELUAR'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                <ArrowUpRight className="size-3.5" />
                <span>Keluar (-)</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 w-12 text-center">No</th>
                  <th className="py-3 px-3.5">Waktu &amp; ID Mutasi</th>
                  <th className="py-3 px-3.5 text-center">Jenis</th>
                  <th className="py-3 px-3.5">Nama &amp; Kode Barang</th>
                  <th className="py-3 px-3.5 text-right">Jumlah Qty</th>
                  <th className="py-3 px-3.5 text-center">Mutasi Saldo</th>
                  <th className="py-3 px-3.5">Dokumen Acuan</th>
                  <th className="py-3 px-3.5">Tujuan / Sumber Unit</th>
                  <th className="py-3 px-3.5">Penerima / Pengambil</th>
                  <th className="py-3 px-3.5 text-center">Cetak Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMutations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Layers className="size-8 text-muted-foreground/40" />
                        <p className="font-medium">Belum ada riwayat mutasi yang tercatat.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMutations.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3.5 text-center text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground font-mono text-[11px]">{m.id}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{m.tanggal}</span>
                          <span>&bull;</span>
                          <span>{m.waktu} WITA</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {m.jenis === 'MASUK' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <ArrowDownRight className="size-3" />
                            MASUK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <ArrowUpRight className="size-3" />
                            KELUAR
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-foreground">{m.namaBarang}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{m.kodeBarang}</div>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-sm ${
                            m.jenis === 'MASUK'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {m.jenis === 'MASUK' ? `+${m.qty}` : `-${m.qty}`} {m.satuan}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap font-mono text-[11px]">
                        <span className="text-muted-foreground">{m.saldoSebelum}</span>
                        <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                        <span className="font-bold text-foreground">{m.saldoSesudah}</span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-foreground font-medium">{m.noDokumenRef}</div>
                        <div className="text-[10px] text-muted-foreground">{m.keperluan}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {m.jenis === 'KELUAR' ? (
                            <Anchor className="size-3 text-muted-foreground" />
                          ) : (
                            <Building2 className="size-3 text-muted-foreground" />
                          )}
                          <span>{m.sumberAtauTujuan}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-medium text-foreground">{m.picPenerimaPengambil}</div>
                        <div className="text-[10px] text-muted-foreground">Petugas: Pak Budi</div>
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedSlipMutation(m)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
                          title="Cetak Bukti Transaksi Gudang"
                        >
                          <Printer className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Total <strong>{filteredMutations.length}</strong> transaksi mutasi tercatat</span>
            <span className="font-mono text-[11px]">Audit Trail Gudang Somber &bull; Pak Budi Agustiansyah</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPOR FILE EXCEL / CSV                                            */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
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
                      <span>Jurnal Riwayat Mutasi</span>
                    </button>
                  </div>
                </div>

                {/* Download Template Button */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="h-8.5 px-3 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Download className="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Unduh Template Excel Resmi</span>
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
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-amber-500/10 text-amber-600'
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
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
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
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="PCS / DRUM / SET"
                    value={newSkuForm.satuan}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, satuan: e.target.value })}
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
                    Batas Min. Stok
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
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
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
                  <h1 className="text-sm font-extrabold tracking-tight uppercase">
                    PT CINDARA PRATAMA LINES &amp; GROUP
                  </h1>
                  <p className="text-[10px] text-gray-700">
                    DIVISI LOGISTIK &amp; PENGENDALIAN PERSEDIAAN GUDANG PUSAT SOMBER
                  </p>
                  <p className="text-[9px] text-gray-500">
                    Jl. Somber RT. 08, Balikpapan Barat, Kalimantan Timur &bull; Telp / WA: 08115986581
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
                  <div className="h-16 flex items-center justify-center font-bold text-gray-400 italic">
                    [Tanda Tangan]
                  </div>
                  <p className="font-bold border-t border-black pt-1">
                    BUDI AGUSTIANSYAH
                  </p>
                  <p className="text-[9px] text-gray-500">Staf Gudang Somber</p>
                </div>

                <div>
                  <p className="text-gray-600">
                    {selectedSlipMutation.jenis === 'MASUK' ? 'Diantar Oleh:' : 'Diterima Oleh Kru Kapal:'}
                  </p>
                  <div className="h-16 flex items-center justify-center font-bold text-gray-400 italic">
                    [Tanda Tangan]
                  </div>
                  <p className="font-bold border-t border-black pt-1 uppercase">
                    {selectedSlipMutation.picPenerimaPengambil || 'KRU KAPAL'}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {selectedSlipMutation.sumberAtauTujuan}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">Mengetahui / Menyetujui:</p>
                  <div className="h-16 flex items-center justify-center font-bold text-gray-400 italic">
                    [Tanda Tangan]
                  </div>
                  <p className="font-bold border-t border-black pt-1">
                    KEPALA LOGISTIK / PURCHASING
                  </p>
                  <p className="text-[9px] text-gray-500">PT Cindara Pratama Lines</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
