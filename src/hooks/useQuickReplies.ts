import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

interface QuickReply {
  id: string;
  title: string;
  hotkey: string | null;
  message: string;
  attachment_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export const useQuickReplies = () => {
  const { effectiveUserId } = useEffectiveUserId();

  const quickRepliesQuery = useQuery({
    queryKey: ['quickReplies', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('title', { ascending: true });

      if (error) {
        console.error('[useQuickReplies] Error fetching:', error);
        throw error;
      }

      return data as QuickReply[];
    },
    enabled: !!effectiveUserId,
  });

  return {
    quickReplies: quickRepliesQuery.data || [],
    isLoading: quickRepliesQuery.isLoading,
    error: quickRepliesQuery.error,
  };
};
