import { NextResponse } from 'next/server';
import { isR2Configured, getObjectFromR2 } from '@/utils/r2Client';
import { KapalPosisiItem, KapalPosisiSummary } from '@/types/procurement';
import { NewsTickerItem, NewsTickerResponse } from '@/types/newsTicker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache 60 detik

const R2_POSISI_KAPAL_KEY = 'dashboard-metadata/posisi-kapal.json';

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

export async function GET() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  // 1. Dapatkan Posisi Kapal Real-Time
  const vesselData = await getVesselPositionsFromR2();
  const vessels = vesselData?.items || [];
  const summary = vesselData?.summary;

  // 2. Dapatkan Cuaca Maritim Terkini
  const weather = await fetchMarineWeather();

  const items: NewsTickerItem[] = [];

  // Item A: Ringkasan Status Armada Global CPG
  if (summary && summary.totalKapal > 0) {
    items.push({
      id: 'armada-summary',
      category: 'ARMADA',
      badge: 'CPG FLEET RADAR',
      title: 'Status Armada Aktif',
      content: `Total ${summary.totalKapal} Unit Kapal CPG: ${summary.totalON} Operasi (ON), ${summary.totalSB} Standby (SB), ${summary.totalDK} Docking (DK).`,
      highlight: `${summary.totalON} Beroperasi`,
      timestamp: summary.lastUpdated || timeStr,
      severity: 'marine',
    });
  }

  // Item B: Data Kapal Real-Time Pilihan (Prioritas yang sedang beroperasi & rute strategis)
  if (vessels.length > 0) {
    // Ambil kapal-kapal dengan aktivitas dinamis
    const selectedShips = vessels
      .filter((v) => v.statusKode === 'ON' || v.statusKode === 'DK' || v.posisi.length > 0)
      .slice(0, 8);

    selectedShips.forEach((v) => {
      let sev: NewsTickerItem['severity'] = 'marine';
      if (v.statusKode === 'ON') sev = 'success';
      if (v.statusKode === 'DK') sev = 'warning';
      if (v.statusKode === 'SB') sev = 'info';

      const actText = v.activity && v.activity !== '-' ? ` • Aktivitas: ${v.activity}` : '';
      items.push({
        id: `vessel-${v.id || v.kapalSlug}`,
        category: 'ARMADA',
        badge: `ARMADA [${v.statusKode}]`,
        title: v.namaKapal,
        content: `Posisi: ${v.posisi || 'Dalam Pelayaran'}${actText}`,
        highlight: v.statusKode === 'ON' ? 'OPERASI' : v.statusKode === 'DK' ? 'DOCKING' : 'STANDBY',
        timestamp: v.tanggal || timeStr,
        severity: sev,
      });
    });
  } else {
    // Fallback armada kapal default
    items.push(
      {
        id: 'vessel-fallback-1',
        category: 'ARMADA',
        badge: 'ARMADA [ON]',
        title: 'TB Cindara 3112',
        content: 'Posisi: Kariangau Anchorage • Operasi Towing & Berthing Support Selat Makassar',
        highlight: 'ON - OPERASIONAL',
        timestamp: timeStr,
        severity: 'success',
      },
      {
        id: 'vessel-fallback-2',
        category: 'ARMADA',
        badge: 'ARMADA [ON]',
        title: 'SPOB Cintiana Pratama',
        content: 'Posisi: STS Balikpapan Offshore • Bunkering Marine Fuel MGO Pertamina',
        highlight: 'ON - BUNKERING',
        timestamp: timeStr,
        severity: 'success',
      },
      {
        id: 'vessel-fallback-3',
        category: 'ARMADA',
        badge: 'ARMADA [ON]',
        title: 'SV Twin Sister 307',
        content: 'Posisi: Selat Makassar / West Seno • Supply Vessel Support Operasi Lepas Pantai',
        highlight: 'ON - OFFSHORE',
        timestamp: timeStr,
        severity: 'marine',
      }
    );
  }

  // Item C: Cuaca Maritim Balikpapan & Selat Makassar
  if (weather) {
    items.push({
      id: 'weather-balikpapan',
      category: 'CUACA',
      badge: 'BMKG MARITIM',
      title: 'Cuaca Teluk Balikpapan',
      content: `Kondisi ${weather.condition}, Suhu ${weather.temp}°C, Kelembaban ${weather.humidity}%, Angin dari ${weather.windDir} ${weather.windKn} Knots. Tinggi Gelombang: ${weather.waveEstimate}.`,
      highlight: `${weather.temp}°C • ${weather.windKn} Kn`,
      timestamp: timeStr,
      severity: weather.windKn > 15 ? 'warning' : 'info',
    });
  } else {
    items.push({
      id: 'weather-fallback',
      category: 'CUACA',
      badge: 'CUACA MARITIM',
      title: 'Prakiraan Teluk Balikpapan',
      content: 'Cerah Berawan, Suhu 28.5°C, Angin Timur Laut 6-10 kn, Tinggi Gelombang 0.4 - 0.8m (Kategori Tenang-Rendah). Aman untuk olah gerak kapal.',
      highlight: 'Kondusif',
      timestamp: timeStr,
      severity: 'info',
    });
  }

  // Item D: SOP Pengadaan CPG & Validasi Dokumen
  items.push(
    {
      id: 'sop-4pic',
      category: 'SOP CPG',
      badge: 'SOP PENGADAAN',
      title: 'Protokol Validasi TTB & FSTB',
      content: 'Persetujuan dokumen wajib melalui alur 4 PIC berjenjang (Staff Logistik, Spv Logistik, Spv Purchasing, Mgr Procurement) untuk menjamin akuntabilitas pengadaan.',
      highlight: 'SOP 4 PIC Wajib',
      timestamp: dateStr,
      severity: 'info',
    },
    {
      id: 'sop-delegasi',
      category: 'SOP CPG',
      badge: 'KEBIJAKAN PLH',
      title: 'Pendelegasian Cuti & Approval',
      content: 'Pejabat yang berhalangan atau cuti dapat mengaktifkan Pelaksana Harian (Plh) via Menu Validasi agar rantai approval barang tidak terhambat.',
      highlight: 'Delegasi Otomatis',
      timestamp: dateStr,
      severity: 'marine',
    }
  );

  // Item E: Safety First & Marine Culture
  items.push(
    {
      id: 'safety-zero-accident',
      category: 'SAFETY',
      badge: 'K3 MARITIM',
      title: 'Keselamatan Operasi Pelayaran',
      content: 'Target Zero Accident: Pastikan APD lengkap saat berada di geladak kapal, periksa tali tambat dan kelayakan navigasi sebelum berlayar.',
      highlight: 'Zero Accident',
      timestamp: timeStr,
      severity: 'success',
    },
    {
      id: 'safety-oil-spill',
      category: 'SAFETY',
      badge: 'ENVIRONMENT',
      title: 'Kebijakan Perlindungan Laut',
      content: 'Zero Oil Spill Policy: Dilarang membuang limbah bilga atau minyak ke laut. Jaga kelestarian perairan Balikpapan dan Selat Makassar.',
      highlight: 'Clean Seas',
      timestamp: timeStr,
      severity: 'success',
    }
  );

  const responsePayload: NewsTickerResponse = {
    success: true,
    timestamp: now.toISOString(),
    isOnline: true,
    totalItems: items.length,
    items,
    meta: {
      armadaCount: vessels.length,
      activeShips: summary?.totalON ?? vessels.filter((v) => v.statusKode === 'ON').length,
      weatherLocation: 'Teluk Balikpapan & Selat Makassar',
      temperature: weather?.temp,
      windKnots: weather?.windKn,
      source: 'CPG FMS Fleet Radar & Maritime Stream',
    },
  };

  return NextResponse.json(responsePayload, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
