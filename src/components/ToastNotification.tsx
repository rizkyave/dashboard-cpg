'use client';

import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { ToastState } from '@/types/procurement';

interface ToastNotificationProps {
  toast: ToastState;
}

export default function ToastNotification({ toast }: ToastNotificationProps) {
  if (!toast.visible) return null;

  const icons = {
    info: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />,
  };

  const type = toast.type || 'info';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-xl text-xs text-foreground transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 max-w-md font-medium"
    >
      <div>{icons[type]}</div>
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}
