import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow pinch zoom for accessibility
  userScalable: true,
  viewportFit: 'cover', // Safe area support for notched devices
};

export const metadata: Metadata = {
  title: "SmartHub - AI Чатбот",
  description: "Facebook Messenger дээр ажилладаг AI чатбот. Таны бизнесийг автоматжуулна.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // Better for dark mode
    title: "SmartHub",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  other: {
    // Disable auto-zoom on input focus for iOS
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <PWAInstallPrompt />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
