'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Plus, Search, Edit2, Trash2, Package, X, Upload, Box, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number | null;
    is_active: boolean;
    type: 'physical' | 'service';
    colors: string[];
    sizes: string[];
    images: string[];
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Form States
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [productType, setProductType] = useState<'physical' | 'service'>('physical');

    useEffect(() => {
        fetchProducts();
    }, []);

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
        }
    }, [showModal, editingProduct]);

    async function fetchProducts() {
        try {
            const res = await fetch('/api/dashboard/products');
            const data = await res.json();
            setProducts(data.products || []);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    }

    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
            .from('products')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(filePath);

        return publicUrl;
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
                imageUrl = await uploadImage(imageFile);
            }

            const productData = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                price: Number(formData.get('price')),
                stock: productType === 'service' ? null : Number(formData.get('stock')),
                type: productType,
                colors: (formData.get('colors') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                sizes: (formData.get('sizes') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
                images: imageUrl ? [imageUrl] : [],
            };

            if (editingProduct) {
                // Update
                await fetch('/api/dashboard/products', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingProduct.id, ...productData }),
                });
            } else {
                // Create
                await fetch('/api/dashboard/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productData),
                });
            }
            fetchProducts();
            setShowModal(false);
            setEditingProduct(null);
        } catch (error) {
            console.error('Failed to save product:', error);
            alert('Алдаа гарлаа. Дахин оролдоно уу.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Устгахдаа итгэлтэй байна уу?')) return;
        
        try {
            await fetch(`/api/dashboard/products?id=${id}`, {
                method: 'DELETE',
            });
            fetchProducts();
        } catch (error) {
            console.error('Failed to delete product:', error);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        </div>;
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Бүтээгдэхүүн & Үйлчилгээ</h1>
                    <p className="text-gray-500 mt-1">Нийт {products.length} бүртгэл</p>
                </div>
                <Button onClick={() => { setEditingProduct(null); setShowModal(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Шинэ нэмэх
                </Button>
            </div>

            {/* Search & Filters */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Бүтээгдэхүүн</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Төрөл</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Үнэ</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Үлдэгдэл</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Төлөв</th>
                                <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">Үйлдэл</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                <p className="text-sm text-gray-500 truncate max-w-[200px]">{product.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${product.type === 'service' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                            {product.type === 'service' ? 'Үйлчилгээ' : 'Бараа'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-900">₮{product.price.toLocaleString()}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        {product.type === 'physical' ? (
                                            <p className={`font-medium ${(product.stock || 0) > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                                {(product.stock || 0) > 0 ? `${product.stock} ш` : 'Дууссан'}
                                            </p>
                                        ) : (
                                            <span className="text-gray-400 text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${product.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                            {product.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                                className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(product.id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                                        placeholder={productType === 'physical' ? "Барааны нэр" : "Үйлчилгээний нэр"}
                                        defaultValue={editingProduct?.name}
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-4">
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
        </div>
    );
}
