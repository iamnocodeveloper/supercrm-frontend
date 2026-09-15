import { supabase } from '@/integrations/supabase/client';
import { CHANNEL_MESSAGE_COSTS, getRecommendedChannel } from '@/lib/channelCosts';

export type ChannelType = 'whatsapp' | 'twilio' | 'telegram' | 'webchat';

export interface SessionInfo {
  id: string;
  name: string;
  phoneNumber?: string;
  status: string;
  channelType: ChannelType;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SessionStats {
  totalSent: number;
  totalReceived: number;
  totalConversations: number;
  lastMessageAt: string | null;
  sentChange: number;
  receivedChange: number;
  newConversationsInPeriod: number;
  newConversationsChange: number;
}

export interface DailyNewConversationsStats {
  date: string;
  count: number;
}

export interface DailyMessageStats {
  date: string;
  sent: number;
  received: number;
  total: number;
}

export interface HourlyStats {
  hour: number;
  sent: number;
  received: number;
}

export interface SessionCounts {
  whatsapp: number;
  twilio: number;
  telegram: number;
  webchat: number;
}

export const MESSAGE_COSTS = CHANNEL_MESSAGE_COSTS;

export interface ChannelProfitabilityStats {
  twilioMessages: number;
  whatsappApiMessages: number;
  totalMessages: number;
  twilioCost: number;
  whatsappApiCost: number;
  internalCost: number;
  externalCost: number;
  totalSavings: number;
  dailySavings: number;
  weeklySavings: number;
  monthlyProjectedSavings: number;
  savingsPercentage: number;
  mostExpensiveChannel: 'Twilio' | 'WhatsApp API' | 'Sin consumo';
  mostProfitableChannel: 'Twilio' | 'WhatsApp API' | 'Sin consumo';
  recommendedChannel: string;
}

export interface AgentPerformanceStats {
  id: string;
  name: string;
  email: string;
  messagesSent: number;
  assignedConversations: number;
  unreadAssigned: number;
  closedConversations: number;
  dailyActivity: number;
  averageResponseMinutes: number;
  pendingRate: number;
  performanceScore: number;
  twilioMessages: number;
  whatsappApiMessages: number;
  twilioCost: number;
  whatsappApiCost: number;
  internalCost: number;
  estimatedTotalCost: number;
  estimatedSavings: number;
  recommendation: string;
  lastActivityAt: string | null;
}

export interface SystemHealthStats {
  whatsappTotal: number;
  whatsappActive: number;
  whatsappApiTotal: number;
  whatsappApiActive: number;
  twilioTotal: number;
  twilioActive: number;
  telegramTotal: number;
  telegramActive: number;
  webchatTotal: number;
  webchatActive: number;
  pendingConversations: number;
  offlineAssignedConversations: number;
  lastMessageAt: string | null;
  recentSendErrors: number;
  aiActive: number;
  aiTotal: number;
  realtimeStatus: 'Funcionando' | 'Revisar';
  recommendedChannel: string;
}

export interface MonthlyChannelCostSnapshot {
  id: string;
  month: string;
  twilio_messages: number;
  whatsapp_api_messages: number;
  twilio_cost: number;
  whatsapp_api_cost: number;
  internal_cost: number;
  external_cost: number;
  total_savings: number;
}

export interface OperationalAlert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

// Get all session counts for all channel types (for badges)
export const getAllSessionCounts = async (userId: string): Promise<SessionCounts> => {
  const [whatsappResult, twilioResult, telegramResult, webchatResult] = await Promise.all([
    // WhatsApp WAHA connections count
    supabase
      .from('whatsapp_connections')
      .select('id', { count: 'exact', head: true }),
    
    // Twilio connections count
    supabase
      .from('twilio_connections')
      .select('id', { count: 'exact', head: true }),
    
    // Telegram bots count
    supabase
      .from('telegram_bots')
      .select('id', { count: 'exact', head: true }),
    
    // Web chatbots count
    supabase
      .from('web_chatbots')
      .select('id', { count: 'exact', head: true })
  ]);

  return {
    whatsapp: whatsappResult.count || 0,
    twilio: twilioResult.count || 0,
    telegram: telegramResult.count || 0,
    webchat: webchatResult.count || 0
  };
};

const countMessagesForConversationIds = async (
  userId: string,
  conversationIds: string[],
  dateRange: DateRange
): Promise<number> => {
  if (conversationIds.length === 0) return 0;

  let total = 0;
  for (let index = 0; index < conversationIds.length; index += 500) {
    const batch = conversationIds.slice(index, index + 500);
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('conversation_id', batch)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());

    if (error) throw error;
    total += count || 0;
  }

