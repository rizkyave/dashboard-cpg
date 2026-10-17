import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  uploadToR2,
  isR2Configured,
  getR2FileUrl,
  getObjectFromR2,
  deleteFromR2,
} from '@/utils/r2Client';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { extractTakenAt, parseNoTtb, extractTtbFromFilename } from '@/utils/ttbPhotoMatch';
import { sanitizeTtbNumber, extractTtbComponents } from '@/utils/ttbRename';
import { SerahTerimaItem, SerahTerimaResponse, SerahTerimaPhoto, KondisiSerahTerima } from '@/types/serahTerima';
import { UploadedTtbItem } from '@/types/ttbUpload';
import { stampTtbRecipientPdf, formatTtbStampDate } from '@/utils/ttbStamper';
import rawManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const R2_METADATA_HISTORY_KEY = 'ttb-metadata/serah-terima-history.json';
const LOCAL_HISTORY_PATH = path.join(process.cwd(), 'src', 'data', 'serah-terima-history.json');
const TTB_HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');

let photoManifest: Record<string, string> = { ...(rawManifest as Record<string, string>) };

// Baca riwayat serah terima lapangan dari Cloudflare R2 (dengan fallback lokal)
async function getHistory(): Promise<SerahTerimaItem[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_METADATA_HISTORY_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca serah-terima history dari Cloudflare R2:', err);
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_HISTORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan riwayat serah terima lapangan ke Cloudflare R2 dan lokal
async function saveHistory(records: SerahTerimaItem[]) {
  const jsonStr = JSON.stringify(records, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_HISTORY_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal menyimpan serah-terima history ke Cloudflare R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_HISTORY_PATH), { recursive: true });
    await fs.writeFile(LOCAL_HISTORY_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal di serverless
  }
}

// GET: Ambil daftar riwayat serah terima lapangan (bisa search query / ttb)
export async function GET(req: NextRequest): Promise<NextResponse<SerahTerimaResponse>> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const ttb = (searchParams.get('ttb') || '').trim();

    let records = await getHistory();

    if (ttb) {
      const target = parseNoTtb(ttb);
      records = records.filter((r) => {
        const recTarget = parseNoTtb(r.noTtb);
        return recTarget.numbers.some((num) => target.numbers.includes(num));
      });
    }

    if (query) {
      records = records.filter(
        (r) =>
          r.noTtb.toLowerCase().includes(query) ||
          r.armada.toLowerCase().includes(query) ||
          r.petugas.toLowerCase().includes(query) ||
          r.penerima.toLowerCase().includes(query) ||
          (r.noFpb && r.noFpb.toLowerCase().includes(query)) ||
          (r.noPo && r.noPo.toLowerCase().includes(query)) ||
          (r.itemSummary && r.itemSummary.toLowerCase().includes(query)) ||
          (r.catatan && r.catatan.toLowerCase().includes(query))
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil memuat data serah terima lapangan.',
      records,
      isR2Active: isR2Configured(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal memuat data serah terima lapangan.',
        error: (err as Error).message,
        records: [],
      },
      { status: 500 }
    );
  }
}

