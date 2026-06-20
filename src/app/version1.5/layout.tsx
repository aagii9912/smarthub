import { DashboardLayoutShell } from '@/components/dashboard/DashboardLayoutShell';

// Version 1.5 preview — business-model-aware dashboard. Reuses the dashboard
// shell (sidebar / header / nav) so the experience matches /dashboard.
export default function Version15Layout({ children }: { children: React.ReactNode }) {
    return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
