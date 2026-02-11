'use client';

import { useState } from 'react';
import {
  Facebook, CheckCircle, ArrowLeft, ArrowRight,
  MessageSquare, ExternalLink, Package, RefreshCw
} from 'lucide-react';

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
}

interface FacebookStepProps {
  initialData: {
    fbConnected: boolean;
    fbPageName: string;
    fbPageId: string;
  };
  fbPages: FacebookPage[];
  onConnect: () => void;
  onSelectPage: (pageId: string) => Promise<void>;
  onManualSave: (data: { pageId: string; pageName: string; accessToken: string }) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}

export function FacebookStep({
  initialData,
  fbPages,
  onConnect,
  onSelectPage,
  onManualSave,
  onBack,
  onNext
}: FacebookStepProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Manual fields
  const [manualPageName, setManualPageName] = useState(initialData.fbPageName || '');
  const [manualPageId, setManualPageId] = useState(initialData.fbPageId || '');
  const [manualToken, setManualToken] = useState('');

  const handleSelect = async (id: string) => {
    setSelectedPageId(id);
    setSaving(true);
    setError('');
    try {
      await onSelectPage(id);
    } catch (err: any) {
      setError(err.message || 'Page сонгоход алдаа гарлаа');
    } finally {
      setSaving(false);
      setSelectedPageId(null);
    }
  };

  const handleManualSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await onManualSave({
        pageId: manualPageId,
        pageName: manualPageName,
        accessToken: manualToken
      });
    } catch (err: any) {
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const fetchPagesWithToken = async () => {
    if (!manualToken) {
      setError('Page Access Token оруулна уу');
      return;
    }
    setFbLoading(true);
    setError('');
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${manualToken}&fields=id,name,access_token,category`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      // Logic for updating list from token can be complex, for now let's keep it simple
      // or just allow saving the token manually
      setError('Энэ хэсгийг parent-аас удирдах эсвэл шууд хадгалах боломжтой');
    } catch (err: any) {
      setError(err.message || 'Page татахад алдаа гарлаа');
    } finally {
      setFbLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Facebook className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Facebook Page холбох</h2>
        <p className="text-gray-500">Messenger чатбот идэвхжүүлэхийн тулд Page холбоно уу</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => {
                setError('');
                setRetryCount(c => c + 1);
                onConnect();
              }}
              className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Дахин оролдох
            </button>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-red-500 mt-2">
              Оролдлого: {retryCount} удаа
            </p>
          )}
        </div>
      )}

      {initialData.fbConnected && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-emerald-700 font-medium">Facebook Page холбогдсон!</p>
              <p className="text-sm text-emerald-600 opacity-80">{initialData.fbPageName}</p>
            </div>
          </div>
        </div>
      )}

      {fbPages.length > 0 && (
        <div className="space-y-4">
          <p className="text-gray-700 text-center font-medium">Page сонгоно уу:</p>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {fbPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleSelect(page.id)}
                disabled={saving}
                className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${selectedPageId === page.id
                  ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20'
                  : 'bg-[#0F0B2E] border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-gray-900 font-medium">{page.name}</p>
                  {page.category && <p className="text-sm text-gray-500">{page.category}</p>}
                </div>
                {selectedPageId === page.id && saving && (
                  <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!initialData.fbConnected && fbPages.length === 0 && (
        <>
          <button
            onClick={onConnect}
            className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
          >
            <Facebook className="w-6 h-6" />
            Facebook-ээр холбох
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0F0B2E] text-gray-500">эсвэл</span>
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 text-sm text-center list-none font-medium transition-colors">
              Гараар оруулах ↓
            </summary>
            <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-blue-700 font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Хэрхэн холбох вэ?
                </h3>
                <ol className="text-sm text-blue-900/70 space-y-2 list-decimal list-inside">
                  <li><a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">Facebook Developers <ExternalLink className="w-3 h-3" /></a> руу орно</li>
                  <li>Апп үүсгээд Messenger product нэмнэ</li>
                  <li>Page Access Token авна</li>
                  <li>Webhook URL: <code className="bg-white px-2 py-0.5 rounded text-xs border border-blue-200 select-all">https://smarthub-opal.vercel.app/api/webhook</code></li>
                </ol>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={manualPageName}
                  onChange={(e) => setManualPageName(e.target.value)}
                  placeholder="Page нэр"
                  className="w-full px-4 py-3 bg-[#0F0B2E] border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <input
                  type="text"
                  value={manualPageId}
                  onChange={(e) => setManualPageId(e.target.value)}
                  placeholder="Page ID"
                  className="w-full px-4 py-3 bg-[#0F0B2E] border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <textarea
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Page Access Token"
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0F0B2E] border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm font-mono transition-all"
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={saving || !manualPageId || !manualToken || !manualPageName}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {saving ? 'Хадгалж байна...' : 'Гараар хадгалах'}
                </button>
              </div>
            </div>
          </details>
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
          {initialData.fbConnected ? 'Үргэлжлүүлэх' : 'Алгасах'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

