'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileStack,
  CheckCircle2,
  Clock,
  Download,
  Search,
  RefreshCw,
  FileText,
  Boxes,
  ClipboardCheck,
  Camera,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Eye,
  Loader2,
  Ship,
  Sparkles,
  X,
  MessageCircle,
  Copy,
  MapPin,
} from 'lucide-react';
import staticSchedulesData from '@/data/static-delivery-schedules.json';
import { ProcurementItem, ArmadaItem, EntityCode } from '@/types/procurement';
import { ENTITIES } from '@/data/initialData';
import {
  DossierBundleItem,
  downloadDossierPdf,
} from '@/utils/pdfBundleCompiler';

interface RingkasanBerkasTabProps {
  procurementData?: ProcurementItem[];
  armadaData?: ArmadaItem[];
  onOpenAuditModal?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function RingkasanBerkasTab({
  procurementData = [],
  armadaData = [],
  onOpenAuditModal,
  showToast,
}: RingkasanBerkasTabProps) {
  // Filter States
  const [activeFilterTab, setActiveFilterTab] = useState<'COMPLETE' | 'ALL' | 'INCOMPLETE'>('COMPLETE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');

  // Pagination States (Memastikan tab Semua Data & Belum Lengkap termuat mulus)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Loading States
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStep, setDownloadStep] = useState<string>('');

  // Storage Maps for uploaded docs & photos
  const [fstbMap, setFstbMap] = useState<Record<string, { noFstb: string; fileUrl: string; armada?: string }>>({});
  const [ttbMap, setTtbMap] = useState<Record<string, { noTtb: string; fileUrl: string; armada?: string }>>({});
  const [photoMap, setPhotoMap] = useState<Record<string, string[]>>({});
  const [efpbMap, setEfpbMap] = useState<Record<string, string>>({});
  const [fpbArmadaMap, setFpbArmadaMap] = useState<Record<string, string>>({});

