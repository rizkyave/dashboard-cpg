'use client';

import React, { useState } from 'react';
import {
  History,
  Tag,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Wrench,
  ShieldAlert,
  Copy,
  Calendar,
  Code,
  Sliders,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  SYSTEM_CHANGELOG,
  SYSTEM_CURRENT_VERSION,
  SYSTEM_BUILD_NUMBER,
  SystemVersionRelease,
  ChangelogItem,
} from '@/data/system-changelog';

interface SystemReleaseLogsCardProps {
  isAdmin: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function SystemReleaseLogsCard({ isAdmin, showToast }: SystemReleaseLogsCardProps) {
  // Hanya bisa diakses oleh Admin
  if (!isAdmin) return null;

  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    [SYSTEM_CURRENT_VERSION]: true, // Default buka versi terkini
  });
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedVersion, setSelectedVersion] = useState<string>('ALL');

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const getItemTypeBadge = (type: ChangelogItem['type']) => {
    switch (type) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <Sparkles className="size-3" /> Fitur Baru
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Layers className="size-3" /> Peningkatan
          </span>
        );
      case 'ui':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <Sliders className="size-3" /> Tampilan &amp; Layout
          </span>
        );
      case 'security':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <ShieldAlert className="size-3" /> Keamanan
          </span>
        );
      case 'fix':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Wrench className="size-3" /> Bug Fix
          </span>
        );
      default:
        return null;
    }
  };

  const handleCopyChangelogSummary = (ver: SystemVersionRelease) => {
    let text = `[LOG RILIS RESMI CPG PROCUREMENT HUB - ${ver.version}]\n`;
    text += `Judul: ${ver.title}\n`;
    text += `Tanggal Rilis: ${ver.releaseDate} (${ver.buildNumber})\n`;
    text += `Ringkasan: ${ver.summary}\n\n`;
    text += `Daftar Perubahan:\n`;
    ver.items.forEach((it, idx) => {
      text += `${idx + 1}. [${it.type.toUpperCase()}] ${it.title} (${it.module})\n   - ${it.description}\n   - Dampak: ${it.impact}\n\n`;
    });

    navigator.clipboard.writeText(text);
    if (showToast) {
      showToast(`Log rilis ${ver.version} berhasil disalin ke papan klip!`, 'success');
    }
  };

  return (
    <div className="bg-card border-2 border-border/80 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
      {/* Header Log Rilis */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <History className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-foreground tracking-tight">
                Log Riwayat Versi &amp; Pembaruan Sistem (Changelog)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-600 text-white shadow-2xs">
                {SYSTEM_CURRENT_VERSION} Live
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                <Lock className="size-3" /> Akses Khusus Admin
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Catatan dokumentasi teknis dan riwayat perubahan resmi sistem dashboard pengadaan PT Cindara Pratama Lines. Hanya dapat dilihat oleh akun Administrator.
            </p>
          </div>
        </div>

        {/* Current Build Badge & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="block text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
              Nomor Build Aktif
            </span>
            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded">
              {SYSTEM_BUILD_NUMBER}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopyChangelogSummary(SYSTEM_CHANGELOG[0])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-2xs cursor-pointer active:scale-95"
            title="Salin ringkasan log rilis versi terkini"
          >
            <Copy className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span>Salin Log {SYSTEM_CURRENT_VERSION}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Tipe Pembaruan:</span>
          {(['ALL', 'feature', 'improvement', 'ui', 'security'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === t
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t === 'ALL' && 'Semua Tipe'}
              {t === 'feature' && '✨ Fitur Baru'}
              {t === 'improvement' && '⚡ Peningkatan'}
              {t === 'ui' && '🎨 Tampilan & Layout'}
              {t === 'security' && '🛡️ Keamanan'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
          <span>Total {SYSTEM_CHANGELOG.length} Rilis Versi Tercatat</span>
        </div>
      </div>

      {/* Version List Accordion */}
      <div className="space-y-4">
        {SYSTEM_CHANGELOG.map((rel) => {
          const isExpanded = !!expandedVersions[rel.version];
          const filteredItems = rel.items.filter((it) => {
            if (filterType === 'ALL') return true;
            return it.type === filterType;
          });

          return (
            <div
              key={rel.version}
              className={`border-2 rounded-xl transition overflow-hidden ${
                rel.badge === 'Latest'
                  ? 'border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/10'
                  : 'border-border bg-card'
              }`}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleVersion(rel.version)}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition select-none"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black font-mono tracking-tight flex items-center gap-1.5 shadow-2xs ${
                      rel.badge === 'Latest'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-white dark:bg-slate-800'
                    }`}
                  >
                    <Tag className="size-3.5" />
                    <span>{rel.version}</span>
                  </span>

                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span>{rel.title}</span>
                      {rel.badge === 'Latest' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Aktif Digunakan
                        </span>
                      )}
                    </h4>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> {rel.releaseDate}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono text-[10px]">{rel.buildNumber}</span>
                      <span>&bull;</span>
                      <span className="font-semibold">{rel.items.length} Pembaruan</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <span className="text-xs font-semibold text-primary">
                    {isExpanded ? 'Tutup Detail' : 'Buka Detail Log'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-4">
                  {/* Summary Box */}
                  <div className="p-3 rounded-lg bg-background/80 border border-border text-xs text-foreground/90 leading-relaxed font-medium">
                    <strong className="text-purple-600 dark:text-purple-400 font-bold block mb-0.5">
                      Ringkasan Rilis:
                    </strong>
                    {rel.summary}
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-border/60 rounded-xl border border-border bg-background overflow-hidden">
                    {filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground italic">
                        Tidak ada item log dengan filter &quot;{filterType}&quot; pada versi ini.
                      </div>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <div key={idx} className="p-3.5 hover:bg-muted/20 transition-colors space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {getItemTypeBadge(item.type)}
                              <h5 className="text-xs font-bold text-foreground">{item.title}</h5>
                            </div>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                              Modul: {item.module}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                            {item.description}
                          </p>

                          <div className="text-[11px] text-foreground/80 pl-1 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              <strong>Dampak Operasional:</strong> {item.impact}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