  return total;
};

export const getChannelProfitabilityStats = async (
  userId: string,
  dateRange: DateRange
): Promise<ChannelProfitabilityStats> => {
  const [{ data: twilioConversations, error: twilioError }, { data: apiConnections, error: apiConnectionsError }, { data: activeConnections }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .or('channel_type.eq.twilio,twilio_connection_id.not.is.null'),
    supabase
      .from('whatsapp_connections')
      .select('phone_number, connection_subtype')
      .eq('user_id', userId)
      .eq('connection_subtype', 'api'),
    supabase
      .from('whatsapp_connections')
      .select('status, connection_subtype')
      .eq('user_id', userId)
  ]);

  if (twilioError) throw twilioError;
  if (apiConnectionsError) throw apiConnectionsError;

  const apiPhoneNumbers = (apiConnections || []).map(connection => connection.phone_number).filter(Boolean);
  let whatsappApiConversationIds: string[] = [];

  if (apiPhoneNumbers.length > 0) {
    const { data: apiConversations, error: apiConversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('channel_type', 'whatsapp')
      .in('whatsapp_number', apiPhoneNumbers);

    if (apiConversationsError) throw apiConversationsError;
    whatsappApiConversationIds = (apiConversations || []).map(conversation => conversation.id);
  }

  const [twilioMessages, whatsappApiMessages] = await Promise.all([
    countMessagesForConversationIds(userId, (twilioConversations || []).map(conversation => conversation.id), dateRange),
    countMessagesForConversationIds(userId, whatsappApiConversationIds, dateRange)
  ]);

  const totalMessages = twilioMessages + whatsappApiMessages;
  const twilioCost = twilioMessages * MESSAGE_COSTS.twilio;
  const whatsappApiCost = whatsappApiMessages * MESSAGE_COSTS.whatsappApi;
  const internalCost = totalMessages * MESSAGE_COSTS.internal;
  const externalCost = twilioCost + whatsappApiCost;
  const totalSavings = Math.max(externalCost - internalCost, 0);
  const days = Math.max(1, Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const active = activeConnections || [];
  const whatsappApiActive = active.some(connection => connection.connection_subtype === 'api' && ['WORKING', 'connected', 'active'].includes(connection.status || ''));
  const whatsappQrActive = active.some(connection => connection.connection_subtype !== 'api' && ['WORKING', 'connected', 'active'].includes(connection.status || ''));
  const savingsPercentage = externalCost > 0 ? (totalSavings / externalCost) * 100 : 0;

  return {
    twilioMessages,
    whatsappApiMessages,
    totalMessages,
    twilioCost,
    whatsappApiCost,
    internalCost,
    externalCost,
    totalSavings,
    dailySavings: totalSavings / days,
    weeklySavings: (totalSavings / days) * 7,
    monthlyProjectedSavings: (totalSavings / days) * 30,
    savingsPercentage,
    mostExpensiveChannel: totalMessages === 0 ? 'Sin consumo' : twilioCost >= whatsappApiCost ? 'Twilio' : 'WhatsApp API',
    mostProfitableChannel: totalMessages === 0 ? 'Sin consumo' : whatsappApiMessages > 0 ? 'WhatsApp API' : 'Twilio',
    recommendedChannel: totalMessages === 0 ? 'Sin consumo' : getRecommendedChannel({ twilioCost, whatsappApiCost, whatsappApiActive, whatsappQrActive, twilioActive: twilioMessages > 0 })
  };
};

export const getAgentPerformanceStats = async (
  userId: string,
  dateRange: DateRange
): Promise<AgentPerformanceStats[]> => {
  const [{ data: profiles, error: profilesError }, { data: assignedConversations, error: conversationsError }, { data: outboundMessages, error: messagesError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .or(`id.eq.${userId},parent_user_id.eq.${userId}`),
    supabase
      .from('conversations')
      .select('id, assigned_to, unread_count, last_message_time, status, created_at')
      .eq('user_id', userId)
      .not('assigned_to', 'is', null),
    supabase
      .from('messages')
      .select('responded_by, created_at, conversation_id, conversations(channel_type, twilio_connection_id, whatsapp_number)')
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString())
      .not('responded_by', 'is', null)
  ]);

  if (profilesError) throw profilesError;
  if (conversationsError) throw conversationsError;
  if (messagesError) throw messagesError;

  return (profiles || []).map(profile => {
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    const agentConversations = (assignedConversations || []).filter(conversation => conversation.assigned_to === profile.id);
    const agentMessages = (outboundMessages || []).filter(message => message.responded_by === profile.id);
    const lastMessageAt = agentMessages
      .map(message => message.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

    const unreadAssigned = agentConversations.filter(conversation => (conversation.unread_count || 0) > 0).length;
    const assignedConversationsCount = agentConversations.length;
    const averageResponseMinutes = agentConversations.length > 0
      ? agentConversations.reduce((sum, conversation) => {
          const start = new Date(conversation.created_at || conversation.last_message_time || Date.now()).getTime();
          const end = new Date(conversation.last_message_time || conversation.created_at || Date.now()).getTime();
          return sum + Math.max(0, (end - start) / 60000);
        }, 0) / agentConversations.length
      : 0;
    const pendingRate = assignedConversationsCount > 0 ? (unreadAssigned / assignedConversationsCount) * 100 : 0;
    const closedConversations = agentConversations.filter(conversation => ['closed', 'cerrado', 'resolved'].includes((conversation.status || '').toLowerCase())).length;
    const performanceScore = Math.max(0, (agentMessages.length * 2) + (closedConversations * 5) - (unreadAssigned * 3));
    const twilioMessages = agentMessages.filter((message: any) => message.conversations?.channel_type === 'twilio' || message.conversations?.twilio_connection_id).length;
    const whatsappApiMessages = Math.max(agentMessages.length - twilioMessages, 0);
    const twilioCost = twilioMessages * MESSAGE_COSTS.twilio;
    const whatsappApiCost = whatsappApiMessages * MESSAGE_COSTS.whatsappApi;
    const internalCost = agentMessages.length * MESSAGE_COSTS.internal;
    const estimatedTotalCost = twilioCost + whatsappApiCost + internalCost;
    const estimatedSavings = Math.max((agentMessages.length * MESSAGE_COSTS.twilio) - (whatsappApiCost + internalCost), 0);

    return {
      id: profile.id,
      name: fullName || profile.email || 'Agente',
      email: profile.email || '',
      messagesSent: agentMessages.length,
      assignedConversations: assignedConversationsCount,
      unreadAssigned,
      closedConversations,
      dailyActivity: agentMessages.length,
      averageResponseMinutes,
      pendingRate,
      performanceScore,
      twilioMessages,
      whatsappApiMessages,
      twilioCost,
      whatsappApiCost,
      internalCost,
      estimatedTotalCost,
      estimatedSavings,
      recommendation: agentMessages.length > 500 ? 'Volumen en exceso: derivar tráfico repetitivo a WhatsApp API y revisar asignación.' : 'Consumo dentro del rango operativo.',
      lastActivityAt: lastMessageAt
    };
  }).sort((a, b) => b.performanceScore - a.performanceScore || b.messagesSent - a.messagesSent);
};

export const getSystemHealthStats = async (userId: string): Promise<SystemHealthStats> => {
  const [whatsappResult, twilioResult, telegramResult, webchatResult, conversationsResult, messagesResult, presenceResult, errorResult, aiResult] = await Promise.all([
    supabase.from('whatsapp_connections').select('status, connection_subtype').eq('user_id', userId),
    supabase.from('twilio_connections').select('status').eq('user_id', userId),
    supabase.from('telegram_bots').select('status').eq('user_id', userId),
    supabase.from('web_chatbots').select('is_active').eq('user_id', userId),
    supabase.from('conversations').select('assigned_to, unread_count').eq('user_id', userId),
    supabase.from('messages').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('agent_presence').select('user_id, status, manual_override, last_seen_at').eq('account_owner_id', userId),
    supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'failed'),
    supabase.from('ai_agents').select('is_active').eq('user_id', userId)
  ]);

  if (whatsappResult.error) throw whatsappResult.error;
  if (twilioResult.error) throw twilioResult.error;
  if (telegramResult.error) throw telegramResult.error;
  if (webchatResult.error) throw webchatResult.error;
  if (conversationsResult.error) throw conversationsResult.error;
  if (messagesResult.error) throw messagesResult.error;

  const whatsappConnections = whatsappResult.data || [];
  const apiConnections = whatsappConnections.filter(connection => connection.connection_subtype === 'api');
  const conversations = conversationsResult.data || [];
  const activeAgentIds = new Set((presenceResult.data || [])
    .filter(agent => new Date(agent.last_seen_at || 0).getTime() > Date.now() - 90_000 && !['busy', 'offline'].includes(agent.manual_override || agent.status || 'offline'))
    .map(agent => agent.user_id));
  const whatsappActive = whatsappConnections.filter(connection => ['WORKING', 'connected', 'active'].includes(connection.status || '')).length;
  const whatsappApiActive = apiConnections.filter(connection => ['WORKING', 'connected', 'active'].includes(connection.status || '')).length;
  const twilioActive = (twilioResult.data || []).filter(connection => ['connected', 'active'].includes(connection.status || '')).length;
  const telegramActive = (telegramResult.data || []).filter(bot => ['connected', 'active'].includes(bot.status || '')).length;

  return {
    whatsappTotal: whatsappConnections.length,
    whatsappActive,
    whatsappApiTotal: apiConnections.length,
    whatsappApiActive,
    twilioTotal: twilioResult.data?.length || 0,
    twilioActive,
    telegramTotal: telegramResult.data?.length || 0,
    telegramActive,
    webchatTotal: webchatResult.data?.length || 0,
    webchatActive: (webchatResult.data || []).filter(chatbot => chatbot.is_active).length,
    pendingConversations: conversations.filter(conversation => (conversation.unread_count || 0) > 0).length,
    offlineAssignedConversations: conversations.filter(conversation => conversation.assigned_to && !activeAgentIds.has(conversation.assigned_to)).length,
    lastMessageAt: messagesResult.data?.[0]?.created_at || null,
    recentSendErrors: errorResult.count || 0,
    aiActive: (aiResult.data || []).filter(agent => agent.is_active).length,
    aiTotal: aiResult.data?.length || 0,
    realtimeStatus: messagesResult.error ? 'Revisar' : 'Funcionando',
    recommendedChannel: getRecommendedChannel({ whatsappQrActive: whatsappActive > whatsappApiActive, whatsappApiActive: whatsappApiActive > 0, twilioActive: twilioActive > 0, telegramActive: telegramActive > 0 })
  };
};