  // Document & Photo Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    type: 'FPB' | 'FSTB' | 'TTB' | 'FOTO';
    title: string;
    docNo?: string;
    url?: string;
    photoUrls?: string[];
    isAvailable: boolean;
    item: DossierBundleItem;
  } | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Map posisi terakhir armada kapal (Master 66 armada dari jadwal & FMS)
  const vesselPositionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of staticSchedulesData as any[]) {
      if (!item.shipName || !item.defaultPosition) continue;
      const raw = String(item.shipName).trim().toLowerCase();
      const clean = raw
        .replace(/^(spob|tb|tk|ob|mt|sv|lct|ub|sp|crane barge|crew boat)\s+/i, '')
        .trim();
      const pos = String(item.defaultPosition).trim();
      map.set(raw, pos);
      map.set(clean, pos);
    }
    return map;
  }, []);

  const getVesselPosition = (name: string) => {
    if (!name || /office\s*gaj/i.test(name)) return null;
    const raw = name.trim().toLowerCase();
    const clean = raw
      .replace(/^(spob|tb|tk|ob|mt|sv|lct|ub|sp|crane barge|crew boat)\s+/i, '')
      .trim();

    if (vesselPositionMap.has(raw)) return vesselPositionMap.get(raw);
    if (vesselPositionMap.has(clean)) return vesselPositionMap.get(clean);

    for (const [key, val] of Array.from(vesselPositionMap.entries())) {
      if (key.length >= 4 && (clean.includes(key) || key.includes(clean))) {
        return val;
      }
    }
    return null;
  };

  // Fetch softcopy manifests from APIs
  const fetchManifests = async () => {
    setIsLoadingApi(true);
    try {
      const [fstbRes, ttbRes, photosRes, efpbRes, reviewFpbRes] = await Promise.allSettled([
        fetch(`/api/upload-fstb?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/upload-ttb?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/ttb-photos?all=true&limit=2000&_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/sync-efpb-files?_t=${Date.now()}`).then((r) => r.json()),
        fetch(`/api/review-fpb?_t=${Date.now()}`).then((r) => r.json()),
      ]);

      // 1. Process FSTB docs
      if (fstbRes.status === 'fulfilled' && Array.isArray(fstbRes.value?.items)) {
        const map: Record<string, { noFstb: string; fileUrl: string; armada?: string }> = {};
        for (const item of fstbRes.value.items) {
          const no = (item.noFstb || item.originalFileName || '').trim().toLowerCase();
          const fpb = (item.noFpb || '').trim().toLowerCase();
          const po = (item.noPo || '').trim().toLowerCase();
          const armada = (item.armada || item.dept || item.namaKapal || '').trim();
          const url = item.fileUrl || `/api/upload-fstb/file?name=${encodeURIComponent(item.renamedFileName)}`;
          const entry = { noFstb: item.noFstb || item.originalFileName, fileUrl: url, armada };
          if (no) map[no] = entry;
          if (fpb) map[fpb] = entry;
          if (po) map[po] = entry;
        }
        setFstbMap(map);
      }

      // 2. Process TTB docs
      if (ttbRes.status === 'fulfilled' && Array.isArray(ttbRes.value?.items)) {
        const map: Record<string, { noTtb: string; fileUrl: string; armada?: string }> = {};
        for (const item of ttbRes.value.items) {
          const no = (item.noTtb || item.originalFileName || '').trim().toLowerCase();
          const fpb = (item.noFpb || '').trim().toLowerCase();
          const po = (item.noPo || '').trim().toLowerCase();
          const armada = (item.armada || item.dept || item.namaKapal || '').trim();
          const url = item.fileUrl || `/api/upload-ttb/file?name=${encodeURIComponent(item.renamedFileName)}`;
          const entry = { noTtb: item.noTtb || item.originalFileName, fileUrl: url, armada };
          if (no) map[no] = entry;
          if (fpb) map[fpb] = entry;
          if (po) map[po] = entry;
        }
        setTtbMap(map);
      }

      // 3. Process TTB Photos (Mendukung Multi-Key: nomor TTB lengkap, nomor urut digit, armada, dll.)
      if (photosRes.status === 'fulfilled' && Array.isArray(photosRes.value?.photos)) {
        const map: Record<string, string[]> = {};

        const addKey = (k?: string | null, url?: string) => {
          if (!k || !url) return;
          const clean = k.trim().toLowerCase();
          if (!clean) return;
          if (!map[clean]) map[clean] = [];
          if (!map[clean].includes(url)) map[clean].push(url);
        };

        for (const photo of photosRes.value.photos) {
          const url = photo.url || `/api/ttb-photos/file?name=${encodeURIComponent(photo.name)}`;
          const photoName = String(photo.name || '').trim();

          // 1. Dari property noTtb
          if (photo.noTtb) {
            addKey(photo.noTtb, url);
            addKey(photo.noTtb.replace(/[^a-zA-Z0-9]/g, ''), url);
          }

          // 2. Dari armada
          if (photo.armada) {
            addKey(photo.armada, url);
          }

          // 3. Dari ttbInfo (prefix + numbers)
          if (photo.ttbInfo) {
            const pfx = (photo.ttbInfo.prefix || '').toLowerCase();
            for (const num of photo.ttbInfo.numbers || []) {
              addKey(num, url);
              addKey(String(parseInt(num, 10)), url);
              if (pfx) {
                addKey(`${pfx}-ttb-${num}`, url);
                addKey(`${pfx}-ttb-26-${num}`, url);
                addKey(`${pfx}-${num}`, url);
                addKey(`${pfx}ttb${num}`, url);
                addKey(`${pfx}${num}`, url);
              }
            }
          }

          // 4. Ekstraksi langsung dari nama file (pola standar TimeMark / WhatsApp / R2)
          // Contoh: "OFFICE GAJ GAJ-TTB-26-01274 2026-10-25 at 01.46.11.jpg"
          const ttbRegex = /([a-zA-Z]{2,4})[-_\s]*(?:TTB)?[-_\s]*(\d{2})?[-_\s]*(\d{4,6})/gi;
          for (const m of Array.from(photoName.matchAll(ttbRegex))) {
            const pfx = m[1].toLowerCase();
            const yr = m[2];
            const num = m[3];
            addKey(m[0].replace(/\s+/g, '-'), url);
            addKey(num, url);
            addKey(`${pfx}-${num}`, url);
            addKey(`${pfx}-ttb-${num}`, url);
            if (yr) addKey(`${pfx}-ttb-${yr}-${num}`, url);
            addKey(`${pfx}ttb${num}`, url);
            addKey(`${pfx}${num}`, url);
          }

          // Ekstraksi nomor 4-6 digit mandiri dari nama berkas
          const digitMatches = photoName.match(/\b\d{4,6}\b/g) || [];
          for (const d of digitMatches) {
            if (/^202[4-9]$/.test(d)) continue; // Abaikan tahun
            addKey(d, url);
            addKey(d.padStart(5, '0'), url);
          }

          // Ekstraksi nama armada dari awalan nama berkas (jika ada)
          const armadaPrefixMatch = photoName.match(/^(?:TB|MT|SPOB|TK|BG|OB|KM|SV|OFFICE)\s+[^_.\-]+/i);
          if (armadaPrefixMatch) {
            addKey(armadaPrefixMatch[0].trim(), url);
          }
        }
        setPhotoMap(map);
      }

      // 4. Process e-FPB files
      if (efpbRes.status === 'fulfilled' && Array.isArray(efpbRes.value?.files)) {
        const map: Record<string, string> = {};
        for (const f of efpbRes.value.files) {
          const key = (f.fpbNumber || f.filename || '').trim().toLowerCase();
          if (key) map[key] = f.url || '';
        }
        setEfpbMap(map);
      }

      // 5. Process Review FPB for detailed armada mapping & pdfUrl
      if (reviewFpbRes.status === 'fulfilled' && Array.isArray(reviewFpbRes.value?.data)) {
        const armadaMap: Record<string, string> = {};
        const pdfMap: Record<string, string> = {};
        for (const item of reviewFpbRes.value.data) {
          const fpb = (item.fpbNo || '').trim().toLowerCase();
          const armada = (item.armada || '').trim();
          if (fpb && armada) {
            armadaMap[fpb] = armada;
          }
          if (fpb && item.pdfUrl) {
            pdfMap[fpb] = item.pdfUrl;
          }
        }
        setFpbArmadaMap(armadaMap);
        if (Object.keys(pdfMap).length > 0) {
          setEfpbMap((prev) => ({ ...pdfMap, ...prev }));
        }
      }
    } catch (err) {
      console.error('Error fetching manifests in RingkasanBerkasTab:', err);
    } finally {
      setIsLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchManifests();
  }, []);

  // Consolidate Items from Procurement & Armada lists
  const dossierItems = useMemo<DossierBundleItem[]>(() => {
    const rawList: (ProcurementItem | ArmadaItem)[] = [
      ...procurementData,
      ...armadaData,
    ];

    const dedupeMap = new Map<string, DossierBundleItem>();

    for (const row of rawList) {
      const rowAny = row as any;
      const fpb = String(rowAny.fpb || '').trim();
      const po = String(rowAny.po || rowAny.noPo || '').trim();
      const armada = String(rowAny.dept || rowAny.namaKapal || 'Armada CPG').trim();
      const itemDesc = String(rowAny.item || rowAny.namaBarang || 'Material Pengadaan').trim();

      // Skip invalid rows without FPB or PO
      if (!fpb && !po) continue;

      const normFpb = fpb.toLowerCase();
      const normPo = po.toLowerCase();
      const normArmada = armada.toLowerCase();

      const key = `${normFpb}_${normPo}_${normArmada}_${itemDesc.slice(0, 20).toLowerCase()}`;
      if (dedupeMap.has(key)) continue;

      // Check softcopy FSTB
      const explicitFstb = String(rowAny.noFstb || rowAny.fstb || '').trim();
      const fstbLookup = fstbMap[normFpb] || (normPo ? fstbMap[normPo] : undefined) || (explicitFstb ? fstbMap[explicitFstb.toLowerCase()] : undefined);
      const hasFstbDoc = Boolean(fstbLookup?.fileUrl || explicitFstb);
      const hasFstbPdf = Boolean(fstbLookup?.fileUrl);
      const noFstb = fstbLookup?.noFstb || explicitFstb || '';
      const fstbPdfUrl = fstbLookup?.fileUrl || (noFstb ? `/api/upload-fstb/file?name=${encodeURIComponent(noFstb)}.pdf` : undefined);

      // Check softcopy TTB
      const explicitTtb = String(rowAny.noTtb || rowAny.ttb || '').trim();
      const ttbLookup = ttbMap[normFpb] || (normPo ? ttbMap[normPo] : undefined) || (explicitTtb ? ttbMap[explicitTtb.toLowerCase()] : undefined);
      const hasTtbDoc = Boolean(ttbLookup?.fileUrl || explicitTtb);
      const hasTtbPdf = Boolean(ttbLookup?.fileUrl);
      const noTtb = ttbLookup?.noTtb || explicitTtb || '';
      const ttbPdfUrl = ttbLookup?.fileUrl || (noTtb ? `/api/upload-ttb/file?name=${encodeURIComponent(noTtb)}.pdf` : undefined);

      // Resolusi nama armada secara detail (jika bernilai generik seperti 'Armada CPG' atau kosong)
      const rawArmada = String(rowAny.namaKapal || rowAny.armada || rowAny.kapal || rowAny.dept || '').trim();
      let resolvedArmada = rawArmada;
      const isGenericArmada = !resolvedArmada || /^(armada\s*cpg|cpg|holding|kantor\s*pusat)$/i.test(resolvedArmada);
      if (isGenericArmada) {
        resolvedArmada =
          ttbLookup?.armada ||
          fstbLookup?.armada ||
          fpbArmadaMap[normFpb] ||
          (normPo ? fpbArmadaMap[normPo] : '') ||
          (rawArmada || 'Armada CPG');
      }

      // Check Photos (Mencocokkan noTtb, nomor digit TTB, atau nama armada)
      let photoLookup: string[] = [];
      if (noTtb) {
        const cleanTtb = noTtb.toLowerCase();
        photoLookup = photoMap[cleanTtb] || photoMap[cleanTtb.replace(/[^a-z0-9]/g, '')] || [];

        if (photoLookup.length === 0) {
          // Cari berdasarkan 4-6 digit angka dari nomor TTB
          const digits = cleanTtb.match(/\b\d{4,6}\b/g) || [];
          for (const d of digits) {
            if (photoMap[d]?.length) {
              photoLookup = photoMap[d];
              break;
            }
            const padded = d.padStart(5, '0');
            if (photoMap[padded]?.length) {
              photoLookup = photoMap[padded];
              break;
            }
          }
        }
      }

      if (photoLookup.length === 0 && resolvedArmada && !/^(armada\s*cpg|cpg)$/i.test(resolvedArmada)) {
        photoLookup = photoMap[resolvedArmada.toLowerCase()] || [];
      } else if (photoLookup.length === 0 && normArmada) {
        photoLookup = photoMap[normArmada] || [];
      }

      const hasPhotos = photoLookup.length > 0;

      // Check FPB PDF
      const hasFpbPdf = Boolean(efpbMap[normFpb] || (rowAny.pdfUrl && String(rowAny.pdfUrl).includes('.pdf')));
      const efpbUrl = efpbMap[normFpb] || (rowAny.pdfUrl ? rowAny.pdfUrl : `/api/parse-fpb-pdf?fpb=${encodeURIComponent(fpb)}&raw=true`);
      const hasFpbDoc = Boolean(fpb);

      const entity = String(rowAny.entity || rowAny.perusahaan || 'CPL');

      dedupeMap.set(key, {
        id: String(row.id || key),
        fpb,
        po: po || undefined,
        entity,
        armada: resolvedArmada,
        item: itemDesc,
        qty: (row as any).qty || (row as any).jumlah || 1,
        unit: (row as any).unit || (row as any).satuan || 'Pcs',
        tglFpb: ('tgl' in row ? (row as any).tgl : (row as any).tglFpb) || undefined,
        tglPo: ('tglPo' in row ? (row as any).tglPo : undefined),
        picPch: ('picPch' in row ? row.picPch : undefined) || rowAny.picPch,
        picTtb: rowAny.picTtb || rowAny.picLogistik,
        picFstb: rowAny.picFstb,
        picLap: rowAny.picLap,
        picAktif: rowAny.picAktif,
        noFstb: noFstb || undefined,
        tglFstb: ('tglFstb' in row ? (row as any).tglFstb : undefined),
        noTtb: noTtb || undefined,
        tglTtb: ('tglTtb' in row ? (row as any).tglTtb : undefined),
        hasFpbDoc,
        hasFstbDoc,
        hasTtbDoc,
        hasPhotos,
        hasFpbPdf,
        hasFstbPdf,
        hasTtbPdf,
        fpbPdfUrl: efpbUrl,
        fstbPdfUrl,
        ttbPdfUrl,
        photoUrls: photoLookup,
      });
    }

    return Array.from(dedupeMap.values());
  }, [procurementData, armadaData, fstbMap, ttbMap, photoMap, efpbMap, fpbArmadaMap]);

  // Handler to open single document / photo preview modal
  const handleOpenDocPreview = (item: DossierBundleItem, docType: 'FPB' | 'FSTB' | 'TTB' | 'FOTO') => {
    setActivePhotoIdx(0);
    if (docType === 'FPB') {
      const isAvailable = Boolean(item.hasFpbPdf || efpbMap[item.fpb.toLowerCase()] || item.fpbPdfUrl);
      setPreviewDoc({
        type: 'FPB',
        title: `Dokumen e-FPB: ${item.fpb}`,
        docNo: item.fpb,
        url: item.fpbPdfUrl,
        isAvailable,
        item,
      });
    } else if (docType === 'FSTB') {
      const isAvailable = Boolean(item.hasFstbPdf && item.fstbPdfUrl);
      setPreviewDoc({
        type: 'FSTB',
        title: item.noFstb ? `Dokumen FSTB: ${item.noFstb}` : `Dokumen FSTB (${item.fpb})`,
        docNo: item.noFstb || item.fpb,
        url: isAvailable ? item.fstbPdfUrl : undefined,
        isAvailable,
        item,
      });
    } else if (docType === 'TTB') {
      const isAvailable = Boolean(item.hasTtbPdf && item.ttbPdfUrl);
      setPreviewDoc({
        type: 'TTB',
        title: item.noTtb ? `Dokumen TTB: ${item.noTtb}` : `Dokumen TTB (${item.fpb})`,
        docNo: item.noTtb || item.fpb,
        url: isAvailable ? item.ttbPdfUrl : undefined,
        isAvailable,
        item,
      });
    } else if (docType === 'FOTO') {
      const isAvailable = Boolean(item.hasPhotos && item.photoUrls && item.photoUrls.length > 0);
      setPreviewDoc({
        type: 'FOTO',
        title: `Foto Dokumentasi Fisik Serah Terima (${item.noTtb || item.armada})`,
        docNo: item.noTtb,
        photoUrls: item.photoUrls || [],
        isAvailable,
        item,
      });
    }
  };

  // State copy feedback WA
  const [isCopiedWa, setIsCopiedWa] = useState(false);

  // Helper mendapatkan nama dan peran PIC yang bersangkutan
  const getPicForDoc = (item: DossierBundleItem, docType: 'FPB' | 'FSTB' | 'TTB' | 'FOTO') => {
    if (docType === 'FSTB') {
      const name = item.picPch || item.picFstb || 'Tim Purchasing';
      return { name, role: 'PIC Purchasing / FSTB' };
    }
    if (docType === 'TTB') {
      const name = item.picTtb || 'Tim Logistik TTB';
      return { name, role: 'PIC Logistik TTB' };
    }
    if (docType === 'FOTO') {
      const name = item.picLap || item.picTtb || 'Tim Logistik Lapangan';
      return { name, role: 'PIC Lapangan' };
    }
    return { name: item.picPch || 'Pemohon FPB', role: 'PIC Pemohon / Purchasing' };
  };

  // Helper membuat template pesan WhatsApp
  const generateWaReminderMessage = (item: DossierBundleItem, docType: 'FPB' | 'FSTB' | 'TTB' | 'FOTO') => {
    const picInfo = getPicForDoc(item, docType);
    if (docType === 'FSTB') {
      return `🔔 *PERINGATAN PERCEPATAN DOKUMEN FSTB (SOFTCOPY PDF)* 📦
Halo Rekan *${picInfo.name}*,

Mohon bantuan & tindak lanjut segera untuk mengunggah berkas softcopy PDF *FSTB* resmi pada pengadaan berikut:

📄 *No. FSTB:* ${item.noFstb || 'Belum Terbit'}
📁 *No. FPB:* ${item.fpb}
📋 *No. PO:* ${item.po || '-'}
🚢 *Armada / Unit:* ${item.armada}
🏢 *Entitas:* ${item.entity || 'CPG'}

Berkas PDF FSTB diperlukan untuk kelengkapan administrasi dossier pencairan & audit keuangan CPG.
Mohon berkas dapat segera diunggah ke CPG Procurement Dashboard. Terima kasih! 🙏

_CPG Procurement & Fleet Monitoring System_`;
    }

    if (docType === 'TTB') {
      return `📦 *PERINGATAN PERCEPATAN DOKUMEN TTB (SOFTCOPY PDF)* 📑
Halo Rekan *${picInfo.name}*,

Mohon bantuan & tindak lanjut segera untuk mengunggah berkas softcopy scan *TTB* yang telah ditandatangani untuk pengadaan berikut:

📄 *No. TTB:* ${item.noTtb || 'Belum Terbit'}
📁 *No. FPB:* ${item.fpb}
📋 *No. PO:* ${item.po || '-'}
🚢 *Armada / Unit:* ${item.armada}
🏢 *Entitas:* ${item.entity || 'CPG'}

Dokumen fisik bertanda tangan diperlukan untuk kompilasi akhir berkas administrasi dossier (Kelengkapan 4/4).
Mohon berkas dapat segera diunggah ke CPG Procurement Dashboard. Terima kasih! 🙏

_CPG Procurement & Fleet Monitoring System_`;
    }

    if (docType === 'FOTO') {
      return `📸 *PERMINTAAN DOKUMENTASI FOTO SERAH TERIMA* ⚓
Halo Rekan *${picInfo.name}*,

Mohon bantuan untuk mengunggah foto bukti fisik serah terima barang di kapal/armada:

🚢 *Armada / Unit:* ${item.armada}
📄 *No. TTB:* ${item.noTtb || '-'}
📁 *No. FPB:* ${item.fpb}
📋 *No. PO:* ${item.po || '-'}

Foto fisik diperlukan untuk verifikasi kelengkapan berkas dossier CPG. Terima kasih! 🙏

_CPG Procurement & Fleet Monitoring System_`;
    }

    return `📋 *PERINGATAN KELENGKAPAN BERKAS e-FPB* 📄
Halo Rekan *${picInfo.name}*,

Mohon bantuan untuk mengunggah / menyelesaikan softcopy PDF dokumen resmi *FPB* berikut:

📁 *No. FPB:* ${item.fpb}
📋 *No. PO:* ${item.po || '-'}
🚢 *Armada / Unit:* ${item.armada}
🏢 *Entitas:* ${item.entity || 'CPG'}

Terima kasih atas kerja samanya! 🙏

_CPG Procurement & Fleet Monitoring System_`;
  };

  // Handler kirim WhatsApp langsung
  const handleSendWaToPic = (item: DossierBundleItem, docType: 'FPB' | 'FSTB' | 'TTB' | 'FOTO') => {
    const text = generateWaReminderMessage(item, docType);
    const picInfo = getPicForDoc(item, docType);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    if (showToast) {
      showToast(`Membuka WhatsApp untuk menghubungi ${picInfo.name} (${picInfo.role})`, 'info');
    }
  };

  // Handler copy pesan WA
  const handleCopyWaMessage = async (item: DossierBundleItem, docType: 'FPB' | 'FSTB' | 'TTB' | 'FOTO') => {
    const text = generateWaReminderMessage(item, docType);
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedWa(true);
      setTimeout(() => setIsCopiedWa(false), 2500);
      if (showToast) {
        showToast('Template pesan WhatsApp berhasil disalin ke clipboard!', 'success');
      }
    } catch (err) {
      console.error('Gagal menyalin teks WA:', err);
    }
  };

  // Filter Logic
  const filteredItems = useMemo(() => {
    return dossierItems.filter((item) => {
      // 1. Filter Tab (COMPLETE = 4/4, INCOMPLETE = <4, ALL = All)
      const isComplete = item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos;
      if (activeFilterTab === 'COMPLETE' && !isComplete) return false;
      if (activeFilterTab === 'INCOMPLETE' && isComplete) return false;

      // 2. Entity Filter
      if (selectedEntity !== 'ALL') {
        const itemEnt = (item.entity || '').toUpperCase();
        if (itemEnt !== selectedEntity) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.fpb.toLowerCase().includes(q) ||
          (item.po && item.po.toLowerCase().includes(q)) ||
          item.armada.toLowerCase().includes(q) ||
          item.item.toLowerCase().includes(q) ||
          (item.noFstb && item.noFstb.toLowerCase().includes(q)) ||
          (item.noTtb && item.noTtb.toLowerCase().includes(q)) ||
          (item.picPch && item.picPch.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [dossierItems, activeFilterTab, selectedEntity, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Metrics KPI
  const metrics = useMemo(() => {
    let totalComplete = 0;
    let missingFstb = 0;
    let missingTtb = 0;
    let missingPhotos = 0;

    for (const item of dossierItems) {
      if (item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos) {
        totalComplete++;
      }
      if (!item.hasFstbDoc) missingFstb++;
      if (!item.hasTtbDoc) missingTtb++;
      if (!item.hasPhotos) missingPhotos++;
    }

    return {
      totalItems: dossierItems.length,
      totalComplete,
      missingFstb,
      missingTtb,
      missingPhotos,
    };
  }, [dossierItems]);

  // Handle Download Single PDF Dossier
  const handleDownload = async (item: DossierBundleItem) => {
    setDownloadingId(item.id);
    setDownloadStep('Memulai kompilasi...');
    try {
      showToast?.(`Mempersiapkan kompilasi berkas untuk ${item.fpb || item.po}...`, 'info');
      const res = await downloadDossierPdf(item, (step) => {
        setDownloadStep(step);
      });
      showToast?.(
        `Sukses mengunduh ${res.fileName} (${res.totalPages} halaman)!`,
        'success'
      );
    } catch (err: any) {
      console.error('Kompilasi error:', err);
      showToast?.(
        err.message || 'Gagal mengompilasi berkas PDF. Silakan periksa kembali berkas terkait.',
        'error'
      );
    } finally {
      setDownloadingId(null);
      setDownloadStep('');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileStack className="size-4 sm:size-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              Ringkasan Berkas Lengkap &amp; Kompilasi Dossier
            </h1>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Menampilkan data <strong>FPB, FSTB, TTB, dan FOTO</strong> yang telah selesai secara administrasi dalam 1 kolom. Klik tombol unduh untuk mengompilasi semua berkas menjadi <strong>1 file PDF utuh</strong> untuk arsip &amp; audit keuangan.
          </p>
        </div>

        <button
          onClick={fetchManifests}
          disabled={isLoadingApi}
          className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold border border-border transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Segarkan data softcopy dari Cloudflare R2 & Server e-FPB"
        >
          <RefreshCw className={`size-3.5 ${isLoadingApi ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          <span>{isLoadingApi ? 'Menyinkronkan...' : 'Refresh Berkas'}</span>
        </button>
      </div>

      {/* KPI 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: 100% Selesai */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-emerald-500/30 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none transition group-hover:scale-110" />
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono">
              Selesai Administrasi (4/4)
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.totalComplete.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span>Siap dikompilasi ke 1 file PDF</span>
          </div>
        </div>

        {/* Card 2: Menunggu FSTB */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada FSTB
            </span>
            <Boxes className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingFstb.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
            Menunggu serah terima barang
          </div>
        </div>

        {/* Card 3: Menunggu TTB */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada TTB
            </span>
            <ClipboardCheck className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingTtb.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Menunggu tanda terima logistik
          </div>
        </div>

        {/* Card 4: Menunggu Foto Lapangan */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Belum Ada Foto
            </span>
            <Camera className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {metrics.missingPhotos.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            Menunggu dokumentasi fisik
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-xs">
        {/* Left: Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/80 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('COMPLETE');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'COMPLETE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Lengkap Selesai</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeFilterTab === 'COMPLETE'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {metrics.totalComplete}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Semua Data</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeFilterTab === 'ALL'
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {metrics.totalItems}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilterTab('INCOMPLETE');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'INCOMPLETE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Belum Lengkap</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeFilterTab === 'INCOMPLETE'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}
            >
              {metrics.totalItems - metrics.totalComplete}
            </span>
          </button>
        </div>

        {/* Right: Search & Entity Select */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          {/* Entity Filter */}
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono font-medium text-foreground focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
            title="Filter Entitas Perusahaan CPG"
          >
            {ENTITIES.map((ent) => (
              <option key={ent.code} value={ent.code}>
                {ent.label}
              </option>
            ))}
          </select>

          {/* Quick Search Bar */}
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari FPB, PO, FSTB, TTB, barang, kapal..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table: 1-Column Administrasi + 1-Click Compile Button */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3.5 min-w-[180px]">Armada &amp; Entitas</th>
                <th className="py-3 px-3.5 min-w-[240px]">Identitas Pengadaan (FPB &bull; PO &bull; FSTB &bull; TTB)</th>
                {/* 1 KOLOM KELENGKAPAN ADMINISTRASI: FPB, FSTB, TTB, FOTO */}
                <th className="py-3 px-3.5 min-w-[260px] bg-emerald-500/5 border-x border-emerald-500/20">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Kelengkapan Administrasi (FPB &bull; FSTB &bull; TTB &bull; FOTO)</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 w-52 text-center">Aksi Kompilasi 1-Klik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileStack className="size-8 text-muted-foreground/40" />
                      <span className="font-semibold text-foreground text-sm">
                        Tidak ada data berkas yang sesuai filter
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Coba ubah kata kunci pencarian atau ganti filter tab ke &ldquo;Semua Data&rdquo;.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const itemIndex = (currentPage - 1) * pageSize + idx + 1;
                  const isComplete =
                    item.hasFpbDoc && item.hasFstbDoc && item.hasTtbDoc && item.hasPhotos;

                  const isDownloadingThis = downloadingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/40 transition group"
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 text-center font-mono text-muted-foreground">
                        {itemIndex}
                      </td>

                      {/* Armada & Entitas */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Ship className="size-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <span className="truncate">{item.armada}</span>
                        </div>

                        {/* Posisi Terakhir Kapal (kecuali Office GAJ) */}
                        {(() => {
                          const vPos = getVesselPosition(item.armada);
                          if (!vPos) return null;
                          return (
                            <div
                              className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground font-mono"
                              title={`Posisi Terakhir: ${vPos}`}
                            >
                              <MapPin className="size-2.5 text-rose-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{vPos}</span>
                            </div>
                          );
                        })()}

                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
                            {item.entity || 'CPG'}
                          </span>
                          {item.tglFpb && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Tgl: {item.tglFpb}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Identitas Pengadaan (FPB, PO, FSTB, TTB) */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1.5">
                          {/* Baris 1: FPB & PO */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-foreground">
                              {item.fpb}
                            </span>
                            {item.po ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                PO: {item.po}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                                PO: -
                              </span>
                            )}
                          </div>

                          {/* Baris 2: FSTB & TTB */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.noFstb ? (
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 font-semibold"
                                title={`No. FSTB: ${item.noFstb}`}
                              >
                                <Boxes className="size-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
                                <span>FSTB: {item.noFstb}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 border border-border">
                                <span>FSTB: -</span>
                              </span>
                            )}

                            {item.noTtb ? (
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-semibold"
                                title={`No. TTB: ${item.noTtb}`}
                              >
                                <ClipboardCheck className="size-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span>TTB: {item.noTtb}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 border border-border">
                                <span>TTB: -</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 1 KOLOM KELENGKAPAN ADMINISTRASI TERPADU */}
                      <td className="py-3 px-3.5 bg-emerald-500/5 border-x border-emerald-500/20">
                        <div className="space-y-1.5">
                          {/* 4 Pilar Tombol Ikon Interaktif */}
                          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10.5px]">
                            {/* 1. Tombol FPB */}
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(item, 'FPB')}
                              className={`px-2 py-1.5 rounded-md flex items-center justify-between border transition active:scale-95 text-left cursor-pointer ${
                                item.hasFpbPdf
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 hover:border-emerald-500/60 font-semibold shadow-xs'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/25 hover:border-amber-500/40'
                              }`}
                              title={
                                item.hasFpbPdf
                                  ? `Dokumen e-FPB resmi tersedia (Klik untuk melihat)`
                                  : `Softcopy PDF e-FPB belum diunggah (Klik untuk rincian)`
                              }
                            >
                              <span className="flex items-center gap-1.5">
                                <FileText className={`size-3.5 shrink-0 ${item.hasFpbPdf ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                                <span>FPB</span>
                              </span>
                              <span className="flex items-center gap-1 text-[10px]">
                                {item.hasFpbPdf ? (
                                  <>
                                    <Eye className="size-2.5 opacity-60" />
                                    <span className="font-bold">✓</span>
                                  </>
                                ) : (
                                  <span className="text-[9px] font-medium opacity-90">Draft</span>
                                )}
                              </span>
                            </button>

                            {/* 2. Tombol FSTB */}
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(item, 'FSTB')}
                              className={`px-2 py-1.5 rounded-md flex items-center justify-between border transition active:scale-95 text-left cursor-pointer ${
                                item.hasFstbPdf
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 hover:border-emerald-500/60 font-semibold shadow-xs'
                                  : item.noFstb
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/25 hover:border-amber-500/40'
                                  : 'bg-muted/70 hover:bg-muted text-muted-foreground/70 border-border hover:border-muted-foreground/30'
                              }`}
                              title={
                                item.hasFstbPdf
                                  ? `FSTB Resmi: ${item.noFstb || 'Tersedia'} (Klik untuk melihat PDF)`
                                  : item.noFstb
                                  ? `FSTB ${item.noFstb}: Softcopy PDF belum diunggah (Klik untuk info)`
                                  : `FSTB belum ada`
                              }
                            >
                              <span className="flex items-center gap-1.5">
                                <Boxes className={`size-3.5 shrink-0 ${item.hasFstbPdf ? 'text-teal-600 dark:text-teal-400' : item.noFstb ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50'}`} />
                                <span>FSTB</span>
                              </span>
                              <span className="flex items-center gap-1 text-[10px]">
                                {item.hasFstbPdf ? (
                                  <>
                                    <Eye className="size-2.5 opacity-60" />
                                    <span className="font-bold">✓</span>
                                  </>
                                ) : (
                                  <span className="text-[9px] font-medium opacity-90">{item.noFstb ? 'Belum PDF' : '-'}</span>
                                )}
                              </span>
                            </button>

                            {/* 3. Tombol TTB */}
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(item, 'TTB')}
                              className={`px-2 py-1.5 rounded-md flex items-center justify-between border transition active:scale-95 text-left cursor-pointer ${
                                item.hasTtbPdf
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 hover:border-emerald-500/60 font-semibold shadow-xs'
                                  : item.noTtb
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/25 hover:border-amber-500/40'
                                  : 'bg-muted/70 hover:bg-muted text-muted-foreground/70 border-border hover:border-muted-foreground/30'
                              }`}
                              title={
                                item.hasTtbPdf
                                  ? `TTB Resmi: ${item.noTtb || 'Tersedia'} (Klik untuk melihat PDF)`
                                  : item.noTtb
                                  ? `TTB ${item.noTtb}: Softcopy PDF belum diunggah (Klik untuk info)`
                                  : `TTB belum ada`
                              }
                            >
                              <span className="flex items-center gap-1.5">
                                <ClipboardCheck className={`size-3.5 shrink-0 ${item.hasTtbPdf ? 'text-indigo-600 dark:text-indigo-400' : item.noTtb ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50'}`} />
                                <span>TTB</span>
                              </span>
                              <span className="flex items-center gap-1 text-[10px]">
                                {item.hasTtbPdf ? (
                                  <>
                                    <Eye className="size-2.5 opacity-60" />
                                    <span className="font-bold">✓</span>
                                  </>
                                ) : (
                                  <span className="text-[9px] font-medium opacity-90">{item.noTtb ? 'Belum PDF' : '-'}</span>
                                )}
                              </span>
                            </button>

                            {/* 4. Tombol FOTO */}
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(item, 'FOTO')}
                              className={`px-2 py-1.5 rounded-md flex items-center justify-between border transition active:scale-95 text-left cursor-pointer ${
                                item.hasPhotos
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-500/35 hover:border-emerald-500/60 font-semibold shadow-xs'
                                  : 'bg-muted/70 hover:bg-muted text-muted-foreground/70 border-border hover:border-muted-foreground/30'
                              }`}
                              title={
                                item.hasPhotos
                                  ? `${item.photoUrls?.length || 1} Foto bukti fisik serah terima lapangan (Klik untuk melihat)`
                                  : `Foto fisik serah terima belum diunggah`
                              }
                            >
                              <span className="flex items-center gap-1.5">
                                <Camera className={`size-3.5 shrink-0 ${item.hasPhotos ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'}`} />
                                <span>FOTO</span>
                              </span>
                              <span className="flex items-center gap-1 text-[10px]">
                                {item.hasPhotos ? (
                                  <>
                                    <Eye className="size-2.5 opacity-60" />
                                    <span className="font-bold">{item.photoUrls?.length || 1}✓</span>
                                  </>
                                ) : (
                                  <span className="text-[9px] font-medium opacity-90">-</span>
                                )}
                              </span>
                            </button>
                          </div>

                          {/* Status Ringkasan Baris */}
                          <div className="flex items-center justify-between pt-0.5">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                                SELESAI ADMINISTRASI (4/4)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="size-3 text-amber-500" />
                                BELUM LENGKAP ({[item.hasFpbDoc, item.hasFstbDoc, item.hasTtbDoc, item.hasPhotos].filter(Boolean).length}/4)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Aksi 1-Klik Kompilasi File */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={isDownloadingThis}
                            className={`w-full h-8 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer ${
                              isComplete
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                : 'bg-foreground text-background hover:opacity-90'
                            } disabled:opacity-50`}
                            title="Kompilasi & Download seluruh berkas menjadi 1 file PDF utuh"
                          >
                            {isDownloadingThis ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span className="text-[11px] truncate">{downloadStep || 'Memproses...'}</span>
                              </>
                            ) : (
                              <>
                                <Download className="size-3.5 shrink-0" />
                                <span>{isComplete ? 'Unduh 1 PDF Lengkap' : 'Unduh Berkas PDF'}</span>
                              </>
                            )}
                          </button>

                          {onOpenAuditModal && (
                            <button
                              type="button"
                              onClick={() => onOpenAuditModal(item.fpb, item.po)}
                              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <Eye className="size-3" />
                              <span>Lihat Detail Audit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar & Pagination Controls */}
        <div className="p-3 border-t border-border bg-muted/30 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-3 font-mono">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan{' '}
              <strong className="text-foreground">
                {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredItems.length)}
              </strong>{' '}
              dari <strong className="text-foreground">{filteredItems.length.toLocaleString('id-ID')}</strong> tiket (
              <span className="font-semibold text-foreground">
                {activeFilterTab === 'COMPLETE'
                  ? 'Lengkap Selesai'
                  : activeFilterTab === 'INCOMPLETE'
                  ? 'Belum Lengkap'
                  : 'Semua Data'}
              </span>
              )
            </span>
          </div>

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-30 transition cursor-pointer text-xs"
                title="Halaman Pertama"
              >
                &laquo;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-30 transition cursor-pointer text-xs"
                title="Halaman Sebelumnya"
              >
                &lsaquo; Prev
              </button>
              <span className="px-2 text-foreground font-semibold text-xs">
                Hal {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-30 transition cursor-pointer text-xs"
                title="Halaman Berikutnya"
              >
                Next &rsaquo;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-30 transition cursor-pointer text-xs"
                title="Halaman Terakhir"
              >
                &raquo;
              </button>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 h-7 px-2 rounded-md border border-border bg-card text-[11px] text-foreground focus:outline-none cursor-pointer"
              >
                <option value={25}>25 / hal</option>
                <option value={50}>50 / hal</option>
                <option value={100}>100 / hal</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pratinjau Dokumen & Galeri Foto */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    previewDoc.isAvailable
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {previewDoc.type === 'FPB' && <FileText className="size-5" />}
                  {previewDoc.type === 'FSTB' && <Boxes className="size-5" />}
                  {previewDoc.type === 'TTB' && <ClipboardCheck className="size-5" />}
                  {previewDoc.type === 'FOTO' && <Camera className="size-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">
                      {previewDoc.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        previewDoc.isAvailable
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {previewDoc.isAvailable ? 'Tersedia' : 'Softcopy Belum Ada'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 font-mono">
                    <span>
                      Armada: <strong>{previewDoc.item.armada}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Entitas: <strong>{previewDoc.item.entity || 'CPG'}</strong>
                    </span>
                    {previewDoc.item.po && (
                      <>
                        <span>&bull;</span>
                        <span>
                          PO: <strong>{previewDoc.item.po}</strong>
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {previewDoc.url && (
                  <>
                    <a
                      href={previewDoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold flex items-center gap-1.5 text-foreground transition"
                      title="Buka dokumen di tab baru browser"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Tab Baru</span>
                    </a>
                    <a
                      href={previewDoc.url}
                      download
                      className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                      title="Download berkas PDF"
                    >
                      <Download className="size-3.5" />
                      <span>Unduh</span>
                    </a>
                  </>
                )}
                {previewDoc.type === 'FOTO' &&
                  previewDoc.photoUrls &&
                  previewDoc.photoUrls.length > 0 && (
                    <a
                      href={previewDoc.photoUrls[activePhotoIdx]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold flex items-center gap-1.5 text-foreground transition"
                      title="Buka foto resolusi penuh di tab baru"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Buka Foto Asli</span>
                    </a>
                  )}
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="size-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Content Body Modal */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
              {/* KASUS 1: GALERI FOTO */}
              {previewDoc.type === 'FOTO' && (
                previewDoc.photoUrls && previewDoc.photoUrls.length > 0 ? (
                  <div className="space-y-4">
                    {/* Foto Utama */}
                    <div className="relative w-full h-[55vh] rounded-xl overflow-hidden bg-black/90 flex items-center justify-center border border-border shadow-inner">
                      <img
                        src={previewDoc.photoUrls[activePhotoIdx]}
                        alt={`Foto serah terima ${activePhotoIdx + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white px-3 py-1 rounded-full text-xs font-mono font-semibold">
                        Foto {activePhotoIdx + 1} dari {previewDoc.photoUrls.length}
                      </div>
                    </div>

                    {/* Thumbnail Selector jika foto > 1 */}
                    {previewDoc.photoUrls.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {previewDoc.photoUrls.map((pUrl, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setActivePhotoIdx(pIdx)}
                            className={`size-16 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                              activePhotoIdx === pIdx
                                ? 'border-primary ring-2 ring-primary/20 scale-105'
                                : 'border-border opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={pUrl}
                              alt={`Thumbnail ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-4 max-w-md mx-auto">
                    <div className="size-16 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Camera className="size-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">
                        Belum Ada Foto Dokumentasi Fisik
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Belum ditemukan foto bukti fisik serah terima barang untuk armada{' '}
                        <strong>{previewDoc.item.armada}</strong> atau TTB{' '}
                        <strong>{previewDoc.item.noTtb || '-'}</strong> di Cloudflare R2.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleSendWaToPic(previewDoc.item, 'FOTO')}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs active:scale-95 cursor-pointer"
                        title="Kirim pesan permintaan foto serah terima via WhatsApp ke PIC Lapangan"
                      >
                        <MessageCircle className="size-4 shrink-0" />
                        <span>Kirim WA ke PIC Lapangan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyWaMessage(previewDoc.item, 'FOTO')}
                        className="px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                        title="Salin template pesan WhatsApp"
                      >
                        {isCopiedWa ? (
                          <>
                            <Check className="size-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Salin Pesan WA</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* KASUS 2: DOKUMEN PDF TERSEDIA */}
              {previewDoc.type !== 'FOTO' && previewDoc.isAvailable && previewDoc.url && (
                <div className="w-full h-[65vh] rounded-xl overflow-hidden border border-border bg-white shadow-inner flex flex-col">
                  <iframe
                    src={previewDoc.url}
                    className="w-full h-full"
                    title={previewDoc.title}
                  />
                </div>
              )}

              {/* KASUS 3: DOKUMEN PDF BELUM TERSEDIA (EMPTY/PENDING STATE) */}
              {previewDoc.type !== 'FOTO' && (!previewDoc.isAvailable || !previewDoc.url) && (
                <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-4">
                  <div className="size-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <AlertCircle className="size-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-foreground">
                      Softcopy PDF {previewDoc.type} Belum Tersedia
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Dokumen scan PDF untuk berkas <strong>{previewDoc.title}</strong> belum diunggah ke server penyimpanan Cloudflare R2.
                    </p>
                  </div>

                  {/* Ringkasan Data Tiket */}
                  <div className="p-3.5 rounded-xl border border-border bg-card text-left space-y-2 text-xs font-mono">
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted-foreground">Nomor FPB</span>
                      <span className="font-bold text-foreground">{previewDoc.item.fpb}</span>
                    </div>
                    {previewDoc.item.po && (
                      <div className="flex justify-between border-b border-border pb-1.5">
                        <span className="text-muted-foreground">Nomor PO</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {previewDoc.item.po}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted-foreground">Nomor FSTB</span>
                      {previewDoc.item.noFstb ? (
                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                          {previewDoc.item.noFstb}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold italic text-[11px]">
                          Belum Diterbitkan (Menunggu Tindak Lanjut)
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted-foreground">Nomor TTB</span>
                      {previewDoc.item.noTtb ? (
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {previewDoc.item.noTtb}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold italic text-[11px]">
                          Belum Diterbitkan (Menunggu Tindak Lanjut)
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between border-b border-border pb-1.5">
                      <span className="text-muted-foreground">Armada Peminta</span>
                      <span className="font-bold text-foreground">{previewDoc.item.armada}</span>
                    </div>
                    {/* Baris PIC Penanggung Jawab */}
                    {(() => {
                      const picInfo = getPicForDoc(previewDoc.item, previewDoc.type);
                      return (
                        <div className="flex justify-between items-center pt-0.5">
                          <span className="text-muted-foreground">PIC Penanggung Jawab</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {picInfo.name} <span className="text-[10px] text-muted-foreground font-normal">({picInfo.role})</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {/* Tombol Kirim WA ke PIC */}
                    <button
                      type="button"
                      onClick={() => handleSendWaToPic(previewDoc.item, previewDoc.type)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs active:scale-95 cursor-pointer"
                      title="Kirim pesan peringatan percepatan dokumen via WhatsApp"
                    >
                      <MessageCircle className="size-4 shrink-0" />
                      <span>Kirim WA ke PIC</span>
                    </button>

                    {/* Tombol Salin Format Pesan WA */}
                    <button
                      type="button"
                      onClick={() => handleCopyWaMessage(previewDoc.item, previewDoc.type)}
                      className="px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      title="Salin template pesan WhatsApp ke clipboard"
                    >
                      {isCopiedWa ? (
                        <>
                          <Check className="size-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Salin Pesan WA</span>
                        </>
                      )}
                    </button>

                    {onOpenAuditModal && (
                      <button
                        type="button"
                        onClick={() => {
                          const fpb = previewDoc.item.fpb;
                          const po = previewDoc.item.po;
                          setPreviewDoc(null);
                          onOpenAuditModal(fpb, po);
                        }}
                        className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-xs"
                      >
                        Buka Audit Pengadaan
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPreviewDoc(null)}
                      className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
