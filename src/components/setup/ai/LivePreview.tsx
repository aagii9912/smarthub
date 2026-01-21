'use client';

import { Bot, Briefcase } from 'lucide-react';
import { EMOTIONS } from '@/lib/constants/ai-setup';
import { getAIWelcomeMessage } from '@/lib/utils/ai-preview';
import { useMemo } from 'react';

interface LivePreviewProps {
    template: string;
    emotion: string;
    description: string;
}

export function LivePreview({ template, emotion, description }: LivePreviewProps) {
    // Memoize the message calculation so it only runs when template or emotion changes
    const previewMessage = useMemo(() => {
        return getAIWelcomeMessage(template, emotion);
    }, [template, emotion]);

    const emotionLabel = EMOTIONS.find(e => e.value === emotion)?.label;

    return (
        <div className="bg-gray-100 rounded-3xl p-4 min-h-[300px] lg:min-h-[500px] relative border border-gray-200 shadow-inner overflow-hidden sticky top-0">
            {/* Chat Header */}
            <div className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <div className="font-bold text-gray-900 text-sm">SmartHub AI</div>
                    <div className="flex items-center gap-1 text-xs text-green-500 font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        Active now
                    </div>
                </div>
            </div>

            {/* Chat Content */}
            <div className="space-y-4 pb-12">
                <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm max-w-[80%]">
                        Сайн байна уу?
                    </div>
                </div>
                <div className="flex justify-start animate-in fade-in slide-in-from-left duration-300">
                    <div className="bg-white text-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-md max-w-[85%] border border-gray-100">
                        {previewMessage}
                        <div className="mt-2 text-xs text-gray-400">
                            (Энэ бол {emotionLabel} тохиргоо)
                        </div>
                    </div>
                </div>
                {description && (
                    <div className="flex justify-center mt-4">
                        <div className="bg-black/5 text-gray-500 text-[10px] px-2 py-1 rounded-full flex items-center gap-1 max-w-full truncate">
                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Context: {description}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-white rounded-full h-10 shadow-sm border border-gray-200 flex items-center px-4 text-gray-400 text-sm">
                    Зурвас бичих...
                </div>
            </div>
        </div>
    );
}
