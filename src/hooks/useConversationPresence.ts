import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

export interface PresenceRow {
  user_id: string;
  is_typing: boolean;
  last_seen_at: string;
}

export const useConversationPresence = (conversationId: string | null, accountOwnerId: string | null) => {
  const { user } = useAuth();

  const { data: presences = [], refetch } = useQuery({
    queryKey: ['presence', conversationId],
    enabled: !!conversationId,
    staleTime: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_presence')
        .select('user_id, is_typing, last_seen_at')
        .eq('conversation_id', conversationId!);
      return (data || []) as PresenceRow[];
    },
  });

  // Realtime subscribe
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`presence-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_presence', filter: `conversation_id=eq.${conversationId}` },
        () => refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, refetch]);

  // Mark seen on open
  useEffect(() => {
    if (!conversationId || !user?.id || !accountOwnerId) return;
    supabase.from('conversation_presence').upsert(
      {
        conversation_id: conversationId,
        user_id: user.id,
        account_owner_id: accountOwnerId,
        is_typing: false,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    ).then(() => {});
  }, [conversationId, user?.id, accountOwnerId]);

  const typingTimeoutRef = useRef<number | null>(null);
  const setTyping = (typing: boolean) => {
    if (!conversationId || !user?.id || !accountOwnerId) return;
    supabase.from('conversation_presence').upsert(
      {
        conversation_id: conversationId,
        user_id: user.id,
        account_owner_id: accountOwnerId,
        is_typing: typing,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id,user_id' },
    ).then(() => {});
    if (typing) {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => setTyping(false), 3000);
    }
  };

  const othersTyping = presences.filter(p => p.user_id !== user?.id && p.is_typing);
  const othersViewing = presences.filter(p => p.user_id !== user?.id && new Date(p.last_seen_at).getTime() > Date.now() - 60_000);

  return { presences, othersTyping, othersViewing, setTyping };
};
