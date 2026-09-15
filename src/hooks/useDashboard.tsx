import { useQuery } from '@tanstack/react-query';
import { dashboardService, DashboardStats, RecentLead, ActiveConversation, MessagesByHour, ConversationStats, HeatmapData } from '@/services/dashboardService';
import { useAuth } from './useAuth';
import { getChannelProfitabilityStats, type ChannelProfitabilityStats, type DateRange } from '@/services/reportsService';
import { useConsumptionAlerts } from '@/hooks/useConsumptionAlerts';

export type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year';

const createDateRangeForPeriod = (period: DashboardPeriod): DateRange => {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yesterday': {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      const e = new Date(startDate);
      e.setHours(23, 59, 59, 999);
      return { startDate, endDate: e };
    }
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  return { startDate, endDate };
};

const emptyProfitabilityStats: ChannelProfitabilityStats = {
  twilioMessages: 0,
  whatsappApiMessages: 0,
  totalMessages: 0,
  twilioCost: 0,
  whatsappApiCost: 0,
  internalCost: 0,
  externalCost: 0,
  totalSavings: 0,
  dailySavings: 0,
  weeklySavings: 0,
  monthlyProjectedSavings: 0,
  savingsPercentage: 0,
  mostExpensiveChannel: 'Sin consumo',
  mostProfitableChannel: 'Sin consumo',
  recommendedChannel: 'Sin consumo'
};

export const useDashboard = (period: DashboardPeriod = 'today') => {
  const { user } = useAuth();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['dashboard-stats', user?.id, period],
    queryFn: () => user ? dashboardService.getDashboardStats(user.id, period) : null,
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  const {
    data: recentLeads,
    isLoading: leadsLoading,
    error: leadsError
  } = useQuery({
    queryKey: ['recent-leads', user?.id],
    queryFn: () => user ? dashboardService.getRecentLeads(user.id) : null,
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000,
  });

  const {
    data: activeConversations,
    isLoading: conversationsLoading,
    error: conversationsError
  } = useQuery({
    queryKey: ['active-conversations', user?.id],
    queryFn: () => user ? dashboardService.getActiveConversations(user.id) : null,
    enabled: !!user,
    staleTime: 60000, // 60 segundos - reducir egress
    refetchInterval: 60 * 1000, // 60 segundos
  });

  const {
    data: messagesByHour,
    isLoading: messagesLoading,
    error: messagesError
  } = useQuery({
    queryKey: ['messages-by-hour', user?.id, period],
    queryFn: () => user ? dashboardService.getMessagesByHour(user.id, period === 'yesterday' ? 'today' : period) : null,
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000,
  });

  const {
    data: conversationsByHour,
    isLoading: conversationsByHourLoading,
    error: conversationsByHourError
  } = useQuery({
    queryKey: ['conversations-by-hour', user?.id, period],
    queryFn: () => user ? dashboardService.getConversationsByHour(user.id, period === 'yesterday' ? 'today' : period) : null,
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000,
  });

  const {
    data: heatmapData,
    isLoading: heatmapLoading,
    error: heatmapError
  } = useQuery({
    queryKey: ['messages-heatmap', user?.id],
    queryFn: () => user ? dashboardService.getMessagesHeatmap(user.id) : null,
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
  });

  const {
    data: profitabilityStats,
    isLoading: profitabilityLoading,
    error: profitabilityError
  } = useQuery({
    queryKey: ['dashboard-profitability', user?.id, period],
    queryFn: () => user ? getChannelProfitabilityStats(user.id, createDateRangeForPeriod(period)) : null,
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const dateRange = createDateRangeForPeriod(period);
  const consumptionAlerts = useConsumptionAlerts({ profitability: profitabilityStats, dateRange, evaluate: true });

  return {
    stats: stats || {
      totalLeads: 0,
      activeConversations: 0,
      totalContacts: 0,
      whatsappConnections: 0,
      totalCampaigns: 0,
      totalMessages: 0,
      incomingMessages: 0,
      outgoingMessages: 0,
      conversionRate: 0,
      yearlyNewProspects: 0,
      yearlyRecurringClients: 0,
      yearlyTotal: 0,
      newConversationsToday: 0,
      humanResponses: 0,
      aiResponses: 0,
      averageResponseMinutes: 0,
      activeAgents: 0,
      mostActiveFunnel: 'Sin actividad'
    },
    recentLeads: recentLeads || [],
    activeConversations: activeConversations || [],
    messagesByHour: messagesByHour || [],
    conversationsByHour: conversationsByHour || [],
    heatmapData: heatmapData || [],
    profitabilityStats: profitabilityStats || emptyProfitabilityStats,
    consumptionAlertHistory: consumptionAlerts.history,
    markConsumptionAlertRead: consumptionAlerts.markRead,
    consumptionAlertsLoading: consumptionAlerts.isLoading,
    profitabilityLoading,
    isLoading: statsLoading || leadsLoading || conversationsLoading || messagesLoading || conversationsByHourLoading || heatmapLoading || profitabilityLoading,
    error: statsError || leadsError || conversationsError || messagesError || conversationsByHourError || heatmapError || profitabilityError
  };
};