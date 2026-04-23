'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import {
    Upload, FileSpreadsheet, X, Check,
    AlertCircle, Loader2, Download, Sparkles, Table
} from 'lucide-react';

interface Product {
    name: string;
    price: number;
    description?: string;
    image_url?: string;
    stock?: number;
    type?: string;
}

interface ProductImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (products: Product[]) => Promise<void>;
}

// Parse CSV content
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
    const lines = content.trim().split('\n');
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

// Sample CSV template
const SAMPLE_CSV = `name,price,description,image_url
Цамц (Хар),45000,Хар өнгөтэй хөвөн цамц,
Өмд (Цэнхэр),55000,Цэнхэр жинс өмд,
Малгай,15000,Дулаан өвлийн малгай,`;

type ImportMode = 'csv' | 'excel';
type ModalStep = 'upload' | 'mapping' | 'ai-processing' | 'preview';

export function ProductImportModal({ isOpen, onClose, onImport }: ProductImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<ImportMode>('excel');

    // CSV state
    const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [columnMapping, setColumnMapping] = useState<Record<string, number>>({
        name: -1,
        price: -1,
        description: -1,
        image_url: -1
    });

    // Excel AI state
    const [aiProducts, setAiProducts] = useState<Product[]>([]);
    const [aiSource, setAiSource] = useState<'ai' | 'manual_fallback' | null>(null);

    // Common state
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<ModalStep>('upload');

    const requiredColumns = ['name', 'price'];
    const optionalColumns = ['description', 'image_url'];

    // ═══════════ CSV Handler ═══════════
    const handleCSVSelect = async (selectedFile: File) => {
        try {
            const content = await selectedFile.text();
            const parsed = parseCSV(content);

            // Auto-map columns
            const autoMapping: Record<string, number> = {
                name: -1,
                price: -1,
                description: -1,
                image_url: -1
            };

            parsed.headers.forEach((header, index) => {
                const normalized = header.toLowerCase().replace(/[^a-z]/g, '');
                if (normalized.includes('name') || normalized.includes('нэр')) {
                    autoMapping.name = index;
                } else if (normalized.includes('price') || normalized.includes('үнэ')) {
                    autoMapping.price = index;
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
            }) => ({
                name: p.name || '',
                price: Number(p.price) || 0,
                description: p.description || undefined,
                stock: Number(p.stock) || 0,
                type: p.type || 'physical',
            })).filter((p: Product) => p.name && p.price > 0);

            setAiProducts(mapped);
            setAiSource(data.source || 'ai');
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

        const rows = limit ? parsedData.rows.slice(0, limit) : parsedData.rows;
        return rows.map(row => ({
            name: columnMapping.name >= 0 ? row[columnMapping.name] || '' : '',
            price: columnMapping.price >= 0 ? parseFloat(row[columnMapping.price]) || 0 : 0,
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

    const downloadTemplate = () => {
        const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const resetState = () => {
        setFile(null);
        setParsedData(null);
        setColumnMapping({ name: -1, price: -1, description: -1, image_url: -1 });
        setAiProducts([]);
        setAiSource(null);
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
                                className="w-full flex items-center justify-center gap-2 text-sm text-violet-600 hover:text-violet-700 py-2"
                            >
                                <Download className="w-4 h-4" />
                                CSV загвар файл татах
                            </button>
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

                            <p className="text-sm font-medium text-gray-900">
                                Урьдчилан харах ({allProducts.length} бүтээгдэхүүн)
                            </p>

                            <div className="border rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Нэр</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600">Үнэ</th>
                                            {importMode === 'excel' && (
                                                <th className="px-3 py-2 text-right font-medium text-gray-600">Тоо</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewProducts.map((product, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 text-gray-900">
                                                    {product.name}
                                                    {product.description && (
                                                        <span className="block text-xs text-gray-400 truncate max-w-[200px]">
                                                            {product.description}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600 tabular-nums">
                                                    {product.price.toLocaleString()}₮
                                                </td>
                                                {importMode === 'excel' && (
                                                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                                                        {product.stock || 0}
                                                    </td>
                                                )}
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
