'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndexPage() {
    const router = useRouter();

    useEffect(() => {
        // Check if admin token exists
        const adminToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('admin_token='));

        if (adminToken) {
            router.replace('/admin/dashboard');
        } else {
            router.replace('/admin/login');
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full"></div>
        </div>
    );
}
