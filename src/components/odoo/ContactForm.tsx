'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Section } from './ui/Section';
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function ContactForm() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');
        setErrorMessage('');

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
            email: formData.get('email') as string,
            company: formData.get('company') as string,
            message: formData.get('message') as string,
        };

        try {
            const { error } = await supabase.from('leads').insert([data]);

            if (error) throw error;

            setStatus('success');
            (e.target as HTMLFormElement).reset();
        } catch (error: any) {
            console.error('Error submitting form:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Алдаа гарлаа. Та дахин оролдоно уу.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Section id="contact-form" className="bg-white dark:bg-neutral-900">
            <div className="mx-auto max-w-2xl text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                    Холбоо барих
                </h2>
                <p className="mt-4 text-lg leading-8 text-neutral-600 dark:text-neutral-400">
                    Бидэнтэй холбогдож үнэгүй зөвлөгөө, үнийн санал аваарай.
                </p>
            </div>

            <div className="mx-auto max-w-xl bg-neutral-50 dark:bg-neutral-800/50 p-8 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700">
                {status === 'success' ? (
                    <div className="text-center py-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">Амжилттай илгээгдлээ!</h3>
                        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                            Таны хүсэлтийг хүлээн авлаа. Бид тантай удахгүй холбогдох болно.
                        </p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="mt-8 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Шинэ хүсэлт илгээх
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                                    Таны нэр <span className="text-red-500">*</span>
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        name="name"
                                        id="name"
                                        required
                                        className="block w-full rounded-md border-0 py-2.5 px-3.5 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-neutral-950 dark:ring-neutral-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                                    Утасны дугаар <span className="text-red-500">*</span>
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="tel"
                                        name="phone"
                                        id="phone"
                                        required
                                        className="block w-full rounded-md border-0 py-2.5 px-3.5 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-neutral-950 dark:ring-neutral-700 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                                И-мэйл хаяг
                            </label>
                            <div className="mt-2">
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    className="block w-full rounded-md border-0 py-2.5 px-3.5 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-neutral-950 dark:ring-neutral-700 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="company" className="block text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                                Байгууллагын нэр
                            </label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    name="company"
                                    id="company"
                                    className="block w-full rounded-md border-0 py-2.5 px-3.5 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-neutral-950 dark:ring-neutral-700 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                                Нэмэлт тайлбар
                            </label>
                            <div className="mt-2">
                                <textarea
                                    name="message"
                                    id="message"
                                    rows={4}
                                    className="block w-full rounded-md border-0 py-2.5 px-3.5 text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-neutral-950 dark:ring-neutral-700 dark:text-white"
                                />
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                            Хүсэлт илгээхэд алдаа гарлаа
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                            <p>{errorMessage}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-md bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Илгээж байна...
                                    </>
                                ) : (
                                    <>
                                        Илгээх <Send className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </Section>
    );
}
