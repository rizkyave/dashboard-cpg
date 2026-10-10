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
    item.picPch,
    item.noTtb,
    item.tglTtb,
    item.picTtb,
    item.qtyTTB,
    item.picLap,
    item.tglBarangDiantar,
    item.tglTimLapKePicTtb,
    item.noSpp,
    item.tglKeKeuangan,
    item.statusBadge,
    item.status,
    item.selisih,
    item.statusCheckFpb,
    item.doneCheckFpb,
  ]);

  const tooltipText = React.useMemo(() => {
    const header = `Alur Tanggung Jawab Fisik & PIC: ${result.summaryBadge}\n`;
    const details = result.stages
      .map(
        (s) =>
          `${s.stepNumber}. ${s.name} (${s.code}): ${s.isPassed ? '✓ ' + s.statusText : '○ ' + s.statusText} [${s.detail}]`
      )
      .join('\n');
    return header + details + (onClick ? '\n\n(Klik untuk membuka Audit Rinci 5 Divisi)' : '');
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
                  stage.isPassed ? '✓ ' + stage.statusText : '○ Belum Lengkap'
                } [${stage.detail}]`}
              >
                {/* 3D Glass LED Spherical Indicator */}
                <div
                  className="relative flex items-center justify-center rounded-full transition-all duration-300 size-10 sm:size-11 md:size-12"
                  style={{
                    background: stage.isPassed
                      ? `radial-gradient(circle at 36% 30%, ${stage.lightColor} 0%, ${stage.baseColor} 55%, ${stage.deepColor} 100%)`
                      : 'radial-gradient(circle at 36% 30%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)',
                    boxShadow: stage.isPassed
                      ? `0 0 18px ${stage.glowColor}, 0 0 34px ${stage.glowColor}66, inset 0 2.5px 4px rgba(255,255,255,0.85), inset 0 -3px 6px rgba(0,0,0,0.28)`
                      : 'inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 5px rgba(71,85,105,0.35)',
                    border: stage.isPassed
                      ? '2px solid rgba(255, 255, 255, 0.75)'
                      : '2px solid rgba(203, 213, 225, 0.85)',
                  }}
                >
                  {/* Glass Specular Glare (Top-Left Highlight Crescent) */}
                  <span
                    className="absolute top-1 left-1.5 sm:top-1.5 sm:left-2 w-3.5 h-1.5 sm:w-4 sm:h-2 rounded-full pointer-events-none"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.2))',
                      transform: 'rotate(-25deg)',
                    }}
                  />

                  {/* Glass Specular Dot */}
                  <span className="absolute top-1 left-2 size-1 rounded-full bg-white/95 pointer-events-none" />

                  {/* Core Inner Luminescence */}
                  {stage.isPassed && (
                    <span
                      className="size-3.5 sm:size-4 rounded-full blur-[2px] opacity-75 pointer-events-none"
                      style={{ background: stage.lightColor }}
                    />
                  )}
                </div>

                {/* Division Acronym Label */}
                <span
                  className="text-xs sm:text-[13px] font-bold font-mono tracking-wider transition-colors"
                  style={{
                    color: stage.isPassed ? stage.deepColor : '#64748b',
                  }}
                >
                  {stage.code}
                </span>
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
                5/5 Lengkap
              </span>
            ) : result.passedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-[#fef3c7]/85 dark:bg-amber-950/40 text-stone-700 dark:text-stone-300 border border-[#fde68a] dark:border-amber-800/60 shadow-xs">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                {result.passedCount}/5 Sebagian
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 shadow-xs">
                0/5 Menunggu
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
      className={`inline-flex flex-col items-center justify-center gap-1 select-none ${
        onClick ? 'cursor-pointer group/light hover:opacity-95' : ''
      } ${className}`}
    >
      {/* Light-Themed Mini Traffic Light Pod */}
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-zinc-700 shadow-xs shadow-amber-500/5 transition-all ${
          onClick ? 'group-hover/light:border-amber-400' : ''
        }`}
      >
        {result.stages.map((stage) => {
          return (
            <div
              key={stage.code}
              className="flex flex-col items-center gap-0.5 min-w-[18px]"
              title={`${stage.stepNumber}. ${stage.name}: ${
                stage.isPassed ? '✓ ' + stage.statusText : '○ Belum Lengkap'
              } (${stage.detail})`}
            >
              {/* Lamp Bulb Indicator */}
              <div
                className="relative flex items-center justify-center rounded-full transition-all duration-300 size-2.5 sm:size-3"
                style={{
                  background: stage.isPassed
                    ? `radial-gradient(circle at 36% 30%, ${stage.lightColor} 0%, ${stage.baseColor} 55%, ${stage.deepColor} 100%)`
                    : 'radial-gradient(circle at 36% 30%, #f8fafc 0%, #cbd5e1 55%, #94a3b8 100%)',
                  boxShadow: stage.isPassed
                    ? `0 0 6px ${stage.glowColor}, inset 0 1px 1.5px rgba(255,255,255,0.85)`
                    : 'inset 0 1px 1.5px rgba(255,255,255,0.7)',
                  border: stage.isPassed
                    ? '1px solid rgba(255, 255, 255, 0.8)'
                    : '1px solid rgba(203, 213, 225, 0.8)',
                }}
              >
                {/* Glare specular dot */}
                {stage.isPassed && (
                  <span className="absolute top-[1px] left-[1px] size-0.5 rounded-full bg-white/90 pointer-events-none" />
                )}
              </div>

              {/* Division Code Label */}
              <span
                className="text-[7.5px] sm:text-[8px] font-mono leading-none tracking-tight transition-colors"
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
        <div className="flex items-center justify-center">
          {result.isComplete ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
              <Check className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              5/5 Lengkap
            </span>
          ) : result.passedCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-[#fef3c7]/90 dark:bg-amber-950/40 text-stone-700 dark:text-stone-300 border border-[#fde68a] dark:border-amber-800/60 whitespace-nowrap">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              {result.passedCount}/5 Sebagian
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono text-muted-foreground bg-muted border border-border whitespace-nowrap">
              0/5 Belum
            </span>
          )}
        </div>
      )}
    </div>
  );
}
