import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Data Deletion Status | Syncly',
    description: 'Syncly өгөгдөл устгалтын байдал',
};

interface PageProps {
    searchParams: Promise<{ id?: string }>;
}

export default async function DeletionStatusPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const confirmationCode = params.id;

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
            <div className="mx-auto max-w-lg px-6 py-16 text-center">
                <div className="mb-8">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                    Өгөгдөл устгагдлаа
                </h1>

                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                    Таны хүсэлтийн дагуу Syncly дахь таны өгөгдөл устгагдлаа.
                </p>

                {confirmationCode && (
                    <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            Баталгаажуулах код:
                        </p>
                        <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                            {confirmationCode}
                        </p>
                    </div>
                )}

                <div className="space-y-4 text-left bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-8">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                        Устгагдсан мэдээлэл:
                    </h2>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        <li>✓ Чат түүх болон мессежүүд</li>
                        <li>✓ Захиалгын түүх</li>
                        <li>✓ Хэрэглэгчийн профайл мэдээлэл</li>
                        <li>✓ AI-тай харилцсан түүх</li>
                    </ul>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                    Хэрэв танд асуулт байвал{' '}
                    <Link href="/" className="text-indigo-600 hover:text-indigo-500">
                        Syncly
                    </Link>
                    -тай холбогдоно уу.
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                    Нүүр хуудас руу буцах
                </Link>
            </div>
        </div>
    );
}
