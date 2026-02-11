'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        setIsStandalone(isStandaloneMode);

        if (isStandaloneMode) return;

        // Check if iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setIsIOS(isIOSDevice);

        // Check if already dismissed
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedDate = new Date(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            // Show again after 7 days
            if (daysSinceDismissed < 7) return;
        }

        // For iOS, show after a delay
        if (isIOSDevice) {
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        // Listen for beforeinstallprompt (Chrome, Edge, Samsung Browser)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setTimeout(() => setShowPrompt(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    };

    // Don't show if already installed or no prompt available
    if (isStandalone || !showPrompt) return null;

    return (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-slide-up max-w-[280px]">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-3 shadow-lg">
                <button
                    onClick={handleDismiss}
                    className="absolute top-1.5 right-1.5 p-1 text-white/70 hover:text-white transition-colors"
                    aria-label="Хаах"
                >
                    <X size={16} />
                </button>

                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg flex-shrink-0">
                        <Download size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-white font-medium text-sm">Syncly</h3>
                        <p className="text-white/80 text-xs">
                            {isIOS ? 'Share → Home Screen' : 'Апп суулгах'}
                        </p>
                    </div>
                </div>

                {!isIOS && (
                    <button
                        onClick={handleInstall}
                        className="mt-2 w-full bg-[#0F0B2E] text-blue-600 font-medium py-1.5 px-3 rounded-lg text-xs hover:bg-blue-50 transition-colors"
                    >
                        Суулгах
                    </button>
                )}
            </div>
        </div>
    );
}
