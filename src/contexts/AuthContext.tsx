'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';
import type { Shop, ShopRole, Permission } from '@/types/database';
import { roleCan } from '@/lib/auth/permissions';
import { logger } from '@/lib/utils/logger';

const isDev = process.env.NODE_ENV === 'development';
const ACTIVE_SHOP_KEY = 'smarthub_active_shop_id';

export type { Shop };

interface AuthContextType {
  user: { id: string; email: string; fullName: string | null } | null;
  shop: Shop | null;
  shops: Shop[];
  /** Идэвхтэй дэлгүүр дэх хэрэглэгчийн эрх (owner / admin / staff). */
  role: ShopRole | null;
  /** Идэвхтэй дэлгүүрт тухайн зөвшөөрөл байгаа эсэх (UI gating). */
  can: (perm: Permission) => boolean;
  loading: boolean;
  isSignedIn: boolean;
  refreshShop: () => Promise<void>;
  switchShop: (shopId: string) => Promise<void>;
  refreshShops: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  shop: null,
  shops: [],
  role: null,
  can: () => false,
  loading: true,
  isSignedIn: false,
  refreshShop: async () => { },
  switchShop: async () => { },
  refreshShops: async () => { },
});

const supabase = createSupabaseBrowserClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const isSignedIn = !!supabaseUser;

  // Transform Supabase user to our format
  const user = supabaseUser ? {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    fullName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
  } : null;

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      setIsLoaded(true);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupabaseUser(session?.user ?? null);
        setIsLoaded(true);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch all shops for user
  const fetchShops = useCallback(async () => {
    if (!isSignedIn) return [];

    try {
      const res = await fetch('/api/user/shops');
      const data = await res.json();
      const userShops = data.shops || [];
      setShops(userShops);
      return userShops;
    } catch (err) {
      if (isDev) logger.error('Fetch shops error:', { error: err });
      return [];
    }
  }, [isSignedIn]);

  // Set active shop (with localStorage persistence)
  const setActiveShop = useCallback((shopData: Shop | null) => {
    setShop(shopData);
    if (shopData) {
      localStorage.setItem(ACTIVE_SHOP_KEY, shopData.id);
    } else {
      localStorage.removeItem(ACTIVE_SHOP_KEY);
    }
  }, []);

  // Initialize active shop from localStorage or default to first shop
  const initializeActiveShop = useCallback((userShops: Shop[]) => {
    if (userShops.length === 0) {
      setActiveShop(null);
      return;
    }

    const savedShopId = localStorage.getItem(ACTIVE_SHOP_KEY);
    const savedShop = savedShopId ? userShops.find(s => s.id === savedShopId) : null;

    setActiveShop(savedShop || userShops[0]);
  }, [setActiveShop]);

  // Switch to a different shop
  const switchShop = useCallback(async (shopId: string) => {
    try {
      const res = await fetch('/api/user/switch-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      });

      const data = await res.json();

      if (data.success && data.shop) {
        setActiveShop(data.shop);
        window.location.reload();
      } else {
        // Чимээгүй унтарвал хэрэглэгч хуучин дэлгүүр дээрээ үлдсэнээ мэдэхгүй.
        toast.error('Дэлгүүр солиход алдаа гарлаа');
      }
    } catch (err) {
      if (isDev) logger.error('Switch shop error:', { error: err });
      toast.error('Дэлгүүр солиход алдаа гарлаа');
    }
  }, [setActiveShop]);

  const refreshShops = useCallback(async () => {
    const userShops = await fetchShops();
    initializeActiveShop(userShops);
  }, [fetchShops, initializeActiveShop]);

  const refreshShop = useCallback(async () => {
    await refreshShops();
  }, [refreshShops]);

  // Initialize on auth state change
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!isLoaded) return;

      if (isSignedIn) {
        fetchShops().then(userShops => {
          if (isMounted) {
            initializeActiveShop(userShops);
            setLoading(false);
          }
        });
      } else {
        if (isMounted) {
          setShop(null);
          setShops([]);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, isSignedIn, fetchShops, initializeActiveShop]);

  const role: ShopRole | null = shop?.role ?? null;
  const can = useCallback(
    (perm: Permission) => (role ? roleCan(role, perm) : false),
    [role],
  );

  return (
    <AuthContext.Provider value={{
      user,
      shop,
      shops,
      role,
      can,
      loading: !isLoaded || loading,
      isSignedIn: isSignedIn || false,
      refreshShop,
      switchShop,
      refreshShops,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
