'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type WatermarkPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right'
  | 'bottom-center';

export type WatermarkFontSize = 'small' | 'medium' | 'large';

export interface WatermarkSettings {
  showDateTime: boolean;
  showUserName: boolean;
  showDocNumber: boolean;
  showGpsCoords: boolean;
  showCityName: boolean;
  showLogo: boolean;
  position: WatermarkPosition;
  fontSize: WatermarkFontSize;
  customLabel: string;
  bgOpacity: number; // 0–100
}

export interface GeoResult {
  cityName: string;
  fullAddress: string;
}

export interface GeoInfo {
  latitude: number;
  longitude: number;
  cityName: string;
  fullAddress?: string;
  error?: string;
}

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  filename: string;
  takenAt: Date;
}

const DEFAULT_SETTINGS: WatermarkSettings = {
  showDateTime: true,
  showUserName: true,
  showDocNumber: true,
  showGpsCoords: true,
  showCityName: true,
  showLogo: true,
  position: 'bottom-left',
  fontSize: 'medium',
  customLabel: '',
  bgOpacity: 45,
};

const STORAGE_KEY = 'cpg_camera_watermark_settings';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadSettings(): WatermarkSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: WatermarkSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export function formatDateTimeID(date: Date): string {
  const day = DAYS_ID[date.getDay()];
  const d = date.getDate().toString().padStart(2, '0');
  const m = MONTHS_ID[date.getMonth()];
  const y = date.getFullYear();
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${day}, ${d} ${m} ${y}  ${hh}:${mm}:${ss}`;
}

async function reverseGeocode(lat: number, lon: number): Promise<GeoResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`,
      { headers: { 'User-Agent': 'CPG-Dashboard/1.0' } }
    );
    if (!res.ok) return { cityName: '', fullAddress: '' };
    const data = await res.json();
    const addr = data.address || {};

    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      addr.state ||
      '';

    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts.push(`No. ${addr.house_number}`);
    if (addr.residential && addr.residential !== addr.road) parts.push(addr.residential);
    if (addr.suburb && !parts.includes(addr.suburb)) parts.push(addr.suburb);
    if (addr.village && !parts.includes(addr.village)) parts.push(addr.village);
    if (addr.city_district && !parts.includes(addr.city_district)) parts.push(addr.city_district);
    if (addr.city && !parts.includes(addr.city)) parts.push(addr.city);
    if (addr.state && !parts.includes(addr.state)) parts.push(addr.state);
    if (addr.postcode) parts.push(addr.postcode);
    if (addr.country) parts.push(addr.country);

    const full = parts.length >= 2 ? parts.join(', ') : (data.display_name || city);

    return {
      cityName: city,
      fullAddress: full,
    };
  } catch {
    return { cityName: '', fullAddress: '' };
  }

}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export interface UseCameraWatermarkOptions {
  userName: string;
  userJabatan: string;
  docNumber?: string;
  docType?: string;
}

export interface UseCameraWatermarkReturn {
  // refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;

  // camera
  isCameraReady: boolean;
  cameraError: string | null;
  facingMode: 'environment' | 'user';
  toggleFacingMode: () => void;
  startCamera: () => Promise<void>;
  stopCamera: () => void;

  // time
  currentTime: Date;

  // geo
  geoInfo: GeoInfo | null;
  isLoadingGeo: boolean;
  requestGeo: () => void;

  // settings
  settings: WatermarkSettings;
  updateSettings: (patch: Partial<WatermarkSettings>) => void;
  saveSettingsToStorage: () => void;

  // capture
  capturePhoto: () => CapturedPhoto | null;
  capturedPhotos: CapturedPhoto[];
  removePhoto: (id: string) => void;
  clearPhotos: () => void;
}

