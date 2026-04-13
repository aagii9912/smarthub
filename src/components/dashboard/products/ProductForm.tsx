'use client';

import { useState, useEffect } from 'react';
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
    const { user } = useAuth();

    const [saving, setSaving] = useState(false);
    const [productType, setProductType] = useState<'physical' | 'service' | 'appointment'>(product?.type || 'physical');

    // Image State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(product?.images?.[0] || null);

    // Variant State
    const [hasVariants, setHasVariants] = useState(product?.has_variants || false);
    const [optionGroups, setOptionGroups] = useState<{ name: string, values: string[] }[]>([]);
    const [variants, setVariants] = useState<FormVariant[]>(
        (product?.variants || []).map(v => ({
            name: v.name,
            options: v.options,
            price: v.price ?? product?.price ?? 0,
            stock: v.stock,
            is_active: v.is_active
        }))
    );

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

    // Generate variants when options change
    const generateVariants = () => {
        if (optionGroups.length === 0) return;

        // Cartesian product
        const generateCombinations = (groups: typeof optionGroups, prefix: Record<string, string> = {}): Record<string, string>[] => {
            if (groups.length === 0) return [prefix];
            const first = groups[0];
            const rest = groups.slice(1);
            let combinations: Record<string, string>[] = [];

            for (const value of first.values) {
                const newPrefix = { ...prefix, [first.name]: value };
                combinations = combinations.concat(generateCombinations(rest, newPrefix));
            }
            return combinations;
        };

        const combos = generateCombinations(optionGroups);
        const newVariants: FormVariant[] = combos.map(options => {
            const name = Object.values(options).join(' / ');
            // Preserve existing variant data if match found
            const existing = variants.find(v => JSON.stringify(v.options) === JSON.stringify(options));
            return existing || {
                name,
                options,
                price: product?.price || 0,
                stock: 0,
                is_active: true
            };
        });
        setVariants(newVariants);
    };

    const addOptionGroup = () => {
        setOptionGroups([...optionGroups, { name: '', values: [] }]);
    };

    const updateOptionGroup = (index: number, field: 'name' | 'values', value: any) => {
        const newGroups = [...optionGroups];
        if (field === 'values') {
            // value is string (comma separated)
            newGroups[index].values = value.split(',').map((s: string) => s.trim()).filter(Boolean);
        } else {
            newGroups[index].name = value;
        }
        setOptionGroups(newGroups);
    };

    const removeOptionGroup = (index: number) => {
        setOptionGroups(optionGroups.filter((_, i) => i !== index));
    };


    useEffect(() => {
        if (product) {
            setProductType(product.type || 'physical');
            setImagePreview(product.images?.[0] || null);
            setHasVariants(product.has_variants || false);
        }
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [product]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
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
        setSaving(true);
        const formData = new FormData(e.currentTarget);

        try {
            let imageUrl = product?.images?.[0] || null;
            if (imageFile) {
                imageUrl = await uploadImage(imageFile);
            }

            const productData: Record<string, unknown> = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                price: Number(formData.get('price')),
                discount_percent: Number(formData.get('discount')) || 0,
                type: productType,
                images: imageUrl ? [imageUrl] : [],
                has_variants: hasVariants,
                variants: hasVariants ? variants : [],
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
                productData.duration_minutes = Number(formData.get('duration'));
                productData.available_days = formData.getAll('availableDays') as string[];
                productData.start_time = formData.get('startTime') as string;
                productData.end_time = formData.get('endTime') as string;
                productData.max_bookings_per_day = Number(formData.get('maxBookings'));
            }

            if (product) {
                await updateProduct.mutateAsync({ id: product.id, ...productData });
            } else {
                await createProduct.mutateAsync(productData);
            }
            onSuccess();
        } catch (error: unknown) {
            alert(error instanceof Error ? error.message : 'Алдаа гарлаа');
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
                ].map((item) => (
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
                        <Textarea name="description" label="Тайлбар" defaultValue={product?.description || ''} rows={4} placeholder="Бүтээгдэхүүн/Үйлчилгээний дэлгэрэнгүй..." />
                    </div>

                    {/* Price and Inventory Card */}
                    <div className="bg-[#0F0B2E] p-5 rounded-xl border border-white/[0.08] space-y-5">
                        <h3 className="text-[13px] font-semibold text-white/90">Үнэ болон Хямдрал</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input name="price" label="Үнэ (₮)" type="number" defaultValue={product?.price} required placeholder="0" />
                            <Input name="discount" label="Хямдрал (%)" type="number" defaultValue={product?.discount_percent || ''} placeholder="0" />
                        </div>
                        {productType === 'physical' && !hasVariants && (
                            <div className="pt-1">
                                <Input name="stock" label="Үлдэгдэл тоо (Stock)" type="number" defaultValue={product?.stock || ''} placeholder="0" />
                            </div>
                        )}
                    </div>

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
                                        onChange={(e) => setHasVariants(e.target.checked)}
                                        className="w-4 h-4 text-violet-500 rounded bg-[#151040] border-white/[0.2] focus:ring-violet-500"
                                    />
                                    <span className="font-semibold text-[13px] text-white/90">Олон төрөл / Хувилбартай</span>
                                </label>
                            </div>

                            {hasVariants ? (
                                <div className="space-y-5">
                                    <p className="text-[11px] text-white/40 leading-relaxed -mt-1">
                                        Та бүтээгдэхүүн/үйлчилгээнийхээ төрлөөс (өнцөг, багц, хэмжээ) шалтгаалж үнийг өөрөөр тохируулах боломжтой.
                                    </p>
                                    <div className="p-4 bg-[#151040]/50 rounded-xl border border-white/[0.04] space-y-4">
                                        {optionGroups.map((group, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="w-1/3">
                                                    <Input
                                                        name={`option_name_${idx}`}
                                                        label={idx === 0 ? "Сонголтын нэр (Ж: Өнгө/Багц)" : ""}
                                                        value={group.name}
                                                        onChange={(e) => updateOptionGroup(idx, 'name', e.target.value)}
                                                        placeholder="Өнгө"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Input
                                                        name={`option_values_${idx}`}
                                                        label={idx === 0 ? "Утгууд (Таслалаар зааглана)" : ""}
                                                        value={group.values.join(', ')}
                                                        onChange={(e) => updateOptionGroup(idx, 'values', e.target.value)}
                                                        placeholder="Улаан, Хар, Цагаан"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeOptionGroup(idx)}
                                                    className={`p-2 rounded-md bg-white/[0.02] text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors ${idx === 0 ? 'mt-6' : 'mt-1'}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex gap-2 pt-2">
                                            <Button type="button" variant="secondary" size="sm" onClick={addOptionGroup} className="text-[11px] px-3">
                                                <Plus className="w-3 h-3 mr-1.5 bg-white/20 rounded-full" /> Сонголт нэмэх
                                            </Button>
                                            <Button type="button" size="sm" onClick={generateVariants} disabled={optionGroups.length === 0 || optionGroups.some(g => !g.name || g.values.length === 0)} className="text-[11px] px-3">
                                                Хувилбар үүсгэх
                                            </Button>
                                        </div>
                                    </div>

                                    {variants.length > 0 && (
                                        <div className="border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-[#151040]/80 border-b border-white/[0.04]">
                                                    <tr>
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em]">Хувилбар</th>
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em]">Үнэ (₮)</th>
                                                        {productType === 'physical' && <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em] w-20">Үлдэгдэл</th>}
                                                        <th className="px-4 py-2.5 text-[10px] uppercase font-semibold text-white/30 tracking-[0.05em] text-center w-16">Идэвхтэй</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.04]">
                                                    {variants.map((variant, idx) => (
                                                        <tr key={idx} className="hover:bg-white/[0.01]">
                                                            <td className="px-4 py-3 text-[12px] font-medium text-white/80">{variant.name}</td>
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
                                                                        className="w-16 bg-[#0A0220] px-2 py-1.5 border border-white/[0.1] rounded-md text-[12px] text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none tabular-nums text-center transition-all"
                                                                        value={variant.stock}
                                                                        onChange={(e) => {
                                                                            const newVar = [...variants];
                                                                            newVar[idx].stock = Number(e.target.value);
                                                                            setVariants(newVar);
                                                                        }}
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
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
                        <h3 className="text-[13px] font-semibold text-white/90">Зураг оруулах</h3>
                        <div className="w-full aspect-square relative">
                            <div className="w-full h-full border border-dashed border-white/[0.15] rounded-xl hover:border-violet-500/50 hover:bg-violet-500/[0.02] transition-colors relative overflow-hidden group bg-[#151040]/30 shadow-inner">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/30 gap-3 group-hover:text-white/50 transition-colors">
                                        <div className="w-12 h-12 rounded-full bg-white/[0.03] shadow-sm flex items-center justify-center">
                                            <Upload className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[12px] font-medium tracking-[-0.01em]">Дарах эсвэл зураг чирнэ үү</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleImageSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        </div>
                        <p className="text-[10px] text-white/20 text-center uppercase tracking-[0.05em] font-medium">Санал болгох: 800x800px (1:1)</p>
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
