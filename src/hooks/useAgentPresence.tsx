import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useEffectiveUserId } from './useEffectiveUserId';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

const HEARTBEAT_MS = 30_000;

/**
 * Mantiene la presencia del cajero (heartbeat + override manual).
 * Solo activa para cajeros; el admin/superadmin no necesita reportar presencia.
 */
export const useAgentPresence = () => {
  const { user } = useAuth();
  const { isCajero } = useProfile();
  const { effectiveUserId } = useEffectiveUserId();
  const [manualOverride, setManualOverrideState] = useState<PresenceStatus | null>(null);
  const [status, setStatus] = useState<PresenceStatus>('offline');

  const upsertPresence = useCallback(
    async (newStatus: PresenceStatus, override?: PresenceStatus | null) => {
      if (!user?.id || !effectiveUserId) return;
      const finalOverride = override === undefined ? manualOverride : override;
      try {
        await supabase.from('agent_presence').upsert(
          {
            user_id: user.id,
            account_owner_id: effectiveUserId,
            status: newStatus,
            manual_override: finalOverride,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        setStatus(newStatus);
      } catch (e) {
        console.error('[useAgentPresence] upsert error:', e);
      }
    },
    [user?.id, effectiveUserId, manualOverride]
  );

  const setManualOverride = useCallback(
    async (override: PresenceStatus | null) => {
      setManualOverrideState(override);
      await upsertPresence(override === 'offline' ? 'offline' : 'online', override);
    },
    [upsertPresence]
  );

  // Heartbeat
  useEffect(() => {
    if (!isCajero || !user?.id || !effectiveUserId) return;

    upsertPresence('online');
    const interval = setInterval(() => {
      const docHidden = typeof document !== 'undefined' && document.hidden;
      upsertPresence(docHidden ? 'away' : 'online');
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      upsertPresence(document.hidden ? 'away' : 'online');
    };
    const onBeforeUnload = () => {
      // best-effort
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/agent_presence?user_id=eq.${user.id}`,
        new Blob([JSON.stringify({ status: 'offline', last_seen_at: new Date().toISOString() })], {
          type: 'application/json',
        })
      );
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [isCajero, user?.id, effectiveUserId, upsertPresence]);

  return {
    status,
    manualOverride,
    effectiveStatus: (manualOverride ?? status) as PresenceStatus,
    setManualOverride,
    isActive: isCajero,
  };
};
