import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useAuth } from './useAuth';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type ProfileType = Database['public']['Enums']['profile_type'];

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  profile_type: ProfileType;
  plan_id: string | null;
  plan_type: string | null;
}

// Backoff sequence in ms; clamps at last value for higher attempts
const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

const isTransientError = (err: any): boolean => {
  if (!err) return false;
  // Network / fetch errors
  if (err instanceof TypeError) return true;
  if (err?.name === 'AbortError') return true;
  if (err?.message === 'TIMEOUT') return true;
  // Supabase / PostgREST: status 5xx or no status (socket drop)
  const status = err?.status ?? err?.code;
  if (typeof status === 'number' && status >= 500) return true;
  // PostgREST error codes starting with PGRST often transient connection issues
  const code: string | undefined = err?.code;
  if (typeof code === 'string') {
    // 4xx-style PostgREST codes (PGRST301 row not found etc.) — not transient
    // Connection errors from supabase-js often have no code; treat as transient
    if (code.startsWith('PGRST') === false) {
      // Postgres "57P0X" admin shutdown / connection issues
      if (code.startsWith('08') || code.startsWith('57')) return true;
    }
    return false;
  }
  // No code, no status — likely a network/socket failure
  if (!err?.status && !err?.code) return true;
  return false;
};

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const { effectiveUserId, isImpersonating } = useEffectiveUserId();
  const { user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const clearPendingTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          resolve();
        }, ms);
      });

    const fetchProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setRetrying(false);
      setRetryCount(0);
      attempt = 0;

      // Loop until success, non-recoverable error, or unmount
      while (!cancelled) {
        try {
          const { data, error: queryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          if (cancelled) return;

          if (queryError) throw queryError;

          if (!data) {
            // Non-recoverable: profile doesn't exist
            setError('No se encontró el perfil del usuario.');
            setProfile(null);
            setRetrying(false);
            setLoading(false);
            return;
          }

          setProfile(data as UserProfile);
          setError(null);
          setRetrying(false);
          setRetryCount(0);
          setLoading(false);
          return;
        } catch (err: any) {
          if (cancelled) return;
          logger.error('Error fetching profile (attempt ' + (attempt + 1) + '):', err);

          if (!isTransientError(err)) {
            // Non-recoverable error (e.g. 401/403/permissions)
            setError(err?.message || 'Error al cargar el perfil');
            setProfile(null);
            setRetrying(false);
            setLoading(false);
            return;
          }

          // Transient error — schedule a retry with exponential backoff
          attempt += 1;
          const delay = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
          setRetrying(true);
          setRetryCount(attempt);
          // Keep loading=true so ProtectedRoute can show "Reconectando…" overlay
          setLoading(true);
          setError(null);

          await wait(delay);
          if (cancelled) return;
        }
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
      clearPendingTimeout();
    };
  }, [user?.id, reloadKey]);

  const isSuperAdmin = profile?.profile_type === 'superadmin';
  const isClient = profile?.profile_type === 'client';
  const isCajero = profile?.profile_type === 'cajero';

  const refetchProfile = useCallback(() => {
    setReloadKey(k => k + 1);
  }, []);

  return {
    profile,
    loading,
    error,
    retrying,
    retryCount,
    isSuperAdmin,
    isClient,
    isCajero,
    isImpersonating,
    effectiveUserId,
    refetchProfile,
  };
};
