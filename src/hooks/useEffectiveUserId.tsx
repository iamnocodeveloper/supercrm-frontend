import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const CACHE_KEY = 'effectiveUserId_cache';
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

interface CachedData {
  effectiveUserId: string;
  isImpersonating: boolean;
  timestamp: number;
  userId: string;
}

/**
 * Hook que retorna el ID del usuario efectivo para usar en consultas de base de datos.
 * Implementa cache en sessionStorage para evitar llamadas API repetidas.
 */
export const useEffectiveUserId = () => {
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const getCachedData = useCallback((): CachedData | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const data: CachedData = JSON.parse(cached);
      const isExpired = Date.now() - data.timestamp > CACHE_TTL;
      const isSameUser = data.userId === user?.id;
      
      if (isExpired || !isSameUser) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }, [user?.id]);

  const setCachedData = useCallback((data: Omit<CachedData, 'timestamp' | 'userId'>) => {
    if (!user?.id) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        ...data,
        timestamp: Date.now(),
        userId: user.id
      }));
    } catch {
      // Ignore storage errors
    }
  }, [user?.id]);

  useEffect(() => {
    const determineEffectiveUserId = async () => {
      if (!user?.id) {
        setEffectiveUserId(null);
        setIsImpersonating(false);
        setLoading(false);
        return;
      }

      // Check cache first
      const cached = getCachedData();
      
      // Check URL for impersonation (always check fresh, not cached)
      const urlParams = new URLSearchParams(window.location.search);
      const impersonateUserId = urlParams.get('impersonate');
      
      // If no impersonation and we have cached data, use it
      if (!impersonateUserId && cached) {
        setEffectiveUserId(cached.effectiveUserId);
        setIsImpersonating(cached.isImpersonating);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        if (impersonateUserId) {
          // Verify current user is super admin before allowing impersonation
          const { data: currentUserProfile } = await supabase
            .from('profiles')
            .select('profile_type')
            .eq('id', user.id)
            .single();
            
          if (currentUserProfile?.profile_type === 'superadmin') {
            setEffectiveUserId(impersonateUserId);
            setIsImpersonating(true);
            setCachedData({ effectiveUserId: impersonateUserId, isImpersonating: true });
          } else {
            setEffectiveUserId(user.id);
            setIsImpersonating(false);
            setCachedData({ effectiveUserId: user.id, isImpersonating: false });
          }
        } else {
          // Get user's profile to check for parent_user_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, parent_user_id')
            .eq('id', user.id)
            .single();

          if (profile?.parent_user_id) {
            setEffectiveUserId(profile.parent_user_id);
            setIsImpersonating(false);
            setCachedData({ effectiveUserId: profile.parent_user_id, isImpersonating: false });
          } else {
            setEffectiveUserId(user.id);
            setIsImpersonating(false);
            setCachedData({ effectiveUserId: user.id, isImpersonating: false });
          }
        }
      } catch (error) {
        console.error('Error determining effective user ID:', error);
        setEffectiveUserId(user.id);
        setIsImpersonating(false);
      } finally {
        setLoading(false);
      }
    };

    determineEffectiveUserId();
  }, [user?.id, getCachedData, setCachedData]);

  return {
    effectiveUserId,
    isImpersonating,
    loading,
    getCurrentEffectiveUserId: () => effectiveUserId,
    clearCache: () => sessionStorage.removeItem(CACHE_KEY)
  };
};