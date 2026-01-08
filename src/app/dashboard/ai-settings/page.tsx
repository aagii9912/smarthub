'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Bot, Save, Upload, FileText, Sparkles, AlertCircle } from 'lucide-react';

export default function AISettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shopDescription, setShopDescription] = useState('');
    const [aiInstructions, setAiInstructions] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchShopData();
    }, []);

    async function fetchShopData() {
        try {
            const res = await fetch('/api/shop');
            const data = await res.json();
            if (data.shop) {
                setShopDescription(data.shop.description || '');
                setAiInstructions(data.shop.ai_instructions || '');
            }
        } catch (error) {
            console.error('Failed to fetch shop:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: shopDescription,
                    ai_instructions: aiInstructions,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to save');
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Хадгалахад алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.[0]) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'instructions');

        try {
            // Use mammoth to extract text from docx
            const arrayBuffer = await file.arrayBuffer();

            // For now, we'll just read text files directly
            // DOCX parsing would need server-side processing
            if (file.name.endsWith('.txt')) {
                const text = await file.text();
                setAiInstructions(prev => prev + '\n' + text);
            } else if (file.name.endsWith('.docx')) {
                // Will be processed server-side
                setError('DOCX файл серверт боловсруулагдаж байна...');
                // TODO: Add API endpoint for DOCX parsing
            }
        } catch (error) {
            console.error('File upload error:', error);
            setError('Файл уншихад алдаа гарлаа');
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Bot className="w-7 h-7 text-violet-600" />
                    AI Тохируулга
                </h1>
                <p className="text-gray-500 mt-1">Chatbot-ийн зан байдлыг өөрчлөх</p>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Амжилттай хадгалагдлаа!
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Shop Description */}
            <Card>
                <CardContent className="p-6">
                    <h2 className="font-semibold text-gray-900 mb-2">Дэлгүүрийн тайлбар</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        AI энэ мэдээллийг ашиглан дэлгүүрийн талаар дэлгэрэнгүй хариулна
                    </p>
                    <Textarea
                        value={shopDescription}
                        onChange={(e) => setShopDescription(e.target.value)}
                        placeholder="Жишээ: Манай дэлгүүр бол гар урлалын бүтээгдэхүүн борлуулдаг. 100% байгалийн материал ашигладаг..."
                        rows={4}
                    />
                </CardContent>
            </Card>

            {/* AI Instructions */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold text-gray-900">AI Заавар</h2>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded-lg cursor-pointer transition-colors">
                            <Upload className="w-4 h-4" />
                            Файл оруулах
                            <input
                                type="file"
                                accept=".txt,.docx"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        AI хэрхэн ярих, ямар хэв маягтай байхыг заана уу
                    </p>
                    <Textarea
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        placeholder={`Жишээ зааврууд:
- Хэрэглэгчтэй маш найрсаг, дотно харилцаарай
- Бүтээгдэхүүний материал, хийх үйлдвэрлэлийн тухай дэлгэрэнгүй тайлбарла
- Монгол үндэсний соёлыг онцол
- Хэрэв үнэ асуувал эхлээд чанарын талаар ярьж, дараа нь үнийг хэл
- Заримдаа "Таалагдсан уу?" гэх мэт эерэг асуулт тавь`}
                        rows={8}
                    />
                </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-violet-50 border-violet-100">
                <CardContent className="p-6">
                    <h3 className="font-medium text-violet-900 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Зөвлөмж
                    </h3>
                    <ul className="text-sm text-violet-800 space-y-2">
                        <li>• <strong>Найрсаг</strong> - "Хэрэглэгчтэй найзын адил яриарай"</li>
                        <li>• <strong>Мэргэжлийн</strong> - "Албан ёсны, мэргэжлийн хэлээр хариулаарай"</li>
                        <li>• <strong>Борлуулалтад чиглүүлэх</strong> - "Бүтээгдэхүүний давуу талыг онцол"</li>
                        <li>• <strong>Тусгай мэдээлэл</strong> - "Хүргэлт 24 цагийн дотор гэж хэлээрэй"</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </Button>
            </div>
        </div>
    );
}
