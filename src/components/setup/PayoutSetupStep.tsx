'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Wallet, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react';

interface PayoutSetupStepProps {
    onComplete: () => void;
    initialData?: {
        bank_name?: string;
        account_name?: string;
        account_number?: string;
        register_number?: string;
        merchant_type?: 'person' | 'company';
    };
}

const BANK_OPTIONS = [
    { value: 'Хаан банк', label: 'Хаан банк' },
    { value: 'Голомт банк', label: 'Голомт банк' },
    { value: 'Худалдаа хөгжлийн банк', label: 'Худалдаа хөгжлийн банк (TDB)' },
    { value: 'Хас банк', label: 'Хас банк' },
    { value: 'Капитрон банк', label: 'Капитрон банк' },
    { value: 'Төрийн банк', label: 'Төрийн банк' },
    { value: 'Богд банк', label: 'Богд банк' },
    { value: 'М банк', label: 'М банк' },
    { value: 'Капитал банк', label: 'Капитал банк' },
];

export function PayoutSetupStep({ onComplete, initialData }: PayoutSetupStepProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [qpayResult, setQpayResult] = useState<{ success: boolean; message: string } | null>(null);
    const [bankInfo, setBankInfo] = useState({
        bank_name: initialData?.bank_name || '',
        account_name: initialData?.account_name || '',
        account_number: initialData?.account_number || '',
        register_number: initialData?.register_number || '',
        merchant_type: initialData?.merchant_type || 'person' as 'person' | 'company',
    });

    const isValid = bankInfo.bank_name && bankInfo.account_name && bankInfo.account_number;

    const handleSave = async () => {
        if (!isValid) {
            setError('Банк, данс эзэмшигч, дансны дугаар заавал бөглөнө үү');
            return;
        }

        setSaving(true);
        setError('');
        setQpayResult(null);

        try {
            const shopId = localStorage.getItem('smarthub_active_shop_id') || '';
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify(bankInfo),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Хадгалахад алдаа гарлаа');
            }

            // Check if QPay auto-registration worked
            if (data.qpay_setup?.success) {
                setQpayResult({
                    success: true,
                    message: data.qpay_setup.message || 'QPay автоматаар идэвхжлээ! ✅',
                });
            } else if (data.qpay_setup && !data.qpay_setup.success) {
                setQpayResult({
                    success: false,
                    message: data.qpay_setup.message || 'QPay бүртгэл амжилтгүй — дараа Settings-ээс дахин оролдох боломжтой.',
                });
            } else {
                // No QPay setup info — bank info saved successfully
                setQpayResult({
                    success: true,
                    message: 'Банкны мэдээлэл амжилттай хадгалагдлаа',
                });
            }

            // Auto-proceed after 2 seconds on success
            setTimeout(() => {
                onComplete();
            }, 2000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        // Payout setup is optional — they can set it up later in Settings
        onComplete();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                    <Wallet className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Орлогын данс тохируулах</h2>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                    Таны AI худалдагч борлуулалт хийхэд орлого таны дансанд шууд орно. QPay автоматаар идэвхжинэ.
                </p>
            </div>

            {/* Merchant Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Төрөл</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setBankInfo(prev => ({ ...prev, merchant_type: 'person' }))}
                        className={`p-3 rounded-xl border text-center text-sm font-medium transition-all ${
                            bankInfo.merchant_type === 'person'
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        👤 Хувь хүн
                    </button>
                    <button
                        type="button"
                        onClick={() => setBankInfo(prev => ({ ...prev, merchant_type: 'company' }))}
                        className={`p-3 rounded-xl border text-center text-sm font-medium transition-all ${
                            bankInfo.merchant_type === 'company'
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Байгууллага / ХХК
                    </button>
                </div>
            </div>

            {/* Bank Select */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Банк <span className="text-red-500">*</span>
                </label>
                <select
                    value={bankInfo.bank_name}
                    onChange={(e) => setBankInfo(prev => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white appearance-none cursor-pointer"
                >
                    <option value="">Банк сонгоно уу</option>
                    {BANK_OPTIONS.map(bank => (
                        <option key={bank.value} value={bank.value}>{bank.label}</option>
                    ))}
                </select>
            </div>

            {/* Account Name + Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Данс эзэмшигч <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={bankInfo.account_name}
                        onChange={(e) => setBankInfo(prev => ({ ...prev, account_name: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Нэр"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Дансны дугаар <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={bankInfo.account_number}
                        onChange={(e) => setBankInfo(prev => ({ ...prev, account_number: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="0000000000"
                    />
                </div>
            </div>

            {/* Register Number */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {bankInfo.merchant_type === 'company' ? 'Байгууллагын регистр' : 'Регистрийн дугаар'}
                    <span className="text-gray-400 text-xs ml-2">(заавал биш)</span>
                </label>
                <input
                    type="text"
                    value={bankInfo.register_number}
                    onChange={(e) => setBankInfo(prev => ({ ...prev, register_number: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={bankInfo.merchant_type === 'company' ? 'Байгууллагын регистр' : 'РД (жнь: УА12345678)'}
                />
            </div>

            {/* Info note */}
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Банкны мэдээлэл оруулмагц QPay автоматаар идэвхжиж, хэрэглэгчид QR код, банк аппаар төлөх боломжтой болно.</span>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* QPay Result */}
            {qpayResult && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                    qpayResult.success
                        ? 'bg-green-50 border border-green-100 text-green-700'
                        : 'bg-amber-50 border border-amber-100 text-amber-700'
                }`}>
                    {qpayResult.success
                        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    }
                    {qpayResult.message}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleSkip}
                    disabled={saving}
                >
                    Дараа тохируулах
                </Button>
                <Button
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleSave}
                    disabled={saving || !isValid}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        'Хадгалах & Үргэлжлүүлэх'
                    )}
                </Button>
            </div>
        </div>
    );
}
