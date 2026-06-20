'use client';

import Link from 'next/link';
import { Variants } from 'framer-motion';
import { Calendar, ChevronDown, Download, Plus, RefreshCw } from 'lucide-react';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { PageHero } from '@/components/ui/PageHero';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type TimeFilter = 'today' | 'week' | 'month';

export const timeFilterOptions = [
    { value: 'today' as const, labelKey: 'today' as const },
    { value: 'week' as const, labelKey: 'week' as const },
    { value: 'month' as const, labelKey: 'month' as const },
];

export const AVATAR_TONES = ['violet', 'emerald', 'cyan', 'rose', 'amber', 'indigo'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

export const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

/** Running cumulative helper for answered-rate style sparklines. */
export function cumulative(values: number[]): number[] {
    let acc = 0;
    return values.map((v) => (acc += v));
}

export function toneBadgeClass(tone: AvatarTone): string {
    switch (tone) {
        case 'indigo':
            return 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo)]';
        case 'violet':
            return 'bg-[color-mix(in_oklab,var(--brand-violet-500)_18%,transparent)] text-[var(--brand-violet-500)]';
        case 'emerald':
            return 'bg-[color-mix(in_oklab,var(--status-success)_18%,transparent)] text-[var(--status-success)]';
        case 'amber':
            return 'bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-[var(--gold)]';
        case 'rose':
            return 'bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] text-[var(--status-danger)]';
        case 'cyan':
            return 'bg-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] text-[var(--brand-cyan)]';
    }
}

/** Relative time delta, e.g. "5м" / "2ц" / "3ө". */
export function formatDelta(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.max(1, Math.round(diff / 60000));
    if (mins < 60) return `${mins}м`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}ц`;
    return `${Math.round(hrs / 24)}ө`;
}

/** Forward time delta for upcoming items, e.g. "15м дараа" / "2ц дараа" / "Маргааш". */
export function formatUpcoming(iso: string): string {
    const d = new Date(iso);
    const diff = d.getTime() - Date.now();
    if (diff <= 0) return 'Одоо';
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}м дараа`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}ц дараа`;
    const days = Math.round(hrs / 24);
    return days === 1 ? 'Маргааш' : `${days} хоногийн дараа`;
}

interface DashboardHeroProps {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: string;
    timeFilter: TimeFilter;
    onTimeFilterChange: (v: TimeFilter) => void;
    onRefresh: () => void;
    isRefetching: boolean;
    exportType: string;
    ctaHref: string;
    ctaLabel: string;
}

/**
 * Shared dashboard hero with the time-filter dropdown, export, refresh and a
 * primary CTA. Reused by every archetype view so the header chrome stays
 * identical while each view supplies its own copy + CTA.
 */
export function DashboardHero({
    eyebrow,
    title,
    subtitle,
    timeFilter,
    onTimeFilterChange,
    onRefresh,
    isRefetching,
    exportType,
    ctaHref,
    ctaLabel,
}: DashboardHeroProps) {
    const { t } = useLanguage();
    const currentFilterLabel = t.dashboard[timeFilterOptions.find((o) => o.value === timeFilter)?.labelKey || 'today'];

    return (
        <PageHero
            eyebrow={eyebrow}
            eyebrowTone="emerald"
            live
            title={title}
            subtitle={subtitle}
            actions={
                <>
                    <Dropdown
                        align="right"
                        trigger={
                            <button className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200">
                                <Calendar className="h-3.5 w-3.5" />
                                {currentFilterLabel}
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        }
                    >
                        {timeFilterOptions.map((option) => (
                            <DropdownItem
                                key={option.value}
                                onClick={() => onTimeFilterChange(option.value)}
                                className={timeFilter === option.value ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-[var(--brand-indigo)] font-semibold' : ''}
                            >
                                {t.dashboard[option.labelKey]}
                            </DropdownItem>
                        ))}
                    </Dropdown>
                    <button
                        onClick={() => window.open(`/api/dashboard/export?type=${exportType}`, '_blank')}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200"
                        title={t.dashboard.export}
                    >
                        <Download className="h-3.5 w-3.5" />
                        {t.dashboard.export}
                    </button>
                    <button
                        onClick={onRefresh}
                        disabled={isRefetching}
                        className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200"
                        title={t.dashboard.refresh}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5 text-white/40', isRefetching && 'animate-spin')} />
                    </button>
                    <Link href={ctaHref} className="pill-cta text-[13px] py-2.5 px-5">
                        <Plus className="h-4 w-4" />
                        {ctaLabel}
                    </Link>
                </>
            }
        />
    );
}

/** Shared loading/error helpers reused by every archetype view. */
export function DashboardError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
    return (
        <div className="max-w-[1400px] mx-auto">
            <div className="card-outlined p-12 text-center flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[color-mix(in_oklab,var(--status-danger)_18%,transparent)] flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-[var(--status-danger)]" strokeWidth={1.5} />
                </div>
                <div>
                    <div className="text-[14px] font-medium text-foreground">Мэдээлэл ачаалахад алдаа гарлаа</div>
                    <div className="text-[12px] text-muted-foreground mt-1">Интернэт холболтоо шалгаад дахин оролдоно уу.</div>
                </div>
                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-white/70 bg-card border border-border rounded-xl hover:border-[var(--brand-indigo)]/40 transition-all duration-200"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', isRetrying && 'animate-spin')} />
                    Дахин оролдох
                </button>
            </div>
        </div>
    );
}
