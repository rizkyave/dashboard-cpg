import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  FileText,
  Boxes,
  Truck,
  Building,
  CheckCircle2,
  Save,
  Link,
  ShieldCheck,
} from 'lucide-react';
import { CargoShipment, CargoStatus } from '@/types/kargo';

interface KargoWorkflowModalProps {
  shipment: CargoShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedShipment: CargoShipment) => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function KargoWorkflowModal({
  shipment,
  isOpen,
  onClose,
  onUpdate,
  showToast,
}: KargoWorkflowModalProps) {
  if (!isOpen || !shipment) return null;

  // Local state for each phase
  const [currentStatus, setCurrentStatus] = useState<CargoStatus>(shipment.status);

  // Tahap 1: Sales / Order
  const [picSales, setPicSales] = useState(shipment.alurPic.tahap1.picSales);
  const [noFpb, setNoFpb] = useState(shipment.alurPic.tahap1.noFpb);
  const [tglFpb, setTglFpb] = useState(shipment.alurPic.tahap1.tglFpb);
  const [tahap1Done, setTahap1Done] = useState(shipment.alurPic.tahap1.selesai);

  // Tahap 2 & 3: Purchasing / Booking & FSTB (SINKRON SECARA MUTLAK)
  const initialSharedPic =
    shipment.alurPic.tahap2.picPurchasing || shipment.alurPic.tahap3.picFstb || 'NOOR HASANAH';
  const [sharedPicPurchasingFstb, setSharedPicPurchasingFstb] = useState(initialSharedPic);

  // Detail Tahap 2 (Booking PO)
  const [noBookingPo, setNoBookingPo] = useState(shipment.alurPic.tahap2.noBookingPo);
  const [tglBooking, setTglBooking] = useState(shipment.alurPic.tahap2.tglBooking);
  const [vendorArmada, setVendorArmada] = useState(shipment.alurPic.tahap2.vendorArmada || '');
  const [tahap2Done, setTahap2Done] = useState(shipment.alurPic.tahap2.selesai);

  // Detail Tahap 3 (FSTB)
  const [noFstb, setNoFstb] = useState(shipment.alurPic.tahap3.noFstb);
  const [tglFstb, setTglFstb] = useState(shipment.alurPic.tahap3.tglFstb);
  const [tahap3Done, setTahap3Done] = useState(shipment.alurPic.tahap3.selesai);

  // Tahap 4: TTB Gudang Hub
  const [picTtb, setPicTtb] = useState(shipment.alurPic.tahap4.picTtb);
  const [noTtb, setNoTtb] = useState(shipment.alurPic.tahap4.noTtb);
  const [tglTtb, setTglTtb] = useState(shipment.alurPic.tahap4.tglTtb);
  const [namaGudangHub, setNamaGudangHub] = useState(shipment.alurPic.tahap4.namaGudangHub || '');
  const [tahap4Done, setTahap4Done] = useState(shipment.alurPic.tahap4.selesai);

  // Tahap 5: Kurir Lapangan
  const [picKurirLap, setPicKurirLap] = useState(shipment.alurPic.tahap5.picKurirLap);
  const [tglDiterimaKurir, setTglDiterimaKurir] = useState(shipment.alurPic.tahap5.tglDiterimaKurir || '');
  const [tglDiantar, setTglDiantar] = useState(shipment.alurPic.tahap5.tglDiantar || '');
  const [namaPenerimaAkhir, setNamaPenerimaAkhir] = useState(shipment.alurPic.tahap5.namaPenerimaAkhir || '');
  const [tahap5Done, setTahap5Done] = useState(shipment.alurPic.tahap5.selesai);

  // Tahap 6: Finance / Administrasi
  const [picFinance, setPicFinance] = useState(shipment.alurPic.tahap6.picFinance);
  const [noInvoice, setNoInvoice] = useState(shipment.alurPic.tahap6.noInvoice || '');
  const [statusBayar, setStatusBayar] = useState<'Belum Lunas' | 'Lunas'>(shipment.alurPic.tahap6.statusBayar);
  const [tahap6Done, setTahap6Done] = useState(shipment.alurPic.tahap6.selesai);

  // Catatan log event baru (opsional)
  const [newLogNote, setNewLogNote] = useState('');

  // Sinkronisasi otomatis nilai jika shipment props berubah
  useEffect(() => {
    if (shipment) {
      setCurrentStatus(shipment.status);
      setPicSales(shipment.alurPic.tahap1.picSales);
      setNoFpb(shipment.alurPic.tahap1.noFpb);
      setTglFpb(shipment.alurPic.tahap1.tglFpb);
      setTahap1Done(shipment.alurPic.tahap1.selesai);

      const syncPic = shipment.alurPic.tahap2.picPurchasing || shipment.alurPic.tahap3.picFstb || 'NOOR HASANAH';
      setSharedPicPurchasingFstb(syncPic);

      setNoBookingPo(shipment.alurPic.tahap2.noBookingPo);
      setTglBooking(shipment.alurPic.tahap2.tglBooking);
      setVendorArmada(shipment.alurPic.tahap2.vendorArmada || '');
      setTahap2Done(shipment.alurPic.tahap2.selesai);

      setNoFstb(shipment.alurPic.tahap3.noFstb);
      setTglFstb(shipment.alurPic.tahap3.tglFstb);
      setTahap3Done(shipment.alurPic.tahap3.selesai);

      setPicTtb(shipment.alurPic.tahap4.picTtb);
      setNoTtb(shipment.alurPic.tahap4.noTtb);
      setTglTtb(shipment.alurPic.tahap4.tglTtb);
      setNamaGudangHub(shipment.alurPic.tahap4.namaGudangHub || '');
      setTahap4Done(shipment.alurPic.tahap4.selesai);

      setPicKurirLap(shipment.alurPic.tahap5.picKurirLap);
      setTglDiterimaKurir(shipment.alurPic.tahap5.tglDiterimaKurir || '');
      setTglDiantar(shipment.alurPic.tahap5.tglDiantar || '');
      setNamaPenerimaAkhir(shipment.alurPic.tahap5.namaPenerimaAkhir || '');
      setTahap5Done(shipment.alurPic.tahap5.selesai);

      setPicFinance(shipment.alurPic.tahap6.picFinance);
      setNoInvoice(shipment.alurPic.tahap6.noInvoice || '');
      setStatusBayar(shipment.alurPic.tahap6.statusBayar);
      setTahap6Done(shipment.alurPic.tahap6.selesai);
    }
  }, [shipment]);

  const handleSave = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // Kumpulkan tracking events baru jika ada catatan
    const updatedHistory = [...shipment.riwayatTracking];
    if (newLogNote.trim()) {
      updatedHistory.push({
        timestamp: nowStr,
        tahapIndex: currentStatus === 'Selesai' ? 6 : currentStatus === 'Dalam Perjalanan' ? 4 : 2,
        lokasi: shipment.penerima.kotaTujuan,
        status: `Update Alur: ${currentStatus}`,
        keterangan: newLogNote.trim(),
        pic: sharedPicPurchasingFstb || 'Manager Ops',
      });
    }

    const updated: CargoShipment = {
      ...shipment,
      status: currentStatus,
      alurPic: {
        tahap1: {
          picSales,
          noFpb,
          tglFpb,
          selesai: tahap1Done,
        },
        tahap2: {
          picPurchasing: sharedPicPurchasingFstb, // SINKRON OTOMATIS
          noBookingPo,
          tglBooking,
          vendorArmada,
          selesai: tahap2Done,
        },
        tahap3: {
          picFstb: sharedPicPurchasingFstb, // SINKRON OTOMATIS (orang yang sama)
          noFstb,
          tglFstb,
          selesai: tahap3Done,
        },
        tahap4: {
          picTtb,
          noTtb,
          tglTtb,
          namaGudangHub,
          selesai: tahap4Done,
        },
        tahap5: {
          picKurirLap,
          tglDiterimaKurir,
          tglDiantar,
          namaPenerimaAkhir,
          selesai: tahap5Done,
        },
        tahap6: {
          picFinance,
          noInvoice,
          statusBayar,
          selesai: tahap6Done,
        },
      },
      riwayatTracking: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    onUpdate(updated);
    showToast?.(`Alur 6 fase & penugasan PIC untuk ${shipment.resi} berhasil diperbarui!`, 'success');
    onClose();
  };

  const stagesSummary = [
    { num: 1, name: 'FPB Order', done: tahap1Done, code: 'ORD', color: 'bg-blue-500' },
    { num: 2, name: 'Booking PO', done: tahap2Done, code: 'PCH', color: 'bg-cyan-500' },
    { num: 3, name: 'FSTB Kargo', done: tahap3Done, code: 'FSTB', color: 'bg-teal-500' },
    { num: 4, name: 'TTB Gudang', done: tahap4Done, code: 'TTB', color: 'bg-purple-500' },
    { num: 5, name: 'Kurir Lap', done: tahap5Done, code: 'LAP', color: 'bg-amber-500' },
    { num: 6, name: 'Finance', done: tahap6Done, code: 'FIN', color: 'bg-emerald-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Boxes className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Alur Kerja 6 Fase & Penugasan PIC Kargo
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  {shipment.resi}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                {shipment.pengirim.kota} &rarr; {shipment.penerima.kotaTujuan} &bull; {shipment.barang.jenis} ({shipment.barang.beratKg} kg)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Tutup"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 6-Stage Progress Indicator Bar */}
        <div className="px-6 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-max mx-auto py-1">
            {stagesSummary.map((st, idx) => (
              <React.Fragment key={st.code}>
                <div className="flex items-center gap-2">
                  <div
                    className={`size-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition shadow-2xs ${
                      st.done
                        ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/30'
                        : 'bg-muted border border-border text-muted-foreground'
                    }`}
                  >
                    {st.done ? <Check className="size-3.5" /> : st.num}
                  </div>
                  <div className="grid leading-tight">
                    <span className="text-[11px] font-bold text-foreground">{st.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {st.done ? '✓ Lengkap' : 'Pending'}
                    </span>
                  </div>
                </div>
                {idx < stagesSummary.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 rounded transition ${
                      stagesSummary[idx].done && stagesSummary[idx + 1].done
                        ? 'bg-emerald-500'
                        : 'bg-border'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Modal Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Utama & Aturan Khusus Banner */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-200/80 dark:border-blue-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                  Aturan Alur Operasional Logistik:
                </span>
                <span className="text-[11px] text-blue-800/80 dark:text-blue-400/90">
                  PIC Tahap 2 (Purchasing/Booking) dan Tahap 3 (Serah Terima FSTB) <strong>wajib dikerjakan oleh orang yang sama</strong> (tersinkronisasi otomatis).
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs font-semibold text-foreground whitespace-nowrap">Status Pengiriman:</label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as CargoStatus)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="Diproses">Diproses</option>
                <option value="Dalam Perjalanan">Dalam Perjalanan</option>
                <option value="Tiba di Tujuan">Tiba di Tujuan</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* Grid 6 Card Tahap Operasional */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Pembuatan Order / FPB */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="size-4 text-blue-500" />
                  1. Pembuatan Order (FPB)
                </span>
                <input
                  type="checkbox"
                  checked={tahap1Done}
                  onChange={(e) => setTahap1Done(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-muted-foreground block">PIC Admin / Sales:</label>
                  <input
                    type="text"
                    value={picSales}
                    onChange={(e) => setPicSales(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">No. FPB / Order:</label>
                  <input
                    type="text"
                    value={noFpb}
                    onChange={(e) => setNoFpb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Tgl Order:</label>
                  <input
                    type="date"
                    value={tglFpb}
                    onChange={(e) => setTglFpb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 2. Purchasing / Booking */}
            <div className="p-4 rounded-xl border border-cyan-200/80 dark:border-cyan-900/40 bg-cyan-500/5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                  <Truck className="size-4 text-cyan-500" />
                  2. Purchasing / Booking
                </span>
                <input
                  type="checkbox"
                  checked={tahap2Done}
                  onChange={(e) => setTahap2Done(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-cyan-800 dark:text-cyan-300 font-semibold block flex items-center gap-1">
                    PIC Purchasing:
                    <Link className="size-2.5 text-cyan-500" />
                    <span className="text-[9px] text-muted-foreground font-normal">(Sinkron dgn Tahap 3)</span>
                  </label>
                  <input
                    type="text"
                    value={sharedPicPurchasingFstb}
                    onChange={(e) => setSharedPicPurchasingFstb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-cyan-300 dark:border-cyan-700 bg-background text-xs font-bold text-foreground"
                    placeholder="Contoh: NOOR HASANAH"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">No. Booking / PO Vendor:</label>
                  <input
                    type="text"
                    value={noBookingPo}
                    onChange={(e) => setNoBookingPo(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Vendor Armada / Mitra:</label>
                  <input
                    type="text"
                    value={vendorArmada}
                    onChange={(e) => setVendorArmada(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs"
                    placeholder="Nama kapal, pesawat, atau trucking"
                  />
                </div>
              </div>
            </div>

            {/* 3. Serah Terima Barang (FSTB) */}
            <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/40 bg-teal-500/5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Boxes className="size-4 text-teal-500" />
                  3. Serah Terima (FSTB)
                </span>
                <input
                  type="checkbox"
                  checked={tahap3Done}
                  onChange={(e) => setTahap3Done(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-teal-800 dark:text-teal-300 font-semibold block flex items-center gap-1">
                    PIC FSTB:
                    <Link className="size-2.5 text-teal-500" />
                    <span className="text-[9px] text-muted-foreground font-normal">(Orang yg sama dgn Tahap 2)</span>
                  </label>
                  <input
                    type="text"
                    value={sharedPicPurchasingFstb}
                    onChange={(e) => setSharedPicPurchasingFstb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-teal-300 dark:border-teal-700 bg-background text-xs font-bold text-foreground"
                    placeholder="Contoh: NOOR HASANAH"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">No. Dokumen FSTB:</label>
                  <input
                    type="text"
                    value={noFstb}
                    onChange={(e) => setNoFstb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Tgl Terbit FSTB:</label>
                  <input
                    type="date"
                    value={tglFstb}
                    onChange={(e) => setTglFstb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 4. Pencatatan TTB (Logistik Gudang Hub) */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building className="size-4 text-purple-500" />
                  4. Logistik Hub (TTB)
                </span>
                <input
                  type="checkbox"
                  checked={tahap4Done}
                  onChange={(e) => setTahap4Done(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-muted-foreground block">PIC Logistik / TTB Hub:</label>
                  <input
                    type="text"
                    value={picTtb}
                    onChange={(e) => setPicTtb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-medium"
                    placeholder="Contoh: DAVILA (Hub Logistik)"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">No. TTB Masuk:</label>
                  <input
                    type="text"
                    value={noTtb}
                    onChange={(e) => setNoTtb(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                    placeholder="TTB-BPN-26-XXXX"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Gudang / Hub Transit:</label>
                  <input
                    type="text"
                    value={namaGudangHub}
                    onChange={(e) => setNamaGudangHub(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs"
                    placeholder="Gudang Transit Balikpapan"
                  />
                </div>
              </div>
            </div>

            {/* 5. Tim Lapangan / Kurir Pengantar */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Truck className="size-4 text-amber-500" />
                  5. Kurir Lapangan (Delivery)
                </span>
                <input
                  type="checkbox"
                  checked={tahap5Done}
                  onChange={(e) => setTahap5Done(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-muted-foreground block">Nama Kurir / Driver Lapangan:</label>
                  <input
                    type="text"
                    value={picKurirLap}
                    onChange={(e) => setPicKurirLap(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-medium"
                    placeholder="Contoh: Pak Budi (Kurir)"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Tgl / Jam Barang Diantar:</label>
                  <input
                    type="text"
                    value={tglDiantar}
                    onChange={(e) => setTglDiantar(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                    placeholder="2026-10-14 14:00"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Nama Penerima Akhir di Lokasi:</label>
                  <input
                    type="text"
                    value={namaPenerimaAkhir}
                    onChange={(e) => setNamaPenerimaAkhir(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-semibold"
                    placeholder="Nama orang yang menandatangani"
                  />
                </div>
              </div>
            </div>

            {/* 6. Administrasi Akhir / Keuangan */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  6. Administrasi & Keuangan
                </span>
                <input
                  type="checkbox"
                  checked={tahap6Done}
                  onChange={(e) => setTahap6Done(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  title="Tandai Selesai"
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-muted-foreground block">PIC Finance / Administrasi:</label>
                  <input
                    type="text"
                    value={picFinance}
                    onChange={(e) => setPicFinance(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">No. Invoice / Tagihan:</label>
                  <input
                    type="text"
                    value={noInvoice}
                    onChange={(e) => setNoInvoice(e.target.value)}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-mono"
                    placeholder="INV-2026-XXXX"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block">Status Pembayaran Ongkir:</label>
                  <select
                    value={statusBayar}
                    onChange={(e) => setStatusBayar(e.target.value as 'Belum Lunas' | 'Lunas')}
                    className="w-full px-2.5 py-1 rounded border border-border bg-background text-xs font-bold"
                  >
                    <option value="Belum Lunas">Belum Lunas</option>
                    <option value="Lunas">Lunas (Paid)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Input Catatan Log Tracking Tambahan */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-blue-500" />
              Tambahkan Log Riwayat Tracking Baru (Opsional):
            </label>
            <input
              type="text"
              value={newLogNote}
              onChange={(e) => setNewLogNote(e.target.value)}
              placeholder="Contoh: Paket telah selesai dikemas ulang dan siap diberangkatkan ke pelabuhan..."
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <span className="text-xs text-muted-foreground italic">
            Perubahan alur 6 tahap dan PIC akan langsung tersimpan ke sistem operasional.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Save className="size-4" />
              Simpan Perubahan Alur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

