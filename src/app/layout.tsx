import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SerwistProvider } from "@serwist/next/react";
import { SplashRemover } from "@/components/splash-remover";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Car Service Tracker",
  description: "Track vehicle consumables and maintenance schedules",
  applicationName: "Car Service Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Car Service Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <div
          id="app-splash"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "var(--background, oklch(0.98 0.004 85))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.3s",
          }}
        >
          <img src="/icons/icon-192.png" width="96" height="96" alt="" />
        </div>
        <SplashRemover />
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
