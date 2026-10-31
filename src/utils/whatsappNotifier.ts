import { WaGatewayConfig, NotificationType } from '@/types/notification';
import { FpbReviewRecord } from '@/types/fpbReview';

export interface WhatsAppNotificationPayload {
  type?: NotificationType;
  noFstb?: string;
  noTtb?: string;
  noPo?: string;
  noFpb?: string;
  armada?: string;
  itemSummary?: string;
  uploaderName?: string;
  uploaderRole?: string;
  validatorName?: string;
  validatorRole?: string;
  recipientName?: string;
  recipientRole?: string;
  courierName?: string;
  carrierContact?: string;
  shippingMethod?: string;
  notes?: string;
  fileCount?: number;
  webUrl?: string;
}

function getFormattedDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr =
    now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WITA';
  return { dateStr, timeStr };
}

function resolveWebUrl(customUrl?: string): string {
  return (
    customUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://dashboard-cpg.vercel.app')
  );
}

/**
 * 1. Format teks WhatsApp: FSTB Baru Diunggah (FSTB_UPLOADED)
 */
export function formatFstbWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  return `🔔 *NOTIFIKASI PEKERJAAN FSTB BARU* 📦
Halo Rekan Tim PIC TTB,

User *${payload.uploaderName || 'Purchasing'}* (${payload.uploaderRole || 'Purchasing'}) baru saja mengunggah & memproses berkas FSTB:

📄 *No. FSTB:* ${payload.noFstb || '-'}
🚢 *Kapal / Unit:* ${payload.armada || '-'}
📋 *No. PO:* ${payload.noPo || '-'}
📁 *No. FPB:* ${payload.noFpb || '-'}
🗓 *Waktu:* ${dateStr}, ${timeStr}
${payload.fileCount ? `📎 *Jumlah Berkas:* ${payload.fileCount} file\n` : ''}
Mohon segera diproses untuk persiapan penerimaan barang & pembuatan dokumen TTB.

🔗 *Buka Dashboard:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * 2. Format teks WhatsApp: FSTB Telah Divalidasi & Ditandatangani (FSTB_VALIDATED)
 */
export function formatFstbValidatedWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  return `✍️ *NOTIFIKASI PENGESAHAN DOKUMEN FSTB* 📋
Halo Rekan Tim TTB & Logistik,

User *${payload.validatorName || payload.uploaderName || 'User'}* (${payload.validatorRole || payload.uploaderRole || 'Pengesah'}) telah mengesahkan dokumen FSTB:

📄 *No. FSTB:* ${payload.noFstb || '-'}
🚢 *Kapal / Unit:* ${payload.armada || '-'}
📋 *No. PO:* ${payload.noPo || '-'}
📁 *No. FPB:* ${payload.noFpb || '-'}
🗓 *Waktu:* ${dateStr}, ${timeStr}

Status FSTB telah tervalidasi dan siap dilanjutkan ke proses penerbitan formulir TTB resmi.

🔗 *Buka Dashboard:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * 3. Format teks WhatsApp: TTB Baru Diunggah (TTB_UPLOADED)
 */
export function formatTtbUploadedWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  return `📦 *NOTIFIKASI PENGARSIPAN TTB BARU* 📑
Halo Tim Logistik & Manajemen,

User *${payload.uploaderName || 'Logistik TTB'}* (${payload.uploaderRole || 'Staf Logistik'}) telah mengunggah berkas Tanda Terima Barang (TTB):

📄 *No. TTB:* ${payload.noTtb || '-'}
🚢 *Armada / Unit:* ${payload.armada || '-'}
📋 *No. PO / DO:* ${payload.noPo || '-'}
${payload.itemSummary ? `📦 *Rincian Barang:* ${payload.itemSummary}\n` : ''}🗓 *Waktu:* ${dateStr}, ${timeStr}

Berkas tersimpan aman di Cloudflare R2 dan siap untuk tahap pengesahan/validasi oleh Supervisor & Procurement Manager.

🔗 *Buka Validasi Dokumen:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * 4. Format teks WhatsApp: TTB Divalidasi & Ditandatangani (TTB_VALIDATED)
 */
export function formatTtbValidatedWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  return `✍️ *NOTIFIKASI PENGESAHAN DOKUMEN TTB* 🛡️
Halo Tim Logistik & Tim Lapangan,

