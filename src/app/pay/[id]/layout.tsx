import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Төлбөр хийх | Syncly',
    description: 'Syncly - Банкны аппаар хялбар төлбөр хийх',
    robots: 'noindex, nofollow',
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="mn">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                <meta name="theme-color" content="#0f0f1a" />
            </head>
            <body style={{ margin: 0, padding: 0 }}>
                {children}
            </body>
        </html>
    );
}
