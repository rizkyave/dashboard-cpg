import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  WarehouseStockItem,
  WarehouseMutation,
  WarehouseSummary,
  MutationType,
} from '@/types/warehouseStock';
import {
  INITIAL_WAREHOUSE_ITEMS,
  INITIAL_WAREHOUSE_MUTATIONS,
  calculateWarehouseSummary,
} from '@/data/initialWarehouseData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATA_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'warehouse-stock-data.json');

function loadDataFromDisk(): { items: WarehouseStockItem[]; mutations: WarehouseMutation[] } {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.mutations)) {
        return {
          items: parsed.items,
          mutations: parsed.mutations,
        };
      }
    }
  } catch (err) {
    console.error('Gagal membaca warehouse-stock-data.json:', err);
  }
  return {
    items: INITIAL_WAREHOUSE_ITEMS,
    mutations: INITIAL_WAREHOUSE_MUTATIONS,
  };
}

function saveDataToDisk(items: WarehouseStockItem[], mutations: WarehouseMutation[]): boolean {
  try {
    const payload = {
      lastSaved: new Date().toISOString(),
      items,
      mutations,
    };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Gagal menyimpan ke warehouse-stock-data.json:', err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { items, mutations } = loadDataFromDisk();
    const summary = calculateWarehouseSummary(items, mutations);
    return NextResponse.json({
      success: true,
      items,
      mutations,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal mengambil data stok gudang' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'add-mutation';

    const { items, mutations } = loadDataFromDisk();

    if (action === 'reset') {
      saveDataToDisk(INITIAL_WAREHOUSE_ITEMS, INITIAL_WAREHOUSE_MUTATIONS);
      const summary = calculateWarehouseSummary(INITIAL_WAREHOUSE_ITEMS, INITIAL_WAREHOUSE_MUTATIONS);
      return NextResponse.json({
        success: true,
        message: 'Data stok gudang berhasil di-reset ke nilai standar.',
        items: INITIAL_WAREHOUSE_ITEMS,
        mutations: INITIAL_WAREHOUSE_MUTATIONS,
        summary,
      });
    }

    if (action === 'add-item') {
      const newItem: Partial<WarehouseStockItem> = body.item;
      if (!newItem.namaBarang || !newItem.kodeBarang) {
        return NextResponse.json(
          { success: false, error: 'Nama barang dan kode barang wajib diisi' },
          { status: 400 }
        );
      }

      const id = `WH-ITM-${String(items.length + 1).padStart(3, '0')}`;
      const saldoAwal = Number(newItem.saldoAwal) || 0;
      const minStock = Number(newItem.minStock) || 2;
      const sisaStok = saldoAwal;

      let status: 'AMAN' | 'MENIPIS' | 'HABIS' = 'AMAN';
      if (sisaStok === 0) status = 'HABIS';
      else if (sisaStok <= minStock) status = 'MENIPIS';

      const fullItem: WarehouseStockItem = {
        id,
        kodeBarang: newItem.kodeBarang.toUpperCase().trim(),
        namaBarang: newItem.namaBarang.toUpperCase().trim(),
        kategori: newItem.kategori || 'Sparepart Mesin',
        satuan: (newItem.satuan || 'PCS').toUpperCase().trim(),
        lokasiRak: newItem.lokasiRak || 'Gudang Somber',
        minStock,
        saldoAwal,
        totalMasuk: 0,
        totalKeluar: 0,
        sisaStok,
        status,
        kondisi: newItem.kondisi || 'Baru',
        hargaSatuanPerkiraan: Number(newItem.hargaSatuanPerkiraan) || 0,
        lastMutationDate: new Date().toISOString().split('T')[0],
        keterangan: newItem.keterangan || '',
      };

      const updatedItems = [fullItem, ...items];
      saveDataToDisk(updatedItems, mutations);
      const summary = calculateWarehouseSummary(updatedItems, mutations);

      return NextResponse.json({
        success: true,
        message: `Item ${fullItem.namaBarang} berhasil ditambahkan ke stok gudang.`,
        items: updatedItems,
        mutations,
        summary,
      });
    }

    if (action === 'add-mutation') {
      const mut: Partial<WarehouseMutation> = body.mutation;
      if (!mut.itemId || !mut.jenis || !mut.qty || mut.qty <= 0) {
        return NextResponse.json(
          { success: false, error: 'Data mutasi tidak lengkap atau qty tidak valid' },
          { status: 400 }
        );
      }

      const itemIndex = items.findIndex((i) => i.id === mut.itemId);
      if (itemIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Item barang tidak ditemukan di gudang' },
          { status: 404 }
        );
      }

      const targetItem = { ...items[itemIndex] };
      const jenis: MutationType = mut.jenis;
      const qty = Number(mut.qty);
      const saldoSebelum = targetItem.sisaStok;

      if (jenis === 'KELUAR' && qty > targetItem.sisaStok) {
        return NextResponse.json(
          {
            success: false,
            error: `Stok tidak mencukupi! Sisa stok saat ini ${targetItem.sisaStok} ${targetItem.satuan}, permintaan keluar ${qty} ${targetItem.satuan}.`,
          },
          { status: 400 }
        );
      }

      let saldoSesudah = saldoSebelum;
      if (jenis === 'MASUK') {
        targetItem.totalMasuk += qty;
        saldoSesudah = saldoSebelum + qty;
      } else {
        targetItem.totalKeluar += qty;
        saldoSesudah = saldoSebelum - qty;
      }

      targetItem.sisaStok = saldoSesudah;
      if (saldoSesudah === 0) {
        targetItem.status = 'HABIS';
      } else if (saldoSesudah <= targetItem.minStock) {
        targetItem.status = 'MENIPIS';
      } else {
        targetItem.status = 'AMAN';
      }

      const now = new Date();
      const dateStr = mut.tanggal || now.toISOString().split('T')[0];
      const timeStr =
        mut.waktu ||
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      targetItem.lastMutationDate = dateStr;

      const mutationId = `MUT-${jenis === 'MASUK' ? 'IN' : 'OUT'}-2026-${String(
        mutations.length + 1045
      ).padStart(4, '0')}`;

      const newMutation: WarehouseMutation = {
        id: mutationId,
        tanggal: dateStr,
        waktu: timeStr,
        jenis,
        itemId: targetItem.id,
        kodeBarang: targetItem.kodeBarang,
        namaBarang: targetItem.namaBarang,
        kategori: targetItem.kategori,
        qty,
        satuan: targetItem.satuan,
        saldoSebelum,
        saldoSesudah,
        noDokumenRef: mut.noDokumenRef || '-',
        entitas: mut.entitas || 'CPL',
        sumberAtauTujuan: mut.sumberAtauTujuan || '-',
        picGudang: mut.picGudang || 'Budi Agustiansyah (Staf Gudang Somber)',
        picPenerimaPengambil: mut.picPenerimaPengambil || '-',
        keperluan: mut.keperluan || '-',
        status: 'VERIFIED',
        catatan: mut.catatan || '',
        createdAt: now.toISOString(),
      };

      const updatedItems = [...items];
      updatedItems[itemIndex] = targetItem;
      const updatedMutations = [newMutation, ...mutations];

      saveDataToDisk(updatedItems, updatedMutations);
      const summary = calculateWarehouseSummary(updatedItems, updatedMutations);

      return NextResponse.json({
        success: true,
        message: `Transaksi ${jenis === 'MASUK' ? 'Penerimaan' : 'Pengeluaran'} ${
          targetItem.namaBarang
        } berhasil disimpan.`,
        mutation: newMutation,
        items: updatedItems,
        mutations: updatedMutations,
        summary,
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/warehouse-stock:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Gagal memproses mutasi stok gudang' },
      { status: 500 }
    );
  }
}

