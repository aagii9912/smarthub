'use client';

import { useState } from 'react';
import { Store, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface ShopInfoStepProps {
  initialData: {
    name: string;
    owner_name: string;
    phone: string;
  };
  onNext: (data: {
    name: string;
    owner_name: string;
    phone: string;
  }) => Promise<void>;
  onPreviewUpdate?: (data: Record<string, string>) => void;
}

export function ShopInfoStep({ initialData, onNext, onPreviewUpdate }: ShopInfoStepProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialData.name || '');
  const [ownerName, setOwnerName] = useState(initialData.owner_name || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t.setup.shop.shopNameRequired;
    } else if (name.length < 2) {
      newErrors.name = t.setup.shop.shopNameMin;
    }

    if (phone && !/^[0-9]{8}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = t.setup.shop.phoneError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error(t.setup.shop.formIncomplete);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onNext({
        name,
        owner_name: ownerName,
        phone,
      });
      toast.success(t.setup.shop.savedSuccess);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || t.common.error);
      toast.error((err instanceof Error ? err.message : String(err)) || t.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="text-center mb-4 shrink-0">
        <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Store className="w-6 h-6 text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1.5">{t.setup.shop.title}</h2>
        <p className="text-sm text-gray-500">{t.setup.shop.subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3 shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">{t.setup.shop.shopName} *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); onPreviewUpdate?.({ name: e.target.value }); }}
            placeholder={t.setup.shop.shopNamePlaceholder}
            className={`w-full px-4 py-2.5 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm ${errors.name ? 'border-red-400 focus:ring-red-500' : 'border-gray-200'}`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">{t.setup.shop.ownerName}</label>
          <input
            type="text"
            value={ownerName}
            onChange={(e) => { setOwnerName(e.target.value); onPreviewUpdate?.({ owner_name: e.target.value }); }}
            placeholder={t.setup.shop.ownerNamePlaceholder}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">{t.setup.shop.phone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })); onPreviewUpdate?.({ phone: e.target.value }); }}
            placeholder="99001122"
            className={`w-full px-4 py-2.5 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm ${errors.phone ? 'border-red-400 focus:ring-red-500' : 'border-gray-200'}`}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.phone}
            </p>
          )}
        </div>

      </div>

      <div className="mt-auto shrink-0 pt-2">
        <button
          onClick={handleSubmit}
          disabled={!name || saving}
          className="w-full py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              {t.common.next}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
