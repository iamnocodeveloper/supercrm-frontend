import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

const TWILIO_DAILY_LIMIT = 200;

export interface TwilioUsage {
  twilio_connection_id: string;
  messages_sent: number;
  usage_date: string;
}

export const useTwilioUsage = (connectionId?: string) => {
  const { effectiveUserId } = useEffectiveUserId();
  const today = new Date().toISOString().split('T')[0];

  const { data: usage, isLoading, refetch } = useQuery({
    queryKey: ['twilio-usage', effectiveUserId, connectionId, today],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      let query = supabase
        .from('twilio_daily_usage')
        .select('twilio_connection_id, messages_sent, usage_date')
        .eq('user_id', effectiveUserId)
        .eq('usage_date', today);

      if (connectionId) {
        query = query.eq('twilio_connection_id', connectionId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching Twilio usage:', error);
        throw error;
      }

      return data as TwilioUsage[];
    },
    enabled: !!effectiveUserId,
  });

  const getUsageByConnectionId = (connId: string): number => {
    if (!usage) return 0;
    const record = usage.find(u => u.twilio_connection_id === connId);
    return record?.messages_sent || 0;
  };

  const getRemainingMessages = (connId: string): number => {
    return TWILIO_DAILY_LIMIT - getUsageByConnectionId(connId);
  };

  const getUsagePercentage = (connId: string): number => {
    return (getUsageByConnectionId(connId) / TWILIO_DAILY_LIMIT) * 100;
  };

  const isNearLimit = (connId: string, threshold: number = 80): boolean => {
    return getUsagePercentage(connId) >= threshold;
  };

  return {
    usage,
    isLoading,
    refetch,
    getUsageByConnectionId,
    getRemainingMessages,
    getUsagePercentage,
    isNearLimit,
    dailyLimit: TWILIO_DAILY_LIMIT,
  };
};
