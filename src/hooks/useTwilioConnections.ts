import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

export interface TwilioConnection {
  id: string;
  connection_name: string;
  phone_number: string;
  status: string | null;
  created_at: string | null;
}

export const useTwilioConnections = () => {
  const { effectiveUserId } = useEffectiveUserId();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['twilio-connections', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('twilio_connections')
        .select('id, connection_name, phone_number, status, created_at')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching Twilio connections:', error);
        throw error;
      }

      return data as TwilioConnection[];
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
