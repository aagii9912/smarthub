'use client';

import { useState } from 'react';
import { Store, ArrowRight, Building2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ShopInfoStepProps {
  initialData: {
    name: string;
    owner_name: string;
    phone: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
  };
  onNext: (data: {
    name: string;
    owner_name: string;
    phone: string;
    bank_name?: string;
    account_number?: string;
    account_name?: string;
  }) => Promise<void>;
}

export function ShopInfoStep({ initialData, onNext }: ShopInfoStepProps) {
  const [name, setName] = useState(initialData.name || '');
  const [ownerName, setOwnerName] = useState(initialData.owner_name || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [bankName, setBankName] = useState(initialData.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(initialData.account_number || '');
  const [accountName, setAccountName] = useState(initialData.account_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Дэлгүүрийн нэр оруулна уу';
    } else if (name.length < 2) {
      newErrors.name = 'Хамгийн багадаа 2 тэмдэгт байх ёстой';
    }

    if (phone && !/^[0-9]{8}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Утасны дугаар 8 оронтой байх ёстой';
    }

    if (accountNumber && !/^[0-9]{8,16}$/.test(accountNumber.replace(/\s/g, ''))) {
      newErrors.accountNumber = 'Дансны дугаар зөв биш байна';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Мэдээлэл дутуу байна');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onNext({
        name,
        owner_name: ownerName,
        phone,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName
      });
      toast.success('Амжилттай хадгаллаа!');
    } catch (err: any) {
      setError(err.message || 'Алдаа гарлаа');
      toast.error(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store className="w-8 h-8 text-violet-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Дэлгүүрийн мэдээлэл</h2>
        <p className="text-gray-500">Таны дэлгүүрийн үндсэн мэдээлэл</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Дэлгүүрийн нэр *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
            placeholder="Жишээ: Миний дэлгүүр"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Эзэмшигчийн нэр</label>
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Таны нэр"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Утасны дугаар</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })); }}
            placeholder="99001122"
            className={`w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.phone}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-gray-900">Дансны мэдээлэл</h3>
            <span className="text-xs text-gray-500">(Заавал биш)</span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Банкны нэр</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Хаан банк"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Дансны дугаар</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="5000000000"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Дансны нэр</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Эзэмшигчийн нэр"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name || saving}
        className="w-full py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
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
