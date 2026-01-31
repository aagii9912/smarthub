import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Image
                        src="/logo.png"
                        alt="Syncly"
                        width={64}
                        height={64}
                        className="rounded-lg mx-auto mb-4"
                    />
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        Syncly
                    </h1>
                    <p className="text-muted-foreground">
                        AI чатбот платформ руу нэвтрэх
                    </p>
                </div>

                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-xl border border-border",
                            headerTitle: "text-foreground",
                            headerSubtitle: "text-muted-foreground",
                            socialButtonsBlockButton: "border-border hover:bg-secondary",
                            formButtonPrimary: "bg-primary hover:bg-primary/90",
                            footerActionLink: "text-primary hover:text-primary/80",
                        },
                    }}
                    routing="path"
                    path="/auth/login"
                    signUpUrl="/auth/register"
                    forceRedirectUrl="/dashboard"
                />
            </div>
        </div>
    );
}
