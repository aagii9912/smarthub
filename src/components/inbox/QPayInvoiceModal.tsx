'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Copy, ExternalLink } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/Modal';

interface QPayInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    customerId: string;
}

interface InvoiceResult {
    qr_text: string;
    qr_image: string;
    urls: Array<{ name?: string; link: string }>;
    sentToCustomer: boolean;
    expires_at: string;
}

export function QPayInvoiceModal({ open, onClose, customerId }: QPayInvoiceModalProps) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [sendToCustomer, setSendToCustomer] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<InvoiceResult | null>(null);

    const handleClose = () => {
        if (submitting) return;
        setAmount('');
        setDescription('');
        setSendToCustomer(true);
        setResult(null);
        onClose();
    };

    const handleSubmit = async () => {
        const amt = Number(amount.replace(/[\s,]/g, ''));
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error('Дүнг 0-ээс их тоогоор оруулна уу.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/dashboard/conversations/${customerId}/qpay-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amt,
                    description: description.trim() || undefined,
                    sendToCustomer,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data?.error || 'Invoice үүсгэхэд алдаа гарлаа');
                return;
            }

            setResult({
                qr_text: data.qr_text,
                qr_image: data.qr_image,
                urls: data.urls || [],
                sentToCustomer: data.sentToCustomer,
                expires_at: data.expires_at,
            });

            if (data.sentToCustomer) {
                toast.success('Хэрэглэгч рүү QPay линк илгээгдлээ');
            } else if (sendToCustomer) {
                toast.warning('Invoice үүслээ, гэхдээ хэрэглэгч рүү илгээх боломжгүй байсан тул гараар хуулна уу.');
            } else {
                toast.success('Invoice үүсгэгдлээ');
            }
        } catch {
            toast.error('Сүлжээний алдаа');
        } finally {
            setSubmitting(false);
        }
    };

    const copyLink = async (link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Хууллаа');
        } catch {
            toast.error('Хуулж чадсангүй');
        }
    };

    return (
        <Modal open={open} onOpenChange={(v) => !v && handleClose()}>
            <ModalContent
                size="md"
                title="QPay invoice үүсгэх"
                description="Хэрэглэгчээс гар QPay төлбөр авах"
            >
                {!result ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-medium text-foreground/80 mb-1.5">
                                Дүн (₮)
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="50000"
                                disabled={submitting}
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-foreground placeholder:text-white/30 focus:border-[var(--border-accent)] focus:bg-white/[0.05] outline-none transition-colors disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-medium text-foreground/80 mb-1.5">
                                Тайлбар (заавал биш)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Жишээ: Захиалга №123 - 2 ширхэг"
                                rows={2}
                                disabled={submitting}
                                maxLength={100}
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-[13px] text-foreground placeholder:text-white/30 focus:border-[var(--border-accent)] focus:bg-white/[0.05] outline-none transition-colors resize-none disabled:opacity-50"
                            />
                        </div>

                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={sendToCustomer}
                                onChange={(e) => setSendToCustomer(e.target.checked)}
                                disabled={submitting}
                                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.03] text-[var(--brand-indigo)] focus:ring-2 focus:ring-[var(--brand-indigo)]/30"
                            />
                            <span className="text-[13px] text-foreground/85">
                                Хэрэглэгч рүү автоматаар QPay линк илгээх
                            </span>
                        </label>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-[13px] text-foreground transition-colors disabled:opacity-50"
                            >
                                Болих
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet-500))',
                                    boxShadow: 'var(--shadow-cta-indigo)',
                                }}
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Invoice үүсгэх
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {result.qr_image ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="rounded-lg bg-white p-3 inline-block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={result.qr_image.startsWith('data:') ? result.qr_image : `data:image/png;base64,${result.qr_image}`}
                                        alt="QPay QR"
                                        className="w-44 h-44"
                                    />
                                </div>
                                <p className="text-[11px] text-white/50">QR кодыг скан хийж төлнө</p>
                            </div>
                        ) : null}

                        {result.urls.length > 0 && (
                            <div>
                                <p className="text-[11px] font-medium text-white/60 mb-2 uppercase tracking-wider">
                                    Банкны линкүүд
                                </p>
                                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {result.urls.map((u, i) => (
                                        <li key={i} className="flex items-center gap-2 text-[12px]">
                                            <span className="flex-1 text-foreground/80 truncate">{u.name || 'Банк'}</span>
                                            <button
                                                type="button"
                                                onClick={() => copyLink(u.link)}
                                                className="p-1.5 rounded hover:bg-white/[0.06] text-white/60 hover:text-white"
                                                aria-label="Хуулах"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <a
                                                href={u.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded hover:bg-white/[0.06] text-white/60 hover:text-white"
                                                aria-label="Нээх"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!result.sentToCustomer && (
                            <p className="text-[12px] text-amber-300/80">
                                Хэрэглэгч рүү автомат илгээгдээгүй. Линкийг хуулж чатанд тавьна уу.
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-[13px] text-foreground transition-colors"
                        >
                            Хаах
                        </button>
                    </div>
                )}
            </ModalContent>
        </Modal>
    );
}