export const getMonthlyChannelCostSnapshots = async (userId: string): Promise<MonthlyChannelCostSnapshot[]> => {
  const { data, error } = await (supabase as any)
    .from('monthly_channel_cost_snapshots')
    .select('id, month, twilio_messages, whatsapp_api_messages, twilio_cost, whatsapp_api_cost, internal_cost, external_cost, total_savings')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(12);

  if (error) throw error;
  return data || [];
};

export const upsertCurrentMonthlyChannelCostSnapshot = async (userId: string, stats: ChannelProfitabilityStats) => {
  const month = new Date();
  month.setDate(1);
  const monthKey = month.toISOString().slice(0, 10);

  const { error } = await (supabase as any)
    .from('monthly_channel_cost_snapshots')
    .upsert({
      user_id: userId,
      month: monthKey,
      twilio_messages: stats.twilioMessages,
      whatsapp_api_messages: stats.whatsappApiMessages,
      twilio_cost: stats.twilioCost,
      whatsapp_api_cost: stats.whatsappApiCost,
      internal_cost: stats.internalCost,
      external_cost: stats.externalCost,
      total_savings: stats.totalSavings,
    }, { onConflict: 'user_id,month' });

  if (error) throw error;
};

// =====================
// PER-CHANNEL BREAKDOWN (sent / received / total) for a date range
// =====================
export interface ChannelBreakdownItem {
  key: 'whatsapp_qr' | 'whatsapp_api' | 'twilio' | 'telegram' | 'webchat';
  label: string;
  sent: number;
  received: number;
  total: number;
  conversations: number;
}

