import type { Translations } from '@/i18n';

export interface Crumb {
    label: string;
    href?: string;
}

export function buildBreadcrumbs(pathname: string, t: Translations): Crumb[] {
    const crumbs: Crumb[] = [{ label: 'Syncly', href: '/dashboard' }];
    const clean = pathname.replace(/\/$/, '');

    if (clean === '/dashboard' || clean === '') {
        crumbs.push({ label: t.sidebar.dashboard });
        return crumbs;
    }

    const titles = t.header.pageTitles;
    const matched = Object.keys(titles)
        .filter((k) => k !== '/dashboard' && titles[k])
        .sort((a, b) => b.length - a.length)
        .find((k) => clean === k || clean.startsWith(k + '/'));

    if (matched && titles[matched]) {
        crumbs.push({ label: titles[matched] });
    } else {
        crumbs.push({ label: t.header.fallbackTitle });
    }
    return crumbs;
}
