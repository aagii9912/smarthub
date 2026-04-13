"use client";

import { useState, useEffect } from "react";
import type { LandingContent } from "@/lib/landing/types";
import { defaultLandingContent } from "@/lib/landing/defaults";
import {
  Navbar,
  HeroSection,
  MetricsBar,
  FeaturesSection,
  HowItWorksSection,
  SocialProofSection,
  PricingSection,
  FAQSection,
  CTASection,
  Footer,
} from "@/components/landing";

export default function LandingPage() {
  const [c, setC] = useState<LandingContent>(defaultLandingContent);

  // Fetch CMS content
  useEffect(() => {
    fetch("/api/dashboard/landing-content")
      .then((r) => r.json())
      .then((data) => setC(data))
      .catch(() => {/* use defaults */ });
  }, []);

  // Scroll-triggered reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#06060f] text-white antialiased overflow-x-hidden">

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-indigo-600/[0.15] via-violet-600/[0.08] to-transparent blur-3xl" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/[0.04] blur-3xl" />
        <div className="absolute top-[60%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <Navbar />
      <HeroSection content={c} />
      <MetricsBar content={c} />
      <FeaturesSection content={c} />
      <HowItWorksSection content={c} />
      <SocialProofSection content={c} />
      <PricingSection content={c} />
      <FAQSection content={c} />
      <CTASection content={c} />
      <Footer />

      {/* Reveal + Glow styles */}
      <style jsx global>{`
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-on-scroll.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @keyframes float-bubble {
          0%, 100% {
            transform: translateY(0px) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translateY(-15px) scale(1.02);
            opacity: 0.8;
          }
          90% {
            opacity: 1;
          }
        }
        .chat-bubble {
          animation: float-bubble 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
