'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  Briefcase,
  Building2,
  Save,
  RotateCcw,
  Info,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  TenderApprovalMatrixSettings,
  DEFAULT_TENDER_APPROVAL_SETTINGS,
  getStoredTenderApprovalSettings,
  saveStoredTenderApprovalSettings,
} from '@/utils/tenderApprovalConfig';

interface Props {
  isAdmin: boolean;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export default function TenderApprovalConfigCard({ isAdmin, showToast }: Props) {
  const [config, setConfig] = useState<TenderApprovalMatrixSettings>(() =>
    getStoredTenderApprovalSettings()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const handler = () => {
      setConfig(getStoredTenderApprovalSettings());
    };
    window.addEventListener('cpg-tender-approval-config-changed', handler);
    return () => window.removeEventListener('cpg-tender-approval-config-changed', handler);
  }, []);

  const handleTier1Change = (valStr: string) => {
    const num = Number(valStr.replace(/\D/g, '')) || 0;
    setConfig((prev) => ({
      ...prev,
      tier1: { ...prev.tier1, maxAmount: num },
    }));
    setHasChanges(true);
  };

  const handleTier2Change = (valStr: string) => {
    const num = Number(valStr.replace(/\D/g, '')) || 0;
    setConfig((prev) => ({
      ...prev,
      tier2: { ...prev.tier2, maxAmount: num },
    }));
    setHasChanges(true);
  };

  const handleScopeChange = (tierKey: 'tier1' | 'tier2' | 'tier3', scope: string) => {
    setConfig((prev) => ({
      ...prev,
      [tierKey]: { ...prev[tierKey], scopeDescription: scope },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      const updated: TenderApprovalMatrixSettings = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin Hermansyah',
      };
      saveStoredTenderApprovalSettings(updated);
      setHasChanges(false);
      if (showToast) {
        showToast(
          'Matriks otorisasi berjenjang (SAP Release Strategy) berhasil diperbarui!',
          'success'
        );
      }
    } catch (err: any) {
      if (showToast) showToast(`Gagal menyimpan: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Kembalikan batas nominal otorisasi ke standar SOP (Tier 1: 5 Jt, Tier 2: 30 Jt, Tier 3: > 30 Jt)?'))
      return;
    saveStoredTenderApprovalSettings(DEFAULT_TENDER_APPROVAL_SETTINGS);
    setConfig(DEFAULT_TENDER_APPROVAL_SETTINGS);
    setHasChanges(false);
    if (showToast) showToast('Konfigurasi batas tier berhasil direset ke standar SOP.', 'info');
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Matriks Otorisasi Berjenjang Tender (SAP Release Strategy)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                SOP Pengadaan
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atur batas nilai kontrak (plafon rupiah) dan peran pejabat yang berwenang me-release persetujuan penerbitan Purchase Order (PO).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition cursor-pointer"
            title="Kembalikan ke Nilai Standar SOP"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset Default</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-40"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi Tier'}</span>
          </button>
        </div>
      </div>

      {/* Grid 3 Kartu Tier Otorisasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* TIER 1 */}
        <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Tier 1 (Plafon Awal)
            </span>
            <Award className="size-4 text-emerald-600" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Batas Maksimal Nilai (Rupiah):
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs font-bold text-muted-foreground font-mono">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={Number(config.tier1.maxAmount).toLocaleString('id-ID')}
                onChange={(e) => handleTier1Change(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-emerald-500/30 bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Nilai kontrak &le; Rp {Number(config.tier1.maxAmount).toLocaleString('id-ID')}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Pejabat Wewenang Release:
            </label>
            <div className="p-2 rounded-lg bg-background border border-border font-bold text-foreground">
              {config.tier1.authorizedRoleLabel}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Deskripsi Ruang Lingkup:
            </label>
            <input
              type="text"
              value={config.tier1.scopeDescription}
              onChange={(e) => handleScopeChange('tier1', e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
            />
          </div>
        </div>

        {/* TIER 2 */}
        <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
              Tier 2 (Menengah)
            </span>
            <Briefcase className="size-4 text-purple-600" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Batas Maksimal Nilai (Rupiah):
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs font-bold text-muted-foreground font-mono">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={Number(config.tier2.maxAmount).toLocaleString('id-ID')}
                onChange={(e) => handleTier2Change(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-purple-500/30 bg-background text-foreground font-mono font-bold text-xs focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Nilai &gt; Rp {Number(config.tier1.maxAmount).toLocaleString('id-ID')} s/d &le; Rp {Number(config.tier2.maxAmount).toLocaleString('id-ID')}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Pejabat Wewenang Release:
            </label>
            <div className="p-2 rounded-lg bg-background border border-border font-bold text-foreground">
              {config.tier2.authorizedRoleLabel}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Deskripsi Ruang Lingkup:
            </label>
            <input
              type="text"
              value={config.tier2.scopeDescription}
              onChange={(e) => handleScopeChange('tier2', e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
            />
          </div>
        </div>

        {/* TIER 3 */}
        <div className="p-4 rounded-xl border-2 border-sky-500/30 bg-sky-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300">
              Tier 3 (Tinggi / Direksi)
            </span>
            <Building2 className="size-4 text-sky-600" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Ambang Batas Nilai:
            </label>
            <div className="h-8 px-2.5 rounded-lg bg-background border border-border flex items-center font-mono font-bold text-sky-700 dark:text-sky-300">
              &gt; Rp {Number(config.tier2.maxAmount).toLocaleString('id-ID')}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Otomatis untuk seluruh kontrak di atas Tier 2
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Pejabat Wewenang Release:
            </label>
            <div className="p-2 rounded-lg bg-background border border-border font-bold text-foreground">
              {config.tier3.authorizedRoleLabel}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Deskripsi Ruang Lingkup:
            </label>
            <input
              type="text"
              value={config.tier3.scopeDescription}
              onChange={(e) => handleScopeChange('tier3', e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs"
            />
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
        <Info className="size-4 text-purple-600 shrink-0" />
        <span>
          <strong>Aturan Rilis PO:</strong> Pejabat pada tier lebih tinggi (atau Administrator) otomatis memiliki wewenang untuk me-release tender pada tier di bawahnya. PO tidak dapat diterbitkan sebelum status otorisasi resmi di-release.
        </span>
      </div>
    </div>
  );
}
