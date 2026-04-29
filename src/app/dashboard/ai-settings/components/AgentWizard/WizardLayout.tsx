'use client';

import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface WizardStep {
    id: string;
    title: string;
    subtitle?: string;
}

interface WizardLayoutProps {
    steps: WizardStep[];
    activeStepIndex: number;
    onStepClick?: (index: number) => void;
    onBack: () => void;
    onNext: () => void;
    onClose?: () => void;
    onSkipToEnd?: () => void;
    backLabel?: string;
    nextLabel?: string;
    nextLoading?: boolean;
    nextDisabled?: boolean;
    finalStep?: boolean;
    children: ReactNode;
    sidePanel?: ReactNode;
}

export function WizardLayout({
    steps,
    activeStepIndex,
    onStepClick,
    onBack,
    onNext,
    onClose,
    onSkipToEnd,
    backLabel = 'Буцах',
    nextLabel = 'Үргэлжлүүлэх',
    nextLoading = false,
    nextDisabled = false,
    finalStep = false,
    children,
    sidePanel,
}: WizardLayoutProps) {
    return (
        <div className="flex h-full min-h-[600px] flex-col bg-[var(--page-bg-dashboard,#09090b)]">
            {/* Header — progress + close */}
            <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ProgressTrack
                        steps={steps}
                        activeIndex={activeStepIndex}
                        onStepClick={onStepClick}
                    />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {onSkipToEnd && !finalStep && (
                        <button
                            onClick={onSkipToEnd}
                            className="text-[12px] text-white/45 hover:text-white/70 transition-colors px-2 py-1"
                        >
                            Default-аар дуусгах
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-md p-1.5 text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                            aria-label="Хаах"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </header>

            {/* Body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                <main className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
                    {children}
                </main>
                {sidePanel && (
                    <aside className="hidden lg:flex w-[380px] shrink-0 border-l border-white/[0.06] bg-white/[0.015]">
                        <div className="flex w-full flex-col">{sidePanel}</div>
                    </aside>
                )}
            </div>

            {/* Footer — nav buttons */}
            <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
                <Button
                    variant="ghost"
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                    onClick={onBack}
                    disabled={activeStepIndex === 0}
                    className={cn(activeStepIndex === 0 && 'invisible')}
                >
                    {backLabel}
                </Button>
                <div className="flex items-center gap-3 text-[12px] text-white/45">
                    <span>{activeStepIndex + 1} / {steps.length}</span>
                </div>
                <Button
                    variant="primary"
                    rightIcon={finalStep ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    onClick={onNext}
                    loading={nextLoading}
                    disabled={nextDisabled}
                >
                    {nextLabel}
                </Button>
            </footer>
        </div>
    );
}

function ProgressTrack({
    steps,
    activeIndex,
    onStepClick,
}: {
    steps: WizardStep[];
    activeIndex: number;
    onStepClick?: (index: number) => void;
}) {
    return (
        <ol className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
            {steps.map((s, idx) => {
                const isActive = idx === activeIndex;
                const isDone = idx < activeIndex;
                const interactive = !!onStepClick && idx <= activeIndex;
                return (
                    <li key={s.id} className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => interactive && onStepClick?.(idx)}
                            disabled={!interactive}
                            className={cn(
                                'flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors',
                                interactive ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                                    isActive
                                        ? 'bg-[var(--brand-indigo,#4A7CE7)] text-white'
                                        : isDone
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-white/[0.06] text-white/40',
                                )}
                            >
                                {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                            </span>
                            <span
                                className={cn(
                                    'text-[12.5px] font-medium hidden sm:inline-block',
                                    isActive ? 'text-foreground' : 'text-white/55',
                                )}
                            >
                                {s.title}
                            </span>
                        </button>
                        {idx < steps.length - 1 && (
                            <span className="h-px w-4 bg-white/[0.08]" aria-hidden />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
