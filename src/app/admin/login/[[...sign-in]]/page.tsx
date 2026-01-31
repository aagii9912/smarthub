'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function AdminLoginPage() {
    const { isSignedIn, isLoaded } = useAuth();
    const router = useRouter();

    // If already signed in, redirect to admin dashboard
    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.push('/admin');
        }
    }, [isLoaded, isSignedIn, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-violet-900 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Syncly Admin</h1>
                    <p className="text-gray-400 mt-2">Админ нэвтрэх хэсэг</p>
                </div>

                {/* Clerk SignIn */}
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl",
                            headerTitle: "text-white",
                            headerSubtitle: "text-gray-400",
                            socialButtonsBlockButton: "bg-white/10 border-white/20 text-white hover:bg-white/20",
                            formFieldLabel: "text-gray-300",
                            formFieldInput: "bg-white/10 border-white/20 text-white placeholder-gray-500",
                            formButtonPrimary: "bg-violet-600 hover:bg-violet-700",
                            footerActionLink: "text-violet-400 hover:text-violet-300",
                            identityPreviewText: "text-white",
                            identityPreviewEditButton: "text-violet-400",
                        },
                    }}
                    routing="path"
                    path="/admin/login"
                    forceRedirectUrl="/admin"
                />

                {/* Footer */}
                <p className="text-center text-gray-500 text-sm mt-6">
                    © 2024 Syncly AI Platform
                </p>
            </div>
        </div>
    );
}
