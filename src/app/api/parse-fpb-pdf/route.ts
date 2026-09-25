import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';

interface ParsedItem {
  no: number;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  description: string;
  lastDate: string;
  priority: string;
}

interface ParsedFpbData {
  fpbNo: string;
  fpbDate: string;
  userArmada: string;
  requestedBy: string;
  requestedDate: string;
  requestedTimestamp: string;
  reviewedBy: string;
  reviewedDate: string;
  approvedBy: string;
  approvedDate: string;
  items: ParsedItem[];
  tujuanPeruntukan: string;
  pdfUrl: string;
}

interface SignatureEntry {
  name: string;
  date: string;
  audit?: string;
}

function extractPdfData(
  buffer: Buffer,
  fpbQuery: string,
  sourcePdfUrl?: string
): ParsedFpbData {
  const text = buffer.toString('latin1');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  const allTexts: string[] = [];
  const signatures: SignatureEntry[] = [];
  let userTimestamp = '';
  let requestedByBottom = '';
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamRegex.exec(text)) !== null) {
    try {
      const u = zlib.inflateSync(Buffer.from(streamMatch[1], 'latin1')).toString('utf8');
      const regex = /\[([\s\S]*?)\]\s*TJ|\(([\s\S]*?)\)\s*Tj/g;
      let tm: RegExpExecArray | null;
      const streamTexts: string[] = [];

      while ((tm = regex.exec(u)) !== null) {
        if (tm[2] !== undefined) {
          const clean = tm[2].replace(/\\\(/g, '(').replace(/\\\)/g, ')').trim();
          streamTexts.push(clean);
          allTexts.push(clean);
        } else if (tm[1] !== undefined) {
          const innerRegex = /\((.*?)\)/g;
          let im: RegExpExecArray | null;
          let innerText = '';
          while ((im = innerRegex.exec(tm[1])) !== null) {
            innerText += im[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')');
          }
          const cleanInner = innerText.trim();
          streamTexts.push(cleanInner);
          allTexts.push(cleanInner);
        }
      }

      // Check USERNAME line: [(USERNAME)-733(:SALMAN)-4410(24/09/2026 12:35:30)]TJ
      const uMatch = u.match(/USERNAME\)[^()]*\(:?([A-Za-z\s]+)\)[^()]*\(([\d/:\s]+)\)/i);
      if (uMatch) {
        requestedByBottom = uMatch[1].trim();
        userTimestamp = uMatch[2].trim();
      }

      // Detect digital signature overlays (Name and Date)
      if (streamTexts.length === 2 && /^\d{2}-\d{2}-\d{4}$/.test(streamTexts[1])) {
        signatures.push({ name: streamTexts[0].trim(), date: streamTexts[1].trim() });
      } else if (streamTexts.length === 3 && /^\d{2}-\d{2}-\d{4}$/.test(streamTexts[1])) {
        signatures.push({
          name: streamTexts[0].trim(),
          date: streamTexts[1].trim(),
          audit: streamTexts[2].trim(),
        });
      }
    } catch {
      // Non-deflate stream, safely ignore
    }
  }

  const fullJoined = allTexts.join(' ');

  // 1. FPB No
  const fpbMatch = fullJoined.match(/CPL-FPB-\d+-\d+/i);
  const fpbNo = fpbMatch ? fpbMatch[0] : fpbQuery;

  // 2. FPB Date
  const dateMatch = fullJoined.match(/:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
  const fpbDate = dateMatch ? dateMatch[1] : '';

  // 3. User / Armada
  let userArmada = '';
  const userTjMatch = fullJoined.match(/USER\s*:?\)[^()]*\(([^()]+)\)/i);
  if (userTjMatch) {
    userArmada = userTjMatch[1].trim();
  } else {
    const userElem = allTexts.find((t) => /^USER\s*:/i.test(t));
    if (userElem) {
      userArmada = userElem.replace(/^USER\s*:\s*/i, '').trim();
    }
  }

  // 4. Signatures (Requested By / End User, Reviewed By / Supervisor, Approved By / Manager)
  const reqSig = signatures.find((s) => !s.audit) || {
    name: requestedByBottom,
    date: userTimestamp ? userTimestamp.slice(0, 10) : '',
  };
  const revSig = signatures.find((s) => s.audit && s.audit.toLowerCase().includes('review'));
  const appSig = signatures.find((s) => s.audit && s.audit.toLowerCase().includes('approved'));

  const requestedBy = reqSig?.name || requestedByBottom || 'End User';
  const requestedDate = reqSig?.date || (userTimestamp ? userTimestamp.slice(0, 10) : '');
  const requestedTimestamp = userTimestamp || requestedDate;

  const reviewedBy = revSig?.name || '';
  const reviewedDate = revSig?.date || '';
  const approvedBy = appSig?.name || '';
  const approvedDate = appSig?.date || '';

  // 5. Table Items
  const headerIdx = allTexts.findIndex((t) => t.toUpperCase() === 'PRIORITY');
  const items: ParsedItem[] = [];

  if (headerIdx !== -1) {
    let cursor = headerIdx + 1;
    while (cursor < allTexts.length) {
      const noStr = allTexts[cursor];
      if (!/^\d+$/.test(noStr)) {
        break;
      }
      const no = parseInt(noStr, 10);
      const itemCode = allTexts[cursor + 1] || '';
      if (!itemCode || itemCode.length < 3) break;

      const itemName = allTexts[cursor + 2] || '';
      const rawQty = allTexts[cursor + 3] || '1';
      const qty = parseFloat(rawQty) || 1;
      const unit = allTexts[cursor + 4] || '';
      const description = allTexts[cursor + 5] || '';
      const lastDate = allTexts[cursor + 6] || '';
      const priority = allTexts[cursor + 7] || '';

      items.push({
        no,
        itemCode,
        itemName,
        qty,
        unit,
        description,
        lastDate,
        priority,
      });

      cursor += 8;
    }
  }

  // Derive collective peruntukan
  const uniqueDescs = Array.from(
    new Set(items.map((i) => i.description).filter((d) => d && d !== '-' && d.length > 1))
  );
  const tujuanPeruntukan = uniqueDescs.join(' • ');

  const pdfUrl =
    sourcePdfUrl ||
    `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(
      fpbNo
    )}.pdf`;

  return {
    fpbNo,
    fpbDate,
    userArmada,
    requestedBy,
    requestedDate,
    requestedTimestamp,
    reviewedBy,
    reviewedDate,
    approvedBy,
    approvedDate,
    items,
    tujuanPeruntukan,
    pdfUrl,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDoc =
    searchParams.get('fpb') ||
    searchParams.get('doc') ||
    searchParams.get('docNum') ||
    searchParams.get('po') ||
    '';
  const cleanDoc = rawDoc.trim().replace(/^["']|["']$/g, '');

  if (!cleanDoc) {
    return NextResponse.json(
      { success: false, message: 'Nomor FPB atau dokumen wajib diisi.' },
      { status: 400 }
    );
  }

  const logistikPdfUrl = `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(
    cleanDoc
  )}.pdf`;
  const approvedPdfUrl = `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(
    cleanDoc
  )}.pdf`;

  try {
    let finalPdfUrl = logistikPdfUrl;
    let response = await fetch(logistikPdfUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Fallback ke Approved_rev_sign_ jika logistik_Approved_rev_sign_ belum tersedia di server
      const fallbackResponse = await fetch(approvedPdfUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      if (fallbackResponse.ok) {
        response = fallbackResponse;
        finalPdfUrl = approvedPdfUrl;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          message: `Dokumen PDF tidak ditemukan di server e-FPB (${response.status} Not Found).`,
          pdfUrl: logistikPdfUrl,
        },
        { status: 404 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedData = extractPdfData(buffer, cleanDoc, logistikPdfUrl);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error fetching or parsing FPB PDF:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal membaca isi berkas PDF e-FPB.',
      },
      { status: 500 }
    );
  }
}
