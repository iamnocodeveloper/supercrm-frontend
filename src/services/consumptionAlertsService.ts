import { supabase } from '@/integrations/supabase/client';
import type { AgentPerformanceStats, ChannelProfitabilityStats, DateRange } from '@/services/reportsService';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type ConsumptionAlertType = 'twilio_cost' | 'twilio_messages' | 'whatsapp_api_unusual' | 'agent_volume' | 'low_savings' | 'send_errors';

export interface ConsumptionAlertSettings {
  id?: string;
  account_owner_id: string;
  target_user_id: string | null;
  twilio_monthly_cost_threshold: number;
  twilio_monthly_message_threshold: number;
  whatsapp_api_unusual_growth_percent: number;
  agent_monthly_message_threshold: number;
  minimum_savings_percent: number;
  enable_twilio_cost_alert: boolean;
  enable_whatsapp_api_unusual_alert: boolean;
  enable_agent_volume_alert: boolean;
  enable_low_savings_alert: boolean;
  default_severity: AlertSeverity;
}

export interface ConsumptionAlertHistory {
  id: string;
  account_owner_id: string;
  target_user_id: string | null;
  alert_type: ConsumptionAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommended_action: string;
  metric_value: number;
  threshold_value: number;
  period_start: string;
  period_end: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export const defaultConsumptionAlertSettings = (accountOwnerId: string): ConsumptionAlertSettings => ({
  account_owner_id: accountOwnerId,
  target_user_id: null,
  twilio_monthly_cost_threshold: 150,
  twilio_monthly_message_threshold: 2500,
  whatsapp_api_unusual_growth_percent: 40,
  agent_monthly_message_threshold: 500,
  minimum_savings_percent: 35,
  enable_twilio_cost_alert: true,
  enable_whatsapp_api_unusual_alert: true,
  enable_agent_volume_alert: true,
  enable_low_savings_alert: true,
  default_severity: 'warning'
});

export const getAccountOwnerId = async (userId: string): Promise<string> => {
  const { data, error } = await (supabase as any).rpc('get_account_owner_id', { user_id: userId });
  if (error) return userId;
  return data || userId;
};

export const getConsumptionAlertSettings = async (userId: string): Promise<ConsumptionAlertSettings> => {
  const accountOwnerId = await getAccountOwnerId(userId);
  const { data, error } = await (supabase as any)
    .from('consumption_alert_settings')
    .select('*')
    .eq('account_owner_id', accountOwnerId)
    .is('target_user_id', null)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const defaults = defaultConsumptionAlertSettings(accountOwnerId);
  const { data: inserted, error: insertError } = await (supabase as any)
    .from('consumption_alert_settings')
    .insert(defaults)
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted;
};

export const saveConsumptionAlertSettings = async (settings: ConsumptionAlertSettings) => {
  const query = (supabase as any).from('consumption_alert_settings');
  if (settings.id) {
    const { data, error } = await query.update(settings).eq('id', settings.id).select('*').single();
    if (error) throw error;
    return data as ConsumptionAlertSettings;
  }

  const { data, error } = await query
    .insert(settings)
    .select('*')
    .single();

  if (error) throw error;
  return data as ConsumptionAlertSettings;
};

export const getConsumptionAlertHistory = async (userId: string, limit = 12): Promise<ConsumptionAlertHistory[]> => {
  const accountOwnerId = await getAccountOwnerId(userId);
  const { data, error } = await (supabase as any)
    .from('consumption_alert_history')
    .select('*')
    .eq('account_owner_id', accountOwnerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

export const markConsumptionAlertRead = async (alertId: string) => {
  const { error } = await (supabase as any)
    .from('consumption_alert_history')
    .update({ is_read: true })
    .eq('id', alertId);

  if (error) throw error;
};

type AlertDraft = Omit<ConsumptionAlertHistory, 'id' | 'created_at' | 'is_read'>;

const createAlert = (draft: AlertDraft): AlertDraft => draft;

export const evaluateConsumptionAlerts = ({
  accountOwnerId,
  settings,
  profitability,
  agents,
  previousWhatsappApiMessages = 0,
  dateRange
}: {
  accountOwnerId: string;
  settings: ConsumptionAlertSettings;
  profitability?: ChannelProfitabilityStats | null;
  agents?: AgentPerformanceStats[];
  previousWhatsappApiMessages?: number;
  dateRange: DateRange;
}): AlertDraft[] => {
  const alerts: AlertDraft[] = [];
  const period_start = dateRange.startDate.toISOString();
  const period_end = dateRange.endDate.toISOString();

  if (profitability && settings.enable_twilio_cost_alert && profitability.twilioCost >= settings.twilio_monthly_cost_threshold) {
    alerts.push(createAlert({
      account_owner_id: accountOwnerId,
      target_user_id: null,
      alert_type: 'twilio_cost',
      severity: profitability.twilioCost > settings.twilio_monthly_cost_threshold * 1.25 ? 'critical' : settings.default_severity,
      title: 'Twilio superó el umbral de costo',
      description: `Twilio lleva $${profitability.twilioCost.toFixed(2)} USD en el período.`,
      recommended_action: 'Migrar tráfico de volumen a WhatsApp API para reducir el costo por mensaje aproximadamente 30%.',
      metric_value: profitability.twilioCost,
      threshold_value: settings.twilio_monthly_cost_threshold,
      period_start,
      period_end,
      metadata: { twilioMessages: profitability.twilioMessages }
    }));
  }

  if (profitability && settings.enable_twilio_cost_alert && profitability.twilioMessages >= settings.twilio_monthly_message_threshold) {
    alerts.push(createAlert({
      account_owner_id: accountOwnerId,
      target_user_id: null,
      alert_type: 'twilio_messages',
      severity: settings.default_severity,
      title: 'Twilio superó el umbral de mensajes',
      description: `Twilio acumuló ${profitability.twilioMessages.toLocaleString()} mensajes.`,
      recommended_action: 'Revisar campañas y derivar contactos no urgentes a WhatsApp API o QR.',
      metric_value: profitability.twilioMessages,
      threshold_value: settings.twilio_monthly_message_threshold,
      period_start,
      period_end,
      metadata: { twilioCost: profitability.twilioCost }
    }));
  }

  if (profitability && settings.enable_whatsapp_api_unusual_alert && previousWhatsappApiMessages > 0) {
    const growth = ((profitability.whatsappApiMessages - previousWhatsappApiMessages) / previousWhatsappApiMessages) * 100;
    if (growth >= settings.whatsapp_api_unusual_growth_percent) {
      alerts.push(createAlert({
        account_owner_id: accountOwnerId,
        target_user_id: null,
        alert_type: 'whatsapp_api_unusual',
        severity: growth > settings.whatsapp_api_unusual_growth_percent * 1.5 ? 'critical' : settings.default_severity,
        title: 'WhatsApp API tuvo consumo inusual',
        description: `El consumo creció ${growth.toFixed(1)}% contra el período anterior.`,
        recommended_action: 'Revisar campañas recientes y segmentar envíos para evitar gasto innecesario.',
        metric_value: growth,
        threshold_value: settings.whatsapp_api_unusual_growth_percent,
        period_start,
        period_end,
        metadata: { current: profitability.whatsappApiMessages, previous: previousWhatsappApiMessages }
      }));
    }
  }

  if (profitability && settings.enable_low_savings_alert && profitability.totalMessages > 0 && profitability.savingsPercentage < settings.minimum_savings_percent) {
    alerts.push(createAlert({
      account_owner_id: accountOwnerId,
      target_user_id: null,
      alert_type: 'low_savings',
      severity: 'warning',
      title: 'Ahorro por debajo del objetivo',
      description: `El ahorro estimado está en ${profitability.savingsPercentage.toFixed(1)}%.`,
      recommended_action: 'Priorizar WhatsApp API para volumen y reservar Twilio para conversaciones críticas.',
      metric_value: profitability.savingsPercentage,
      threshold_value: settings.minimum_savings_percent,
      period_start,
      period_end,
      metadata: { totalSavings: profitability.totalSavings }
    }));
  }

  if (settings.enable_agent_volume_alert) {
    (agents || []).filter(agent => agent.messagesSent >= settings.agent_monthly_message_threshold).forEach(agent => {
      alerts.push(createAlert({
        account_owner_id: accountOwnerId,
        target_user_id: agent.id,
        alert_type: 'agent_volume',
        severity: agent.messagesSent > settings.agent_monthly_message_threshold * 1.5 ? 'critical' : settings.default_severity,
        title: 'Cajero con volumen alto',
        description: `${agent.name} envió ${agent.messagesSent.toLocaleString()} mensajes en el período.`,
        recommended_action: agent.recommendation || 'Revisar asignación, plantillas y derivar tráfico repetitivo a WhatsApp API.',
        metric_value: agent.messagesSent,
        threshold_value: settings.agent_monthly_message_threshold,
        period_start,
        period_end,
        metadata: { agentName: agent.name, estimatedCost: agent.estimatedTotalCost, savings: agent.estimatedSavings }
      }));
    });
  }

  return alerts;
};

export const storeConsumptionAlerts = async (alerts: AlertDraft[]) => {
  if (alerts.length === 0) return [];
  const saved: ConsumptionAlertHistory[] = [];
  for (const alert of alerts) {
    const { data, error } = await (supabase as any)
      .from('consumption_alert_history')
      .insert({ ...alert, is_read: false })
      .select('*')
      .single();

    if (error && error.code !== '23505') {
      console.warn('No se pudo guardar alerta de consumo:', error.message);
    }
    if (data) saved.push(data);
  }

  return saved;
};
