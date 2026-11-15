import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RegisteredVendor, VendorVerificationResult } from '@/types/vendor';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_VENDORS_METADATA_KEY = 'vendor-metadata/registered-vendors.json';
const LOCAL_VENDORS_PATH = path.join(process.cwd(), 'src', 'data', 'registered-vendors.json');

/**
 * Membaca data vendor dari Cloudflare R2 atau fallback lokal
 */
async function getStoredVendors(): Promise<RegisteredVendor[]> {
  let vendors: RegisteredVendor[] = [];

  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_VENDORS_METADATA_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          vendors = parsed;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca registered-vendors dari R2:', err);
    }
  }

  if (vendors.length === 0) {
    try {
      const raw = await fs.readFile(LOCAL_VENDORS_PATH, 'utf8');
      vendors = JSON.parse(raw);
    } catch {
      vendors = [];
    }
  }

  return vendors;
}

/**
 * Menyimpan data vendor ke lokal dan sinkronisasi ke Cloudflare R2
 */
async function saveVendors(vendors: RegisteredVendor[]): Promise<void> {
  const jsonStr = JSON.stringify(vendors, null, 2);

  // Simpan lokal
  try {
    await fs.writeFile(LOCAL_VENDORS_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('Gagal menulis data vendor ke filesystem lokal:', err);
  }

  // Sinkronisasi ke R2
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_VENDORS_METADATA_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal mengupload data vendor ke R2:', err);
    }
  }
}

