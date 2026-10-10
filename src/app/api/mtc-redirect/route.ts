import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory cache agar klik berikutnya instan tanpa hitung ulang
const resolvedMtcCache = new Map<string, string>();

let mtcCookie: string | null = null;
let lastLoginTime = 0;

async function requestText(url: string, options: RequestInit = {}): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
  });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

async function ensureMtcSession(): Promise<string | null> {
  const now = Date.now();
  if (mtcCookie && now - lastLoginTime < 15 * 60 * 1000) {
    return mtcCookie;
  }

  try {
    // 1. GET /login untuk mengambil cookies dan CSRF token
    const loginPageRes = await fetch('https://mtc.cindaragroup.com/login', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    const setCookie = loginPageRes.headers.get('set-cookie') || '';
    const rawCookie = setCookie ? setCookie.split(';')[0] : '';
    const html = await loginPageRes.text();

    const csrfNameMatch = html.match(/name="csrf_name"\s+value="([^"]+)"/);
    const csrfValueMatch = html.match(/name="csrf_value"\s+value="([^"]+)"/);

    if (!csrfNameMatch || !csrfValueMatch) {
      return rawCookie || null;
    }

    const csrfName = csrfNameMatch[1];
    const csrfValue = csrfValueMatch[1];

    // 2. POST /login dengan guest & 0123
    const postBody = new URLSearchParams({
      csrf_name: csrfName,
      csrf_value: csrfValue,
      username: 'guest',
      password: '0123',
    });

    const postRes = await fetch('https://mtc.cindaragroup.com/login', {
      method: 'POST',
      body: postBody,
      cache: 'no-store',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': rawCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://mtc.cindaragroup.com/login',
      },
    });

    const newSetCookie = postRes.headers.get('set-cookie');
    mtcCookie = newSetCookie ? newSetCookie.split(';')[0] : rawCookie;
    lastLoginTime = now;
    return mtcCookie;
  } catch (err) {
    console.error('Error logging into MTC:', err);
    return mtcCookie;
  }
}

async function resolveExactMtcUrl(evidence: string): Promise<string> {
  const clean = evidence.trim().toUpperCase();
  if (resolvedMtcCache.has(clean)) {
    return resolvedMtcCache.get(clean)!;
  }

  const isDarat = clean.startsWith('CPG-SRD');
  const endpoint = isDarat ? 'ViewSrd' : 'ViewSrl';

  const numMatch = clean.match(/(\d+)/);
  if (!numMatch) {
    const defaultUrl = `https://mtc.cindaragroup.com/${endpoint}`;
    resolvedMtcCache.set(clean, defaultUrl);
    return defaultUrl;
  }

  const targetNum = parseInt(numMatch[1], 10);
  const cookie = await ensureMtcSession();

  // Initial estimate
  let currentId = isDarat ? (targetNum >= 6000 ? targetNum + 3 : targetNum + 2) : targetNum + 12;

  const printEndpoint = isDarat ? 'PrintSrd' : 'PrintSrl';

  if (cookie) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const pageRes = await fetch(`https://mtc.cindaragroup.com/${endpoint}?id=${currentId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
        });

        const html = await pageRes.text();
        const match =
          html.match(/Service Report - (CPG-SR[MD]-\d+)/i) ||
          html.match(/(CPG-SR[MD]-\d+)/i);

        if (!match) break;

        const foundCode = match[1].toUpperCase();
        if (foundCode === clean) {
          const finalUrl = `https://mtc.cindaragroup.com/${printEndpoint}?id=${currentId}`;
          resolvedMtcCache.set(clean, finalUrl);
          return finalUrl;
        }

        const foundNumMatch = foundCode.match(/(\d+)/);
        if (!foundNumMatch) break;
        const foundNum = parseInt(foundNumMatch[1], 10);
        const diff = targetNum - foundNum;
        if (diff === 0) {
          const finalUrl = `https://mtc.cindaragroup.com/${printEndpoint}?id=${currentId}`;
          resolvedMtcCache.set(clean, finalUrl);
          return finalUrl;
        }

        // Geser ID sesuai selisihnya
        currentId += diff;
      } catch (err) {
        console.error('Error probing MTC ID:', err);
        break;
      }
    }
  }

  // Fallback ke calculated ID jika MTC tidak merespons
  const fallbackUrl = `https://mtc.cindaragroup.com/${printEndpoint}?id=${currentId}`;
  resolvedMtcCache.set(clean, fallbackUrl);
  return fallbackUrl;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const evidence = searchParams.get('evidence');

    if (!evidence) {
      return NextResponse.redirect('https://mtc.cindaragroup.com/', 302);
    }

    const clean = evidence.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return NextResponse.redirect(clean, 302);
    }

    const exactUrl = await resolveExactMtcUrl(clean);
    return NextResponse.redirect(exactUrl, 302);
  } catch (error: any) {
    console.error('Gagal redirect MTC:', error);
    return NextResponse.redirect('https://mtc.cindaragroup.com/', 302);
  }
}

