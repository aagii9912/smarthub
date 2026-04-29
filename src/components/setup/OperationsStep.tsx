'use client';

import { useState } from 'react';
import { Settings2, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  OPERATIONS_CONFIG,
  type BusinessType,
  type OperationsField,
} from '@/lib/constants/business-types';

interface OperationsStepProps {
  businessType: BusinessType;
  initialData?: Record<string, unknown>;
  onBack: () => void;
  onSkip: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void> | void;
}

export function OperationsStep({
  businessType,
  initialData = {},
  onBack,
  onSkip,
  onSave,
}: OperationsStepProps) {
  const { t } = useLanguage();
  const config = OPERATIONS_CONFIG[businessType];
  const [values, setValues] = useState<Record<string, unknown>>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!config) {
    // "other" type — should not be reachable, but render fallback safely
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">{t.setup.operations.subtitleDefault}</p>
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all"
        >
          {t.common.next}
        </button>
      </div>
    );
  }

  const updateField = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMulti = (key: string, optionValue: string) => {
    setValues((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [key]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Strip empty strings to avoid storing them
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v === '' || v === undefined || v === null) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        clean[k] = v;
      }
      await onSave(clean);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="text-center mb-4 shrink-0">
        <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Settings2 className="w-6 h-6 text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1.5">{config.title}</h2>
        <p className="text-sm text-gray-500">{config.subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm flex items-start gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
        {config.fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(v) => updateField(field.key, v)}
            onToggleMulti={(opt) => toggleMulti(field.key, opt)}
          />
        ))}
      </div>

      <div className="flex gap-3 shrink-0 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onSkip}
          className="flex-1 py-3.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
        >
          {t.common.skip}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-500/30"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {t.setup.operations.saveAndContinue}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface FieldRendererProps {
  field: OperationsField;
  value: unknown;
  onChange: (value: unknown) => void;
  onToggleMulti: (optionValue: string) => void;
}

function FieldRenderer({ field, value, onChange, onToggleMulti }: FieldRendererProps) {
  const { t } = useLanguage();

  if (field.type === 'text') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm"
        />
        {field.helpText && <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
        <input
          type="number"
          value={(value as number | '') ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-sm"
        />
        {field.helpText && <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'boolean') {
    const checked = value === true;
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              checked
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.setup.operations.yes}
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              value === false
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.setup.operations.no}
          </button>
        </div>
        {field.helpText && <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'radio' && field.options) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
        <div className="space-y-2">
          {field.options.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border ${
                  selected
                    ? 'bg-violet-50 text-violet-900 border-violet-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {field.helpText && <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === 'multi-checkbox' && field.options) {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{field.label}</label>
        <div className="grid grid-cols-2 gap-2">
          {field.options.map((opt) => {
            const checked = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggleMulti(opt.value)}
                className={`text-left px-3 py-2 rounded-xl text-sm transition-all border ${
                  checked
                    ? 'bg-violet-50 text-violet-900 border-violet-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {field.helpText && <p className="mt-1 text-xs text-gray-500">{field.helpText}</p>}
      </div>
    );
  }

  return null;
}
