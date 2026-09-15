import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DailyAIUsage {
  date: string;
  total: number;
  whatsapp: number;
  telegram: number;
  twilio: number;
  webchat: number;
}

export interface AIUsageStatsData {
  totalResponses: number;
  estimatedCost: number;
  avgPerDay: number;
  costPerMessage: number;
  byChannel: {
    whatsapp: number;
    telegram: number;
    twilio: number;
    webchat: number;
  };
  dailyUsage: DailyAIUsage[];
}

const COST_PER_MESSAGE = 0.00017; // Based on Gemini 2.5 Flash pricing

const fetchAIUsageStats = async (userId: string, period: number): Promise<AIUsageStatsData> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, created_at, conversation_id')
    .eq('user_id', userId)
    .eq('is_bot', true)
    .gte('created_at', startDate.toISOString())
    .limit(50000);

  if (messagesError) throw messagesError;

  const conversationIds = [...new Set(messages?.map(m => m.conversation_id) || [])];

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, channel_type')
    .in('id', conversationIds.length > 0 ? conversationIds : ['']);

  if (convError) throw convError;

  const channelMap = new Map<string, string>();
  conversations?.forEach(c => {
    channelMap.set(c.id, c.channel_type || 'whatsapp');
  });

  const dailyMap = new Map<string, DailyAIUsage>();
  const byChannel = { whatsapp: 0, telegram: 0, twilio: 0, webchat: 0 };

  messages?.forEach(msg => {
    const date = new Date(msg.created_at).toISOString().split('T')[0];
    const channel = channelMap.get(msg.conversation_id) || 'whatsapp';

    if (channel in byChannel) {
      byChannel[channel as keyof typeof byChannel]++;
    }

    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, total: 0, whatsapp: 0, telegram: 0, twilio: 0, webchat: 0 });
    }
    const daily = dailyMap.get(date)!;
    daily.total++;
    if (channel in daily) {
      (daily as any)[channel]++;
    }
  });

  const dailyUsage = Array.from(dailyMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const filledDailyUsage: DailyAIUsage[] = [];
  const currentDate = new Date(startDate);
  const today = new Date();

  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const existing = dailyUsage.find(d => d.date === dateStr);
    filledDailyUsage.push(existing || {
      date: dateStr, total: 0, whatsapp: 0, telegram: 0, twilio: 0, webchat: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const totalResponses = messages?.length || 0;
  const daysWithData = filledDailyUsage.filter(d => d.total > 0).length || 1;

  return {
    totalResponses,
    estimatedCost: totalResponses * COST_PER_MESSAGE,
    avgPerDay: Math.round(totalResponses / daysWithData),
    costPerMessage: COST_PER_MESSAGE,
    byChannel,
    dailyUsage: filledDailyUsage,
  };
};

export const useAIUsageStats = (userId: string | null, period: number = 30) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-usage-stats', userId, period],
    queryFn: () => fetchAIUsageStats(userId!, period),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
};
