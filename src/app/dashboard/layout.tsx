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

        <div className="min-h-screen bg-[#f8f9fa]">
            <Sidebar />
            <div className="md:ml-64 transition-all duration-300 min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 p-3 md:p-5 lg:p-8 pb-20 md:pb-6 dashboard-content">
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
