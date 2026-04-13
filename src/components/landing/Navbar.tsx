"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#06060f]/70 backdrop-blur-2xl">
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Syncly" width={28} height={28} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Syncly</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-[13px] text-slate-400">
          <a href="#features" className="hover:text-white transition-colors duration-200">Боломжууд</a>
          <a href="#pricing" className="hover:text-white transition-colors duration-200">Үнэ</a>
          <a href="#faq" className="hover:text-white transition-colors duration-200">Түгээмэл асуулт</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button href="/auth/login" variant="ghost" size="sm" className="text-[13px] text-slate-300 hover:text-white">
            Нэвтрэх
          </Button>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 transition-all duration-200"
          >
            Эхлэх
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.05] bg-[#06060f]/95 backdrop-blur-2xl px-6 py-4 space-y-3">
          <a href="#features" className="block text-sm text-slate-400 hover:text-white">Боломжууд</a>
          <a href="#pricing" className="block text-sm text-slate-400 hover:text-white">Үнэ</a>
          <a href="#faq" className="block text-sm text-slate-400 hover:text-white">Түгээмэл асуулт</a>
          <div className="pt-3 border-t border-white/[0.05] flex gap-3">
            <Button href="/auth/login" variant="ghost" size="sm" className="flex-1">Нэвтрэх</Button>
            <Link href="/auth/register" className="flex-1 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium">Эхлэх</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