User *${payload.validatorName || payload.uploaderName || 'Manager'}* (${payload.validatorRole || payload.uploaderRole || 'Procurement Manager'}) telah mengesahkan dokumen TTB:

📄 *No. TTB:* ${payload.noTtb || '-'}
🚢 *Armada / Unit:* ${payload.armada || '-'}
📋 *No. PO:* ${payload.noPo || '-'}
${payload.itemSummary ? `📦 *Barang:* ${payload.itemSummary}\n` : ''}🗓 *Waktu:* ${dateStr}, ${timeStr}

Status Dokumen: *DISETUJUI MANAGER (SIAP KIRIM)*.
Barang telah sah dan siap dibawa ke armada / kapal untuk serah terima lapangan.

🔗 *Buka Serah Terima Lapangan:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * 5. Format teks WhatsApp: Keberangkatan Pengantaran Barang (TTB_DISPATCHED)
 */
export function formatTtbDispatchedWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  const isRemote = Boolean(payload.shippingMethod || payload.carrierContact);

  return `🚚 *NOTIFIKASI KEBERANGKATAN BARANG TTB* ⚓
Halo Rekan Tim Kapal & Logistik,

Barang untuk dokumen TTB berikut telah selesai diperiksa fisik (Pre-Check) dan memulai perjalanan:

📄 *No. TTB:* ${payload.noTtb || '-'}
🚢 *Tujuan Armada:* ${payload.armada || '-'}
${payload.itemSummary ? `📦 *Rincian Barang:* ${payload.itemSummary}\n` : ''}${
  isRemote
    ? `🚚 *Metode Titipan:* ${payload.shippingMethod || 'Pihak Ketiga'} (${payload.carrierContact || '-'})\n`
    : `👤 *Petugas Pengantar:* ${payload.courierName || payload.uploaderName || 'Tim Lapangan'}\n`
}🗓 *Waktu Berangkat:* ${dateStr}, ${timeStr}

Barang sedang menuju lokasi kapal/armada. Mohon kesiapan pihak penerima di atas kapal.

🔗 *Buka Dashboard:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * 6. Format teks WhatsApp: Serah Terima Selesai & TTD Kapal Lengkap (SERAH_TERIMA_COMPLETED)
 */
export function formatSerahTerimaCompletedWaMessage(payload: WhatsAppNotificationPayload): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const webUrl = resolveWebUrl(payload.webUrl);

  return `✅ *NOTIFIKASI SERAH TERIMA BARANG SELESAI (4/4)* 🎉
Halo Rekan Tim Logistik, Purchasing & Manajemen,

Serah terima barang TTB di lapangan telah *BERHASIL DISELESAIKAN* secara resmi:

📄 *No. TTB:* ${payload.noTtb || '-'}
🚢 *Armada Kapal:* ${payload.armada || '-'}
👤 *Penerima:* ${payload.recipientName || 'Kru Kapal'} (${payload.recipientRole || 'Nakhoda / User Kapal'})
📋 *No. PO:* ${payload.noPo || '-'}
${payload.itemSummary ? `📦 *Barang:* ${payload.itemSummary}\n` : ''}🗓 *Waktu:* ${dateStr}, ${timeStr}

Status Kelayakan: *DITERIMA PENERIMA (4/4 LENGKAP)*.
Dokumen PDF TTB telah dibubuhi tanda tangan digital penerima dan foto fisik serah terima telah diarsipkan ke Cloudflare R2.

🔗 *Lihat Berkas & Bukti Serah Terima:*
${webUrl}

