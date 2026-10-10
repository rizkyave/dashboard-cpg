'use client';

import React from 'react';
import { Check } from 'lucide-react';
import {
  evaluateFiveDivisionWorkflow,
  EvaluatableItem,
  FiveDivisionWorkflowResult,
} from '@/utils/statusWorkflow';

interface WorkflowTrafficLightProps {
  item: EvaluatableItem;
  onClick?: () => void;
  showBadge?: boolean;
  compact?: boolean;
  className?: string;
}

export default function WorkflowTrafficLight({
  item,
  onClick,
  showBadge = true,
  compact = false,
  className = '',
}: WorkflowTrafficLightProps) {
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
    item.picLap,
    item.tglBarangDiantar,
    item.tglTimLapKePicTtb,
    item.noSpp,
    item.tglKeKeuangan,
    item.statusBadge,
    item.status,
    item.selisih,
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

  return (
    <div
      onClick={onClick}
      title={tooltipText}
      className={`inline-flex flex-col items-center justify-center gap-1 select-none ${
        onClick ? 'cursor-pointer group/light hover:opacity-95' : ''
      } ${className}`}
    >
      {/* Cockpit Traffic Light Pod */}
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/95 dark:bg-black/90 border border-zinc-700/60 dark:border-zinc-800 shadow-xs shadow-black/30 transition-all ${
          onClick ? 'group-hover/light:border-zinc-500 group-hover/light:shadow-sm' : ''
        } ${compact ? 'gap-1 px-1.5 py-0.5' : ''}`}
      >
        {result.stages.map((stage) => {
          return (
            <div
              key={stage.code}
              className="flex flex-col items-center gap-0.5 min-w-[20px]"
              title={`${stage.stepNumber}. ${stage.name}: ${stage.isPassed ? '✓ ' + stage.statusText : '○ Belum Lengkap'} (${stage.detail})`}
            >
              {/* Lamp Bulb Indicator */}
              <div
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                  compact ? 'size-2' : 'size-2.5'
                } ${
                  stage.isPassed
                    ? stage.activeBulbClass
                    : 'bg-zinc-800/90 border border-zinc-700/40 opacity-25 shadow-inner'
                }`}
              >
                {/* Glare / Specular highlight when illuminated */}
                {stage.isPassed && (
                  <span className="absolute top-[1px] left-[1px] size-1 rounded-full bg-white/70 pointer-events-none" />
                )}
              </div>

              {/* Division Code Label */}
              <span
                className={`text-[8.5px] font-mono leading-none tracking-tight transition-colors ${
                  stage.isPassed
                    ? stage.activeTextClass
                    : 'text-zinc-600 dark:text-zinc-600 font-normal'
                } ${compact ? 'text-[7.5px]' : ''}`}
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
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 whitespace-nowrap">
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

