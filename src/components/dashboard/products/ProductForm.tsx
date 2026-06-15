'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Upload, Box, Layers, Calendar, Plus, X, Trash2 } from 'lucide-react';
import { Product, ProductVariant, useCreateProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';

interface ProductFormProps {
    product?: Product | null;
    onSuccess: () => void;
    onCancel: () => void;
}

// Local variant type for form (before saving to DB)
interface FormVariant {
    name: string;
    options: Record<string, string>;
    price: number;
    stock: number;
    is_active: boolean;
}

export default function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
    const createProduct = useCreateProduct();
    const updateProduct = useUpdateProduct();
    const { user, shop } = useAuth();

    // Service & beauty businesses don't ship physical goods. Hide the
    // "Бараа" tab and default new entries to "Үйлчилгээ" so neither stock
    // nor delivery sections appear.
    const isServiceBusiness = shop?.business_type === 'service' || shop?.business_type === 'beauty';

    const [saving, setSaving] = useState(false);
    // Талбар бүрийн validation алдаа — alert-ийн оронд талбарын доор улаанаар харуулна
    const [fieldErrors, setFieldErrors] = useState<{ price?: string; discount?: string; stock?: string }>({});
    const [productType, setProductType] = useState<'physical' | 'service' | 'appointment'>(
        product?.type ?? (isServiceBusiness ? 'service' : 'physical')
    );
    // Per-product delivery is now a binary "deliverable vs pickup only" toggle.
    // Pricing (UB / province / free threshold) lives at the shop level under
    // Settings → Хүргэлтийн бодлого. Old products with delivery_type='paid'
    // are treated as 'included' here so their existing UI maps to "Хүргэгдэнэ".
    const initialDeliveryType = (() => {
        const t = product?.delivery_type;
        if (t === 'pickup_only') return 'pickup_only';
        return 'included';
    })();
    const [deliveryType, setDeliveryType] = useState<string>(initialDeliveryType);
    // Тухайн бараанд онцлох хүргэлтийн хугацааны тайлбар (заавал биш)
    const [deliveryNote, setDeliveryNote] = useState<string>(
        (product as unknown as { delivery_note?: string })?.delivery_note ?? ''
    );

    // Lifecycle status (#8/#9/#10): controls how the AI talks about availability.
    type ProductLifecycle = 'draft' | 'active' | 'pre_order' | 'coming_soon' | 'discontinued';
    const initialStatus: ProductLifecycle =
        ((product as unknown as { status?: ProductLifecycle })?.status) ?? 'active';
    const [productStatus, setProductStatus] = useState<ProductLifecycle>(initialStatus);
    const [availableFrom, setAvailableFrom] = useState<string>(
        (product as unknown as { available_from?: string })?.available_from?.slice(0, 10) ?? ''
    );
    const [preOrderEta, setPreOrderEta] = useState<string>(
        (product as unknown as { pre_order_eta?: string })?.pre_order_eta?.slice(0, 10) ?? ''
    );

    // Per-product AI training note (#2)
    const [aiInstructions, setAiInstructions] = useState<string>(
        (product as unknown as { ai_instructions?: string })?.ai_instructions ?? ''
    );

    // Image State — up to 3 images per product. Existing rows that already
    // have a URL stay as `existingUrl`, newly picked files are tracked
    // alongside via blob preview URLs that we revoke on unmount.
    const MAX_IMAGES = 3;
    type ImageSlot = { existingUrl: string | null; file: File | null; previewUrl: string | null };
    const initialImageSlots: ImageSlot[] = (() => {
        const urls = (product?.images ?? []).slice(0, MAX_IMAGES);
        const slots: ImageSlot[] = urls.map((u) => ({ existingUrl: u, file: null, previewUrl: u }));
        while (slots.length < MAX_IMAGES) {
            slots.push({ existingUrl: null, file: null, previewUrl: null });
        }
        return slots;
    })();
    const [imageSlots, setImageSlots] = useState<ImageSlot[]>(initialImageSlots);

    // Variant State
    const [hasVariants, setHasVariants] = useState(product?.has_variants || false);
    const [variants, setVariants] = useState<FormVariant[]>(
        (product?.variants || []).map(v => ({
            name: v.name,
            options: v.options,
            price: v.price ?? product?.price ?? 0,
            stock: v.stock,
            is_active: v.is_active
        }))
    );
    // Хувилбартай барааны нийт нөөцийн дээд хязгаар (макс.). Хувилбаруудын
    // үлдэгдлийн нийлбэр үүнээс хэтрэхгүй. Засах үед одоогийн нийлбэрээр эхэлнэ.
    const [maxStock, setMaxStock] = useState<string>(() => {
        const sum = (product?.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
        return sum > 0 ? String(sum) : '';
    });

    // Initial load of variants if editing
    useEffect(() => {
        if (product?.variants && product.variants.length > 0) {
            setHasVariants(true);
            // Convert ProductVariant to FormVariant
            setVariants(product.variants.map(v => ({
                name: v.name,
                options: v.options,
                price: v.price ?? product?.price ?? 0,
                stock: v.stock,
                is_active: v.is_active
            })));
        }
    }, [product]);

    // Шинэ хувилбар нэмэх — нэрлээд ард нь үнэ/тоо ширхэгийг шууд бичнэ
    const addVariant = () => {
        setVariants(prev => [...prev, {
            name: '',
            options: {},
            price: product?.price || 0,
            stock: 0,
            is_active: true,
        }]);
    };

    const updateVariantName = (idx: number, name: string) => {
        setVariants(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], name };
            return next;
        });
    };

    const removeVariant = (idx: number) => {
        setVariants(prev => prev.filter((_, i) => i !== idx));
    };

    // Хувилбаруудын нийт үлдэгдэл (физик бараанд тоо ширхэгийн нийлбэр харуулна)
    const variantsTotalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    const maxStockNum = maxStock.trim() === '' ? null : Math.max(0, Number(maxStock) || 0);
    const stockRemaining = maxStockNum == null ? null : maxStockNum - variantsTotalStock;

    // Хувилбарын үлдэгдлийг өөрчлөхөд нийт макс хязгаараас хэтрэхгүй болгож таслана
    const setVariantStock = (idx: number, raw: number) => {
        setVariants(prev => {
            const next = [...prev];
            let value = Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
            if (maxStockNum != null) {
                const others = prev.reduce((s, v, i) => s + (i === idx ? 0 : Number(v.stock) || 0), 0);
                value = Math.min(value, Math.max(0, maxStockNum - others));
            }
            next[idx] = { ...next[idx], stock: value };
            return next;
        });
    };

    useEffect(() => {
        if (product) {
            setProductType(product.type || 'physical');
            const urls = (product.images ?? []).slice(0, MAX_IMAGES);
            const slots: ImageSlot[] = urls.map((u) => ({ existingUrl: u, file: null, previewUrl: u }));
            while (slots.length < MAX_IMAGES) {
                slots.push({ existingUrl: null, file: null, previewUrl: null });
            }
            setImageSlots(slots);
            setHasVariants(product.has_variants || false);
        }
        return () => {
            // Revoke any blob URLs we created so they don't leak between renders.
            for (const slot of imageSlots) {
                if (slot.previewUrl && slot.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(slot.previewUrl);
                }
            }
        };
        // imageSlots intentionally omitted: only the cleanup needs current values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product]);

    const handleImageSelectAt = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageSlots((prev) => {
            const next = [...prev];
            const old = next[index];
            if (old?.previewUrl && old.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(old.previewUrl);
            }
            next[index] = {
                existingUrl: old?.existingUrl ?? null,
                file,
                previewUrl: URL.createObjectURL(file),
            };
            return next;
        });
        // Reset the input so picking the same file again still fires onChange.
        e.target.value = '';
    };

    const handleImageRemoveAt = (index: number) => () => {
        setImageSlots((prev) => {
            const next = [...prev];
            const old = next[index];
            if (old?.previewUrl && old.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(old.previewUrl);
            }
            next[index] = { existingUrl: null, file: null, previewUrl: null };
            return next;
        });
    };

    const uploadImage = async (file: File) => {
        if (!user) throw new Error("Нэвтрээгүй байна");
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/dashboard/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Image upload failed');
        const data = await res.json();
        return data.url;
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // Тоон утгуудын хязгаарыг шалгана
        const priceValue = Number(formData.get('price'));
        const discountValue = Number(formData.get('discount')) || 0;
        const stockValue = Number(formData.get('stock')) || 0;
        const errors: typeof fieldErrors = {};
        if (!Number.isFinite(priceValue) || priceValue < 0) {
            errors.price = 'Үнэ 0-ээс бага байж болохгүй';
        }
        if (discountValue < 0 || discountValue > 100) {
            errors.discount = 'Хямдрал 0-100% хооронд байх ёстой';
        }
        if (productType === 'physical' && !hasVariants && stockValue < 0) {
            errors.stock = 'Үлдэгдэл 0-ээс бага байж болохгүй';
        }
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        // Хувилбартай бараанд нийт нөөцийн макс хязгаараас хэтэрсэн эсэхийг шалгана
        if (productType === 'physical' && hasVariants && maxStockNum != null && variantsTotalStock > maxStockNum) {
            toast.error(`Хувилбаруудын нийт үлдэгдэл (${variantsTotalStock}) нийт нөөцөөс (${maxStockNum}) хэтэрсэн байна`);
            return;
        }

        setSaving(true);

        try {
            // Resolve every image slot in parallel: keep its existingUrl if no
            // new file was picked, otherwise upload the file and use the
            // returned URL. Empty slots drop out.
            const imageUrls = (
                await Promise.all(
                    imageSlots.map(async (slot) => {
                        if (slot.file) return await uploadImage(slot.file);
                        if (slot.existingUrl) return slot.existingUrl;
                        return null;
                    }),
                )
            ).filter((u): u is string => !!u);

            const productData: Record<string, unknown> = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                price: Number(formData.get('price')),
                discountPercent: Number(formData.get('discount')) || 0,
                type: productType,
                images: imageUrls,
                has_variants: hasVariants,
                variants: hasVariants ? variants : [],
                // Lifecycle (#8/#9/#10). API accepts both camelCase + snake_case.
                status: productStatus,
                availableFrom: productStatus === 'coming_soon' && availableFrom
                    ? new Date(availableFrom).toISOString()
                    : null,
                preOrderEta: productStatus === 'pre_order' && preOrderEta
                    ? new Date(preOrderEta).toISOString()
                    : null,
                // Per-product AI training (#2)
                aiInstructions: aiInstructions.trim() || null,
            };

            if (productType === 'physical' && !hasVariants) {
                productData.stock = Number(formData.get('stock'));
            } else {
                productData.stock = 0; // Calculated from variants or not applicable
            }

            // Legacy fields (kept for compatibility)
            productData.colors = (formData.get('colors') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [];
            productData.sizes = (formData.get('sizes') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [];

            // Appointment fields
            if (productType === 'appointment') {
                const maxBookings = Number(formData.get('maxBookings'));
                productData.durationMinutes = Number(formData.get('duration'));
                productData.availableDays = formData.getAll('availableDays') as string[];
                productData.startTime = (formData.get('startTime') as string) || null;
                productData.endTime = (formData.get('endTime') as string) || null;
                // Blank = "unlimited" (per the placeholder); the schema requires
                // min(1), so send null instead of 0 when the field is left empty.
                productData.maxBookingsPerDay = maxBookings > 0 ? maxBookings : null;
            }

            // Delivery fields (physical products only)
            // Pricing now comes from the shop-level delivery policy
            // (Settings → Хүргэлтийн бодлого), so the only thing the product
            // form decides is whether the item can be delivered at all or
            // is pickup-only. delivery_fee is always cleared to 0 here.
            if (productType === 'physical') {
                productData.deliveryType = deliveryType === 'pickup_only' ? 'pickup_only' : 'included';
                productData.deliveryFee = 0;
                productData.deliveryNote = deliveryNote.trim() || null;
            }

            if (product) {
                await updateProduct.mutateAsync({ id: product.id, ...productData });
            } else {
                await createProduct.mutateAsync(productData);
            }
            onSuccess();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Хадгалахад алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div className="flex p-1 bg-[#151040] rounded-xl w-fit">
                {[
                    { type: 'physical', label: 'Бараа', icon: Box },
                    { type: 'service', label: 'Үйлчилгээ', icon: Layers },
                    { type: 'appointment', label: 'Цаг захиалга', icon: Calendar }
                ].filter((item) => !(isServiceBusiness && item.type === 'physical')).map((item) => (
                    <button
                        key={item.type}
                        type="button"
                        onClick={() => setProductType(item.type as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${productType === item.type ? 'bg-[#0F0B2E] text-white shadow-sm border border-white/[0.08]' : 'text-white/40 hover:text-white'}`}
                    >
                        <item.icon className="w-3.5 h-3.5" strokeWidth={2} /> {item.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column (Main Info) */}
                <div className="md:col-span-2 space-y-6">
                    
                    {/* Basic Info Card */}
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                        <h3 className="text-[13px] font-semibold text-white/90">Үндсэн мэдээлэл</h3>
                        <Input name="name" label="Нэр" defaultValue={product?.name} required placeholder="Бүтээгдэхүүний нэр" />
                        <Textarea name="description" label="Тайлбар" defaultValue={product?.description || ''} rows={4} maxLength={10000} placeholder="Бүтээгдэхүүн/Үйлчилгээний дэлгэрэнгүй... (хамгийн ихдээ 10,000 тэмдэгт)" />
                    </div>

                    {/* Price and Inventory Card */}
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                        <h3 className="text-[13px] font-semibold text-white/90">Үнэ болон Хямдрал</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input name="price" label="Үнэ (₮)" type="number" min={0} defaultValue={product?.price} required placeholder="0" error={fieldErrors.price} />
                            <Input name="discount" label="Хямдрал (%)" type="number" min={0} max={100} defaultValue={product?.discount_percent || ''} placeholder="0" error={fieldErrors.discount} />
                        </div>
                        {productType === 'physical' && !hasVariants && (
                            <div className="pt-1">
                                <Input name="stock" label="Үлдэгдэл тоо (Stock)" type="number" min={0} defaultValue={product?.stock || ''} placeholder="0" error={fieldErrors.stock} />
                            </div>
                        )}
                    </div>

                    {/* Lifecycle status (#8/#9/#10) */}
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-4">
                        <h3 className="text-[13px] font-semibold text-white/90">Төлөв</h3>
                        <div>
                            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-2">
                                Энэ бараа AI хэрэгчийг яаж танилцуулах вэ?
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {[
                                    { v: 'active', l: '✅ Идэвхтэй', d: 'Бэлэн зарагдаж байгаа' },
                                    { v: 'pre_order', l: '⏳ Урьдчилсан захиалга', d: 'Нөөц байхгүй ч захиалга авах' },
                                    { v: 'coming_soon', l: '🔜 Удахгүй ирнэ', d: 'AI "удахгүй ирнэ" гэж хэлнэ' },
                                    { v: 'draft', l: '📝 Ноорог', d: 'Хадгалсан ч AI харахгүй' },
                                    { v: 'discontinued', l: '🚫 Зогссон', d: 'AI "энэ бараа байхгүй боллоо" гэнэ' },
                                ].map((opt) => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setProductStatus(opt.v as ProductLifecycle)}
                                        className={`text-left p-3 rounded-lg border text-[12px] transition-all ${productStatus === opt.v
                                            ? 'border-violet-500/60 bg-violet-500/[0.08] text-white'
                                            : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/[0.12]'}`}
                                    >
                                        <div className="font-semibold">{opt.l}</div>
                                        <div className="text-[11px] text-white/40 mt-0.5">{opt.d}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Coming soon: when does it become active? */}
                        {productStatus === 'coming_soon' && (
                            <div>
                                <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-1.5">
                                    Хэзээ бэлэн болох вэ? (Бид мэдэхгүй бол хоосон үлдээж болно)
                                </label>
                                <input
                                    type="date"
                                    value={availableFrom}
                                    onChange={(e) => setAvailableFrom(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#0A0220] border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none"
                                />
                                <p className="text-[10.5px] text-white/40 mt-1">
                                    AI: &ldquo;{availableFrom ? `${availableFrom}-нд бэлэн болно` : 'удахгүй ирнэ'}&rdquo;
                                </p>
                            </div>
                        )}

                        {/* Pre-order: expected restock date */}
                        {productStatus === 'pre_order' && (
                            <div>
                                <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-1.5">
                                    Хүлээгдэж буй ирэх огноо
                                </label>
                                <input
                                    type="date"
                                    value={preOrderEta}
                                    onChange={(e) => setPreOrderEta(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#0A0220] border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none"
                                />
                                <p className="text-[10.5px] text-white/40 mt-1">
                                    AI урьдчилсан захиалга авна, нөөц ирэхэд хэрэглэгчид мэдэгдэнэ.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Per-product AI training (#2) */}
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-3">
                        <h3 className="text-[13px] font-semibold text-white/90">
                            🎓 AI Сургах (зөвхөн энэ бараанд хамаарна)
                        </h3>
                        <p className="text-[11.5px] text-white/45 leading-relaxed">
                            AI энэ бараагаар ярих үед үйлчилгээ ямар байх ёстойг товч бичээрэй. Хоосон үлдээвэл зөвхөн дэлгүүрийн ерөнхий заавар хэрэгжинэ.
                        </p>
                        <textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder={`Жишээ:
• Хямдрал санал болгохгүй
• Хүргэлт орон даяар үнэгүй гэж онцлох
• Хэрэглэгчийн размерийг асуу`}
                            className="w-full px-3 py-2.5 bg-[#0A0220] border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none placeholder:text-white/25 leading-relaxed"
                        />
                        <p className="text-[10.5px] text-white/40 text-right">
                            {aiInstructions.length} / 500
                        </p>
                    </div>

                    {/* Delivery Settings Card - physical products only */}
                    {productType === 'physical' && (
                        <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                            <h3 className="text-[13px] font-semibold text-white/90">🚚 Хүргэлтийн тохиргоо</h3>

                            <div className="space-y-3">
                                {[
                                    { value: 'included', label: 'Хүргэгдэнэ', desc: 'Хүргэлтийн төлбөрийг Settings → Хүргэлтийн бодлогооор тооцно', icon: '✅' },
                                    { value: 'pickup_only', label: 'Зөвхөн очиж авна', desc: 'Хүргэлт хийгдэхгүй, дэлгүүрээс очиж авна', icon: '📍' },
                                ].map(opt => (
                                    <label key={opt.value} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-all ${
                                        deliveryType === opt.value
                                            ? 'border-violet-500/30 bg-violet-500/[0.05]'
                                            : 'border-white/[0.04] hover:border-white/[0.08]'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="deliveryType"
                                            value={opt.value}
                                            checked={deliveryType === opt.value}
                                            onChange={(e) => setDeliveryType(e.target.value)}
                                            className="mt-0.5 w-4 h-4 text-violet-500 bg-[#151040] border-white/[0.2] focus:ring-violet-500"
                                        />
                                        <div>
                                            <span className="text-[12px] font-medium text-white/80">{opt.icon} {opt.label}</span>
                                            <p className="text-[10px] text-white/30 mt-0.5">{opt.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {deliveryType !== 'pickup_only' && (
                                <div>
                                    <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-1.5">
                                        🕒 Хүргэлт гарах хугацаа (заавал биш)
                                    </label>
                                    <textarea
                                        value={deliveryNote}
                                        onChange={(e) => setDeliveryNote(e.target.value)}
                                        rows={2}
                                        maxLength={500}
                                        placeholder="Жишээ: Өмнөх өдрийн 17:00-аас өмнө баталгаажсан захиалга маргааш 11:00-д хүргэлтэд гарна."
                                        className="w-full px-3 py-2.5 bg-[#0A0220] border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none placeholder:text-white/25 leading-relaxed"
                                    />
                                    <p className="text-[10.5px] text-white/40 mt-1">
                                        Зөвхөн энэ бараанд онцлох хугацаа. Хоосон бол дэлгүүрийн ерөнхий хүргэлтийн хугацаа хэрэгжинэ.
                                    </p>
                                </div>
                            )}
                            <p className="text-[11px] text-white/40 leading-relaxed">
                                💡 Хүргэлтийн төлбөр (УБ / орон нутаг) болон үнэгүй хүргэлтийн босгыг <strong className="text-white/70">Settings → Хүргэлтийн бодлого</strong> хэсгээс нэгдсэн байдлаар тохируулна. Энэ бүтээгдэхүүн хүргэгдэхгүй бол ‘Зөвхөн очиж авна’-г сонгоно уу.
                            </p>
                        </div>
                    )}

                    {/* Appointment Settings Card */}
                    {productType === 'appointment' && (
                        <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-violet-400" />
                                <h3 className="text-[13px] font-semibold text-violet-400">Цаг захиалгын хуваарь</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-white/70 mb-1.5">Үргэлжлэх хугацаа</label>
                                    <select 
                                        name="duration" 
                                        defaultValue={product?.duration_minutes || 60}
                                        className="w-full bg-[#151040] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-violet-500 transition-colors"
                                    >
                                        <option value={15}>15 минут</option>
                                        <option value={30}>30 минут</option>
                                        <option value={45}>45 минут</option>
                                        <option value={60}>1 цаг</option>
                                        <option value={90}>1 цаг 30 минут</option>
                                        <option value={120}>2 цаг</option>
                                    </select>
                                </div>
                                <Input name="maxBookings" label="Өдөрт авах хүн (Макс)" type="number" defaultValue={product?.max_bookings_per_day || ''} placeholder="Хязгааргүй бол хоосон" />
                            </div>

                            <div className="pt-2">
                                <label className="block text-[12px] font-medium text-white/70 mb-2.5">Ажиллах гаригууд</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням'].map((day, idx) => (
                                        <label key={idx} className="cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                name="availableDays" 
                                                value={day} 
                                                defaultChecked={product?.available_days?.includes(day) ?? (idx < 5)}
                                                className="peer sr-only" 
                                            />
                                            <div className="px-3 py-1.5 rounded-lg border border-white/[0.06] bg-[#151040]/50 text-[11px] font-medium text-white/30 peer-checked:bg-violet-500/10 peer-checked:text-violet-300 peer-checked:border-violet-500/30 transition-all">
                                                {day}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-white/70 mb-1.5">Эхлэх цаг</label>
                                    <input 
                                        type="time" 
                                        name="startTime" 
                                        defaultValue={product?.start_time || '09:00'} 
                                        className="w-full bg-[#151040] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-white/70 mb-1.5">Дуусах цаг</label>
                                    <input 
                                        type="time" 
                                        name="endTime" 
                                        defaultValue={product?.end_time || '18:00'} 
                                        className="w-full bg-[#151040] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Variants Card for Physical and Service */}
                    {(productType === 'physical' || productType === 'service') && (
                        <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                            <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hasVariants}
                                        onChange={(e) => {
                                            setHasVariants(e.target.checked);
                                            // Асаахад эхний хувилбарыг бэлэн харуулна — хэрэглэгч шууд бичиж эхэлнэ
                                            if (e.target.checked && variants.length === 0) {
                                                addVariant();
                                            }
                                        }}
                                        className="w-4 h-4 text-violet-500 rounded bg-[#151040] border-white/[0.2] focus:ring-violet-500"
                                    />
                                    <span className="font-semibold text-[13px] text-white/90">Олон төрөл / Хувилбартай</span>
                                </label>
                            </div>

                            {hasVariants ? (
                                <div className="space-y-5">
                                    <p className="text-[11px] text-white/40 leading-relaxed -mt-1">
                                        Хувилбар бүрийг (ж: <strong className="text-white/70">Улаан / S</strong>) нэрлээд ард нь <strong className="text-white/70">үнэ, тоо ширхэг</strong>-ийг шууд бичнэ. Шинээр нэмэхдээ доорх <strong className="text-white/70">Хувилбар нэмэх</strong> товчийг дарна.
                                    </p>

                                    {/* Нийт нөөцийн дээд хязгаар — хувилбаруудын нийлбэр үүнээс хэтрэхгүй */}
                                    {productType === 'physical' && (
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <label className="text-[12px] text-white/70">Нийт нөөц (макс.):</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={maxStock}
                                                onChange={(e) => setMaxStock(e.target.value)}
                                                placeholder="Ж: 20"
                                                className="w-28 bg-[#0A0220] px-3 py-1.5 border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none tabular-nums"
                                            />
                                            {maxStockNum != null && (
                                                <span className="text-[11.5px] tabular-nums">
                                                    <span className="text-white/45">Хуваарилсан {variantsTotalStock}/{maxStockNum}</span>
                                                    <span className={stockRemaining! < 0 ? 'text-[var(--destructive)] ml-2' : 'text-white/45 ml-2'}>
                                                        · Үлдсэн {stockRemaining}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {variants.length > 0 && (
                                        <div className="border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-[#151040]/80 border-b border-white/[0.04]">
                                                    <tr>
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em]">Хувилбар (нэр)</th>
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em]">Үнэ (₮)</th>
                                                        {productType === 'physical' && <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em] w-20">Тоо ширхэг</th>}
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em] text-center w-16">Идэвхтэй</th>
                                                        <th className="px-2 py-2.5 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.04]">
                                                    {variants.map((variant, idx) => (
                                                        <tr key={idx} className="hover:bg-white/[0.01]">
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="text"
                                                                    className="w-full min-w-[140px] bg-[#0A0220] px-2 py-1.5 border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
                                                                    value={variant.name}
                                                                    onChange={(e) => updateVariantName(idx, e.target.value)}
                                                                    placeholder="Ж: Улаан / S"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    className="w-full max-w-[120px] bg-[#0A0220] px-2 py-1.5 border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none tabular-nums transition-all"
                                                                    value={variant.price}
                                                                    onChange={(e) => {
                                                                        const newVar = [...variants];
                                                                        newVar[idx].price = Number(e.target.value);
                                                                        setVariants(newVar);
                                                                    }}
                                                                />
                                                            </td>
                                                            {productType === 'physical' && (
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={maxStockNum ?? undefined}
                                                                        className="w-16 bg-[#0A0220] px-2 py-1.5 border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none tabular-nums text-center transition-all"
                                                                        value={variant.stock}
                                                                        onChange={(e) => setVariantStock(idx, Number(e.target.value))}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={variant.is_active}
                                                                    onChange={(e) => {
                                                                        const newVar = [...variants];
                                                                        newVar[idx].is_active = e.target.checked;
                                                                        setVariants(newVar);
                                                                    }}
                                                                    className="rounded flex-shrink-0 mx-auto w-3.5 h-3.5 bg-[#0A0220] border-white/[0.2] text-violet-500 focus:ring-violet-500/50 cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeVariant(idx)}
                                                                    aria-label="Хувилбар устгах"
                                                                    className="p-1.5 rounded-md text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Хувилбар нэмэх */}
                                    <Button type="button" variant="secondary" size="sm" onClick={addVariant} className="text-[11px] px-3">
                                        <Plus className="w-3 h-3 mr-1.5 bg-white/20 rounded-full" /> Хувилбар нэмэх
                                    </Button>

                                    {variants.length > 0 && productType === 'physical' && (
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#151040]/40 rounded-lg border border-white/[0.04]">
                                            <span className="text-[11px] text-white/45">{variants.length} хувилбар</span>
                                            <span className="text-[12px] font-semibold text-white/80 tabular-nums">
                                                Нийт үлдэгдэл: {variantsTotalStock}{maxStockNum != null ? ` / ${maxStockNum}` : ''} ширхэг
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input name="colors" label="Гаднах өнгөнүүд" placeholder="Улаан, Хар" defaultValue={product?.colors?.join(', ')} />
                                    <Input name="sizes" label="Боломжит хэмжээнүүд" placeholder="S, M, L" defaultValue={product?.sizes?.join(', ')} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column (Media) */}
                <div className="space-y-6">
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold text-white/90">Зураг оруулах</h3>
                            <span className="text-[10px] text-white/40">
                                {imageSlots.filter((s) => s.previewUrl).length} / {MAX_IMAGES}
                            </span>
                        </div>

                        {/* Main (first) image */}
                        <div className="w-full aspect-square relative">
                            <div className="w-full h-full border border-dashed border-white/[0.15] rounded-xl hover:border-violet-500/50 hover:bg-violet-500/[0.02] transition-colors relative overflow-hidden group bg-[#151040]/30 shadow-inner">
                                {imageSlots[0]?.previewUrl ? (
                                    <>
                                        <img src={imageSlots[0].previewUrl} alt="Гол зураг" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={handleImageRemoveAt(0)}
                                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white text-[11px] flex items-center justify-center transition"
                                            aria-label="Зураг устгах"
                                        >
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-3 group-hover:text-white/50 transition-colors">
                                        <div className="w-12 h-12 rounded-full bg-white/[0.03] shadow-sm flex items-center justify-center">
                                            <Upload className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[12px] font-medium tracking-[-0.01em]">Гол зургийг сонгоно уу</span>
                                    </div>
                                )}
                                {!imageSlots[0]?.previewUrl && (
                                    <input type="file" accept="image/*" onChange={handleImageSelectAt(0)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                )}
                            </div>
                        </div>

                        {/* Additional thumbnails (slots 1 and 2) */}
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2].map((idx) => {
                                const slot = imageSlots[idx];
                                return (
                                    <div key={idx} className="aspect-square relative">
                                        <div className="w-full h-full border border-dashed border-white/[0.12] rounded-lg hover:border-violet-500/40 hover:bg-violet-500/[0.02] transition-colors relative overflow-hidden group bg-[#151040]/30">
                                            {slot?.previewUrl ? (
                                                <>
                                                    <img src={slot.previewUrl} alt={`Зураг ${idx + 1}`} className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={handleImageRemoveAt(idx)}
                                                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-[10px] flex items-center justify-center transition"
                                                        aria-label="Зураг устгах"
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-white/25 gap-1 group-hover:text-white/45 transition-colors">
                                                    <Upload className="w-4 h-4" strokeWidth={1.5} />
                                                    <span className="text-[10px]">Зураг {idx + 1}</span>
                                                </div>
                                            )}
                                            {!slot?.previewUrl && (
                                                <input type="file" accept="image/*" onChange={handleImageSelectAt(idx)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="text-[10px] text-white/30 text-center tracking-[-0.01em]">
                            Дээд тал нь 3 зураг. Эхний зураг гол зураг болно.
                            <br />
                            Санал болгох: 800x800px (1:1)
                        </p>
                    </div>
                </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/[0.08] -mx-5 -mb-5 bg-[#0F0B2E]/90 backdrop-blur-md rounded-b-xl">
                <Button variant="secondary" type="button" onClick={onCancel} disabled={saving} className="text-[12px] px-4">
                    Цуцлах
                </Button>
                <Button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-[12px] px-5 shadow-[0_4px_12px_rgba(124,58,237,0.2)] border border-violet-500/50">
                    {saving ? 'Түрхүлээнэ үү...' : 'Хадгалах'}
                </Button>
            </div>
        </form>
    );
}
