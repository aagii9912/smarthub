/**
 * Onboarding Tour Component
 * Guides new users through the dashboard with tooltips
 */

'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TourStep {
    target: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
    {
        target: '[data-tour="products"]',
        title: '📦 Бүтээгдэхүүн нэмэх',
        content: 'Энд дарж бараа, үйлчилгээгээ бүртгэнэ үү. AI таны бүтээгдэхүүнийг хэрэглэгчдэд санал болгоно.',
        position: 'right'
    },
    {
        target: '[data-tour="orders"]',
        title: '🛒 Захиалгууд',
        content: 'AI-аар дамжуулан ирсэн бүх захиалгыг энд удирдана. Төлөв солих, хүргэлт зохицуулах.',
        position: 'right'
    },
    {
        target: '[data-tour="customers"]',
        title: '👥 CRM - Хэрэглэгчид',
        content: 'Таны бүх хэрэглэгчид энд хадгалагдана. Тагууд нэмж, VIP хэрэглэгчдийг ялгаарай.',
        position: 'right'
    },
    {
        target: '[data-tour="ai-settings"]',
        title: '🤖 AI Тохиргоо',
        content: 'AI-ийн хариултын хэв маяг, FAQ, Quick Reply тохируулах. AI-г өөрчлөөрэй!',
        position: 'right'
    },
    {
        target: '[data-tour="reports"]',
        title: '📊 Тайлан',
        content: 'Борлуулалт, шилдэг бүтээгдэхүүн, орлогын статистик харах. Excel татах.',
        position: 'right'
    }
];

const TOUR_STORAGE_KEY = 'smarthub_tour_completed';

export function OnboardingTour() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    function updatePosition() {
        const step = TOUR_STEPS[currentStep];
        const element = document.querySelector(step.target);

        if (element) {
            const rect = element.getBoundingClientRect();
            let top = rect.top;
            let left = rect.right + 16;

            if (step.position === 'bottom') {
                top = rect.bottom + 16;
                left = rect.left;
            } else if (step.position === 'top') {
                top = rect.top - 200;
                left = rect.left;
            } else if (step.position === 'left') {
                left = rect.left - 320;
            }

            setPosition({ top, left: Math.max(16, left) });
        }
    }

    function completeTour() {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        setIsOpen(false);
    }

    function handleNext() {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            completeTour();
        }
    }

    function handlePrev() {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }

    function skipTour() {
        completeTour();
    }

    useEffect(() => {
        // Check if tour was already completed
        const completed = localStorage.getItem(TOUR_STORAGE_KEY);
        if (!completed) {
            // Delay tour start to let page render
            const timer = setTimeout(() => {
                setIsOpen(true);
                updatePosition();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
        }
    }, [currentStep, isOpen]);



    if (!isOpen) return null;

    const step = TOUR_STEPS[currentStep];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={skipTour}
            />

            {/* Tooltip */}
            <div
                className="fixed z-50 w-80 bg-[#0F0B2E] rounded-2xl shadow-2xl border border-violet-100 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300"
                style={{ top: position.top, left: position.left }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            {currentStep + 1} / {TOUR_STEPS.length}
                        </span>
                    </div>
                    <button
                        onClick={skipTour}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        {step.content}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Өмнөх
                        </button>

                        <Button onClick={handleNext} size="sm">
                            {currentStep === TOUR_STEPS.length - 1 ? (
                                'Дууслаа!'
                            ) : (
                                <>
                                    Дараах
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Progress dots */}
                <div className="px-4 pb-4 flex justify-center gap-1.5">
                    {TOUR_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${i === currentStep
                                ? 'bg-violet-500'
                                : i < currentStep
                                    ? 'bg-violet-300'
                                    : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

/**
 * Hook to manually restart the tour
 */
export function useOnboardingTour() {
    const restartTour = () => {
        localStorage.removeItem(TOUR_STORAGE_KEY);
        window.location.reload();
    };

    return { restartTour };
}
