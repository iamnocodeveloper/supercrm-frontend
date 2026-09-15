import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, HelpCircle, Wifi, Bot, MessageSquare, Send, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SystemStatus {
  id: string;
  component_name: string;
  status: string;
  last_check_at: string;
  error_message: string | null;
  metadata: unknown;
}

const componentIcons: Record<string, React.ReactNode> = {
  'whatsapp-waha': <Wifi className="h-5 w-5" />,
  'telegram-bots': <Bot className="h-5 w-5" />,
  'twilio-sms': <MessageSquare className="h-5 w-5" />,
  'ai-agents': <Bot className="h-5 w-5" />,
  'web-chat': <Globe className="h-5 w-5" />,
  'mass-campaigns': <Send className="h-5 w-5" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  healthy: { label: 'Operativo', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle className="h-4 w-4" /> },
  warning: { label: 'Advertencia', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <AlertTriangle className="h-4 w-4" /> },
  error: { label: 'Error', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="h-4 w-4" /> },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <XCircle className="h-4 w-4" /> },
  unknown: { label: 'Desconocido', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <HelpCircle className="h-4 w-4" /> },
};

export const SystemStatusCards: React.FC = () => {
  const [statuses, setStatuses] = useState<SystemStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_status')
        .select('*')
        .order('component_name');

      if (error) {
        console.error('Error fetching system status:', error);
        return;
      }

      setStatuses(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.unknown;
    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const healthyCount = statuses.filter(s => s.status === 'healthy').length;
  const warningCount = statuses.filter(s => s.status === 'warning').length;
  const errorCount = statuses.filter(s => ['error', 'offline'].includes(s.status)).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Componentes</p>
                <p className="text-2xl font-bold">{statuses.length}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Wifi className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-400">Operativos</p>
                <p className="text-2xl font-bold text-green-400">{healthyCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-400">Advertencias</p>
                <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-400">Errores</p>
                <p className="text-2xl font-bold text-red-400">{errorCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Status Grid */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">Estado de Componentes</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchStatuses} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statuses.map((status) => (
              <Card key={status.id} className="border-border bg-card/50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        {componentIcons[status.component_name] || <Wifi className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{status.component_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(status.metadata as any)?.description || 'Sistema'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(status.status)}
                  </div>
                  
                  {status.error_message && (
                    <div className="mt-3 p-2 bg-red-500/10 rounded text-xs text-red-400">
                      {status.error_message}
                    </div>
                  )}
                  
                  <div className="mt-3 text-xs text-muted-foreground">
                    Última verificación: {format(new Date(status.last_check_at), 'dd/MM HH:mm:ss', { locale: es })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {statuses.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No hay componentes registrados en el sistema
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemStatusCards;
