import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { formatDateDdMmYy } from '@/utils/formatDate';
import { cleanSingleDescription, deduplicateDescriptions } from '@/utils/descriptionCleaner';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface ParsedItem {
  no: number;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  description: string;
  lastDate: string;
  priority: string;
}

export interface ParsedFpbData {
  fpbNo: string;
  fpbDate: string;
  userArmada: string;
  workOrderNo?: string;
  requestedBy: string;
  requestedDate: string;
  requestedTimestamp: string;
  reviewedBy: string;
  reviewedDate: string;
  approvedBy: string;
  approvedDate: string;
  receivedBy: string;
  receivedDate: string;
  isLogistikApproved?: boolean;
  items: ParsedItem[];
  tujuanPeruntukan: string;
  tanggalPenerimaanTerakhir?: string;
  pdfUrl: string;
}

function extractPdfData(
  buffer: Buffer,
  fpbQuery: string,
  sourcePdfUrl?: string,
  isLogistikApproved = true
): ParsedFpbData {
  const text = buffer.toString('latin1');
  const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;
  const rawObjects: Record<string, string> = {};
  const dictObjects: Record<string, string> = {};

  while ((match = objRegex.exec(text)) !== null) {
    const id = match[1] + '_' + match[2];
    rawObjects[id] = match[3];
    dictObjects[id] = match[3].replace(/stream[\r\n]+[\s\S]*?[\r\n]+endstream/, '');
  }

  // Find all objects referenced by /ToUnicode
  const toUnicodeObjIds = new Set<string>();
  for (const [, body] of Object.entries(dictObjects)) {
    const toUnicodeMatch = body.match(/\/ToUnicode\s+(\d+)\s+(\d+)\s+R/);
    if (toUnicodeMatch) {
      toUnicodeObjIds.add(toUnicodeMatch[1] + '_' + toUnicodeMatch[2]);
    }
  }

  // Parse CMaps
  const cmapData: Record<string, Record<number, string>> = {};
  for (const id of Array.from(toUnicodeObjIds)) {
    const body = rawObjects[id];
    if (!body) continue;
    const streamMatch = body.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/);
    if (!streamMatch) continue;
    let streamData = streamMatch[1];
    if (body.includes('/FlateDecode')) {
      try {
        streamData = zlib.inflateSync(Buffer.from(streamData, 'latin1')).toString('latin1');
      } catch {
        // Safe ignore
      }
    }
    const map: Record<number, string> = {};

    // 1. Parse beginbfrange ... endbfrange
    const bfrangeBlockRegex = /beginbfrange([\s\S]*?)endbfrange/g;
    let bfrangeBlockMatch: RegExpExecArray | null;
    while ((bfrangeBlockMatch = bfrangeBlockRegex.exec(streamData)) !== null) {
      const blockContent = bfrangeBlockMatch[1];
      const bfrangeRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let m: RegExpExecArray | null;
      while ((m = bfrangeRegex.exec(blockContent)) !== null) {
        const start = parseInt(m[1], 16);
        const end = parseInt(m[2], 16);
        let dst = parseInt(m[3], 16);
        for (let code = start; code <= end; code++) {
          map[code] = String.fromCharCode(dst);
          dst++;
        }
      }
    }

    // 2. Parse beginbfchar ... endbfchar
    const bfcharBlockRegex = /beginbfchar([\s\S]*?)endbfchar/g;
    let bfcharBlockMatch: RegExpExecArray | null;
    while ((bfcharBlockMatch = bfcharBlockRegex.exec(streamData)) !== null) {
      const blockContent = bfcharBlockMatch[1];
      const bfcharRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let m: RegExpExecArray | null;
      while ((m = bfcharRegex.exec(blockContent)) !== null) {
        const code = parseInt(m[1], 16);
        const dst = parseInt(m[2], 16);
        map[code] = String.fromCharCode(dst);
      }
    }

    cmapData[id] = map;
  }

  // Find font objects: map font obj -> CMap
  const fontObjToCMap: Record<string, Record<number, string>> = {};
  for (const [id, body] of Object.entries(dictObjects)) {
    if (body.includes('/Type /Font') || body.includes('/Type/Font')) {
      const toUnicodeMatch = body.match(/\/ToUnicode\s+(\d+)\s+(\d+)\s+R/);
      if (toUnicodeMatch) {
        const cmapId = toUnicodeMatch[1] + '_' + toUnicodeMatch[2];
        fontObjToCMap[id] = cmapData[cmapId] || {};
      }
    }
  }

  // Find font resource names (/R8, /R10, /F1, etc.) -> CMap
  const fontNameToMap: Record<string, Record<number, string>> = {};
  for (const [, body] of Object.entries(dictObjects)) {
    const entryRegex = /\/([A-Za-z0-9_]+)\s+(\d+)\s+(\d+)\s+R/g;
    let em: RegExpExecArray | null;
    while ((em = entryRegex.exec(body)) !== null) {
      const fontName = em[1];
      const fontObjId = em[2] + '_' + em[3];
      if (fontObjToCMap[fontObjId]) {
        fontNameToMap[fontName] = fontObjToCMap[fontObjId];
      }
    }
  }

  function decodeBytes(bytes: number[], font: string): string {
    const cmap = fontNameToMap[font];
    let s = '';
    for (const b of bytes) {
      if (cmap && cmap[b] !== undefined) {
        s += cmap[b];
      } else {
        s += String.fromCharCode(b);
      }
    }
    return s;
  }

  function readPdfString(buffer: Buffer, pos: number): { bytes: number[]; nextPos: number } {
    let p = pos + 1; // skip '('
    let depth = 1;
    const bytes: number[] = [];
    const len = buffer.length;
    while (p < len && depth > 0) {
      const b = buffer[p];
      if (b === 0x5c) { // '\\'
        p++;
        if (p >= len) break;
        const nb = buffer[p];
        if (nb === 0x6e) bytes.push(10); // \n
        else if (nb === 0x72) bytes.push(13); // \r
        else if (nb === 0x74) bytes.push(9); // \t
        else if (nb === 0x62) bytes.push(8); // \b
        else if (nb === 0x66) bytes.push(12); // \f
        else if (nb === 0x28) bytes.push(40); // (
        else if (nb === 0x29) bytes.push(41); // )
        else if (nb === 0x5c) bytes.push(92); // \
        else if (nb >= 0x30 && nb <= 0x37) { // octal
          let octStr = String.fromCharCode(nb);
          if (p + 1 < len && buffer[p + 1] >= 0x30 && buffer[p + 1] <= 0x37) {
            p++;
            octStr += String.fromCharCode(buffer[p]);
            if (p + 1 < len && buffer[p + 1] >= 0x30 && buffer[p + 1] <= 0x37) {
              p++;
              octStr += String.fromCharCode(buffer[p]);
            }
          }
          bytes.push(parseInt(octStr, 8));
        } else if (nb === 0x0a || nb === 0x0d) {
          if (nb === 0x0d && p + 1 < len && buffer[p + 1] === 0x0a) {
            p++;
          }
        } else {
          bytes.push(nb);
        }
      } else if (b === 0x28) {
        depth++;
        bytes.push(b);
      } else if (b === 0x29) {
        depth--;
        if (depth === 0) break;
        bytes.push(b);
      } else {
        bytes.push(b);
      }
      p++;
    }
    return { bytes, nextPos: p };
  }

  interface TextBlock {
    text: string;
    x: number;
    y: number;
    font: string;
  }

  const allBlocks: TextBlock[] = [];
  const signatureBlocks: TextBlock[][] = [];
  const streamBlocksList: TextBlock[][] = [];

  for (const [, body] of Object.entries(rawObjects)) {
    if (body.includes('stream')) {
      const streamMatch = body.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/);
      if (!streamMatch) continue;
      let streamBuffer: Buffer;
      if (body.includes('/FlateDecode')) {
        try {
          streamBuffer = zlib.inflateSync(Buffer.from(streamMatch[1], 'latin1'));
        } catch {
          continue;
        }
      } else {
        streamBuffer = Buffer.from(streamMatch[1], 'latin1');
      }

      const streamStr = streamBuffer.toString('latin1');
      if (!streamStr.includes('BT') || !streamStr.includes('ET')) continue;

      let currentFont = '';
      let currentX = 0;
      let currentY = 0;
      let i = 0;
      const len = streamBuffer.length;
      const streamBlocks: TextBlock[] = [];

      while (i < len) {
        const b = streamBuffer[i];
        if (b === 0x2f) { // '/'
          let name = '';
          let k = i + 1;
          while (
            k < len &&
            streamBuffer[k] > 0x20 &&
            streamBuffer[k] !== 0x2f &&
            streamBuffer[k] !== 0x5b &&
            streamBuffer[k] !== 0x28
          ) {
            name += String.fromCharCode(streamBuffer[k]);
            k++;
          }
          let j = k;
          while (
            j < len &&
            (streamBuffer[j] === 0x20 ||
              streamBuffer[j] === 0x0a ||
              streamBuffer[j] === 0x0d ||
              streamBuffer[j] === 0x09)
          )
            j++;
          let num = '';
          while (j < len && ((streamBuffer[j] >= 0x30 && streamBuffer[j] <= 0x39) || streamBuffer[j] === 0x2e)) {
            num += String.fromCharCode(streamBuffer[j]);
            j++;
          }
          while (
            j < len &&
            (streamBuffer[j] === 0x20 ||
              streamBuffer[j] === 0x0a ||
              streamBuffer[j] === 0x0d ||
              streamBuffer[j] === 0x09)
          )
            j++;
          if (j + 1 < len && streamBuffer[j] === 0x54 && streamBuffer[j + 1] === 0x66) { // 'Tf'
            currentFont = name;
            i = j + 2;
            continue;
          }
        }

        if (b === 0x54 && i + 1 < len && streamBuffer[i + 1] === 0x6d) { // 'Tm'
          let p = i - 1;
          while (p >= 0 && /\s/.test(String.fromCharCode(streamBuffer[p]))) p--;
          let yStr = '';
          while (p >= 0 && /[\d\.\-]/.test(String.fromCharCode(streamBuffer[p]))) {
            yStr = String.fromCharCode(streamBuffer[p]) + yStr;
            p--;
          }
          while (p >= 0 && /\s/.test(String.fromCharCode(streamBuffer[p]))) p--;
          let xStr = '';
          while (p >= 0 && /[\d\.\-]/.test(String.fromCharCode(streamBuffer[p]))) {
            xStr = String.fromCharCode(streamBuffer[p]) + xStr;
            p--;
          }
          currentX = parseFloat(xStr) || 0;
          currentY = parseFloat(yStr) || 0;
          i += 2;
          continue;
        }

        if (b === 0x28) { // '('
          const res = readPdfString(streamBuffer, i);
          const rawText = decodeBytes(res.bytes, currentFont);
          if (rawText) {
            streamBlocks.push({ text: rawText.trim(), x: currentX, y: currentY, font: currentFont });
          }
          i = res.nextPos + 1;
          continue;
        }

        if (b === 0x5b) { // '['
          i++;
          let combined = '';
          while (i < len && streamBuffer[i] !== 0x5d) {
            if (streamBuffer[i] === 0x28) {
              const res = readPdfString(streamBuffer, i);
              combined += decodeBytes(res.bytes, currentFont);
              i = res.nextPos;
            }
            i++;
          }
          if (combined.trim()) {
            streamBlocks.push({ text: combined.trim(), x: currentX, y: currentY, font: currentFont });
          }
          i++;
          continue;
        }

        i++;
      }

      allBlocks.push(...streamBlocks);
      streamBlocksList.push(streamBlocks);
      const hasSignatureMarker = streamBlocks.some(
        (sb) =>
          sb.text.includes('Was Approved') ||
          sb.text.includes('Was review') ||
          sb.text.includes('Received:')
      );
      const isSignatureStream =
        streamBlocks.length >= 2 &&
        streamBlocks.length <= 4 &&
        streamBlocks.some((sb) => /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(sb.text)) &&
        !streamBlocks[0].text.includes('FORM') &&
        !streamBlocks[0].text.includes('CPL-') &&
        !streamBlocks[0].text.includes('Jalan') &&
        !streamBlocks[0].text.includes('PT ');

      if (hasSignatureMarker || isSignatureStream) {
        signatureBlocks.push(streamBlocks);
      }
    }
  }

  // Header extraction
  let fpbNo = '';
  let fpbDate = '';
  let userArmada = '';
  let workOrderNo = '';
  let requestedByBottom = '';
  let userTimestamp = '';

  for (let idx = 0; idx < allBlocks.length; idx++) {
    const t = allBlocks[idx].text;
    const fpbM = t.match(/([A-Z0-9]+-FPB-\d+-\d+)/i);
    if (fpbM && !fpbNo) fpbNo = fpbM[1];

    if (/^USER\s*:/i.test(t)) {
      const rest = t.replace(/^USER\s*:\s*/i, '').trim();
      if (rest) userArmada = rest;
      else if (idx + 1 < allBlocks.length) userArmada = allBlocks[idx + 1].text.trim();
    }

    if (t === 'FPB Date' && idx > 0) {
      const prev = allBlocks[idx - 2] || allBlocks[idx - 1];
      const dM = prev?.text.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
      if (dM) fpbDate = dM[1];
    }

    if (/work\s*order(\s*no\.?)?/i.test(t)) {
      const rest = t.replace(/^.*?work\s*order(\s*no\.?)?\s*:?\s*/i, '').trim();
      if (rest && rest !== ':') {
        workOrderNo = rest.replace(/^[:\s]+/, '').trim();
      } else if (idx + 1 < allBlocks.length) {
        workOrderNo = allBlocks[idx + 1].text.replace(/^[:\s]+/, '').trim();
      }
    }

    if (t === 'USERNAME' && idx + 1 < allBlocks.length) {
      requestedByBottom = allBlocks[idx + 1].text.replace(/^:\s*/, '').trim();
      if (idx + 2 < allBlocks.length) {
        userTimestamp = allBlocks[idx + 2].text.trim();
      }
    }
  }

  // Fallback stream check for Work Order No if not found in blocks
  if (!workOrderNo) {
    for (const [, raw] of Object.entries(rawObjects)) {
      const streamMatch = raw.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/);
      if (!streamMatch) continue;
      try {
        const decomp = zlib.inflateSync(Buffer.from(streamMatch[1], 'latin1')).toString('latin1');
        const m = decomp.match(/Work\s*Order\s*No\.?[^\)]*?\)\s*Tj[\s\S]*?\(([^)]+)\)\s*Tj/i);
        if (m && m[1]) {
          workOrderNo = m[1].replace(/^[:\s]+/, '').trim();
          if (workOrderNo) break;
        }
      } catch {}
    }
  }

  if (!fpbNo) fpbNo = fpbQuery;

  // Extract signatures
  let requestedBy = '',
    requestedDate = '';
  let reviewedBy = '',
    reviewedDate = '';
  let approvedBy = '',
    approvedDate = '';
  let receivedBy = '',
    receivedDate = '';

  for (const blockGroup of signatureBlocks) {
    const texts = blockGroup.map((b) => b.text);
    const revText = texts.find((t) => t.includes('Was review'));
    if (revText) {
      reviewedBy = texts[0] || '';
      reviewedDate = texts[1] || '';
      continue;
    }
    const appText = texts.find((t) => t.includes('Was Approved'));
    if (appText) {
      approvedBy = texts[0] || '';
      approvedDate = texts[1] || '';
      continue;
    }
    const recText = texts.find((t) => t.includes('Received:'));
    if (recText) {
      receivedBy = texts[0] || '';
      receivedDate = texts[1] || '';
      continue;
    }

    // Requester signature block (Requested By / End User)
    const dateText = texts.find((t) => /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(t));
    if (dateText && texts[0]) {
      const candidate = texts[0].replace(/^name\s*:\s*/i, '').trim();
      if (
        candidate &&
        candidate.length > 1 &&
        !/^(end user|supervisor|manager|logistic|staff)/i.test(candidate)
      ) {
        requestedBy = candidate;
        requestedDate = dateText;
      }
    }
  }

  // Table items: parse per-stream to prevent rows from multiple pages being merged by identical Y coordinates
  const items: ParsedItem[] = [];

  for (const sBlocks of streamBlocksList) {
    const tableCells = sBlocks.filter(
      (b) => b.y < 260 && b.y > 50 && b.x >= 30 && b.x <= 560
    );
    if (tableCells.length === 0) continue;

    const rowsMap = new Map<number, TextBlock[]>();
    for (const cell of tableCells) {
      let matchedY: number | null = null;
      for (const y of Array.from(rowsMap.keys())) {
        if (Math.abs(y - cell.y) <= 4) {
          matchedY = y;
          break;
        }
      }
      if (matchedY === null) {
        matchedY = cell.y;
        rowsMap.set(matchedY, []);
      }
      rowsMap.get(matchedY)!.push(cell);
    }

    const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const cells = rowsMap.get(y)!;
      cells.sort((a, b) => a.x - b.x);
      let noStr = '',
        code = '',
        name = '',
        qtyStr = '',
        unit = '',
        desc = '',
        lastDate = '',
        priority = '';

      for (const c of cells) {
        const t = c.text.trim();
        if (!t) continue;
        if (c.x < 47) {
          noStr += t;
        } else if (c.x < 105) {
          code += (code ? '' : '') + t;
        } else if (c.x < 255) {
          name += (name ? ' ' : '') + t;
        } else if (c.x < 315 && /^\d+(?:[.,]\d+)?$/.test(t)) {
          // Angka kuantitas (Qty) pada koordinat x antara 245 - 315
          qtyStr = t;
        } else if (c.x < 290 && !qtyStr) {
          // Lanjutan nama barang jika Qty belum tercapai
          name += (name ? ' ' : '') + t;
        } else if (c.x < 335) {
          unit += (unit ? ' ' : '') + t;
        } else if (c.x < 420) {
          desc += (desc ? ' ' : '') + t;
        } else if (c.x < 515) {
          lastDate += (lastDate ? ' ' : '') + t;
        } else {
          priority += (priority ? ' ' : '') + t;
        }
      }

      // Penanganan khusus jika angka Qty tergabung ke dalam kolom satuan (misal "10 RIM", "5 PCS")
      if (unit) {
        const unitQtyMatch = unit.match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/);
        if (unitQtyMatch) {
          if (!qtyStr || qtyStr === '1') {
            qtyStr = unitQtyMatch[1];
          }
          unit = unitQtyMatch[2];
        }

        // Jika keterangan tujuan peruntukan ("U/ ...") ikut terbawa ke satuan
        const unitDescMatch = unit.match(/^([A-Za-z0-9]+)\s+(U\/.*)$/i);
        if (unitDescMatch) {
          unit = unitDescMatch[1];
          desc = (unitDescMatch[2] + ' ' + desc).trim();
        }
      }
      if (qtyStr) {
        const qtyUnitMatch = qtyStr.match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-z]+.*)$/);
        if (qtyUnitMatch) {
          qtyStr = qtyUnitMatch[1];
          if (!unit) unit = qtyUnitMatch[2];
        }
      }

      // Jika tanggal penerimaan barang terakhir ikut menempel di akhir deskripsi (contoh: "U/... 12/05/2026")
      const trailingDateMatch = desc.match(/\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})$/);
      if (trailingDateMatch) {
        if (!lastDate || lastDate === '-' || lastDate.trim().length === 0) {
          lastDate = trailingDateMatch[1];
        }
        desc = desc.slice(0, trailingDateMatch.index).trim();
      }

      const no = parseInt(noStr, 10);
      if (!isNaN(no) && (code || name)) {
        // Prevent duplicate items if stream is referenced twice
        const alreadyExists = items.some(
          (it) => it.no === no && (it.itemCode === code.trim() || it.itemName === name.trim())
        );
        if (!alreadyExists) {
          items.push({
            no,
            itemCode: code.trim(),
            itemName: name.trim(),
            qty: parseFloat(qtyStr.replace(/,/g, '')) || 1,
            unit: unit.trim(),
            description: cleanSingleDescription(desc.trim()),
            lastDate: formatDateDdMmYy(lastDate.trim()),
            priority: priority.trim(),
          });
        }
      }
    }
  }

  // Sort items sequentially by their item number (No)
  items.sort((a, b) => a.no - b.no);

  const uniqueDescs = deduplicateDescriptions(
    items.map((i) => i.description).filter((d) => d && d !== '-' && d.length > 1)
  );
  const tujuanPeruntukan = uniqueDescs.join(' • ');

  const uniqueLastDates = Array.from(
    new Set(
      items
        .map((i) => i.lastDate?.trim())
        .filter((d): d is string => Boolean(d && d !== '-' && d.length > 1))
    )
  );
  const tanggalPenerimaanTerakhir = uniqueLastDates.join(' • ');

  const pdfUrl =
    sourcePdfUrl ||
    `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(
      fpbNo
    )}.pdf`;

  return {
    fpbNo,
    fpbDate: formatDateDdMmYy(fpbDate),
    userArmada,
    workOrderNo: workOrderNo || undefined,
    requestedBy: requestedBy || requestedByBottom || '',
    requestedDate: formatDateDdMmYy(
      requestedDate || (userTimestamp ? userTimestamp.slice(0, 10) : '')
    ),
    requestedTimestamp: requestedDate || userTimestamp,
    reviewedBy,
    reviewedDate: formatDateDdMmYy(reviewedDate),
    approvedBy,
    approvedDate: formatDateDdMmYy(approvedDate),
    receivedBy: isLogistikApproved ? receivedBy : '',
    receivedDate: isLogistikApproved ? formatDateDdMmYy(receivedDate) : '',
    isLogistikApproved: Boolean(isLogistikApproved && receivedBy),
    items,
    tujuanPeruntukan,
    tanggalPenerimaanTerakhir,
    pdfUrl,
  };
}