_Pesan otomatis CPG Procurement Dashboard._`;
}

/**
 * Format Universal: Otomatis mendeteksi jenis notifikasi dan menghasilkan pesan WA yang tepat
 */
export function formatUniversalWaMessage(payload: WhatsAppNotificationPayload): string {
  if (payload.type === 'FSTB_VALIDATED') {
    return formatFstbValidatedWaMessage(payload);
  }
  if (payload.type === 'TTB_UPLOADED') {
    return formatTtbUploadedWaMessage(payload);
  }
  if (payload.type === 'TTB_VALIDATED') {
    return formatTtbValidatedWaMessage(payload);
  }
  if (payload.type === 'TTB_DISPATCHED') {
    return formatTtbDispatchedWaMessage(payload);
  }
  if (payload.type === 'SERAH_TERIMA_COMPLETED') {
    return formatSerahTerimaCompletedWaMessage(payload);
  }
  if (payload.type === 'FSTB_UPLOADED') {
    return formatFstbWaMessage(payload);
  }

  // Fallback berdasarkan data metadata
  if (payload.noTtb) {
    if (payload.recipientName) return formatSerahTerimaCompletedWaMessage(payload);
    if (payload.courierName || payload.carrierContact) return formatTtbDispatchedWaMessage(payload);
    if (payload.validatorName) return formatTtbValidatedWaMessage(payload);
    return formatTtbUploadedWaMessage(payload);
  }

  return formatFstbWaMessage(payload);
}

/**
 * Hasilkan URL wa.me (Direct WhatsApp Web / Mobile) untuk pengiriman manual 1-klik
 */
export function generateDirectWaLink(
  payload: WhatsAppNotificationPayload,
  phoneNumber?: string
): string {
  const text = formatUniversalWaMessage(payload);
  const encodedText = encodeURIComponent(text);

  if (phoneNumber) {
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return `https://wa.me/${cleaned}?text=${encodedText}`;
  }

  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Kirim pesan via WA Gateway (Fonnte / Wablas) di sisi server jika API Key terkonfigurasi
 */
export async function sendViaWaGateway(
  config: WaGatewayConfig,
  payload: WhatsAppNotificationPayload
): Promise<{ success: boolean; message: string }> {
  if (!config || !config.enabled || !config.apiKey || config.provider === 'none') {
    return { success: false, message: 'WA Gateway belum diaktifkan atau API Key kosong.' };
  }

  const message = formatUniversalWaMessage(payload);
  const targets = (config.targetPhoneNumbers || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (targets.length === 0) {
    return { success: false, message: 'Tidak ada nomor telepon tujuan WA yang ditentukan.' };
  }

  try {
    if (config.provider === 'fonnte') {
      const targetStr = targets.join(',');
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: targetStr,
          message,
          countryCode: '62',
        }),
      });

      const data = await res.json();
      if (res.ok && data.status) {
        return { success: true, message: 'Berhasil mengirim notifikasi WA via Fonnte.' };
      }
      return { success: false, message: data.reason || data.message || 'Gagal mengirim via Fonnte.' };
    }

    if (config.provider === 'wablas') {
      const res = await fetch('https://kudus.wablas.com/api/send-message', {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: targets[0],
          message,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status) {
        return { success: true, message: 'Berhasil mengirim notifikasi WA via Wablas.' };
      }
      return { success: false, message: data.message || 'Gagal mengirim via Wablas.' };
    }

    return { success: false, message: `Provider "${config.provider}" tidak dikenali.` };
  } catch (err: any) {
    console.error('Error sending WA notification:', err);
    return { success: false, message: err?.message || 'Gagal menghubungi server WA Gateway.' };
  }
}

/**
 * 7. Format teks WhatsApp: Persetujuan Review FPB untuk Terbit PO (ke Tim Purchasing)
 */