const countMessagesByDirection = async (
  userId: string,
  conversationIds: string[],
  dateRange: DateRange,
  direction: 'inbound' | 'outbound'
): Promise<number> => {
  if (conversationIds.length === 0) return 0;
  const dirValues = direction === 'inbound' ? ['inbound', 'incoming'] : ['outbound', 'outgoing'];
  let total = 0;
  for (let i = 0; i < conversationIds.length; i += 200) {
    const batch = conversationIds.slice(i, i + 200);
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('conversation_id', batch)
      .in('direction', dirValues)
      .gte('created_at', dateRange.startDate.toISOString())
      .lte('created_at', dateRange.endDate.toISOString());
    if (error) throw error;
    total += count || 0;
  }
  return total;
};

const CONV_PAGE = 1000;

const fetchAllConvRows = async <T = any>(
  build: (q: any) => any,
  columns: string = 'id'
): Promise<T[]> => {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const base = supabase.from('conversations').select(columns).range(from, from + CONV_PAGE - 1);
    const { data, error } = await build(base);
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < CONV_PAGE) break;
    from += CONV_PAGE;
  }
  return all;
};

const getConvIdsByFilter = async (userId: string, build: (q: any) => any): Promise<string[]> => {
  const rows = await fetchAllConvRows<{ id: string }>(q => build(q.eq('user_id', userId)));
  return rows.map(r => r.id);
};

