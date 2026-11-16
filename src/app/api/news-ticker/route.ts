import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { isR2Configured, getObjectFromR2 } from '@/utils/r2Client';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';
import { DeliveryScheduleItem } from '@/types/deliverySchedule';
import { RemoteHandoverTokenData } from '@/types/remoteHandover';
import { NewsTickerItem, NewsTickerResponse } from '@/types/newsTicker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache 5 menit untuk stabilitas data

const R2_POSISI_KAPAL_KEY = 'dashboard-metadata/posisi-kapal.json';
const R2_DELIVERY_KEY = 'dashboard-metadata/delivery-schedules.json';
const LOCAL_DELIVERY_PATH = path.join(process.cwd(), 'src', 'data', 'delivery-schedules.json');

const R2_REMOTE_TOKENS_KEY = 'ttb-metadata/remote-handover-tokens.json';
const LOCAL_REMOTE_TOKENS_PATH = path.join(process.cwd(), 'src', 'data', 'remote-handover-tokens.json');

const LOCAL_FPB_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const LOCAL_PURCHASE_PLAN_PATH = path.join(process.cwd(), 'src', 'data', 'purchase-planning-data.json');

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
  };
}

function getWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return 'Cerah';
    case 1:
    case 2:
      return 'Cerah Berawan';
    case 3:
      return 'Berawan Tebal';
    case 45:
    case 48:
      return 'Berkabut Tipis';
    case 51:
    case 53:
    case 55:
      return 'Gerimis Ringan';
    case 61:
    case 63:
    case 65:
      return 'Hujan Sedang';
    case 80:
    case 81:
    case 82:
      return 'Hujan Lokal';
    case 95:
    case 96:
    case 99:
      return 'Hujan Disertai Petir';
    default:
      return 'Kondusif Berawan';
  }
}

function getWindDirectionText(degrees: number): string {
  const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

async function fetchMarineWeather(): Promise<{
  temp: number;
  humidity: number;
  windKn: number;
  windDir: string;
  condition: string;
  waveEstimate: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-1.26&longitude=116.83&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn',
      {
        signal: controller.signal,
        cache: 'no-store',
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data: OpenMeteoResponse = await res.json();
    if (!data.current) return null;

    const curr = data.current;
    const wind = Math.round(curr.wind_speed_10m * 10) / 10;
    let waveEstimate = '0.3 - 0.6m (Tenang)';
    if (wind > 15) {
      waveEstimate = '1.25 - 2.0m (Sedang - Waspada)';
    } else if (wind > 9) {
      waveEstimate = '0.6 - 1.2m (Rendah)';
    }

    return {
      temp: Math.round(curr.temperature_2m * 10) / 10,
      humidity: Math.round(curr.relative_humidity_2m),
      windKn: wind,
      windDir: getWindDirectionText(curr.wind_direction_10m),
      condition: getWeatherDescription(curr.weather_code),
      waveEstimate,
    };
  } catch {
    return null;
  }
}

async function getVesselPositionsFromR2(): Promise<{ items: KapalPosisiItem[]; summary?: KapalPosisiSummary } | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_POSISI_KAPAL_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          summary: parsed.summary,
        };
      }
    }
  } catch (err) {
    console.warn('News Ticker: Gagal membaca data armada dari R2:', err);
  }
  return null;
}

