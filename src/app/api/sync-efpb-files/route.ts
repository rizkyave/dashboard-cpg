import { NextRequest, NextResponse } from 'next/server';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { formatDateDdMmYy } from '@/utils/formatDate';
import { FpbAttachment } from '@/types/fpbReview';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Allow up to 5 minutes for full sync (25 pages × ~18s per batch)
export const maxDuration = 300;

const DEFAULT_FILESLIST_URL = 'https://e-fpb.cindaragroup.com/FilesList';

// ============================================================
// Session Cache: reuse PHPSESSID agar tidak login berulang
// Session e-FPB biasanya valid 4 jam — kita simpan 3.5 jam
// ============================================================
interface SessionCache {
  sessionId: string;
  username: string;
  cachedAt: number; // Date.now()
}

const SESSION_TTL_MS = 3.5 * 60 * 60 * 1000; // 3.5 jam dalam ms
let _sessionCache: SessionCache | null = null;

function getCachedSession(username: string): string | null {
  if (!_sessionCache) return null;
  if (_sessionCache.username !== username) return null;
  const age = Date.now() - _sessionCache.cachedAt;
  if (age > SESSION_TTL_MS) {
    _sessionCache = null;
    return null;
  }
  return _sessionCache.sessionId;
}

function setCachedSession(username: string, sessionId: string) {
  _sessionCache = { sessionId, username, cachedAt: Date.now() };
}

function clearSessionCache() {
  _sessionCache = null;
}

interface ParsedEfpbFileRow {
  fpb: string;
  originalFpb: string;
  tgl: string;
  rawDate: string;
  timestamp: number;
  pchLogistik: string;
  armada: string;
  company: string;
  status: string;
  keterangan: string;
  isReceivedLogistik: boolean;
  pdfUrl: string;
  attachments?: FpbAttachment[];
  isRevised?: boolean;
  revisionCount?: number;
  revisionNote?: string;
}

/**
 * Robustly parses various date formats from e-FPB:
 * e.g., "26/09/26 13:48", "26/10/2026 14:15", "2026-09-26 13:48:00"
 */
function parseEfpbTimestamp(rawDate: string): number {
  if (!rawDate) return 0;
  const clean = rawDate.trim();

  // Format 1: DD/MM/YY or DD/MM/YYYY with optional HH:mm or HH:mm:ss
  const dmyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += 2000;
    }
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // Format 2: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const parsed = Date.parse(clean);
  return isNaN(parsed) ? 0 : parsed;
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

/**
 * Deduplicate rows strictly:
 * If multiple postings exist for the same FPB number (due to revisions or double posting on e-FPB),
 * ONLY keep the newest record (based on timestamp).
 * Preserve merged fields:
 * - isReceivedLogistik (if ANY posting has received logistic status, preserve it)
 * - pchLogistik
 * - attachments (merge without duplicates, preferring newest)
 * - flag as revised (isRevised = true, revisionCount, revisionNote)
 */
