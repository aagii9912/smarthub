'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Gift, Loader2, Save, Power } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';

interface Promotion {
    id: string;
    code: string;
    name: string;
    description: string | null;
    type: string;
    bonus_months: number;
    eligible_billing_cycles: string[];
    eligible_plan_slugs: string[];
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    redemption_count: number;
    redemption_count_last30: number;
}

interface PlanLite {
    slug: string;
    name: string;
}

const ALL_BILLING_CYCLES = ['monthly', 'yearly'] as const;

function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
    if (!local) return null;
    return new Date(local).toISOString();
}

export default function AdminPromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [plans, setPlans] = useState<PlanLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Record<string, Partial<Promotion>>>({});

    useEffect(() => {
        Promise.all([fetchPromotions(), fetchPlans()]);
    }, []);

    async function fetchPromotions() {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/promotions');
            if (res.ok) {
                const data = await res.json();
                setPromotions(data.promotions || []);
            } else {
                toast.error('Promo татаж чадсангүй');
            }
        } catch (e) {
            logger.error('Failed to fetch promotions', { error: e });
            toast.error('Сүлжээний алдаа');
        } finally {
            setLoading(false);
        }
    }

    async function fetchPlans() {
        try {
            const res = await fetch('/api/admin/plans');
            if (res.ok) {
                const data = await res.json();
                const list: PlanLite[] = (data.plans || [])
                    .filter((p: { is_active?: boolean; slug?: string }) => p.is_active && p.slug)
                    .map((p: { slug: string; name: string }) => ({ slug: p.slug, name: p.name }));
                setPlans(list);
            }
        } catch (e) {
            logger.error('Failed to fetch plans', { error: e });
        }
    }

    function getValue<K extends keyof Promotion>(promo: Promotion, key: K): Promotion[K] {
        const draftValue = draft[promo.id]?.[key];
        return (draftValue !== undefined ? draftValue : promo[key]) as Promotion[K];
    }

    function setValue<K extends keyof Promotion>(id: string, key: K, value: Promotion[K]) {
        setDraft(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    }

    async function save(promo: Promotion) {
        try {
            setSavingId(promo.id);
            const updates = draft[promo.id] || {};
            const payload: Record<string, unknown> = { id: promo.id, ...updates };

            const res = await fetch('/api/admin/promotions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success('Хадгаллаа');
                setDraft(prev => {
                    const next = { ...prev };
                    delete next[promo.id];
                    return next;
                });
                await fetchPromotions();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err?.error || 'Хадгалах үед алдаа гарлаа');
            }
        } catch (e) {
            logger.error('Failed to save promotion', { error: e });
            toast.error('Сүлжээний алдаа');
        } finally {
            setSavingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Promotions</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Жилийн захиалгад нэмэлт сар олгох урамшууллыг идэвхжүүлэх ба тохируулах.
                    </p>
                </div>
            </div>

            {promotions.length === 0 ? (
                <Card className="border-gray-100 shadow-sm rounded-2xl bg-white">
                    <CardContent className="p-12 text-center">
                        <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Идэвхтэй promo байхгүй байна.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {promotions.map(promo => {
                        const isActive = getValue(promo, 'is_active') as boolean;
                        const cycles = getValue(promo, 'eligible_billing_cycles') as string[];
                        const slugs = getValue(promo, 'eligible_plan_slugs') as string[];
                        const dirty = !!draft[promo.id];

                        return (
                            <Card
                                key={promo.id}
                                className={`relative border-gray-100 shadow-sm rounded-2xl bg-white overflow-hidden transition-all ${isActive ? 'ring-2 ring-violet-500/40' : ''}`}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center">
                                                <Gift className="w-6 h-6 text-violet-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-lg">{promo.name}</h3>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">{promo.code}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setValue(promo.id, 'is_active', !isActive)}
                                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${isActive ? 'bg-violet-600' : 'bg-gray-200'}`}
                                            aria-label="Promo идэвхжүүлэх"
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-xs text-gray-500">Сүүлийн 30 хоног</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{promo.redemption_count_last30}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-xs text-gray-500">Нийт</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{promo.redemption_count}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                Тайлбар
                                            </label>
                                            <textarea
                                                value={(getValue(promo, 'description') as string | null) ?? ''}
                                                onChange={e => setValue(promo.id, 'description', e.target.value)}
                                                rows={2}
                                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-gray-50 focus:bg-white"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                    Эхлэх
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={toLocalInput(getValue(promo, 'starts_at') as string | null)}
                                                    onChange={e => setValue(promo.id, 'starts_at', fromLocalInput(e.target.value))}
                                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-gray-50 focus:bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                    Дуусах
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={toLocalInput(getValue(promo, 'ends_at') as string | null)}
                                                    onChange={e => setValue(promo.id, 'ends_at', fromLocalInput(e.target.value))}
                                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-gray-50 focus:bg-white"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                Нэмэгдэх сар
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={getValue(promo, 'bonus_months') as number}
                                                onChange={e => setValue(promo.id, 'bonus_months', Number(e.target.value))}
                                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none bg-gray-50 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                Хүчинтэй төлбөрийн циклууд
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {ALL_BILLING_CYCLES.map(cycle => {
                                                    const checked = cycles.includes(cycle);
                                                    return (
                                                        <button
                                                            key={cycle}
                                                            type="button"
                                                            onClick={() => {
                                                                const next = checked
                                                                    ? cycles.filter(c => c !== cycle)
                                                                    : [...cycles, cycle];
                                                                setValue(promo.id, 'eligible_billing_cycles', next);
                                                            }}
                                                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${checked ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                                                        >
                                                            {cycle === 'yearly' ? 'Жил' : 'Сар'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">
                                                Хүчинтэй багцууд
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {plans.length === 0 ? (
                                                    <p className="text-sm text-gray-400">Багц байхгүй</p>
                                                ) : (
                                                    plans.map(plan => {
                                                        const checked = slugs.includes(plan.slug);
                                                        return (
                                                            <button
                                                                key={plan.slug}
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = checked
                                                                        ? slugs.filter(s => s !== plan.slug)
                                                                        : [...slugs, plan.slug];
                                                                    setValue(promo.id, 'eligible_plan_slugs', next);
                                                                }}
                                                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${checked ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                                                            >
                                                                {plan.name}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <p className="text-xs text-gray-400">
                                            {isActive ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                                                    <Power className="w-3.5 h-3.5" /> Идэвхтэй
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Power className="w-3.5 h-3.5" /> Идэвхгүй
                                                </span>
                                            )}
                                        </p>
                                        <Button
                                            disabled={!dirty || savingId === promo.id}
                                            onClick={() => save(promo)}
                                            className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {savingId === promo.id ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4 mr-2" />
                                            )}
                                            Хадгалах
                                        </Button>
                                    </div>

                                    <div className="mt-4 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                                        <p className="text-xs text-amber-800">
                                            ⚠️ Promo идэвхгүй болгосон ч өмнө хэрэглэгчдэд олгосон нэмэлт сар хүчинтэй хэвээр үлдэнэ.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
