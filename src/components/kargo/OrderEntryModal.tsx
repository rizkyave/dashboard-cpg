import React, { useState, useId } from 'react';
import {
  X,
  Plus,
  Package,
  Truck,
  MapPin,
  Phone,
  User,
  Calculator,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { CargoShipment, CargoServiceType, CargoStatus } from '@/types/kargo';

interface OrderEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shipment: CargoShipment) => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const KOTA_PILIHAN = [
  'Jakarta',
  'Surabaya',
  'Balikpapan',
  'Banjarmasin',
  'Samarinda',
  'Makassar',
  'Batam',
  'Medan',
  'Pontianak',
  'Palembang',
  'Semarang',
  'Bandung',
  'Denpasar',
  'Manado',
  'Tarakan',
];

const JENIS_BARANG_PILIHAN = [
  'General Cargo / Barang Umum',
  'Sparepart Mesin Kapal / Heavy Equipment',
  'Pelumas & Cairan Non-Hazardous',
  'Dokumen Penting / Legalitas Tender',
  'Elektronik & Perangkat Kantor',
  'Bahan Makanan / Sembako Kering',
  'Peralatan Safety & APD',
  'Tali Tros & Perlengkapan Tambat',
];

export default function OrderEntryModal({
  isOpen,
  onClose,
  onSave,
  showToast,
}: OrderEntryModalProps) {
  // Generate random 5-digit resi initial
  const generateNewResi = () => `CRG-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const [resi, setResi] = useState<string>(generateNewResi);
  const [tglOrder, setTglOrder] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Pengirim
  const [namaPengirim, setNamaPengirim] = useState('');
  const [telpPengirim, setTelpPengirim] = useState('');
  const [alamatPengirim, setAlamatPengirim] = useState('');
  const [kotaPengirim, setKotaPengirim] = useState('Jakarta');

  // Penerima
  const [namaPenerima, setNamaPenerima] = useState('');
  const [telpPenerima, setTelpPenerima] = useState('');
  const [alamatPenerima, setAlamatPenerima] = useState('');
  const [kotaPenerima, setKotaPenerima] = useState('Balikpapan');

  // Barang
  const [jenisBarang, setJenisBarang] = useState(JENIS_BARANG_PILIHAN[0]);
  const [beratKg, setBeratKg] = useState<number>(25);
  const [panjangCm, setPanjangCm] = useState<number>(40);
  const [lebarCm, setLebarCm] = useState<number>(30);
  const [tinggiCm, setTinggiCm] = useState<number>(20);
  const [koli, setKoli] = useState<number>(1);
  const [keteranganBarang, setKeteranganBarang] = useState('');

  // Layanan & Biaya
  const [layanan, setLayanan] = useState<CargoServiceType>('Reguler');
  const [status, setStatus] = useState<CargoStatus>('Draft');
  const [customOngkir, setCustomOngkir] = useState<string>('');

  // PIC Penugasan (Tahap 1 s.d. 3)
  const [picSales, setPicSales] = useState('Admin Sales');
  // Aturan Mutlak: PIC Tahap 2 & Tahap 3 harus SINKRON
  const [sharedPicPurchasingFstb, setSharedPicPurchasingFstb] = useState('NOOR HASANAH');

  // Hitung volume CBM
  const volumeCbm = Math.round(((panjangCm * lebarCm * tinggiCm) / 1000000) * 1000) / 1000;

  // Estimasi ongkir otomatis
  const hitungTarifOtomatis = () => {
    let tarifPerKg = 15000;
    if (layanan === 'Express') tarifPerKg = 35000;
    else if (layanan === 'Kargo Darat') tarifPerKg = 9000;
    else if (layanan === 'Kargo Laut') tarifPerKg = 7500;

    // Berat volumetrik kargo (P x L x T / 5000)
    const beratVolumetrik = Math.round((panjangCm * lebarCm * tinggiCm) / 5000);
    const chargeableWeight = Math.max(beratKg, beratVolumetrik);
    return Math.max(75000, chargeableWeight * tarifPerKg);
  };

  const calculatedOngkir = customOngkir ? Number(customOngkir) : hitungTarifOtomatis();
  const calculatedBiayaOps = Math.round(calculatedOngkir * 0.65);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!namaPengirim.trim() || !namaPenerima.trim()) {
      showToast?.('Harap lengkapi nama pengirim dan nama penerima.', 'error');
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newShipment: CargoShipment = {
      id: resi,
      resi,
      tglOrder,
      pengirim: {
        nama: namaPengirim.trim(),
        telepon: telpPengirim.trim() || '-',
        alamat: alamatPengirim.trim() || '-',
        kota: kotaPengirim,
      },
      penerima: {
        nama: namaPenerima.trim(),
        telepon: telpPenerima.trim() || '-',
        alamat: alamatPenerima.trim() || '-',
        kotaTujuan: kotaPenerima,
      },
      barang: {
        jenis: jenisBarang,
        beratKg: Number(beratKg) || 1,
        panjangCm: Number(panjangCm) || 1,
        lebarCm: Number(lebarCm) || 1,
        tinggiCm: Number(tinggiCm) || 1,
        volumeCbm: volumeCbm || 0.01,
        koli: Number(koli) || 1,
        keterangan: keteranganBarang.trim(),
      },
      layanan,
      status,
      estimasiHari: layanan === 'Express' ? '1-2 Hari' : layanan === 'Kargo Laut' ? '4-7 Hari' : '3-5 Hari',
      ongkir: calculatedOngkir,
      biayaOperasional: calculatedBiayaOps,
      alurPic: {
        tahap1: {
          picSales: picSales.trim() || 'Admin Sales',
          tglFpb: tglOrder,
          noFpb: `FPB-CRG-26-${Math.floor(1000 + Math.random() * 9000)}`,
          catatan: 'Order baru via Order Entry Manager View',
          selesai: true,
        },
        tahap2: {
          picPurchasing: sharedPicPurchasingFstb.trim() || 'NOOR HASANAH',
          noBookingPo: `PO-BK-26-${Math.floor(100 + Math.random() * 900)}`,
          tglBooking: tglOrder,
          vendorArmada: `Armada Kargo ${layanan}`,
          selesai: status !== 'Draft',
        },
        tahap3: {
          picFstb: sharedPicPurchasingFstb.trim() || 'NOOR HASANAH', // SINKRON OTOMATIS
          noFstb: `CPL-FSTB-26-${Math.floor(10000 + Math.random() * 90000)}`,
          tglFstb: tglOrder,
          selesai: status !== 'Draft',
        },
        tahap4: {
          picTtb: '',
          noTtb: '',
          tglTtb: '',
          namaGudangHub: `Hub Transit ${kotaPengirim}`,
          selesai: false,
        },
        tahap5: {
          picKurirLap: '',
          tglDiterimaKurir: undefined,
          tglDiantar: undefined,
          namaPenerimaAkhir: undefined,
          selesai: false,
        },
        tahap6: {
          picFinance: 'Finance CPG',
          noInvoice: undefined,
          tglLunas: undefined,
          statusBayar: 'Belum Lunas',
          selesai: false,
        },
      },
      riwayatTracking: [
        {
          timestamp: nowStr,
          tahapIndex: 1,
          lokasi: `${kotaPengirim} Hub`,
          status: 'Order Dibuat & Resi Diterbitkan',
          keterangan: `Resi ${resi} resmi diterbitkan oleh ${picSales}.`,
          pic: picSales,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newShipment);
    showToast?.(`Resi baru ${resi} berhasil dibuat!`, 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Input Order Pengiriman Kargo Baru
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {resi}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Daftarkan pesanan kargo & kurir ke sistem operasional harian terpadu.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Tutup"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Baris 1: Nomor Resi & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Sparkles className="size-3.5 text-blue-500" />
                Nomor Resi Unik
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={resi}
                  onChange={(e) => setResi(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-mono text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setResi(generateNewResi())}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 whitespace-nowrap"
                  title="Generate Nomor Baru"
                >
                  Acak
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                Tanggal Order
              </label>
              <input
                type="date"
                value={tglOrder}
                onChange={(e) => setTglOrder(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Truck className="size-3.5 text-muted-foreground" />
                Jenis Layanan Kargo
              </label>
              <select
                value={layanan}
                onChange={(e) => setLayanan(e.target.value as CargoServiceType)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="Reguler">Reguler (3-5 Hari)</option>
                <option value="Express">Express (1-2 Hari)</option>
                <option value="Kargo Darat">Kargo Darat (Trucking FTL/LTL)</option>
                <option value="Kargo Laut">Kargo Laut (Kapal RoRo/Kontainer)</option>
              </select>
            </div>
          </div>

          {/* Baris 2: Data Pengirim & Penerima (2 Kolom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box Pengirim */}
            <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-500/5 space-y-3">
              <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                <User className="size-3.5" />
                Data Pengirim (Origin)
              </h3>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Nama Pengirim / Perusahaan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: PT Sumber Teknik Mandiri"
                  value={namaPengirim}
                  onChange={(e) => setNamaPengirim(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={telpPengirim}
                    onChange={(e) => setTelpPengirim(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Kota Asal
                  </label>
                  <select
                    value={kotaPengirim}
                    onChange={(e) => setKotaPengirim(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    {KOTA_PILIHAN.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Alamat Lengkap Pengirim
                </label>
                <textarea
                  rows={2}
                  placeholder="Jalan, nomor ruko/gudang, RT/RW..."
                  value={alamatPengirim}
                  onChange={(e) => setAlamatPengirim(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Box Penerima */}
            <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/40 bg-teal-500/5 space-y-3">
              <h3 className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5 uppercase tracking-wider">
                <MapPin className="size-3.5" />
                Data Penerima (Destination)
              </h3>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Nama Penerima / Unit Tujuan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Workshop CPG Balikpapan"
                  value={namaPenerima}
                  onChange={(e) => setNamaPenerima(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    No. Telepon / WA
                  </label>
                  <input
                    type="text"
                    placeholder="0852-xxxx-xxxx"
                    value={telpPenerima}
                    onChange={(e) => setTelpPenerima(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Kota Tujuan *
                  </label>
                  <select
                    value={kotaPenerima}
                    onChange={(e) => setKotaPenerima(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-teal-500"
                  >
                    {KOTA_PILIHAN.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Alamat Lengkap Tujuan Pengiriman
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat kantor dermaga/workshop atau jalan tujuan..."
                  value={alamatPenerima}
                  onChange={(e) => setAlamatPenerima(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Baris 3: Detail Barang & Dimensi */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Package className="size-3.5 text-blue-500" />
              Detail Fisik Barang Kargo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Jenis / Kategori Barang
                </label>
                <select
                  value={jenisBarang}
                  onChange={(e) => setJenisBarang(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
                >
                  {JENIS_BARANG_PILIHAN.map((jb) => (
                    <option key={jb} value={jb}>
                      {jb}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Jumlah Koli / Kemasan
                </label>
                <input
                  type="number"
                  min={1}
                  value={koli}
                  onChange={(e) => setKoli(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Berat Aktual (Kg)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={beratKg}
                  onChange={(e) => setBeratKg(Math.max(0.1, parseFloat(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Panjang (cm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={panjangCm}
                  onChange={(e) => setPanjangCm(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Lebar (cm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={lebarCm}
                  onChange={(e) => setLebarCm(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Tinggi (cm)
                </label>
                <input
                  type="number"
                  min={1}
                  value={tinggiCm}
                  onChange={(e) => setTinggiCm(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Total Volume
                </label>
                <div className="w-full px-3 py-1.5 rounded-lg bg-muted text-xs font-mono font-semibold flex items-center justify-between border border-border">
                  <span>{volumeCbm}</span>
                  <span className="text-[10px] text-muted-foreground">m³ (CBM)</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Keterangan Khusus / Spesifikasi / Part Number
              </label>
              <input
                type="text"
                placeholder="Contoh: Piston ring main engine, barang rentan benturan / simpan di tempat kering"
                value={keteranganBarang}
                onChange={(e) => setKeteranganBarang(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>
          </div>

          {/* Baris 4: Penugasan PIC & Alur Logistik 6-Fase (SINKRONISASI TAHAP 2 & 3) */}
          <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="size-3.5" />
                Penugasan PIC & Alur Operasional (Tahap 1, 2 & 3)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 font-semibold">
                Aturan: PIC Tahap 2 & 3 Sinkron
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  PIC Tahap 1 (Admin / Sales Pembuat Order)
                </label>
                <input
                  type="text"
                  value={picSales}
                  onChange={(e) => setPicSales(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  PIC Tahap 2 (Purchasing/Booking) & Tahap 3 (FSTB) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={sharedPicPurchasingFstb}
                    onChange={(e) => setSharedPicPurchasingFstb(e.target.value)}
                    placeholder="Contoh: NOOR HASANAH atau MELINDA"
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 block italic">
                    * Otomatis terpasang untuk Card 2 (Booking PO) dan Card 3 (FSTB) karena dikerjakan oleh orang yang sama.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Baris 5: Biaya & Tarif */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Calculator className="size-5" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Total Ongkos Kirim (Tarif Kargo)</span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  Rp {calculatedOngkir.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Estimasi Biaya Operasional: Rp {calculatedBiayaOps.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Override Tarif (Rp):</label>
              <input
                type="number"
                placeholder="Otomatis"
                value={customOngkir}
                onChange={(e) => setCustomOngkir(e.target.value)}
                className="w-36 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono font-semibold"
              />
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="size-4" />
              Simpan & Terbitkan Resi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