export const getChannelMessageBreakdown = async (
  userId: string,
  dateRange: DateRange
): Promise<ChannelBreakdownItem[]> => {
  const { data: waConns, error: waErr } = await supabase
    .from('whatsapp_connections')
    .select('phone_number, connection_subtype')
    .eq('user_id', userId);
  if (waErr) throw waErr;

  const apiNumbers = (waConns || []).filter(c => c.connection_subtype === 'api').map(c => c.phone_number).filter(Boolean);
  const apiSet = new Set<string>(apiNumbers as string[]);

  // Get ALL whatsapp conversations paginated (Supabase caps single select at 1000 rows)
  const allWaConvs = await fetchAllConvRows<{ id: string; whatsapp_number: string | null }>(
    q => q.eq('user_id', userId).eq('channel_type', 'whatsapp'),
    'id, whatsapp_number'
  );

  const apiIds = allWaConvs.filter(c => c.whatsapp_number && apiSet.has(c.whatsapp_number)).map(c => c.id);
  const qrIds = allWaConvs.filter(c => !c.whatsapp_number || !apiSet.has(c.whatsapp_number)).map(c => c.id);

  const [twilioIds, telegramIds, webchatIds] = await Promise.all([
    getConvIdsByFilter(userId, q => q.or('channel_type.eq.twilio,twilio_connection_id.not.is.null')),
    getConvIdsByFilter(userId, q => q.not('telegram_bot_id', 'is', null)),
    getConvIdsByFilter(userId, q => q.eq('channel_type', 'webchat')),
  ]);

  const build = async (key: ChannelBreakdownItem['key'], label: string, ids: string[]): Promise<ChannelBreakdownItem> => {
    const [sent, received] = await Promise.all([
      countMessagesByDirection(userId, ids, dateRange, 'outbound'),
      countMessagesByDirection(userId, ids, dateRange, 'inbound'),
    ]);
    return { key, label, sent, received, total: sent + received, conversations: ids.length };
  };

  return Promise.all([
    build('whatsapp_qr', 'WhatsApp QR (WAHA)', qrIds),
    build('whatsapp_api', 'WhatsApp API', apiIds),
    build('twilio', 'Twilio', twilioIds),
    build('telegram', 'Telegram', telegramIds),
    build('webchat', 'WebChat', webchatIds),
  ]);
};

export const getOperationalAlerts = (
  profitability?: ChannelProfitabilityStats,
  agents: AgentPerformanceStats[] = [],
  health?: SystemHealthStats
): OperationalAlert[] => {
  const alerts: OperationalAlert[] = [];
  if (profitability?.twilioCost && profitability.twilioCost > 150) {
    alerts.push({ id: 'twilio-cost', title: 'Twilio con costo alto', description: `Twilio lleva $${profitability.twilioCost.toFixed(2)} USD.`, severity: 'critical' });
  }
  if (profitability && profitability.totalMessages > 0 && profitability.savingsPercentage < 35) {
    alerts.push({ id: 'low-savings', title: 'Ahorro por debajo del objetivo', description: `El ahorro estimado está en ${profitability.savingsPercentage.toFixed(1)}%.`, severity: 'warning' });
  }
  const highVolumeAgent = agents.find(agent => agent.messagesSent > 500);
  if (highVolumeAgent) {
    alerts.push({ id: 'agent-volume', title: 'Cajero con volumen inusual', description: `${highVolumeAgent.name} envió ${highVolumeAgent.messagesSent} mensajes.`, severity: 'warning' });
  }
  if (health?.recentSendErrors && health.recentSendErrors > 0) {
    alerts.push({ id: 'send-errors', title: 'Errores recientes de envío', description: `${health.recentSendErrors} envíos fallidos requieren revisión.`, severity: 'warning' });
  }
  return alerts;
};

// Helper function to get conversation IDs for a session
const getConversationIdsForSession = async (
  sessionId: string,
  channelType: ChannelType
): Promise<string[]> => {
  if (channelType === 'whatsapp') {
    // Get phone number from connection
    const { data: waConn } = await supabase
      .from('whatsapp_connections')
      .select('phone_number')
      .eq('id', sessionId)
      .single();
    
    if (waConn?.phone_number) {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('whatsapp_number', waConn.phone_number)
        .eq('channel_type', 'whatsapp');

      return conversations?.map(c => c.id) || [];
    }
    return [];
  }

  if (channelType === 'webchat') {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('channel_type', 'webchat');
    
    return conversations?.map(c => c.id) || [];
  }

  // Twilio and Telegram
  let conversationFilter: Record<string, string> = {};

  switch (channelType) {
    case 'twilio':
      conversationFilter = { twilio_connection_id: sessionId };
      break;
    case 'telegram':
      conversationFilter = { telegram_bot_id: sessionId };
      break;
  }

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .match(conversationFilter);

  return conversations?.map(c => c.id) || [];
};

