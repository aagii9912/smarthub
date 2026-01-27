'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

const isDev = process.env.NODE_ENV === 'development';
const ACTIVE_SHOP_KEY = 'smarthub_active_shop_id';

export interface Shop {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  setup_completed: boolean;
  is_active: boolean;
  // Bank information
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  // AI Settings
  description?: string | null;
  ai_emotion?: string | null;
  ai_instructions?: string | null;
  // Instagram Integration
  instagram_business_account_id?: string | null;
  instagram_access_token?: string | null;
  instagram_username?: string | null;
}

interface AuthContextType {
  user: { id: string; email: string; fullName: string | null } | null;
  shop: Shop | null;
  shops: Shop[];
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
  loading: true,
  isSignedIn: false,
  refreshShop: async () => { },
  switchShop: async () => { },
  refreshShops: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const [shop, setShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  // Transform Clerk user to our format
  const user = clerkUser ? {
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    fullName: clerkUser.fullName,
  } : null;

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
      if (isDev) console.error('Fetch shops error:', err);
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
      }
    } catch (err) {
      if (isDev) console.error('Switch shop error:', err);
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

  return (
    <AuthContext.Provider value={{
      user,
      shop,
      shops,
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
