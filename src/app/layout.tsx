import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from 'sonner';

// Typography: Inter for body UI, Geist Mono for numerics.
// GIP (display/brand) is self-hosted via @font-face in globals.css
// and exposed through --font-display / --font-serif.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevent zoom which can break "app-like" feel
  userScalable: false, // Force app-like experience
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Syncly - AI Чатбот",
  description: "Facebook Messenger дээр ажилладаг AI чатбот. Таны бизнесийг автоматжуулна.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent", // Better for dark mode
    title: "Syncly",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/icon-192.png",
  },
  other: {
    // Disable auto-zoom on input focus for iOS
    'mobile-web-app-capable': 'yes',
    // Disable Android Chrome auto dark mode override
    'color-scheme': 'light dark',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className="font-sans">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ServiceWorkerRegistration />
        <PWAInstallPrompt />
        <QueryProvider>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <Toaster position="top-center" richColors />
            </AuthProvider>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}


