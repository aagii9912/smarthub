'use client';

import {
    UserCircle2,
    BookOpen,
    Bell,
    Wrench,
    Sparkles,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickEditCardProps {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
    accent: string;
    onClick: () => void;
}

export function QuickEditCard({ icon: Icon, title, subtitle, accent, onClick }: QuickEditCardProps) {
    return (
        <button
            onClick={onClick}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
            <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accent)}>
                <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground tracking-tight">{title}</span>
                <span className="block text-[11.5px] text-white/45 mt-0.5 line-clamp-1">{subtitle}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30 transition-colors group-hover:text-white/60" />
        </button>
    );
}

interface QuickEditCardsProps {
    onPersonalityClick: () => void;
    onKnowledgeClick: () => void;
    onCapabilitiesClick: () => void;
    onNotificationsClick: () => void;
    onWizardClick: () => void;
}

export function QuickEditCards({
    onPersonalityClick,
    onKnowledgeClick,
    onCapabilitiesClick,
    onNotificationsClick,
    onWizardClick,
}: QuickEditCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickEditCard
                icon={UserCircle2}
                title="Зан төлөв, нэр"
                subtitle="AI-ийн нэр, эмоци, нэмэлт заавар"
                accent="bg-emerald-500/15 text-emerald-400"
                onClick={onPersonalityClick}
            />
            <QuickEditCard
                icon={BookOpen}
                title="Мэдлэг, FAQ"
                subtitle="Бизнесийн тайлбар, түгээмэл асуултуудын хариулт"
                accent="bg-amber-500/15 text-amber-400"
                onClick={onKnowledgeClick}
            />
            <QuickEditCard
                icon={Wrench}
                title="AI-ийн үйлдлүүд"
                subtitle="Tool-ууд, ашиглах боломжуудыг асаах/унтраах"
                accent="bg-blue-500/15 text-blue-400"
                onClick={onCapabilitiesClick}
            />
            <QuickEditCard
                icon={Bell}
                title="Мэдэгдэл"
                subtitle="Push notification, email, дэмжлэгийн event"
                accent="bg-violet-500/15 text-violet-400"
                onClick={onNotificationsClick}
            />
            <QuickEditCard
                icon={Sparkles}
                title="Wizard дахин нээх"
                subtitle="5 алхамт setup-аар үүргээ дахин тааруулах"
                accent="bg-pink-500/15 text-pink-400"
                onClick={onWizardClick}
            />
        </div>
    );
}
