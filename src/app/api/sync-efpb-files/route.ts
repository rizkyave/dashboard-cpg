import { NextRequest, NextResponse } from 'next/server';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { formatDateDdMmYy } from '@/utils/formatDate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Allow up to 5 minutes for full sync (25 pages × ~18s per batch)
export const maxDuration = 300;

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

/**
 * Normalize an FPB number from e-FPB format to dashboard standard.
 * Examples:
 *   CPL/LOG/FPB/26-0004498  → CPL-FPB-26-0004498
 *   MO/LOG/FPB/26-0001751   → MO-FPB-26-0001751
 *   GAJ/LOG/FPB/26-0000976  → GAJ-FPB-26-0000976
 *   CPL-FPB-26-0004497      → CPL-FPB-26-0004497 (already clean)
 *   CPL-FPB-CPL-FPB-24-0006224 → CPL-FPB-24-0006224 (double prefix fix)
 */
function normalizeFpb(raw: string): string {
  let fpb = raw.trim();

  // Step 1: Replace /LOG/FPB/ with -FPB-
  fpb = fpb.replace(/\/LOG\/FPB\//i, '-FPB-');

  // Step 2: Fix double prefix like CPL-FPB-CPL-FPB-24-0006224
  fpb = fpb.replace(/^([A-Z]{2,4})-FPB-\1-FPB-/i, '$1-FPB-');

  // Step 3: Skip entries with multiple FPBs (e.g. "... dan ...")
  if (/\bdan\b/i.test(fpb) || fpb.includes(',')) {
    return '';
  }

  return fpb;
}

function parseFilesListHtml(html: string): ParsedEfpbFileRow[] {
  const rows: ParsedEfpbFileRow[] = [];
  const seenFpbs = new Set<string>();
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

    const cleanFpb = normalizeFpb(rawFpb);

    // Skip incomplete, truncated, or invalid FPB strings
    if (!cleanFpb || cleanFpb.length < 12 || cleanFpb.endsWith('-00') || !cleanFpb.includes('-FPB-')) {
      continue;
    }

    // Deduplicate: keep the first occurrence (most recent for received status)
    const fpbKey = cleanFpb.toLowerCase();
    if (seenFpbs.has(fpbKey)) {
      // If this duplicate is received but the existing one wasn't, update
      const isReceived = pchLogistik.toLowerCase().includes('received');
      if (isReceived) {
        const existingIdx = rows.findIndex(r => r.fpb.toLowerCase() === fpbKey);
        if (existingIdx >= 0 && !rows[existingIdx].isReceivedLogistik) {
          rows[existingIdx].isReceivedLogistik = true;
          rows[existingIdx].pchLogistik = pchLogistik;
        }
      }
      continue;
    }
    seenFpbs.add(fpbKey);

    // Check if received by logistic
    const isReceivedLogistik = pchLogistik.toLowerCase().includes('received');

    // Format date to dd/mm/yy
    const formattedDate = formatDateDdMmYy(rawTgl.slice(0, 10)) || formatDateDdMmYy(rawTgl);

    const pdfMatch = rowContent.match(/files\/[^\s"'\\]+\.pdf/i);
    const pdfUrl = pdfMatch
      ? `https://e-fpb.cindaragroup.com/${pdfMatch[0].replace(/^\/+/, '')}`
      : `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(cleanFpb)}.pdf`;

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

/**
 * Authenticate to e-FPB and return session cookie.
 */
async function authenticateEfpb(username: string, password: string): Promise<string> {
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
  return newSessMatch ? newSessMatch[1] : tempSess;
}

/**
 * Fetch a single page from FilesList
 */
async function fetchFilesListPage(
  sessionCookie: string,
  page: number,
  recPerPage: number
): Promise<string> {
  const url = `https://e-fpb.cindaragroup.com/FilesList?page=${page}&recperpage=${recPerPage}`;
  const res = await fetch(url, {
    headers: {
      Cookie: `PHPSESSID=${sessionCookie}`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });
  if (!res.ok) return '';
  return res.text();
}

/**
 * Build ProcurementItem and ArmadaItem from parsed e-FPB row
 */
function buildItems(efpb: ParsedEfpbFileRow): { proc: ProcurementItem; arm: ArmadaItem } {
  const proc: ProcurementItem = {
    id: `efpb-live-${efpb.fpb}`,
    fpb: efpb.fpb,
    entity: efpb.company || 'CPL',
    po: '-',
    date: efpb.tgl,
    item: `Pengadaan Kebutuhan ${efpb.armada}`,
    peruntukan: efpb.keterangan || `Kebutuhan Operasional ${efpb.armada}`,
    lapse: 0,
    statusBadge: efpb.isReceivedLogistik ? 'TERDAFTAR DI e-FPB' : 'PROSES PENGADAAN',
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

  const arm: ArmadaItem = {
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
    statusBadge: proc.statusBadge,
    statusTone: proc.statusTone,
    lapse: 0,
    picCheckFpb: 'e-FPB Server',
    tglCheckFpb: efpb.tgl,
    statusCheckFpb: proc.statusCheckFpb,
  };

  return { proc, arm };
}

/**
 * Process e-FPB files - supports both quick (1 page) and full (all pages) modes.
 */
async function processEfpbFiles(
  targetUrl: string,
  username: string,
  password: string,
  mode: 'quick' | 'full' = 'quick'
) {
  let sessionCookie = '';

  // 1. Authenticate to e-FPB
  if (username && password) {
    try {
      sessionCookie = await authenticateEfpb(username, password);
    } catch (authErr) {
      console.warn('Autentikasi login e-FPB gagal atau dilewati:', authErr);
    }
  }

  // 2. Fetch FilesList from e-FPB
  let allRows: ParsedEfpbFileRow[] = [];

  if (mode === 'full') {
    // Full mode: fetch all pages with recperpage=1000 in parallel batches
    const recPerPage = 1000;
    const batchSize = 5;

    // First, fetch page 1 to determine total pages
    const page1Html = await fetchFilesListPage(sessionCookie, 1, recPerPage);
    if (!page1Html || page1Html.includes('class="login-box"') || page1Html.includes('ew-login-form')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses e-FPB FilesList memerlukan login. Pastikan kredensial (username/password) benar.',
        },
        { status: 401 }
      );
    }

    // Determine total pages from pagination links
    const pageLinks: number[] = [];
    const pageRegex = /FilesList\?page=(\d+)/gi;
    let pageMatch: RegExpExecArray | null;
    while ((pageMatch = pageRegex.exec(page1Html)) !== null) {
      pageLinks.push(parseInt(pageMatch[1], 10));
    }
    const totalPages = pageLinks.length > 0 ? Math.max(...pageLinks) : 1;
    console.log(`[Full Sync] Total pages detected: ${totalPages} (${recPerPage}/page)`);

    // Parse page 1
    allRows.push(...parseFilesListHtml(page1Html));

    // Fetch remaining pages in parallel batches
    if (totalPages > 1) {
      const remainingPages: number[] = [];
      for (let p = 2; p <= totalPages; p++) {
        remainingPages.push(p);
      }

      for (let i = 0; i < remainingPages.length; i += batchSize) {
        const batch = remainingPages.slice(i, i + batchSize);
        console.log(`[Full Sync] Fetching batch: pages ${batch.join(', ')}...`);

        const htmlResults = await Promise.all(
          batch.map((page) => fetchFilesListPage(sessionCookie, page, recPerPage))
        );

        for (const html of htmlResults) {
          if (html && html.length > 0) {
            allRows.push(...parseFilesListHtml(html));
          }
        }
      }
    }

    // Deduplicate across all pages (some FPBs may appear on multiple pages)
    const seenFinal = new Set<string>();
    const deduped: ParsedEfpbFileRow[] = [];
    for (const row of allRows) {
      const key = row.fpb.toLowerCase();
      if (!seenFinal.has(key)) {
        seenFinal.add(key);
        deduped.push(row);
      } else {
        // If the new row is received but existing isn't, update
        if (row.isReceivedLogistik) {
          const existingIdx = deduped.findIndex((r) => r.fpb.toLowerCase() === key);
          if (existingIdx >= 0 && !deduped[existingIdx].isReceivedLogistik) {
            deduped[existingIdx].isReceivedLogistik = true;
            deduped[existingIdx].pchLogistik = row.pchLogistik;
          }
        }
      }
    }
    allRows = deduped;
  } else {
    // Quick mode: fetch only the default page (20 most recent)
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
          message: 'Akses e-FPB FilesList memerlukan login. Pastikan kredensial (username/password) benar.',
        },
        { status: 401 }
      );
    }

    allRows = parseFilesListHtml(html);
  }

  if (allRows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'Tidak ditemukan data berkas FPB pada halaman FilesList e-FPB.',
      },
      { status: 404 }
    );
  }

  // 3. Build Procurement & Armada Items from all parsed rows
  const newProcurementItems: ProcurementItem[] = [];
  const newArmadaItems: ArmadaItem[] = [];

  for (const efpb of allRows) {
    const { proc, arm } = buildItems(efpb);
    newProcurementItems.push(proc);
    newArmadaItems.push(arm);
  }

  // Company breakdown for reporting
  const byCompany: Record<string, number> = {};
  for (const row of allRows) {
    byCompany[row.company] = (byCompany[row.company] || 0) + 1;
  }

  const receivedCount = allRows.filter((r) => r.isReceivedLogistik).length;
  const modeLabel = mode === 'full' ? 'FULL SYNC' : 'Quick Sync';

  return NextResponse.json({
    success: true,
    mode,
    message: `[${modeLabel}] Berhasil mengambil ${allRows.length} nomor FPB unik dari e-FPB FilesList!`,
    totalEfpb: allRows.length,
    newCount: newProcurementItems.length,
    receivedCount,
    byCompany,
    newItems: newProcurementItems,
    newArmada: newArmadaItems,
    // For backward compat (quick mode used these)
    procurement: newProcurementItems,
    armada: newArmadaItems,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url') || DEFAULT_FILESLIST_URL;
    const username = searchParams.get('username') || 'Hermansyah';
    const password = searchParams.get('password') || 'Biocpl24!@#';
    const mode = (searchParams.get('mode') as 'quick' | 'full') || 'quick';
    return await processEfpbFiles(targetUrl, username, password, mode);
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
    const mode = (body?.mode as 'quick' | 'full') || 'quick';

    return await processEfpbFiles(targetUrl, username, password, mode);
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
