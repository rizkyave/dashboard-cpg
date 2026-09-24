# CPG Procurement Command Center (Next.js + TypeScript + Tailwind CSS)

Dashboard operasional dan monitoring alur rantai pengadaan (*procurement*), alur fisik berkas, serta layanan armada untuk **PT Cindara Pratama Lines & Group (Somber - Balikpapan)**.

## 🚀 Fitur Utama
- **Next.js App Router (TypeScript & Tailwind CSS)**: Arsitektur modern, cepat, dan modular.
- **7 Entitas Resmi CPG**: Filter langsung untuk CPL, PPI, HL, GAJ, MIL, SP, dan SSK.
- **4 Pilar KPI Eksekutif**: Total PO Aktif, Rata-rata Lapse Lapangan, Validasi SPP Keuangan, dan Fulfillment FSTB vs FPB.
- **Grafik Interaktif (Chart.js & React-Chartjs-2)**:
  - Donut Chart sebaran pengadaan per anak usaha
  - Bar Chart milestone alur fisik & titik hambatan (*bottleneck*)
  - Polar Area Chart distribusi lead time / lapse day
  - Horizontal Bar Chart beban kerja PIC
- **Audit Trail Lintas 4 Sheet & Simulasi AI Gemini 3 Flash**: Deteksi berkas kritis (> 5 hari) dan rekomendasi tindakan.
- **Eskalasi Cepat WhatsApp (`wa.me`)**: Pengiriman template chat percepatan dokumen ke PIC aktif.
- **Unggah Excel (`xlsx`) & Ekspor CSV**: Pemrosesan file langsung di peramban tanpa perlu backend database terpisah.
- **Live WITA Clock**: Waktu real-time Balikpapan (UTC+8).

---

## 🛠️ Cara Menjalankan di VS Code

1. Buka folder proyek ini di **Visual Studio Code**:
   ```bash
   code .
   ```

2. Buka Terminal terintegrasi di VS Code (`Ctrl + ~` atau `Ctrl + \``).

3. Jalankan server pengembangan (*Development Server*):
   ```bash
   npm run dev
   ```

4. Buka peramban Anda di [http://localhost:3000](http://localhost:3000).

5. Untuk melakukan build produksi:
   ```bash
   npm run build
   npm start
   ```

---

## 📂 Struktur Direktori Proyek

```
Dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css         # Styling global Tailwind & scrollbar
│   │   ├── layout.tsx          # Root layout & font Google (Inter, JetBrains Mono)
│   │   └── page.tsx            # Halaman utama aplikasi (State management & filter)
│   ├── components/
│   │   ├── Header.tsx          # Navigasi atas, jam WITA, search, import Excel, export CSV
│   │   ├── EntityFilterBar.tsx # Filter pil 7 entitas anak usaha CPG
│   │   ├── KpiCards.tsx        # 4 kartu ringkasan eksekutif
│   │   ├── TabsNav.tsx         # Switcher tab & dropdown filter lapse day
│   │   ├── Charts.tsx          # Komponen Chart.js terdaftar
│   │   ├── OverviewTab.tsx     # Tab 1: Dashboard Eksekutif & Antrian Berkas
│   │   ├── ProcurementTab.tsx  # Tab 2: Monitoring Sheet 1 & PIC Matrix
│   │   ├── ArmadaTab.tsx       # Tab 3: Monitoring Sheet 2 Qty FPB vs FSTB
│   │   ├── AnalyticsTab.tsx    # Tab 4: SLA Audit & Beban Kerja PIC
│   │   ├── AuditModal.tsx      # Modal audit lintas 4 sheet & Gemini AI
│   │   ├── NewRecordModal.tsx  # Modal form tambah berkas PO baru
│   │   └── ToastNotification.tsx # Notifikasi toast mengambang
│   ├── data/
│   │   └── initialData.ts      # Dataset awal pengadaan CPG & entitas
│   └── types/
│       └── procurement.ts      # Definisi interface TypeScript
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```
