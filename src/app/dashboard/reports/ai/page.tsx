import { redirect } from 'next/navigation';

/**
 * Legacy AI reports route — now merged into /dashboard/reports.
 * AI is the default tab on the unified page so we just redirect to the
 * bare path; lingering ?tab=ai bookmarks still resolve correctly.
 */
export default function AIReportRedirect() {
    redirect('/dashboard/reports');
}
