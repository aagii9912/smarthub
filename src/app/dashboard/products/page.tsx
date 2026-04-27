'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, X, Upload, FileSpreadsheet, Search, Filter, LayoutGrid, List } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from '@/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import ProductForm from '@/components/dashboard/products/ProductForm';
import { logger } from '@/lib/utils/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// Unused but kept for API parity
void useCreateProduct;
void useUpdateProduct;

interface ImportPreviewRow {
    name?: string;
    type?: 'physical' | 'service' | 'appointment' | string;
    price?: number;
    stock?: number;
    unit?: string;
    description?: string;
}

export default function ProductsPage() {
    const { data: products = [], isLoading } = useProducts();
    const deleteProduct = useDeleteProduct();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        if (typeof window === 'undefined') return 'grid';
        return (localStorage.getItem('syncly_products_view') as 'grid' | 'list') || 'grid';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('syncly_products_view', viewMode);
        }
    }, [viewMode]);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [, setImageFile] = useState<File | null>(null);
    const [, setProductType] = useState<'physical' | 'service' | 'appointment'>('physical');

    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    void user;

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
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
            setImagePreview(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, editingProduct]);

    useEffect(() => {
        return () => {
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    async function handleDelete(id: string) {
        if (!confirm(t.products.confirmDelete)) return;
        try {
            await deleteProduct.mutateAsync(id);
        } catch (error: unknown) {
            logger.error('Failed to delete product:', { error: error });
        }
    }

    async function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImportFile(file);
            setImportError(null);
            setImportPreview([]);
            setImporting(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('preview', 'true');
                const res = await fetch('/api/shop/import', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) {
                    setImportError(data.error || 'Preview failed');
                } else {
                    setImportPreview(data.products || []);
                }
            } catch (error: unknown) {
                setImportError(error instanceof Error ? error.message : 'Preview failed');
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
            const res = await fetch('/api/shop/import', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                setImportError(data.error || 'Import failed');
            } else {
                alert(`${data.count} ${t.products.importSuccess}`);
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
                queryClient.invalidateQueries({ queryKey: ['products'] });
            }
        } catch (error: unknown) {
            setImportError(error instanceof Error ? error.message : 'Import failed');
        } finally {
            setImporting(false);
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = products.filter((p) => p.is_active).length;
    const lowStockCount = products.filter((p) => p.type === 'physical' && ((p.stock || 0) - (p.reserved_stock || 0)) < 5 && ((p.stock || 0) - (p.reserved_stock || 0)) > 0).length;
    const outOfStockCount = products.filter((p) => p.type === 'physical' && ((p.stock || 0) - (p.reserved_stock || 0)) <= 0).length;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-56 card-outlined animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Бүтээгдэхүүний каталог"
                title="Бүтээгдэхүүн"
                subtitle={
                    <>
                        <span className="text-foreground font-medium tabular-nums">{products.length}</span> бүтээгдэхүүн ·
                        {' '}
                        <span className="text-[var(--success)] font-medium tabular-nums">{activeCount}</span> идэвхтэй
                        {lowStockCount > 0 && (
                            <>
                                {' · '}
                                <span className="text-[var(--warning)] font-medium tabular-nums">{lowStockCount}</span> цөөхөн үлдсэн
                            </>
                        )}
                    </>
                }
                actions={
                    <>
                        <Button
                            variant="ghost"
                            size="md"
                            leftIcon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />}
                            onClick={() => window.open('/api/dashboard/products/export', '_blank')}
                        >
                            Экспорт
                        </Button>
                        <Button
                            variant="ghost"
                            size="md"
                            leftIcon={<Upload className="h-4 w-4" strokeWidth={1.5} />}
                            onClick={() => setShowImportModal(true)}
                        >
                            Импорт
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<Plus className="h-4 w-4" strokeWidth={1.8} />}
                            onClick={() => { setEditingProduct(null); setShowModal(true); }}
                        >
                            <span className="hidden md:inline">{t.products.addNew}</span>
                            <span className="md:hidden">{t.products.add}</span>
                        </Button>
                    </>
                }
            />

            {/* Toolbar */}
            <div className="card-outlined p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Нэр хайх..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 h-10 border border-white/[0.08] rounded-lg text-[13px] bg-white/[0.02] focus:outline-none focus:border-[var(--brand-indigo)] focus:bg-white/[0.04] transition-colors tracking-[-0.01em] placeholder:text-white/30"
                    />
                </div>
                <Button variant="ghost" size="md" leftIcon={<Filter className="h-4 w-4" strokeWidth={1.5} />}>
                    <span className="hidden sm:inline">Шүүлтүүр</span>
                </Button>
                {/* Grid/List view toggle */}
                <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('grid')}
                        aria-label="Grid харах"
                        className={cn(
                            'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                            viewMode === 'grid'
                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-[var(--brand-indigo)]'
                                : 'text-white/40 hover:text-white/70'
                        )}
                    >
                        <LayoutGrid className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        aria-label="Жагсаалтаар харах"
                        className={cn(
                            'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                            viewMode === 'list'
                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_22%,transparent)] text-[var(--brand-indigo)]'
                                : 'text-white/40 hover:text-white/70'
                        )}
                    >
                        <List className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {filteredProducts.length === 0 ? (
                <div className="card-outlined p-12 text-center">
                    <Package className="w-12 h-12 text-white/10 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-[14px] text-white/60 font-medium tracking-[-0.01em]">{t.products.noProducts}</p>
                    <p className="text-[12px] text-white/40 mt-1">{t.products.noProductsHint}</p>
                </div>
            ) : viewMode === 'list' ? (
                /* Product List — compact rows */
                <div className="card-outlined overflow-hidden divide-y divide-white/[0.06]">
                    {filteredProducts.map((product) => {
                        const available = (product.stock || 0) - (product.reserved_stock || 0);
                        const isService = product.type !== 'physical';
                        const finalPrice = (product.discount_percent || 0) > 0
                            ? Math.round(product.price * (1 - product.discount_percent! / 100))
                            : product.price;

                        return (
                            <div
                                key={product.id}
                                className="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors"
                            >
                                {/* Thumbnail */}
                                <div className="relative shrink-0 h-14 w-14 rounded-lg overflow-hidden bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-violet-500)_8%,transparent)]">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-5 h-5 text-white/20" strokeWidth={1.2} />
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-[13.5px] text-foreground tracking-[-0.01em] line-clamp-1">
                                            {product.name}
                                        </p>
                                        {!product.is_active && (
                                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                                                {t.products.inactiveStatus}
                                            </span>
                                        )}
                                        {(product.discount_percent || 0) > 0 && (
                                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--destructive)] text-white font-semibold">
                                                -{product.discount_percent}%
                                            </span>
                                        )}
                                    </div>
                                    {product.description && (
                                        <p className="text-[11.5px] text-white/40 mt-0.5 line-clamp-1">
                                            {product.description}
                                        </p>
                                    )}
                                </div>
                                {/* Price */}
                                <div className="hidden sm:block text-right shrink-0 min-w-[90px]">
                                    {(product.discount_percent || 0) > 0 ? (
                                        <>
                                            <p className="text-[10.5px] text-white/35 line-through tabular-nums leading-none">
                                                ₮{product.price.toLocaleString()}
                                            </p>
                                            <p className="text-[14px] font-bold text-[var(--destructive)] tabular-nums">
                                                ₮{finalPrice.toLocaleString()}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-[14px] font-bold text-foreground tabular-nums">
                                            ₮{product.price.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                {/* Stock */}
                                <div className="hidden md:block text-right shrink-0 min-w-[80px]">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        {isService ? (product.type === 'service' ? t.products.service : t.products.appointment) : 'Нөөц'}
                                    </p>
                                    <p className={cn(
                                        'text-[13px] font-semibold tabular-nums',
                                        isService ? 'text-white/45' :
                                            available <= 0 ? 'text-[var(--destructive)]' :
                                                available < 5 ? 'text-[var(--warning)]' : 'text-foreground'
                                    )}>
                                        {isService ? '—' : `${available} ${t.products.pcs}`}
                                    </p>
                                </div>
                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                        aria-label="Засах"
                                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition-all touch-manipulation"
                                    >
                                        <Edit2 className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        aria-label="Устгах"
                                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-[var(--destructive)]/20 active:scale-95 transition-all touch-manipulation"
                                    >
                                        <Trash2 className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Product Grid — responsive 1/2/3 columns */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => {
                        const available = (product.stock || 0) - (product.reserved_stock || 0);
                        const isService = product.type !== 'physical';
                        const finalPrice = (product.discount_percent || 0) > 0
                            ? Math.round(product.price * (1 - product.discount_percent! / 100))
                            : product.price;

                        return (
                            <div
                                key={product.id}
                                className="card-outlined overflow-hidden group hover:-translate-y-[2px] hover:shadow-lg transition-all duration-300"
                            >
                                {/* Image */}
                                <div className="relative aspect-[1.6/1] bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] to-[color-mix(in_oklab,var(--brand-violet-500)_8%,transparent)] overflow-hidden">
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-10 h-10 text-white/20" strokeWidth={1.2} />
                                        </div>
                                    )}
                                    {/* Status badge (top-left) */}
                                    <div className="absolute top-2.5 left-2.5">
                                        {!product.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-black/40 text-white/70 backdrop-blur-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                                {t.products.inactiveStatus}
                                            </span>
                                        ) : !isService && available <= 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[color-mix(in_oklab,var(--destructive)_28%,transparent)] text-[var(--destructive)] backdrop-blur-sm">
                                                {t.products.outOfStock}
                                            </span>
                                        ) : !isService && available < 5 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[color-mix(in_oklab,var(--warning)_28%,transparent)] text-[var(--warning)] backdrop-blur-sm">
                                                Цөөхөн үлдсэн
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[color-mix(in_oklab,var(--success)_28%,transparent)] text-[var(--success)] backdrop-blur-sm">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                                                Идэвхтэй
                                            </span>
                                        )}
                                    </div>
                                    {/* Discount badge (top-right) */}
                                    {(product.discount_percent || 0) > 0 && (
                                        <div className="absolute top-2.5 right-2.5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[var(--destructive)] text-white">
                                                -{product.discount_percent}%
                                            </span>
                                        </div>
                                    )}
                                    {/* Actions — always visible on mobile, hover-only on desktop */}
                                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingProduct(product); setShowModal(true); }}
                                            aria-label="Засах"
                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-md hover:bg-black/80 active:scale-95 transition-all touch-manipulation"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            aria-label="Устгах"
                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-md hover:bg-[var(--destructive)]/80 active:scale-95 transition-all touch-manipulation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
                                        </button>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-4 space-y-2">
                                    <div>
                                        <p className="font-semibold text-[13.5px] text-foreground tracking-[-0.01em] line-clamp-1">
                                            {product.name}
                                        </p>
                                        {product.description && (
                                            <p className="text-[11.5px] text-white/40 mt-0.5 line-clamp-1">
                                                {product.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-end justify-between pt-1">
                                        <div>
                                            {(product.discount_percent || 0) > 0 ? (
                                                <>
                                                    <p className="text-[10.5px] text-white/35 line-through tabular-nums leading-none">
                                                        ₮{product.price.toLocaleString()}
                                                    </p>
                                                    <p className="text-[16px] font-bold text-[var(--destructive)] tabular-nums mt-0.5">
                                                        ₮{finalPrice.toLocaleString()}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-[16px] font-bold text-foreground tabular-nums">
                                                    ₮{product.price.toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                                {isService
                                                    ? product.type === 'service'
                                                        ? t.products.service
                                                        : t.products.appointment
                                                    : 'Нөөц'}
                                            </p>
                                            <p
                                                className={cn(
                                                    'text-[13px] font-semibold tabular-nums',
                                                    isService
                                                        ? 'text-white/45'
                                                        : available <= 0
                                                            ? 'text-[var(--destructive)]'
                                                            : available < 5
                                                                ? 'text-[var(--warning)]'
                                                                : 'text-foreground'
                                                )}
                                            >
                                                {isService ? '—' : `${available} ${t.products.pcs}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-[#0c0c0f] rounded-2xl border border-white/[0.08] w-full max-w-4xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] p-4 sm:p-5 relative shadow-2xl overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.02em]">
                                {editingProduct ? t.products.edit : t.products.newEntry}
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close"
                                onClick={() => setShowModal(false)}
                            >
                                <X className="w-4 h-4" strokeWidth={1.8} />
                            </Button>
                        </div>

                        <ProductForm
                            product={editingProduct}
                            onSuccess={() => { setShowModal(false); setEditingProduct(null); queryClient.invalidateQueries({ queryKey: ['products'] }); }}
                            onCancel={() => setShowModal(false)}
                        />
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-[#0c0c0f] rounded-2xl border border-white/[0.08] w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] p-4 sm:p-5 relative shadow-2xl overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.02em]">
                                {t.products.importFromFile}
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Close"
                                onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportError(null); }}
                            >
                                <X className="w-4 h-4" strokeWidth={1.8} />
                            </Button>
                        </div>

                        {/* File Upload Area */}
                        <div className="border border-dashed border-white/[0.12] rounded-xl p-8 text-center hover:border-[var(--brand-indigo)] transition-colors relative bg-white/[0.02]">
                            {importFile ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileSpreadsheet className="w-6 h-6 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                                    <div className="text-left">
                                        <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{importFile.name}</p>
                                        <p className="text-[11px] text-white/40">{(importFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button
                                        onClick={() => { setImportFile(null); setImportPreview([]); }}
                                        className="ml-4 p-1.5 rounded-lg text-white/30 hover:text-[var(--destructive)] hover:bg-white/[0.04] transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <FileSpreadsheet className="w-10 h-10 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                                    <p className="text-[13.5px] text-foreground mb-1 tracking-[-0.01em] font-medium">{t.products.selectFile}</p>
                                    <p className="text-[11.5px] text-white/35">xlsx, xls, csv, docx</p>
                                </>
                            )}
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv,.docx"
                                onChange={handleImportFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>

                        {importError && (
                            <div className="mt-4 p-3 bg-[color-mix(in_oklab,var(--destructive)_18%,transparent)] border border-[color-mix(in_oklab,var(--destructive)_30%,transparent)] rounded-lg text-[var(--destructive)] text-[13px]">
                                {importError}
                            </div>
                        )}

                        {importPreview.length > 0 && (
                            <div className="mt-5">
                                <h3 className="font-semibold text-[13px] text-foreground mb-3 tracking-[-0.01em]">
                                    {t.products.preview} ({importPreview.length} {t.products.productCol})
                                </h3>
                                <div className="max-h-64 overflow-auto border border-white/[0.06] rounded-lg">
                                    <table className="w-full text-[12px]">
                                        <thead className="bg-white/[0.02] sticky top-0">
                                            <tr className="border-b border-white/[0.06]">
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-[0.08em] text-[10px]">{t.products.name}</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-[0.08em] text-[10px]">{t.products.type}</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-[0.08em] text-[10px]">{t.products.price}</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-[0.08em] text-[10px]">{t.products.quantity}</th>
                                                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-[0.08em] text-[10px]">{t.products.description}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {importPreview.slice(0, 10).map((p, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 text-foreground">{p.name}</td>
                                                    <td className="px-3 py-2">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/60">
                                                            {p.type === 'service' ? t.products.service : p.type === 'appointment' ? t.products.appointment : t.products.physical}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-white/60 tabular-nums">₮{p.price?.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-white/60 tabular-nums">{p.stock || 0} {p.unit}</td>
                                                    <td className="px-3 py-2 text-white/45 truncate max-w-[200px]">{p.description || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {importPreview.length > 10 && (
                                    <p className="text-[11px] text-white/35 mt-2">
                                        ... {t.products.andMore.replace('{count}', String(importPreview.length - 10))}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mt-5 card-outlined p-4">
                            <h4 className="font-semibold text-[12px] text-foreground mb-2 tracking-[-0.01em]">
                                {t.products.formatGuide}
                            </h4>
                            <ul className="text-[11.5px] text-white/50 space-y-1">
                                <li><strong className="text-foreground">Excel:</strong> {t.products.excelFormat}</li>
                                <li><strong className="text-foreground">Word:</strong> {t.products.wordFormat}</li>
                            </ul>
                        </div>

                        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[0.06]">
                            <Button
                                variant="ghost"
                                size="md"
                                disabled={importing}
                                onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setImportError(null); }}
                            >
                                {t.orders.cancel}
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                disabled={importing || importPreview.length === 0}
                                onClick={handleImportConfirm}
                            >
                                {importing ? t.products.importing : `${importPreview.length} ${t.products.importProducts}`}
                            </Button>
                        </div>
                        {outOfStockCount > 0 && false /* placeholder, not used */}
                    </div>
                </div>
            )}
        </div>
    );
}
