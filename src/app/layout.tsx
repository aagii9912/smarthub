import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from 'sonner';

// Premium Typography: Playfair Display for headings, Inter for body
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
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
    <ClerkProvider>
      <html lang="mn" className="dark">
        <body
          className={`${inter.variable} ${playfair.variable} ${geistMono.variable} antialiased`}
        >
          <ServiceWorkerRegistration />
          <PWAInstallPrompt />
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster position="top-center" richColors />
            </AuthProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

