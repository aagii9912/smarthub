'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, RotateCcw, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useConfetti } from '@/hooks/useConfetti';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';

// Setup components
import { ShopInfoStep } from '@/components/setup/ShopInfoStep';
import { FacebookStep } from '@/components/setup/FacebookStep';
import { InstagramStep } from '@/components/setup/InstagramStep';
import { ProductStep } from '@/components/setup/ProductStep';
import { AISetupStep } from '@/components/setup/AISetupStep';
import { SubscriptionStep } from '@/components/setup/SubscriptionStep';
import { PWAInstallBanner } from '@/components/setup/PWAInstallBanner';
import { SetupPreview } from '@/components/setup/SetupPreview';

const stepLabels = [
  'Дэлгүүр',
  'Facebook',
  'Instagram',
  'Бараа',
  'AI',
  'Төлбөр',
];

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, shop, refreshShop, loading: authLoading } = useAuth();

  const [step, setStepLocal] = useState(1);
  const [error, setError] = useState('');
  const [fbPages, setFbPages] = useState([]);
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [fbToken, setFbToken] = useState<string>('');
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Preview data state
  const [previewShopName, setPreviewShopName] = useState('');
  const [previewOwnerName, setPreviewOwnerName] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewBankName, setPreviewBankName] = useState('');
  const [previewAccountNumber, setPreviewAccountNumber] = useState('');
  const [previewProducts, setPreviewProducts] = useState<Array<{ name: string; price?: number }>>([]);
  const [previewAiEmotion, setPreviewAiEmotion] = useState('');

  const isNewShopMode = searchParams.get('new') === 'true';

  const {
    step: savedStep,
    isLoaded: stateLoaded,
    hasExistingState,
    setStep: savePersistentStep,
    clearState,
    continueFromSaved
  } = useOnboardingState();

  const { triggerSmall, triggerFinal } = useConfetti();
  const { triggerPromptAfterStep } = usePWAInstall();

  const setStep = (newStep: number) => {
    if (newStep > step) {
      if (newStep === 6) {
        triggerFinal();
      } else {
        triggerSmall();
      }
      triggerPromptAfterStep(newStep);
    }
    setStepLocal(newStep);
    savePersistentStep(newStep);
  };

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

  // Handle Instagram OAuth callback
  useEffect(() => {
    const igSuccess = searchParams.get('ig_success');
    const igError = searchParams.get('ig_error');
    const igCount = searchParams.get('ig_count');

    if (igError) {
      const errorMessages: Record<string, string> = {
        'no_instagram_account': 'Instagram Business Account олдсонгүй.',
        'token_error': 'Access token авахад алдаа гарлаа.',
        'pages_error': 'Facebook Page татахад алдаа гарлаа.',
        'config_missing': 'App тохиргоо дутуу байна.',
      };
      setError(errorMessages[igError] || `Instagram холболт амжилтгүй: ${igError}`);
    } else if (igSuccess && igCount) {
      fetchInstagramAccounts();
      setStep(3);
      router.replace('/setup');
    }
  }, [searchParams]);

  // Initial redirect logic
  useEffect(() => {
    if (!authLoading && stateLoaded && isInitializing) {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (shop) {
        if (isNewShopMode) {
          clearState();
          setStepLocal(1);
          setIsInitializing(false);
          return;
        }

        if (shop.setup_completed && shop.facebook_page_id) {
          router.push('/dashboard');
          return;
        }

        // Sync preview state from shop
        setPreviewShopName(shop.name || '');
        setPreviewOwnerName(shop.owner_name || '');
        setPreviewPhone(shop.phone || '');

        if (!shop.facebook_page_id) {
          setStepLocal(2);
          savePersistentStep(2);
        } else if (!shop.instagram_business_account_id) {
          setStepLocal(3);
          savePersistentStep(3);
        } else if (step < 4) {
          setStepLocal(4);
          savePersistentStep(4);
        }
      }

      if (hasExistingState && savedStep > 1) {
        setShowResumeModal(true);
      }

      setIsInitializing(false);
    }
  }, [authLoading, stateLoaded, shop, user, isInitializing, hasExistingState, savedStep]);

  // Auto-fetch pages/accounts
  useEffect(() => {
    if (!isInitializing) {
      if (step === 2 && fbPages.length === 0 && !shop?.facebook_page_id) {
        fetchAvailablePages();
      }
      if (step === 3 && igAccounts.length === 0 && !shop?.instagram_business_account_id) {
        fetchInstagramAccounts();
      }
    }
  }, [step, isInitializing]);

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

  const fetchInstagramAccounts = async () => {
    try {
      const res = await fetch('/api/auth/instagram/accounts');
      const data = await res.json();
      if (data.accounts) setIgAccounts(data.accounts);
    } catch (err) {
      console.error('Error fetching Instagram accounts:', err);
      setError('Instagram account татахад алдаа гарлаа');
    }
  };

  const handleShopSave = async (data: any) => {
    const res = await fetch('/api/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Хадгалахад алдаа гарлаа');
    }

    // Sync preview
    setPreviewShopName(data.name || '');
    setPreviewOwnerName(data.owner_name || '');
    setPreviewPhone(data.phone || '');
    setPreviewBankName(data.bank_name || '');
    setPreviewAccountNumber(data.account_number || '');

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

    if (!pageRes.ok) {
      if (pageData.code === 'SESSION_EXPIRED') {
        setFbPages([]);
        setError('Session дууссан байна. Дахин холбож байна...');
        setTimeout(() => {
          window.location.href = '/api/auth/facebook';
        }, 1500);
        return;
      }
      throw new Error(pageData.error);
    }

    if (pageData.page?.access_token) {
      setFbToken(pageData.page.access_token);
    }

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
    if (data.accessToken) {
      setFbToken(data.accessToken);
    }

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

  const handleManualInstagramSave = async (data: { businessAccountId: string; username: string; accessToken: string }) => {
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram_business_account_id: data.businessAccountId,
        instagram_username: data.username,
        instagram_access_token: data.accessToken
      })
    });

    if (!res.ok) throw new Error('Instagram хадгалахад алдаа гарлаа');

    await refreshShop();
    setStep(4);
  };

  const handleInstagramSelect = async (account: any) => {
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram_business_account_id: account.instagramId,
        instagram_username: account.instagramUsername,
        instagram_access_token: account.pageAccessToken
      })
    });

    if (!res.ok) throw new Error('Instagram хадгалахад алдаа гарлаа');

    setIgAccounts([]);
    await refreshShop();
    setStep(4);
  };

  const handleProductsComplete = async (products: any[]) => {
    const res = await fetch('/api/shop/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products })
    });

    if (!res.ok) throw new Error('Бүтээгдэхүүн хадгалахад алдаа гарлаа');
    setStep(5);
  };

  const handleAIComplete = async (aiData: any) => {
    if (aiData) {
      await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiData)
      });
      if (aiData.ai_emotion) setPreviewAiEmotion(aiData.ai_emotion);
    }
    setStep(6);
  };

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-white/10 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#FAFAFA] flex flex-col lg:flex-row relative">
      {/* ═══════════ Resume Modal ═══════════ */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl shadow-black/10 border border-slate-200">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/10 to-violet-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Үргэлжлүүлэх үү?</h3>
              <p className="text-sm text-slate-500 mt-2">
                Та өмнө нь алхам {savedStep} хүртэл хийсэн байна
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setStepLocal(savedStep);
                  continueFromSaved();
                  setShowResumeModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                <Play className="w-4 h-4" />
                Үргэлжлүүлэх ({stepLabels[savedStep - 1]})
              </button>
              <button
                onClick={() => {
                  clearState();
                  setStepLocal(1);
                  setShowResumeModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Шинээр эхлэх
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ LEFT: Form ═══════════ */}
      <div className="w-full lg:w-1/2 h-full flex flex-col relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 shrink-0">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur opacity-20 rounded-xl"></div>
              <img
                src="/logo.png"
                alt="Syncly"
                className="w-10 h-10 rounded-xl shadow-sm relative z-10 bg-white"
              />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Syncly</span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
            <span className="text-sm font-semibold text-slate-700">{step}</span>
            <span className="text-sm font-medium text-slate-400">/ 6</span>
          </div>
        </div>

        {/* Minimal Progress Dots */}
        <div className="px-8 pb-4 flex items-center justify-center gap-2 shrink-0">
          {[1, 2, 3, 4, 5, 6].map((s) => {
            const isActive = s === step;
            const isDone = s < step;
            return (
              <div
                key={s}
                className={cn(
                  'h-2 transition-all duration-500 ease-out flex items-center justify-center overflow-hidden',
                  isActive
                    ? 'w-10 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                    : isDone
                      ? 'w-2 bg-emerald-500 rounded-full'
                      : 'w-2 bg-slate-200 rounded-full'
                )}
              />
            );
          })}
        </div>

        {/* Form content */}
        <div className="flex-1 px-6 pb-4 overflow-y-auto custom-scrollbar">
          <div className="max-w-lg mx-auto">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-[14px] text-center font-medium shadow-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <ShopInfoStep
                initialData={{
                  name: shop?.name || '',
                  owner_name: shop?.owner_name || user?.fullName || '',
                  phone: shop?.phone || ''
                }}
                onNext={handleShopSave}
                onPreviewUpdate={(data: any) => {
                  if (data.name !== undefined) setPreviewShopName(data.name);
                  if (data.owner_name !== undefined) setPreviewOwnerName(data.owner_name);
                  if (data.phone !== undefined) setPreviewPhone(data.phone);
                  if (data.bank_name !== undefined) setPreviewBankName(data.bank_name);
                  if (data.account_number !== undefined) setPreviewAccountNumber(data.account_number);
                }}
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
              <InstagramStep
                initialData={{
                  igConnected: !!shop?.instagram_business_account_id,
                  igUsername: shop?.instagram_username || '',
                  igBusinessAccountId: shop?.instagram_business_account_id || ''
                }}
                igAccounts={igAccounts}
                onConnect={() => window.location.href = '/api/auth/instagram'}
                onSelectAccount={handleInstagramSelect}
                onManualSave={handleManualInstagramSave}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}

            {step === 4 && (
              <ProductStep
                initialProducts={[]}
                onBack={() => setStep(3)}
                onComplete={handleProductsComplete}
              />
            )}

            {step === 5 && (
              <AISetupStep
                initialData={{
                  description: shop?.description || '',
                  ai_emotion: shop?.ai_emotion || '',
                  ai_instructions: shop?.ai_instructions || ''
                }}
                fbPageId={shop?.facebook_page_id || undefined}
                fbPageToken={fbToken}
                onSkip={() => handleAIComplete(null)}
                onSave={handleAIComplete}
              />
            )}

            {step === 6 && (
              <SubscriptionStep
                onSkip={() => router.push('/dashboard')}
                onComplete={() => router.push('/dashboard')}
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT: Live Preview (Glassmorphism UI) ═══════════ */}
      <div className="hidden lg:flex w-1/2 h-full bg-[#0B0A10] relative overflow-hidden items-center justify-center p-6 xl:p-12">
        {/* Dynamic Gradient background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-violet-600/30 rounded-full blur-[140px] animate-pulse-slow mix-blend-screen" />
          <div className="absolute bottom-[20%] left-[10%] w-[500px] h-[500px] bg-blue-600/25 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-500/15 rounded-full blur-[160px] transform rotate-45" />
        </div>

        {/* Elegant Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Glassmorphism Container around Preview */}
        <div className="relative z-10 w-full max-w-[520px] h-[95%] max-h-[820px]">
          <div className="absolute -inset-1 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem] blur-sm opacity-50" />

          <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/50 rounded-[2.5rem] p-6 pr-4 overflow-hidden h-full flex flex-col">
            {/* Glossy top edge highlight */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-50" />

            <SetupPreview
              step={step}
              shopName={previewShopName}
              ownerName={previewOwnerName}
              phone={previewPhone}
              bankName={previewBankName}
              accountNumber={previewAccountNumber}
              fbPageName={shop?.facebook_page_name || ''}
              fbConnected={!!shop?.facebook_page_id}
              igUsername={shop?.instagram_username || ''}
              igConnected={!!shop?.instagram_business_account_id}
              products={previewProducts}
              aiEmotion={previewAiEmotion}
            />
          </div>
        </div>
      </div>

      {/* PWA Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-white/10 border-t-blue-400 rounded-full animate-spin" />
      </div>
    }>
      <SetupContent />
    </Suspense>
  );
}