export function useCameraWatermark(
  opts: UseCameraWatermarkOptions
): UseCameraWatermarkReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);

  const [settings, setSettings] = useState<WatermarkSettings>(loadSettings);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  // Preload logo resmi CPG 3D untuk watermark kamera TimeMark
  const officialLogoRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '/images/logo/cpg_logo_official.png';
      img.onload = () => {
        officialLogoRef.current = img;
      };
    }
  }, []);

  // ── Real-time clock ──────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Geolocation ──────────────────────────────
  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoInfo({ latitude: 0, longitude: 0, cityName: '', error: 'GPS tidak didukung' });
      return;
    }
    setIsLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geoRes = await reverseGeocode(latitude, longitude);
        setGeoInfo({ latitude, longitude, cityName: geoRes.cityName, fullAddress: geoRes.fullAddress });
        setIsLoadingGeo(false);
      },
      (err) => {
        setGeoInfo({ latitude: 0, longitude: 0, cityName: '', error: err.message });
        setIsLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // ── Camera ───────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const drawWatermark = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, now: Date, transparent: boolean) => {
      const sizeMap: Record<WatermarkFontSize, number> = {
        small: Math.max(11, Math.round(h * 0.018)),
        medium: Math.max(14, Math.round(h * 0.024)),
        large: Math.max(18, Math.round(h * 0.032)),
      };
      const fs = sizeMap[settings.fontSize];
      const lineH = fs * 1.45;
      const pad = fs * 0.85;
      const margin = fs;

      // ── 1. Watermark Vertikal Kanan Atas: "TIMEMARK Official by logistik team" ──
      ctx.save();
      const vertFs = Math.max(10, Math.round(fs * 0.72));
      ctx.font = `bold ${vertFs}px 'Inter', Arial, sans-serif`;
      const vertText = 'TIMEMARK Official by logistik team';
      const vertTextW = ctx.measureText(vertText).width;
      const vertPadX = vertFs * 0.9;
      const vertPadY = vertFs * 0.45;
      const pillW = vertTextW + vertPadX * 2;
      const pillH = vertFs + vertPadY * 2;

      // Posisi vertikal di kanan atas membentang ke bawah
      const centerX = w - margin - pillH / 2;
      const centerY = margin + pillW / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate(Math.PI / 2); // Putar 90 derajat searah jarum jam agar teks mengalir dari atas ke bawah

      // Background pill semi-transparan
      const vAlpha = transparent ? (settings.bgOpacity / 100) * 0.75 : settings.bgOpacity / 100;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.45, vAlpha * 0.85)})`;
      const pillRadius = pillH / 2;
      const rx = -pillW / 2;
      const ry = -pillH / 2;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(rx, ry, pillW, pillH, pillRadius);
      } else {
        ctx.rect(rx, ry, pillW, pillH);
      }
      ctx.fill();

      // Border halus pill
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Teks Vertikal
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vertText, 0, 0);
      ctx.restore();

      // ── 2. Watermark Kiri Bawah (Logo Resmi CPG + Informasi Detail dengan Auto Wrap) ──
      const rawLines: string[] = [];
      if (settings.showDateTime) rawLines.push(formatDateTimeID(now));

      if (settings.showUserName && (opts.userName || opts.userJabatan)) {
        const parts = [opts.userName, opts.userJabatan].filter(Boolean);
        rawLines.push(parts.join(' • '));
      }
      if (settings.showDocNumber && opts.docNumber) {
        const prefix = opts.docType ? `${opts.docType}: ` : '';
        rawLines.push(`${prefix}${opts.docNumber}`);
      }
      if (settings.showGpsCoords && geoInfo && geoInfo.latitude !== 0) {
        rawLines.push(`GPS: ${geoInfo.latitude.toFixed(5)}, ${geoInfo.longitude.toFixed(5)}`);
      }
      if (settings.showCityName && (geoInfo?.fullAddress || geoInfo?.cityName)) {
        const addrText = geoInfo.fullAddress || geoInfo.cityName;
        rawLines.push(`📍 ${addrText}`);
      }
      if (settings.customLabel) rawLines.push(settings.customLabel);

      if (rawLines.length === 0 && !settings.showLogo) return;

      ctx.save();

      // Tentukan batas lebar maksimal kotak agar TIDAK TERPOTONG di layar portrait/vertikal
      const maxBoxW = Math.max(220, Math.min(w - margin * 2, w * 0.94));
      const maxTextW = maxBoxW - pad * 2;

      // Word wrapping pintar: pecah teks yang terlalu panjang agar seluruh teks terlihat utuh
      ctx.font = `bold ${fs}px 'Inter', Arial, sans-serif`;
      const lines: string[] = [];

      for (const rawLine of rawLines) {
        if (ctx.measureText(rawLine).width <= maxTextW) {
          lines.push(rawLine);
        } else {
          // Jika ada pemisah bullet ' • ' (misal nama • jabatan • armada), pecah di bullet dulu
          if (rawLine.includes(' • ')) {
            const chunks = rawLine.split(' • ');
            let cur = '';
            for (let i = 0; i < chunks.length; i++) {
              const test = cur ? `${cur} • ${chunks[i]}` : chunks[i];
              if (ctx.measureText(test).width <= maxTextW) {
                cur = test;
              } else {
                if (cur) lines.push(cur);
                // Jika chunk itu sendiri masih melebihi maxTextW, lakukan word wrap per kata
                if (ctx.measureText(chunks[i]).width > maxTextW) {
                  const words = chunks[i].split(' ');
                  let sub = '';
                  for (const word of words) {
                    const testW = sub ? `${sub} ${word}` : word;
                    if (ctx.measureText(testW).width <= maxTextW) {
                      sub = testW;
                    } else {
                      if (sub) lines.push(sub);
                      sub = word;
                    }
                  }
                  if (sub) cur = sub;
                } else {
                  cur = chunks[i];
                }
              }
            }
            if (cur) lines.push(cur);
          } else if (rawLine.includes(', ')) {
            // Pemecahan pintar berdasarkan koma (sangat ideal untuk alamat detail panjang)
            const chunks = rawLine.split(', ');
            let cur = '';
            for (let i = 0; i < chunks.length; i++) {
              const test = cur ? `${cur}, ${chunks[i]}` : chunks[i];
              if (ctx.measureText(test).width <= maxTextW) {
                cur = test;
              } else {
                if (cur) lines.push(cur);
                if (ctx.measureText(chunks[i]).width > maxTextW) {
                  const words = chunks[i].split(' ');
                  let sub = '';
                  for (const word of words) {
                    const testW = sub ? `${sub} ${word}` : word;
                    if (ctx.measureText(testW).width <= maxTextW) {
                      sub = testW;
                    } else {
                      if (sub) lines.push(sub);
                      sub = word;
                    }
                  }
                  if (sub) cur = sub;
                } else {
                  cur = chunks[i];
                }
              }
            }
            if (cur) lines.push(cur);
          } else {
            // Word wrap standar berdasarkan spasi
            const words = rawLine.split(' ');
            let cur = '';
            for (const word of words) {
              const test = cur ? `${cur} ${word}` : word;
              if (ctx.measureText(test).width <= maxTextW) {
                cur = test;
              } else {
                if (cur) lines.push(cur);
                cur = word;
              }
            }
            if (cur) lines.push(cur);
          }
        }
      }

      // Hitung dimensi Logo Resmi CPG 3D
      let logoAreaH = 0;
      let logoRenderW = 0;
      let logoRenderH = 0;
      const logoImg = officialLogoRef.current;
      const isLogoLoaded = Boolean(logoImg && logoImg.complete && logoImg.naturalWidth > 0);

      if (settings.showLogo) {
        if (isLogoLoaded && logoImg) {
          logoRenderH = Math.round(fs * 2.6); // Proporsi pas, tajam & elegan
          const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
          logoRenderW = Math.round(logoRenderH * aspect);
          logoAreaH = logoRenderH + pad * 0.45;
        } else {
          // Fallback teks jika logo sedang dimuat
          const logoFontSize = fs * 1.8;
          ctx.font = `900 ${logoFontSize}px 'Inter', Arial, sans-serif`;
          logoRenderW = ctx.measureText('CPG').width;
          logoRenderH = logoFontSize;
          logoAreaH = logoFontSize + pad * 0.45;
        }
      }

      // Hitung dimensi kotak keseluruhan
      ctx.font = `bold ${fs}px 'Inter', Arial, sans-serif`;
      const calculatedMaxLineW = lines.length > 0
        ? Math.max(...lines.map((l) => ctx.measureText(l).width), logoRenderW)
        : logoRenderW;

      const separatorH = settings.showLogo && lines.length > 0 ? 1 + pad * 0.45 : 0;
      const textAreaH = lines.length * lineH;
      const boxW = Math.min(calculatedMaxLineW + pad * 2, maxBoxW);
      const boxH = logoAreaH + separatorH + textAreaH + pad * 2;

      // Hitung posisi kotak
      let boxX = margin;
      let boxY = h - boxH - margin;

      if (settings.position === 'bottom-right') {
        boxX = w - boxW - margin;
        boxY = h - boxH - margin;
      } else if (settings.position === 'top-left') {
        boxX = margin;
        boxY = margin;
      } else if (settings.position === 'top-right') {
        boxX = w - boxW - margin;
        boxY = margin;
      } else if (settings.position === 'bottom-center') {
        boxX = (w - boxW) / 2;
        boxY = h - boxH - margin;
      }

      // Pastikan boxX dan boxY selalu aman di dalam frame canvas (tidak pernah terpotong)
      boxX = Math.max(margin, Math.min(boxX, w - boxW - margin));
      boxY = Math.max(margin, Math.min(boxY, h - boxH - margin));

      // Latar belakang kotak rounded
      const alpha = transparent ? (settings.bgOpacity / 100) * 0.75 : settings.bgOpacity / 100;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      const radius = fs * 0.6;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(boxX, boxY, boxW, boxH, radius);
      } else {
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxW - radius, boxY);
        ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
        ctx.lineTo(boxX + boxW, boxY + boxH - radius);
        ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
        ctx.lineTo(boxX + radius, boxY + boxH);
        ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      }
      ctx.closePath();
      ctx.fill();

      // Border halus kotak
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      let cursorY = boxY + pad;

      // Render Logo Resmi CPG 3D
      if (settings.showLogo) {
        if (isLogoLoaded && logoImg) {
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;
          ctx.drawImage(logoImg, boxX + pad, cursorY, logoRenderW, logoRenderH);
          cursorY += logoAreaH;
        } else {
          const logoFontSize = fs * 1.8;
          ctx.font = `900 ${logoFontSize}px 'Inter', Arial, sans-serif`;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = '#F59E0B'; // amber-500
          ctx.fillText('CPG', boxX + pad, cursorY + logoFontSize * 0.85);
          cursorY += logoAreaH;
        }

        // Garis pemisah
        if (lines.length > 0) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(boxX + pad, cursorY);
          ctx.lineTo(boxX + boxW - pad, cursorY);
          ctx.stroke();
          cursorY += 1 + pad * 0.45;
        }
      }

      // Render Teks Baris Demi Baris
      ctx.font = `bold ${fs}px 'Inter', Arial, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#FFFFFF';

      for (const line of lines) {
        ctx.fillText(line, boxX + pad, cursorY + fs * 0.85);
        cursorY += lineH;
      }

      ctx.restore();
    },
    [settings, geoInfo, opts.userName, opts.userJabatan, opts.docNumber, opts.docType]
  );

  // ── RAF loop – draw watermark overlay on live preview ──
  const startRaf = useCallback(() => {
    const tick = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !overlay || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const w = video.videoWidth || overlay.width;
      const h = video.videoHeight || overlay.height;
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w;
        overlay.height = h;
      }
      const ctx = overlay.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      drawWatermark(ctx, w, h, new Date(), true);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawWatermark]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraReady(true);
        startRaf();
      }
    } catch (err) {
      const e = err as Error;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraError('Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setCameraError('Tidak ada kamera yang ditemukan di perangkat ini.');
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.');
      } else {
        setCameraError(`Gagal membuka kamera: ${e.message}`);
      }
      setIsCameraReady(false);
    }
  }, [facingMode, stopCamera, startRaf]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // Restart camera when facingMode changes (only if stream is active)
  useEffect(() => {
    if (streamRef.current) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Re-kick RAF when settings/geo change
  useEffect(() => {
    if (!isCameraReady) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRaf();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isCameraReady, startRaf]);

  // ── Settings ─────────────────────────────────
  const updateSettings = useCallback((patch: Partial<WatermarkSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveSettingsToStorage = useCallback(() => {
    setSettings((prev) => {
      saveSettings(prev);
      return prev;
    });
  }, []);

  // ── Capture ──────────────────────────────────
  const capturePhoto = useCallback((): CapturedPhoto | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw video frame
    ctx.drawImage(video, 0, 0, w, h);

    // Bake watermark into photo
    const now = new Date();
    drawWatermark(ctx, w, h, now, false);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const docPart = opts.docNumber ? `_${opts.docNumber.replace(/[^a-zA-Z0-9-]/g, '_')}` : '';
    const filename = `CPG-FOTO${docPart}_${ts}.jpg`;

    const photo: CapturedPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      filename,
      takenAt: now,
    };

    setCapturedPhotos((prev) => [photo, ...prev].slice(0, 10));
    return photo;
  }, [drawWatermark, opts.docNumber]);

  const removePhoto = useCallback((id: string) => {
    setCapturedPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPhotos = useCallback(() => {
    setCapturedPhotos([]);
  }, []);

  return {
    videoRef,
    canvasRef,
    overlayCanvasRef,
    isCameraReady,
    cameraError,
    facingMode,
    toggleFacingMode,
    startCamera,
    stopCamera,
    currentTime,
    geoInfo,
    isLoadingGeo,
    requestGeo,
    settings,
    updateSettings,
    saveSettingsToStorage,
    capturePhoto,
    capturedPhotos,
    removePhoto,
    clearPhotos,
  };
}
