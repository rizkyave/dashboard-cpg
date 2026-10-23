import { WaGatewayConfig } from '@/types/notification';

export interface WhatsAppNotificationPayload {
  noFstb: string;
  noPo?: string;
  noFpb?: string;
  armada?: string;
  uploaderName: string;
  uploaderRole?: string;
  fileCount?: number;
  webUrl?: string;
}

/**
 * Format teks pesan WhatsApp resmi untuk pemberitahuan upload FSTB baru
 */
export function formatFstbWaMessage(payload: WhatsAppNotificationPayload): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WITA';

  const webUrl =
    payload.webUrl ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://dashboard-cpg.vercel.app');

  return `🔔 *NOTIFIKASI PEKERJAAN FSTB BARU* 📦
Halo Rekan Tim PIC TTB,

User *${payload.uploaderName}* (${payload.uploaderRole || 'Purchasing'}) baru saja mengunggah & memproses berkas FSTB:

📄 *No. FSTB:* ${payload.noFstb || '-'}
🚢 *Kapal / Unit:* ${payload.armada || '-'}
📋 *No. PO:* ${payload.noPo || '-'}
📁 *No. FPB:* ${payload.noFpb || '-'}
🗓 *Waktu:* ${dateStr}, ${timeStr}
${payload.fileCount ? `📎 *Jumlah Berkas:* ${payload.fileCount} file\n` : ''}
Mohon segera diproses untuk persiapan penerimaan barang & pembuatan dokumen TTB.

🔗 *Buka Dashboard:*
${webUrl}

_Pesan otomatis dikirim oleh CPG Procurement Dashboard._`;
}

/**
 * Hasilkan URL wa.me (Direct WhatsApp Web / Mobile) untuk pengiriman manual 1-klik
 */
export function generateDirectWaLink(
  payload: WhatsAppNotificationPayload,
  phoneNumber?: string
): string {
  const text = formatFstbWaMessage(payload);
  const encodedText = encodeURIComponent(text);

  if (phoneNumber) {
    // Normalisasi no hp Indonesia (08xx -> 628xx)
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    return `https://wa.me/${cleaned}?text=${encodedText}`;
  }

  // Jika tanpa nomor spesifik, buka WhatsApp dengan text terisi sehingga user bisa memilih kontak/grup sendiri
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

  const message = formatFstbWaMessage(payload);
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
          phone: targets[0], // Wablas single target
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
