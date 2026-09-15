import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

export interface TelegramConnection {
  id: string;
  bot_name: string;
  bot_username: string | null;
  status: string | null;
  created_at: string | null;
}

export const useTelegramConnections = () => {
  const { effectiveUserId } = useEffectiveUserId();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['telegram-connections', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('telegram_bots')
        .select('id, bot_name, bot_username, status, created_at')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Telegram connections:', error);
        throw error;
      }

      return data as TelegramConnection[];
    },
    enabled: !!effectiveUserId,
  });

  const activeConnections = connections.filter(
    conn => conn.status === 'active'
  );

  const getConnectionById = (id: string | null) => {
    if (!id) return null;
    return connections.find(conn => conn.id === id);
  };

  const isConnectionActive = (connectionId: string | null) => {
    if (!connectionId) return false;
    const connection = getConnectionById(connectionId);
    return connection?.status === 'active';
  };

  return {
    connections,
    activeConnections,
    isLoading,
    getConnectionById,
    isConnectionActive,
  };
};
