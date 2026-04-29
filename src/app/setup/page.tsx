'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Play, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useConfetti } from '@/hooks/useConfetti';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/logger';

// Setup components
import { BusinessTypeStep } from '@/components/setup/BusinessTypeStep';
import { ShopInfoStep } from '@/components/setup/ShopInfoStep';
import { FacebookStep } from '@/components/setup/FacebookStep';
import { InstagramStep } from '@/components/setup/InstagramStep';
import { ProductStep } from '@/components/setup/ProductStep';
import { OperationsStep } from '@/components/setup/OperationsStep';
import { AISetupStep } from '@/components/setup/AISetupStep';
import { PayoutSetupStep } from '@/components/setup/PayoutSetupStep';
import { SubscriptionStep } from '@/components/setup/SubscriptionStep';
import { PWAInstallBanner } from '@/components/setup/PWAInstallBanner';
import { SetupPreview } from '@/components/setup/SetupPreview';

import { BUSINESS_TYPES, isBusinessType, type BusinessType } from '@/lib/constants/business-types';

type StepKey =
  | 'businessType'
  | 'shopInfo'
  | 'facebook'
  | 'instagram'
  | 'products'
  | 'operations'
  | 'aiSetup'
  | 'payout'
  | 'subscription';

function getStepSequence(businessType: BusinessType | null): StepKey[] {
  if (!businessType) return ['businessType'];
  const meta = BUSINESS_TYPES[businessType];
  return [
    'businessType',
    'shopInfo',
    'facebook',
    'instagram',
    'products',
    ...(meta.hasOperations ? (['operations'] as const) : []),
    'aiSetup',
    'payout',
    'subscription',
  ];
}

