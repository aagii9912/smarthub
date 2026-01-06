'use client';

import { useState } from 'react';
import { Package, ArrowLeft, Check } from 'lucide-react';

interface Product {
  name: string;
  price: string;
  description: string;
}

interface ProductStepProps {
  initialProducts: Product[];
  onBack: () => void;
  onComplete: (products: Product[]) => Promise<void>;
}

export function ProductStep({ initialProducts, onBack, onComplete }: ProductStepProps) {
  const [products, setProducts] = useState<Product[]>(
    initialProducts.length > 0 ? initialProducts : [{ name: '', price: '', description: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addProduct = () => {
    setProducts([...products, { name: '', price: '', description: '' }]);
  };

  const updateProduct = (index: number, field: keyof Product, value: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    try {
      const validProducts = products.filter(p => p.name && p.price);
      await onComplete(validProducts);
    } catch (err: any) {
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Бүтээгдэхүүн нэмэх</h2>
        <p className="text-gray-400">Чатбот танилцуулах бүтээгдэхүүнүүд (дараа нь нэмж болно)</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {products.map((product, index) => (
          <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Бүтээгдэхүүн #{index + 1}</span>
              {products.length > 1 && (
                <button
                  onClick={() => removeProduct(index)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Устгах
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={product.name}
                onChange={(e) => updateProduct(index, 'name', e.target.value)}
                placeholder="Нэр"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="number"
                value={product.price}
                onChange={(e) => updateProduct(index, 'price', e.target.value)}
                placeholder="Үнэ (₮)"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <input
              type="text"
              value={product.description}
              onChange={(e) => updateProduct(index, 'description', e.target.value)}
              placeholder="Тайлбар (заавал биш)"
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        ))}
      </div>

      <button
        onClick={addProduct}
        className="w-full py-3 border-2 border-dashed border-white/20 text-gray-400 rounded-xl hover:border-violet-500 hover:text-violet-400 transition-all"
      >
        + Бүтээгдэхүүн нэмэх
      </button>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Буцах
        </button>
        <button
          onClick={handleComplete}
          disabled={saving}
          className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Дуусгах
            </>
          )}
        </button>
      </div>
    </div>
  );
}

