'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Loader2,
    Instagram,
    Facebook,
    Image as ImageIcon,
    Clock,
    X,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { StoryProductLink } from '@/types/database';

interface ProductLite {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
}

const labelCls = 'block text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-1.5';
const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';

export default function StoryProductLinksPage() {
    const [links, setLinks] = useState<StoryProductLink[]>([]);
    const [products, setProducts] = useState<ProductLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [platform, setPlatform] = useState<'instagram' | 'facebook'>('instagram');
    const [productId, setProductId] = useState('');
    const [storyMediaId, setStoryMediaId] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [activeHours, setActiveHours] = useState(24);

    function authHeaders(extra?: Record<string, string>): Record<string, string> {
        const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
        return { ...(shopId ? { 'x-shop-id': shopId } : {}), ...(extra || {}) };
    }

    async function load() {
        setLoading(true);
        try {
            const [lRes, pRes] = await Promise.all([
                fetch('/api/dashboard/story-product-links', { headers: authHeaders() }),
                fetch('/api/dashboard/products', { headers: authHeaders() }),
            ]);
            // A 401/500 must not masquerade as an empty registry — surface it.
            if (!lRes.ok || !pRes.ok) {
                toast.error('Ачаалахад алдаа гарлаа');
                return;
            }
            const lJson = await lRes.json();
            const pJson = await pRes.json();
            setLinks((lJson.links || []) as StoryProductLink[]);
            setProducts(
                ((pJson.products || []) as Array<Record<string, unknown>>).map(p => ({
                    id: String(p.id),
                    name: String(p.name),
                    image_url: (p.image_url as string | null) ?? null,
                    price: Number(p.price) || 0,
                }))
            );
        } catch {
            toast.error('Ачаалахад алдаа гарлаа');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function resetForm() {
        setProductId('');
        setStoryMediaId('');
        setMediaUrl('');
        setActiveHours(24);
        setPlatform('instagram');
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!productId) {
            toast.error('Бараа сонгоно уу');
            return;
        }
        if (platform === 'instagram' && !storyMediaId.trim()) {
            toast.error('Instagram-д Story ID шаардлагатай');
            return;
        }

        setSaving(true);
        try {
            const body: Record<string, unknown> = { product_id: productId, platform };
            if (platform === 'instagram') {
                body.story_media_id = storyMediaId.trim();
                if (mediaUrl.trim()) body.media_url = mediaUrl.trim();
            } else {
                body.active_hours = activeHours;
            }

            const res = await fetch('/api/dashboard/story-product-links', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || 'Холбоос үүсгэж чадсангүй');
                return;
            }
            toast.success('Холбоос нэмэгдлээ');
            setShowForm(false);
            resetForm();
            load();
        } catch {
            toast.error('Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (typeof window !== 'undefined' && !window.confirm('Энэ холбоосыг устгах уу?')) return;
        try {
            const res = await fetch(`/api/dashboard/story-product-links?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            if (!res.ok) {
                toast.error('Устгаж чадсангүй');
                return;
            }
            setLinks(prev => prev.filter(l => l.id !== id));
            toast.success('Устгагдлаа');
        } catch {
            toast.error('Алдаа гарлаа');
        }
    }

    const productName = (l: StoryProductLink) =>
        l.product?.name || products.find(p => p.id === l.product_id)?.name || 'Бараа';

    return (
        <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-12">
            <PageHero
                eyebrow="Story → Бараа"
                eyebrowTone="violet"
                title="Story холбоос"
                subtitle="Story-д хариулсан хэрэглэгчид (ж: «авъя») аль бараа тухай асууж байгааг автоматаар таниулна. Instagram дээр story ID-аар, Facebook дээр идэвхтэй story pin-ээр ажиллана."
                actions={
                    <Button onClick={() => setShowForm(v => !v)} leftIcon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}>
                        {showForm ? 'Болих' : 'Шинэ холбоос'}
                    </Button>
                }
            />

            {/* Create form */}
            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-5 space-y-4"
                >
                    {/* Platform tabs */}
                    <div className="flex gap-2">
                        {(['instagram', 'facebook'] as const).map(pf => (
                            <button
                                key={pf}
                                type="button"
                                onClick={() => setPlatform(pf)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] border transition-colors',
                                    platform === pf
                                        ? 'border-[var(--border-accent)] bg-white/[0.06] text-foreground'
                                        : 'border-white/[0.08] text-white/50 hover:text-white/80'
                                )}
                            >
                                {pf === 'instagram' ? <Instagram className="w-3.5 h-3.5" /> : <Facebook className="w-3.5 h-3.5" />}
                                {pf === 'instagram' ? 'Instagram' : 'Facebook'}
                            </button>
                        ))}
                    </div>

                    {/* Product picker */}
                    <div>
                        <label className={labelCls}>Бараа</label>
                        <select className={inputCls} value={productId} onChange={e => setProductId(e.target.value)}>
                            <option value="">— Бараа сонгох —</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.price.toLocaleString()}₮)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* IG: story id + media url */}
                    {platform === 'instagram' && (
                        <>
                            <div>
                                <label className={labelCls}>Story ID (reply_to.story.id)</label>
                                <input
                                    className={inputCls}
                                    value={storyMediaId}
                                    onChange={e => setStoryMediaId(e.target.value)}
                                    placeholder="Instagram story-ийн media ID"
                                />
                                <p className="mt-1 text-[11px] text-white/35">
                                    Story-д хариу ирэхэд webhook log-д харагдах story ID-г энд оруулна.
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>Story зургийн URL (заавал биш)</label>
                                <input
                                    className={inputCls}
                                    value={mediaUrl}
                                    onChange={e => setMediaUrl(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                        </>
                    )}

                    {/* FB: active pin hours */}
                    {platform === 'facebook' && (
                        <div>
                            <label className={labelCls}>Идэвхтэй хугацаа (цаг)</label>
                            <input
                                type="number"
                                min={1}
                                max={168}
                                className={inputCls}
                                value={activeHours}
                                onChange={e => setActiveHours(Math.max(1, Math.min(168, Number(e.target.value) || 1)))}
                            />
                            <p className="mt-1 text-[11px] text-white/35">
                                Facebook story ID өгдөггүй тул энэ хугацаанд ирэх FB зурвасуудад энэ барааг зөөлөн
                                контекст болгож өгнө. Story дуусахад тааруулж тохируулна уу (ихэвчлэн 24 цаг).
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>
                            Болих
                        </Button>
                        <Button type="submit" loading={saving} leftIcon={<Plus className="w-4 h-4" />}>
                            Нэмэх
                        </Button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="mt-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                    </div>
                ) : links.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-16">
                        <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-3">
                            <ImageIcon className="w-7 h-7 text-violet-300" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm text-white/55 max-w-sm">
                            Одоогоор холбоос алга. Story-г бараатай холбовол хэрэглэгчийн «авъя» хариу шууд зөв бараа руу холбогдоно.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {links.map(l => (
                            <div
                                key={l.id}
                                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
                                    {l.product?.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={l.product.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="w-4 h-4 text-white/30" />
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-foreground truncate">{productName(l)}</span>
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border',
                                                l.platform === 'instagram'
                                                    ? 'border-pink-500/20 text-pink-300 bg-pink-500/5'
                                                    : 'border-blue-500/20 text-blue-300 bg-blue-500/5'
                                            )}
                                        >
                                            {l.platform === 'instagram' ? <Instagram className="w-2.5 h-2.5" /> : <Facebook className="w-2.5 h-2.5" />}
                                            {l.platform}
                                        </span>
                                        {l.source !== 'manual' && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] border border-white/10 text-white/40">
                                                {l.source === 'vision_auto' ? 'auto' : l.source}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-white/40 truncate">
                                        {l.platform === 'instagram' ? (
                                            <span>Story ID: {l.story_media_id}</span>
                                        ) : l.active_until ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(l.active_until) > new Date() ? 'Идэвхтэй' : 'Дууссан'} —{' '}
                                                {new Date(l.active_until).toLocaleString('mn-MN')}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(l.id)}
                                    className="p-2 rounded-lg text-white/30 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                                    aria-label="Устгах"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
