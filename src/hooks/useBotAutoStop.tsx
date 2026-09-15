import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';

export const useBotAutoStop = () => {
  const { effectiveUserId, loading: effectiveUserIdLoading } = useEffectiveUserId();
  const { toast } = useToast();
  const [autoStopEnabled, setAutoStopEnabled] = useState(true);
  const [botEnabled, setBotEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (effectiveUserId && !effectiveUserIdLoading) {
      fetchSettings();
    }
  }, [effectiveUserId, effectiveUserIdLoading]);

  const fetchSettings = async () => {
    if (!effectiveUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_bot_settings')
        .select('auto_stop_on_human_reply, bot_enabled')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setAutoStopEnabled(data.auto_stop_on_human_reply ?? true);
        setBotEnabled(data.bot_enabled);
      } else {
        // Si no existe, crear configuración por defecto
        await createDefaultSettings();
      }
    } catch (error) {
      console.error('Error fetching bot settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!effectiveUserId) return;

    try {
      const { data, error } = await supabase
        .from('user_bot_settings')
        .insert({
          user_id: effectiveUserId,
          auto_stop_on_human_reply: true,
          bot_enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      setAutoStopEnabled(data.auto_stop_on_human_reply ?? true);
      setBotEnabled(data.bot_enabled);
    } catch (error) {
      console.error('Error creating default bot settings:', error);
    }
  };

  const toggleAutoStop = async () => {
    if (!effectiveUserId) return;

    const newValue = !autoStopEnabled;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('user_bot_settings')
        .upsert({
          user_id: effectiveUserId,
          auto_stop_on_human_reply: newValue,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setAutoStopEnabled(newValue);
      toast({
        title: newValue ? 'Auto-detención activada' : 'Auto-detención desactivada',
        description: newValue 
          ? 'El bot se detendrá automáticamente cuando respondas en una conversación'
          : 'El bot seguirá respondiendo aunque escribas en la conversación',
      });
    } catch (error) {
      console.error('Error toggling bot auto-stop:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la configuración',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBotEnabled = async () => {
    if (!effectiveUserId) return;

    const newValue = !botEnabled;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('user_bot_settings')
        .upsert({
          user_id: effectiveUserId,
          bot_enabled: newValue,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setBotEnabled(newValue);
      toast({
        title: newValue ? 'Bot activado' : 'Bot desactivado',
        description: newValue 
          ? 'El bot responderá automáticamente en los chats'
          : 'El bot no responderá en los chats',
      });
    } catch (error) {
      console.error('Error toggling bot enabled:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la configuración',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    autoStopEnabled,
    botEnabled,
    isLoading,
    toggleAutoStop,
    toggleBotEnabled,
  };
};
