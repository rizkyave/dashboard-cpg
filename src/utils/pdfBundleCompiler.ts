import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

export interface DossierBundleItem {
  id: string;
  fpb: string;
  po?: string;
  entity?: string;
  armada: string;
  item: string;
  qty?: number | string;
  unit?: string;
  tglFpb?: string;
  tglPo?: string;
  picPch?: string;
  picTtb?: string;
  picFstb?: string;
  picLap?: string;
  picAktif?: string;
  noFstb?: string;
  tglFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  // Status kelengkapan berkas fisik & digital
  hasFpbDoc: boolean;
  hasFstbDoc: boolean;
  hasTtbDoc: boolean;
  hasPhotos: boolean;
  hasFpbPdf?: boolean;
  hasFstbPdf?: boolean;
  hasTtbPdf?: boolean;
  // Resolved URLs
  fpbPdfUrl?: string;
  fstbPdfUrl?: string;
  ttbPdfUrl?: string;
  photoUrls?: string[];
}

/**
 * Mengambil array buffer dari URL dengan penanganan fallback
 */
async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.warn(`Gagal mengunduh file binary dari: ${url}`, err);
    return null;
  }
}

/**
 * Deteksi apakah buffer berupa file PDF (magic bytes %PDF)
 */
function isPdfBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46    // F
  );
}

/**
 * Deteksi JPEG / PNG
 */
