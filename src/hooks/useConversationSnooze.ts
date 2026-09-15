import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export function useConversationSnooze() {
  const { user } = useAuth();
  const { toast } = useToast();

  const snooze = useCallback(async (conversationId: string, until: Date, reason?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('conversations')
      .update({
        snoozed_until: until.toISOString(),
        snoozed_by: user.id,
        snooze_reason: reason ?? null,
        is_followup_due: false,
      })
      .eq('id', conversationId);
    if (error) {
      toast({ title: 'Error al posponer', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: '⏰ Conversación pospuesta', description: `Reaparecerá ${until.toLocaleString('es-AR')}` });
  }, [user, toast]);

  const wakeNow = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ snoozed_until: null, snoozed_by: null, snooze_reason: null, is_followup_due: false })
      .eq('id', conversationId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  }, [toast]);

  return { snooze, wakeNow };
}
