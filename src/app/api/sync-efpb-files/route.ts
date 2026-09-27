import { NextRequest, NextResponse } from 'next/server';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { formatDateDdMmYy } from '@/utils/formatDate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_FILESLIST_URL = 'https://e-fpb.cindaragroup.com/FilesList';

interface ParsedEfpbFileRow {
  fpb: string;
  originalFpb: string;
  tgl: string;
  pchLogistik: string;
  armada: string;
  company: string;
  status: string;
  keterangan: string;
  isReceivedLogistik: boolean;
  pdfUrl: string;
}

function parseFilesListHtml(html: string): ParsedEfpbFileRow[] {
  const rows: ParsedEfpbFileRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowContent = trMatch[1];
    if (
      !rowContent.includes('<td') ||
      rowContent.includes('{{') ||
      rowContent.includes('<script')
    ) {
      continue;
    }

    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      tds.push(
        tdMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()
      );
    }

    if (tds.length < 18) continue;

    // Mapping based on inspect-rows:
    // [Col 2]: Created at (e.g. 26/09/26 13:48)
    // [Col 3]: NO FPB ACCURATE (e.g. GAJ/LOG/FPB/26-0000976 or CPL-FPB-26-0004497)
    // [Col 5]: NO FPB MANUAL
    // [Col 6]: PCH / LOGISTIK (e.g. Received_Logistic)
    // [Col 15]: KETERANGAN
    // [Col 16]: DEPT/ARMADA/PROJECT (e.g. MOBIL OPS KT 1285 YZ)
    // [Col 17]: COMPANY (e.g. GAJ, CPL, HL, MO)
    // [Col 18]: STATUS (0 or 1)

    const rawTgl = tds[2] || '';
    const rawFpb = tds[3] || tds[5] || '';
    const pchLogistik = tds[6] || '';
    const keterangan = tds[15] || '';
    const armada = tds[16] || 'Armada Kapal';
    const company = (tds[17] || 'CPL').toUpperCase();
    const status = tds[18] || '0';

    if (!rawFpb || rawFpb.length < 5 || rawFpb.includes('{{')) continue;

    // Normalize FPB: GAJ/LOG/FPB/26-0000976 -> GAJ-FPB-26-0000976
    const cleanFpb = rawFpb.replace(/\/LOG\/FPB\//i, '-FPB-').trim();

    // Skip incomplete or truncated FPB strings like CPL-FPB-26-00
    if (cleanFpb.length < 12 || cleanFpb.endsWith('-00') || !cleanFpb.includes('-FPB-')) {
      continue;
    }

    // Check if received by logistic
    const isReceivedLogistik = pchLogistik.toLowerCase().includes('received');

    // Format date to dd/mm/yy
    const formattedDate = formatDateDdMmYy(rawTgl.slice(0, 10)) || formatDateDdMmYy(rawTgl);

    const pdfUrl = `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(
      cleanFpb
    )}.pdf`;

    rows.push({
      fpb: cleanFpb,
      originalFpb: rawFpb,
      tgl: formattedDate,
      pchLogistik,
      armada,
      company,
      status,
      keterangan,
      isReceivedLogistik,
      pdfUrl,
    });
  }

  return rows;
}

