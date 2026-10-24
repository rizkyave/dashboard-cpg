import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { AppNotification, WaGatewayConfig } from '@/types/notification';
import { sendViaWaGateway } from '@/utils/whatsappNotifier';
import { getWaConfig, saveWaConfig } from '@/utils/waConfigStorage';
import {
  uploadToR2,
  isR2Configured,
  getObjectFromR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NOTIFICATIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'notifications-data.json');
const R2_NOTIFICATIONS_KEY = 'notifications-metadata/notifications.json';

// Baca riwayat notifikasi dari Cloudflare R2 atau lokal disk
async function getStoredNotifications(): Promise<AppNotification[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_NOTIFICATIONS_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('Gagal membaca notifikasi dari R2:', err);
    }
  }

  try {
    const raw = await fs.readFile(NOTIFICATIONS_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan notifikasi ke Cloudflare R2 dan lokal
async function saveNotifications(notifications: AppNotification[]) {
  // Batasi hanya menyimpan 150 notifikasi terbaru
  const trimmed = notifications.slice(0, 150);
  const jsonStr = JSON.stringify(trimmed, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_NOTIFICATIONS_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal upload notifikasi ke R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(NOTIFICATIONS_FILE_PATH), { recursive: true });
    await fs.writeFile(NOTIFICATIONS_FILE_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal
  }
}

/**
 * GET: Ambil daftar notifikasi untuk user yang sedang aktif
 * Query params: username, role, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || '';
    const role = searchParams.get('role') || '';
    const isConfigOnly = searchParams.get('config') === 'true';

    // Jika hanya meminta konfigurasi WA Gateway (untuk Admin)
    if (isConfigOnly) {
      const waConfig = await getWaConfig();
      // Mask token jika bukan full admin request
      return NextResponse.json({ success: true, config: waConfig });
    }

    const all = await getStoredNotifications();

    // Filter notifikasi berdasarkan role dan target user
    const filtered = all.filter((n) => {
      // 1. Jika ada targetUsers spesifik
      if (n.targetUsers && n.targetUsers.length > 0) {
        return username && n.targetUsers.includes(username);
      }
      // 2. Jika targetRole spesifik
      if (n.targetRole && n.targetRole !== 'all') {
        // Admin & manager selalu bisa melihat semua notifikasi sistem
        if (role === 'admin' || role === 'manager' || role === 'supervisor') return true;
        // User PIC TTB
        if (n.targetRole === 'staf_ttb' && (role === 'staf_ttb' || role === 'staf_lapangan')) {
          return true;
        }
        return role === n.targetRole;
      }
      return true;
    });

    const unreadCount = filtered.filter(
      (n) => !username || !n.readBy.includes(username)
    ).length;

    return NextResponse.json({
      success: true,
      notifications: filtered.slice(0, 50),
      unreadCount,
    });
  } catch (err: any) {
    console.error('Error GET /api/notifications:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat notifikasi.' },
      { status: 500 }
    );
  }
}

/**
 * POST: Tambah notifikasi baru atau update konfigurasi WA
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Simpan konfigurasi WA Gateway
    if (body.action === 'SAVE_WA_CONFIG') {
      const newConfig: WaGatewayConfig = {
        provider: body.config?.provider || 'none',
        apiKey: body.config?.apiKey || '',
        targetPhoneNumbers: body.config?.targetPhoneNumbers || '',
        groupTarget: body.config?.groupTarget || '',
        enabled: Boolean(body.config?.enabled),
      };
      await saveWaConfig(newConfig);
      return NextResponse.json({
        success: true,
        message: 'Konfigurasi WhatsApp Gateway berhasil disimpan.',
        config: newConfig,
      });
    }

    // 2. Tandai sudah dibaca (Mark as Read)
    if (body.action === 'MARK_AS_READ') {
      const { notificationId, username } = body;
      if (!username) {
        return NextResponse.json({ success: false, message: 'Username diperlukan.' }, { status: 400 });
      }

      const all = await getStoredNotifications();
      const updated = all.map((n) => {
        if (notificationId === 'ALL' || n.id === notificationId) {
          if (!n.readBy.includes(username)) {
            return { ...n, readBy: [...n.readBy, username] };
          }
        }
        return n;
      });

      await saveNotifications(updated);
      return NextResponse.json({ success: true, message: 'Notifikasi telah ditandai dibaca.' });
    }

    // 3. Tambah notifikasi baru (misal saat upload FSTB)
    const {
      type,
      title,
      message,
      senderName,
      senderUsername,
      senderRole,
      targetRole = 'staf_ttb',
      targetUsers,
      linkTab = 'monitoring-internal',
      metadata = {},
      triggerWa = true,
    } = body;

    const newNotification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: type || 'FSTB_UPLOADED',
      title: title || 'FSTB Baru Diunggah',
      message: message || `Berkas FSTB ${metadata.noFstb || ''} telah diunggah dan siap diproses ke TTB.`,
      senderName: senderName || 'User Pengunggah',
      senderUsername: senderUsername || 'user',
      senderRole: senderRole || 'Purchasing',
      targetRole,
      targetUsers,
      linkTab,
      metadata,
      createdAt: new Date().toISOString(),
      readBy: [],
    };

    const all = await getStoredNotifications();
    all.unshift(newNotification);
    await saveNotifications(all);

    // Jika WA Gateway aktif dan triggerWa true, coba kirim WA otomatis di background
    let waResult: { success: boolean; message: string } | null = null;
    if (triggerWa) {
      try {
        const waConfig = await getWaConfig();
        if (waConfig.enabled && waConfig.apiKey && waConfig.provider !== 'none') {
          waResult = await sendViaWaGateway(waConfig, {
            type: newNotification.type,
            noFstb: metadata.noFstb,
            noTtb: metadata.noTtb,
            noPo: metadata.noPo,
            noFpb: metadata.noFpb,
            armada: metadata.armada,
            itemSummary: metadata.itemSummary,
            uploaderName: senderName || 'User',
            uploaderRole: senderRole || 'Staf',
            validatorName: metadata.validatorName || senderName,
            validatorRole: metadata.validatorRole || senderRole,
            recipientName: metadata.recipientName,
            recipientRole: metadata.recipientRole,
            courierName: metadata.courierName,
            carrierContact: metadata.carrierContact,
            shippingMethod: metadata.shippingMethod,
          });
        }
      } catch (waErr) {
        console.warn('Gagal trigger otomatis WA Gateway:', waErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notifikasi berhasil dibuat.',
      notification: newNotification,
      waResult,
    });
  } catch (err: any) {
    console.error('Error POST /api/notifications:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses notifikasi.' },
      { status: 500 }
    );
  }
}
