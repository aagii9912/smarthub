import { DashboardLayoutShell } from '@/components/dashboard/DashboardLayoutShell';

// Trial / paywall enforcement happens in `src/middleware.ts` so the check
// runs at the edge before any layout renders.
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
