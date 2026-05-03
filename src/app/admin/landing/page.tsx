'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Save,
    ChevronDown,
    ChevronRight,
    Plus,
    Trash2,
    GripVertical,
    Loader2,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    Globe,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LandingContent } from '@/lib/landing/types';
import { defaultLandingContent } from '@/lib/landing/defaults';

// ─── Section Panel ───
function SectionPanel({
    title,
    description,
    children,
    onSave,
    saving,
    dirty,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
    onSave: () => void;
    saving: boolean;
    dirty: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm mb-4 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-6 py-5 hover:bg-gray-50/50 transition-colors"
            >
                {open ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <div className="flex-1 text-left">
                    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                </div>
                {dirty && (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 px-2.5 py-1 rounded-full">
                        Өөрчлөгдсөн
                    </span>
                )}
            </button>

            {open && (
                <div className="border-t border-gray-100 px-6 py-6 space-y-5">
                    {children}
                    <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-gray-100">
                        <button
                            onClick={onSave}
                            disabled={saving || !dirty}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold shadow-sm shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-700 transition-all"
                        >
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Хадгалах
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Input Field ───
function Field({
    label,
    value,
    onChange,
    multiline,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
}) {
    const cls =
        'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all';

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            {multiline ? (
                <textarea
                    className={cls + ' min-h-[100px] resize-y'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            ) : (
                <input
                    type="text"
                    className={cls}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            )}
        </div>
    );
}

// ─── Toggle pill (label + checkbox) ───
function TogglePill({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span
                className={`relative inline-block h-5 w-9 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-gray-300'
                    }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'
                        }`}
                />
            </span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only"
            />
        </label>
    );
}

// ─── Select ───
function Select<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <select
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

// ─── Pricing editor (full schema) ───
function PricingEditor({
    pricing,
    onChange,
}: {
    pricing: import('@/lib/landing/types').PricingContent;
    onChange: (next: import('@/lib/landing/types').PricingContent) => void;
}) {
    type T = import('@/lib/landing/types').PricingContent;
    type PlanKey = 'lite' | 'starter' | 'pro' | 'business';
    const PLAN_KEYS: PlanKey[] = ['lite', 'starter', 'pro', 'business'];

    const setPlan = (key: PlanKey, plan: T[PlanKey]) => onChange({ ...pricing, [key]: plan });

    return (
        <div className="space-y-5">
            {/* Section-level */}
            <div className="grid grid-cols-2 gap-3">
                <Field
                    label="Eyebrow дугаар"
                    value={pricing.eyebrowNum}
                    onChange={(v) => onChange({ ...pricing, eyebrowNum: v })}
                />
                <Field
                    label="Секцийн нэр"
                    value={pricing.sectionLabel}
                    onChange={(v) => onChange({ ...pricing, sectionLabel: v })}
                />
            </div>

            <div className="grid grid-cols-3 gap-3">
                <Field
                    label="Гарчиг — 1-р мөр"
                    value={pricing.headlineLines.line1}
                    onChange={(v) => onChange({ ...pricing, headlineLines: { ...pricing.headlineLines, line1: v } })}
                />
                <Field
                    label="Гарчиг — налуу"
                    value={pricing.headlineLines.emphasis}
                    onChange={(v) => onChange({ ...pricing, headlineLines: { ...pricing.headlineLines, emphasis: v } })}
                />
                <Field
                    label="Гарчиг — gradient үг"
                    value={pricing.headlineLines.gradient}
                    onChange={(v) => onChange({ ...pricing, headlineLines: { ...pricing.headlineLines, gradient: v } })}
                />
            </div>

            <Field
                label="Дэд гарчиг (lede)"
                value={pricing.lede}
                onChange={(v) => onChange({ ...pricing, lede: v })}
                multiline
            />

            <div className="grid grid-cols-3 gap-3">
                <Select<'monthly' | 'annual'>
                    label="Toggle анхны төлөв"
                    value={pricing.toggle.defaultMode}
                    options={[
                        { value: 'annual', label: 'Жилээр' },
                        { value: 'monthly', label: 'Сар бүр' },
                    ]}
                    onChange={(v) => onChange({ ...pricing, toggle: { ...pricing.toggle, defaultMode: v } })}
                />
                <Field
                    label="Toggle хямдралын шошго"
                    value={pricing.toggle.savePill}
                    onChange={(v) => onChange({ ...pricing, toggle: { ...pricing.toggle, savePill: v } })}
                    placeholder="−30% ХЯМД"
                />
                <Field
                    label="Plan tag дээрх хямдрал"
                    value={pricing.toggle.discountBadge}
                    onChange={(v) => onChange({ ...pricing, toggle: { ...pricing.toggle, discountBadge: v } })}
                    placeholder="−30%"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Trust line (мөр бүр нэг)
                </label>
                <textarea
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white min-h-[100px] resize-y transition-all"
                    value={pricing.trustLine.join('\n')}
                    onChange={(e) =>
                        onChange({ ...pricing, trustLine: e.target.value.split('\n').filter((s) => s.length > 0) })
                    }
                />
            </div>

            {/* Plan cards */}
            <div className="space-y-4 pt-3 border-t border-gray-100">
                {PLAN_KEYS.map((key) => (
                    <PlanEditor
                        key={key}
                        planKey={key}
                        plan={pricing[key]}
                        onChange={(next) => setPlan(key, next)}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Per-plan editor ───
function PlanEditor({
    planKey,
    plan,
    onChange,
}: {
    planKey: 'lite' | 'starter' | 'pro' | 'business';
    plan: import('@/lib/landing/types').PlanCard;
    onChange: (next: import('@/lib/landing/types').PlanCard) => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
                <span className="font-bold text-gray-900 text-sm uppercase tracking-wider">{plan.tag} — {planKey}</span>
                {open ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
            </button>

            {open && (
                <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/40">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Tag (томоор)" value={plan.tag} onChange={(v) => onChange({ ...plan, tag: v })} />
                        <Select
                            label="Accent өнгө"
                            value={plan.accent}
                            options={[
                                { value: 'warm', label: 'Warm (cream)' },
                                { value: 'lime', label: 'Lime' },
                                { value: 'pink', label: 'Pink' },
                                { value: 'indigo', label: 'Indigo' },
                            ]}
                            onChange={(v) => onChange({ ...plan, accent: v })}
                        />
                    </div>
                    <Field
                        label="Тайлбар"
                        value={plan.desc}
                        onChange={(v) => onChange({ ...plan, desc: v })}
                    />
                    <div className="flex items-center gap-6">
                        <TogglePill
                            label="Featured (glow)"
                            checked={!!plan.featured}
                            onChange={(v) => onChange({ ...plan, featured: v })}
                        />
                        <TogglePill
                            label="−30% шошго харуулах"
                            checked={!!plan.showDiscountBadge}
                            onChange={(v) => onChange({ ...plan, showDiscountBadge: v })}
                        />
                    </div>

                    {/* Banner */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Banner</legend>
                        <TogglePill
                            label="Banner идэвхтэй"
                            checked={!!plan.banner}
                            onChange={(v) =>
                                onChange({
                                    ...plan,
                                    banner: v ? { text: plan.banner?.text ?? '', variant: plan.banner?.variant ?? 'accent' } : undefined,
                                })
                            }
                        />
                        {plan.banner && (
                            <div className="grid grid-cols-2 gap-3">
                                <Field
                                    label="Banner текст"
                                    value={plan.banner.text}
                                    onChange={(v) => onChange({ ...plan, banner: { ...plan.banner!, text: v } })}
                                />
                                <Select
                                    label="Variant"
                                    value={plan.banner.variant}
                                    options={[
                                        { value: 'muted', label: 'Muted (cаарал)' },
                                        { value: 'accent', label: 'Accent (өнгөт)' },
                                        { value: 'indigo', label: 'Indigo' },
                                    ]}
                                    onChange={(v) => onChange({ ...plan, banner: { ...plan.banner!, variant: v } })}
                                />
                            </div>
                        )}
                    </fieldset>

                    {/* Credit block */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Credit block</legend>
                        <div className="grid grid-cols-[80px_1fr] gap-3">
                            <Field
                                label="Icon"
                                value={plan.credit.icon}
                                onChange={(v) => onChange({ ...plan, credit: { ...plan.credit, icon: v } })}
                            />
                            <Field
                                label="Гол текст"
                                value={plan.credit.headline}
                                onChange={(v) => onChange({ ...plan, credit: { ...plan.credit, headline: v } })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Дэд мөрүүд (мөр бүр нэг)</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white min-h-[80px] resize-y transition-all"
                                value={plan.credit.lines.join('\n')}
                                onChange={(e) =>
                                    onChange({
                                        ...plan,
                                        credit: {
                                            ...plan.credit,
                                            lines: e.target.value.split('\n').filter((s) => s.length > 0),
                                        },
                                    })
                                }
                            />
                        </div>
                        <TogglePill
                            label="Доод тогтмол шошго (fixed)"
                            checked={!!plan.credit.fixed}
                            onChange={(v) =>
                                onChange({
                                    ...plan,
                                    credit: {
                                        ...plan.credit,
                                        fixed: v ? plan.credit.fixed ?? { icon: '✓', text: '' } : undefined,
                                    },
                                })
                            }
                        />
                        {plan.credit.fixed && (
                            <div className="grid grid-cols-[80px_1fr] gap-3">
                                <Field
                                    label="Icon"
                                    value={plan.credit.fixed.icon}
                                    onChange={(v) =>
                                        onChange({
                                            ...plan,
                                            credit: { ...plan.credit, fixed: { ...plan.credit.fixed!, icon: v } },
                                        })
                                    }
                                />
                                <Field
                                    label="Текст"
                                    value={plan.credit.fixed.text}
                                    onChange={(v) =>
                                        onChange({
                                            ...plan,
                                            credit: { ...plan.credit, fixed: { ...plan.credit.fixed!, text: v } },
                                        })
                                    }
                                />
                            </div>
                        )}
                    </fieldset>

                    {/* Price */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Үнэ</legend>
                        <div className="grid grid-cols-3 gap-3">
                            <Field
                                label="Сар бүр — үнэ"
                                value={plan.price.monthly.value}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: { ...plan.price, monthly: { ...plan.price.monthly, value: v } },
                                    })
                                }
                            />
                            <Field
                                label="Сар бүр — strike"
                                value={plan.price.monthly.strike ?? ''}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: {
                                            ...plan.price,
                                            monthly: { ...plan.price.monthly, strike: v || undefined },
                                        },
                                    })
                                }
                                placeholder="(хоосон бол харагдахгүй)"
                            />
                            <Field
                                label="Сар бүр — per"
                                value={plan.price.monthly.per ?? ''}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: {
                                            ...plan.price,
                                            monthly: { ...plan.price.monthly, per: v || undefined },
                                        },
                                    })
                                }
                                placeholder="/сар"
                            />
                            <Field
                                label="Жилээр — үнэ"
                                value={plan.price.annual.value}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: { ...plan.price, annual: { ...plan.price.annual, value: v } },
                                    })
                                }
                            />
                            <Field
                                label="Жилээр — strike"
                                value={plan.price.annual.strike ?? ''}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: {
                                            ...plan.price,
                                            annual: { ...plan.price.annual, strike: v || undefined },
                                        },
                                    })
                                }
                                placeholder="(хоосон бол харагдахгүй)"
                            />
                            <Field
                                label="Жилээр — per"
                                value={plan.price.annual.per ?? ''}
                                onChange={(v) =>
                                    onChange({
                                        ...plan,
                                        price: {
                                            ...plan.price,
                                            annual: { ...plan.price.annual, per: v || undefined },
                                        },
                                    })
                                }
                                placeholder="/жил"
                            />
                        </div>
                    </fieldset>

                    {/* CTA */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">CTA товч</legend>
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                label="Текст"
                                value={plan.cta.text}
                                onChange={(v) => onChange({ ...plan, cta: { ...plan.cta, text: v } })}
                            />
                            <Field
                                label="Холбоос (href)"
                                value={plan.cta.href}
                                onChange={(v) => onChange({ ...plan, cta: { ...plan.cta, href: v } })}
                            />
                        </div>
                    </fieldset>

                    {/* Save text */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Хэмнэлт текст</legend>
                        <Field
                            label="Жилээр горимд харуулах"
                            value={plan.save?.annual ?? ''}
                            onChange={(v) =>
                                onChange({ ...plan, save: { ...plan.save, annual: v || undefined } })
                            }
                        />
                        <Field
                            label="Сар бүр горимд харуулах"
                            value={plan.save?.monthly ?? ''}
                            onChange={(v) =>
                                onChange({ ...plan, save: { ...plan.save, monthly: v || undefined } })
                            }
                        />
                    </fieldset>

                    {/* Features */}
                    <fieldset className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                        <legend className="px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Боломжуудын жагсаалт
                        </legend>
                        <div className="space-y-2">
                            {plan.features.map((row, i) => (
                                <FeatureRowEditor
                                    key={i}
                                    row={row}
                                    isFirst={i === 0}
                                    isLast={i === plan.features.length - 1}
                                    onChange={(next) => {
                                        const features = [...plan.features];
                                        features[i] = next;
                                        onChange({ ...plan, features });
                                    }}
                                    onMove={(dir) => {
                                        const features = [...plan.features];
                                        const target = dir === 'up' ? i - 1 : i + 1;
                                        if (target < 0 || target >= features.length) return;
                                        [features[i], features[target]] = [features[target], features[i]];
                                        onChange({ ...plan, features });
                                    }}
                                    onRemove={() =>
                                        onChange({ ...plan, features: plan.features.filter((_, idx) => idx !== i) })
                                    }
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() =>
                                    onChange({ ...plan, features: [...plan.features, { kind: 'ok', text: '' }] })
                                }
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> ✓ Мөр нэмэх
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    onChange({ ...plan, features: [...plan.features, { kind: 'no', text: '' }] })
                                }
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> × Мөр нэмэх
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    onChange({ ...plan, features: [...plan.features, { kind: 'section', text: '' }] })
                                }
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-700 border border-gray-200 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Section header
                            </button>
                        </div>
                    </fieldset>
                </div>
            )}
        </div>
    );
}

// ─── Feature row editor ───
function FeatureRowEditor({
    row,
    isFirst,
    isLast,
    onChange,
    onMove,
    onRemove,
}: {
    row: import('@/lib/landing/types').FeatureRow;
    isFirst: boolean;
    isLast: boolean;
    onChange: (next: import('@/lib/landing/types').FeatureRow) => void;
    onMove: (dir: 'up' | 'down') => void;
    onRemove: () => void;
}) {
    const kindLabel = row.kind === 'ok' ? '✓' : row.kind === 'no' ? '×' : '§';
    const kindBg =
        row.kind === 'ok'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : row.kind === 'no'
                ? 'bg-gray-100 text-gray-500 border-gray-200'
                : 'bg-violet-50 text-violet-700 border-violet-200';

    return (
        <div className="flex items-start gap-2">
            <div className={`shrink-0 inline-flex items-center justify-center w-7 h-9 rounded-lg border text-sm font-bold ${kindBg}`}>
                {kindLabel}
            </div>
            <div className="flex-1 space-y-2">
                <input
                    type="text"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    value={row.text}
                    placeholder={row.kind === 'section' ? 'SECTION HEADER' : 'Boломжийн текст'}
                    onChange={(e) => onChange({ ...row, text: e.target.value } as import('@/lib/landing/types').FeatureRow)}
                />
                {row.kind === 'ok' && (
                    <div className="flex items-end gap-2">
                        <TogglePill
                            label="Pill шошго"
                            checked={!!row.pill}
                            onChange={(v) =>
                                onChange({
                                    ...row,
                                    pill: v ? row.pill ?? { text: '', variant: 'warm' } : undefined,
                                })
                            }
                        />
                        {row.pill && (
                            <>
                                <input
                                    type="text"
                                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    placeholder="Pill text"
                                    value={row.pill.text}
                                    onChange={(e) => onChange({ ...row, pill: { ...row.pill!, text: e.target.value } })}
                                />
                                <select
                                    className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    value={row.pill.variant}
                                    onChange={(e) =>
                                        onChange({
                                            ...row,
                                            pill: { ...row.pill!, variant: e.target.value as 'warm' | 'lime' },
                                        })
                                    }
                                >
                                    <option value="warm">warm</option>
                                    <option value="lime">lime</option>
                                </select>
                            </>
                        )}
                    </div>
                )}
            </div>
            <div className="shrink-0 flex flex-col gap-1">
                <button
                    type="button"
                    onClick={() => onMove('up')}
                    disabled={isFirst}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1"
                    aria-label="Дээш"
                >
                    ▲
                </button>
                <button
                    type="button"
                    onClick={() => onMove('down')}
                    disabled={isLast}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs px-1"
                    aria-label="Доош"
                >
                    ▼
                </button>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="shrink-0 text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg p-2 hover:bg-red-50 hover:border-red-200 transition-colors"
                aria-label="Устгах"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Main Page ───
export default function LandingCMSPage() {
    const [content, setContent] = useState<LandingContent>(defaultLandingContent);
    const [original, setOriginal] = useState<LandingContent>(defaultLandingContent);
    const [loading, setLoading] = useState(true);
    const [savingSection, setSavingSection] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // Load content
    useEffect(() => {
        fetch('/api/dashboard/landing-content')
            .then((r) => r.json())
            .then((data) => {
                setContent(data);
                setOriginal(data);
            })
            .catch(() => toast.error('Контент ачааллахад алдаа гарлаа'))
            .finally(() => setLoading(false));
    }, []);

    const isDirty = useCallback(
        (section: keyof LandingContent) => {
            return JSON.stringify(content[section]) !== JSON.stringify(original[section]);
        },
        [content, original]
    );

    const saveSection = async (section: keyof LandingContent) => {
        setSavingSection(section);
        try {
            const res = await fetch('/api/dashboard/landing-content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section, data: content[section] }),
            });
            if (!res.ok) throw new Error('Failed');
            setOriginal((prev) => ({ ...prev, [section]: content[section] }));
            setLastSaved(section);
            toast.success(`${section} хадгалагдлаа`);
            setTimeout(() => setLastSaved(null), 2000);
        } catch {
            toast.error('Хадгалахад алдаа гарлаа');
        } finally {
            setSavingSection(null);
        }
    };

    const updateContent = <K extends keyof LandingContent>(section: K, value: LandingContent[K]) => {
        setContent((prev) => ({ ...prev, [section]: value }));
    };

    const resetSection = (section: keyof LandingContent) => {
        setContent((prev) => ({ ...prev, [section]: defaultLandingContent[section] }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center p-3">
                            <Globe className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Landing Page</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Контент удирдлага</p>
                        </div>
                    </div>
                </div>
                <a
                    href="/"
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm bg-white"
                >
                    <Globe className="w-3.5 h-3.5" />
                    Үзэх
                </a>
            </div>

            {/* ═══ HERO ═══ */}
            <SectionPanel
                title="Hero"
                description="Нүүр хуудасны гол хэсэг — гарчиг, тайлбар, товч"
                onSave={() => saveSection('hero')}
                saving={savingSection === 'hero'}
                dirty={isDirty('hero')}
            >
                <Field
                    label="Badge текст"
                    value={content.hero.badge}
                    onChange={(v) => updateContent('hero', { ...content.hero, badge: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Гарчиг — 1-р мөр"
                        value={content.hero.headingLine1}
                        onChange={(v) => updateContent('hero', { ...content.hero, headingLine1: v })}
                    />
                    <Field
                        label="Гарчиг — Тодруулсан"
                        value={content.hero.headingHighlight}
                        onChange={(v) => updateContent('hero', { ...content.hero, headingHighlight: v })}
                    />
                </div>
                <Field
                    label="Тайлбар текст"
                    value={content.hero.sub}
                    onChange={(v) => updateContent('hero', { ...content.hero, sub: v })}
                    multiline
                />
                <Field
                    label="CTA товчны текст"
                    value={content.hero.ctaText}
                    onChange={(v) => updateContent('hero', { ...content.hero, ctaText: v })}
                />
            </SectionPanel>

            {/* ═══ METRICS ═══ */}
            <SectionPanel
                title="Тоон үзүүлэлт"
                description="Hero-ийн доорх 4 статистик тоо"
                onSave={() => saveSection('metrics')}
                saving={savingSection === 'metrics'}
                dirty={isDirty('metrics')}
            >
                {content.metrics.map((m, i) => (
                    <div key={i} className="flex items-end gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="flex-1">
                            <Field
                                label={`#${i + 1} Утга`}
                                value={m.value}
                                onChange={(v) => {
                                    const updated = [...content.metrics];
                                    updated[i] = { ...updated[i], value: v };
                                    updateContent('metrics', updated);
                                }}
                            />
                        </div>
                        <div className="flex-1">
                            <Field
                                label="Нэр"
                                value={m.label}
                                onChange={(v) => {
                                    const updated = [...content.metrics];
                                    updated[i] = { ...updated[i], label: v };
                                    updateContent('metrics', updated);
                                }}
                            />
                        </div>
                        <button
                            onClick={() => {
                                const updated = content.metrics.filter((_, idx) => idx !== i);
                                updateContent('metrics', updated);
                            }}
                            className="p-2.5 text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg p-2 hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => updateContent('metrics', [...content.metrics, { value: '', label: '' }])}
                    className="inline-flex items-center gap-1.5 text-[12px] text-violet-600 hover:text-indigo-300 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Нэмэх
                </button>
            </SectionPanel>

            {/* ═══ FEATURES ═══ */}
            <SectionPanel
                title="Боломжууд"
                description="Platform-ийн үндсэн боломжуудын жагсаалт"
                onSave={() => saveSection('features')}
                saving={savingSection === 'features'}
                dirty={isDirty('features')}
            >
                <Field
                    label="Секцийн нэр"
                    value={content.features.sectionLabel}
                    onChange={(v) => updateContent('features', { ...content.features, sectionLabel: v })}
                />
                <Field
                    label="Гарчиг"
                    value={content.features.sectionTitle}
                    onChange={(v) => updateContent('features', { ...content.features, sectionTitle: v })}
                />
                <Field
                    label="Тайлбар"
                    value={content.features.sectionDesc}
                    onChange={(v) => updateContent('features', { ...content.features, sectionDesc: v })}
                    multiline
                />

                <div className="space-y-3 mt-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Боломжуудын жагсаалт</p>
                    {content.features.items.map((item, i) => (
                        <div key={i} className="p-5 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">#{i + 1}</span>
                                <button
                                    onClick={() => {
                                        const updated = { ...content.features, items: content.features.items.filter((_, idx) => idx !== i) };
                                        updateContent('features', updated);
                                    }}
                                    className="text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg p-2 hover:bg-red-50 hover:border-red-200 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <Field
                                label="Нэр"
                                value={item.title}
                                onChange={(v) => {
                                    const items = [...content.features.items];
                                    items[i] = { ...items[i], title: v };
                                    updateContent('features', { ...content.features, items });
                                }}
                            />
                            <Field
                                label="Тайлбар"
                                value={item.desc}
                                onChange={(v) => {
                                    const items = [...content.features.items];
                                    items[i] = { ...items[i], desc: v };
                                    updateContent('features', { ...content.features, items });
                                }}
                                multiline
                            />
                        </div>
                    ))}
                    <button
                        onClick={() => {
                            updateContent('features', {
                                ...content.features,
                                items: [...content.features.items, { title: '', desc: '' }],
                            });
                        }}
                        className="inline-flex items-center gap-1.5 text-[12px] text-violet-600 hover:text-indigo-300 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Боломж нэмэх
                    </button>
                </div>
            </SectionPanel>

            {/* ═══ HOW IT WORKS ═══ */}
            <SectionPanel
                title="Хэрхэн ажиллах"
                description="3 алхамт зааварчилгаа"
                onSave={() => saveSection('how_it_works')}
                saving={savingSection === 'how_it_works'}
                dirty={isDirty('how_it_works')}
            >
                <Field
                    label="Секцийн нэр"
                    value={content.how_it_works.sectionLabel}
                    onChange={(v) => updateContent('how_it_works', { ...content.how_it_works, sectionLabel: v })}
                />
                <Field
                    label="Гарчиг"
                    value={content.how_it_works.sectionTitle}
                    onChange={(v) => updateContent('how_it_works', { ...content.how_it_works, sectionTitle: v })}
                />
                {content.how_it_works.items.map((item, i) => (
                    <div key={i} className="p-5 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-violet-600">Алхам {item.step}</span>
                        </div>
                        <Field
                            label="Гарчиг"
                            value={item.title}
                            onChange={(v) => {
                                const items = [...content.how_it_works.items];
                                items[i] = { ...items[i], title: v };
                                updateContent('how_it_works', { ...content.how_it_works, items });
                            }}
                        />
                        <Field
                            label="Тайлбар"
                            value={item.desc}
                            onChange={(v) => {
                                const items = [...content.how_it_works.items];
                                items[i] = { ...items[i], desc: v };
                                updateContent('how_it_works', { ...content.how_it_works, items });
                            }}
                            multiline
                        />
                    </div>
                ))}
            </SectionPanel>

            {/* ═══ SOCIAL PROOF ═══ */}
            <SectionPanel
                title="Тоон харьцуулалт"
                description="Цаг хэмнэлт, орлого өсөлт, бүтээмж нэмэлт"
                onSave={() => saveSection('social_proof')}
                saving={savingSection === 'social_proof'}
                dirty={isDirty('social_proof')}
            >
                <Field
                    label="Секцийн нэр"
                    value={content.social_proof.sectionLabel}
                    onChange={(v) => updateContent('social_proof', { ...content.social_proof, sectionLabel: v })}
                />
                <Field
                    label="Гарчиг"
                    value={content.social_proof.sectionTitle}
                    onChange={(v) => updateContent('social_proof', { ...content.social_proof, sectionTitle: v })}
                />
                {content.social_proof.items.map((item, i) => (
                    <div key={i} className="p-5 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                label="Категори"
                                value={item.category}
                                onChange={(v) => {
                                    const items = [...content.social_proof.items];
                                    items[i] = { ...items[i], category: v };
                                    updateContent('social_proof', { ...content.social_proof, items });
                                }}
                            />
                            <Field
                                label="Үр дүн"
                                value={item.result}
                                onChange={(v) => {
                                    const items = [...content.social_proof.items];
                                    items[i] = { ...items[i], result: v };
                                    updateContent('social_proof', { ...content.social_proof, items });
                                }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                label="Тоо"
                                value={item.stat}
                                onChange={(v) => {
                                    const items = [...content.social_proof.items];
                                    items[i] = { ...items[i], stat: v };
                                    updateContent('social_proof', { ...content.social_proof, items });
                                }}
                            />
                            <Field
                                label="Нэгж"
                                value={item.statSuffix}
                                onChange={(v) => {
                                    const items = [...content.social_proof.items];
                                    items[i] = { ...items[i], statSuffix: v };
                                    updateContent('social_proof', { ...content.social_proof, items });
                                }}
                            />
                        </div>
                    </div>
                ))}
            </SectionPanel>

            {/* ═══ PRICING ═══ */}
            <SectionPanel
                title="Үнийн санал"
                description="LITE, STARTER, PRO, BUSINESS төлөвлөгөө"
                onSave={() => saveSection('pricing')}
                saving={savingSection === 'pricing'}
                dirty={isDirty('pricing')}
            >
                <PricingEditor
                    pricing={content.pricing}
                    onChange={(next) => updateContent('pricing', next)}
                />
            </SectionPanel>

            {/* ═══ FAQ ═══ */}
            <SectionPanel
                title="Түгээмэл асуулт"
                description="FAQ хэсгийн асуулт, хариултууд"
                onSave={() => saveSection('faq')}
                saving={savingSection === 'faq'}
                dirty={isDirty('faq')}
            >
                <Field
                    label="Секцийн нэр"
                    value={content.faq.sectionLabel}
                    onChange={(v) => updateContent('faq', { ...content.faq, sectionLabel: v })}
                />
                <Field
                    label="Гарчиг"
                    value={content.faq.sectionTitle}
                    onChange={(v) => updateContent('faq', { ...content.faq, sectionTitle: v })}
                />
                {content.faq.items.map((item, i) => (
                    <div key={i} className="p-5 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">#{i + 1}</span>
                            <button
                                onClick={() => {
                                    updateContent('faq', { ...content.faq, items: content.faq.items.filter((_, idx) => idx !== i) });
                                }}
                                className="text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg p-2 hover:bg-red-50 hover:border-red-200 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <Field
                            label="Асуулт"
                            value={item.q}
                            onChange={(v) => {
                                const items = [...content.faq.items];
                                items[i] = { ...items[i], q: v };
                                updateContent('faq', { ...content.faq, items });
                            }}
                        />
                        <Field
                            label="Хариулт"
                            value={item.a}
                            onChange={(v) => {
                                const items = [...content.faq.items];
                                items[i] = { ...items[i], a: v };
                                updateContent('faq', { ...content.faq, items });
                            }}
                            multiline
                        />
                    </div>
                ))}
                <button
                    onClick={() => updateContent('faq', { ...content.faq, items: [...content.faq.items, { q: '', a: '' }] })}
                    className="inline-flex items-center gap-1.5 text-[12px] text-violet-600 hover:text-indigo-300 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Асуулт нэмэх
                </button>
            </SectionPanel>

            {/* ═══ CTA ═══ */}
            <SectionPanel
                title="CTA (Дуудлага)"
                description="Хуудасны доод хэсгийн дуудлагын текст"
                onSave={() => saveSection('cta')}
                saving={savingSection === 'cta'}
                dirty={isDirty('cta')}
            >
                <Field
                    label="Гарчиг"
                    value={content.cta.heading}
                    onChange={(v) => updateContent('cta', { ...content.cta, heading: v })}
                />
                <Field
                    label="Тайлбар"
                    value={content.cta.sub}
                    onChange={(v) => updateContent('cta', { ...content.cta, sub: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Товчны текст"
                        value={content.cta.buttonText}
                        onChange={(v) => updateContent('cta', { ...content.cta, buttonText: v })}
                    />
                    <Field
                        label="Линкний текст"
                        value={content.cta.linkText}
                        onChange={(v) => updateContent('cta', { ...content.cta, linkText: v })}
                    />
                </div>
            </SectionPanel>

            {/* Reset to defaults */}
            <div className="flex justify-center pt-4 pb-8">
                <button
                    onClick={() => {
                        if (confirm('Бүх өөрчлөлтийг анхны байдалд нь буцаах уу?')) {
                            setContent(defaultLandingContent);
                            toast.info('Анхны утга руу буцлаа. Хадгалахыг мартуузай.');
                        }
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-xl transition-colors"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Бүгдийг анхны байдалд буцаах
                </button>
            </div>
        </div>
    );
}
