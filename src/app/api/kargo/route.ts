import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_CARGO_DATA } from '@/data/initialCargoData';
import { CargoShipment } from '@/types/kargo';

// In-memory runtime storage for cargo shipments (initialized with rich mock data)
let cargoStorage: CargoShipment[] = [...INITIAL_CARGO_DATA];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resi = searchParams.get('resi');
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.toLowerCase();

    // 1. Single tracking search by resi
    if (resi) {
      const cleanResi = resi.trim().toUpperCase();
      const item = cargoStorage.find(
        (c) => c.resi.toUpperCase() === cleanResi || c.resi.replace(/-/g, '').includes(cleanResi.replace(/-/g, ''))
      );
      if (!item) {
        return NextResponse.json({ success: false, message: `Nomor resi "${resi}" tidak ditemukan.` }, { status: 404 });
      }
      return NextResponse.json({ success: true, item });
    }

    // 2. Filtered list search
    let filtered = [...cargoStorage];
    if (status && status !== 'ALL') {
      filtered = filtered.filter((c) => c.status === status);
    }
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.resi.toLowerCase().includes(q) ||
          c.pengirim.nama.toLowerCase().includes(q) ||
          c.penerima.nama.toLowerCase().includes(q) ||
          c.penerima.kotaTujuan.toLowerCase().includes(q) ||
          c.barang.jenis.toLowerCase().includes(q) ||
          c.alurPic.tahap2.picPurchasing.toLowerCase().includes(q) ||
          c.alurPic.tahap5.picKurirLap.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      total: filtered.length,
      items: filtered,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Auto-generate unique resi if not provided
    const nextNum = Math.floor(10000 + Math.random() * 90000);
    const resi = body.resi || `CRG-2026-${nextNum}`;

    // Validasi sinkronisasi PIC Tahap 2 & Tahap 3 sesuai aturan logistik
    const picPch = body.alurPic?.tahap2?.picPurchasing || body.alurPic?.tahap3?.picFstb || 'NOOR HASANAH';
    const picFstb = picPch; // Harus SINKRON / orang yang sama

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const newShipment: CargoShipment = {
      id: resi,
      resi,
      tglOrder: body.tglOrder || new Date().toISOString().slice(0, 10),
      pengirim: {
        nama: body.pengirim?.nama || 'Pengirim Anonim',
        telepon: body.pengirim?.telepon || '-',
        alamat: body.pengirim?.alamat || '-',
        kota: body.pengirim?.kota || 'Jakarta',
      },
      penerima: {
        nama: body.penerima?.nama || 'Penerima Anonim',
        telepon: body.penerima?.telepon || '-',
        alamat: body.penerima?.alamat || '-',
        kotaTujuan: body.penerima?.kotaTujuan || 'Balikpapan',
      },
      barang: {
        jenis: body.barang?.jenis || 'General Cargo',
        beratKg: Number(body.barang?.beratKg) || 1,
        panjangCm: Number(body.barang?.panjangCm) || 30,
        lebarCm: Number(body.barang?.lebarCm) || 20,
        tinggiCm: Number(body.barang?.tinggiCm) || 15,
        volumeCbm:
          Number(body.barang?.volumeCbm) ||
          Math.round(((Number(body.barang?.panjangCm) || 30) * (Number(body.barang?.lebarCm) || 20) * (Number(body.barang?.tinggiCm) || 15)) / 10000) / 100,
        koli: Number(body.barang?.koli) || 1,
        keterangan: body.barang?.keterangan || '',
      },
      layanan: body.layanan || 'Reguler',
      status: body.status || 'Draft',
      estimasiHari: body.estimasiHari || (body.layanan === 'Express' ? '1-2 Hari' : '3-5 Hari'),
      ongkir: Number(body.ongkir) || 150000,
      biayaOperasional: Number(body.biayaOperasional) || Math.round((Number(body.ongkir) || 150000) * 0.65),
      alurPic: {
        tahap1: {
          picSales: body.alurPic?.tahap1?.picSales || 'Admin Sales',
          tglFpb: body.alurPic?.tahap1?.tglFpb || new Date().toISOString().slice(0, 10),
          noFpb: body.alurPic?.tahap1?.noFpb || `FPB-CRG-26-${Math.floor(1000 + Math.random() * 9000)}`,
          catatan: body.alurPic?.tahap1?.catatan || '',
          selesai: true,
        },
        tahap2: {
          picPurchasing: picPch,
          noBookingPo: body.alurPic?.tahap2?.noBookingPo || `PO-BK-26-${Math.floor(100 + Math.random() * 900)}`,
          tglBooking: body.alurPic?.tahap2?.tglBooking || new Date().toISOString().slice(0, 10),
          vendorArmada: body.alurPic?.tahap2?.vendorArmada || 'Armada Internal Logistik',
          selesai: Boolean(body.alurPic?.tahap2?.noBookingPo),
        },
        tahap3: {
          picFstb: picFstb, // SINKRON OTOMATIS
          noFstb: body.alurPic?.tahap3?.noFstb || `CPL-FSTB-26-${Math.floor(10000 + Math.random() * 90000)}`,
          tglFstb: body.alurPic?.tahap3?.tglFstb || new Date().toISOString().slice(0, 10),
          selesai: Boolean(body.alurPic?.tahap3?.noFstb),
        },
        tahap4: {
          picTtb: body.alurPic?.tahap4?.picTtb || '',
          noTtb: body.alurPic?.tahap4?.noTtb || '',
          tglTtb: body.alurPic?.tahap4?.tglTtb || '',
          namaGudangHub: body.alurPic?.tahap4?.namaGudangHub || '',
          selesai: Boolean(body.alurPic?.tahap4?.noTtb),
        },
        tahap5: {
          picKurirLap: body.alurPic?.tahap5?.picKurirLap || '',
          tglDiterimaKurir: body.alurPic?.tahap5?.tglDiterimaKurir,
          tglDiantar: body.alurPic?.tahap5?.tglDiantar,
          namaPenerimaAkhir: body.alurPic?.tahap5?.namaPenerimaAkhir,
          selesai: Boolean(body.alurPic?.tahap5?.tglDiantar),
        },
        tahap6: {
          picFinance: body.alurPic?.tahap6?.picFinance || '',
          noInvoice: body.alurPic?.tahap6?.noInvoice,
          tglLunas: body.alurPic?.tahap6?.tglLunas,
          statusBayar: body.alurPic?.tahap6?.statusBayar || 'Belum Lunas',
          selesai: body.alurPic?.tahap6?.statusBayar === 'Lunas',
        },
      },
      riwayatTracking: [
        {
          timestamp: nowStr,
          tahapIndex: 1,
          lokasi: body.pengirim?.kota || 'Jakarta Hub',
          status: 'Order Dibuat & Resi Diterbitkan',
          keterangan: `Resi ${resi} resmi didaftarkan di sistem kargo logistik.`,
          pic: body.alurPic?.tahap1?.picSales || 'Admin Sales',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Tambah ke in-memory storage (di paling depan)
    cargoStorage.unshift(newShipment);

    return NextResponse.json({ success: true, item: newShipment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, resi } = body;

    const targetIndex = cargoStorage.findIndex((c) => c.id === id || c.resi === resi);
    if (targetIndex === -1) {
      return NextResponse.json({ success: false, message: 'Data pengiriman tidak ditemukan.' }, { status: 404 });
    }

    const current = cargoStorage[targetIndex];

    // Sinkronisasi PIC Tahap 2 & Tahap 3 jika salah satu diubah
    let updatedAlurPic = body.alurPic ? { ...current.alurPic, ...body.alurPic } : current.alurPic;
    if (body.alurPic?.tahap2?.picPurchasing && !body.alurPic?.tahap3?.picFstb) {
      updatedAlurPic.tahap3.picFstb = body.alurPic.tahap2.picPurchasing;
    } else if (body.alurPic?.tahap3?.picFstb && !body.alurPic?.tahap2?.picPurchasing) {
      updatedAlurPic.tahap2.picPurchasing = body.alurPic.tahap3.picFstb;
    } else if (body.alurPic?.tahap2?.picPurchasing) {
      updatedAlurPic.tahap3.picFstb = body.alurPic.tahap2.picPurchasing;
    }

    const updatedShipment: CargoShipment = {
      ...current,
      ...body,
      alurPic: updatedAlurPic,
      updatedAt: new Date().toISOString(),
    };

    cargoStorage[targetIndex] = updatedShipment;

    return NextResponse.json({ success: true, item: updatedShipment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resi = searchParams.get('resi');
    const id = searchParams.get('id');

    if (!resi && !id) {
      return NextResponse.json({ success: false, message: 'Parameter resi atau id diperlukan.' }, { status: 400 });
    }

    const initialLength = cargoStorage.length;
    cargoStorage = cargoStorage.filter((c) => c.resi !== resi && c.id !== id);

    if (cargoStorage.length === initialLength) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data pengiriman berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

