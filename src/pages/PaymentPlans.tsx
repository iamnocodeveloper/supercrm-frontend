import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  CheckCircle,
  Star,
  Zap,
  Users,
  MessageSquare,
  Phone,
  Bot,
  HardDrive,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';

type PaymentPlan = Database['public']['Tables']['payment_plans']['Row'];
type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];

/**
 * Catálogo de planes (solo lectura).
 *
 * NOTA: la pasarela de pago (MercadoPago) fue removida del sistema el 2026-09-10.
 * Este catálogo NO procesa pagos: la activación de un plan se gestiona con el
 * administrador. Ver docs/CAMBIOS.md (T3) y docs/ROLLBACK.md para revertir.
 */
type PlanLimits = {
  max_whatsapp_connections?: number;
  max_contacts?: number;
  max_conversations?: number;
  max_monthly_campaigns?: number;
  max_bot_responses?: number;
  max_storage_mb?: number;
};

const PaymentPlans = () => {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPlansAndSubscription();
    }
  }, [user]);

  const fetchPlansAndSubscription = async () => {
    try {
      setLoading(true);

      const { data: plansData, error: plansError } = await supabase
        .from('payment_plans')
        .select('id, name, description, price, limits, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansError) throw plansError;

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, plan_id, status, started_at, expires_at')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        throw subscriptionError;
      }

      setPlans((plansData as unknown as PaymentPlan[]) || []);
      setCurrentSubscription((subscriptionData as unknown as UserSubscription) || null);
    } catch (error: unknown) {
      console.error('Error fetching plans:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los planes de pago",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestActivation = (plan: PaymentPlan) => {
    toast({
      title: "Activación de plan",
      description: `Para activar el plan ${plan.name}, contactá al administrador.`,
    });
  };

  const getPlanFeatures = (plan: PaymentPlan) => {
    const limits = (plan.limits as unknown as PlanLimits) || {};
    return [
      {
        icon: Phone,
        label: 'Conexiones WhatsApp',
        value: limits.max_whatsapp_connections || 0
      },
      {
        icon: Users,
        label: 'Contactos',
        value: (limits.max_contacts || 0).toLocaleString()
      },
      {
        icon: MessageSquare,
        label: 'Conversaciones',
        value: limits.max_conversations?.toLocaleString() || 'Ilimitadas'
      },
      {
        icon: Calendar,
        label: 'Campañas por mes',
        value: limits.max_monthly_campaigns || 0
      },
      {
        icon: Bot,
        label: 'Respuestas Bot',
        value: (limits.max_bot_responses || 0).toLocaleString()
      },
      {
        icon: HardDrive,
        label: 'Almacenamiento',
        value: `${((limits.max_storage_mb || 0) / 1024).toFixed(1)} GB`
      }
    ];
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan_id === planId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando planes de pago...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold flex items-center justify-center">
          <CreditCard className="mr-3 h-8 w-8" />
          Planes de Pago
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Catálogo de planes disponibles. La activación se gestiona con el administrador.
        </p>

        {currentSubscription && (
          <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Plan actual activo</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const features = getPlanFeatures(plan);
          const isCurrent = isCurrentPlan(plan.id);

          return (
            <Card key={plan.id} className={`relative ${isCurrent ? 'border-primary shadow-lg' : ''}`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="w-3 h-3 mr-1" />
                    Plan Actual
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="flex items-baseline justify-center space-x-1">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                {plan.description && (
                  <p className="text-muted-foreground text-sm mt-2">{plan.description}</p>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <feature.icon className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm flex-1">{feature.label}</span>
                      <span className="text-sm font-medium">{feature.value}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  {isCurrent ? (
                    <Button className="w-full" disabled>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Plan Activo
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={currentSubscription ? "outline" : "default"}
                      onClick={() => handleRequestActivation(plan)}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {currentSubscription ? 'Cambiar Plan' : 'Solicitar activación'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No hay planes disponibles
          </h3>
          <p className="text-muted-foreground">
            Actualmente no hay planes de pago disponibles. Contacta al administrador.
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentPlans;
