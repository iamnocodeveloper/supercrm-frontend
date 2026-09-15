import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';

export const useBotBlockMap = (phones: string[]) => {
  const { effectiveUserId, loading } = useEffectiveUserId();
  const { toast } = useToast();
  const [blockedPhones, setBlockedPhones] = useState<Set<string>>(new Set());
  const [loadingPhones, setLoadingPhones] = useState<Set<string>>(new Set());

  const uniquePhones = useMemo(
    () => Array.from(new Set(phones.filter(Boolean))).slice(0, 300),
    [phones.join('|')]
  );

  useEffect(() => {
    if (!effectiveUserId || loading || uniquePhones.length === 0) {
      setBlockedPhones(new Set());
      return;
    }

    let cancelled = false;

    const loadBlockedPhones = async () => {
      const { data, error } = await supabase
        .from('contacto_bloqueado_bot')
        .select('numero')
        .eq('user_id', effectiveUserId)
        .in('numero', uniquePhones);

      if (cancelled) return;

      if (error) {
        console.error('Error loading bot block map:', error);
        return;
      }

      setBlockedPhones(new Set((data || []).map(item => item.numero)));
    };

    loadBlockedPhones();

    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, loading, uniquePhones]);

  const toggleBotBlock = useCallback(async (numero: string, pushname?: string | null) => {
    if (!effectiveUserId || !numero) return;

    const currentlyBlocked = blockedPhones.has(numero);
    setLoadingPhones(prev => new Set(prev).add(numero));

    try {
      if (currentlyBlocked) {
        const { error } = await supabase
          .from('contacto_bloqueado_bot')
          .delete()
          .eq('user_id', effectiveUserId)
          .eq('numero', numero);

        if (error) throw error;
        setBlockedPhones(prev => {
          const next = new Set(prev);
          next.delete(numero);
          return next;
        });
        toast({ title: 'Bot activado', description: 'El bot responderá a este contacto' });
      } else {
        const { error } = await supabase
          .from('contacto_bloqueado_bot')
          .insert({ user_id: effectiveUserId, numero, pushname });

        if (error) throw error;
        setBlockedPhones(prev => new Set(prev).add(numero));
        toast({ title: 'Bot desactivado', description: 'El bot no responderá a este contacto' });
      }
    } catch (error) {
      console.error('Error toggling bot block:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del bot',
        variant: 'destructive',
      });
    } finally {
      setLoadingPhones(prev => {
        const next = new Set(prev);
        next.delete(numero);
        return next;
      });
    }
  }, [blockedPhones, effectiveUserId, toast]);

  return {
    isBlocked: useCallback((numero?: string | null) => Boolean(numero && blockedPhones.has(numero)), [blockedPhones]),
    isLoading: useCallback((numero?: string | null) => Boolean(numero && loadingPhones.has(numero)), [loadingPhones]),
    toggleBotBlock,
  };
};
