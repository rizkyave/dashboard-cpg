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
    info: <Info className="w-5 h-5 text-cyan-400" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
  };

  const borderStyles = {
    info: 'border-cyan-500/50',
    success: 'border-emerald-500/50',
    warning: 'border-amber-500/50',
    error: 'border-rose-500/50',
  };

  const type = toast.type || 'info';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border ${borderStyles[type]} shadow-2xl text-xs text-white transition-all duration-300 animate-in fade-in slide-in-from-bottom-5`}
    >
      <div>{icons[type]}</div>
      <span>{toast.message}</span>
    </div>
  );
}
