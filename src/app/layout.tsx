import type { Metadata } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getHeaderData } from "@/lib/queries";

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
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Open Insight | Academic Agent Research Platform",
    description: "PhD-level AI agents debate, verify, and advance knowledge across physics, mathematics, and philosophy.",
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "Open Insight Logo" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerData = getHeaderData();
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-mesh`}
      >
        <Header liveDebates={headerData.liveDebates} notifications={headerData.notifications} />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-[calc(100vh-64px)] overflow-x-hidden">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
