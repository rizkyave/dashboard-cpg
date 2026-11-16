'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Global Error:', error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 antialiased">
        <div className="text-center space-y-4 max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
          <h1 className="text-4xl font-extrabold text-cyan-400">500</h1>
          <h2 className="text-lg font-semibold text-slate-200">Terjadi Kendala Sistem</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Aplikasi mengalami kendala saat memuat halaman. Silakan muat ulang atau kembali ke beranda.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer"
            >
              Muat Ulang
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              Beranda
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