export function formatFpbApprovalWaMessage(record: FpbReviewRecord): string {
  const { dateStr, timeStr } = getFormattedDateTime();
  const cleanFpb = (record.fpbNo || '').trim();
  const efpbUrl = `https://e-fpb.cindaragroup.com/FilesList?psearch=${encodeURIComponent(cleanFpb)}`;
  const tkb = record.tkbNo ? record.tkbNo.trim() : '-';

  // Hitung jumlah item
  const items = record.items || [];
  const totalItem = items.length;
  const poItems = items.filter((i) => !i.decision || i.decision === 'PO');
  const stockItems = items.filter((i) => i.decision === 'STOCK');

  // Ambil cuplikan 3-5 item barang
  let itemSummaryLines = '';
  if (items.length > 0) {
    const sampleItems = items.slice(0, 5);
    const lines = sampleItems.map(
      (item, idx) =>
        `  ${idx + 1}. ${item.itemName} (${item.qty} ${item.unit || 'UNIT'})${
          item.decision === 'STOCK' ? ' ➔ [Stok Gudang]' : ' ➔ [PO]'
        }`
    );
    if (items.length > 5) {
      lines.push(`  ... dan ${items.length - 5} item lainnya`);
    }
    itemSummaryLines = `\n📦 *Daftar Item Disetujui:*\n${lines.join('\n')}\n`;
  }

  const urgencyLabel =
    record.urgency === 'EMERGENCY'
      ? '🚨 EMERGENCY (Kritis Armada)'
      : record.urgency === 'URGENT'
      ? '⚡ URGENT'
      : 'NORMAL';

  const priorityLabel = record.priorityLevel
    ? `${record.priorityLevel} (Target SLA)`
    : 'P1 (Utama: 1-2 Hari)';

  return `🔔 *NOTIFIKASI APPROVAL FPB SIAP TERBIT PO* 📄
━━━━━━━━━━━━━━━━━━━━━━━━━━
Halo Tim Purchasing CPG,

Pengajuan FPB berikut telah selesai di-review oleh Tim FPB / Logistik dan telah *DISETUJUI UNTUK PENERBITAN PO*:

📄 *No. FPB:* ${record.fpbNo}
🏷️ *No. TKB:* *${tkb}*
🚢 *Armada / Unit:* ${record.armada} (${record.entity})
📅 *Tanggal FPB:* ${record.date || dateStr}
⚡ *Prioritas & Urgensi:* ${priorityLabel} • ${urgencyLabel}
🎯 *Peruntukan / Keperluan:* ${record.purpose || '-'}

📊 *Ringkasan Alokasi Barang:*
• Total Kebutuhan: *${totalItem} item*
• Disetujui Terbit PO: *${poItems.length} item*
• Dipenuhi dari Stok Gudang: *${stockItems.length} item*
${itemSummaryLines}
📝 *Catatan Review Tim FPB:*
_${record.reviewNotes || 'Disetujui untuk segera diproses PO pengadaan'}_

👤 *Reviewer:* ${record.reviewedBy || 'Tim Review FPB'}
⏰ *Waktu Disetujui:* ${dateStr} ${timeStr}

Mohon bantuan Tim Purchasing untuk segera memproses penerbitan PO pengadaan sesuai konfirmasi No. TKB di atas.

🔗 *Buka Berkas e-FPB:*
${efpbUrl}

Terima kasih atas kerja samanya.
━━━━━━━━━━━━━━━━━━━━━━━━━━
_Dashboard CPG - Monitoring Procurement & Review FPB_`;
}

/**
 * Hasilkan URL WhatsApp untuk Notifikasi Approval FPB ke Purchasing
 */
export function generateFpbApprovalWaLink(
  record: FpbReviewRecord,
  phoneNumber?: string
): string {
  const text = formatFpbApprovalWaMessage(record);
  const encodedText = encodeURIComponent(text);

  if (phoneNumber) {
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return `https://wa.me/${cleaned}?text=${encodedText}`;
  }

  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

