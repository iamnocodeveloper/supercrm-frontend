import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';

/**
 * Reasignar conversación manualmente o invocar auto-asignación.
 */
export const useConversationAssignment = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const assign = useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId: string | null }) => {
      const { error } = await supabase
        .from('conversations')
        .update({
          assigned_to: agentId,
          assigned_at: agentId ? new Date().toISOString() : null,
          assigned_by: user?.id ?? null,
        })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: 'Asignación actualizada' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const autoAssign = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.rpc('auto_assign_conversation', {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (assignedId) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: assignedId ? 'Auto-asignada' : 'Sin cajeros disponibles',
        description: assignedId
          ? 'La conversación fue asignada automáticamente'
          : 'No hay cajeros conectados para asignar',
      });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  return {
    assign: assign.mutateAsync,
    autoAssign: autoAssign.mutateAsync,
    isAssigning: assign.isPending || autoAssign.isPending,
  };
};
