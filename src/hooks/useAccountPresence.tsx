import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface AccountPresenceRow {
  user_id: string;
  status: string;
  manual_override: string | null;
  last_seen_at: string;
}

const STALE_SECONDS = 90;

export const useAccountPresence = () => {
  const { effectiveUserId } = useEffectiveUserId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['account-presence', effectiveUserId],
    queryFn: async (): Promise<AccountPresenceRow[]> => {
      const { data, error } = await supabase
        .from('agent_presence')
        .select('user_id, status, manual_override, last_seen_at')
        .eq('account_owner_id', effectiveUserId!);
      if (error) throw error;
      return (data || []) as AccountPresenceRow[];
    },
    enabled: !!effectiveUserId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!effectiveUserId) return;
    const ch = supabase
      .channel(`presence-${effectiveUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_presence', filter: `account_owner_id=eq.${effectiveUserId}` },
        () => qc.invalidateQueries({ queryKey: ['account-presence', effectiveUserId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [effectiveUserId, qc]);

  const computeStatus = (row: AccountPresenceRow): 'online' | 'away' | 'busy' | 'offline' => {
    const ageMs = Date.now() - new Date(row.last_seen_at).getTime();
    if (ageMs > STALE_SECONDS * 1000) return 'offline';
    return ((row.manual_override ?? row.status) || 'offline') as any;
  };

  return {
    rows: query.data || [],
    isLoading: query.isLoading,
    computeStatus,
    getRow: (userId: string) => query.data?.find((r) => r.user_id === userId),
  };
};
