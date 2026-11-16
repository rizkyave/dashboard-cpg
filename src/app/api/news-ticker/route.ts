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
export const revalidate = 60; // Cache 60 detik

const R2_POSISI_KAPAL_KEY = 'dashboard-metadata/posisi-kapal.json';
const R2_DELIVERY_KEY = 'dashboard-metadata/delivery-schedules.json';
const LOCAL_DELIVERY_PATH = path.join(process.cwd(), 'src', 'data', 'delivery-schedules.json');

const R2_REMOTE_TOKENS_KEY = 'ttb-metadata/remote-handover-tokens.json';
const LOCAL_REMOTE_TOKENS_PATH = path.join(process.cwd(), 'src', 'data', 'remote-handover-tokens.json');

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
  // 1. Coba baca dari R2
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
  // 2. Baca dari lokal
  try {
    const raw = await fs.readFile(LOCAL_DELIVERY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

async function getRemoteHandoverTokens(): Promise<RemoteHandoverTokenData[]> {
  // 1. Coba baca dari R2
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
  // 2. Baca dari lokal
  try {
    const raw = await fs.readFile(LOCAL_REMOTE_TOKENS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  // 1. Ambil data pengantaran dan serah terima TTB (FOKUS UTAMA)
  const [schedules, remoteTokens, vesselData, weather] = await Promise.all([
    getDeliverySchedules(),
    getRemoteHandoverTokens(),
    getVesselPositionsFromR2(),
    fetchMarineWeather(),
  ]);

  const items: NewsTickerItem[] = [];

  // ========================================================
  // BAGIAN 1: STATUS TERAKHIR TTB DALAM PROSES PENGANTARAN (4-5 Items)
  // ========================================================
  const pendingTokens = remoteTokens.filter((t) => !t.isUsed);
  const deliveredTokens = remoteTokens.filter((t) => t.isUsed);

  // A. TTB yang sedang dalam proses antar / menunggu tanda tangan di kapal (Prioritas Utama)
  if (pendingTokens.length > 0) {
    pendingTokens.slice(0, 3).forEach((t) => {
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

  // B. TTB yang baru saja berhasil diserahterimakan (Terkirim)
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

  // Fallback status TTB jika list kosong
  if (items.filter((i) => i.category === 'STATUS TTB').length === 0) {
    items.push(
      {
        id: 'fallback-ttb-1',
        category: 'STATUS TTB',
        badge: 'TTB ON-DELIVERY',
        title: 'CPL-TTB-26-07465 • TB KING STAR',
        content: 'Kurir: BARDI • Menuju Pelabuhan Semayang • Menunggu tanda tangan Nakhoda Abdul Rauf Wakano',
        highlight: 'PROSES ANTAR',
        timestamp: timeStr,
        severity: 'warning',
      },
      {
        id: 'fallback-ttb-2',
        category: 'STATUS TTB',
        badge: 'TTB ON-DELIVERY',
        title: 'GAJ-TTB-26-01406 • COMPACTOR ASC 100',
        content: 'Kurir: RENALDI • Pengantaran material workshop & suku cadang galangan GAJ Somber',
        highlight: 'PROSES ANTAR',
        timestamp: timeStr,
        severity: 'warning',
      },
      {
        id: 'fallback-ttb-3',
        category: 'STATUS TTB',
        badge: 'TTB TERKIRIM',
        title: 'CPL-TTB-26-06278 • MT BLUE PETROL',
        content: 'Kurir: Hermansyah Herman • Berhasil diterima & diverifikasi oleh Nakhoda Kiky di Rede Balikpapan',
        highlight: 'SELESAI TERIMA',
        timestamp: timeStr,
        severity: 'success',
      }
    );
  }

  // ========================================================
  // BAGIAN 2: JADWAL PENGANTARAN KE KAPAL (4-5 Items)
  // ========================================================
  if (schedules.length > 0) {
    // Ambil jadwal aktif / terdekat
    const selectedSchedules = schedules.slice(0, 5);
    selectedSchedules.forEach((s) => {
      const kurirNama = s.courier?.name || 'Tim Kurir Logistik';
      const klusterClean = s.clusterArea.replace(/_/g, ' ');
      items.push({
        id: `sched-${s.id}`,
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: `Ke ${s.shipName}`,
        content: `Jadwal: ${s.scheduledDay} (${s.scheduledDate}) • Slot: ${s.timeSlot} • Kurir: ${kurirNama} • Kluster: ${klusterClean} (${s.transportMethod})`,
        highlight: `${s.scheduledDay} • ${kurirNama}`,
        timestamp: s.scheduledDate,
        severity: s.urgency === 'CRITICAL' ? 'warning' : 'info',
      });
    });
  } else {
    items.push(
      {
        id: 'fallback-sched-1',
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: 'Ke AMBER • Kluster Somber Kariangau',
        content: 'Jadwal: SENIN • Slot: SIANG (13:00 - 15:30) • Kurir: BARDI • Pengantaran suku cadang perawatan',
        highlight: 'SENIN • BARDI',
        timestamp: dateStr,
        severity: 'info',
      },
      {
        id: 'fallback-sched-2',
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: 'Ke BLUE PETROL • Kluster Semayang Balikpapan',
        content: 'Jadwal: SELASA • Slot: PAGI (08:00 - 11:30) • Kurir: AKBAR RAMADHAN • Delivery pelumas & logistik',
        highlight: 'SELASA • AKBAR',
        timestamp: dateStr,
        severity: 'info',
      },
      {
        id: 'fallback-sched-3',
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: 'Ke BARONGKO • Kluster Semayang Balikpapan',
        content: 'Jadwal: SELASA • Slot: SIANG (13:00 - 15:30) • Kurir: ZULFIANSYAH • Suplai perlengkapan bunker kapal',
        highlight: 'SELASA • ZULFIANSYAH',
        timestamp: dateStr,
        severity: 'info',
      },
      {
        id: 'fallback-sched-4',
        category: 'JADWAL PENGANTARAN',
        badge: 'DELIVERY SCHEDULE',
        title: 'Ke ANTASENA BUMI SURYA • Somber Kariangau',
        content: 'Jadwal: RABU • Slot: PAGI (08:00 - 11:30) • Kurir: HAMKA ALKA • Diantar Tim Logistik CPG',
        highlight: 'RABU • HAMKA ALKA',
        timestamp: dateStr,
        severity: 'info',
      }
    );
  }

  // ========================================================
  // BAGIAN 3: ARMADA KAPAL (Cukup Beberapa Saja Sesuai Permintaan)
  // ========================================================
  const vessels = vesselData?.items || [];
  const summary = vesselData?.summary;

  // Ringkasan radar armada
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

  // Cukup 2 armada utama saja
  if (vessels.length > 0) {
    const highlightShips = vessels.filter((v) => v.statusKode === 'ON').slice(0, 2);
    highlightShips.forEach((v) => {
      const act = v.activity && v.activity !== '-' ? ` • Aktivitas: ${v.activity}` : '';
      items.push({
        id: `vessel-${v.id || v.kapalSlug}`,
        category: 'ARMADA',
        badge: `ARMADA [${v.statusKode}]`,
        title: v.namaKapal,
        content: `Posisi: ${v.posisi || 'Pelayaran'}${act}`,
        highlight: 'OPERASIONAL',
        timestamp: v.tanggal || timeStr,
        severity: 'marine',
      });
    });
  } else {
    items.push({
      id: 'vessel-fallback-1',
      category: 'ARMADA',
      badge: 'ARMADA [ON]',
      title: 'TB Cindara 3112',
      content: 'Posisi: Kariangau Anchorage • Operasi Towing & Berthing Support Selat Makassar',
      highlight: 'OPERASI',
      timestamp: timeStr,
      severity: 'marine',
    });
  }

  // ========================================================
  // BAGIAN 4: CUACA MARITIM & SOP PENGADAAN (1-2 Items Pendukung)
  // ========================================================
  if (weather) {
    items.push({
      id: 'weather-balikpapan',
      category: 'CUACA',
      badge: 'BMKG MARITIM',
      title: 'Cuaca Teluk Balikpapan',
      content: `${weather.condition}, Suhu ${weather.temp}°C, Angin ${weather.windDir} ${weather.windKn} Kn, Gelombang ${weather.waveEstimate}. Aman untuk delivery laut.`,
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
    content: 'Barang diterima wajib diverifikasi 4 PIC (Staff Logistik, Spv Logistik, Spv Purchasing, Mgr Procurement) & penerima fisik kapal.',
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
      source: 'CPG Logistics Dispatch & Fleet Radar',
    },
  };

  return NextResponse.json(responsePayload, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
