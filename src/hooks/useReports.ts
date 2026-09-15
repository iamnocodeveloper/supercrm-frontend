import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  ChannelType,
  DateRange,
  getSessionsByChannelType,
  getSessionStats,
  getMessagesByDate,
  getHourlyStats,
  getAllSessionCounts,
  getChannelTypeStats,
  getMessagesByDateForChannel,
  getHourlyStatsForChannel,
  getNewConversationsByDate,
  getNewConversationsByDateForChannel,
  getChannelProfitabilityStats,
  getAgentPerformanceStats,
  getSystemHealthStats,
  getMonthlyChannelCostSnapshots,
  getOperationalAlerts,
  upsertCurrentMonthlyChannelCostSnapshot
} from '@/services/reportsService';
import { useConsumptionAlerts } from '@/hooks/useConsumptionAlerts';
import { getLeadChannelRecommendations } from '@/services/channelRecommendationService';

export const useReports = () => {
  const { user } = useAuth();
  const [channelType, setChannelType] = useState<ChannelType>('twilio');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>('all');
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    return { startDate, endDate };
  });

  // Check if we're viewing all sessions or a specific one
  const isAllSessions = selectedSessionId === 'all' || selectedSessionId === null;

  // Fetch all session counts for all channel types
  const {
    data: sessionCounts = { whatsapp: 0, twilio: 0, telegram: 0, webchat: 0 },
    isLoading: countsLoading
  } = useQuery({
    queryKey: ['report-session-counts', user?.id],
    queryFn: () => getAllSessionCounts(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  const {
    data: profitabilityStats,
    isLoading: profitabilityLoading
  } = useQuery({
    queryKey: ['report-profitability', user?.id, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getChannelProfitabilityStats(user?.id || '', dateRange),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: agentPerformanceStats = [],
    isLoading: agentPerformanceLoading
  } = useQuery({
    queryKey: ['report-agent-performance', user?.id, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getAgentPerformanceStats(user?.id || '', dateRange),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: systemHealthStats,
    isLoading: systemHealthLoading
  } = useQuery({
    queryKey: ['report-system-health', user?.id],
    queryFn: () => getSystemHealthStats(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2
  });

  const operationalAlerts = useMemo(
    () => getOperationalAlerts(profitabilityStats, agentPerformanceStats, systemHealthStats),
    [profitabilityStats, agentPerformanceStats, systemHealthStats]
  );

  const consumptionAlerts = useConsumptionAlerts({ profitability: profitabilityStats, agents: agentPerformanceStats, dateRange, evaluate: true });

  const {
    data: leadChannelRecommendations = [],
    isLoading: leadChannelRecommendationsLoading
  } = useQuery({
    queryKey: ['lead-channel-recommendations', user?.id, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getLeadChannelRecommendations(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  const {
    data: monthlyCostSnapshots = [],
    isLoading: monthlyCostSnapshotsLoading
  } = useQuery({
    queryKey: ['report-monthly-cost-snapshots', user?.id, profitabilityStats?.totalMessages],
    queryFn: async () => {
      if (!user?.id) return [];
      if (profitabilityStats) await upsertCurrentMonthlyChannelCostSnapshot(user.id, profitabilityStats);
      return getMonthlyChannelCostSnapshots(user.id);
    },
    enabled: !!user?.id && !!profitabilityStats,
    staleTime: 1000 * 60 * 5
  });

  // Fetch sessions for selected channel type
  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    error: sessionsError
  } = useQuery({
    queryKey: ['report-sessions', user?.id, channelType],
    queryFn: () => getSessionsByChannelType(user?.id || '', channelType),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  // =====================
  // CHANNEL-LEVEL STATS (when "all" is selected)
  // =====================
  const {
    data: channelStats,
    isLoading: channelStatsLoading
  } = useQuery({
    queryKey: ['report-channel-stats', user?.id, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getChannelTypeStats(user?.id || '', channelType, dateRange),
    enabled: !!user?.id && isAllSessions,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: channelDailyStats = [],
    isLoading: channelDailyLoading
  } = useQuery({
    queryKey: ['report-channel-daily', user?.id, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getMessagesByDateForChannel(user?.id || '', channelType, dateRange),
    enabled: !!user?.id && isAllSessions,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: channelHourlyStats = [],
    isLoading: channelHourlyLoading
  } = useQuery({
    queryKey: ['report-channel-hourly', user?.id, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getHourlyStatsForChannel(user?.id || '', channelType, dateRange),
    enabled: !!user?.id && isAllSessions,
    staleTime: 1000 * 60 * 2
  });

  // =====================
  // NEW CONVERSATIONS BY DAY (Channel Level)
  // =====================
  const {
    data: channelNewConversationsDaily = [],
    isLoading: channelNewConvsLoading
  } = useQuery({
    queryKey: ['report-channel-new-convs', user?.id, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getNewConversationsByDateForChannel(user?.id || '', channelType, dateRange),
    enabled: !!user?.id && isAllSessions,
    staleTime: 1000 * 60 * 2
  });

  // =====================
  // SESSION-SPECIFIC STATS (when a specific session is selected)
  // =====================
  const {
    data: sessionStats,
    isLoading: sessionStatsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['report-stats', user?.id, selectedSessionId, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getSessionStats(user?.id || '', selectedSessionId!, channelType, dateRange),
    enabled: !!user?.id && !isAllSessions && !!selectedSessionId,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: sessionDailyStats = [],
    isLoading: sessionDailyLoading
  } = useQuery({
    queryKey: ['report-daily', user?.id, selectedSessionId, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getMessagesByDate(user?.id || '', selectedSessionId!, channelType, dateRange),
    enabled: !!user?.id && !isAllSessions && !!selectedSessionId,
    staleTime: 1000 * 60 * 2
  });

  const {
    data: sessionHourlyStats = [],
    isLoading: sessionHourlyLoading
  } = useQuery({
    queryKey: ['report-hourly', user?.id, selectedSessionId, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getHourlyStats(user?.id || '', selectedSessionId!, channelType, dateRange),
    enabled: !!user?.id && !isAllSessions && !!selectedSessionId,
    staleTime: 1000 * 60 * 2
  });

  // NEW CONVERSATIONS BY DAY (Session Level)
  const {
    data: sessionNewConversationsDaily = [],
    isLoading: sessionNewConvsLoading
  } = useQuery({
    queryKey: ['report-session-new-convs', user?.id, selectedSessionId, channelType, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getNewConversationsByDate(user?.id || '', selectedSessionId!, channelType, dateRange),
    enabled: !!user?.id && !isAllSessions && !!selectedSessionId,
    staleTime: 1000 * 60 * 2
  });

  // =====================
  // MERGED DATA (return appropriate data based on selection)
  // =====================
  const stats = isAllSessions ? channelStats : sessionStats;
  const dailyStats = isAllSessions ? channelDailyStats : sessionDailyStats;
  const hourlyStats = isAllSessions ? channelHourlyStats : sessionHourlyStats;
  const newConversationsDaily = isAllSessions ? channelNewConversationsDaily : sessionNewConversationsDaily;
  
  const statsLoading = isAllSessions ? channelStatsLoading : sessionStatsLoading;
  const dailyLoading = isAllSessions ? channelDailyLoading : sessionDailyLoading;
  const hourlyLoading = isAllSessions ? channelHourlyLoading : sessionHourlyLoading;
  const newConvsLoading = isAllSessions ? channelNewConvsLoading : sessionNewConvsLoading;

  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const selectChannelType = (type: ChannelType) => {
    setChannelType(type);
    setSelectedSessionId('all'); // Reset to "all" when changing channel
  };

  const updateDateRange = (range: DateRange) => {
    setDateRange(range);
  };

  const setPresetRange = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    const endDate = new Date();
    const startDate = new Date();

    switch (preset) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thisMonth':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    setDateRange({ startDate, endDate });
  };

  return {
    // State
    channelType,
    selectedSessionId,
    isAllSessions,
    dateRange,
    sessions,
    stats,
    dailyStats,
    hourlyStats,
    newConversationsDaily,
    sessionCounts,
    profitabilityStats,
    agentPerformanceStats,
    systemHealthStats,
    operationalAlerts,
    consumptionAlertHistory: consumptionAlerts.history,
    leadChannelRecommendations,
    monthlyCostSnapshots,

    // Loading states
    isLoading: sessionsLoading || statsLoading || dailyLoading || hourlyLoading || newConvsLoading,
    sessionsLoading,
    statsLoading,
    dailyLoading,
    hourlyLoading,
    newConvsLoading,
    countsLoading,
    profitabilityLoading,
    agentPerformanceLoading,
    systemHealthLoading,
    leadChannelRecommendationsLoading,
    monthlyCostSnapshotsLoading,

    // Errors
    error: sessionsError || statsError,

    // Actions
    selectSession,
    selectChannelType,
    updateDateRange,
    setPresetRange
  };
};