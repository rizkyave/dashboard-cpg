'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import {
  isConfidentialUnlocked,
  setConfidentialUnlocked,
  CONFIDENTIAL_CHANGE_EVENT,
} from '@/utils/confidentialStorage';
import ConfidentialUnlockModal from './ConfidentialUnlockModal';

interface ConfidentialMaskedValueProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  formatAsCurrency?: boolean;
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  showLockToggle?: boolean;
  blurIntensity?: 'sm' | 'md' | 'lg';
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ConfidentialMaskedValue({
  value,
  prefix = '',
  suffix = '',
  formatAsCurrency = true,
  className = '',
  theme = 'auto',
  showLockToggle = true,
  blurIntensity = 'sm',
  showToast,
}: ConfidentialMaskedValueProps) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setUnlocked(isConfidentialUnlocked());

    const handleConfidentialChange = () => {
      setUnlocked(isConfidentialUnlocked());
    };

    window.addEventListener(CONFIDENTIAL_CHANGE_EVENT, handleConfidentialChange);
    return () => {
      window.removeEventListener(CONFIDENTIAL_CHANGE_EVENT, handleConfidentialChange);
    };
  }, []);

  const formattedValue = React.useMemo(() => {
    if (typeof value === 'number') {
      if (formatAsCurrency) {
        return `Rp ${value.toLocaleString('id-ID')}`;
      }
      return value.toLocaleString('id-ID');
    }
    return String(value);
  }, [value, formatAsCurrency]);

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unlocked) {
      setConfidentialUnlocked(false);
      showToast?.('Nilai confidential telah disensor / dikunci kembali.', 'info');
    } else {
      setIsModalOpen(true);
    }
  };

  // Theme styling for dark floating black boxes vs light cards
  const isDark = theme === 'dark';

  return (
    <>
      <span className={`inline-flex items-center gap-1.5 font-mono select-none ${className}`}>
        {prefix}
        {unlocked ? (
          <span className="transition-all duration-200">
            {formattedValue}
            {suffix}
          </span>
        ) : (
          <span
            className={`tracking-widest transition-all duration-200 relative group/mask cursor-pointer ${
              blurIntensity === 'lg' ? 'blur-xs' : 'blur-[2px]'
            } ${isDark ? 'text-white/80' : 'text-muted-foreground'}`}
            title="Nilai disensor untuk kerahasiaan. Klik gembok untuk membuka."
            onClick={handleToggleLock}
          >
            Rp ••••••••••
          </span>
        )}

        {showLockToggle && (
          <button
            type="button"
            onClick={handleToggleLock}
            className={`p-1 rounded-md transition cursor-pointer inline-flex items-center gap-1 text-[10px] font-sans font-bold leading-none ${
              unlocked
                ? isDark
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600'
                : isDark
                ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-300'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600'
            }`}
            title={unlocked ? 'Kunci kembali nilai confidential' : 'Buka nilai confidential dengan password'}
          >
            {unlocked ? (
              <>
                <Unlock className="size-2.5" />
                <span className="hidden sm:inline">Kunci</span>
              </>
            ) : (
              <>
                <Lock className="size-2.5" />
                <span className="hidden sm:inline">Buka</span>
              </>
            )}
          </button>
        )}
      </span>

      {/* MODAL OTORISASI */}
      <ConfidentialUnlockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        showToast={showToast}
      />
    </>
  );
}

