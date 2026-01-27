'use client';

import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { dark } from "@clerk/themes";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background with gradient glow */}
            <div className="fixed inset-0 bg-[#0a0a0a]">
                {/* Gradient orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[150px]" />
            </div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md px-4"
            >
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        SmartHub
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        AI чатбот платформ руу нэвтрэх
                    </p>
                </motion.div>

                {/* Clerk SignIn with dark theme */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    <SignIn
                        appearance={{
                            baseTheme: dark,
                            elements: {
                                rootBox: "mx-auto",
                                card: "bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 shadow-2xl shadow-indigo-500/10",
                                headerTitle: "text-white",
                                headerSubtitle: "text-zinc-400",
                                socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
                                socialButtonsBlockButtonText: "text-white",
                                dividerLine: "bg-zinc-700",
                                dividerText: "text-zinc-500",
                                formFieldLabel: "text-zinc-300",
                                formFieldInput: "bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-indigo-500/20",
                                formButtonPrimary: "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity",
                                footerActionLink: "text-indigo-400 hover:text-indigo-300",
                                identityPreviewEditButton: "text-indigo-400",
                            },
                            variables: {
                                colorPrimary: "#6366f1",
                                colorBackground: "#18181b",
                                colorInputBackground: "#27272a",
                                colorInputText: "#fafafa",
                                borderRadius: "1rem",
                            }
                        }}
                        routing="path"
                        path="/auth/login"
                        signUpUrl="/auth/register"
                        forceRedirectUrl="/dashboard"
                    />
                </motion.div>
            </motion.div>
        </div>
    );
}
