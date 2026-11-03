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

export interface GeoInfo {
  latitude: number;
  longitude: number;
  cityName: string;
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

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`,
      { headers: { 'User-Agent': 'CPG-Dashboard/1.0' } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      addr.state ||
      ''
    );
  } catch {
    return '';
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
        const cityName = await reverseGeocode(latitude, longitude);
        setGeoInfo({ latitude, longitude, cityName });
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

      // Build lines
      const lines: string[] = [];
      if (settings.showDateTime) lines.push(formatDateTimeID(now));
      if (settings.showUserName && (opts.userName || opts.userJabatan)) {
        const parts = [opts.userName, opts.userJabatan].filter(Boolean);
        lines.push(parts.join(' • '));
      }
      if (settings.showDocNumber && opts.docNumber) {
        const prefix = opts.docType ? `${opts.docType}: ` : '';
        lines.push(`${prefix}${opts.docNumber}`);
      }
      if (settings.showGpsCoords && geoInfo && geoInfo.latitude !== 0) {
        lines.push(
          `GPS: ${geoInfo.latitude.toFixed(5)}, ${geoInfo.longitude.toFixed(5)}`
        );
      }
      if (settings.showCityName && geoInfo?.cityName) {
        lines.push(`📍 ${geoInfo.cityName}`);
      }
      if (settings.customLabel) lines.push(settings.customLabel);

      if (lines.length === 0 && !settings.showLogo) return;

      ctx.save();
      ctx.font = `bold ${fs}px 'Inter', 'Helvetica Neue', Arial, sans-serif`;

      // Measure widths
      const logoText = 'CPG';
      const logoFontSize = fs * 1.8;
      ctx.font = `900 ${logoFontSize}px 'Inter', Arial, sans-serif`;
      const logoW = settings.showLogo ? ctx.measureText(logoText).width : 0;

      ctx.font = `bold ${fs}px 'Inter', Arial, sans-serif`;
      const maxLineW = Math.max(
        ...lines.map((l) => ctx.measureText(l).width),
        logoW
      );

      const logoAreaH = settings.showLogo ? logoFontSize + pad * 0.5 : 0;
      const separatorH = settings.showLogo && lines.length > 0 ? 1 + pad * 0.5 : 0;
      const textAreaH = lines.length * lineH;
      const boxW = maxLineW + pad * 2;
      const boxH = logoAreaH + separatorH + textAreaH + pad * 2;

      // Position
      const margin = fs;
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

      // Background rect
      const alpha = transparent ? (settings.bgOpacity / 100) * 0.75 : settings.bgOpacity / 100;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      const radius = fs * 0.6;
      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.lineTo(boxX + boxW - radius, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
      ctx.lineTo(boxX + boxW, boxY + boxH - radius);
      ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
      ctx.lineTo(boxX + radius, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
      ctx.lineTo(boxX, boxY + radius);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
      ctx.closePath();
      ctx.fill();

      let cursorY = boxY + pad;

      // Logo
      if (settings.showLogo) {
        ctx.font = `900 ${logoFontSize}px 'Inter', Arial, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#F59E0B'; // amber-500
        ctx.fillText(logoText, boxX + pad, cursorY + logoFontSize * 0.85);
        cursorY += logoFontSize + pad * 0.5;

        // Separator
        if (lines.length > 0) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(boxX + pad, cursorY);
          ctx.lineTo(boxX + boxW - pad, cursorY);
          ctx.stroke();
          cursorY += 1 + pad * 0.5;
        }
      }

      // Text lines
      ctx.font = `bold ${fs}px 'Inter', Arial, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
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
