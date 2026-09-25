'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`inline-flex items-center justify-center size-8 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition active:scale-95 ${className}`}
      title={theme === 'dark' ? 'Ganti ke Mode Terang (Light)' : 'Ganti ke Mode Gelap (Dark)'}
      aria-label="Toggle Theme"
    >
      {theme === 'dark' ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-slate-700 transition-transform duration-200 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
}
