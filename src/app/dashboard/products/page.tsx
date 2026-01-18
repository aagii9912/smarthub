'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Plus, Edit2, Trash2, Package, X, Upload, Box, Layers, FileSpreadsheet, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from '@/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export default function ProductsPage() {
    // TanStack Query hooks
    const { data: products = [], isLoading } = useProducts();
    const createProduct = useCreateProduct();
    const updateProduct = useUpdateProduct();
    const deleteProduct = useDeleteProduct();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form States
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [productType, setProductType] = useState<'physical' | 'service' | 'appointment'>('physical');

    // Import States
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    // Reset form when modal opens/closes or editing product changes
    useEffect(() => {
        if (showModal) {
            if (editingProduct) {
                setProductType(editingProduct.type || 'physical');
                setImagePreview(editingProduct.images?.[0] || null);
            } else {
                setProductType('physical');
                setImagePreview(null);
            }
            setImageFile(null);
        } else {
            // Clean up blob URL when modal closes
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
            setImagePreview(null);
        }
    }, [showModal, editingProduct]);

    // Clean up blob URL when component unmounts
    useEffect(() => {
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    const uploadImage = async (file: File) => {
        if (!user) throw new Error("Нэвтрээгүй байна");

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/dashboard/upload', {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Image upload failed');
        }

        const data = await res.json();
        return data.url;
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const formData = new FormData(e.currentTarget);

        try {
            let imageUrl = editingProduct?.images?.[0] || null;

            if (imageFile) {
                try {
                    imageUrl = await uploadImage(imageFile);
                } catch (e) {
                    console.error("Image upload failed:", e);
                    alert('Зураг оруулахад алдаа гарлаа. Зураггүйгээр үргэлжлүүлэх үү?');
                }
            }

            const productData = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                price: Number(formData.get('price')),
                stock: productType === 'service' || productType === 'appointment' ? null : Number(formData.get('stock')),
                discountPercent: Number(formData.get('discount')) || 0,
                type: productType,
                colors: (formData.get('colors') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                sizes: (formData.get('sizes') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                images: imageUrl ? [imageUrl] : [],
                // Appointment-specific fields
                durationMinutes: productType === 'appointment' ? Number(formData.get('duration')) : null,
                availableDays: productType === 'appointment' ? formData.getAll('availableDays') as string[] : [],
                startTime: productType === 'appointment' ? formData.get('startTime') as string : null,
                endTime: productType === 'appointment' ? formData.get('endTime') as string : null,
                maxBookingsPerDay: productType === 'appointment' ? Number(formData.get('maxBookings')) : null,
            };

            if (editingProduct) {
                await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
            } else {
                await createProduct.mutateAsync(productData);
            }
            setShowModal(false);
            setEditingProduct(null);
        } catch (error: any) {
            console.error('Failed to save product:', error);
            alert(error.message || 'Алдаа гарлаа. Дахин оролдоно уу.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Устгахдаа итгэлтэй байна уу?')) return;
        try {
            await deleteProduct.mutateAsync(id);
        } catch (error) {
            console.error('Failed to delete product:', error);
        }
    }

    // Import handlers
    async function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImportFile(file);
            setImportError(null);
            setImportPreview([]);

            // Get preview
            setImporting(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('preview', 'true');

                const res = await fetch('/api/shop/import', {
                    method: 'POST',
                    body: formData,
                });

                const data = await res.json();

                if (!res.ok) {
                    setImportError(data.error || 'Preview failed');
                } else {
                    setImportPreview(data.products || []);
                }
            } catch (error: any) {
                setImportError(error.message || 'Preview failed');
            } finally {
                setImporting(false);
            }
        }
    }

    async function handleImportConfirm() {
        if (!importFile) return;

        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', importFile);

            const res = await fetch('/api/shop/import', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setImportError(data.error || 'Import failed');
            } else {
                alert(`${data.count} бүтээгдэхүүн импорт хийгдлээ!`);
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
                queryClient.invalidateQueries({ queryKey: ['products'] });
            }
        } catch (error: any) {
            setImportError(error.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        </div>;
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Actions - Title removed */}
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="secondary"
                    className="w-9 h-9 p-0 md:w-auto md:px-4 md:h-9"
                    title="Export Excel"
                    onClick={() => window.open('/api/dashboard/products/export', '_blank')}
                >
                    <FileSpreadsheet className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Export</span>
                </Button>
                <Button
                    variant="secondary"
                    className="w-9 h-9 p-0 md:w-auto md:px-4 md:h-9"
                    title="Файлаас импорт"
                    onClick={() => setShowImportModal(true)}
                >
                    <Upload className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Import</span>
                </Button>
                <Button
                    onClick={() => { setEditingProduct(null); setShowModal(true); }}
                    size="sm"
                    className="h-9 px-3 md:px-4"
                >
                    <Plus className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden md:inline">Шинэ нэмэх</span>
                    <span className="md:hidden">Нэмэх</span>
                </Button>
            </div>

            {/* Products Table */}
            {/* Products List - Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {filteredProducts.map((product) => (
                    <Card key={product.id}>
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="w-20 h-20 rounded-xl bg-secondary flex-shrink-0 overflow-hidden border border-border">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-foreground truncate">{product.name}</p>
                                            {(product.discount_percent || 0) > 0 ? (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-muted-foreground line-through">₮{product.price.toLocaleString()}</span>
                                                    <span className="text-sm font-semibold text-red-600">₮{Math.round(product.price * (1 - product.discount_percent! / 100)).toLocaleString()}</span>
                                                    <span className="px-1 py-0.5 bg-red-100 text-red-600 text-[10px] font-medium rounded">-{product.discount_percent}%</span>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground mt-0.5">₮{product.price.toLocaleString()}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${product.type === 'service' ? 'bg-purple-500/10 text-purple-600 border-purple-200' : product.type === 'appointment' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'}`}>
                                            {product.type === 'service' ? 'Үйлчилгээ' : product.type === 'appointment' ? 'Цаг захиалга' : 'Бараа'}
                                        </span>
                                        {product.type === 'physical' && (
                                            <span className={`text-xs ${(product.stock || 0) > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                                                {(product.stock || 0) > 0 ? `Үлдэгдэл: ${product.stock}` : 'Дууссан'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Products Table - Desktop */}
            <Card className="hidden md:block">
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-secondary/50 border-b border-border">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Бүтээгдэхүүн</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Төрөл</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Үнэ</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Үлдэгдэл</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Төлөв</th>
                                <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">Үйлдэл</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-secondary flex-shrink-0 overflow-hidden border border-border">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{product.name}</p>
                                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">{product.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${product.type === 'service' ? 'bg-purple-500/10 text-purple-600 border-purple-200' : product.type === 'appointment' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'}`}>
                                            {product.type === 'service' ? 'Үйлчилгээ' : product.type === 'appointment' ? 'Цаг захиалга' : 'Бараа'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(product.discount_percent || 0) > 0 ? (
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-muted-foreground line-through">₮{product.price.toLocaleString()}</span>
                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-medium rounded">-{product.discount_percent}%</span>
                                                </div>
                                                <p className="font-semibold text-red-600">₮{Math.round(product.price * (1 - product.discount_percent! / 100)).toLocaleString()}</p>
                                            </div>
                                        ) : (
                                            <p className="font-semibold text-foreground">₮{product.price.toLocaleString()}</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {product.type === 'physical' ? (
                                            <p className={`font-medium ${(product.stock || 0) > 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                {(product.stock || 0) > 0 ? `${product.stock} ш` : 'Дууссан'}
                                            </p>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${product.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-secondary text-muted-foreground border-border'}`}>
                                            {product.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 m-4 relative">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingProduct ? 'Засах' : 'Шинэ бүртгэл'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Төрөл сонгох */}
                            <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setProductType('physical')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${productType === 'physical' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    <Box className="w-4 h-4" /> Бараа
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProductType('service')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${productType === 'service' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    <Layers className="w-4 h-4" /> Үйлчилгээ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProductType('appointment')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${productType === 'appointment' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    <Calendar className="w-4 h-4" /> Цаг захиалга
                                </button>
                            </div>

                            <div className="flex gap-6">
                                {/* Зураг оруулах */}
                                <div className="w-32 h-32 flex-shrink-0">
                                    <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl hover:border-violet-500 transition-colors relative overflow-hidden group bg-gray-50">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                                <Upload className="w-6 h-6" />
                                                <span className="text-xs">Зураг</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4">
                                    <Input
                                        name="name"
                                        label="Нэр"
                                        placeholder={productType === 'physical' ? "Барааны нэр" : productType === 'service' ? "Үйлчилгээний нэр" : "Цаг захиалгын нэр"}
                                        defaultValue={editingProduct?.name}
                                        required
                                    />
                                    <div className={`grid gap-4 ${productType === 'physical' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                        <Input
                                            name="price"
                                            label="Үнэ (₮)"
                                            type="number"
                                            placeholder="0"
                                            defaultValue={editingProduct?.price}
                                            required
                                        />
                                        {productType === 'physical' && (
                                            <Input
                                                name="stock"
                                                label="Үлдэгдэл"
                                                type="number"
                                                placeholder="0"
                                                defaultValue={editingProduct?.stock || ''}
                                            />
                                        )}
                                        <Input
                                            name="discount"
                                            label="Хямдрал (%)"
                                            type="number"
                                            placeholder="0"
                                            defaultValue={editingProduct?.discount_percent || ''}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Textarea
                                name="description"
                                label="Тайлбар"
                                placeholder="Дэлгэрэнгүй тайлбар"
                                rows={3}
                                defaultValue={editingProduct?.description || ''}
                            />

                            {/* Appointment-specific fields */}
                            {productType === 'appointment' && (
                                <div className="space-y-4 p-4 bg-violet-50 rounded-xl border border-violet-200">
                                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-violet-600" />
                                        Цаг захиалгын тохиргоо
                                    </h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Үргэлжлэх хугацаа</label>
                                            <select
                                                name="duration"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                defaultValue={editingProduct?.duration_minutes || 60}
                                            >
                                                <option value="30">30 минут</option>
                                                <option value="60">1 цаг</option>
                                                <option value="90">1.5 цаг</option>
                                                <option value="120">2 цаг</option>
                                                <option value="180">3 цаг</option>
                                                <option value="240">4 цаг</option>
                                            </select>
                                        </div>
                                        <Input
                                            name="maxBookings"
                                            label="Өдөрт хамгийн олон"
                                            type="number"
                                            placeholder="10"
                                            defaultValue={editingProduct?.max_bookings_per_day || 10}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Боломжтой өдрүүд</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 'mon', label: 'Да' },
                                                { value: 'tue', label: 'Мя' },
                                                { value: 'wed', label: 'Лх' },
                                                { value: 'thu', label: 'Пү' },
                                                { value: 'fri', label: 'Ба' },
                                                { value: 'sat', label: 'Бя' },
                                                { value: 'sun', label: 'Ня' },
                                            ].map(day => (
                                                <label key={day.value} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-violet-400 has-[:checked]:bg-violet-100 has-[:checked]:border-violet-500">
                                                    <input
                                                        type="checkbox"
                                                        name="availableDays"
                                                        value={day.value}
                                                        defaultChecked={editingProduct?.available_days?.includes(day.value) ?? ['mon', 'tue', 'wed', 'thu', 'fri'].includes(day.value)}
                                                        className="w-4 h-4 text-violet-600 rounded"
                                                    />
                                                    <span className="text-sm">{day.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Эхлэх цаг</label>
                                            <input
                                                type="time"
                                                name="startTime"
                                                defaultValue={editingProduct?.start_time || '09:00'}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Дуусах цаг</label>
                                            <input
                                                type="time"
                                                name="endTime"
                                                defaultValue={editingProduct?.end_time || '18:00'}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {productType !== 'appointment' && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <Input
                                        name="colors"
                                        label="Өнгө / Хувилбар"
                                        placeholder="Улаан, Хар (Таслалаар зааглана)"
                                        defaultValue={editingProduct?.colors?.join(', ')}
                                    />
                                    <Input
                                        name="sizes"
                                        label="Хэмжээ / Хугацаа"
                                        placeholder={productType === 'physical' ? "S, M, L" : "1 цаг, 1 сар"}
                                        defaultValue={editingProduct?.sizes?.join(', ')}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                <Button variant="secondary" type="button" onClick={() => setShowModal(false)} disabled={saving}>
                                    Цуцлах
                                </Button>
                                <Button type="submit" disabled={saving}>
                                    {saving ? 'Хадгалж байна...' : (editingProduct ? 'Хадгалах' : 'Нэмэх')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
                    <div className="bg-white rounded-2xl w-full max-w-3xl p-6 m-4 relative">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                Файлаас импорт
                            </h2>
                            <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportError(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* File Upload Area */}
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-violet-500 transition-colors relative">
                            {importFile ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileSpreadsheet className="w-8 h-8 text-violet-600" />
                                    <div className="text-left">
                                        <p className="font-medium text-gray-900">{importFile.name}</p>
                                        <p className="text-sm text-gray-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={() => { setImportFile(null); setImportPreview([]); }} className="ml-4 text-gray-400 hover:text-red-500">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-600 mb-1">Excel эсвэл Word файл сонгоно уу</p>
                                    <p className="text-sm text-gray-400">xlsx, xls, csv, docx</p>
                                </>
                            )}
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv,.docx"
                                onChange={handleImportFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>

                        {/* Error */}
                        {importError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {importError}
                            </div>
                        )}

                        {/* Preview Table */}
                        {importPreview.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-medium text-gray-900 mb-3">Урьдчилан харах ({importPreview.length} бүтээгдэхүүн)</h3>
                                <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-medium text-gray-500">Нэр</th>
                                                <th className="text-left px-3 py-2 font-medium text-gray-500">Төрөл</th>
                                                <th className="text-left px-3 py-2 font-medium text-gray-500">Үнэ</th>
                                                <th className="text-left px-3 py-2 font-medium text-gray-500">Тоо/Slot</th>
                                                <th className="text-left px-3 py-2 font-medium text-gray-500">Тайлбар</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {importPreview.slice(0, 10).map((p, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 text-gray-900">{p.name}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.type === 'service' ? 'bg-purple-50 text-purple-700' : p.type === 'appointment' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                            {p.type === 'service' ? 'Үйлчилгээ' : p.type === 'appointment' ? 'Цаг захиалга' : 'Бараа'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600">₮{p.price?.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-gray-600">{p.stock || 0} {p.unit}</td>
                                                    <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{p.description || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {importPreview.length > 10 && (
                                    <p className="text-sm text-gray-500 mt-2">... болон {importPreview.length - 10} бусад</p>
                                )}
                            </div>
                        )}

                        {/* Format Help */}
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-700 mb-2">Формат заавар:</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li><strong>Excel:</strong> Нэр, Үнэ, Тоо, Тайлбар баганууд</li>
                                <li><strong>Word:</strong> "Нэр - Үнэ - Тайлбар" (мөр бүрт нэг бүтээгдэхүүн)</li>
                            </ul>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                            <Button variant="secondary" onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportError(null); }} disabled={importing}>
                                Цуцлах
                            </Button>
                            <Button onClick={handleImportConfirm} disabled={importing || importPreview.length === 0}>
                                {importing ? 'Импорт хийж байна...' : `${importPreview.length} бүтээгдэхүүн импортлох`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
