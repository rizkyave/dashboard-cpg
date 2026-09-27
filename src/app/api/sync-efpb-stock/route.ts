import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseInventoryWorkbook, calculateInventorySummary, determineCategory } from '@/utils/inventoryParser';
import { InventoryItem } from '@/types/procurement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_EFPB_URL = 'https://e-fpb.cindaragroup.com/KodeItemForAccurateList';

function parseEfpbHtmlTable(html: string): InventoryItem[] {
  const items: InventoryItem[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  let idx = 0;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowContent = trMatch[1];
    if (
      rowContent.includes('<th') ||
      !rowContent.includes('<td') ||
      rowContent.includes('{{') ||
      rowContent.includes('<script')
    ) {
      continue;
    }

    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      tds.push(
        tdMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .trim()
      );
    }

    if (tds.length >= 2) {
      let code = '';
      let name = '';
      let satuan = '';
      let cat = '';

      if (/^\d+\.?$/.test(tds[0])) {
        code = tds[1] || '';
        name = tds[2] || '';
        satuan = tds[3] || 'PCS';
        cat = tds[4] || '';
      } else {
        code = tds[0] || '';
        name = tds[1] || '';
        satuan = tds[2] || 'PCS';
        cat = tds[3] || '';
      }

      if (
        code &&
        name &&
        !code.includes('{{') &&
        !name.includes('{{') &&
        code.length < 60
      ) {
        idx++;
        items.push({
          id: `efpb-${idx}`,
          perusahaan: 'PT CINDARA PRATAMA LINES',
          entity: 'CPL',
          itemCode: code,
          description: name,
          quantity: 1,
          unitPrice: 0,
          itemType: satuan || 'Persediaan',
          inventoryType: satuan || 'Katalog Master',
          category: cat || determineCategory(code, name, 'Persediaan'),
          level: 'Induk',
        });
      }
    }
  }

  return items;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body?.url || DEFAULT_EFPB_URL).trim();
    const username = (body?.username || 'Hermansyah').trim();
    const password = (body?.password || 'Biocpl24!@#').trim();
    let sessionId = body?.sessionId?.trim();
    const rawContent = body?.rawContent;

    // 1. Jika pengguna menempel (paste) konten langsung
    if (rawContent && typeof rawContent === 'string' && rawContent.trim()) {
      let items = parseEfpbHtmlTable(rawContent);
      if (items.length === 0) {
        try {
          const wb = XLSX.read(rawContent, { type: 'string' });
          const parsed = parseInventoryWorkbook(wb);
          items = parsed.items;
        } catch {
          // Fallback
        }
      }

      if (items.length > 0) {
        const summary = calculateInventorySummary(items);
        return NextResponse.json({
          success: true,
          message: `Berhasil memproses ${items.length.toLocaleString('id-ID')} item persediaan dari teks e-FPB!`,
          items,
          summary,
          count: items.length,
        });
      }
    }

    // 2. Autentikasi login ke e-FPB jika username dan password tersedia
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

        const postRes = await fetch('https://e-fpb.cindaragroup.com/login', {
          method: 'POST',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Cookie: tempSess ? `PHPSESSID=${tempSess}` : '',
          },
          body: fd,
          redirect: 'manual',
          cache: 'no-store',
        });

        const postCookie = postRes.headers.get('set-cookie') || '';
        const newSessMatch = postCookie.match(/PHPSESSID=([^;]+)/);
        const authedSess = newSessMatch ? newSessMatch[1] : tempSess;

        const postHtml = await postRes.text();
        const isStillLoginPage = postHtml.includes('login-page') || postHtml.includes('ew-login-form');

        if (isStillLoginPage && postRes.status === 200) {
          return NextResponse.json(
            {
              success: false,
              requiresAuth: true,
              message:
                'Login e-FPB gagal. Username atau password tidak valid pada sistem e-fpb.cindaragroup.com.',
            },
            { status: 401 }
          );
        }

        sessionId = authedSess;
      } catch (authErr: any) {
        console.error('e-FPB Auth error:', authErr);
        return NextResponse.json(
          {
            success: false,
            message: `Gagal menghubungkan ke server login e-FPB: ${authErr.message}`,
          },
          { status: 502 }
        );
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          requiresAuth: true,
          message:
            'Akses ke https://e-fpb.cindaragroup.com/KodeItemForAccurateList memerlukan autentikasi login atau Session Cookie (PHPSESSID).',
        },
        { status: 401 }
      );
    }

    // 3. Unduh data dari KodeItemForAccurateList menggunakan export=excel
    const exportExcelUrl = targetUrl.includes('?')
      ? `${targetUrl}&export=excel`
      : `${targetUrl}?export=excel`;

    let dataRes = await fetch(exportExcelUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Cookie: `PHPSESSID=${sessionId}`,
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/html, */*',
      },
      cache: 'no-store',
      redirect: 'follow',
    });

    const cType = dataRes.headers.get('content-type') || '';
    let responseText = '';
    let isBinaryExcel = false;
    let excelBuffer: Buffer | null = null;

    if (
      cType.includes('excel') ||
      cType.includes('spreadsheet') ||
      cType.includes('octet-stream')
    ) {
      const arrayBuf = await dataRes.arrayBuffer();
      excelBuffer = Buffer.from(arrayBuf);
      if (excelBuffer.slice(0, 4).toString('hex') === '504b0304') {
        isBinaryExcel = true;
      } else {
        responseText = excelBuffer.toString('utf8');
      }
    } else {
      responseText = await dataRes.text();
    }

    // Periksa apakah sesi kedaluwarsa
    if (responseText.includes('login-page') || responseText.includes('ew-login-form')) {
      return NextResponse.json(
        {
          success: false,
          requiresAuth: true,
          message:
            'Sesi e-FPB Anda telah kedaluwarsa atau tidak valid. Silakan login kembali dengan username/password atau perbarui session cookie.',
        },
        { status: 401 }
      );
    }

    let items: InventoryItem[] = [];

    // Parse binary Excel jika format murni xlsx
    if (isBinaryExcel && excelBuffer) {
      try {
        const wb = XLSX.read(excelBuffer, { type: 'buffer' });
        const parsed = parseInventoryWorkbook(wb);
        items = parsed.items;
      } catch (err: any) {
        console.error('Failed parsing excel buffer:', err);
      }
    }

    // Parse HTML table (PHPMaker export) jika bukan binary
    if (items.length === 0 && responseText) {
      items = parseEfpbHtmlTable(responseText);
    }

    // Jika export kosong, fallback ke halaman reguler KodeItemForAccurateList
    if (items.length === 0) {
      const regularRes = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Cookie: `PHPSESSID=${sessionId}`,
        },
        cache: 'no-store',
      });
      const regularHtml = await regularRes.text();
      items = parseEfpbHtmlTable(regularHtml);
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Tautan berhasil diakses, namun tidak ditemukan tabel daftar barang Accurate yang dapat diproses.',
        },
        { status: 422 }
      );
    }

    const summary = calculateInventorySummary(items);

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${items.length.toLocaleString('id-ID')} item persediaan langsung dari e-FPB Accurate!`,
      sessionId,
      count: items.length,
      items,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in sync-efpb-stock:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Terjadi kesalahan internal saat sinkronisasi stok.' },
      { status: 500 }
    );
  }
}