/**
 * PDF Resolver Mode Mandiri:
 * Membaca dari Cloudflare R2 atau folder lokal dashboard internal.
 * TIDAK PERNAH menghubungi e-fpb.cindaragroup.com demi keamanan sistem.
 */
async function resolveLocalOrR2Pdf(
  cleanDoc: string
): Promise<{ buffer: Buffer; url: string; isLogistik: boolean } | null> {
  const normalizedDoc = cleanDoc.replace(/\/LOG\/FPB\//i, '-FPB-').trim();
  const LOCAL_PDF_DIR = path.join(process.cwd(), 'public', 'uploads', 'fpb');

  // 1. Cek Cloudflare R2
  if (isR2Configured()) {
    const r2Keys = [
      `fpb-signed/${normalizedDoc}.pdf`,
      `fpb-raw/${normalizedDoc}.pdf`,
      `fpb-pdfs/${normalizedDoc}.pdf`,
      `dashboard-metadata/fpb-pdfs/${normalizedDoc}.pdf`,
    ];
    for (const key of r2Keys) {
      try {
        const obj = await getObjectFromR2(key);
        if (obj && obj.body) {
          return {
            buffer: Buffer.from(obj.body),
            url: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(normalizedDoc)}&type=signed`,
            isLogistik: key.includes('signed'),
          };
        }
      } catch {
        // Continue
      }
    }
  }

  // 2. Cek penyimpanan lokal
  if (fs.existsSync(LOCAL_PDF_DIR)) {
    const candidateFiles = [
      path.join(LOCAL_PDF_DIR, `${normalizedDoc}.pdf`),
      path.join(LOCAL_PDF_DIR, `Approved_rev_sign_${normalizedDoc}.pdf`),
      path.join(LOCAL_PDF_DIR, `logistik_Approved_rev_sign_${normalizedDoc}.pdf`),
    ];
    for (const p of candidateFiles) {
      if (fs.existsSync(p)) {
        return {
          buffer: fs.readFileSync(p),
          url: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(normalizedDoc)}&type=signed`,
          isLogistik: p.includes('logistik_'),
        };
      }
    }
  }

  return null;
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

  try {
    const resolved = await resolveLocalOrR2Pdf(cleanDoc);

    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          status: 404,
          message: `Dokumen PDF untuk ${cleanDoc} belum diunggah ke storage internal dashboard. Silakan unggah file PDF melalui tombol Upload PDF FPB.`,
          isOfflineMode: true,
        },
        { status: 404 }
      );
    }

    const isRaw =
      searchParams.get('raw') === 'true' ||
      searchParams.get('download') === 'true';
    if (isRaw) {
      return new NextResponse(new Uint8Array(resolved.buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${encodeURIComponent(cleanDoc)}.pdf"`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const parsedData = extractPdfData(
      resolved.buffer,
      cleanDoc,
      resolved.url,
      resolved.isLogistik
    );

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error parsing FPB PDF:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal membaca isi berkas PDF lokal.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler untuk upload file PDF FPB secara langsung (Drag & Drop / File Picker)
 * Mengekstrak item secara lokal tanpa menghubungi server eksternal IT.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fpbNoHint = (formData.get('fpbNo') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File PDF wajib diunggah.' },
        { status: 400 }
      );
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    const filename = file.name || `${fpbNoHint || 'FPB'}.pdf`;
    const normalizedHint = fpbNoHint
      .replace(/\/LOG\/FPB\//i, '-FPB-')
      .replace(/\.pdf$/i, '')
      .replace(/^(?:logistik_)?Approved_rev_sign_/i, '')
      .trim();

    // Ekstrak teks & item
    const parsedData = extractPdfData(
      buffer,
      normalizedHint || filename.replace(/\.pdf$/i, ''),
      `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(normalizedHint || filename)}&type=signed`,
      true
    );

    const extractedFpb = (parsedData.fpbNo || '')
      .replace(/\/LOG\/FPB\//i, '-FPB-')
      .replace(/\.pdf$/i, '')
      .replace(/^(?:logistik_)?Approved_rev_sign_/i, '')
      .trim();

    // Gunakan fpbNoHint jika diberikan secara eksplisit (mis. upload langsung untuk tiket FPB tertentu)
    const cleanFpb = normalizedHint || extractedFpb;
    if (cleanFpb) {
      parsedData.fpbNo = cleanFpb;
      parsedData.pdfUrl = `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanFpb)}&type=signed`;
    }

    // Simpan ke R2 (dan fallback lokal jika R2 tidak dikonfigurasi)
    if (cleanFpb) {
      let savedToR2 = false;
      if (isR2Configured()) {
        try {
          await uploadToR2({
            key: `fpb-pdfs/${cleanFpb}.pdf`,
            body: buffer,
            contentType: 'application/pdf',
          });
          savedToR2 = true;
        } catch (r2Err) {
          console.warn('Gagal upload parsed PDF ke R2:', r2Err);
        }
      }

      if (!savedToR2) {
        try {
          const localDir = path.join(process.cwd(), 'public', 'uploads', 'fpb');
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, `${cleanFpb}.pdf`), buffer);
        } catch (fsErr) {
          console.warn('Gagal menyimpan PDF FPB secara lokal:', fsErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengekstrak ${parsedData.items.length} item material dari file PDF secara mandiri!`,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('Error in POST /api/parse-fpb-pdf:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Gagal memproses file PDF yang diunggah.' },
      { status: 500 }
    );
  }
}
