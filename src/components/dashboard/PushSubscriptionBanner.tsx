'use client';

import { Bell, BellOff, X } from 'lucide-react';
import { useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const DISMISS_KEY = 'smarthub_push_banner_dismissed';

export function PushSubscriptionBanner() {
    const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
    const [dismissed, setDismissed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return sessionStorage.getItem(DISMISS_KEY) === '1';
    });

    if (!isSupported || isSubscribed || dismissed) {
        return null;
    }

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    };

    const isDenied = permission === 'denied';

    return (
        <div
            role="status"
            className={`mx-4 md:mx-6 lg:mx-8 mt-3 mb-1 flex items-start gap-3 rounded-lg border px-4 py-3 ${
                isDenied
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-blue-500/30 bg-blue-500/10'
            }`}
        >
            <div className={`mt-0.5 ${isDenied ? 'text-amber-400' : 'text-blue-400'}`}>
                {isDenied ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">
                    {isDenied
                        ? 'Browser-ийн тохиргоонд мэдэгдэл хаагдсан байна'
                        : 'Та мэдэгдэл хүлээн авч чадахгүй байна'}
                </p>
                <p className="mt-0.5 text-xs text-slate-300/80">
                    {isDenied
                        ? 'Site settings-ээс зөвшөөрөл өгснөөр шинэ захиалга, харилцагчийн мессежийг бодит цагт мэдэх боломжтой.'
                        : 'Шинэ захиалга, харилцагчийн мессежийг бодит цагт мэдэхийн тулд мэдэгдлийг идэвхжүүлнэ үү.'}
                </p>
            </div>
            {!isDenied && (
                <button
                    type="button"
                    onClick={() => subscribe()}
                    disabled={isLoading}
                    className="shrink-0 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                    {isLoading ? 'Түр хүлээнэ үү…' : 'Мэдэгдэл идэвхжүүлэх'}
                </button>
            )}
            <button
                type="button"
                onClick={handleDismiss}
                aria-label="Хаах"
                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-200"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
