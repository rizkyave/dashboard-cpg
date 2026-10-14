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
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-4xl font-extrabold text-foreground">500</h1>
        <h2 className="text-lg font-semibold text-muted-foreground">Terjadi Kendala Sistem</h2>
        <p className="text-xs text-muted-foreground">
          Terjadi kesalahan saat memproses data. Anda dapat mencoba memuat ulang halaman.
        </p>
        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition cursor-pointer"
          >
            Muat Ulang
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs transition"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

