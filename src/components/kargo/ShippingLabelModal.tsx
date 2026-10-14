import React, { useRef } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Truck,
  Package,
  MapPin,
  Phone,
  Calendar,
  ShieldCheck,
  QrCode,
  FileText,
} from 'lucide-react';
import { CargoShipment } from '@/types/kargo';

interface ShippingLabelModalProps {
  shipment: CargoShipment | null;
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ShippingLabelModal({
  shipment,
  isOpen,
  onClose,
  showToast,
}: ShippingLabelModalProps) {
  const [copied, setCopied] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !shipment) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyResi = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shipment.resi);
      setCopied(true);
      showToast?.(`Nomor resi ${shipment.resi} berhasil disalin!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getServiceColor = (layanan: string) => {
    switch (layanan) {
      case 'Express':
        return 'bg-amber-500 text-white border-amber-600';
      case 'Kargo Laut':
        return 'bg-blue-600 text-white border-blue-700';
      case 'Kargo Darat':
        return 'bg-emerald-600 text-white border-emerald-700';
      default:
        return 'bg-slate-700 text-white border-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-2xl bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Action Bar (Screen Only) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="size-4.5 text-sky-400" />
            <span className="font-semibold text-sm tracking-wide">
              Surat Jalan & Label Pengiriman Kargo
            </span>
            <span className="text-xs text-slate-400 font-mono">[{shipment.resi}]</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyResi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition border border-slate-700 cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin Resi'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition shadow-sm cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Cetak Label (A4/Thermal)</span>
            </button>
            <button
              onClick={onClose}
              className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Printable Waybill & Shipping Label Document */}
        <div ref={printRef} className="p-6 text-slate-900 print:p-4 bg-white font-sans text-xs">
          {/* Header Waybill */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-md bg-sky-700 flex items-center justify-center text-white font-black text-sm">
                  CPG
                </div>
                <div>
                  <h1 className="font-extrabold text-base tracking-tight text-slate-950 uppercase">
                    PT CINDARA PRATAMA LOGISTIK
                  </h1>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Jasa Angkutan Barang, Kargo Antarpulau & Ekspedisi Logistik Terpadu
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Depot & Hub: Somber & Kariangau, Balikpapan &bull; Hub CKG: Jakarta &bull; Hotline: 0542-888-999
              </p>
            </div>

            <div className="text-right">
              <span
                className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider border ${getServiceColor(
                  shipment.layanan
                )}`}
              >
                {shipment.layanan}
              </span>
              <p className="font-mono text-sm font-bold text-slate-900 mt-1">{shipment.resi}</p>
              <p className="text-[10px] text-slate-500">Tgl: {shipment.tglOrder}</p>
            </div>
          </div>

          {/* Barcode & Routing Badge Section */}
          <div className="my-3 py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Fake Barcode Visual */}
              <div className="flex flex-col items-center">
                <div className="flex items-center h-9 space-x-[2px] bg-white px-2 py-1 border border-slate-300 rounded">
                  {[3, 1, 4, 1, 2, 5, 1, 3, 2, 1, 4, 2, 3, 1, 5, 2, 1, 3, 4, 1, 2].map((w, i) => (
                    <div
                      key={i}
                      className="bg-slate-900 h-full"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] font-bold tracking-widest text-slate-700 mt-0.5">
                  *{shipment.resi}*
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Rute Tujuan:
              </span>
              <div className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {shipment.pengirim.kota} &rarr; {shipment.penerima.kotaTujuan}
              </div>
              <span className="text-[10px] text-slate-600 font-mono">
                Estimasi: {shipment.estimasiHari} &bull; Status: {shipment.status}
              </span>
            </div>
          </div>

          {/* Sender & Receiver Dual Column */}
          <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded-lg overflow-hidden my-3">
            {/* Pengirim */}
            <div className="p-3 bg-slate-50/70 border-r border-slate-300">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase text-[11px] mb-1">
                <MapPin className="size-3 text-sky-700" />
                <span>PENGIRIM (SHIPPER):</span>
              </div>
              <p className="font-bold text-slate-950 text-xs">{shipment.pengirim.nama}</p>
              <p className="text-[11px] text-slate-700 leading-snug mt-0.5 whitespace-pre-line">
                {shipment.pengirim.alamat}
              </p>
              <p className="text-[10px] text-slate-600 font-medium mt-1">
                Kota: <span className="font-semibold text-slate-900">{shipment.pengirim.kota}</span>
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-700 font-mono mt-0.5">
                <Phone className="size-2.5 text-slate-500" />
                <span>{shipment.pengirim.telepon}</span>
              </div>
            </div>

            {/* Penerima */}
            <div className="p-3 bg-sky-50/50">
              <div className="flex items-center gap-1.5 text-sky-900 font-bold uppercase text-[11px] mb-1">
                <MapPin className="size-3 text-sky-700" />
                <span>PENERIMA (CONSIGNEE):</span>
              </div>
              <p className="font-bold text-slate-950 text-xs">{shipment.penerima.nama}</p>
              <p className="text-[11px] text-slate-700 leading-snug mt-0.5 whitespace-pre-line">
                {shipment.penerima.alamat}
              </p>
              <p className="text-[10px] text-slate-600 font-medium mt-1">
                Kota Tujuan: <span className="font-bold text-sky-900 uppercase">{shipment.penerima.kotaTujuan}</span>
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-700 font-mono mt-0.5">
                <Phone className="size-2.5 text-slate-500" />
                <span>{shipment.penerima.telepon}</span>
              </div>
            </div>
          </div>

          {/* Goods Specification Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden my-3">
            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-800 text-[11px] border-b border-slate-300 uppercase flex items-center justify-between">
              <span>Rincian Muatan Kargo</span>
              <span className="font-mono text-[10px] text-slate-600">Total Koli: {shipment.barang.koli} Koli</span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-1 px-3 text-left">Deskripsi / Jenis Barang</th>
                  <th className="py-1 px-2 text-center">Berat (Kg)</th>
                  <th className="py-1 px-2 text-center">Dimensi PxLxT (cm)</th>
                  <th className="py-1 px-2 text-center">Volume (CBM)</th>
                  <th className="py-1 px-3 text-right">Koli</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 px-3 font-semibold text-slate-900">
                    {shipment.barang.jenis}
                    {shipment.barang.keterangan && (
                      <span className="block text-[10px] font-normal text-slate-500">
                        Ket: {shipment.barang.keterangan}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">
                    {shipment.barang.beratKg} kg
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-600">
                    {shipment.barang.panjangCm} x {shipment.barang.lebarCm} x {shipment.barang.tinggiCm}
                  </td>
                  <td className="py-2 px-2 text-center font-mono text-slate-600">
                    {shipment.barang.volumeCbm.toFixed(3)} m³
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {shipment.barang.koli}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Alur 6 Fase & Penugasan PIC */}
          <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-lg my-3">
            <span className="block font-bold text-[10px] text-slate-700 uppercase tracking-wider mb-1.5">
              Identifikasi Berkas Operasional & PIC Bertanggung Jawab:
            </span>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="border border-slate-200 p-1.5 rounded bg-white">
                <span className="text-slate-500 block">Fase 1: FPB / Sales</span>
                <strong className="text-slate-900 block truncate">{shipment.alurPic.tahap1.picSales}</strong>
                <span className="font-mono text-[9px] text-slate-600">{shipment.alurPic.tahap1.noFpb}</span>
              </div>

              {/* Fase 2 & 3: SINKRON */}
              <div className="border border-sky-300 p-1.5 rounded bg-sky-50/60">
                <span className="text-sky-800 font-bold block">Fase 2 & 3: Purchasing / FSTB (SINKRON)</span>
                <strong className="text-sky-950 block truncate">{shipment.alurPic.tahap2.picPurchasing}</strong>
                <span className="font-mono text-[9px] text-slate-600 block">PO: {shipment.alurPic.tahap2.noBookingPo}</span>
                <span className="font-mono text-[9px] text-slate-600 block">FSTB: {shipment.alurPic.tahap3.noFstb}</span>
              </div>

              <div className="border border-slate-200 p-1.5 rounded bg-white">
                <span className="text-slate-500 block">Fase 4: Gudang / TTB</span>
                <strong className="text-slate-900 block truncate">{shipment.alurPic.tahap4.picTtb}</strong>
                <span className="font-mono text-[9px] text-slate-600">TTB: {shipment.alurPic.tahap4.noTtb}</span>
              </div>
            </div>
          </div>

          {/* Signature Box Section */}
          <div className="grid grid-cols-4 gap-2 border border-slate-300 rounded-lg p-2.5 text-center mt-3">
            <div className="border-r border-slate-200 pr-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase">Pengirim</p>
              <div className="h-14 flex items-end justify-center pb-1">
                <span className="border-b border-dashed border-slate-400 w-24"></span>
              </div>
              <p className="text-[9px] font-medium text-slate-800 truncate">{shipment.pengirim.nama}</p>
            </div>

            <div className="border-r border-slate-200 pr-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase">Purchasing / FSTB</p>
              <div className="h-14 flex items-end justify-center pb-1">
                <span className="border-b border-dashed border-slate-400 w-24"></span>
              </div>
              <p className="text-[9px] font-medium text-slate-800 truncate">{shipment.alurPic.tahap2.picPurchasing}</p>
            </div>

            <div className="border-r border-slate-200 pr-1">
              <p className="text-[9px] font-bold text-slate-600 uppercase">Logistik / Gudang</p>
              <div className="h-14 flex items-end justify-center pb-1">
                <span className="border-b border-dashed border-slate-400 w-24"></span>
              </div>
              <p className="text-[9px] font-medium text-slate-800 truncate">{shipment.alurPic.tahap4.picTtb}</p>
            </div>

            <div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Penerima Akhir</p>
              <div className="h-14 flex items-end justify-center pb-1">
                <span className="border-b border-dashed border-slate-400 w-24"></span>
              </div>
              <p className="text-[9px] font-medium text-slate-800 truncate">{shipment.penerima.nama}</p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
            <span>
              * Dokumen sah tanda terima pengiriman barang PT Cindara Pratama Group. Lacak resi di portal tracking online.
            </span>
            <span className="font-mono">
              Printed: {new Date().toLocaleDateString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

