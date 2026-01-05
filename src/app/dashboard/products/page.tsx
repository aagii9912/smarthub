'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react';

// Demo data
const demoProducts = [
    { id: '1', name: 'Хар куртка', description: 'Өвлийн дулаан куртка', price: 185000, stock: 15, is_active: true },
    { id: '2', name: 'Цагаан цамц', description: 'Албан ёсны цамц', price: 45000, stock: 30, is_active: true },
    { id: '3', name: 'Спорт гутал', description: 'Nike гутал', price: 120000, stock: 8, is_active: true },
    { id: '4', name: 'Гоёлын даашинз', description: 'Зуны даашинз', price: 250000, stock: 0, is_active: false },
    { id: '5', name: 'Джинс өмд', description: 'Levi\'s хөх өмд', price: 95000, stock: 22, is_active: true },
];

export default function ProductsPage() {
    const [products, setProducts] = useState(demoProducts);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<typeof demoProducts[0] | null>(null);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Бүтээгдэхүүн</h1>
                    <p className="text-gray-500 mt-1">Нийт {products.length} бүтээгдэхүүн</p>
                </div>
                <Button onClick={() => { setEditingProduct(null); setShowModal(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Шинэ бүтээгдэхүүн
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
                                placeholder="Бүтээгдэхүүн хайх..."
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
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                                                <Package className="w-6 h-6 text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                                <p className="text-sm text-gray-500">{product.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-900">₮{product.price.toLocaleString()}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className={`font-medium ${product.stock > 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                            {product.stock > 0 ? `${product.stock} ширхэг` : 'Дууссан'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={product.is_active ? 'success' : 'default'}>
                                            {product.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                                className="p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingProduct ? 'Бүтээгдэхүүн засах' : 'Шинэ бүтээгдэхүүн'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form className="space-y-4">
                            <Input
                                label="Нэр"
                                placeholder="Бүтээгдэхүүний нэр"
                                defaultValue={editingProduct?.name}
                            />
                            <Textarea
                                label="Тайлбар"
                                placeholder="Дэлгэрэнгүй тайлбар"
                                rows={3}
                                defaultValue={editingProduct?.description}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Үнэ (₮)"
                                    type="number"
                                    placeholder="0"
                                    defaultValue={editingProduct?.price}
                                />
                                <Input
                                    label="Үлдэгдэл"
                                    type="number"
                                    placeholder="0"
                                    defaultValue={editingProduct?.stock}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                                    Цуцлах
                                </Button>
                                <Button type="submit">
                                    {editingProduct ? 'Хадгалах' : 'Нэмэх'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
