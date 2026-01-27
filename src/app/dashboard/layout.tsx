'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { MobileNav } from '@/components/dashboard/MobileNav';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    useRealtimeNotifications();

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Background gradient glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
            </div>

            <Sidebar />
            <div className="md:ml-64 transition-all duration-300 min-h-screen flex flex-col relative z-10">
                <Header />
                <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
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
