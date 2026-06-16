'use client';

// Version 1.5 preview route (/version1.5) — renders the same archetype-aware
// dashboard as /dashboard so the new experience can be previewed under a
// dedicated URL.
import DashboardPage from '@/app/dashboard/page';

export default function Version15Page() {
    return <DashboardPage />;
}
