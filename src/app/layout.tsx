import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Équatis — Plateforme de coordination immobilière",
    template: "%s · Équatis",
  },
  description:
    "Plateforme privée Équatis pour la coordination des programmes immobiliers, des collaborateurs, des promoteurs, des notaires et des clients.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1B2A4A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="bg-equatis-bg flex min-h-full flex-col text-slate-900">
        <a href="#main" className="skip-link">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
