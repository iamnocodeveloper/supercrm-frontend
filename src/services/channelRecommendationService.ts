import { supabase } from '@/integrations/supabase/client';
import { CHANNEL_MESSAGE_COSTS, getRecommendedChannel } from '@/lib/channelCosts';

export type LeadChannelKind = 'nuevo' | 'caliente' | 'seguimiento';

export interface LeadChannelRecommendation {
  leadType: LeadChannelKind;
  count: number;
  recommendedChannel: string;
  reason: string;
  projectedTwilioCost: number;
  projectedWhatsappApiCost: number;
  projectedSavings: number;
}

const classifyLead = (lead: { created_at: string | null; tags: string[] | null; lead_columns?: { name?: string | null } | null; last_inbound_message_time?: string | null }): LeadChannelKind => {
  const text = `${lead.lead_columns?.name || ''} ${(lead.tags || []).join(' ')}`.toLowerCase();
  if (/(caliente|interesado|calificado|urgente|comprobante)/.test(text)) return 'caliente';
  if (/(seguimiento|pendiente|recontacto)/.test(text)) return 'seguimiento';
  const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;
  if (createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000 || /nuevo/.test(text)) return 'nuevo';
  return 'seguimiento';
};

export const getLeadChannelRecommendations = async (userId: string): Promise<LeadChannelRecommendation[]> => {
  const [{ data: leads, error }, { data: whatsappConnections }, { data: twilioConnections }, { data: telegramBots }] = await Promise.all([
    supabase.from('leads').select('id, created_at, tags, last_inbound_message_time, lead_columns(name)').eq('user_id', userId).limit(1000),
    supabase.from('whatsapp_connections').select('status, connection_subtype').eq('user_id', userId),
    supabase.from('twilio_connections').select('status').eq('user_id', userId),
    supabase.from('telegram_bots').select('status').eq('user_id', userId)
  ]);

  if (error) throw error;

  const availability = {
    whatsappApiActive: (whatsappConnections || []).some(connection => connection.connection_subtype === 'api' && ['WORKING', 'connected', 'active'].includes(connection.status || '')),
    whatsappQrActive: (whatsappConnections || []).some(connection => connection.connection_subtype !== 'api' && ['WORKING', 'connected', 'active'].includes(connection.status || '')),
    twilioActive: (twilioConnections || []).some(connection => ['connected', 'active'].includes(connection.status || '')),
    telegramActive: (telegramBots || []).some(bot => ['connected', 'active'].includes(bot.status || ''))
  };

  const buckets: Record<LeadChannelKind, number> = { nuevo: 0, caliente: 0, seguimiento: 0 };
  (leads || []).forEach(lead => { buckets[classifyLead(lead as any)] += 1; });

  return (Object.entries(buckets) as [LeadChannelKind, number][]).map(([leadType, count]) => {
    const projectedTwilioCost = count * CHANNEL_MESSAGE_COSTS.twilio;
    const projectedWhatsappApiCost = count * CHANNEL_MESSAGE_COSTS.whatsappApi;
    const recommendedChannel = leadType === 'caliente' && availability.whatsappQrActive
      ? 'WhatsApp QR'
      : getRecommendedChannel({ ...availability, twilioCost: projectedTwilioCost, whatsappApiCost: projectedWhatsappApiCost, campaignSize: count });

    const reason = leadType === 'caliente'
      ? 'Priorizar continuidad y respuesta rápida en el canal activo más confiable.'
      : leadType === 'nuevo'
        ? 'Usar el canal de menor costo para volumen inicial y calificación.'
        : 'Optimizar recontactos y seguimientos con tarifa reducida por mensaje.';

    return {
      leadType,
      count,
      recommendedChannel,
      reason,
      projectedTwilioCost,
      projectedWhatsappApiCost,
      projectedSavings: Math.max(projectedTwilioCost - projectedWhatsappApiCost, 0)
    };
  });
};
