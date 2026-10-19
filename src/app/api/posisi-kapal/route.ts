import { NextRequest, NextResponse } from 'next/server';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BASE_URL = 'https://cindara.beruangmadutech.web.id';
const DEFAULT_USERNAME = 'logistik';
const DEFAULT_PASSWORD = '12345';
const R2_POSISI_KAPAL_KEY = 'dashboard-metadata/posisi-kapal.json';

interface ParsedDailyResult {
  items: KapalPosisiItem[];
  summary: KapalPosisiSummary;
}

async function loadFromR2(): Promise<ParsedDailyResult | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_POSISI_KAPAL_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          summary: parsed.summary,
        };
      }
    }
  } catch (err) {
    console.warn('Gagal membaca posisi-kapal dari Cloudflare R2:', err);
  }
  return null;
}

async function saveToR2(items: KapalPosisiItem[], summary: KapalPosisiSummary): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    const payload = JSON.stringify({ items, summary, savedAt: new Date().toISOString() });
    await uploadToR2({
      key: R2_POSISI_KAPAL_KEY,
      body: Buffer.from(payload, 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan posisi-kapal ke Cloudflare R2:', err);
    return false;
  }
}

function parseDailyReportHtml(html: string): ParsedDailyResult {
  const items: KapalPosisiItem[] = [];
  const trRegex = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let totalON = 0;
  let totalSB = 0;
  let totalMT = 0;
  let totalBD = 0;
  let totalDK = 0;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const attrs = trMatch[1];
    const content = trMatch[2];

    if (!attrs.includes('data-kapal')) continue;

    const kapalAttrMatch = attrs.match(/data-kapal="([^"]*)"/);
    const statusAttrMatch = attrs.match(/data-status="([^"]*)"/);
    const detailAttrMatch = attrs.match(/data-detail="([^"]*)"/);
    const tanggalAttrMatch = attrs.match(/data-tanggal="([^"]*)"/);

    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(content)) !== null) {
      tds.push(tdMatch[1]);
    }

    // TD 0: Nama Kapal & Call Sign
    const tdNama = tds[0] || '';
    const namaKapalClean = tdNama
      .replace(/<div[\s\S]*$/i, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const callsignMatch = tdNama.match(/<span[^>]*class="[^"]*badge[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const callsign = callsignMatch ? callsignMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // TD 1: Posisi
    const posisi = (tds[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // TD 2: Activity
    const activity = (tds[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Status: ON / SB / MT / BD / DK
    const statusKode = (statusAttrMatch ? statusAttrMatch[1] : '').toUpperCase().trim();
    const detailStatus = detailAttrMatch ? detailAttrMatch[1].trim() : '';
    const tanggal = tanggalAttrMatch ? tanggalAttrMatch[1].trim() : '';

    // TD 8: Performa (%)
    const performa = (tds[8] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // TD 9: Kerusakan / Pekerjaan
    const kerusakan = (tds[9] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // TD 10: Keterangan
    const keterangan = (tds[10] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const kapalSlug = kapalAttrMatch ? kapalAttrMatch[1] : namaKapalClean.toLowerCase();

    if (statusKode === 'ON') totalON++;
    else if (statusKode === 'SB') totalSB++;
    else if (statusKode === 'MT') totalMT++;
    else if (statusKode === 'BD') totalBD++;
    else if (statusKode === 'DK') totalDK++;

    items.push({
      id: `fms-${kapalSlug}-${tanggal || Date.now()}`,
      kapalSlug,
      namaKapal: namaKapalClean || 'KAPAL',
      callsign,
      posisi: posisi || '-',
      activity: activity || '-',
      statusKode: statusKode || 'SB',
      detailStatus: detailStatus || '',
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      performa: performa || '-',
      kerusakan: kerusakan || '-',
      keterangan: keterangan || '-',
    });
  }

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const summary: KapalPosisiSummary = {
    totalKapal: items.length,
    totalON,
    totalSB,
    totalMT,
    totalBD,
    totalDK,
    lastUpdated: timeStr,
  };

  return { items, summary };
}

async function scrapeDailyReport(username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD): Promise<ParsedDailyResult> {
  // Step 1: GET /login to get initial PHPSESSID and CSRF token
  const getLoginRes = await fetch(`${DEFAULT_BASE_URL}/login`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });

  const getSetCookies = getLoginRes.headers.getSetCookie
    ? getLoginRes.headers.getSetCookie()
    : [getLoginRes.headers.get('set-cookie')];

  const cookiesMap: Record<string, string> = {};
  getSetCookies.filter(Boolean).forEach((c) => {
    if (!c) return;
    const [kv] = c.split(';');
    const [k, v] = kv.split('=');
    if (k && v) cookiesMap[k.trim()] = v.trim();
  });

  const loginHtml = await getLoginRes.text();
  const csrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  const csrf = csrfMatch ? csrfMatch[1] : '';

  if (!csrf) {
    throw new Error('Gagal mengambil CSRF Token dari halaman login Fleet Management System.');
  }

  const cookieStr = Object.entries(cookiesMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  // Step 2: POST credentials to /login (no Origin/Referer to avoid CSRF check failure)
  const postRes = await fetch(`${DEFAULT_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieStr,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: `_csrf=${encodeURIComponent(csrf)}&username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`,
    redirect: 'manual',
    cache: 'no-store',
  });

  const postSetCookies = postRes.headers.getSetCookie
    ? postRes.headers.getSetCookie()
    : [postRes.headers.get('set-cookie')];

  if (postSetCookies) {
    postSetCookies.filter(Boolean).forEach((c) => {
      if (!c) return;
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      if (k && v) cookiesMap[k.trim()] = v.trim();
    });
  }

  const authCookieStr = Object.entries(cookiesMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  // Step 3: Fetch Daily Report page (/voyage/daily_index)
  const dailyRes = await fetch(`${DEFAULT_BASE_URL}/voyage/daily_index`, {
    headers: {
      Cookie: authCookieStr,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });

  if (!dailyRes.ok) {
    throw new Error(`Gagal memuat halaman Daily Report (${dailyRes.status}: ${dailyRes.statusText}).`);
  }

  const dailyHtml = await dailyRes.text();
  if (dailyHtml.includes('Akses ditolak') || dailyHtml.includes('403')) {
    throw new Error('Akses ditolak (403) ke modul voyage_daily. Periksa perizinan user.');
  }

  const result = parseDailyReportHtml(dailyHtml);
  // Auto-save to R2
  if (result.items.length > 0) {
    await saveToR2(result.items, result.summary);
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true' || searchParams.get('sync') === 'true';

    // Jika tidak dipaksa re-scrape, coba ambil cache cloud dari R2 terlebih dahulu
    if (!force) {
      const cached = await loadFromR2();
      if (cached && cached.items.length > 0) {
        return NextResponse.json({
          success: true,
          fromCloud: true,
          message: `Berhasil mengambil data Posisi Kapal (${cached.items.length} kapal) dari Cloudflare R2.`,
          ...cached,
        });
      }
    }

    const username = searchParams.get('username') || DEFAULT_USERNAME;
    const password = searchParams.get('password') || DEFAULT_PASSWORD;

    const data = await scrapeDailyReport(username, password);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil data Daily Report Posisi Kapal (${data.items.length} kapal) & tersinkron ke R2.`,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching Daily Report Posisi Kapal:', error);
    // Jika scraping gagal, coba fallback ke R2
    const fallback = await loadFromR2();
    if (fallback && fallback.items.length > 0) {
      return NextResponse.json({
        success: true,
        fromCloudFallback: true,
        message: 'Menggunakan data posisi kapal terakhir dari Cloudflare R2.',
        ...fallback,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal menyinkronkan data Posisi Kapal.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Jika client mengirim data langsung untuk disimpan
    if (Array.isArray(body?.items) && body.items.length > 0) {
      const summary = body.summary || {
        totalKapal: body.items.length,
        totalON: 0,
        totalSB: 0,
        totalMT: 0,
        totalBD: 0,
        totalDK: 0,
        lastUpdated: new Date().toLocaleTimeString('id-ID'),
      };
      await saveToR2(body.items, summary);
      return NextResponse.json({
        success: true,
        message: 'Data Posisi Kapal berhasil disimpan ke Cloudflare R2.',
        items: body.items,
        summary,
      });
    }

    const username = (body?.username || DEFAULT_USERNAME).trim();
    const password = (body?.password || DEFAULT_PASSWORD).trim();

    const data = await scrapeDailyReport(username, password);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil data Daily Report Posisi Kapal (${data.items.length} kapal) & tersinkron ke R2.`,
      ...data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/posisi-kapal:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal menyinkronkan data Posisi Kapal.',
      },
      { status: 500 }
    );
  }
}

