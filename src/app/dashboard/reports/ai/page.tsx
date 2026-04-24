import { redirect } from 'next/navigation';

/**
 * Legacy AI reports route — now merged into /dashboard/reports with a tab switcher.
 * Redirects any lingering bookmarks/links to the unified page with the AI tab pre-selected.
 */
export default function AIReportRedirect() {
    redirect('/dashboard/reports?tab=ai');
}
