'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Loader2, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    expires_at: string | null;
    created_at: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function shopHeaders(json = false): Record<string, string> {
    const h: Record<string, string> = {
        'x-shop-id':
            (typeof window !== 'undefined' && localStorage.getItem('smarthub_active_shop_id')) || '',
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('mn-MN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    } catch {
        return '—';
    }
}

export function ApiKeysCard() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
    // Шинэ үүсгэсэн түлхүүр — ганц удаа харуулна.
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/api-keys', { headers: shopHeaders() });
            const data = await res.json();
            if (res.ok) setKeys(data.keys || []);
        } catch {
            /* чимээгүй — UI хоосон харагдана */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch('/api/dashboard/api-keys', {
                method: 'POST',
                headers: shopHeaders(true),
                body: JSON.stringify({ name: newName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Түлхүүр үүсгэхэд алдаа гарлаа');
            } else {
                setCreatedKey(data.key);
                setCopied(false);
                setNewName('');
                await load();
            }
        } catch {
            toast.error('Түлхүүр үүсгэхэд алдаа гарлаа');
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id: string) => {
        setBusyId(id);
        try {
            const res = await fetch(`/api/dashboard/api-keys/${id}`, {
                method: 'DELETE',
                headers: shopHeaders(),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || 'Цуцлахад алдаа гарлаа');
            else {
                toast.success('Түлхүүр цуцлагдлаа');
                setConfirmRevokeId(null);
                await load();
            }
        } catch {
            toast.error('Цуцлахад алдаа гарлаа');
        } finally {
            setBusyId(null);
        }
    };

    const handleCopyCreated = async () => {
        if (!createdKey) return;
        const ok = await copyToClipboard(createdKey);
        if (ok) {
            setCopied(true);
            toast.success('Түлхүүр хууллаа');
        } else {
            toast.error('Хуулж чадсангүй');
        }
    };

    return (
        <div className="card-outlined p-6">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-1.5">
                <KeyRound className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                API түлхүүрүүд
            </h3>
            <p className="text-[12px] text-white/45 mb-5 tracking-[-0.01em]">
                Гадны төслөөс AI чат API-д хандахад ашиглана. Түлхүүрийг зөвхөн үүсгэх агшинд нэг
                удаа харуулна — аюулгүй газар хадгална уу.
            </p>

            {/* Шинэ түлхүүр үүсгэсний дараа ганц удаа харуулах хайрцаг */}
            {createdKey && (
                <div className="mb-5 p-4 rounded-xl border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)]">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: 'var(--warning)' }}
                            strokeWidth={1.5}
                        />
                        <p className="text-[12px] text-white/70 tracking-[-0.01em]">
                            Энэ түлхүүрийг одоо хуулж авна уу. Хаалтын дараа дахин харуулахгүй.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/30 text-[12px] text-foreground font-mono break-all">
                            {createdKey}
                        </code>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyCreated}
                            leftIcon={
                                copied ? (
                                    <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                                )
                            }
                        >
                            {copied ? 'Хууллаа' : 'Хуулах'}
                        </Button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setCreatedKey(null)}
                        className="mt-3 text-[12px] text-white/50 hover:text-white/80 transition-colors"
                    >
                        Хаах
                    </button>
                </div>
            )}

            {/* Үүсгэх форм */}
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-5">
                <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Түлхүүрийн нэр (ж: Миний вэбсайт)"
                    maxLength={60}
                    className={cn(inputCls, 'flex-1')}
                />
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={creating}
                    leftIcon={
                        creating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )
                    }
                >
                    Үүсгэх
                </Button>
            </form>

            {/* Түлхүүрийн жагсаалт */}
            {loading ? (
                <p className="text-[12px] text-white/45 py-2">Ачааллаж байна...</p>
            ) : (
                <div className="space-y-2">
                    {keys.map((k) => {
                        const revoked = !!k.revoked_at;
                        return (
                            <div
                                key={k.id}
                                className={cn(
                                    'flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]',
                                    revoked && 'opacity-50',
                                )}
                            >
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.05] shrink-0">
                                    <KeyRound className="w-4 h-4 text-white/50" strokeWidth={1.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-foreground truncate">
                                        {k.name}
                                        {revoked && (
                                            <span className="ml-2 text-[11px] text-white/45">· Цуцлагдсан</span>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-white/45 truncate font-mono">
                                        {k.key_prefix}··· · Үүсгэсэн {formatDate(k.created_at)} · Сүүлд{' '}
                                        {formatDate(k.last_used_at)}
                                    </p>
                                </div>

                                {!revoked &&
                                    (confirmRevokeId === k.id ? (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setConfirmRevokeId(null)}
                                            >
                                                Болих
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleRevoke(k.id)}
                                                disabled={busyId === k.id}
                                            >
                                                {busyId === k.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    'Цуцлах'
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmRevokeId(k.id)}
                                            disabled={busyId === k.id}
                                            title="Цуцлах"
                                            className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-white/[0.05] transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    ))}
                            </div>
                        );
                    })}

                    {keys.length === 0 && (
                        <p className="text-[12px] text-white/45 py-2 text-center">
                            Одоогоор API түлхүүр алга. Дээрх формоор үүсгэнэ үү.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
