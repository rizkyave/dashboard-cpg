'use client';

import React from 'react';
import { Check } from 'lucide-react';
import {
  evaluateFiveDivisionWorkflow,
  EvaluatableItem,
  FiveDivisionWorkflowResult,
  DivisionStageLight,
} from '@/utils/statusWorkflow';

export interface WorkflowTrafficLightProps {
  item: EvaluatableItem;
  onClick?: () => void;
  showBadge?: boolean;
  compact?: boolean;
  variant?: 'prominent' | 'compact' | 'mini';
  className?: string;
}

export default function WorkflowTrafficLight({
  item,
  onClick,
  showBadge = true,
  compact = false,
  variant,
  className = '',
}: WorkflowTrafficLightProps) {
  // Determine effective variant
  const effectiveVariant = variant || (compact ? 'compact' : 'compact');

  const result: FiveDivisionWorkflowResult = React.useMemo(() => {
    return evaluateFiveDivisionWorkflow(item);
  }, [
    item.fpb,
    item.po,
    item.noPo,
    item.tglPo,
    item.date,
    item.picPch,
    item.deliveryTime,
    item.noFstb,
    item.noTtb,
    item.tglTtb,
    item.picTtb,
    item.qtyTTB,
    item.picLap,
    item.tglBarangDiantar,
    item.tglDiantar,
    item.tglKeTimLapangan,
    item.tglTimLapKePicTtb,
    item.tglTtbKePicPch,
    item.picAdm,
    item.noSpp,
    item.tglSpp,
    item.tglInputSpp,
    item.tglKeKeuangan,
    item.receivedBy,
    item.approvedBy,
    item.statusBadge,
    item.status,
    item.selisih,
    item.statusCheckFpb,
    item.doneCheckFpb,
  ]);

  const tooltipText = React.useMemo(() => {
    const header = `Alur Tanggung Jawab & PIC (6 Seksi): ${result.summaryBadge}\n`;
    const details = result.stages
      .map((s) => {
        const symbol = s.isFull ? '✓' : s.isPartial ? '◐' : '○';
        const mode = s.isFull ? 'Lengkap' : s.isPartial ? 'Menyala Setengah (Data Belum Penuh)' : 'Belum Lengkap';
        return `${s.stepNumber}. ${s.name} (${s.code}): ${symbol} [${mode}] ${s.statusText} [${s.detail}]`;
      })
      .join('\n');
    return header + details + (onClick ? '\n\n(Klik untuk membuka Audit Rinci 6 Seksi)' : '');
  }, [result, onClick]);

  // Render PROMINENT variant (Center-top centerpiece in Audit Modal)
  if (effectiveVariant === 'prominent') {
    return (
      <div
        onClick={onClick}
        title={tooltipText}
        className={`inline-flex flex-col items-center justify-center select-none ${
          onClick ? 'cursor-pointer group/prominent hover:scale-[1.01] transition-transform' : ''
        } ${className}`}
      >
        {/* Prominent White/Cream Housing Container */}
        <div className="relative flex items-center justify-center gap-3.5 sm:gap-5 md:gap-6 px-5 sm:px-7 md:px-8 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-card border border-amber-200/90 dark:border-border shadow-[0_6px_25px_rgba(245,158,11,0.12),0_2px_6px_rgba(0,0,0,0.04)] dark:shadow-none transition-all">
          {result.stages.map((stage: DivisionStageLight) => {
            return (
              <div
                key={stage.code}
                className="flex flex-col items-center gap-1.5 group/bulb"
                title={`${stage.stepNumber}. ${stage.name} (${stage.code}): ${
                  stage.isFull
                    ? '✓ ' + stage.statusText + ' (Penuh)'
                    : stage.isPartial
                    ? '◐ ' + stage.statusText + ' (Menyala Setengah - Data Belum Penuh)'
                    : '○ Belum Lengkap'
                } [${stage.detail}]`}
              >
                {/* 3D Glass LED Spherical Indicator */}
                <div
                  className="relative flex items-center justify-center rounded-full overflow-hidden transition-all duration-300 size-10 sm:size-11 md:size-12"
                  style={{
                    background: stage.isFull
                      ? `radial-gradient(circle at 36% 30%, ${stage.lightColor} 0%, ${stage.baseColor} 55%, ${stage.deepColor} 100%)`
                      : !stage.isPassed
                      ? 'radial-gradient(circle at 36% 30%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)'
                      : undefined,
                    boxShadow: stage.isFull
                      ? `0 0 18px ${stage.glowColor}, 0 0 34px ${stage.glowColor}66, inset 0 2.5px 4px rgba(255,255,255,0.85), inset 0 -3px 6px rgba(0,0,0,0.28)`
                      : stage.isPartial
                      ? `0 0 14px ${stage.glowColor}bb, 0 0 24px ${stage.glowColor}55, inset 0 2.5px 4px rgba(255,255,255,0.85), inset 0 -3px 6px rgba(0,0,0,0.28)`
                      : 'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 5px rgba(71,85,105,0.35)',
                    border: stage.isPassed
                      ? '2px solid rgba(255, 255, 255, 0.85)'
                      : '2px solid rgba(203, 213, 225, 0.85)',
                  }}
                >
                  {/* Split visual for Half-Lit (Menyala Setengah: Kiri Hidup, Kanan Mati) */}
                  {stage.isPartial && (
                    <>
                      {/* Left half lit */}
                      <div
                        className="absolute inset-y-0 left-0 w-1/2"
                        style={{
                          background: `radial-gradient(circle at 45% 30%, ${stage.lightColor} 0%, ${stage.baseColor} 55%, ${stage.deepColor} 100%)`,
                        }}
                      />
                      {/* Right half unlit grey */}
                      <div
                        className="absolute inset-y-0 right-0 w-1/2"
                        style={{
                          background: 'radial-gradient(circle at 55% 30%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)',
                        }}
                      />
                      {/* Subtle vertical center seam */}
                      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-black/15 dark:bg-white/15 z-10 pointer-events-none" />
                    </>
                  )}

                  {/* Glass Specular Glare (Top-Left Highlight Crescent) */}
                  <span
                    className="absolute top-1 left-1.5 sm:top-1.5 sm:left-2 w-3.5 h-1.5 sm:w-4 sm:h-2 rounded-full pointer-events-none z-20"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.2))',
                      transform: 'rotate(-25deg)',
                    }}
                  />

                  {/* Glass Specular Dot */}
                  <span className="absolute top-1 left-2 size-1 rounded-full bg-white/95 pointer-events-none z-20" />

                  {/* Core Inner Luminescence */}
                  {stage.isFull && (
                    <span
                      className="size-3.5 sm:size-4 rounded-full blur-[2px] opacity-75 pointer-events-none z-10"
                      style={{ background: stage.lightColor }}
                    />
                  )}
                  {stage.isPartial && (
                    <span
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-2.5 sm:size-3 rounded-full blur-[1.5px] opacity-80 pointer-events-none z-10"
                      style={{ background: stage.lightColor }}
                    />
                  )}
                </div>

                {/* Division Acronym Label */}
                <div className="flex items-center justify-center gap-0.5">
                  <span
                    className="text-xs sm:text-[13px] font-bold font-mono tracking-wider transition-colors"
                    style={{
                      color: stage.isPassed ? stage.deepColor : '#64748b',
                    }}
                  >
                    {stage.code}
                  </span>
                  {stage.isPartial && (
                    <span
                      className="text-[9px] font-mono font-bold leading-none px-0.5 rounded text-amber-600 dark:text-amber-400"
                      title="Menyala Setengah (Data Belum Penuh)"
                    >
                      ◐
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Small Text Badge below the prominent indicator */}
        {showBadge && (
          <div className="mt-2 flex items-center justify-center">
            {result.isComplete ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700 shadow-xs">
                <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                6/6 Lengkap
              </span>
            ) : result.passedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-[#fef3c7]/85 dark:bg-amber-950/40 text-stone-700 dark:text-stone-300 border border-[#fde68a] dark:border-amber-800/60 shadow-xs">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                {result.fullCount > 0 ? `${result.fullCount} Penuh` : ''}
                {result.fullCount > 0 && result.partialCount > 0 ? ', ' : ''}
                {result.partialCount > 0 ? `${result.partialCount} Setengah (Belum Penuh)` : `${result.passedCount}/6 Sebagian`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 shadow-xs">
                0/6 Menunggu
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render COMPACT / MINI variant (Used in section headers and table cells)
  return (
    <div
      onClick={onClick}
      title={tooltipText}
      className={`inline-flex flex-col items-center justify-center gap-1 select-none text-center ${
        onClick ? 'cursor-pointer group/light hover:opacity-95' : ''
      } ${className}`}
    >
      {/* Light-Themed Mini Traffic Light Pod */}
      <div
        className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-zinc-700 shadow-xs shadow-amber-500/5 transition-all text-center ${
          onClick ? 'group-hover/light:border-amber-400' : ''
        }`}
      >
        {result.stages.map((stage) => {
          return (
            <div
              key={stage.code}
              className="flex flex-col items-center justify-center text-center gap-1 w-5 sm:w-5.5 shrink-0"
              title={`${stage.stepNumber}. ${stage.name} (${stage.code}): ${
                stage.isFull
                  ? '✓ ' + stage.statusText + ' (Penuh)'
                  : stage.isPartial
                  ? '◐ ' + stage.statusText + ' (Menyala Setengah - Data Belum Penuh)'
                  : '○ Belum Lengkap'
              } [${stage.detail}]`}
            >
              {/* Lamp Bulb Indicator */}
              <div
                className="relative flex items-center justify-center mx-auto rounded-full overflow-hidden transition-all duration-300 size-2.5 sm:size-3 shrink-0"
                style={{
                  background: stage.isFull
                    ? `radial-gradient(circle at 36% 30%, ${stage.lightColor} 0%, ${stage.baseColor} 55%, ${stage.deepColor} 100%)`
                    : !stage.isPassed
                    ? 'radial-gradient(circle at 36% 30%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)'
                    : undefined,
                  boxShadow: stage.isFull
                    ? `0 0 6px ${stage.glowColor}, inset 0 1px 1.5px rgba(255,255,255,0.85)`
                    : stage.isPartial
                    ? `0 0 4.5px ${stage.glowColor}bb, inset 0 1px 1.5px rgba(255,255,255,0.85)`
                    : 'inset 0 1px 1.5px rgba(255,255,255,0.7)',
                  border: stage.isPassed
                    ? '1px solid rgba(255, 255, 255, 0.8)'
                    : '1px solid rgba(203, 213, 225, 0.8)',
                }}
              >
                {/* Split visual for Half-Lit (Menyala Setengah) */}
                {stage.isPartial && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 w-1/2"
                      style={{
                        background: `linear-gradient(135deg, ${stage.lightColor} 0%, ${stage.baseColor} 100%)`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 w-1/2"
                      style={{
                        background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
                      }}
                    />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[0.5px] bg-black/20 dark:bg-white/20 z-10 pointer-events-none" />
                  </>
                )}

                {/* Glare specular dot */}
                {stage.isPassed && (
                  <span className="absolute top-[0.5px] left-[0.5px] size-0.5 rounded-full bg-white/95 pointer-events-none z-20" />
                )}
              </div>

              {/* Division Code Label */}
              <span
                className="text-[7.5px] sm:text-[8px] font-mono leading-none tracking-tight transition-colors text-center block w-full"
                style={{
                  color: stage.isPassed ? stage.deepColor : '#94a3b8',
                  fontWeight: stage.isPassed ? 700 : 500,
                }}
              >
                {stage.code}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary Badge below the Traffic Light */}
      {showBadge && (
        <div className="flex items-center justify-center w-full mx-auto">
          {result.isComplete ? (
            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap mx-auto">
              <Check className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              6/6 Lengkap
            </span>
          ) : result.passedCount > 0 ? (
            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-medium bg-[#fef3c7]/90 dark:bg-amber-950/40 text-stone-700 dark:text-stone-300 border border-[#fde68a] dark:border-amber-800/60 whitespace-nowrap mx-auto">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              {result.fullCount > 0 && result.partialCount > 0
                ? `${result.fullCount}P / ${result.partialCount}S`
                : `${result.passedCount}/6 ${result.partialCount > 0 ? 'Parsial' : 'Sebagian'}`}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono text-muted-foreground bg-muted border border-border whitespace-nowrap mx-auto">
              0/6 Belum
            </span>
          )}
        </div>
      )}
    </div>
  );
}
