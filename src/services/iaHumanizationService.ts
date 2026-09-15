import { supabase } from '@/integrations/supabase/client';

export interface IAHumanizationSettings {
  id: number;
  min_response_delay_ms: number;
  max_response_delay_ms: number;
  enable_typing_indicator: boolean;
  enable_response_variation: boolean;
  emoji_frequency: number;
  combine_multiple_messages: boolean;
  delay_between_messages_ms: number;
  ai_temperature: number;
  max_responses_per_minute: number;
  created_at?: string;
  updated_at?: string;
}

export const iaHumanizationService = {
  async getSettings(): Promise<IAHumanizationSettings | null> {
    const { data, error } = await supabase
      .from('ia_humanization_settings' as any)
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching humanization settings:', error);
      throw error;
    }
    return data as unknown as IAHumanizationSettings;
  },

  async saveSettings(settings: Partial<IAHumanizationSettings>): Promise<IAHumanizationSettings> {
    const payload = {
      id: 1,
      ...settings,
      updated_at: new Date().toISOString(),
    };

    // Intentar UPDATE primero
    const updateRes = await supabase
      .from('ia_humanization_settings' as any)
      .update(payload)
      .eq('id', 1)
      .select()
      .single();

    if (!updateRes.error && updateRes.data) {
      return updateRes.data as unknown as IAHumanizationSettings;
    }

    // Si no existe, hacer upsert
    const { data, error } = await supabase
      .from('ia_humanization_settings' as any)
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving humanization settings:', error);
      throw error;
    }
    return data as unknown as IAHumanizationSettings;
  },

  getDefaultSettings(): IAHumanizationSettings {
    return {
      id: 1,
      min_response_delay_ms: 2000,
      max_response_delay_ms: 6000,
      enable_typing_indicator: true,
      enable_response_variation: true,
      emoji_frequency: 50,
      combine_multiple_messages: true,
      delay_between_messages_ms: 1500,
      ai_temperature: 0.75,
      max_responses_per_minute: 10,
    };
  }
};
