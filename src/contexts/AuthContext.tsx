'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/auth/supabase-auth';

const isDev = process.env.NODE_ENV === 'development';

interface Shop {
  id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  setup_completed: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  shop: Shop | null;
  loading: boolean;
  refreshShop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  shop: null,
  loading: true,
  refreshShop: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchShop = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Normal - shop may not exist yet for new users
        setShop(null);
      } else {
        setShop(data);
      }
    } catch (err) {
      if (isDev) console.error('Shop fetch exception:', err);
      setShop(null);
    }
  };

  const refreshShop = async () => {
    // Use API endpoint for more reliable auth handling
    try {
      const res = await fetch('/api/shop');
      const data = await res.json();
      if (data.shop) {
        setShop(data.shop);
      }
    } catch (err) {
      if (isDev) console.error('Refresh shop error:', err);
    }
  };

  useEffect(() => {
    // Get initial session with timeout protection
    const timeoutId = setTimeout(() => {
      if (loading) {
        if (isDev) console.log('Auth loading timeout');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeoutId);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchShop(session.user.id);
      }

      setLoading(false);
    }).catch((err) => {
      clearTimeout(timeoutId);
      if (isDev) console.error('Auth session error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchShop(session.user.id);
        } else {
          setShop(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, shop, loading, refreshShop }}>
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