// Get ALL conversation IDs for a channel type (aggregate)
const getConversationIdsByChannelType = async (
  channelType: ChannelType
): Promise<string[]> => {
  let conversations;

  switch (channelType) {
    case 'whatsapp':
      conversations = await supabase
        .from('conversations')
        .select('id')
        .eq('channel_type', 'whatsapp');
      break;
    case 'twilio':
      conversations = await supabase
        .from('conversations')
        .select('id')
        .not('twilio_connection_id', 'is', null);
      break;
    case 'telegram':
      conversations = await supabase
        .from('conversations')
        .select('id')
        .not('telegram_bot_id', 'is', null);
      break;
    case 'webchat':
      conversations = await supabase
        .from('conversations')
        .select('id')
        .eq('channel_type', 'webchat');
      break;
  }

  return conversations?.data?.map(c => c.id) || [];
};

// Get sessions by channel type
export const getSessionsByChannelType = async (
  userId: string,
  channelType: ChannelType
): Promise<SessionInfo[]> => {
  switch (channelType) {
    case 'whatsapp': {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(conn => ({
        id: conn.id,
        name: conn.name || `WhatsApp ${conn.phone_number || ''}`,
        phoneNumber: conn.phone_number || undefined,
        status: conn.status || 'active',
        channelType: 'whatsapp'
      }));
    }
    case 'twilio': {
      const { data, error } = await supabase
        .from('twilio_connections')
        .select('id, connection_name, phone_number, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(conn => ({
        id: conn.id,
        name: conn.connection_name,
        phoneNumber: conn.phone_number,
        status: conn.status || 'active',
        channelType: 'twilio'
      }));
    }
    case 'telegram': {
      const { data, error } = await supabase
        .from('telegram_bots')
        .select('id, bot_name, bot_username, status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(bot => ({
        id: bot.id,
        name: bot.bot_name,
        phoneNumber: bot.bot_username || undefined,
        status: bot.status || 'active',
        channelType: 'telegram'
      }));
    }
    case 'webchat': {
      const { data, error } = await supabase
        .from('web_chatbots')
        .select('id, name, is_active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(chatbot => ({
        id: chatbot.id,
        name: chatbot.name,
        status: chatbot.is_active ? 'active' : 'inactive',
        channelType: 'webchat'
      }));
    }
    default:
      return [];
  }
};

