import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { MobileNav } from '@/components/dashboard/MobileNav';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-secondary/30">
            <Sidebar />
            <div className="md:ml-64 transition-all duration-300 min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                    {children}
                </main>
            </div>
            <MobileNav />
        </div>
    );
}