function isJpegBuffer(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPngBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

/**
 * Kompilasi seluruh dokumen pengadaan (FPB + FSTB + TTB + FOTO) menjadi 1 file PDF utuh
 */
export async function compileDossierToPdf(
  bundle: DossierBundleItem,
  onProgress?: (step: string) => void
): Promise<{ blob: Blob; fileName: string; totalPages: number }> {
  onProgress?.('Menginisialisasi dokumen bundel dossier...');

  const mergedPdf = await PDFDocument.create();

  // Muat font standar Helvetica
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  const cleanFpb = bundle.fpb ? bundle.fpb.replace(/[/\\?%*:|"<>]/g, '_') : 'FPB';
  const cleanArmada = bundle.armada ? bundle.armada.replace(/[/\\?%*:|"<>]/g, '_') : 'ARMADA';
  const cleanPo = bundle.po ? bundle.po.replace(/[/\\?%*:|"<>]/g, '_') : 'PO';

  // -------------------------------------------------------------
  // 1. HALAMAN COVER: Ringkasan Eksekutif & Lembar Verifikasi Fisik
  // -------------------------------------------------------------
  onProgress?.('Menyusun halaman cover ringkasan berkas...');
  const coverPage = mergedPdf.addPage(PageSizes.A4); // 595.28 x 841.89
  const { width: pW, height: pH } = coverPage.getSize();

  // Background Header Bar (Navy / Dark Slate)
  coverPage.drawRectangle({
    x: 35,
    y: pH - 110,
    width: pW - 70,
    height: 75,
    color: rgb(0.06, 0.1, 0.18),
  });

  // Garis Aksen Cyan di atas Header
  coverPage.drawRectangle({
    x: 35,
    y: pH - 38,
    width: pW - 70,
    height: 3,
    color: rgb(0.05, 0.65, 0.85),
  });

  // Teks Header
  coverPage.drawText('PT CINDARA PRATAMA LINES & GROUP', {
    x: 50,
    y: pH - 58,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  coverPage.drawText('PROCUREMENT & FLEET LOGISTIC COMMAND CENTER', {
    x: 50,
    y: pH - 73,
    size: 8,
    font: fontRegular,
    color: rgb(0.6, 0.75, 0.9),
  });

  coverPage.drawText('DOSSIER KOMPILASI ADMINISTRASI LENGKAP PENGADAAN', {
    x: 50,
    y: pH - 96,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.85, 0.95),
  });

  // Badge Status Berkas
  const is100PercentComplete =
    bundle.hasFpbDoc && bundle.hasFstbDoc && bundle.hasTtbDoc && bundle.hasPhotos;

  const statusBoxColor = is100PercentComplete
    ? rgb(0.08, 0.55, 0.35)
    : rgb(0.75, 0.45, 0.08);

  coverPage.drawRectangle({
    x: pW - 200,
    y: pH - 98,
    width: 150,
    height: 24,
    color: statusBoxColor,
  });

  coverPage.drawText(
    is100PercentComplete ? 'ADMINISTRASI SELESAI' : 'BERKAS TERKOMPILASI',
    {
      x: pW - 192,
      y: pH - 85,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    }
  );

  // Kotak Metadata Pengadaan
  let curY = pH - 140;
  coverPage.drawRectangle({
    x: 35,
    y: curY - 145,
    width: pW - 70,
    height: 145,
    borderColor: rgb(0.8, 0.84, 0.9),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1.0),
  });

  coverPage.drawText('INFORMASI TIKET & IDENTITAS PENGADAAN', {
    x: 50,
    y: curY - 20,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  // Grid Data 2 Kolom
  const drawMetaRow = (
    label: string,
    val: string,
    yPos: number,
    isCol2 = false
  ) => {
    const startX = isCol2 ? 310 : 50;
    coverPage.drawText(label, {
      x: startX,
      y: yPos,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.55),
    });
    coverPage.drawText(`: ${val || '-'}`, {
      x: startX + 75,
      y: yPos,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });
  };

  drawMetaRow('No. FPB', bundle.fpb, curY - 40);
  drawMetaRow('Tanggal FPB', bundle.tglFpb || '-', curY - 58);
  drawMetaRow('Armada / Unit', bundle.armada, curY - 76);
  drawMetaRow('Entitas Usaha', bundle.entity || 'CPG Group', curY - 94);
  drawMetaRow('PIC Purchasing', bundle.picPch || 'Staf Purchasing', curY - 112);

  drawMetaRow('No. PO', bundle.po || 'Belum Terbit', curY - 40, true);
  drawMetaRow('Tanggal PO', bundle.tglPo || '-', curY - 58, true);
  drawMetaRow('No. FSTB', bundle.noFstb || 'Tersedia', curY - 76, true);
  drawMetaRow('No. TTB', bundle.noTtb || 'Tersedia', curY - 94, true);
  drawMetaRow('Item Pengadaan', (bundle.item || '-').slice(0, 30), curY - 112, true);

  // Tabel Daftar 4 Pilar Kelengkapan Berkas Administrasi
  curY -= 170;
  coverPage.drawText('VERIFIKASI 4 PILAR BERKAS FISIK & ELEKTRONIK', {
    x: 35,
    y: curY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  curY -= 15;
  const tableHeaderY = curY;
  coverPage.drawRectangle({
    x: 35,
    y: tableHeaderY - 20,
    width: pW - 70,
    height: 20,
    color: rgb(0.9, 0.93, 0.98),
  });

  coverPage.drawText('PILAR DOKUMEN', {
    x: 45,
    y: tableHeaderY - 14,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });

  coverPage.drawText('REFERENSI BERKAS', {
    x: 180,
    y: tableHeaderY - 14,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });

  coverPage.drawText('STATUS SOFTCOPY', {
    x: 340,
    y: tableHeaderY - 14,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });

  coverPage.drawText('LAMPIRAN', {
    x: 470,
    y: tableHeaderY - 14,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });

  const pilarRows = [
    {
      pilar: '1. FPB (Permohonan)',
      ref: bundle.fpb,
      ok: bundle.hasFpbDoc,
      note: bundle.hasFpbDoc ? 'e-FPB PDF Resmi' : 'Belum Ada',
    },
    {
      pilar: '2. FSTB (Serah Terima Brg)',
      ref: bundle.noFstb ? `FSTB No. ${bundle.noFstb}` : `PO ${bundle.po || '-'}`,
      ok: bundle.hasFstbDoc,
      note: bundle.hasFstbDoc ? 'Scan / PDF Resmi R2' : 'Menunggu Upload',
    },
    {
      pilar: '3. TTB (Tanda Terima Brg)',
      ref: bundle.noTtb ? `TTB No. ${bundle.noTtb}` : 'TTB Lapangan',
      ok: bundle.hasTtbDoc,
      note: bundle.hasTtbDoc ? 'Scan / Dokumen R2' : 'Menunggu Upload',
    },
    {
      pilar: '4. FOTO (Serah Terima Lap)',
      ref: `Armada ${bundle.armada}`,
      ok: bundle.hasPhotos,
      note: bundle.hasPhotos
        ? `${bundle.photoUrls?.length || 1} Foto Terlampir`
        : 'Belum Ada Foto',
    },
  ];

  let pY = tableHeaderY - 20;
  pilarRows.forEach((r, idx) => {
    pY -= 22;
    coverPage.drawRectangle({
      x: 35,
      y: pY,
      width: pW - 70,
      height: 22,
      borderColor: rgb(0.88, 0.9, 0.94),
      borderWidth: 0.5,
      color: idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.99, 1),
    });

    coverPage.drawText(r.pilar, {
      x: 45,
      y: pY + 6,
      size: 8,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.3),
    });

    coverPage.drawText(r.ref || '-', {
      x: 180,
      y: pY + 6,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.35),
    });

    // Badge OK / Menunggu
    const statusColor = r.ok ? rgb(0.08, 0.55, 0.35) : rgb(0.75, 0.35, 0.1);
    coverPage.drawText(r.ok ? 'TERSEDIA' : 'BELUM LENGKAP', {
      x: 340,
      y: pY + 6,
      size: 7.5,
      font: fontBold,
      color: statusColor,
    });

    coverPage.drawText(r.note, {
      x: 470,
      y: pY + 6,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    });
  });

  // Catatan Digital Signature & Tanggal Kompilasi
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const footerY = 60;
  coverPage.drawRectangle({
    x: 35,
    y: footerY,
    width: pW - 70,
    height: 48,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 0.5,
  });

  coverPage.drawText(
    'PERNYATAAN KOMPILASI RESMI SISTEM (COMMAND CENTER):',
    {
      x: 45,
      y: footerY + 32,
      size: 7.5,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.3),
    }
  );

  coverPage.drawText(
    `Dokumen ini telah disatukan dan dikompilasi secara otomatis pada ${dateStr} pukul ${timeStr} WITA.\nSemua berkas asli terlampir pada lembar-lembar berikutnya sebagai satu kesatuan dokumen pertanggungjawaban fisik.`,
    {
      x: 45,
      y: footerY + 18,
      size: 7,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.5),
      lineHeight: 9,
    }
  );

  // -------------------------------------------------------------
  // 2. BAGIAN FPB: Lampirkan Halaman Dokumen PDF e-FPB
  // -------------------------------------------------------------
  if (bundle.hasFpbDoc) {
    onProgress?.('Mengambil & menggabungkan dokumen e-FPB...');
    const fpbUrl =
      bundle.fpbPdfUrl ||
      `/api/parse-fpb-pdf?fpb=${encodeURIComponent(bundle.fpb)}&raw=true`;

    const fpbBytes = await fetchBinary(fpbUrl);
    if (fpbBytes && isPdfBuffer(fpbBytes)) {
      try {
        const fpbDoc = await PDFDocument.load(fpbBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(fpbDoc, fpbDoc.getPageIndices());
        copiedPages.forEach((p) => mergedPdf.addPage(p));
      } catch (err) {
        console.warn('Gagal memproses halaman PDF FPB:', err);
      }
    }
  }

  // -------------------------------------------------------------
  // 3. BAGIAN FSTB: Lampirkan Halaman Dokumen PDF/Gambar FSTB
  // -------------------------------------------------------------
  if (bundle.hasFstbDoc && bundle.fstbPdfUrl) {
    onProgress?.('Mengambil & menggabungkan dokumen FSTB...');
    const fstbBytes = await fetchBinary(bundle.fstbPdfUrl);
    if (fstbBytes) {
      if (isPdfBuffer(fstbBytes)) {
        try {
          const fstbDoc = await PDFDocument.load(fstbBytes, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(
            fstbDoc,
            fstbDoc.getPageIndices()
          );
          copiedPages.forEach((p) => mergedPdf.addPage(p));
        } catch (err) {
          console.warn('Gagal memproses halaman PDF FSTB:', err);
        }
      } else if (isJpegBuffer(fstbBytes) || isPngBuffer(fstbBytes)) {
        // Embed gambar FSTB sebagai satu halaman A4
        try {
          const img = isJpegBuffer(fstbBytes)
            ? await mergedPdf.embedJpg(fstbBytes)
            : await mergedPdf.embedPng(fstbBytes);

          const imgPage = mergedPdf.addPage(PageSizes.A4);
          const { width: iW, height: iH } = imgPage.getSize();
          const margin = 40;
          const maxW = iW - margin * 2;
          const maxH = iH - margin * 2 - 30;

          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const dW = img.width * scale;
          const dH = img.height * scale;

          imgPage.drawText('DOKUMEN FSTB RESMI (FORMULIR SERAH TERIMA BARANG)', {
            x: margin,
            y: iH - 30,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.15, 0.25),
          });

          imgPage.drawImage(img, {
            x: margin + (maxW - dW) / 2,
            y: iH - 45 - dH,
            width: dW,
            height: dH,
          });
        } catch (err) {
          console.warn('Gagal menyematkan gambar FSTB:', err);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. BAGIAN TTB: Lampirkan Halaman Dokumen PDF/Gambar TTB
  // -------------------------------------------------------------
  if (bundle.hasTtbDoc && bundle.ttbPdfUrl) {
    onProgress?.('Mengambil & menggabungkan dokumen TTB...');
    const ttbBytes = await fetchBinary(bundle.ttbPdfUrl);
    if (ttbBytes) {
      if (isPdfBuffer(ttbBytes)) {
        try {
          const ttbDoc = await PDFDocument.load(ttbBytes, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(
            ttbDoc,
            ttbDoc.getPageIndices()
          );
          copiedPages.forEach((p) => mergedPdf.addPage(p));
        } catch (err) {
          console.warn('Gagal memproses halaman PDF TTB:', err);
        }
      } else if (isJpegBuffer(ttbBytes) || isPngBuffer(ttbBytes)) {
        try {
          const img = isJpegBuffer(ttbBytes)
            ? await mergedPdf.embedJpg(ttbBytes)
            : await mergedPdf.embedPng(ttbBytes);

          const imgPage = mergedPdf.addPage(PageSizes.A4);
          const { width: iW, height: iH } = imgPage.getSize();
          const margin = 40;
          const maxW = iW - margin * 2;
          const maxH = iH - margin * 2 - 30;

          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const dW = img.width * scale;
          const dH = img.height * scale;

          imgPage.drawText('DOKUMEN TTB RESMI (TANDA TERIMA BARANG)', {
            x: margin,
            y: iH - 30,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.15, 0.25),
          });

          imgPage.drawImage(img, {
            x: margin + (maxW - dW) / 2,
            y: iH - 45 - dH,
            width: dW,
            height: dH,
          });
        } catch (err) {
          console.warn('Gagal menyematkan gambar TTB:', err);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 5. BAGIAN FOTO: Lampirkan Foto Serah Terima Fisik Lapangan
  // -------------------------------------------------------------
  if (bundle.hasPhotos && bundle.photoUrls && bundle.photoUrls.length > 0) {
    onProgress?.('Menyematkan bukti foto fisik serah terima lapangan...');

    for (let pIdx = 0; pIdx < bundle.photoUrls.length; pIdx++) {
      const pUrl = bundle.photoUrls[pIdx];
      const pBytes = await fetchBinary(pUrl);
      if (!pBytes) continue;

      if (isJpegBuffer(pBytes) || isPngBuffer(pBytes)) {
        try {
          const img = isJpegBuffer(pBytes)
            ? await mergedPdf.embedJpg(pBytes)
            : await mergedPdf.embedPng(pBytes);

          const pPage = mergedPdf.addPage(PageSizes.A4);
          const { width: pW, height: pH } = pPage.getSize();
          const margin = 40;

          // Header Halaman Foto
          pPage.drawText('LAMPIRAN BUKTI FISIK SERAH TERIMA LAPANGAN', {
            x: margin,
            y: pH - 32,
            size: 10,
            font: fontBold,
            color: rgb(0.08, 0.12, 0.2),
          });

          pPage.drawText(
            `Foto ${pIdx + 1} dari ${bundle.photoUrls.length} • Armada: ${bundle.armada} • TTB: ${bundle.noTtb || '-'} • FPB: ${bundle.fpb}`,
            {
              x: margin,
              y: pH - 46,
              size: 8,
              font: fontRegular,
              color: rgb(0.4, 0.45, 0.55),
            }
          );

          // Garis pemisah
          pPage.drawLine({
            start: { x: margin, y: pH - 52 },
            end: { x: pW - margin, y: pH - 52 },
            color: rgb(0.85, 0.88, 0.92),
            thickness: 1,
          });

          // Dimensi maksimal gambar
          const maxW = pW - margin * 2;
          const maxH = pH - 130;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const dW = img.width * scale;
          const dH = img.height * scale;

          const imgX = margin + (maxW - dW) / 2;
          const imgY = (pH - 65 - maxH) + (maxH - dH) / 2;

          // Gambar border / bingkai
          pPage.drawRectangle({
            x: imgX - 3,
            y: imgY - 3,
            width: dW + 6,
            height: dH + 6,
            borderColor: rgb(0.8, 0.84, 0.9),
            borderWidth: 1,
            color: rgb(0.96, 0.97, 0.99),
          });

          pPage.drawImage(img, {
            x: imgX,
            y: imgY,
            width: dW,
            height: dH,
          });

          // Caption di bawah foto
          pPage.drawText(
            `Dokumentasi fisik serah terima material pengadaan untuk armada ${bundle.armada} (Verified by CPG Logistic).`,
            {
              x: margin,
              y: 35,
              size: 7.5,
              font: fontRegular,
              color: rgb(0.45, 0.5, 0.6),
            }
          );
        } catch (err) {
          console.warn(`Gagal menyematkan foto ${pIdx + 1}:`, err);
        }
      }
    }
  }

  onProgress?.('Menyimpan bundel file PDF final...');
  const pdfBytes = await mergedPdf.save();
  const fileName = `BERKAS_LENGKAP_${cleanFpb}_${cleanPo}_${cleanArmada}.pdf`;

  return {
    blob: new Blob([pdfBytes as any], { type: 'application/pdf' }),
    fileName,
    totalPages: mergedPdf.getPageCount(),
  };
}

/**
 * Helper untuk mengunduh langsung file PDF bundel ke komputer pengguna
 */
export async function downloadDossierPdf(
  bundle: DossierBundleItem,
  onProgress?: (step: string) => void
): Promise<{ success: boolean; fileName: string; totalPages: number }> {
  try {
    const result = await compileDossierToPdf(bundle, onProgress);
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 20000);
    return { success: true, fileName: result.fileName, totalPages: result.totalPages };
  } catch (err: any) {
    console.error('Gagal mengunduh berkas dossier PDF:', err);
    throw err;
  }
}
