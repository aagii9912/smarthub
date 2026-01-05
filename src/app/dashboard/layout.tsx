import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="ml-64 transition-all duration-300">
                <Header />
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
