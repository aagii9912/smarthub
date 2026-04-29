'use client';

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_VALUES,
  type BusinessType,
} from '@/lib/constants/business-types';

interface BusinessTypeStepProps {
  initialType?: BusinessType | null;
  /** True if user is changing an existing selection mid-wizard. */
  isChanging?: boolean;
  /** Called when user picks (and confirms when changing) a type. */
  onSelect: (type: BusinessType) => void | Promise<void>;
}

export function BusinessTypeStep({
  initialType,
  isChanging = false,
  onSelect,
}: BusinessTypeStepProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<BusinessType | null>(initialType ?? null);
  const [pendingChange, setPendingChange] = useState<BusinessType | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePick = (type: BusinessType) => {
    if (isChanging && initialType && type !== initialType) {
      setPendingChange(type);
      return;
    }
    setSelected(type);
  };

  const handleConfirm = async () => {
    const finalType = pendingChange ?? selected;
    if (!finalType) return;
    setSaving(true);
    try {
      await onSelect(finalType);
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  };

  const cancelChange = () => setPendingChange(null);

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="text-center mb-4 shrink-0">
        <h2 className="text-xl font-bold text-gray-900 mb-1.5">{t.setup.businessType.title}</h2>
        <p className="text-sm text-gray-500">{t.setup.businessType.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 shrink-0">
        {BUSINESS_TYPE_VALUES.map((type) => {
          const meta = BUSINESS_TYPES[type];
          const Icon = meta.icon;
          const isSelected = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handlePick(type)}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                isSelected
                  ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${meta.accentClass}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-gray-900 text-sm">{meta.label}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">{meta.description}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto shrink-0 pt-2">
        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="w-full py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/30"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {t.common.next}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {t.setup.businessType.changeTitle}
            </h3>
            <p className="text-sm text-slate-600 mb-5">{t.setup.businessType.changeWarning}</p>
            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t.setup.businessType.confirmChange
                )}
              </button>
              <button
                onClick={cancelChange}
                disabled={saving}
                className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-all"
              >
                {t.setup.businessType.cancelChange}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
