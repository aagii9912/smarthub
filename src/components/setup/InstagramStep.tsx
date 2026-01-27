'use client';

import { useState } from 'react';
import {
    Instagram, CheckCircle, ArrowLeft, ArrowRight,
    MessageSquare, ExternalLink, AlertCircle
} from 'lucide-react';

interface InstagramStepProps {
    initialData: {
        igConnected: boolean;
        igUsername: string;
        igBusinessAccountId: string;
    };
    onManualSave: (data: {
        businessAccountId: string;
        username: string;
        accessToken: string
    }) => Promise<void>;
    onBack: () => void;
    onNext: () => void;
}

export function InstagramStep({
    initialData,
    onManualSave,
    onBack,
    onNext
}: InstagramStepProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Manual fields
    const [manualUsername, setManualUsername] = useState(initialData.igUsername || '');
    const [manualBusinessId, setManualBusinessId] = useState(initialData.igBusinessAccountId || '');
    const [manualToken, setManualToken] = useState('');

    const handleManualSubmit = async () => {
        if (!manualBusinessId || !manualToken || !manualUsername) {
            setError('Бүх талбаруудыг бөглөнө үү');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await onManualSave({
                businessAccountId: manualBusinessId,
                username: manualUsername,
                accessToken: manualToken
            });
        } catch (err: any) {
            setError(err.message || 'Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Instagram className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Instagram холбох</h2>
                <p className="text-gray-500">Instagram DM чатбот идэвхжүүлэхийн тулд Business Account холбоно уу</p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {initialData.igConnected && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-purple-500" />
                        <div>
                            <p className="text-purple-700 font-medium">Instagram холбогдсон!</p>
                            <p className="text-sm text-purple-600 opacity-80">@{initialData.igUsername}</p>
                        </div>
                    </div>
                </div>
            )}

            {!initialData.igConnected && (
                <>
                    {/* Requirements Alert */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <h3 className="text-amber-800 font-medium mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Шаардлага
                        </h3>
                        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                            <li>Instagram Business эсвэл Creator Account байх</li>
                            <li>Facebook Page-тэй холбогдсон байх</li>
                            <li>Meta Developer аппд Instagram Messaging идэвхжүүлсэн байх</li>
                        </ul>
                    </div>

                    {/* Manual Setup Instructions */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4">
                        <h3 className="text-purple-700 font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            Хэрхэн холбох вэ?
                        </h3>
                        <ol className="text-sm text-purple-900/70 space-y-2 list-decimal list-inside">
                            <li>
                                <a
                                    href="https://developers.facebook.com/apps"
                                    target="_blank"
                                    rel="noopener"
                                    className="text-purple-600 hover:underline inline-flex items-center gap-1 font-medium"
                                >
                                    Meta Developers <ExternalLink className="w-3 h-3" />
                                </a>
                                {' '}руу орно
                            </li>
                            <li>Messenger product → Instagram Settings → Add Instagram Account</li>
                            <li>Instagram Business Account ID авна (Messenger → Access Tokens хэсгээс)</li>
                            <li>Access Token Generate хийнэ (instagram_manage_messages permission-тэй)</li>
                            <li>
                                Webhook URL:
                                <code className="bg-white px-2 py-0.5 rounded text-xs border border-purple-200 select-all ml-1">
                                    https://smarthub-opal.vercel.app/api/webhook
                                </code>
                            </li>
                            <li>Webhook fields: <code className="bg-white px-1 py-0.5 rounded text-xs border border-purple-200">messages</code> subscribe хийнэ</li>
                        </ol>
                    </div>

                    {/* Manual Input Form */}
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={manualUsername}
                            onChange={(e) => setManualUsername(e.target.value)}
                            placeholder="Instagram username (@ -гүй)"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                        <input
                            type="text"
                            value={manualBusinessId}
                            onChange={(e) => setManualBusinessId(e.target.value)}
                            placeholder="Instagram Business Account ID"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                        <textarea
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                            placeholder="Instagram Access Token (Page Access Token ашиглаж болно)"
                            rows={3}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm font-mono transition-all"
                        />
                        <button
                            onClick={handleManualSubmit}
                            disabled={saving || !manualBusinessId || !manualToken || !manualUsername}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                        >
                            {saving ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Холбож байна...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Instagram className="w-5 h-5" />
                                    Instagram холбох
                                </span>
                            )}
                        </button>
                    </div>
                </>
            )}

            <div className="flex gap-4 pt-4">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Буцах
                </button>
                <button
                    onClick={onNext}
                    className="flex-1 py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                >
                    {initialData.igConnected ? 'Үргэлжлүүлэх' : 'Алгасах'}
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
