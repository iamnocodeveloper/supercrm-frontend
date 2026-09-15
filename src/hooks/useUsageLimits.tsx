import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type SubscriptionPlan = Database['public']['Tables']['payment_plans']['Row'];
type UserUsage = Database['public']['Tables']['user_usage']['Row'];
type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];

interface UsageLimits {
  plan: SubscriptionPlan | null;
  usage: UserUsage | null;
  subscription: UserSubscription | null;
  loading: boolean;
  error: string | null;
}

interface LimitCheck {
  allowed: boolean;
  usage: number;
  limit: number;
  percentage: number;
  message?: string;
}

export const useUsageLimits = () => {
  const [limitsData, setLimitsData] = useState<UsageLimits>({
    plan: null,
    usage: null,
    subscription: null,
    loading: true,
    error: null
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchUsageLimits();
    }
  }, [user]);

  const fetchUsageLimits = async () => {
    if (!user) return;

    try {
      setLimitsData(prev => ({ ...prev, loading: true, error: null }));

      // Obtener suscripción activa del usuario
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          payment_plans(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subError) throw subError;

      // Obtener uso actual del mes
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const { data: usage, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('usage_month', currentMonth)
        .maybeSingle();

      if (usageError && usageError.code !== 'PGRST116') {
        throw usageError;
      }

      setLimitsData({
        plan: subscription?.payment_plans || null,
        usage: usage || null,
        subscription: subscription || null,
        loading: false,
        error: null
      });
    } catch (error: any) {
      console.error('Error fetching usage limits:', error);
      setLimitsData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Error al cargar límites de uso'
      }));
    }
  };

  const checkLimit = (resourceType: keyof UserUsage, requestedAmount: number = 1): LimitCheck => {
    // LÍMITES DESACTIVADOS - Siempre permitir acceso
    return {
      allowed: true,
      usage: 0,
      limit: 999999,
      percentage: 0,
      message: undefined
    };
  };

  const checkUsageLimit = async (resourceType: string, requestedAmount: number = 1): Promise<boolean> => {
    // LÍMITES DESACTIVADOS - Siempre permitir
    return true;
  };

  const incrementUsage = async (resourceType: string, amount: number = 1): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .rpc('increment_usage', {
          p_user_id: user.id,
          p_resource_type: resourceType,
          p_amount: amount
        });

      if (error) throw error;
      
      // Refrescar datos después de incrementar
      await fetchUsageLimits();
      return data;
    } catch (error: any) {
      console.error('Error incrementing usage:', error);
      return false;
    }
  };

  const showLimitWarning = (check: LimitCheck) => {
    if (check.message) {
      toast({
        title: !check.allowed ? "Límite alcanzado" : "Advertencia de límite",
        description: check.message,
        variant: !check.allowed ? "destructive" : "default",
      });
    }
  };

  const enforceLimit = async (resourceType: string, requestedAmount: number = 1): Promise<boolean> => {
    // LÍMITES DESACTIVADOS - Siempre permitir
    return true;
  };

  const getUsagePercentage = (resourceType: keyof UserUsage): number => {
    const check = checkLimit(resourceType, 0);
    return check.percentage;
  };

  const isNearLimit = (resourceType: keyof UserUsage, threshold: number = 80): boolean => {
    const percentage = getUsagePercentage(resourceType);
    return percentage >= threshold;
  };

  const hasActivePlan = (): boolean => {
    // LÍMITES DESACTIVADOS - Siempre retornar true
    return true;
  };

  return {
    ...limitsData,
    checkLimit,
    checkUsageLimit,
    incrementUsage,
    showLimitWarning,
    enforceLimit,
    getUsagePercentage,
    isNearLimit,
    hasActivePlan,
    refetch: fetchUsageLimits
  };
};