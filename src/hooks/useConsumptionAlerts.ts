import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { AgentPerformanceStats, ChannelProfitabilityStats, DateRange } from '@/services/reportsService';
import {
  evaluateConsumptionAlerts,
  getAccountOwnerId,
  getConsumptionAlertHistory,
  getConsumptionAlertSettings,
  markConsumptionAlertRead,
  saveConsumptionAlertSettings,
  storeConsumptionAlerts,
  type ConsumptionAlertSettings
} from '@/services/consumptionAlertsService';

export const useConsumptionAlerts = ({
  profitability,
  agents = [],
  dateRange,
  evaluate = false,
  previousWhatsappApiMessages = 0
}: {
  profitability?: ChannelProfitabilityStats | null;
  agents?: AgentPerformanceStats[];
  dateRange?: DateRange;
  evaluate?: boolean;
  previousWhatsappApiMessages?: number;
} = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['consumption-alert-settings', user?.id],
    queryFn: () => getConsumptionAlertSettings(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5
  });

  const historyQuery = useQuery({
    queryKey: ['consumption-alert-history', user?.id],
    queryFn: () => getConsumptionAlertHistory(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60
  });

  const saveSettings = useMutation({
    mutationFn: (settings: ConsumptionAlertSettings) => saveConsumptionAlertSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consumption-alert-settings', user?.id] })
  });

  const markRead = useMutation({
    mutationFn: (alertId: string) => markConsumptionAlertRead(alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consumption-alert-history', user?.id] })
  });

  const generatedAlerts = useMemo(() => {
    if (!settingsQuery.data || !dateRange || !user?.id) return [];
    return evaluateConsumptionAlerts({
      accountOwnerId: settingsQuery.data.account_owner_id,
      settings: settingsQuery.data,
      profitability,
      agents,
      previousWhatsappApiMessages,
      dateRange
    });
  }, [agents, dateRange, previousWhatsappApiMessages, profitability, settingsQuery.data, user?.id]);

  useEffect(() => {
    if (!evaluate || !user?.id || generatedAlerts.length === 0) return;
    storeConsumptionAlerts(generatedAlerts).then(() => {
      queryClient.invalidateQueries({ queryKey: ['consumption-alert-history', user.id] });
    });
  }, [evaluate, generatedAlerts, queryClient, user?.id]);

  return {
    settings: settingsQuery.data,
    history: historyQuery.data || [],
    generatedAlerts,
    isLoading: settingsQuery.isLoading || historyQuery.isLoading,
    saveSettings: saveSettings.mutateAsync,
    isSaving: saveSettings.isPending,
    markRead: markRead.mutateAsync,
    isMarkingRead: markRead.isPending,
    getAccountOwnerId
  };
};
