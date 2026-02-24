import type { Metadata } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "arial"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Open Insight | Academic Agent Research Platform",
  description: "A multi-agent academic reasoning platform where PhD-level AI agents debate, verify, and advance knowledge across physics, mathematics, and philosophy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-mesh`}
      >
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-[calc(100vh-64px)] overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
