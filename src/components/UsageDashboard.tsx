import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Users, 
  MessageSquare, 
  Calendar, 
  Bot, 
  HardDrive, 
  Zap,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { useUsageLimits } from '@/hooks/useUsageLimits';

const UsageDashboard = () => {
  const { plan, usage, loading, hasActivePlan } = useUsageLimits();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded mb-2"></div>
              <div className="h-2 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasActivePlan()) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <div>
                <h3 className="font-medium">Sin Plan Activo</h3>
                <p className="text-sm text-muted-foreground">
                  Necesitas activar un plan para usar las funcionalidades
                </p>
              </div>
            </div>
            <Button asChild>
              <a href="/planes-pago">
                <CreditCard className="h-4 w-4 mr-2" />
                Ver Planes
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!plan || !usage) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            No se pudo cargar la información de uso
          </p>
        </CardContent>
      </Card>
    );
  }

  const planLimits = plan.limits as any || {};

  const usageItems = [
    {
      title: 'Conexiones WhatsApp',
      icon: Phone,
      current: usage.whatsapp_connections_used,
      limit: planLimits.max_whatsapp_connections || 0,
      color: 'blue'
    },
    {
      title: 'Contactos',
      icon: Users,
      current: usage.contacts_used,
      limit: planLimits.max_contacts || 0,
      color: 'green'
    },
    {
      title: 'Conversaciones',
      icon: MessageSquare,
      current: usage.conversations_used,
      limit: planLimits.max_conversations || 100,
      color: 'purple'
    },
    {
      title: 'Campañas (Este Mes)',
      icon: Calendar,
      current: usage.campaigns_this_month,
      limit: planLimits.max_monthly_campaigns || 0,
      color: 'orange'
    },
    {
      title: 'Respuestas Bot (Este Mes)',
      icon: Bot,
      current: usage.bot_responses_this_month,
      limit: planLimits.max_bot_responses || 0,
      color: 'indigo'
    },
    {
      title: 'Almacenamiento',
      icon: HardDrive,
      current: usage.storage_used_mb,
      limit: planLimits.max_storage_mb || 0,
      color: 'red',
      formatter: (value: number) => `${(value / 1024).toFixed(1)} GB`
    }
  ];

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'destructive';
    if (percentage >= 90) return 'secondary';
    if (percentage >= 70) return 'outline';
    return 'default';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Uso del Plan</h2>
          <p className="text-muted-foreground">
            Plan actual: <strong>{plan.name}</strong>
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/planes-pago">
            <Zap className="h-4 w-4 mr-2" />
            Cambiar Plan
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usageItems.map((item) => {
          const percentage = Math.round((item.current / item.limit) * 100);
          const isNearLimit = percentage >= 70;
          
          return (
            <Card key={item.title} className={isNearLimit ? 'border-orange-200' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  <Badge variant={getStatusColor(percentage)}>
                    {percentage}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {item.formatter 
                        ? item.formatter(item.current) 
                        : item.current.toLocaleString()
                      }
                    </span>
                    <span className="text-muted-foreground">
                      / {item.formatter 
                        ? item.formatter(item.limit) 
                        : item.limit.toLocaleString()
                      }
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(percentage, 100)} 
                    className="h-2"
                  />
                  {percentage >= 90 && (
                    <p className="text-xs text-orange-600">
                      ⚠️ Cerca del límite
                    </p>
                  )}
                  {percentage >= 100 && (
                    <p className="text-xs text-red-600">
                      🚫 Límite alcanzado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default UsageDashboard;