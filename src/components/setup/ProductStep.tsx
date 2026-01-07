'use client';

import { useState } from 'react';
import { Package, ArrowLeft, Check, Upload, X, Plus, Layers, Box } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      products.forEach(p => {
        if (p.imageUrl && p.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(p.imageUrl);
        }
      });
    };
  }, []); // Run cleanup on unmount

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
      const objectUrl = URL.createObjectURL(file);
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
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const uploadImage = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
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
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Бүтээгдэхүүн & Үйлчилгээ</h2>
        <p className="text-gray-400">Та өөрийн бараа эсвэл үйлчилгээгээ бүртгүүлээрэй</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {products.map((product, index) => (
          <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                <button
                  onClick={() => updateProduct(index, 'type', 'physical')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    product.type === 'physical' 
                      ? 'bg-emerald-500 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" /> Бараа
                </button>
                <button
                  onClick={() => updateProduct(index, 'type', 'service')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                    product.type === 'service' 
                      ? 'bg-violet-500 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Үйлчилгээ
                </button>
              </div>

              {products.length > 1 && (
                <button
                  onClick={() => removeProduct(index)}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex gap-4">
               <div className="w-24 h-24 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 relative overflow-hidden group">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
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
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      value={product.price}
                      onChange={(e) => updateProduct(index, 'price', e.target.value)}
                      placeholder="Үнэ (₮)"
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    {product.type === 'physical' && (
                        <input
                          type="number"
                          value={product.stock}
                          onChange={(e) => updateProduct(index, 'stock', e.target.value)}
                          placeholder="Үлдэгдэл тоо"
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    )}
                    <input
                      type="text"
                      value={product.description}
                      onChange={(e) => updateProduct(index, 'description', e.target.value)}
                      placeholder="Тайлбар"
                      className={`px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${product.type === 'service' ? 'col-span-2' : ''}`}
                    />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Өнгө / Хувилбар</label>
                <input
                  type="text"
                  value={product.colors}
                  onChange={(e) => updateProduct(index, 'colors', e.target.value)}
                  placeholder="Улаан, Хар..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Хэмжээ / Хугацаа</label>
                <input
                  type="text"
                  value={product.sizes}
                  onChange={(e) => updateProduct(index, 'sizes', e.target.value)}
                  placeholder={product.type === 'physical' ? "S, M, L..." : "1 цаг, 1 сар..."}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      <button
        onClick={addProduct}
        className="w-full py-3 border-2 border-dashed border-white/20 text-gray-400 rounded-xl hover:border-emerald-500 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" /> Дахиад нэмэх
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