/**
 * GET Handler: Mengambil daftar vendor atau memverifikasi otentikasi vendor
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isVerify = searchParams.get('verify') === 'true';
    const vendorId = searchParams.get('id') || searchParams.get('vendorId') || '';
    const token = searchParams.get('token') || '';
    const phone = searchParams.get('phone') || '';
    const name = searchParams.get('name') || '';

    const vendors = await getStoredVendors();

    // Mode 1: Verifikasi Vendor Khusus (Dipakai oleh Portal Tender)
    if (isVerify) {
      if (!vendorId && !token && !phone && !name) {
        const result: VendorVerificationResult = {
          isValid: false,
          error: 'Parameter verifikasi vendor tidak lengkap.',
        };
        return NextResponse.json(result, { status: 400 });
      }

      // Cari vendor berdasarkan ID, Token, Phone atau Name
      const match = vendors.find((v) => {
        if (vendorId && v.id.toLowerCase() === vendorId.toLowerCase()) {
          // Jika token disertakan, wajib cocok
          if (token && v.accessToken !== token) return false;
          return true;
        }
        if (token && v.accessToken === token) return true;
        if (phone) {
          const cleanInputPhone = phone.replace(/\D/g, '');
          const cleanVendorPhone = v.picPhone.replace(/\D/g, '');
          if (cleanInputPhone && cleanVendorPhone.includes(cleanInputPhone)) return true;
        }
        if (name && v.name.toLowerCase().trim() === name.toLowerCase().trim()) return true;
        return false;
      });

      if (!match) {
        return NextResponse.json(
          {
            isValid: false,
            error: 'Perusahaan atau kode akses rekanan tidak terdaftar dalam DPT CPG.',
          },
          { status: 404 }
        );
      }

      if (match.status === 'BLACKLISTED') {
        return NextResponse.json(
          {
            isValid: false,
            error: 'Perusahaan ini sedang dalam status Blacklist dan dilarang mengikuti pengadaan.',
          },
          { status: 403 }
        );
      }

      if (match.status === 'INACTIVE' || match.status === 'PENDING') {
        return NextResponse.json(
          {
            isValid: false,
            error: `Status kepesertaan rekanan belum aktif (${match.status}). Hubungi tim pengadaan CPG.`,
          },
          { status: 403 }
        );
      }

      // Berikan data terbatas yang aman (tanpa token rahasia)
      const safeVendor: RegisteredVendor = {
        ...match,
        accessToken: '***PROTECTED***',
      };

      return NextResponse.json({
        isValid: true,
        vendor: safeVendor,
      });
    }

    // Mode 2: Ambil Daftar Vendor untuk Admin / Panitia Tender
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');
    const q = (searchParams.get('search') || '').toLowerCase().trim();

    let filtered = vendors;

    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    if (categoryFilter && categoryFilter !== 'ALL') {
      filtered = filtered.filter((v) =>
        v.categories.some((c) => c.toLowerCase() === categoryFilter.toLowerCase())
      );
    }

    if (q) {
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.npwp.toLowerCase().includes(q) ||
          v.picName.toLowerCase().includes(q) ||
          v.picPhone.includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      vendors: filtered,
      total: filtered.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in GET /api/vendors:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat master vendor.' },
      { status: 500 }
    );
  }
}

/**
 * POST Handler: Membuat atau mengupdate data rekanan DPT
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, vendor, vendorId, status } = body;
    const vendors = await getStoredVendors();

    if (action === 'CREATE_VENDOR') {
      if (!vendor?.name || !vendor?.npwp) {
        return NextResponse.json(
          { success: false, message: 'Nama vendor dan NPWP wajib diisi.' },
          { status: 400 }
        );
      }

      // Generate ID & Access Token Unik
      const newId = `VND-CPG-${String(vendors.length + 1).padStart(3, '0')}`;
      const uniqueToken = `vnd_sec_${crypto.randomBytes(8).toString('hex')}`;

      const newVendor: RegisteredVendor = {
        id: newId,
        code: vendor.code || `VND-${String(vendors.length + 1).padStart(3, '0')}`,
        name: vendor.name.trim(),
        legalType: vendor.legalType || 'PT',
        npwp: vendor.npwp.trim(),
        nib: vendor.nib?.trim() || undefined,
        categories: Array.isArray(vendor.categories) ? vendor.categories : ['GENERAL_SUPPLIER'],
        picName: vendor.picName?.trim() || 'PIC Komersial',
        picPhone: vendor.picPhone?.replace(/\D/g, '') || '',
        picEmail: vendor.picEmail?.trim() || '',
        officeAddress: vendor.officeAddress?.trim() || '',
        city: vendor.city?.trim() || 'Balikpapan',
        bankName: vendor.bankName?.trim() || '',
        bankAccountNumber: vendor.bankAccountNumber?.trim() || '',
        bankAccountHolder: vendor.bankAccountHolder?.trim() || '',
        status: vendor.status || 'ACTIVE',
        accessToken: uniqueToken,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: vendor.verifiedBy || 'Admin Pengadaan CPG',
        rating: 5.0,
        notes: vendor.notes?.trim() || '',
        createdAt: new Date().toISOString(),
      };

      const updatedList = [newVendor, ...vendors];
      await saveVendors(updatedList);

      return NextResponse.json({
        success: true,
        message: `Vendor ${newVendor.name} berhasil didaftarkan ke DPT.`,
        vendor: newVendor,
      });
    }

    if (action === 'UPDATE_VENDOR') {
      if (!vendor?.id) {
        return NextResponse.json(
          { success: false, message: 'ID vendor wajib disertakan.' },
          { status: 400 }
        );
      }

      const idx = vendors.findIndex((v) => v.id === vendor.id);
      if (idx === -1) {
        return NextResponse.json(
          { success: false, message: 'Vendor tidak ditemukan.' },
          { status: 404 }
        );
      }

      vendors[idx] = {
        ...vendors[idx],
        ...vendor,
        updatedAt: new Date().toISOString(),
      };

      await saveVendors(vendors);

      return NextResponse.json({
        success: true,
        message: `Data vendor ${vendors[idx].name} berhasil diperbarui.`,
        vendor: vendors[idx],
      });
    }

    if (action === 'TOGGLE_STATUS') {
      if (!vendorId || !status) {
        return NextResponse.json(
          { success: false, message: 'vendorId dan status wajib disertakan.' },
          { status: 400 }
        );
      }

      const idx = vendors.findIndex((v) => v.id === vendorId);
      if (idx === -1) {
        return NextResponse.json(
          { success: false, message: 'Vendor tidak ditemukan.' },
          { status: 404 }
        );
      }

      vendors[idx].status = status;
      vendors[idx].updatedAt = new Date().toISOString();
      await saveVendors(vendors);

      return NextResponse.json({
        success: true,
        message: `Status vendor diubah menjadi ${status}.`,
        vendor: vendors[idx],
      });
    }

    if (action === 'REGENERATE_TOKEN') {
      if (!vendorId) {
        return NextResponse.json(
          { success: false, message: 'vendorId wajib disertakan.' },
          { status: 400 }
        );
      }

      const idx = vendors.findIndex((v) => v.id === vendorId);
      if (idx === -1) {
        return NextResponse.json(
          { success: false, message: 'Vendor tidak ditemukan.' },
          { status: 404 }
        );
      }

      const newToken = `vnd_sec_${crypto.randomBytes(8).toString('hex')}`;
      vendors[idx].accessToken = newToken;
      vendors[idx].updatedAt = new Date().toISOString();
      await saveVendors(vendors);

      return NextResponse.json({
        success: true,
        message: `Kode otentikasi baru berhasil dibuat.`,
        accessToken: newToken,
      });
    }

    if (action === 'DELETE_VENDOR') {
      if (!vendorId) {
        return NextResponse.json(
          { success: false, message: 'vendorId wajib disertakan.' },
          { status: 400 }
        );
      }

      const filtered = vendors.filter((v) => v.id !== vendorId);
      await saveVendors(filtered);

      return NextResponse.json({
        success: true,
        message: 'Vendor berhasil dihapus dari master DPT.',
      });
    }

    return NextResponse.json(
      { success: false, message: `Aksi ${action} tidak dikenali.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/vendors:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses data vendor.' },
      { status: 500 }
    );
  }
}