async function processEfpbFiles(
  targetUrl: string,
  username: string,
  password: string,
  existingProcurement: ProcurementItem[] = [],
  existingArmada: ArmadaItem[] = []
) {
  let sessionCookie = '';

  // 1. Authenticate to e-FPB
  if (username && password) {
    try {
      const loginPageRes = await fetch('https://e-fpb.cindaragroup.com/login', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      const setCookieHeader = loginPageRes.headers.get('set-cookie') || '';
      const initSessMatch = setCookieHeader.match(/PHPSESSID=([^;]+)/);
      const tempSess = initSessMatch ? initSessMatch[1] : '';

      const loginHtml = await loginPageRes.text();
      const csrfName = loginHtml.split('name="csrf_name" value="')[1]?.split('"')[0] || '';
      const csrfVal = loginHtml.split('name="csrf_value" value="')[1]?.split('"')[0] || '';

      const fd = new FormData();
      if (csrfName) fd.append('csrf_name', csrfName);
      if (csrfVal) {
        fd.append('csrf_value', csrfVal);
        fd.append(csrfName, csrfVal);
      }
      fd.append('username', username);
      fd.append('password', password);

      const authRes = await fetch('https://e-fpb.cindaragroup.com/login', {
        method: 'POST',
        headers: {
          Cookie: tempSess ? `PHPSESSID=${tempSess}` : '',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: fd,
        redirect: 'manual',
        cache: 'no-store',
      });

      const authCookie = authRes.headers.get('set-cookie') || '';
      const newSessMatch = authCookie.match(/PHPSESSID=([^;]+)/);
      sessionCookie = newSessMatch ? newSessMatch[1] : tempSess;
    } catch (authErr) {
      console.warn('Autentikasi login e-FPB gagal atau dilewati:', authErr);
    }
  }

  // 2. Fetch FilesList from e-FPB
  const filesRes = await fetch(targetUrl, {
    headers: {
      ...(sessionCookie ? { Cookie: `PHPSESSID=${sessionCookie}` } : {}),
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });

  if (!filesRes.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `Gagal mengakses e-FPB FilesList (HTTP ${filesRes.status}: ${filesRes.statusText}).`,
      },
      { status: filesRes.status }
    );
  }

  const html = await filesRes.text();
  if (html.includes('class="login-box"') || html.includes('ew-login-form')) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Akses e-FPB FilesList memerlukan login. Pastikan kredensial (username/password) benar.',
      },
      { status: 401 }
    );
  }

  // 3. Parse parsed rows
  const efpbRows = parseFilesListHtml(html);

  if (efpbRows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Tidak ditemukan data berkas FPB pada halaman FilesList e-FPB.',
      },
      { status: 404 }
    );
  }

  // 4. Merge or Build Procurement & Armada Items
  const existingFpbMap = new Map<string, ProcurementItem>();
  existingProcurement.forEach((p) => {
    existingFpbMap.set(p.fpb.trim().toLowerCase(), p);
  });

  const existingArmadaFpbMap = new Map<string, ArmadaItem>();
  existingArmada.forEach((a) => {
    existingArmadaFpbMap.set(a.fpb.trim().toLowerCase(), a);
  });

  const newProcurementItems: ProcurementItem[] = [];
  const newArmadaItems: ArmadaItem[] = [];
  let updatedExistingCount = 0;

  for (const efpb of efpbRows) {
    const key = efpb.fpb.trim().toLowerCase();
    const existingProc = existingFpbMap.get(key);

    if (existingProc) {
      // Update existing record with verified logistic status if applicable
      if (efpb.isReceivedLogistik) {
        existingProc.statusCheckFpb = 'DONE';
        if (!existingProc.picCheckFpb || existingProc.picCheckFpb === '-') {
          existingProc.picCheckFpb = 'Logistik';
        }
      }
      updatedExistingCount++;
    } else {
      // Create brand new Procurement Item
      const newItem: ProcurementItem = {
        id: `efpb-live-${efpb.fpb}`,
        fpb: efpb.fpb,
        entity: efpb.company || 'CPL',
        po: '-', // Brand new FPB has no PO yet
        date: efpb.tgl,
        item: `Pengadaan Kebutuhan ${efpb.armada}`,
        peruntukan: efpb.keterangan || `Kebutuhan Operasional ${efpb.armada}`,
        lapse: 0,
        statusBadge: efpb.isReceivedLogistik
          ? 'TERDAFTAR DI e-FPB'
          : 'PROSES PENGADAAN',
        statusTone: efpb.isReceivedLogistik ? 'emerald' : 'cyan',
        picPch: '-',
        picTtb: efpb.isReceivedLogistik ? 'LOGISTIK' : '-',
        picLap: '-',
        picAdm: '-',
        picAktif: efpb.isReceivedLogistik ? 'PURCHASING' : 'LOGISTIK',
        statusPenjelasan: efpb.isReceivedLogistik
          ? 'Tercatat di e-FPB FilesList (Status: Received_Logistic)'
          : 'Tercatat di e-FPB FilesList (Proses pengadaan)',
        deptArmada: efpb.armada,
        tglFpb: efpb.tgl,
        picCheckFpb: 'e-FPB Server',
        tglCheckFpb: efpb.tgl,
        statusCheckFpb: efpb.isReceivedLogistik ? 'DONE' : 'WAITING',
      };
      newProcurementItems.push(newItem);

      // Also create matching Armada Item
      const newArm: ArmadaItem = {
        id: `efpb-arm-${efpb.fpb}`,
        fpb: efpb.fpb,
        armada: efpb.armada,
        item: `Pengadaan Kebutuhan ${efpb.armada}`,
        qtyFPB: 1,
        qtyFSTB: 0,
        selisih: 1,
        status: efpb.isReceivedLogistik ? 'e-FPB Diterima Logistik' : 'Proses Pengadaan',
        entity: efpb.company || 'CPL',
        tglFpb: efpb.tgl,
        keterangan: efpb.keterangan || `Kebutuhan Operasional ${efpb.armada}`,
        statusBadge: newItem.statusBadge,
        statusTone: newItem.statusTone,
        lapse: 0,
        picCheckFpb: 'e-FPB Server',
        tglCheckFpb: efpb.tgl,
        statusCheckFpb: newItem.statusCheckFpb,
      };
      newArmadaItems.push(newArm);
    }
  }

  // Combine datasets: newly pulled FPBs from FilesList are at the top!
  const finalProcurement = [...newProcurementItems, ...existingProcurement];
  const finalArmada = [...newArmadaItems, ...existingArmada];

  return NextResponse.json({
    success: true,
    message: `Berhasil menyinkronkan data dari e-FPB FilesList! Ditemukan ${efpbRows.length} berkas FPB (${newProcurementItems.length} nomor FPB baru ditambahkan ke antrian monitoring).`,
    totalEfpb: efpbRows.length,
    newCount: newProcurementItems.length,
    updatedCount: updatedExistingCount,
    newItems: newProcurementItems,
    newArmada: newArmadaItems,
    procurement: finalProcurement,
    armada: finalArmada,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url') || DEFAULT_FILESLIST_URL;
    const username = searchParams.get('username') || 'Hermansyah';
    const password = searchParams.get('password') || 'Biocpl24!@#';
    return await processEfpbFiles(targetUrl, username, password);
  } catch (error: any) {
    console.error('Error in GET /api/sync-efpb-files:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal memproses sinkronisasi e-FPB FilesList.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body?.url || DEFAULT_FILESLIST_URL).trim();
    const username = (body?.username || 'Hermansyah').trim();
    const password = (body?.password || 'Biocpl24!@#').trim();
    const existingProcurement = Array.isArray(body?.existingProcurement)
      ? body.existingProcurement
      : [];
    const existingArmada = Array.isArray(body?.existingArmada)
      ? body.existingArmada
      : [];

    return await processEfpbFiles(
      targetUrl,
      username,
      password,
      existingProcurement,
      existingArmada
    );
  } catch (error: any) {
    console.error('Error in POST /api/sync-efpb-files:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal memproses sinkronisasi e-FPB FilesList.',
      },
      { status: 500 }
    );
  }
}
