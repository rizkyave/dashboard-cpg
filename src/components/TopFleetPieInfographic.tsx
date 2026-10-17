'use client';

import React, { useState } from 'react';
import {
  PieChart as PieIcon,
  Ship,
  Building,
  Anchor,
  Box,
  TrendingUp,
  Sparkles,
  Info,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

export interface FleetPieItem {
  rank: number;
  name: string;
  fpb: number;
  pct: string;
  hex: string;
  gradFrom: string;
  gradTo: string;
  radius: number;
  icon: string;
  type: string;
}

// Default Data Top 12 Armada Periode Oktober 2026
export const DEFAULT_TOP_12_FLEET: FleetPieItem[] = [
  { rank: 1, name: 'OFFICE GAJ', fpb: 249, pct: '26.7%', hex: '#F43F5E', gradFrom: '#FB7185', gradTo: '#BE123C', radius: 248, icon: '🏢', type: 'Office' },
  { rank: 2, name: 'SPOB SEA LION', fpb: 107, pct: '11.5%', hex: '#A855F7', gradFrom: '#C084FC', gradTo: '#7E22CE', radius: 238, icon: '🚢', type: 'SPOB' },
  { rank: 3, name: 'SITE PAGATAN', fpb: 88, pct: '9.4%', hex: '#6366F1', gradFrom: '#818CF8', gradTo: '#4338CA', radius: 232, icon: '⚓', type: 'Site' },
  { rank: 4, name: 'SPOB FERY 471', fpb: 79, pct: '8.5%', hex: '#3B82F6', gradFrom: '#60A5FA', gradTo: '#1D4ED8', radius: 228, icon: '🚢', type: 'SPOB' },
  { rank: 5, name: 'SV TWINSISTER 307', fpb: 77, pct: '8.3%', hex: '#06B6D4', gradFrom: '#22D3EE', gradTo: '#0E7490', radius: 226, icon: '🛳️', type: 'SV' },
  { rank: 6, name: 'TB PMI ABADI', fpb: 56, pct: '6.0%', hex: '#10B981', gradFrom: '#34D399', gradTo: '#047857', radius: 220, icon: '⛴️', type: 'TB' },
  { rank: 7, name: 'DEPT. PROCUREMENT', fpb: 50, pct: '5.4%', hex: '#22C55E', gradFrom: '#4ADE80', gradTo: '#15803D', radius: 216, icon: '📦', type: 'Dept' },
  { rank: 8, name: 'SPOB OCEAN MANDAR', fpb: 47, pct: '5.0%', hex: '#84CC16', gradFrom: '#A3E635', gradTo: '#4D7C0F', radius: 214, icon: '🚢', type: 'SPOB' },
  { rank: 9, name: 'HEAD OFFICE', fpb: 42, pct: '4.5%', hex: '#EAB308', gradFrom: '#FDE047', gradTo: '#A16207', radius: 212, icon: '🏢', type: 'Office' },
  { rank: 10, name: 'UB CMPL 01', fpb: 40, pct: '4.3%', hex: '#F59E0B', gradFrom: '#FBBF24', gradTo: '#B45309', radius: 210, icon: '🛳️', type: 'UB' },
  { rank: 11, name: 'TK COASTWAY 1803', fpb: 37, pct: '4.0%', hex: '#F97316', gradFrom: '#FB923C', gradTo: '#C2410C', radius: 208, icon: '⛴️', type: 'TK' },
  { rank: 12, name: 'SV TWINSISTER 306', fpb: 35, pct: '3.8%', gradFrom: '#F87171', gradTo: '#B91C1C', hex: '#EF4444', radius: 206, icon: '🛳️', type: 'SV' },
];

export default function TopFleetPieInfographic({
  items = DEFAULT_TOP_12_FLEET,
  totalFpb = 932,
  onSelectFleet,
}: {
  items?: FleetPieItem[];
  totalFpb?: number;
  onSelectFleet?: (name: string) => void;
}) {
  const [activeItem, setActiveItem] = useState<FleetPieItem | null>(null);

  const cx = 400;
  const cy = 340;
  const innerRadius = 105;
  const sumTopFpb = items.reduce((acc, cur) => acc + cur.fpb, 0);

  // Helper konversi polar ke cartesian
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Kalkulasi koordinat irisan lingkaran
  let currentAngle = -90; // Mulai dari arah jam 12
  const slices = items.map((item, idx) => {
    const sliceAngle = (item.fpb / sumTopFpb) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;
    currentAngle = endAngle;

    const r = item.radius;
    const isHovered = activeItem?.name === item.name;
    const effectiveRadius = isHovered ? r + 8 : r;

    const startOuter = polarToCartesian(cx, cy, effectiveRadius, startAngle);
    const endOuter = polarToCartesian(cx, cy, effectiveRadius, endAngle);
    const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
    const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);

    const largeArcFlag = sliceAngle <= 180 ? '0' : '1';

    const pathD = [
      'M', startOuter.x, startOuter.y,
      'A', effectiveRadius, effectiveRadius, 0, largeArcFlag, 1, endOuter.x, endOuter.y,
      'L', endInner.x, endInner.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 0, startInner.x, startInner.y,
      'Z',
    ].join(' ');

    // Callout lines
    const calloutRadius = effectiveRadius + 8;
    const elbowRadius = effectiveRadius + 28;
    const startPt = polarToCartesian(cx, cy, calloutRadius, midAngle);
    const elbowPt = polarToCartesian(cx, cy, elbowRadius, midAngle);

    const isRightSide = midAngle > -90 && midAngle < 90;
    const labelX = isRightSide ? elbowPt.x + 36 : elbowPt.x - 36;
    const textAnchor: 'start' | 'end' = isRightSide ? 'start' : 'end';

    const iconPos = polarToCartesian(cx, cy, (effectiveRadius + innerRadius) / 2, midAngle);

    return {
      item,
      pathD,
      startPt,
      elbowPt,
      labelX,
      textAnchor,
      isRightSide,
      iconPos,
      showIcon: sliceAngle > 18,
      gradId: `grad-top12-${idx}`,
    };
  });

  return (
    <div className="bg-slate-950 text-slate-100 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl transition">
      {/* Background Ambience Glow */}
      <div className="absolute -top-24 -left-24 size-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 size-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Infografis */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-teal-400 text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
            <Sparkles className="size-3 text-teal-400 animate-pulse" />
            <span>Infografis Visualisasi Data 3D</span>
          </div>
          <h3 className="text-base sm:text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight">
            12 ARMADA DENGAN PERMINTAAN FPB TERBANYAK
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Periode: <strong className="text-teal-300">Oktober 2026</strong> • Total Permintaan: <strong className="text-white">{totalFpb} FPB</strong>
          </p>
        </div>

        {/* Info Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2 shadow-inner">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Top 12: <strong className="text-white">{sumTopFpb} FPB</strong> ({((sumTopFpb / totalFpb) * 100).toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Main 3D Pie SVG Container */}
      <div className="relative w-full aspect-[800/660] max-h-[620px] flex items-center justify-center my-2 z-10">
        <svg viewBox="0 0 800 660" className="w-full h-full select-none overflow-visible">
          <defs>
            {/* Dynamic Gradients */}
            {items.map((it, idx) => (
              <linearGradient key={`grad-${idx}`} id={`grad-top12-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color={it.gradFrom} />
                <stop offset="100%" stop-color={it.gradTo} />
              </linearGradient>
            ))}

            {/* 3D Center Hub Gradients & Shading */}
            <radialGradient id="hubRadial" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="55%" stop-color="#F1F5F9" />
              <stop offset="100%" stop-color="#CBD5E1" />
            </radialGradient>
            <linearGradient id="hubBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#64748B" stop-opacity="0.6" />
            </linearGradient>
            <filter id="hubShadowFilter" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.7" />
              <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
            </filter>
            <filter id="sliceGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.45" />
            </filter>
          </defs>

          {/* Slices Group */}
          <g filter="url(#sliceGlowFilter)">
            {slices.map(({ item, pathD, gradId, showIcon, iconPos }) => {
              const isHovered = activeItem?.name === item.name;
              return (
                <g key={item.name} className="cursor-pointer transition-all duration-300">
                  <path
                    d={pathD}
                    fill={`url(#${gradId})`}
                    stroke="#0b1120"
                    strokeWidth={isHovered ? '3' : '2'}
                    className="transition-all duration-300 hover:brightness-110"
                    onMouseEnter={() => setActiveItem(item)}
                    onMouseLeave={() => setActiveItem(null)}
                    onClick={() => onSelectFleet && onSelectFleet(item.name)}
                  />
                  {showIcon && (
                    <text
                      x={iconPos.x}
                      y={iconPos.y + 5}
                      textAnchor="middle"
                      fontSize="14"
                      pointerEvents="none"
                      className="select-none"
                    >
                      {item.icon}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Callout Lines & Outer Badges */}
          <g>
            {slices.map(({ item, startPt, elbowPt, labelX, textAnchor, isRightSide }) => {
              const isHovered = activeItem?.name === item.name;
              return (
                <g
                  key={`callout-${item.name}`}
                  className="transition-opacity duration-200 cursor-pointer"
                  opacity={activeItem && !isHovered ? 0.35 : 1}
                  onMouseEnter={() => setActiveItem(item)}
                  onMouseLeave={() => setActiveItem(null)}
                  onClick={() => onSelectFleet && onSelectFleet(item.name)}
                >
                  <polyline
                    points={`${startPt.x},${startPt.y} ${elbowPt.x},${elbowPt.y} ${labelX},${elbowPt.y}`}
                    fill="none"
                    stroke={item.hex}
                    strokeWidth={isHovered ? '2' : '1.5'}
                    strokeDasharray={isHovered ? 'none' : '3,3'}
                    opacity={0.85}
                  />
                  <circle cx={startPt.x} cy={startPt.y} r={isHovered ? '3.5' : '2.5'} fill={item.hex} />
                  
                  {/* Outer Label: Rank & Vessel Name */}
                  <text
                    x={labelX + (isRightSide ? 4 : -4)}
                    y={elbowPt.y - 3}
                    textAnchor={textAnchor}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#F8FAFC"
                  >
                    #{item.rank} {item.name}
                  </text>

                  {/* Outer Label: Count & Percentage */}
                  <text
                    x={labelX + (isRightSide ? 4 : -4)}
                    y={elbowPt.y + 11}
                    textAnchor={textAnchor}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={item.hex}
                  >
                    {item.fpb} FPB ({item.pct})
                  </text>
                </g>
              );
            })}
          </g>

          {/* 3D Center Hub */}
          <g id="centerHub" className="cursor-pointer select-none">
            <circle cx={cx} cy={cy} r="98" fill="#0b1120" opacity="0.6" filter="url(#hubShadowFilter)" />
            <circle cx={cx} cy={cy} r="92" fill="url(#hubBevelGrad)" stroke="#475569" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="86" fill="url(#hubRadial)" />
            <circle cx={cx} cy={cy} r="82" fill="none" stroke="#E2E8F0" strokeWidth="2" opacity="0.85" />

            <text x={cx} y={cy - 22} textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="monospace" fill="#64748B" letterSpacing="2">
              TOTAL FPB
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#0F172A">
              {totalFpb}
            </text>
            <text x={cx} y={cy + 38} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0284C7" letterSpacing="1">
              • OKTOBER 2026 •
            </text>
          </g>
        </svg>

        {/* Hover Popover Modal Overlay */}
        {activeItem && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white border border-slate-700 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className="size-8 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${activeItem.hex}25`, border: `1px solid ${activeItem.hex}` }}>
              <span>{activeItem.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-white">#{activeItem.rank} {activeItem.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {activeItem.type}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                Jumlah: <strong className="text-white">{activeItem.fpb} FPB</strong> • Proporsi: <strong style={{ color: activeItem.hex }}>{activeItem.pct}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom 12-Fleets Color-Coded Legend */}
      <div className="mt-2 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2 text-xs text-slate-400 font-mono">
          <span className="font-bold text-slate-300">Legenda 12 Armada Teratas</span>
          <span>Klik armada untuk memfilter</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {items.map((it) => {
            const isHovered = activeItem?.name === it.name;
            return (
              <div
                key={it.name}
                onMouseEnter={() => setActiveItem(it)}
                onMouseLeave={() => setActiveItem(null)}
                onClick={() => onSelectFleet && onSelectFleet(it.name)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer ${
                  isHovered
                    ? 'bg-slate-800 border-slate-600 shadow-md scale-[1.02]'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80'
                }`}
              >
                <span className="size-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: it.hex }} />
                <div className="min-w-0 flex-1 truncate">
                  <div className="text-[11px] font-bold text-slate-200 truncate flex items-center gap-1">
                    <span>{it.icon}</span>
                    <span className="truncate">{it.name}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    <span className="text-white font-bold">{it.fpb}</span> FPB <span className="text-teal-400">({it.pct})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

