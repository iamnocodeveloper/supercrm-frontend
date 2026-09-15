import { supabase } from '@/integrations/supabase/client';

export interface UnifiedAISettings {
  id: number;
  user_id: string;
  is_enabled: boolean;
  system_prompt: string;
  cashier_numbers: string;
  cbu: string;
  casino_link: string;
  model: string;
  max_tokens: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SessionAIStatus {
  id: string;
  name: string;
  channel_type: 'whatsapp' | 'telegram' | 'twilio' | 'webchat';
  ai_enabled: boolean;
  phone_number?: string;
  status?: string;
}

// El prompt del asistente vive server-side (Edge Functions); el cliente no lo porta.
const DEFAULT_PROMPT = '';

export const unifiedAIService = {
  async getSettings(userId: string): Promise<UnifiedAISettings | null> {
    // First try webchat_ai_settings (unified settings)
    const { data, error } = await supabase
      .from('webchat_ai_settings' as any)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching unified AI settings:', error);
      throw error;
    }
    return data as unknown as UnifiedAISettings;
  },

  async saveSettings(settings: Partial<UnifiedAISettings> & { user_id: string }): Promise<UnifiedAISettings> {
    const payload = {
      user_id: settings.user_id,
      is_enabled: settings.is_enabled ?? false,
      system_prompt: settings.system_prompt || DEFAULT_PROMPT,
      cashier_numbers: settings.cashier_numbers || '',
      cbu: settings.cbu || '',
      casino_link: settings.casino_link || 'https://bet32.fun/',
      model: settings.model || 'google/gemini-2.5-flash',
      max_tokens: settings.max_tokens || 500,
      updated_at: new Date().toISOString(),
    };

    // Try update first
    const { data: existing } = await supabase
      .from('webchat_ai_settings' as any)
      .select('id')
      .eq('user_id', settings.user_id)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('webchat_ai_settings' as any)
        .update(payload)
        .eq('user_id', settings.user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating unified AI settings:', error);
        throw error;
      }
      return data as unknown as UnifiedAISettings;
    }

    // Insert new
    const { data, error } = await supabase
      .from('webchat_ai_settings' as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error inserting unified AI settings:', error);
      throw error;
    }
    return data as unknown as UnifiedAISettings;
  },

  async getAllSessions(userId: string): Promise<SessionAIStatus[]> {
    const sessions: SessionAIStatus[] = [];

    // Fetch WhatsApp connections
    const { data: whatsappConnections } = await supabase
      .from('whatsapp_connections')
      .select('id, name, phone_number, status, ai_enabled')
      .eq('user_id', userId);

    if (whatsappConnections) {
      for (const conn of whatsappConnections) {
        sessions.push({
          id: conn.id,
          name: conn.name || 'WhatsApp',
          channel_type: 'whatsapp',
          ai_enabled: conn.ai_enabled ?? false,
          phone_number: conn.phone_number,
          status: conn.status,
        });
      }
    }

    // Fetch Telegram bots
    const { data: telegramBots } = await supabase
      .from('telegram_bots')
      .select('id, bot_name, bot_username, status, ai_enabled')
      .eq('user_id', userId);

    if (telegramBots) {
      for (const bot of telegramBots) {
        sessions.push({
          id: bot.id,
          name: bot.bot_name || bot.bot_username || 'Telegram Bot',
          channel_type: 'telegram',
          ai_enabled: bot.ai_enabled ?? false,
          phone_number: bot.bot_username ? `@${bot.bot_username}` : undefined,
          status: bot.status,
        });
      }
    }

    // Fetch Twilio connections
    const { data: twilioConnections } = await supabase
      .from('twilio_connections')
      .select('id, connection_name, phone_number, status, ai_enabled')
      .eq('user_id', userId);

    if (twilioConnections) {
      for (const conn of twilioConnections) {
        sessions.push({
          id: conn.id,
          name: conn.connection_name || 'Twilio',
          channel_type: 'twilio',
          ai_enabled: conn.ai_enabled ?? false,
          phone_number: conn.phone_number,
          status: conn.status,
        });
      }
    }

    // Fetch Web chatbots
    const { data: webChatbots } = await supabase
      .from('web_chatbots')
      .select('id, name, ai_enabled')
      .eq('user_id', userId);

    if (webChatbots) {
      for (const chatbot of webChatbots) {
        sessions.push({
          id: chatbot.id,
          name: chatbot.name || 'Web Chat',
          channel_type: 'webchat',
          ai_enabled: chatbot.ai_enabled ?? false,
          status: 'active',
        });
      }
    }

    return sessions;
  },

  async toggleSessionAI(sessionId: string, channelType: string, enabled: boolean): Promise<void> {
    let table: string;
    
    switch (channelType) {
      case 'whatsapp':
        table = 'whatsapp_connections';
        break;
      case 'telegram':
        table = 'telegram_bots';
        break;
      case 'twilio':
        table = 'twilio_connections';
        break;
      case 'webchat':
        table = 'web_chatbots';
        break;
      default:
        throw new Error(`Unknown channel type: ${channelType}`);
    }

    const { error } = await supabase
      .from(table as any)
      .update({ ai_enabled: enabled })
      .eq('id', sessionId);

    if (error) {
      console.error(`Error toggling AI for ${channelType}:`, error);
      throw error;
    }
  },

  getDefaultPrompt(): string {
    return DEFAULT_PROMPT;
  }
};