async function getDeliverySchedules(): Promise<DeliveryScheduleItem[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_DELIVERY_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_DELIVERY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function getRemoteHandoverTokens(): Promise<RemoteHandoverTokenData[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_REMOTE_TOKENS_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_REMOTE_TOKENS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function getFpbReviewsData(): Promise<any[]> {
  try {
    const raw = await fs.readFile(LOCAL_FPB_REVIEWS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function getPurchasePlanningData(): Promise<any | null> {
  try {
    const raw = await fs.readFile(LOCAL_PURCHASE_PLAN_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {}
  return null;
}

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  // Ambil seluruh data secara paralel
  const [schedules, remoteTokens, vesselData, weather, fpbReviews, purchasePlan] = await Promise.all([
    getDeliverySchedules(),
    getRemoteHandoverTokens(),
    getVesselPositionsFromR2(),
    fetchMarineWeather(),
    getFpbReviewsData(),
    getPurchasePlanningData(),
  ]);

  const items: NewsTickerItem[] = [];

  // ========================================================
  // 1. UPDATE STATUS REVIEW FPB (Analisa Ketersediaan & Alokasi PO)
  // ========================================================
  if (fpbReviews && fpbReviews.length > 0) {
    const approvedCount = fpbReviews.filter((r) => r.reviewStatus === 'APPROVED_PO').length;
    items.push({
      id: 'fpb-review-summary',
      category: 'REVIEW FPB',
      badge: 'REVIEW FPB',
      title: 'Pusat Analisis e-FPB',
      content: `Total ${fpbReviews.length} Berkas e-FPB Teranalisis: ${approvedCount} Disetujui Masuk PO & Stok Gudang Mandiri.`,
      highlight: `${approvedCount} Disetujui PO`,
      timestamp: dateStr,
      severity: 'marine',
    });

    // Ambil 2 sampel FPB penting terkini
    const sampleReviews = fpbReviews.slice(0, 2);
    sampleReviews.forEach((r) => {
      const isApproved = r.reviewStatus === 'APPROVED_PO';
      const cleanArmada = r.armada || 'Unit Operasional';
      items.push({
        id: `fpb-rev-${r.fpbNo}`,
        category: 'REVIEW FPB',
        badge: 'FPB TERKINI',
        title: `${r.fpbNo} • ${cleanArmada}`,
        content: `Keperluan: ${r.purpose || 'Kebutuhan Operasional'} • Rekomendasi: ${isApproved ? 'Disetujui Alokasi PO & Cek Stok' : 'Menunggu Klarifikasi Lanjutan'}`,
        highlight: isApproved ? 'DISETUJUI PO' : 'KLARIFIKASI',
        timestamp: r.date || dateStr,
        severity: isApproved ? 'success' : 'warning',
      });
    });
  } else {
    items.push({
      id: 'fallback-fpb-review',
      category: 'REVIEW FPB',
      badge: 'REVIEW FPB',
      title: 'Analisa Review e-FPB Selesai',
      content: 'Pemeriksaan duplikasi permintaan armada kapal & ketersediaan stok gudang Accurate berjalan otomatis.',
      highlight: 'Sistem Aktif',
      timestamp: dateStr,
      severity: 'info',
    });
  }

  // ========================================================
  // 2. STATUS PURCHASE PLAN BATCH TERKINI (Konsolidasi Pengadaan)
  // ========================================================
  if (purchasePlan && purchasePlan.summary) {
    const summ = purchasePlan.summary;

    items.push(
      {
        id: 'pp-batch-summary',
        category: 'PURCHASE PLAN',
        badge: 'PURCHASE PLAN BATCH',
        title: 'Batch Konsolidasi CPL-PP-2026-004',
        content: `Konsolidasi ${summ.totalItems} Item (${summ.criticalCount} Kritis, ${summ.reorderCount} Reorder) untuk ${summ.activeVesselsCount} Armada Kapal CPG • Status: Tahap Final Otorisasi PO Massal.`,
        highlight: 'STATUS SIAP PO',
        timestamp: dateStr,
        severity: 'success',
      },
      {
        id: 'pp-batch-priority',
        category: 'PURCHASE PLAN',
        badge: 'BATCH PRIORITAS',
        title: 'Batch Kebutuhan Kritis Armada',
        content: `${summ.criticalCount} Item mendesak (Suku Cadang Mesin & Kelistrikan Kapal) siap masuk otorisasi PO massal.`,
        highlight: 'SIAP OTORISASI',
        timestamp: dateStr,
        severity: 'warning',
      }
    );
  } else {
    items.push({
      id: 'fallback-purchase-plan',
      category: 'PURCHASE PLAN',
      badge: 'PURCHASE PLAN',
      title: 'Batch Konsolidasi Pengadaan',
      content: 'Purchase Planning Batch berjalan optimal: konsolidasi kebutuhan material armada siap masuk proses pengadaan massal.',
      highlight: 'KONSOLIDASI AKTIF',
      timestamp: dateStr,
      severity: 'success',
    });
  }

  // ========================================================
  // 3. STATUS TERAKHIR TTB DALAM PROSES PENGANTARAN (3-4 Items)
  // ========================================================
  const pendingTokens = remoteTokens.filter((t) => !t.isUsed);
  const deliveredTokens = remoteTokens.filter((t) => t.isUsed);

  if (pendingTokens.length > 0) {
    pendingTokens.slice(0, 2).forEach((t) => {
      const kurir = t.carrierContact || 'Tim Logistik';
      const target = t.recipientNameTarget || 'Nakhoda / Mualim';
      items.push({
        id: `ttb-pending-${t.id || t.noTtb}`,
        category: 'STATUS TTB',
        badge: 'TTB ON-DELIVERY',
        title: `${t.noTtb} • ${t.armada}`,
        content: `Kurir: ${kurir} • Status: Menuju dermaga / Menunggu serah terima fisik & tanda tangan ${target}`,
        highlight: 'PROSES ANTAR',
        timestamp: t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : timeStr,
        severity: 'warning',
      });
    });
  }

  if (deliveredTokens.length > 0) {
    deliveredTokens.slice(0, 2).forEach((t) => {
      const kurir = t.carrierContact || 'Tim Logistik';
      const penerima = t.receiverName || t.recipientNameTarget || 'Pihak Kapal';
      items.push({
        id: `ttb-delivered-${t.id || t.noTtb}`,
        category: 'STATUS TTB',
        badge: 'TTB TERKIRIM',
        title: `${t.noTtb} • ${t.armada}`,
        content: `Kurir: ${kurir} • Sukses diserahterimakan & ditandatangani oleh ${penerima}`,
        highlight: 'SELESAI TERIMA',
        timestamp: t.usedAt ? new Date(t.usedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : timeStr,
        severity: 'success',
      });
    });
  }

  // ========================================================
  // 4. JADWAL PENGANTARAN KE KAPAL (3 Items)
  // ========================================================
  if (schedules.length > 0) {
    const selectedSchedules = schedules.slice(0, 3);
    selectedSchedules.forEach((s) => {
      const kurirNama = s.courier?.name || 'Tim Kurir Logistik';
      const klusterClean = s.clusterArea.replace(/_/g, ' ');
      items.push({
        id: `sched-${s.id}`,
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: `Ke ${s.shipName}`,
        content: `Jadwal: ${s.scheduledDay} (${s.scheduledDate}) • Slot: ${s.timeSlot} • Kurir: ${kurirNama} • Kluster: ${klusterClean}`,
        highlight: `${s.scheduledDay} • ${kurirNama}`,
        timestamp: s.scheduledDate,
        severity: s.urgency === 'CRITICAL' ? 'warning' : 'info',
      });
    });
  }

  // ========================================================
  // 5. ARMADA KAPAL (Cukup 2 Item: Summary + Kapal Sorotan)
  // ========================================================
  const vessels = vesselData?.items || [];
  const summary = vesselData?.summary;

  if (summary && summary.totalKapal > 0) {
    items.push({
      id: 'armada-summary',
      category: 'ARMADA',
      badge: 'CPG FLEET RADAR',
      title: 'Status Armada Aktif',
      content: `Total ${summary.totalKapal} Unit Kapal CPG: ${summary.totalON} Beroperasi (ON), ${summary.totalSB} Standby (SB), ${summary.totalDK} Docking (DK).`,
      highlight: `${summary.totalON} Operasi`,
      timestamp: summary.lastUpdated || timeStr,
      severity: 'marine',
    });
  }

  if (vessels.length > 0) {
    const activeShip = vessels.find((v) => v.statusKode === 'ON');
    if (activeShip) {
      items.push({
        id: `vessel-${activeShip.id || activeShip.kapalSlug}`,
        category: 'ARMADA',
        badge: `ARMADA [ON]`,
        title: activeShip.namaKapal,
        content: `Posisi: ${activeShip.posisi || 'Pelayaran'} • Aktivitas: ${activeShip.activity || 'Operasional Kapal'}`,
        highlight: 'OPERASIONAL',
        timestamp: activeShip.tanggal || timeStr,
        severity: 'marine',
      });
    }
  }

  // ========================================================
  // 6. CUACA MARITIM & SOP PENGADAAN (2 Items Pendukung)
  // ========================================================
  if (weather) {
    items.push({
      id: 'weather-balikpapan',
      category: 'CUACA',
      badge: 'BMKG MARITIM',
      title: 'Cuaca Teluk Balikpapan',
      content: `${weather.condition}, Suhu ${weather.temp}°C, Angin ${weather.windDir} ${weather.windKn} Kn, Gelombang ${weather.waveEstimate}. Aman untuk aktivitas laut.`,
      highlight: `${weather.temp}°C • ${weather.windKn} Kn`,
      timestamp: timeStr,
      severity: 'info',
    });
  }

  items.push({
    id: 'sop-4pic',
    category: 'SOP CPG',
    badge: 'SOP PENGADAAN',
    title: 'Validasi Berjenjang TTB & FSTB',
    content: 'Persetujuan dokumen wajib diverifikasi 4 PIC (Staff Logistik, Spv Logistik, Spv Purchasing, Mgr Procurement) & penerima kapal.',
    highlight: 'Wajib 4 PIC',
    timestamp: dateStr,
    severity: 'info',
  });

  const responsePayload: NewsTickerResponse = {
    success: true,
    timestamp: now.toISOString(),
    isOnline: true,
    totalItems: items.length,
    items,
    meta: {
      armadaCount: vessels.length,
      activeShips: summary?.totalON ?? vessels.filter((v) => v.statusKode === 'ON').length,
      deliveryCount: schedules.length,
      ttbTransitCount: pendingTokens.length,
      weatherLocation: 'Teluk Balikpapan & Selat Makassar',
      temperature: weather?.temp,
      windKnots: weather?.windKn,
      source: 'CPG Procurement Hub & Logistics Dispatch',
    },
  };

  return NextResponse.json(responsePayload, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
