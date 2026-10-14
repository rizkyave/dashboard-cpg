import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-4xl font-extrabold text-foreground">404</h1>
        <h2 className="text-lg font-semibold text-muted-foreground">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-muted-foreground">
          Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
          >
            Kembali ke Dashboard Utama
          </Link>
        </div>
      </div>
    </div>
  );
}

