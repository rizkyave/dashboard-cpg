import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "CPG Procurement Command Center - PT Cindara Pratama Lines",
  description: "Procurement Command Center & Fleet Logistic Monitoring for PT Cindara Pratama Lines & Group (Somber - Balikpapan)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-[#050811] text-slate-100 antialiased selection:bg-cyan-500 selection:text-white flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
