'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Bot, Save, Upload, FileText, Sparkles, AlertCircle, Smile, Briefcase, Zap, Cloud, PartyPopper } from 'lucide-react';

type AiEmotion = 'friendly' | 'professional' | 'enthusiastic' | 'calm' | 'playful';

const emotionOptions: Array<{ value: AiEmotion; label: string; desc: string; icon: React.ReactNode }> = [
    { value: 'friendly', label: 'Найрсаг 😊', desc: 'Халуун дотно, эерэг', icon: <Smile className="w-5 h-5" /> },
    { value: 'professional', label: 'Мэргэжлийн 👔', desc: 'Албан ёсны, товч', icon: <Briefcase className="w-5 h-5" /> },
    { value: 'enthusiastic', label: 'Урам зоригтой 🎉', desc: 'Идэвхтэй, сэтгэлтэй', icon: <Zap className="w-5 h-5" /> },
    { value: 'calm', label: 'Тайван 🧘', desc: 'Эв нямбай, тайвшруулах', icon: <Cloud className="w-5 h-5" /> },
    { value: 'playful', label: 'Тоглоомтой 🎮', desc: 'Хөгжилтэй, шог', icon: <PartyPopper className="w-5 h-5" /> },
];

export default function AISettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shopDescription, setShopDescription] = useState('');
    const [aiInstructions, setAiInstructions] = useState('');
    const [aiEmotion, setAiEmotion] = useState<AiEmotion>('friendly');
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
                setAiEmotion(data.shop.ai_emotion || 'friendly');
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
                    ai_emotion: aiEmotion,
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
        setError(null);

        try {
            if (file.name.endsWith('.txt')) {
                // TXT files are read directly
                const text = await file.text();
                setAiInstructions(prev => prev ? prev + '\n\n' + text : text);
            } else if (file.name.endsWith('.docx')) {
                // DOCX parsing requires additional setup
                // For now, inform user to use TXT format
                setError('DOCX форматыг дэмжихгүй байна. TXT файл ашиглана уу (Word дээр Save As → Plain Text сонгоно уу)');
            } else {
                setError('Зөвхөн .txt файл дэмждэг');
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

            {/* AI Emotion/Personality */}
            <Card>
                <CardContent className="p-6">
                    <h2 className="font-semibold text-gray-900 mb-2">AI Зан байдал</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        AI-н ярианы хэв маягийг сонгоно уу
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {emotionOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setAiEmotion(option.value)}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${aiEmotion === option.value
                                    ? 'border-violet-500 bg-violet-50'
                                    : 'border-gray-200 hover:border-violet-200 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`mb-2 ${aiEmotion === option.value ? 'text-violet-600' : 'text-gray-400'}`}>
                                    {option.icon}
                                </div>
                                <p className={`font-medium text-sm ${aiEmotion === option.value ? 'text-violet-900' : 'text-gray-700'}`}>
                                    {option.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                            </button>
                        ))}
                    </div>
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
