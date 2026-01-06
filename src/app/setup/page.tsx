'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Check } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// Components
import { ShopInfoStep } from '@/components/setup/ShopInfoStep';
import { FacebookStep } from '@/components/setup/FacebookStep';
import { ProductStep } from '@/components/setup/ProductStep';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, shop, refreshShop, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [fbPages, setFbPages] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Handle Facebook OAuth callback
  useEffect(() => {
    const fbSuccess = searchParams.get('fb_success');
    const fbError = searchParams.get('fb_error');
    const pageCount = searchParams.get('page_count');
    
    if (fbError) {
      setError(`Facebook холболт амжилтгүй: ${fbError}`);
    } else if (fbSuccess && pageCount) {
      fetchAvailablePages();
      setStep(2);
      router.replace('/setup');
    }
  }, [searchParams]);

  // Initial redirect logic based on shop state
  useEffect(() => {
    if (!authLoading && isInitializing) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (shop) {
        if (shop.setup_completed && shop.facebook_page_id) {
          router.push('/dashboard');
        } else if (!shop.facebook_page_id) {
          setStep(2);
        } else {
          setStep(3);
        }
      }
      setIsInitializing(false);
    }
  }, [authLoading, shop, user, isInitializing]);

  const fetchAvailablePages = async () => {
    try {
      const res = await fetch('/api/auth/facebook/pages');
      const data = await res.json();
      if (data.pages) setFbPages(data.pages);
    } catch (err) {
      console.error('Error fetching pages:', err);
      setError('Facebook Page татахад алдаа гарлаа');
    }
  };

  const handleShopSave = async (data: any) => {
    // Always use POST - API handles upsert logic
    const res = await fetch('/api/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Хадгалахад алдаа гарлаа');
    }
    
    await refreshShop();
    setStep(2);
  };

  const handleFacebookSelect = async (pageId: string) => {
    const pageRes = await fetch('/api/auth/facebook/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId })
    });
    
    const pageData = await pageRes.json();
    if (!pageRes.ok) throw new Error(pageData.error);
    
    const shopRes = await fetch('/api/shop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facebook_page_id: pageData.page.id,
        facebook_page_name: pageData.page.name,
        facebook_page_access_token: pageData.page.access_token
      })
    });
    
    if (!shopRes.ok) throw new Error('Дэлгүүрийн мэдээлэл шинэчлэхэд алдаа гарлаа');
    
    await refreshShop();
    setStep(3);
  };

  const handleManualFacebookSave = async (data: any) => {
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        facebook_page_id: data.pageId,
        facebook_page_name: data.pageName,
        facebook_page_access_token: data.accessToken
      })
    });
    
    if (!res.ok) throw new Error('Хадгалахад алдаа гарлаа');
    
    await refreshShop();
    setStep(3);
  };

  const handleProductsComplete = async (products: any[]) => {
    const res = await fetch('/api/shop/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    });
    
    if (!res.ok) throw new Error('Бүтээгдэхүүн хадгалахад алдаа гарлаа');
    
    router.push('/dashboard');
  };

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">SmartHub</span>
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                step >= s ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white' : 'bg-white/10 text-gray-400'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 rounded ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          {step === 1 && (
            <ShopInfoStep 
              initialData={{
                name: shop?.name || '',
                owner_name: shop?.owner_name || user?.user_metadata?.full_name || '',
                phone: shop?.phone || ''
              }}
              onNext={handleShopSave}
            />
          )}

          {step === 2 && (
            <FacebookStep 
              initialData={{
                fbConnected: !!shop?.facebook_page_id,
                fbPageName: shop?.facebook_page_name || '',
                fbPageId: shop?.facebook_page_id || ''
              }}
              fbPages={fbPages}
              onConnect={() => window.location.href = '/api/auth/facebook'}
              onSelectPage={handleFacebookSelect}
              onManualSave={handleManualFacebookSave}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <ProductStep 
              initialProducts={[]} // Could fetch existing if needed
              onBack={() => setStep(2)}
              onComplete={handleProductsComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}