// Get message stats for a session
export const getSessionStats = async (
  userId: string,
  sessionId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<SessionStats> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  // Calculate previous period for comparison
  const daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(dateRange.startDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
  const prevEndDate = new Date(dateRange.startDate);

  let conversationIds: string[] = [];

  // For WhatsApp, we need to get the phone number from the connection first
  if (channelType === 'whatsapp') {
    const { data: waConn } = await supabase
      .from('whatsapp_connections')
      .select('phone_number')
      .eq('id', sessionId)
      .single();
    
    if (waConn?.phone_number) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('whatsapp_number', waConn.phone_number)
        .eq('channel_type', 'whatsapp');

      if (convError) throw convError;
      conversationIds = conversations?.map(c => c.id) || [];
    }
  } else if (channelType === 'webchat') {
    // Webchat - get conversations for this web chatbot
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('channel_type', 'webchat');
    
    if (convError) throw convError;
    conversationIds = conversations?.map(c => c.id) || [];
  } else {
    // Twilio and Telegram
    let conversationFilter: Record<string, string> = {};

    switch (channelType) {
      case 'twilio':
        conversationFilter = { twilio_connection_id: sessionId };
        break;
      case 'telegram':
        conversationFilter = { telegram_bot_id: sessionId };
        break;
    }

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .match(conversationFilter);

    if (convError) throw convError;
    conversationIds = conversations?.map(c => c.id) || [];
  }

  if (conversationIds.length === 0) {
    return {
      totalSent: 0,
      totalReceived: 0,
      totalConversations: 0,
      lastMessageAt: null,
      sentChange: 0,
      receivedChange: 0,
      newConversationsInPeriod: 0,
      newConversationsChange: 0
    };
  }

  // Get current period messages
  const { data: currentMessages, error: msgError } = await supabase
    .from('messages')
    .select('direction, created_at')
    .in('conversation_id', conversationIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (msgError) throw msgError;

  // Get previous period messages for comparison
  const { data: prevMessages } = await supabase
    .from('messages')
    .select('direction')
    .in('conversation_id', conversationIds)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', prevEndDate.toISOString());

  const currentSent = currentMessages?.filter(m => m.direction === 'outbound').length || 0;
  const currentReceived = currentMessages?.filter(m => m.direction === 'inbound').length || 0;
  const prevSent = prevMessages?.filter(m => m.direction === 'outbound').length || 0;
  const prevReceived = prevMessages?.filter(m => m.direction === 'inbound').length || 0;

  const lastMessage = currentMessages?.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  // Calculate percentage change
  const sentChange = prevSent > 0 ? Math.round(((currentSent - prevSent) / prevSent) * 100) : 0;
  const receivedChange = prevReceived > 0 ? Math.round(((currentReceived - prevReceived) / prevReceived) * 100) : 0;

  // Get new conversations in period - fetch conversations with created_at in date range
  const { count: currentNewConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .in('id', conversationIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { count: prevNewConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .in('id', conversationIds)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', prevEndDate.toISOString());

  const newConversationsChange = (prevNewConvs ?? 0) > 0 
    ? Math.round((((currentNewConvs ?? 0) - (prevNewConvs ?? 0)) / (prevNewConvs ?? 1)) * 100) 
    : 0;

  return {
    totalSent: currentSent,
    totalReceived: currentReceived,
    totalConversations: conversationIds.length,
    lastMessageAt: lastMessage?.created_at || null,
    sentChange,
    receivedChange,
    newConversationsInPeriod: currentNewConvs ?? 0,
    newConversationsChange
  };
};

// Get messages grouped by day
export const getMessagesByDate = async (
  userId: string,
  sessionId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<DailyMessageStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsForSession(sessionId, channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('direction, created_at')
    .in('conversation_id', conversationIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  return aggregateMessagesByDate(messages || []);
};

// Get hourly distribution
export const getHourlyStats = async (
  userId: string,
  sessionId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<HourlyStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsForSession(sessionId, channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('direction, created_at')
    .in('conversation_id', conversationIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (msgError) throw msgError;

  return aggregateMessagesByHour(messages || []);
};

// =====================
// CHANNEL-LEVEL STATS (Aggregate all sessions)
// =====================

// Helper function to fetch messages in batches to avoid URL length limits
const fetchMessagesInBatches = async (
  conversationIds: string[],
  startDate: string,
  endDate: string
): Promise<{ direction: string; created_at: string }[]> => {
  const BATCH_SIZE = 50; // Keep batches small to avoid URL length issues
  const allMessages: { direction: string; created_at: string }[] = [];

  for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
    const batchIds = conversationIds.slice(i, i + BATCH_SIZE);
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('direction, created_at')
      .in('conversation_id', batchIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;
    if (messages) {
      allMessages.push(...(messages as { direction: string; created_at: string }[]));
    }
  }

  return allMessages;
};

// Get stats for ALL sessions of a channel type
export const getChannelTypeStats = async (
  userId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<SessionStats> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  // Calculate previous period for comparison
  const daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(dateRange.startDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
  const prevEndDate = new Date(dateRange.startDate);

  const conversationIds = await getConversationIdsByChannelType(channelType);

  if (conversationIds.length === 0) {
    return {
      totalSent: 0,
      totalReceived: 0,
      totalConversations: 0,
      lastMessageAt: null,
      sentChange: 0,
      receivedChange: 0,
      newConversationsInPeriod: 0,
      newConversationsChange: 0
    };
  }

  // Fetch messages in batches
  const currentMessages = await fetchMessagesInBatches(conversationIds, startDate, endDate);
  const prevMessages = await fetchMessagesInBatches(
    conversationIds, 
    prevStartDate.toISOString(), 
    prevEndDate.toISOString()
  );

  const currentSent = currentMessages.filter(m => m.direction === 'outbound').length;
  const currentReceived = currentMessages.filter(m => m.direction === 'inbound').length;
  const prevSent = prevMessages.filter(m => m.direction === 'outbound').length;
  const prevReceived = prevMessages.filter(m => m.direction === 'inbound').length;

  const lastMessage = currentMessages.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const sentChange = prevSent > 0 ? Math.round(((currentSent - prevSent) / prevSent) * 100) : 0;
  const receivedChange = prevReceived > 0 ? Math.round(((currentReceived - prevReceived) / prevReceived) * 100) : 0;

  // Get new conversations in period
  const { count: currentNewConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .in('id', conversationIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { count: prevNewConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .in('id', conversationIds)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', prevEndDate.toISOString());

  const newConversationsChange = (prevNewConvs ?? 0) > 0 
    ? Math.round((((currentNewConvs ?? 0) - (prevNewConvs ?? 0)) / (prevNewConvs ?? 1)) * 100) 
    : 0;

  return {
    totalSent: currentSent,
    totalReceived: currentReceived,
    totalConversations: conversationIds.length,
    lastMessageAt: lastMessage?.created_at || null,
    sentChange,
    receivedChange,
    newConversationsInPeriod: currentNewConvs ?? 0,
    newConversationsChange
  };
};

// Get messages by date for ALL sessions of a channel type
export const getMessagesByDateForChannel = async (
  userId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<DailyMessageStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsByChannelType(channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  // Fetch messages in batches to avoid URL length issues
  const messages = await fetchMessagesInBatches(conversationIds, startDate, endDate);

  return aggregateMessagesByDate(messages);
};

// Get hourly stats for ALL sessions of a channel type
export const getHourlyStatsForChannel = async (
  userId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<HourlyStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsByChannelType(channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  // Fetch messages in batches to avoid URL length issues
  const messages = await fetchMessagesInBatches(conversationIds, startDate, endDate);

  return aggregateMessagesByHour(messages);
};

// Helper function to aggregate messages by date
const aggregateMessagesByDate = (
  messages: { direction: string; created_at: string }[]
): DailyMessageStats[] => {
  const dateMap = new Map<string, { sent: number; received: number }>();

  messages.forEach(msg => {
    const date = new Date(msg.created_at).toISOString().split('T')[0];
    const current = dateMap.get(date) || { sent: 0, received: 0 };
    
    if (msg.direction === 'outbound') {
      current.sent++;
    } else {
      current.received++;
    }
    
    dateMap.set(date, current);
  });

  return Array.from(dateMap.entries())
    .map(([date, stats]) => ({
      date,
      sent: stats.sent,
      received: stats.received,
      total: stats.sent + stats.received
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Helper function to aggregate messages by hour
const aggregateMessagesByHour = (
  messages: { direction: string; created_at: string }[]
): HourlyStats[] => {
  const hourMap = new Map<number, { sent: number; received: number }>();

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourMap.set(i, { sent: 0, received: 0 });
  }

  messages.forEach(msg => {
    const hour = new Date(msg.created_at).getHours();
    const current = hourMap.get(hour)!;
    
    if (msg.direction === 'outbound') {
      current.sent++;
    } else {
      current.received++;
    }
  });

  return Array.from(hourMap.entries())
    .map(([hour, stats]) => ({
      hour,
      sent: stats.sent,
      received: stats.received
    }))
    .sort((a, b) => a.hour - b.hour);
};

// =====================
// NEW CONVERSATIONS BY DAY FUNCTIONS
// =====================

// Helper function to fetch conversations in batches
const fetchConversationsInBatches = async (
  conversationIds: string[],
  startDate: string,
  endDate: string
): Promise<{ id: string; created_at: string }[]> => {
  const BATCH_SIZE = 50;
  const allConversations: { id: string; created_at: string }[] = [];

  for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
    const batchIds = conversationIds.slice(i, i + BATCH_SIZE);
    
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, created_at')
      .in('id', batchIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;
    if (conversations) {
      allConversations.push(...conversations);
    }
  }

  return allConversations;
};

// Helper function to aggregate conversations by date
const aggregateConversationsByDate = (
  conversations: { id: string; created_at: string }[]
): DailyNewConversationsStats[] => {
  const dateMap = new Map<string, number>();

  conversations.forEach(conv => {
    const date = new Date(conv.created_at).toISOString().split('T')[0];
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  return Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Get new conversations by date for a specific session
export const getNewConversationsByDate = async (
  userId: string,
  sessionId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<DailyNewConversationsStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsForSession(sessionId, channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  const conversations = await fetchConversationsInBatches(conversationIds, startDate, endDate);
  return aggregateConversationsByDate(conversations);
};

// Get new conversations by date for ALL sessions of a channel type
export const getNewConversationsByDateForChannel = async (
  userId: string,
  channelType: ChannelType,
  dateRange: DateRange
): Promise<DailyNewConversationsStats[]> => {
  const startDate = dateRange.startDate.toISOString();
  const endDate = dateRange.endDate.toISOString();

  const conversationIds = await getConversationIdsByChannelType(channelType);

  if (conversationIds.length === 0) {
    return [];
  }

  const conversations = await fetchConversationsInBatches(conversationIds, startDate, endDate);
  return aggregateConversationsByDate(conversations);
};
