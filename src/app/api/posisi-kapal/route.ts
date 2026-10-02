import { NextRequest, NextResponse } from 'next/server';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BASE_URL = 'https://cindara.beruangmadutech.web.id';
const DEFAULT_USERNAME = 'logistik';
const DEFAULT_PASSWORD = '12345';

interface ParsedDailyResult {
  items: KapalPosisiItem[];
  summary: KapalPosisiSummary;
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

  return parseDailyReportHtml(dailyHtml);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || DEFAULT_USERNAME;
    const password = searchParams.get('password') || DEFAULT_PASSWORD;

    const data = await scrapeDailyReport(username, password);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil data Daily Report Posisi Kapal (${data.items.length} kapal).`,
      ...data,
    });
  } catch (error: any) {
    console.error('Error fetching Daily Report Posisi Kapal:', error);
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
    const username = (body?.username || DEFAULT_USERNAME).trim();
    const password = (body?.password || DEFAULT_PASSWORD).trim();

    const data = await scrapeDailyReport(username, password);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil data Daily Report Posisi Kapal (${data.items.length} kapal).`,
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
