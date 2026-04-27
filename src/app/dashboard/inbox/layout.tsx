'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { InboxProvider } from '@/components/inbox/InboxProvider';
import { InboxList } from '@/components/inbox/InboxList';

export default function InboxLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isThreadView = !!(
        pathname?.startsWith('/dashboard/inbox/') &&
        pathname !== '/dashboard/inbox'
    );

    return (
        <InboxProvider>
            <div className="h-full min-h-[calc(100vh-160px)] md:min-h-[calc(100vh-180px)] flex flex-col">
                <div
                    className={cn(
                        'flex-1 min-h-0 card-outlined overflow-hidden grid',
                        'grid-cols-1 md:grid-cols-[340px_1fr]'
                    )}
                >
                    <aside
                        className={cn(
                            'flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-white/[0.06]',
                            isThreadView ? 'hidden md:flex' : 'flex'
                        )}
                    >
                        <InboxList />
                    </aside>

                    <section
                        className={cn(
                            'flex flex-col min-h-0',
                            isThreadView ? 'flex' : 'hidden md:flex'
                        )}
                    >
                        {children}
                    </section>
                </div>
            </div>
        </InboxProvider>
    );
}
