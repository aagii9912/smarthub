import { Facebook, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Channel } from './types';

interface ChannelBadgeProps {
    channel: Channel;
    className?: string;
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
    if (channel === 'unknown') return null;

    const isMessenger = channel === 'messenger';

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-[#09090b]',
                className
            )}
            style={{
                background: isMessenger
                    ? '#0084FF'
                    : 'linear-gradient(135deg, #FD1D1D, #C13584, #833AB4)',
            }}
            aria-label={isMessenger ? 'Facebook Messenger' : 'Instagram'}
        >
            {isMessenger ? (
                <Facebook className="w-2.5 h-2.5 text-white" strokeWidth={2.4} />
            ) : (
                <Instagram className="w-2.5 h-2.5 text-white" strokeWidth={2.4} />
            )}
        </span>
    );
}
