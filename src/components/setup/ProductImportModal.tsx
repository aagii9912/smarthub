'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import {
    Upload, FileSpreadsheet, X, Check,
    AlertCircle, Loader2, Download, Sparkles, Table
} from 'lucide-react';

interface ProductVariant {
    sku?: string;
    options: { color?: string; size?: string };
    price?: number;
    stock: number;
}

interface Product {
    name: string;
    price: number;
    description?: string;
    image_url?: string;
    stock?: number;
    type?: string;
    unit?: string;
    colors?: string[];
    sizes?: string[];
    variants?: ProductVariant[];
}

interface ProductImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (products: Product[]) => Promise<void>;
}

// Parse CSV content
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
    // \r\n (Windows/Excel export) болон \n хоёуланг нь дэмжинэ
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV файл хоосон байна');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
        // Handle quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    });

    return { headers, rows };
}

type ImportMode = 'csv' | 'excel';
type ModalStep = 'upload' | 'mapping' | 'ai-processing' | 'preview';

export function ProductImportModal({ isOpen, onClose, onImport }: ProductImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<ImportMode>('excel');

    const EMPTY_MAPPING: Record<string, number> = {
        name: -1,
        price: -1,
        stock: -1,
        colors: -1,
        sizes: -1,
        description: -1,
        image_url: -1
    };

    // CSV state
    const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, number>>(EMPTY_MAPPING);

    // Excel AI state
    const [aiProducts, setAiProducts] = useState<Product[]>([]);
    const [aiSource, setAiSource] = useState<'ai' | 'manual_fallback' | null>(null);
    const [aiSkippedCount, setAiSkippedCount] = useState(0);
    const [aiWarning, setAiWarning] = useState('');

    // Common state
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [step, setStep] = useState<ModalStep>('upload');

    const requiredColumns = ['name', 'price'];
    const optionalColumns = ['stock', 'colors', 'sizes', 'description', 'image_url'];

    // ═══════════ CSV Handler ═══════════
    const handleCSVSelect = async (selectedFile: File) => {
        try {
            const content = await selectedFile.text();
            const parsed = parseCSV(content);

            // Auto-map columns
            const autoMapping: Record<string, number> = { ...EMPTY_MAPPING };

            parsed.headers.forEach((header, index) => {
                const normalized = header.toLowerCase().replace(/[^a-zа-яөүё_]/g, '');
                if (normalized.includes('name') || normalized.includes('нэр')) {
                    autoMapping.name = index;
                } else if (normalized.includes('price') || normalized.includes('үнэ')) {
                    autoMapping.price = index;
                } else if (normalized.includes('color') || normalized.includes('өнгө')) {
                    autoMapping.colors = index;
                } else if (normalized.includes('size') || normalized.includes('размер') || (normalized.includes('хэмжээ') && !normalized.includes('тоо'))) {
                    // "Тоо хэмжээ" = stock, харин "Хэмжээ" = size
                    autoMapping.sizes = index;
                } else if (normalized.includes('stock') || normalized.includes('тоо') || normalized.includes('үлдэгдэл') || normalized.includes('qty')) {
                    autoMapping.stock = index;
                } else if (normalized.includes('desc') || normalized.includes('тайлбар')) {
                    autoMapping.description = index;
                } else if (normalized.includes('image') || normalized.includes('зураг')) {
                    autoMapping.image_url = index;
                }
            });

            setFile(selectedFile);
            setParsedData(parsed);
            setColumnMapping(autoMapping);
            setError('');
            setStep('mapping');
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Файл уншихад алдаа гарлаа');
        }
    };

    // ═══════════ Excel AI Handler ═══════════
    const handleExcelSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setError('');
        setStep('ai-processing');
        setAiProducts([]);
        setAiSource(null);

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const res = await fetch('/api/shop/products/import-excel', {
                method: 'POST',
                headers: {
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Excel файл уншихад алдаа гарлаа');
            }

            if (!data.products || data.products.length === 0) {
                throw new Error('Бараа олдсонгүй. Файлын бүтцийг шалгана уу.');
            }

            // Map AI results to our Product interface
            const mapped: Product[] = data.products.map((p: {
                name?: string;
                price?: number;
                stock?: number;
                description?: string;
                type?: string;
                unit?: string;
                colors?: string[];
                sizes?: string[];
                variants?: ProductVariant[];
            }) => ({
                name: p.name || '',
                price: Number(p.price) || 0,
                description: p.description || undefined,
                stock: Number(p.stock) || 0,
                type: p.type || 'physical',
                unit: p.unit || undefined,
                colors: Array.isArray(p.colors) ? p.colors.filter(Boolean) : [],
                sizes: Array.isArray(p.sizes) ? p.sizes.filter(Boolean) : [],
                variants: Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : undefined,
            })).filter((p: Product) => p.name && p.price > 0);

            setAiProducts(mapped);
            setAiSource(data.source || 'ai');
            setAiSkippedCount(Math.max(0, data.products.length - mapped.length));
            setAiWarning(data.warning || '');
            setStep('preview');
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Excel импорт алдаа');
            setStep('upload');
        }
    };

    // ═══════════ File Select Router ═══════════
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const name = selectedFile.name.toLowerCase();

        if (name.endsWith('.csv')) {
            setImportMode('csv');
            await handleCSVSelect(selectedFile);
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            setImportMode('excel');
            await handleExcelSelect(selectedFile);
        } else {
            setError('CSV эсвэл Excel (.xlsx) файл оруулна уу');
        }
    };

    const handleColumnMap = (field: string, columnIndex: number) => {
        setColumnMapping(prev => ({ ...prev, [field]: columnIndex }));
    };

    const validateMapping = () => {
        const missing = requiredColumns.filter(col => columnMapping[col] === -1);
        if (missing.length > 0) {
            setError(`Шаардлагатай багана дутуу: ${missing.join(', ')}`);
            return false;
        }
        setError('');
        return true;
    };

    const handleProceedToPreview = () => {
        if (validateMapping()) {
            setStep('preview');
        }
    };

    // Get products based on import mode
    const getProducts = (limit?: number): Product[] => {
        if (importMode === 'excel') {
            return limit ? aiProducts.slice(0, limit) : aiProducts;
        }

        if (!parsedData) return [];

        const splitList = (value?: string) =>
            value ? value.split(/[,;]/).map(s => s.trim()).filter(Boolean) : [];

        const rows = limit ? parsedData.rows.slice(0, limit) : parsedData.rows;
        return rows.map(row => ({
            name: columnMapping.name >= 0 ? row[columnMapping.name] || '' : '',
            price: columnMapping.price >= 0 ? parseFloat(row[columnMapping.price]) || 0 : 0,
            stock: columnMapping.stock >= 0 ? parseInt(row[columnMapping.stock]) || 0 : undefined,
            colors: columnMapping.colors >= 0 ? splitList(row[columnMapping.colors]) : [],
            sizes: columnMapping.sizes >= 0 ? splitList(row[columnMapping.sizes]) : [],
            description: columnMapping.description >= 0 ? row[columnMapping.description] : undefined,
            image_url: columnMapping.image_url >= 0 ? row[columnMapping.image_url] : undefined
        })).filter(p => p.name && p.price > 0);
    };

    const handleImport = async () => {
        const products = getProducts();
        if (products.length === 0) {
            setError('Оруулах бүтээгдэхүүн олдсонгүй');
            return;
        }

        setImporting(true);
        try {
            await onImport(products);
            onClose();
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Import хийхэд алдаа гарлаа');
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const res = await fetch('/api/shop/products/import-template');
            if (!res.ok) throw new Error('Загвар татахад алдаа гарлаа');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'syncly_products_template.xlsx';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setError((err instanceof Error ? err.message : String(err)) || 'Загвар татахад алдаа гарлаа');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setParsedData(null);
        setColumnMapping(EMPTY_MAPPING);
        setAiProducts([]);
        setAiSource(null);
        setAiSkippedCount(0);
        setAiWarning('');
        setError('');
        setStep('upload');
        setImportMode('excel');
    };

    if (!isOpen) return null;

    const allProducts = getProducts();
    const previewProducts = getProducts(5);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-[#0F0B2E] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            importMode === 'excel'
                                ? 'bg-emerald-100'
                                : 'bg-green-100'
                        }`}>
                            {importMode === 'excel' ? (
                                <Sparkles className="w-5 h-5 text-emerald-600" />
                            ) : (
                                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">
                                {importMode === 'excel' ? 'Excel AI Import' : 'CSV Import'}
                            </h3>
                            <p className="text-xs text-gray-500">
                                {step === 'upload' && 'Файл сонгох'}
                                {step === 'mapping' && 'Багана тохируулах'}
                                {step === 'ai-processing' && 'AI боловсруулж байна...'}
                                {step === 'preview' && 'Урьдчилан харах'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetState(); onClose(); }}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {error && (
                        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/50 transition-all"
                            >
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="font-medium text-gray-700">Excel эсвэл CSV файл оруулах</p>
                                <p className="text-sm text-gray-500 mt-1">.xlsx, .xls, .csv файл дэмжигдэнэ</p>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-100">
                                        <Sparkles className="w-3 h-3" />
                                        AI автомат таних
                                    </span>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <button
                                onClick={downloadTemplate}
                                disabled={downloadingTemplate}
                                className="w-full flex items-center justify-center gap-2 text-sm text-violet-600 hover:text-violet-700 py-2 disabled:opacity-50"
                            >
                                {downloadingTemplate ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Excel загвар файл татах (.xlsx)
                            </button>
                            <p className="text-xs text-gray-400 text-center -mt-2">
                                Загварт Нэр, Үнэ, Тоо, Өнгө, Хэмжээ зэрэг баганууд жишээтэйгээ бэлэн байгаа
                            </p>
                        </div>
                    )}

                    {/* Step: AI Processing (Excel only) */}
                    {step === 'ai-processing' && (
                        <div className="py-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                                <Sparkles className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">AI боловсруулж байна</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    &quot;{file?.name}&quot; файлыг уншиж, барааны мэдээллийг таньж байна...
                                </p>
                            </div>
                            <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
                            <p className="text-xs text-gray-400">Энэ процесс хэдхэн секунд үргэлжилнэ</p>
                        </div>
                    )}

                    {/* Step 2: Column Mapping (CSV only) */}
                    {step === 'mapping' && parsedData && importMode === 'csv' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded-xl">
                                <p className="text-sm font-medium text-gray-700">
                                    📄 {file?.name} - {parsedData.rows.length} мөр
                                </p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-medium text-gray-900">Багана тохируулах:</p>

                                {[...requiredColumns, ...optionalColumns].map(field => (
                                    <div key={field} className="flex items-center gap-3">
                                        <span className={`w-28 text-sm ${requiredColumns.includes(field) ? 'font-medium' : 'text-gray-500'}`}>
                                            {field === 'name' && 'Нэр *'}
                                            {field === 'price' && 'Үнэ *'}
                                            {field === 'stock' && 'Тоо / Нөөц'}
                                            {field === 'colors' && 'Өнгө'}
                                            {field === 'sizes' && 'Хэмжээ'}
                                            {field === 'description' && 'Тайлбар'}
                                            {field === 'image_url' && 'Зургийн URL'}
                                        </span>
                                        <select
                                            value={columnMapping[field]}
                                            onChange={(e) => handleColumnMap(field, parseInt(e.target.value))}
                                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                                        >
                                            <option value={-1}>-- Сонгох --</option>
                                            {parsedData.headers.map((header, idx) => (
                                                <option key={idx} value={idx}>{header}</option>
                                            ))}
                                        </select>
                                        {columnMapping[field] >= 0 && (
                                            <Check className="w-4 h-4 text-green-500" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            {/* AI badge */}
                            {importMode === 'excel' && aiSource && (
                                <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium ${
                                    aiSource === 'ai'
                                        ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                                        : 'bg-amber-50 border border-amber-100 text-amber-700'
                                }`}>
                                    {aiSource === 'ai' ? (
                                        <>
                                            <Sparkles className="w-3.5 h-3.5" />
                                            AI автоматаар {allProducts.length} бараа таньлаа
                                        </>
                                    ) : (
                                        <>
                                            <Table className="w-3.5 h-3.5" />
                                            Баганы нэрээр {allProducts.length} бараа олдлоо
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Алгасагдсан мөр / том файлын анхааруулга */}
                            {importMode === 'excel' && aiSkippedCount > 0 && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-amber-50 border border-amber-100 text-amber-700">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {aiSkippedCount} мөр нэр эсвэл үнэ дутуу тул алгасагдлаа
                                </div>
                            )}
                            {importMode === 'excel' && aiWarning && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-amber-50 border border-amber-100 text-amber-700">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {aiWarning}
                                </div>
                            )}

                            <p className="text-sm font-medium text-gray-900">
                                Урьдчилан харах ({allProducts.length} бүтээгдэхүүн)
                            </p>

                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Нэр</th>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Өнгө / Хэмжээ</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600">Үнэ</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600">Тоо</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewProducts.map((product, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 text-gray-900">
                                                    {product.name}
                                                    {(product.variants?.length ?? 0) > 0 && (
                                                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">
                                                            {product.variants!.length} хувилбар
                                                        </span>
                                                    )}
                                                    {product.description && (
                                                        <span className="block text-xs text-gray-400 truncate max-w-[160px]">
                                                            {product.description}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                                                        {(product.colors || []).map((c, i) => (
                                                            <span key={`c-${i}`} className="px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-600 border border-violet-100">
                                                                {c}
                                                            </span>
                                                        ))}
                                                        {(product.sizes || []).map((s, i) => (
                                                            <span key={`s-${i}`} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                                {s}
                                                            </span>
                                                        ))}
                                                        {!(product.colors?.length || product.sizes?.length) && (
                                                            <span className="text-xs text-gray-300">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                                                    {product.price.toLocaleString()}₮
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                                                    {product.stock ?? 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {allProducts.length > 5 && (
                                <p className="text-xs text-gray-500 text-center">
                                    ... болон {allProducts.length - 5} бусад бүтээгдэхүүн
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t bg-gray-50">
                    {step === 'upload' && (
                        <Button variant="secondary" className="flex-1" onClick={onClose}>
                            Болих
                        </Button>
                    )}

                    {step === 'ai-processing' && (
                        <Button variant="secondary" className="flex-1" onClick={() => { resetState(); }}>
                            Болих
                        </Button>
                    )}

                    {step === 'mapping' && (
                        <>
                            <Button variant="secondary" onClick={() => setStep('upload')}>
                                Буцах
                            </Button>
                            <Button className="flex-1" onClick={handleProceedToPreview}>
                                Үргэлжлүүлэх
                            </Button>
                        </>
                    )}

                    {step === 'preview' && (
                        <>
                            <Button variant="secondary" onClick={() => {
                                if (importMode === 'csv') {
                                    setStep('mapping');
                                } else {
                                    resetState();
                                }
                            }}>
                                Буцах
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleImport}
                                disabled={importing}
                            >
                                {importing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Import ({allProducts.length})
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