function deduplicateEfpbRows(rows: ParsedEfpbFileRow[]): ParsedEfpbFileRow[] {
  const dedupedMap = new Map<string, ParsedEfpbFileRow>();

  for (const row of rows) {
    const key = row.fpb.toLowerCase();
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, { ...row });
    } else {
      const existing = dedupedMap.get(key)!;
      const revCount = (existing.revisionCount || 1) + (row.revisionCount ? (row.revisionCount - 1) : 1);
      const combinedReceived = existing.isReceivedLogistik || row.isReceivedLogistik;
      const combinedPch = row.pchLogistik || existing.pchLogistik;

      // Safely merge attachments without duplicates
      const mergedAtts = [...(existing.attachments || [])];
      for (const att of (row.attachments || [])) {
        if (!mergedAtts.some((a) => a.url === att.url || a.name === att.name)) {
          mergedAtts.push(att);
        }
      }

      if (row.timestamp > existing.timestamp) {
        // Newer row completely replaces older row
        dedupedMap.set(key, {
          ...row,
          pchLogistik: combinedPch,
          isReceivedLogistik: combinedReceived,
          attachments: mergedAtts,
          isRevised: true,
          revisionCount: revCount,
          revisionNote: `Revisi e-FPB (${revCount}x): Mengambil data terbaru tgl ${row.tgl || row.rawDate} (menggantikan postingan lama tgl ${existing.tgl || existing.rawDate}).`,
        });
      } else {
        // Existing row is already newer. Keep existing, but merge received status and attachments
        existing.isRevised = true;
        existing.revisionCount = revCount;
        existing.isReceivedLogistik = combinedReceived;
        if (!existing.pchLogistik && row.pchLogistik) existing.pchLogistik = row.pchLogistik;
        existing.attachments = mergedAtts;
        existing.revisionNote = `Revisi e-FPB (${revCount}x): Mengambil data terbaru tgl ${existing.tgl || existing.rawDate} (postingan lain tgl ${row.tgl || row.rawDate} dilewati).`;
      }
    }
  }

  return Array.from(dedupedMap.values());
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

    const cleanFpb = normalizeFpb(rawFpb);

    // Skip incomplete, truncated, or invalid FPB strings
    if (!cleanFpb || cleanFpb.length < 12 || cleanFpb.endsWith('-00') || !cleanFpb.includes('-FPB-')) {
      continue;
    }

    // Deduplicate: prioritaskan file dengan tanggal & waktu terkini
    const timestamp = parseEfpbTimestamp(rawTgl);
    const isReceivedLogistik = pchLogistik.toLowerCase().includes('received');
    const formattedDate = formatDateDdMmYy(rawTgl.slice(0, 10)) || formatDateDdMmYy(rawTgl);

    const allPdfs = Array.from(rowContent.matchAll(/files\/[^\s"'\\]+\.pdf/gi)).map((m) =>
      m[0].replace(/^\/+/, '')
    );
    // Find PDF specifically matching cleanFpb or primary document (avoiding attachment names like LAMPIRAN)
    const primaryPdf =
      allPdfs.find((p) => {
        const lower = p.toLowerCase();
        return (
          lower.includes(cleanFpb.toLowerCase()) &&
          !lower.includes('lampiran') &&
          !lower.includes('foto')
        );
      }) ||
      allPdfs.find((p) => {
        const lower = p.toLowerCase();
        return !lower.includes('lampiran') && !lower.includes('foto') && !lower.includes('avatar') && !lower.includes('logo');
      }) ||
      allPdfs[0];

    const pdfUrl = primaryPdf
      ? `https://e-fpb.cindaragroup.com/${primaryPdf}`
      : `https://e-fpb.cindaragroup.com/files/${encodeURIComponent(cleanFpb)}.pdf`;

    // Ekstraksi berkas lampiran (Attachment & Foto Fisik dari Kotak Hitam e-FPB)
    const fileMatches = Array.from(
      rowContent.matchAll(/(?:href|src)=["']([^"']+\.(?:jpe?g|png|webp|gif|bmp|pdf))["']/gi)
    ).map((m) => m[1]);
    const directFileMatches = rowContent.match(/(?:files|uploads)\/[^\s"'<>\\]+\.(?:jpe?g|png|webp|gif|bmp|pdf)/gi) || [];
    const allCandidates = Array.from(new Set([...fileMatches, ...directFileMatches]));

    const extractedAttachments: FpbAttachment[] = [];
    allCandidates.forEach((rawPath, attIdx) => {
      const cleanPath = rawPath.replace(/^\/+/, '');
      const lower = cleanPath.toLowerCase();

      // Abaikan berkas formulir PDF utama (Approved_...sign_...pdf atau file sama dengan primaryPdf) dan logo web
      if (primaryPdf && cleanPath.toLowerCase() === primaryPdf.toLowerCase()) return;
      if (lower.includes('approved_') && lower.includes('sign_')) return;
      if (lower.includes('logo') || lower.includes('company_group') || lower.includes('avatar') || lower.includes('icon')) return;

      const fullUrl = cleanPath.startsWith('http')
        ? cleanPath
        : `https://e-fpb.cindaragroup.com/${cleanPath}`;

      const fileName = cleanPath.split('/').pop() || `lampiran_${attIdx + 1}`;
      const isImg = /\.(jpe?g|png|webp|gif|bmp)$/i.test(fileName);
      const isPdf = /\.pdf$/i.test(fileName);

      extractedAttachments.push({
        id: `efpb-att-${cleanFpb}-${attIdx + 1}`,
        name: decodeURIComponent(fileName),
        url: fullUrl,
        type: isImg ? 'image' : isPdf ? 'pdf' : 'document',
        uploadedAt: rawTgl || new Date().toISOString(),
        uploadedBy: 'FPB Maker (e-FPB)',
        source: 'EFPB_MAKER',
        caption: isImg ? 'Foto Fisik Kerusakan / Barang' : 'Dokumen / Scan Lampiran FPB',
      });
    });

    rows.push({
      fpb: cleanFpb,
      originalFpb: rawFpb,
      tgl: formattedDate,
      rawDate: rawTgl,
      timestamp,
      pchLogistik,
      armada,
      company,
      status,
      keterangan,
      isReceivedLogistik,
      pdfUrl,
      attachments: extractedAttachments,
    });
  }

  // Deduplikasi baris dalam 1 halaman: pastikan hanya data terbaru yang disimpan
  return deduplicateEfpbRows(rows);
}

/**
 * Authenticate to e-FPB and return session cookie.
 * Uses in-memory session cache to avoid repeated logins (prevents account lock).
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

  const authHtml = await authRes.text();
  if (authHtml.includes('Account is locked') || authHtml.includes('retry count')) {
    throw new Error('Akun e-FPB terkunci sementara oleh sistem (kelebihan batas login). Silakan tunggu 20 menit atau masukkan Cookie PHPSESSID dari browser.');
  }
  if (authHtml.includes('Incorrect') || authHtml.includes('alert-danger')) {
    throw new Error('Username atau password e-FPB salah. Silakan periksa kembali kredensial Anda.');
  }

  const finalSession = newSessMatch ? newSessMatch[1] : tempSess;

  // Cache successful session
  if (finalSession) {
    setCachedSession(username, finalSession);
    console.log(`[e-FPB] Login berhasil. Session di-cache selama 3.5 jam.`);
  }

  return finalSession;
}

/**
 * Check if a session cookie is still valid by testing access to FilesList.
 * Returns true if valid, false if redirected to login page.
 */
async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch('https://e-fpb.cindaragroup.com/FilesList?page=1&recperpage=1', {
      headers: {
        Cookie: `PHPSESSID=${sessionId}`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const html = await res.text();
    const isLoginPage = html.includes('class="login-box"') || html.includes('ew-login-form') || html.includes('name="username"');
    return !isLoginPage;
  } catch {
    return false;
  }
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
    isRevised: efpb.isRevised,
    revisionCount: efpb.revisionCount,
    revisionNote: efpb.revisionNote,
    pdfUrl: efpb.pdfUrl,
    timestamp: efpb.timestamp,
    ...(efpb.attachments && efpb.attachments.length > 0 ? { attachments: efpb.attachments } : {}),
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
    isRevised: efpb.isRevised,
    revisionCount: efpb.revisionCount,
    revisionNote: efpb.revisionNote,
    timestamp: efpb.timestamp,
    ...(efpb.attachments && efpb.attachments.length > 0 ? { attachments: efpb.attachments } : {}),
  };

  return { proc, arm };
}

/**
 * Process e-FPB files - supports both quick (1 page) and full (all pages) modes.
 * Uses session cache to avoid repeated logins.
 */
async function processEfpbFiles(
  targetUrl: string,
  username: string,
  password: string,
  mode: 'quick' | 'full' = 'quick',
  explicitSessionId?: string
) {
  let sessionCookie = explicitSessionId?.trim() || '';

  // 1. Resolve session: explicit > cache > fresh login
  if (!sessionCookie) {
    // Try cached session first
    const cached = getCachedSession(username);
    if (cached) {
      const stillValid = await isSessionValid(cached);
      if (stillValid) {
        sessionCookie = cached;
        console.log('[e-FPB] Menggunakan session cache (tidak perlu login ulang).');
      } else {
        console.log('[e-FPB] Session cache kedaluwarsa. Login ulang...');
        clearSessionCache();
      }
    }
  } else {
    // Explicit session provided — update cache for future reuse
    setCachedSession(username, sessionCookie);
  }

  // 2. If still no session, authenticate fresh
  if (!sessionCookie && username && password) {
    try {
      sessionCookie = await authenticateEfpb(username, password);
    } catch (authErr: any) {
      console.warn('Autentikasi login e-FPB gagal:', authErr?.message);
      return NextResponse.json(
        {
          success: false,
          requiresAuth: true,
          message: authErr?.message || 'Gagal login ke server e-FPB.',
        },
        { status: 401 }
      );
    }
  }

  // 3. Fetch FilesList from e-FPB
  // Helper: detect login page redirect (session expired mid-request)
  const isLoginRedirect = (html: string) =>
    html.includes('class="login-box"') || html.includes('ew-login-form') || html.includes('name="username"');

  // Helper: re-authenticate and retry once if session expired during fetch
  const fetchWithSessionRetry = async (
    fetchFn: (session: string) => Promise<string>
  ): Promise<{ html: string; newSession: string }> => {
    let html = await fetchFn(sessionCookie);
    if (isLoginRedirect(html) && username && password) {
      console.log('[e-FPB] Session kedaluwarsa saat fetch. Re-login...');
      clearSessionCache();
      sessionCookie = await authenticateEfpb(username, password);
      html = await fetchFn(sessionCookie);
    }
    return { html, newSession: sessionCookie };
  };

  let allRows: ParsedEfpbFileRow[] = [];

  if (mode === 'full') {
    // Full mode: fetch all pages with recperpage=1000 in parallel batches
    const recPerPage = 1000;
    const batchSize = 5;

    // First, fetch page 1 to determine total pages (with session retry)
    const { html: page1Html } = await fetchWithSessionRetry((sess) =>
      fetchFilesListPage(sess, 1, recPerPage)
    );
    if (!page1Html || isLoginRedirect(page1Html)) {
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
    allRows = deduplicateEfpbRows(allRows);
  } else {
    // Quick mode: fetch only the default page (20 most recent) with session retry
    const quickFetch = async (sess: string) => {
      const res = await fetch(targetUrl, {
        headers: {
          ...(sess ? { Cookie: `PHPSESSID=${sess}` } : {}),
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.text();
    };

    let html: string;
    try {
      const result = await fetchWithSessionRetry(quickFetch);
      html = result.html;
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          message: `Gagal mengakses e-FPB FilesList: ${err.message}`,
        },
        { status: 502 }
      );
    }

    if (isLoginRedirect(html)) {
      clearSessionCache();
      return NextResponse.json(
        {
          success: false,
          requiresAuth: true,
          message: 'Akses e-FPB FilesList memerlukan login. Pastikan kredensial (username/password) benar.',
        },
        { status: 401 }
      );
    }

    allRows = deduplicateEfpbRows(parseFilesListHtml(html));
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
  const sessionAge = _sessionCache ? Math.round((Date.now() - _sessionCache.cachedAt) / 60000) : 0;

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
    // Session info
    sessionCached: Boolean(_sessionCache),
    sessionAgeMinutes: sessionAge,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url') || DEFAULT_FILESLIST_URL;
    const username = searchParams.get('username') || 'Hermansyah';
    const password = searchParams.get('password') || 'Biocpl24!@#';
    const sessionId = searchParams.get('sessionId') || searchParams.get('cookie') || '';
    const mode = (searchParams.get('mode') as 'quick' | 'full') || 'quick';
    return await processEfpbFiles(targetUrl, username, password, mode, sessionId);
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
    const sessionId = (body?.sessionId || body?.cookie || '').trim();
    const mode = (body?.mode as 'quick' | 'full') || 'quick';

    return await processEfpbFiles(targetUrl, username, password, mode, sessionId);
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
