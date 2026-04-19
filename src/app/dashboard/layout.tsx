'use client';

import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { MobileNav } from '@/components/dashboard/MobileNav';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

// Lazy load non-critical components
const OnboardingTour = dynamic(() => import('@/components/onboarding/OnboardingTour').then(mod => ({ default: mod.OnboardingTour })), { ssr: false });
const FeedbackWidget = dynamic(() => import('@/components/feedback/FeedbackWidget').then(mod => ({ default: mod.FeedbackWidget })), { ssr: false });

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    useRealtimeNotifications();

    return (
        <div className="dark min-h-screen bg-[#09090b] text-foreground relative">
            {/* Subtle gradient mesh */}
            <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-500/[0.03] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-violet-500/[0.03] via-transparent to-transparent" />
            </div>

            <Sidebar />
            <div className="md:ml-[72px] transition-all duration-300 min-h-screen flex flex-col relative">
                <Header />
                <main className="flex-1 px-4 md:px-6 lg:px-8 pb-24 md:pb-8 pt-4 md:pt-6" role="main" aria-label="Dashboard content">
                    {children}
                </main>
            </div>
            <MobileNav />

            {/* Onboarding & Feedback */}
            <OnboardingTour />
            <FeedbackWidget />
        </div>
    );
}
