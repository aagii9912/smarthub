'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, ArrowLeft, Check, Upload, X, Plus, Layers, Box } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  name: string;
  price: string;
  description: string;
  colors: string;
  sizes: string;
  type: 'physical' | 'service';
  stock: string;
  imageUrl?: string;
  imageFile?: File | null;
}

interface ProductStepProps {
  initialProducts: any[]; // Allow partial initial data
  onBack: () => void;
  onComplete: (products: any[]) => Promise<void>;
}

export function ProductStep({ initialProducts, onBack, onComplete }: ProductStepProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>(
    initialProducts.length > 0
      ? initialProducts.map(p => ({
        name: p.name || '',
        price: p.price || '',
        description: p.description || '',
        colors: Array.isArray(p.colors) ? p.colors.join(', ') : (p.colors || ''),
        sizes: Array.isArray(p.sizes) ? p.sizes.join(', ') : (p.sizes || ''),
        type: p.type || 'physical',
        stock: p.stock || '10',
        imageUrl: p.imageUrl,
        imageFile: null
      }))
      : [{
        name: '',
        price: '',
        description: '',
        colors: '',
        sizes: '',
        type: 'physical',
        stock: '10',
        imageFile: null
      }]
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  const addProduct = () => {
    setProducts([...products, {
      name: '',
      price: '',
      description: '',
      colors: '',
      sizes: '',
      type: 'physical',
      stock: '10',
      imageFile: null
    }]);
  };

  const updateProduct = (index: number, field: keyof Product, value: any) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleImageSelect = (index: number, file: File) => {
    if (file) {
      const oldUrl = products[index].imageUrl;
      if (oldUrl && oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
        blobUrlsRef.current.delete(oldUrl);
      }

      const objectUrl = URL.createObjectURL(file);
      blobUrlsRef.current.add(objectUrl);

      const updated = [...products];
      updated[index] = {
        ...updated[index],
        imageFile: file,
        imageUrl: objectUrl
      };
      setProducts(updated);
    }
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      const productToRemove = products[index];
      if (productToRemove.imageUrl && productToRemove.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(productToRemove.imageUrl);
        blobUrlsRef.current.delete(productToRemove.imageUrl);
      }
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const uploadImage = async (file: File) => {
    if (!user) throw new Error("Нэвтрээгүй байна");

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
      .from('products')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleComplete = async () => {
    setSaving(true);
    setUploading(true);
    setError('');

    try {
      const validProductsRaw = products.filter(p => p.name && p.price);

      const processedProducts = await Promise.all(validProductsRaw.map(async (p) => {
        let finalImageUrl = p.imageUrl;

        if (p.imageFile) {
          try {
            finalImageUrl = await uploadImage(p.imageFile);
          } catch (e) {
            console.error("Image upload failed:", e);
            finalImageUrl = undefined; // Clear blob URL if upload fails
          }
        }

        return {
          ...p,
          stock: p.type === 'service' ? null : (parseInt(p.stock) || 0),
          colors: p.colors ? p.colors.split(',').map(s => s.trim()) : [],
          sizes: p.sizes ? p.sizes.split(',').map(s => s.trim()) : [],
          images: finalImageUrl ? [finalImageUrl] : []
        };
      }));

      await onComplete(processedProducts);
    } catch (err: any) {
      setError(err.message || 'Алдаа гарлаа. "products" bucket үүссэн эсэхийг шалгаарай.');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Бүтээгдэхүүн & Үйлчилгээ</h2>
        <p className="text-gray-500">Та өөрийн бараа эсвэл үйлчилгээгээ бүртгүүлээрэй</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {products.map((product, index) => (
          <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4 shadow-sm hover:shadow-md transition-shadow">

            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-100">
                <button
                  onClick={() => updateProduct(index, 'type', 'physical')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${product.type === 'physical'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Box className="w-3.5 h-3.5" /> Бараа
                </button>
                <button
                  onClick={() => updateProduct(index, 'type', 'service')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${product.type === 'service'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Үйлчилгээ
                </button>
              </div>

              {products.length > 1 && (
                <button
                  onClick={() => removeProduct(index)}
                  className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-4">
              <div className="w-24 h-24 bg-white rounded-lg border border-gray-200 flex-shrink-0 relative overflow-hidden group hover:border-emerald-400 transition-colors">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageSelect(index, e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(index, 'name', e.target.value)}
                    placeholder={product.type === 'physical' ? "Барааны нэр" : "Үйлчилгээний нэр"}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <input
                    type="number"
                    value={product.price}
                    onChange={(e) => updateProduct(index, 'price', e.target.value)}
                    placeholder="Үнэ (₮)"
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {product.type === 'physical' && (
                    <input
                      type="number"
                      value={product.stock}
                      onChange={(e) => updateProduct(index, 'stock', e.target.value)}
                      placeholder="Үлдэгдэл"
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  )}
                  <input
                    type="text"
                    value={product.description}
                    onChange={(e) => updateProduct(index, 'description', e.target.value)}
                    placeholder="Тайлбар"
                    className={`px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${product.type === 'service' ? 'col-span-2' : ''}`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
              <div>
                <label className="text-xs text-gray-500 mb-1 block font-medium">Өнгө / Хувилбар</label>
                <input
                  type="text"
                  value={product.colors}
                  onChange={(e) => updateProduct(index, 'colors', e.target.value)}
                  placeholder="Улаан, Хар..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block font-medium">Хэмжээ / Хугацаа</label>
                <input
                  type="text"
                  value={product.sizes}
                  onChange={(e) => updateProduct(index, 'sizes', e.target.value)}
                  placeholder={product.type === 'physical' ? "S, M, L..." : "1 цаг, 1 сар..."}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      <button
        onClick={addProduct}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-5 h-5" /> Дахиад нэмэх
      </button>

      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Буцах
        </button>
        <button
          onClick={handleComplete}
          disabled={saving}
          className="flex-1 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {uploading ? 'Зураг хуулж байна...' : 'Хадгалж байна...'}
            </div>
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