function getStepLabels(businessType: BusinessType | null): string[] {
  if (!businessType) return ['Бизнес төрөл'];
  const meta = BUSINESS_TYPES[businessType];
  return [
    'Бизнес төрөл',
    'Дэлгүүр',
    'Facebook',
    'Instagram',
    meta.productNoun,
    ...(meta.hasOperations ? ['Үйл ажиллагаа'] : []),
    'AI',
    'Орлогын данс',
    'Төлбөр',
  ];
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, shop, refreshShop, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [stepIndex, setStepIndexLocal] = useState(0);
  const [error, setError] = useState('');
  const [fbPages, setFbPages] = useState([]);
  const [igAccounts, setIgAccounts] = useState<Array<{ pageId: string; pageName: string; pageAccessToken: string; instagramId: string; instagramUsername: string; instagramName: string; profilePicture: string }>>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [fbToken, setFbToken] = useState<string>('');
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Preview data state
  const [previewShopName, setPreviewShopName] = useState('');
  const [previewOwnerName, setPreviewOwnerName] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewBankName] = useState('');
  const [previewAccountNumber] = useState('');
  const [previewProducts] = useState<Array<{ name: string; price?: number }>>([]);
  const [previewAiEmotion, setPreviewAiEmotion] = useState('');

  const isNewShopMode = searchParams.get('new') === 'true';

  const {
    step: savedStepIndex,
    businessType: savedBusinessType,
    isLoaded: stateLoaded,
    hasExistingState,
    setStep: savePersistentStep,
    setBusinessType: savePersistentBusinessType,
    clearTypeSpecificData,
    clearState,
    continueFromSaved,
  } = useOnboardingState();

  // Resolve business type: prefer DB, fall back to localStorage
  const businessType: BusinessType | null = useMemo(() => {
    if (shop?.business_type && isBusinessType(shop.business_type)) return shop.business_type;
    if (savedBusinessType && isBusinessType(savedBusinessType)) return savedBusinessType;
    return null;
  }, [shop?.business_type, savedBusinessType]);

  const stepSequence = useMemo(() => getStepSequence(businessType), [businessType]);
  const stepLabels = useMemo(() => getStepLabels(businessType), [businessType]);
  const totalSteps = stepSequence.length;
  const currentStepKey = stepSequence[Math.min(stepIndex, totalSteps - 1)];

  const aiTemplate = businessType ? BUSINESS_TYPES[businessType].aiTemplate : 'general';

  const { triggerSmall, triggerFinal } = useConfetti();
  const { triggerPromptAfterStep } = usePWAInstall();

  const setStepIndex = (newIndex: number) => {
    if (newIndex > stepIndex) {
      if (newIndex === totalSteps - 1) {
        triggerFinal();
      } else {
        triggerSmall();
      }
      triggerPromptAfterStep(newIndex);
    }
    setStepIndexLocal(newIndex);
    savePersistentStep(newIndex);
  };

  // Handle Facebook OAuth callback
  useEffect(() => {
    const fbSuccess = searchParams.get('fb_success');
    const fbError = searchParams.get('fb_error');
    const pageCount = searchParams.get('page_count');

    if (fbError) {
      const errorMessages: Record<string, string> = {
        csrf_validation_failed: 'Аюулгүй байдлын шалгалт амжилтгүй. Дахин оролдоно уу.',
        no_code: 'Facebook-аас зөвшөөрлийн код ирсэнгүй.',
        config_missing: 'App тохиргоо дутуу байна.',
        token_error: 'Access token авахад алдаа гарлаа.',
        pages_error: 'Facebook Pages уншихад алдаа гарлаа.',
        no_pages_granted:
          'Facebook-аас Syncly-д хандах эрхтэй Page олдсонгүй. Та сонгосон Page-ийн админ эсэх, бүх шаардлагатай эрх ("Pages show list", "Pages messaging") өгсөн эсэхээ шалгаад дахин холбоно уу.',
        exception: 'Алдаа гарлаа, дахин оролдоно уу.',
      };
      setError(errorMessages[fbError] || `Facebook холболт амжилтгүй: ${fbError}`);
    } else if (fbSuccess && pageCount) {
      fetchAvailablePages();
      const fbStep = stepSequence.indexOf('facebook');
      if (fbStep >= 0) setStepIndex(fbStep + 1);
      router.replace('/setup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle Instagram OAuth callback
  useEffect(() => {
    const igSuccess = searchParams.get('ig_success');
    const igError = searchParams.get('ig_error');
    const igCount = searchParams.get('ig_count');

    if (igError) {
      const errorMessages: Record<string, string> = {
        no_instagram_account: 'Instagram Business Account олдсонгүй.',
        token_error: 'Access token авахад алдаа гарлаа.',
        pages_error: 'Facebook Page татахад алдаа гарлаа.',
        config_missing: 'App тохиргоо дутуу байна.',
      };
      setError(errorMessages[igError] || `Instagram холболт амжилтгүй: ${igError}`);
    } else if (igSuccess && igCount) {
      fetchInstagramAccounts();
      const igStep = stepSequence.indexOf('instagram');
      if (igStep >= 0) setStepIndex(igStep + 1);
      router.replace('/setup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Initial redirect / resume logic
  useEffect(() => {
    if (!authLoading && stateLoaded && isInitializing) {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (shop) {
        if (isNewShopMode) {
          clearState();
          setStepIndexLocal(0);
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

        // Resolve resume step from shop state
        const resolvedType = (shop.business_type && isBusinessType(shop.business_type)) ? shop.business_type : null;
        const seq = getStepSequence(resolvedType);
        let target = 0;
        if (!resolvedType) {
          target = 0; // businessType
        } else if (!shop.name) {
          target = seq.indexOf('shopInfo');
        } else if (!shop.facebook_page_id) {
          target = seq.indexOf('facebook');
        } else if (!shop.instagram_business_account_id) {
          target = seq.indexOf('instagram');
        } else {
          // Past Instagram — let saved state guide, but never below 'products'
          const productsIdx = seq.indexOf('products');
          target = Math.max(savedStepIndex, productsIdx);
        }
        setStepIndexLocal(Math.max(0, target));
        savePersistentStep(Math.max(0, target));
      }

      if (hasExistingState && savedStepIndex > 0) {
        setShowResumeModal(true);
      }

      setIsInitializing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, stateLoaded, shop, user, isInitializing, hasExistingState, savedStepIndex]);

  // Auto-fetch pages/accounts when entering FB/IG steps
  useEffect(() => {
    if (!isInitializing) {
      if (currentStepKey === 'facebook' && fbPages.length === 0 && !shop?.facebook_page_id) {
        fetchAvailablePages();
      }
      if (currentStepKey === 'instagram' && igAccounts.length === 0 && !shop?.instagram_business_account_id) {
        fetchInstagramAccounts();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepKey, isInitializing]);

  const fetchAvailablePages = async () => {
    try {
      const res = await fetch('/api/auth/facebook/pages');
      const data = await res.json();
      if (data.pages) setFbPages(data.pages);
    } catch (err) {
      logger.error('Error fetching pages:', { error: err });
      setError('Facebook Page татахад алдаа гарлаа');
    }
  };

  const fetchInstagramAccounts = async () => {
    try {
      const res = await fetch('/api/auth/instagram/accounts');
      const data = await res.json();
      if (data.accounts) setIgAccounts(data.accounts);
    } catch (err) {
      logger.error('Error fetching Instagram accounts:', { error: err });
      setError('Instagram account татахад алдаа гарлаа');
    }
  };

  // ─── Step handlers ──────────────────────────────────────────

  const goToStepKey = (key: StepKey) => {
    const idx = stepSequence.indexOf(key);
    if (idx >= 0) setStepIndex(idx);
  };
  const goNext = () => setStepIndex(Math.min(stepIndex + 1, totalSteps - 1));
  const goBack = () => setStepIndex(Math.max(stepIndex - 1, 0));

  const handleBusinessTypeSelect = async (type: BusinessType) => {
    const isChange = !!businessType && businessType !== type;
    if (isChange) {
      // Clear type-specific data on the server (products + business_setup_data)
      try {
        await fetch('/api/shop/products', {
          method: 'DELETE',
          headers: {
            'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || '',
          },
        });
      } catch (err) {
        logger.warn('Could not clear products on type change', { error: String(err) });
      }
      clearTypeSpecificData();
    }

    // Persist locally + on server (if shop exists)
    savePersistentBusinessType(type);
    if (shop?.id) {
      try {
        await fetch('/api/shop', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-shop-id': shop.id,
          },
          body: JSON.stringify({
            business_type: type,
            ...(isChange ? { business_setup_data: {} } : {}),
          }),
        });
        await refreshShop();
      } catch (err) {
        logger.warn('Could not persist business_type', { error: String(err) });
      }
    }

    // Move forward to step 1 (shopInfo) — must compute from new sequence
    const newSeq = getStepSequence(type);
    const target = newSeq.indexOf('shopInfo');
    setStepIndex(Math.max(1, target));
  };

  const handleShopSave = async (data: Record<string, unknown>) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (shop?.id && !isNewShopMode) headers['x-shop-id'] = shop.id;

    const res = await fetch('/api/shop', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, business_type: businessType, forceCreate: isNewShopMode })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Хадгалахад алдаа гарлаа');

    if (resData.shop?.id) {
      localStorage.setItem('smarthub_active_shop_id', resData.shop.id);
    }

    setPreviewShopName(String(data.name || ''));
    setPreviewOwnerName(String(data.owner_name || ''));
    setPreviewPhone(String(data.phone || ''));

    await refreshShop();
    goNext();
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

    if (pageData.page?.access_token) setFbToken(pageData.page.access_token);

    const shopRes = await fetch('/api/shop', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
      },
      body: JSON.stringify({
        facebook_page_id: pageData.page.id,
        facebook_page_name: pageData.page.name,
        facebook_page_access_token: pageData.page.access_token
      })
    });

    if (!shopRes.ok) {
      const errData = await shopRes.json().catch(() => ({}));
      throw new Error(errData.error || `Дэлгүүрийн мэдээлэл шинэчлэхэд алдаа гарлаа (${shopRes.status})`);
    }

    await refreshShop();
    goToStepKey('instagram');
  };

  const handleManualFacebookSave = async (data: { pageId: string; pageName: string; accessToken: string }) => {
    if (data.accessToken) setFbToken(data.accessToken);

    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
      },
      body: JSON.stringify({
        facebook_page_id: data.pageId,
        facebook_page_name: data.pageName,
        facebook_page_access_token: data.accessToken
      })
    });

    if (!res.ok) throw new Error('Хадгалахад алдаа гарлаа');

    await refreshShop();
    goToStepKey('instagram');
  };

  const handleManualInstagramSave = async (data: { businessAccountId: string; username: string; accessToken: string }) => {
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
      },
      body: JSON.stringify({
        instagram_business_account_id: data.businessAccountId,
        instagram_username: data.username,
        instagram_access_token: data.accessToken
      })
    });

    if (!res.ok) throw new Error('Instagram хадгалахад алдаа гарлаа');

    await refreshShop();
    goToStepKey('products');
  };

  const handleInstagramSelect = async (account: { instagramId: string; instagramUsername: string; pageAccessToken: string }) => {
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
      },
      body: JSON.stringify({
        instagram_business_account_id: account.instagramId,
        instagram_username: account.instagramUsername,
        instagram_access_token: account.pageAccessToken
      })
    });

    if (!res.ok) throw new Error('Instagram хадгалахад алдаа гарлаа');

    setIgAccounts([]);
    await refreshShop();
    goToStepKey('products');
  };

  const handleProductsComplete = async (products: Record<string, unknown>[]) => {
    const res = await fetch('/api/shop/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
      },
      body: JSON.stringify({ products })
    });

    if (!res.ok) throw new Error('Бүтээгдэхүүн хадгалахад алдаа гарлаа');
    goNext();
  };

  const handleOperationsSave = async (data: Record<string, unknown>) => {
    if (!shop?.id) return;
    const res = await fetch('/api/shop', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-shop-id': shop.id,
      },
      body: JSON.stringify({ business_setup_data: data }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Хадгалахад алдаа гарлаа');
    }
    await refreshShop();
    goNext();
  };

  const handleAIComplete = async (aiData: Record<string, unknown> & { ai_emotion?: string } | null) => {
    if (aiData) {
      await fetch('/api/shop', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || shop?.id || ''
        },
        body: JSON.stringify(aiData)
      });
      if (aiData.ai_emotion) setPreviewAiEmotion(String(aiData.ai_emotion));
    }
    goNext();
  };

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-white/10 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  // initial business_setup_data for resuming Operations step
  const initialOperationsData = (shop?.business_setup_data && typeof shop.business_setup_data === 'object')
    ? shop.business_setup_data as Record<string, unknown>
    : {};

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
              <h3 className="text-lg font-bold text-slate-900">{t.setup.resumeTitle}</h3>
              <p className="text-sm text-slate-500 mt-2">
                {t.setup.resumeDesc.replace('{step}', String(savedStepIndex + 1))}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setStepIndexLocal(savedStepIndex);
                  continueFromSaved();
                  setShowResumeModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                <Play className="w-4 h-4" />
                {t.setup.resumeContinue} ({stepLabels[savedStepIndex] ?? ''})
              </button>
              <button
                onClick={() => {
                  clearState();
                  setStepIndexLocal(0);
                  setShowResumeModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                {t.setup.resumeRestart}
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
            <span className="text-sm font-semibold text-slate-700">{stepIndex + 1}</span>
            <span className="text-sm font-medium text-slate-400">/ {totalSteps}</span>
          </div>
        </div>

        {/* Business type pill — when set, show + allow change */}
        {businessType && currentStepKey !== 'businessType' && (
          <div className="px-8 pb-2 shrink-0 flex justify-center">
            <button
              onClick={() => goToStepKey('businessType')}
              className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {BUSINESS_TYPES[businessType].label}
              <span className="text-slate-400">— өөрчлөх</span>
            </button>
          </div>
        )}

        {/* Minimal Progress Dots */}
        <div className="px-8 pb-4 flex items-center justify-center gap-2 shrink-0">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;
            return (
              <div
                key={i}
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

            {currentStepKey === 'businessType' && (
              <BusinessTypeStep
                initialType={businessType}
                isChanging={!!businessType}
                onSelect={handleBusinessTypeSelect}
              />
            )}

            {currentStepKey === 'shopInfo' && (
              <ShopInfoStep
                initialData={{
                  name: shop?.name || '',
                  owner_name: shop?.owner_name || user?.fullName || '',
                  phone: shop?.phone || ''
                }}
                onNext={handleShopSave}
                onPreviewUpdate={(data) => {
                  if (data.name !== undefined) setPreviewShopName(data.name);
                  if (data.owner_name !== undefined) setPreviewOwnerName(data.owner_name);
                  if (data.phone !== undefined) setPreviewPhone(data.phone);
                }}
              />
            )}

            {currentStepKey === 'facebook' && (
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
                onBack={goBack}
                onNext={() => goToStepKey('instagram')}
              />
            )}

            {currentStepKey === 'instagram' && (
              <InstagramStep
                initialData={{
                  igConnected: !!shop?.instagram_business_account_id,
                  igUsername: shop?.instagram_username || '',
                  igBusinessAccountId: shop?.instagram_business_account_id || ''
                }}
                igAccounts={igAccounts}
                onConnect={() => { window.location.href = '/api/auth/instagram'; }}
                onSelectAccount={handleInstagramSelect}
                onManualSave={handleManualInstagramSave}
                onBack={goBack}
                onNext={() => goToStepKey('products')}
              />
            )}

            {currentStepKey === 'products' && businessType && (
              <ProductStep
                initialProducts={[]}
                onBack={goBack}
                onComplete={handleProductsComplete}
                productNoun={BUSINESS_TYPES[businessType].productNoun}
                defaultType={['service', 'beauty'].includes(businessType) ? 'service' : 'physical'}
              />
            )}

            {currentStepKey === 'operations' && businessType && BUSINESS_TYPES[businessType].hasOperations && (
              <OperationsStep
                businessType={businessType}
                initialData={initialOperationsData}
                onBack={goBack}
                onSkip={goNext}
                onSave={handleOperationsSave}
              />
            )}

            {currentStepKey === 'aiSetup' && (
              <AISetupStep
                initialData={{
                  description: shop?.description || '',
                  ai_emotion: shop?.ai_emotion || '',
                  ai_instructions: shop?.ai_instructions || ''
                }}
                fbPageId={shop?.facebook_page_id || undefined}
                fbPageToken={fbToken}
                defaultTemplate={aiTemplate}
                onSkip={() => handleAIComplete(null)}
                onSave={handleAIComplete}
              />
            )}

            {currentStepKey === 'payout' && (
              <PayoutSetupStep
                onComplete={goNext}
                initialData={{
                  bank_name: shop?.bank_name || '',
                  account_name: shop?.account_name || '',
                  account_number: shop?.account_number || '',
                  register_number: shop?.register_number || '',
                  merchant_type: (shop?.merchant_type as 'person' | 'company') || 'person',
                }}
              />
            )}

            {currentStepKey === 'subscription' && (
              <SubscriptionStep
                onComplete={() => router.push('/dashboard')}
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT: Live Preview ═══════════ */}
      <div className="hidden lg:flex w-1/2 h-full bg-[#0B0A10] relative overflow-hidden items-center justify-center p-6 xl:p-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-violet-600/30 rounded-full blur-[140px] animate-pulse-slow mix-blend-screen" />
          <div className="absolute bottom-[20%] left-[10%] w-[500px] h-[500px] bg-blue-600/25 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-500/15 rounded-full blur-[160px] transform rotate-45" />
        </div>

        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        <div className="relative z-10 w-full max-w-[520px] h-[95%] max-h-[820px]">
          <div className="absolute -inset-1 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem] blur-sm opacity-50" />

          <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/50 rounded-[2.5rem] p-6 pr-4 overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-50" />

            <SetupPreview
              step={stepIndex + 1}
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
              businessType={businessType}
              currentStepKey={currentStepKey}
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
