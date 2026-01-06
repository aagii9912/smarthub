'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/auth/supabase-auth';

interface Shop {
  id: string;
  name: string;
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
  refreshShop: async () => {},
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
        console.log('Shop fetch error (may be normal if no shop yet):', error.message);
        setShop(null);
      } else {
        setShop(data);
      }
    } catch (err) {
      console.error('Shop fetch exception:', err);
      setShop(null);
    }
  };

  const refreshShop = async () => {
    if (user) {
      await fetchShop(user.id);
    }
  };

  useEffect(() => {
    // Get initial session with timeout protection
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('Auth loading timeout - setting loading to false');
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
      console.error('Auth session error:', err);
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

