import Link from 'next/link';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Section } from './ui/Section';

export function Hero() {
    return (
        <div className="relative overflow-hidden bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"></div>
            <Section className="relative pt-24 pb-32 sm:pt-32 sm:pb-40">
                <div className="mx-auto max-w-2xl text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-6xl mb-6">
                        Odoo ERP
                        <span className="block text-indigo-600 dark:text-indigo-400">Бизнесийн Автоматжуулалт</span>
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-neutral-300">
                        Таны бизнесийн бүх үйл ажиллагааг нэг дороос удирдах цогц шийдэл.
                        Борлуулалт, Санхүү, Агуулах, Маркетинг гээд бүгдийг нэг системд.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <Link
                            href="#contact-form"
                            className="rounded-full bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all flex items-center gap-2"
                        >
                            Үнийн санал авах <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link href="#features" className="text-sm font-semibold leading-6 text-neutral-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            Дэлгэрэнгүй харах <span aria-hidden="true">→</span>
                        </Link>
                    </div>

                    <div className="mt-12 flex items-center justify-center gap-x-8 text-sm text-neutral-500 dark:text-neutral-400">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Албан ёсны эрхтэй</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Мэргэжлийн баг</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>24/7 Дэмжлэг</span>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}
