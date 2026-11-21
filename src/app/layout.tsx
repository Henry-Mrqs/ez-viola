import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/ui/navigation";

export const metadata: Metadata = {
  title: "EzViola — Aprenda Violão com Detecção de Áudio em Tempo Real",
  description:
    "Afinador cromático de alta precisão, esteira interativa estilo Yousician e Wait Mode pedagógico 100% no navegador.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-background text-slate-100 flex flex-col antialiased">
        <Navigation />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
