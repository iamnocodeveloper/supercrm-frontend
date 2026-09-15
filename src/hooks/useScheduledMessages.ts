import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ScheduledMessage {
  id: string;
  conversation_id: string;
  content: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  channel_type: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  error_message?: string | null;
  created_at: string;
}

export function useScheduledMessages(conversationId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('conversation_scheduled_messages' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .in('status', ['pending', 'failed'])
      .order('scheduled_for', { ascending: true });
    if (!error && data) setMessages(data as any);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`csm-${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'conversation_scheduled_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, load]);

  const schedule = useCallback(async (payload: {
    conversation_id: string;
    content: string;
    scheduled_for: string; // ISO
    channel_type: string;
    whatsapp_session_name?: string | null;
    whatsapp_connection_id?: string | null;
    twilio_connection_id?: string | null;
    telegram_bot_id?: string | null;
  }) => {
    if (!user) throw new Error('No autenticado');
    // user_id debe ser el account owner
    const { data: profile } = await supabase
      .from('profiles').select('parent_user_id').eq('id', user.id).maybeSingle();
    const ownerId = profile?.parent_user_id ?? user.id;
    const { error } = await supabase
      .from('conversation_scheduled_messages' as any)
      .insert({ ...payload, user_id: ownerId, created_by: user.id });
    if (error) throw error;
    await load();
  }, [user, load]);

  const cancel = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('conversation_scheduled_messages' as any)
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  return { messages, loading, schedule, cancel, reload: load };
}