// POST: Unggah foto bukti serah terima barang ke Cloudflare R2 dan simpan data pengantaran
export async function POST(req: NextRequest): Promise<NextResponse<SerahTerimaResponse>> {
  try {
    const formData = await req.formData();
    const noTtbRaw = ((formData.get('noTtb') as string) || '').trim();
    const armada = ((formData.get('armada') as string) || '').trim();
    const noFpb = ((formData.get('noFpb') as string) || '').trim();
    const noPo = ((formData.get('noPo') as string) || '').trim();
    const itemSummary = ((formData.get('itemSummary') as string) || '').trim();
    const petugas = ((formData.get('petugas') as string) || '').trim();
    const penerima = ((formData.get('penerima') as string) || '').trim();
    const kontakPenerima = ((formData.get('kontakPenerima') as string) || '').trim();
    const tanggalSerahTerima = ((formData.get('tanggalSerahTerima') as string) || '').trim();
    const kondisi = (((formData.get('kondisi') as string) || 'LENGKAP_BAIK') as KondisiSerahTerima);
    const catatan = ((formData.get('catatan') as string) || '').trim();
    const penerimaSignature = ((formData.get('penerimaSignature') as string) || '').trim();

    if (!noTtbRaw) {
      return NextResponse.json(
        { success: false, message: 'Nomor TTB referensi wajib diisi.', error: 'Nomor TTB wajib diisi.' },
        { status: 400 }
      );
    }

    if (!penerima) {
      return NextResponse.json(
        { success: false, message: 'Nama penerima barang (end user) wajib diisi.', error: 'Penerima wajib diisi.' },
        { status: 400 }
      );
    }

    // Ambil foto-foto yang diunggah
    const files: File[] = [];
    const rawFiles = formData.getAll('photos');
    for (const item of rawFiles) {
      if (item instanceof File && item.size > 0) files.push(item);
    }
    const altFiles = formData.getAll('files');
    for (const item of altFiles) {
      if (item instanceof File && item.size > 0) files.push(item);
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Harap sertakan minimal 1 bukti foto serah terima barang.',
          error: 'Foto bukti serah terima wajib diunggah.',
        },
        { status: 400 }
      );
    }

    // Validasi format foto
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase();
      if (!IMAGE_EXT.test(ext)) {
        return NextResponse.json(
          {
            success: false,
            message: `Format berkas "${f.name}" tidak didukung. Harap gunakan foto JPG, PNG, atau WEBP.`,
            error: 'Format foto tidak didukung.',
          },
          { status: 400 }
        );
      }
    }

    // Standardisasi nomor TTB (cth: CPL-TTB 04975 atau TTB 04975)
    let cleanTtb = noTtbRaw.toUpperCase().replace(/\s+/g, ' ');
    if (!cleanTtb.includes('TTB')) {
      cleanTtb = `TTB ${cleanTtb}`;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeStamp = `${yyyy}-${mm}-${dd} at ${hh}.${min}.${ss}`;
    const armadaPrefix = armada ? `${armada.toUpperCase()} ` : '';

    const isR2Active = isR2Configured();
    const targetPhotosDir = getPhotosDir();
    try {
      await fs.mkdir(targetPhotosDir, { recursive: true });
    } catch {
      // Non-fatal
    }

    const uploadedPhotos: SerahTerimaPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = path.extname(f.name).toLowerCase() || '.jpeg';
      const suffix = files.length > 1 ? `_${i + 1}` : '';
      const generatedFilename = `${armadaPrefix}${cleanTtb} ${timeStamp}${suffix}${ext}`;
      const buffer = Buffer.from(await f.arrayBuffer());
      const r2Key = `ttb-photos/${generatedFilename}`;

      let publicUrl = `/api/ttb-photos/file?name=${encodeURIComponent(generatedFilename)}`;

      // 1. Simpan ke Cloudflare R2
      if (isR2Active) {
        try {
          const r2Res = await uploadToR2({
            key: r2Key,
            body: buffer,
            contentType: f.type || 'image/jpeg',
            metadata: {
              noTtb: cleanTtb,
              armada: armada || '-',
              penerima,
              petugas: petugas || 'Tim Lapangan',
              kondisi,
              originalFileName: f.name,
              source: 'SERAH_TERIMA_LAPANGAN',
            },
          });
          publicUrl = r2Res.url;
          photoManifest[generatedFilename] = publicUrl;
        } catch (r2Err) {
          console.warn('Gagal upload foto serah terima ke R2, fallback lokal:', r2Err);
        }
      }

      // 2. Salinan lokal
      try {
        await fs.writeFile(path.join(targetPhotosDir, generatedFilename), buffer);
      } catch {
        // Non-fatal di serverless
      }

      uploadedPhotos.push({
        name: generatedFilename,
        originalName: f.name,
        url: publicUrl,
        r2Key: isR2Active ? r2Key : undefined,
        size: f.size,
      });
    }

    // Perbarui manifest foto TTB agar langsung muncul di Galeri Foto TTB
    try {
      await fs.writeFile(MANIFEST_PATH, JSON.stringify(photoManifest, null, 1), 'utf8');
    } catch {
      // Non-fatal
    }

    // Auto-Stamp tanda tangan digital penerima ke dokumen TTB resmi (kolom Received By : User)
    // dan GANTIKAN (OVERWRITE) berkas serta riwayat TTB agar menjadi data terbaru di seluruh sistem
    let isTtbStamped = false;
    let ttbDocUrl: string | undefined = undefined;

    if (penerimaSignature) {
      try {
        let ttbHistory: UploadedTtbItem[] = [];

        // 1. Baca riwayat TTB dari Cloudflare R2 terlebih dahulu (sinkron dengan /api/upload-ttb)
        if (isR2Active) {
          try {
            const r2HistObj = await getObjectFromR2('ttb-metadata/history.json');
            if (r2HistObj && r2HistObj.body) {
              const parsed = JSON.parse(Buffer.from(r2HistObj.body).toString('utf8'));
              if (Array.isArray(parsed) && parsed.length > 0) {
                ttbHistory = parsed;
              }
            }
          } catch (r2HistErr) {
            console.warn('Gagal membaca history dari Cloudflare R2:', r2HistErr);
          }
        }

        // Fallback disk lokal jika R2 kosong atau belum dikonfigurasi
        if (ttbHistory.length === 0) {
          try {
            const rawHistory = await fs.readFile(TTB_HISTORY_FILE_PATH, 'utf8');
            ttbHistory = JSON.parse(rawHistory);
          } catch {
            ttbHistory = [];
          }
        }

        const cleanSearch = sanitizeTtbNumber(cleanTtb);
        const digitsOnly = cleanSearch.replace(/\D/g, '');
        const padded5 = digitsOnly && digitsOnly.length <= 5 ? digitsOnly.padStart(5, '0') : '';
        const searchComp = extractTtbComponents(cleanSearch);

        // Cari item TTB yang sesuai di riwayat
        const matchedTtbIndex = ttbHistory.findIndex((t) => {
          const tClean = sanitizeTtbNumber(t.noTtb || '');
          if (tClean === cleanSearch) return true;
          if (cleanSearch.length >= 4 && tClean.includes(cleanSearch)) return true;

          const tComp = extractTtbComponents(tClean);
          // Jika kedua belah pihak memiliki prefix eksplisit namun berbeda perusahaan, jangan cocokkan
          if (searchComp.prefix && tComp.prefix && searchComp.prefix !== tComp.prefix) {
            return false;
          }

          if (digitsOnly && digitsOnly.length >= 4) {
            const tDigits = tClean.replace(/\D/g, '');
            if (tDigits.includes(digitsOnly) || (padded5 && tDigits.includes(padded5))) return true;
          }
          const fName = (t.renamedFileName || t.originalFileName || '').toLowerCase();
          if (fName.includes(cleanSearch.toLowerCase())) return true;
          if (digitsOnly && digitsOnly.length >= 4 && fName.includes(digitsOnly)) return true;
          return false;
        });

        const ttbItem = matchedTtbIndex !== -1 ? ttbHistory[matchedTtbIndex] : null;
        let pdfBuffer: Buffer | null = null;
        let targetKey = ttbItem?.r2Key;
        const targetFileName = ttbItem?.renamedFileName || `${cleanSearch}.pdf`;

        // Cari dan baca PDF TTB asli (dari Cloudflare R2 terlebih dahulu)
        if (isR2Active) {
          const keysToTry = [
            targetKey,
            `ttb-documents/${targetFileName}`,
            `ttb-documents/${cleanSearch}.pdf`,
          ].filter(Boolean) as string[];

          for (const k of keysToTry) {
            try {
              const r2Obj = await getObjectFromR2(k);
              if (r2Obj && r2Obj.body && r2Obj.body.length > 0) {
                pdfBuffer = Buffer.from(r2Obj.body);
                targetKey = k;
                break;
              }
            } catch {
              // Coba key berikutnya
            }
          }
        }

        // Jika belum ada di R2, coba baca dari berkas lokal
        if (!pdfBuffer || pdfBuffer.length === 0) {
          const localCandidates = [
            path.join(targetPhotosDir, targetFileName),
            path.join(targetPhotosDir, `${cleanSearch}.pdf`),
            path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB', targetFileName),
            path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB', `${cleanSearch}.pdf`),
          ];

          for (const candPath of localCandidates) {
            try {
              const b = await fs.readFile(candPath);
              if (b && b.length > 0) {
                pdfBuffer = b;
                break;
              }
            } catch {
              // Coba kandidat berikutnya
            }
          }
        }

        // Jika belum ada dokumen fisik yang cocok, gunakan template PDF TTB resmi formulir standar
        if (!pdfBuffer || pdfBuffer.length === 0) {
          try {
            const templateCandidates = [
              path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB', 'TTB-000055.pdf'),
              path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB', 'CPL-TTB-26-06810.pdf'),
            ];
            for (const tpl of templateCandidates) {
              try {
                const tb = await fs.readFile(tpl);
                if (tb && tb.length > 0) {
                  pdfBuffer = tb;
                  break;
                }
              } catch {
                // Lanjut
              }
            }
          } catch {
            // Abaikan
          }
        }

        if (pdfBuffer && pdfBuffer.length > 0) {
          // Bubuhi tanda tangan digital penerima (kolom Received By : User) dan nomor kontak di kotak hitam
          const stampedPdfBuffer = await stampTtbRecipientPdf({
            pdfBuffer,
            recipientSignatureDataUrl: penerimaSignature,
            recipientName: penerima,
            receiptDate: formatTtbStampDate(tanggalSerahTerima),
            recipientPhone: kontakPenerima,
          });

          const finalKey = targetKey || `ttb-documents/${targetFileName}`;
          const freshTimestamp = Date.now();
          const freshUrl = `/api/r2-file?key=${encodeURIComponent(finalKey)}&v=${freshTimestamp}`;

          // SIMPAN KEMBALI KE CLOUDFLARE R2 (MENIMPA / MENGGANTIKAN DATA LAMA)
          if (isR2Active) {
            await uploadToR2({
              key: finalKey,
              body: stampedPdfBuffer,
              contentType: 'application/pdf',
              metadata: {
                noTtb: cleanTtb,
                recipientName: penerima,
                recipientPhone: kontakPenerima || '',
                isRecipientStamped: 'true',
                recipientStampedAt: new Date().toISOString(),
              },
            });
          }

          // Simpan salinan ke lokal
          try {
            const localCandidatePath = path.join(targetPhotosDir, targetFileName);
            await fs.writeFile(localCandidatePath, stampedPdfBuffer);
          } catch {
            // Non-fatal
          }

          isTtbStamped = true;
          ttbDocUrl = freshUrl;

          // PERBARUI ATAU GANTIKAN RECORD DI RIWAYAT TTB DATABASE
          const nowIso = new Date().toISOString();
          if (matchedTtbIndex !== -1 && ttbItem) {
            ttbHistory[matchedTtbIndex] = {
              ...ttbItem,
              fileSize: stampedPdfBuffer.length,
              fileUrl: freshUrl,
              r2Url: freshUrl,
              isRecipientStamped: true,
              recipientName: penerima,
              recipientPhone: kontakPenerima || undefined,
              recipientSignatureDataUrl: penerimaSignature,
              recipientStampedAt: nowIso,
              status: 'STORED_IN_CLOUDFLARE_R2',
            };
          } else {
            // Jika dokumen TTB belum ada di riwayat Upload TTB, buatkan entri baru resmi
            const newTtbItem: UploadedTtbItem = {
              id: `ttb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              noTtb: cleanTtb,
              cleanNoTtb: cleanSearch,
              armada: armada || '-',
              receivedDate: (tanggalSerahTerima || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
              keterangan: `Diserahkan dan ditandatangani oleh ${penerima}`,
              originalFileName: targetFileName,
              renamedFileName: targetFileName,
              fileSize: stampedPdfBuffer.length,
              fileType: 'application/pdf',
              fileUrl: freshUrl,
              r2Key: finalKey,
              r2Url: freshUrl,
              storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
              uploadedAt: nowIso,
              status: 'STORED_IN_CLOUDFLARE_R2',
              uploaderName: petugas,
              isAutoStamped: true,
              isRecipientStamped: true,
              recipientName: penerima,
              recipientPhone: kontakPenerima || undefined,
              recipientSignatureDataUrl: penerimaSignature,
              recipientStampedAt: nowIso,
            };
            ttbHistory.unshift(newTtbItem);
          }

          // SIMPAN HISTORY TERBARU KE CLOUDFLARE R2 AGAR MENU UPLOAD TTB LANGSUNG MENAMPILKAN DATA TERBARU
          const historyJsonStr = JSON.stringify(ttbHistory, null, 2);
          if (isR2Active) {
            try {
              await uploadToR2({
                key: 'ttb-metadata/history.json',
                body: Buffer.from(historyJsonStr, 'utf8'),
                contentType: 'application/json',
              });
            } catch (r2SaveErr) {
              console.warn('Gagal menyimpan ttb-metadata/history.json ke Cloudflare R2:', r2SaveErr);
            }
          }
          try {
            await fs.writeFile(TTB_HISTORY_FILE_PATH, historyJsonStr, 'utf8');
          } catch {
            // Non-fatal
          }
        }
      } catch (stampErr) {
        console.warn('Gagal membubuhkan tanda tangan penerima ke dokumen TTB:', stampErr);
      }
    }

    // Susun rekaman data Serah Terima Lapangan
    const newRecord: SerahTerimaItem = {
      id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      noTtb: cleanTtb,
      cleanNoTtb: sanitizeTtbNumber(cleanTtb),
      armada: armada || '-',
      noFpb: noFpb || undefined,
      noPo: noPo || undefined,
      itemSummary: itemSummary || undefined,
      petugas: petugas || 'Tim Lapangan CPG',
      penerima,
      kontakPenerima: kontakPenerima || undefined,
      tanggalSerahTerima:
        tanggalSerahTerima || `${yyyy}-${mm}-${dd} ${hh}:${min}`,
      kondisi,
      catatan: catatan || undefined,
      photos: uploadedPhotos,
      penerimaSignature: penerimaSignature || undefined,
      isTtbDocumentStamped: isTtbStamped || undefined,
      ttbDocumentUrl: ttbDocUrl || undefined,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      createdAt: new Date().toISOString(),
    };

    const currentHistory = await getHistory();
    currentHistory.unshift(newRecord);
    await saveHistory(currentHistory);

    return NextResponse.json({
      success: true,
      message: isTtbStamped
        ? `Sukses! Bukti serah terima tersimpan & dokumen resmi TTB ${cleanTtb} telah otomatis dibubuhi tanda tangan digital penerima!`
        : `Bukti serah terima TTB ${cleanTtb} berhasil disimpan dan disinkronkan ke Cloudflare R2!`,
      record: newRecord,
      isR2Active,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: `Gagal mengunggah bukti serah terima: ${(err as Error).message}`,
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

// DELETE: Hapus data bukti serah terima lapangan
export async function DELETE(req: NextRequest): Promise<NextResponse<SerahTerimaResponse>> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID rekaman tidak ditemukan.', error: 'ID wajib diisi.' },
        { status: 400 }
      );
    }

    const currentHistory = await getHistory();
    const target = currentHistory.find((r) => r.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, message: 'Data tidak ditemukan.', error: 'Data tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Hapus foto terkait dari Cloudflare R2 jika ada r2Key
    if (isR2Configured() && target.photos) {
      for (const p of target.photos) {
        if (p.r2Key) {
          try {
            await deleteFromR2(p.r2Key);
          } catch (r2DelErr) {
            console.warn(`Gagal hapus ${p.r2Key} dari R2:`, r2DelErr);
          }
        }
      }
    }

    const updated = currentHistory.filter((r) => r.id !== id);
    await saveHistory(updated);

    return NextResponse.json({
      success: true,
      message: `Data serah terima ${target.noTtb} berhasil dihapus.`,
      records: updated,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal menghapus rekaman serah terima.',
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}

