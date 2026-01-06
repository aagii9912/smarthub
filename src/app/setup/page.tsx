'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/auth/supabase-auth';
import { 
  Sparkles, Store, Facebook, Package, ArrowRight, ArrowLeft, 
  Check, MessageSquare, ExternalLink, CheckCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Shop {
  id: string;
  name: string;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  setup_completed: boolean;
}

interface FacebookPage {
  id: string;
  name: string;
  category?: string;
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  
  // Step 1: Shop info
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Step 2: Facebook OAuth
  const [fbConnected, setFbConnected] = useState(false);
  const [fbPageName, setFbPageName] = useState('');
  const [fbPageId, setFbPageId] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  
  // Step 3: Products
  const [products, setProducts] = useState([
    { name: '', price: '', description: '' }
  ]);

  useEffect(() => {
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('Setup page loading timeout - setting loading to false');
        setLoading(false);
      }
    }, 8000); // 8 seconds timeout
    
    checkAuth();
    handleFacebookCallback();
    
    return () => clearTimeout(timeout);
  }, [searchParams]);

  const handleFacebookCallback = async () => {
    const fbSuccess = searchParams.get('fb_success');
    const fbError = searchParams.get('fb_error');
    const pageCount = searchParams.get('page_count');
    
    if (fbError) {
      setError(`Facebook холболт амжилтгүй: ${fbError}`);
      return;
    }
    
    if (fbSuccess && pageCount) {
      // Fetch available pages
      setFbLoading(true);
      try {
        const res = await fetch('/api/auth/facebook/pages');
        const data = await res.json();
        
        if (data.pages && data.pages.length > 0) {
          setFbPages(data.pages);
          setStep(2); // Go to Facebook step
        } else {
          setError('Facebook Page олдсонгүй. Page-тай бүртгэлээр нэвтэрнэ үү.');
        }
      } catch (err) {
        console.error('Error fetching pages:', err);
        setError('Facebook Page татахад алдаа гарлаа');
      } finally {
        setFbLoading(false);
      }
      
      // Clear URL params
      router.replace('/setup');
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        setLoading(false);
        return;
      }
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      setUser(user);
      setOwnerName(user.user_metadata?.full_name || '');
      
      // Fetch shop from API
      try {
        const res = await fetch('/api/shop');
        const data = await res.json();
        
        if (data.shop) {
          setShop(data.shop);
          setShopName(data.shop.name || '');
          setPhone(data.shop.phone || '');
          setOwnerName(data.shop.owner_name || user.user_metadata?.full_name || '');
          
          if (data.shop.facebook_page_id) {
            setFbConnected(true);
            setFbPageId(data.shop.facebook_page_id);
            setFbPageName(data.shop.facebook_page_name || '');
          }
          
          if (data.shop.setup_completed) {
            router.push('/dashboard');
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching shop:', err);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('checkAuth error:', err);
      setLoading(false);
    }
  };

  const connectWithFacebook = () => {
    // Redirect to Facebook OAuth
    window.location.href = '/api/auth/facebook';
  };

  const selectFacebookPage = async (pageId: string) => {
    setSelectedPageId(pageId);
    setSaving(true);
    setError('');
    
    try {
      // Get full page data with access token
      const pageRes = await fetch('/api/auth/facebook/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });
      
      const pageData = await pageRes.json();
      
      if (!pageRes.ok) {
        throw new Error(pageData.error);
      }
      
      // Save to shop
      const shopRes = await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebook_page_id: pageData.page.id,
          facebook_page_name: pageData.page.name,
          facebook_page_access_token: pageData.page.access_token
        })
      });
      
      const shopData = await shopRes.json();
      
      if (!shopRes.ok) {
        throw new Error(shopData.error);
      }
      
      setShop(shopData.shop);
      setFbConnected(true);
      setFbPageId(pageData.page.id);
      setFbPageName(pageData.page.name);
      setFbPages([]); // Clear pages list
      setStep(3);
      
    } catch (err: any) {
      console.error('Error selecting page:', err);
      setError(err.message || 'Page сонгоход алдаа гарлаа');
    } finally {
      setSaving(false);
      setSelectedPageId(null);
    }
  };

  const saveShopInfo = async () => {
    setSaving(true);
    setError('');
    
    try {
      if (shop) {
        // Update existing shop
        const res = await fetch('/api/shop', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: shopName, owner_name: ownerName, phone })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        setShop(data.shop);
      } else {
        // Create new shop
        const res = await fetch('/api/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: shopName, owner_name: ownerName, phone })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        setShop(data.shop);
      }
      
      setStep(2);
    } catch (err: any) {
      console.error('Error saving shop:', err);
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const saveFacebookConnection = async () => {
    if (!fbPageId || !fbAccessToken) {
      // Skip Facebook connection
      setStep(3);
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const res = await fetch('/api/shop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          facebook_page_id: fbPageId,
          facebook_page_name: fbPageName,
          facebook_page_access_token: fbAccessToken
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setShop(data.shop);
      setFbConnected(true);
      setStep(3);
    } catch (err: any) {
      console.error('Error saving Facebook:', err);
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, { name: '', price: '', description: '' }]);
  };

  const updateProduct = (index: number, field: string, value: string) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const completeSetup = async () => {
    setSaving(true);
    setError('');
    
    try {
      // Save products via API
      const validProducts = products.filter(p => p.name && p.price);
      
      const res = await fetch('/api/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: validProducts })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error completing setup:', err);
      setError(err.message || 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative max-w-2xl mx-auto">
        {/* Logo */}
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
                step >= s 
                  ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white' 
                  : 'bg-white/10 text-gray-400'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-16 h-1 rounded ${step > s ? 'bg-violet-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
          
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm">
              {error}
            </div>
          )}
          
          {/* Step 1: Shop Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Store className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Дэлгүүрийн мэдээлэл</h2>
                <p className="text-gray-400">Таны дэлгүүрийн үндсэн мэдээлэл</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Дэлгүүрийн нэр *</label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Жишээ: Миний дэлгүүр"
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Эзэмшигчийн нэр</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Таны нэр"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Утасны дугаар</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="99001122"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <button
                onClick={saveShopInfo}
                disabled={!shopName || saving}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Үргэлжлүүлэх
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Facebook Connection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Facebook className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Facebook Page холбох</h2>
                <p className="text-gray-400">Messenger чатбот идэвхжүүлэхийн тулд Page холбоно уу</p>
              </div>

              {/* Already Connected */}
              {fbConnected && (
                <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <div>
                      <p className="text-emerald-300 font-medium">Facebook Page холбогдсон!</p>
                      <p className="text-sm text-gray-400">{fbPageName}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pages Selection (after OAuth) */}
              {fbPages.length > 0 && (
                <div className="space-y-4">
                  <p className="text-gray-300 text-center">Page сонгоно уу:</p>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {fbPages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => selectFacebookPage(page.id)}
                        disabled={saving}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                          selectedPageId === page.id
                            ? 'bg-blue-500/30 border-blue-500'
                            : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-blue-400'
                        }`}
                      >
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Facebook className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-white font-medium">{page.name}</p>
                          {page.category && (
                            <p className="text-sm text-gray-400">{page.category}</p>
                          )}
                        </div>
                        {selectedPageId === page.id && saving && (
                          <div className="w-5 h-5 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connect with Facebook Button */}
              {!fbConnected && fbPages.length === 0 && (
                <>
                  <button
                    onClick={connectWithFacebook}
                    disabled={fbLoading}
                    className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {fbLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Facebook className="w-6 h-6" />
                        Facebook-ээр холбох
                      </>
                    )}
                  </button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-transparent text-gray-500">эсвэл</span>
                    </div>
                  </div>

                  {/* Manual Entry (collapsed by default) */}
                  <details className="group">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300 text-sm text-center list-none">
                      Гараар оруулах ↓
                    </summary>
                    <div className="mt-4 space-y-4 pt-4 border-t border-white/10">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <h3 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
                          <MessageSquare className="w-5 h-5" />
                          Хэрхэн холбох вэ?
                        </h3>
                        <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                          <li>
                            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                              Facebook Developers <ExternalLink className="w-3 h-3" />
                            </a> руу орно
                          </li>
                          <li>Апп үүсгээд Messenger product нэмнэ</li>
                          <li>Page Access Token авна</li>
                          <li>Webhook URL: <code className="bg-white/10 px-2 py-0.5 rounded text-xs">https://smarthub-opal.vercel.app/api/webhook</code></li>
                        </ol>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Page нэр</label>
                        <input
                          type="text"
                          value={fbPageName}
                          onChange={(e) => setFbPageName(e.target.value)}
                          placeholder="Миний бизнес Page"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Page ID</label>
                        <input
                          type="text"
                          value={fbPageId}
                          onChange={(e) => setFbPageId(e.target.value)}
                          placeholder="1234567890123456"
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Page Access Token</label>
                        <textarea
                          value={fbAccessToken}
                          onChange={(e) => setFbAccessToken(e.target.value)}
                          placeholder="EAAG..."
                          rows={3}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm font-mono"
                        />
                      </div>
                    </div>
                  </details>
                </>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Буцах
                </button>
                <button
                  onClick={saveFacebookConnection}
                  disabled={saving || fbPages.length > 0}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      {fbPageId || fbConnected ? 'Үргэлжлүүлэх' : 'Алгасах'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Products */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Бүтээгдэхүүн нэмэх</h2>
                <p className="text-gray-400">Чатбот танилцуулах бүтээгдэхүүнүүд (дараа нь нэмж болно)</p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
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
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Буцах
                </button>
                <button
                  onClick={completeSetup}
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
          )}
        </div>
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
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
