'use client';

import { useState } from 'react';
import { Store, ArrowRight } from 'lucide-react';

interface ShopInfoStepProps {
  initialData: {
    name: string;
    owner_name: string;
    phone: string;
  };
  onNext: (data: { name: string; owner_name: string; phone: string }) => Promise<void>;
}

export function ShopInfoStep({ initialData, onNext }: ShopInfoStepProps) {
  const [name, setName] = useState(initialData.name || '');
  const [ownerName, setOwnerName] = useState(initialData.owner_name || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      await onNext({ name, owner_name: ownerName, phone });
    } catch (err: any) {
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Дэлгүүрийн мэдээлэл</h2>
        <p className="text-gray-400">Таны дэлгүүрийн үндсэн мэдээлэл</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Дэлгүүрийн нэр *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Жишээ: Миний дэлгүүр"
            required
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Эзэмшигчийн нэр</label>
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Таны нэр"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Утасны дугаар</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="99001122"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name || saving}
        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          <>
            Үргэлжлүүлэх
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}

