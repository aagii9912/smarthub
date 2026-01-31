'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Check, RotateCcw, Play } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useConfetti } from '@/hooks/useConfetti';
import { usePWAInstall } from '@/hooks/usePWAInstall';

// Components
import { ShopInfoStep } from '@/components/setup/ShopInfoStep';
import { FacebookStep } from '@/components/setup/FacebookStep';
import { InstagramStep } from '@/components/setup/InstagramStep';
import { ProductStep } from '@/components/setup/ProductStep';
import { AISetupStep } from '@/components/setup/AISetupStep';
import { SubscriptionStep } from '@/components/setup/SubscriptionStep';
import { PWAInstallBanner } from '@/components/setup/PWAInstallBanner';

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

  // Progress persistence hook
  const {
    step: savedStep,
    isLoaded: stateLoaded,
    hasExistingState,
    setStep: savePersistentStep,
    clearState,
    continueFromSaved
  } = useOnboardingState();

  // Confetti hook
  const { triggerSmall, triggerFinal } = useConfetti();

  // PWA install hook
  const { triggerPromptAfterStep } = usePWAInstall();

  // Sync step with persistent storage + confetti + PWA prompt
  const setStep = (newStep: number) => {
    // Trigger confetti when advancing
    if (newStep > step) {
      if (newStep === 6) {
        // Final step - big celebration
        triggerFinal();
      } else {
        // Regular step advancement
        triggerSmall();
      }
      // Trigger PWA install prompt after step 3
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
        'no_instagram_account': 'Instagram Business Account олдсонгүй. Facebook Page-тэй холбогдсон Instagram account байгаа эсэхийг шалгана уу.',
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

  // Initial redirect logic based on shop state
  useEffect(() => {
    if (!authLoading && stateLoaded && isInitializing) {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      if (shop) {
        // Only redirect to dashboard if BOTH setup_completed AND facebook connected
        if (shop.setup_completed && shop.facebook_page_id) {
          router.push('/dashboard');
          return;
        }

        // Determine which step to show based on connection status
        if (!shop.facebook_page_id) {
          // No Facebook connected, go to step 2
          setStepLocal(2);
          savePersistentStep(2);
        } else if (!shop.instagram_business_account_id) {
          // FB connected but no IG, go to step 3
          setStepLocal(3);
          savePersistentStep(3);
        } else if (step < 4) {
          // FB and IG both connected, go to products step
          setStepLocal(4);
          savePersistentStep(4);
        }
      }

      // Check for saved progress
      if (hasExistingState && savedStep > 1) {
        setShowResumeModal(true);
      }

      setIsInitializing(false);
    }
  }, [authLoading, stateLoaded, shop, user, isInitializing, hasExistingState, savedStep]);

  // Auto-fetch pages/accounts when entering step 2 or 3
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

    // Auto-reconnect if session expired
    if (!pageRes.ok) {
      if (pageData.code === 'SESSION_EXPIRED') {
        // Clear pages and redirect to Facebook OAuth
        setFbPages([]);
        setError('Session дууссан байна. Дахин холбож байна...');
        setTimeout(() => {
          window.location.href = '/api/auth/facebook';
        }, 1500);
        return;
      }
      throw new Error(pageData.error);
    }

    // Save token to state for AI step
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
    // Save token to state for AI step
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

    // Clear the accounts list after successful selection
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

    // Move to AI Step
    setStep(5);
  };

  const handleAIComplete = async (aiData: any) => {
    // Save AI settings
    if (aiData) {
      await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiData)
      });
    }

    // Mark setup as completed (if not already handled by backend on product save, 
    // but usually we want a flag. Assuming shop.setup_completed is handled or we enforce it here)
    // Actually, let's ensure we mark it complete or redirect. 
    // Current logic checks `shop.setup_completed` in useEffect.
    // If the backend sets `setup_completed` only when products are added, we are fine.
    // But if we want to ensure, we can call a 'complete' endpoint or just redirect.

    setStep(6);
  };

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-600/30 border-t-violet-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 relative overflow-hidden">
      {/* Background decorations - subtle for light mode */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
      </div>

      {/* Resume Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-7 h-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Үргэлжлүүлэх үү?</h3>
              <p className="text-sm text-gray-500 mt-2">
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
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <Play className="w-4 h-4" />
                Үргэлжлүүлэх (Алхам {savedStep})
              </button>
              <button
                onClick={() => {
                  clearState();
                  setStepLocal(1);
                  setShowResumeModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Шинээр эхлэх
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Syncly"
              className="w-12 h-12 rounded-2xl shadow-lg shadow-violet-500/10"
            />
            <span className="text-2xl font-bold text-gray-900">Syncly</span>
          </Link>

          {/* Progress Percentage */}
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 bg-violet-50 px-4 py-2 rounded-full">
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500"
                  style={{ width: `${Math.round((step / 6) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-violet-600">
                {Math.round((step / 6) * 100)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {step === 1 && "Эхлэлийг тавилаа! 🚀"}
              {step === 2 && "Гайхалтай! Үргэлжлүүлээрэй 💪"}
              {step === 3 && "Хагас нь дууслаа! 🎯"}
              {step === 4 && "Бараг дууссан байна! ✨"}
              {step === 5 && "Сүүлийн алхамууд! 🏁"}
              {step === 6 && "Та удахгүй дуусна! 🎉"}
            </p>
          </div>
        </div>

        {/* Progress Steps - Mobile Responsive */}
        <div className="flex items-center justify-center gap-1 sm:gap-4 mb-8 sm:mb-12 px-2">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className="flex items-center gap-1 sm:gap-2">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-semibold transition-all border ${step >= s
                ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/30'
                : 'bg-white text-gray-400 border-gray-200'
                }`}>
                {step > s ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s}
              </div>
              {s < 6 && <div className={`w-4 sm:w-12 h-0.5 sm:h-1 rounded ${step > s ? 'bg-violet-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm text-center font-medium">
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

      {/* PWA Install Banner */}
      <PWAInstallBanner />
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
