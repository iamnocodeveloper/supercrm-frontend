import React, { useState, useMemo, memo } from 'react';
import { 
  Users, 
  MessageSquare, 
  Target,
  Send,
  ArrowDown,
  ArrowUp,
  Clock,
  AlertTriangle,
  TrendingDown,
  WalletCards
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsumptionAlertsPanel } from '@/components/dashboard/ConsumptionAlertsPanel';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year'>('today');
  const { stats, recentLeads, activeConversations, messagesByHour, conversationsByHour, heatmapData, profitabilityStats, consumptionAlertHistory, markConsumptionAlertRead, consumptionAlertsLoading, isLoading } = useDashboard(selectedPeriod);

  const periodMap: { [key: string]: 'today' | 'yesterday' | 'week' | 'month' | 'year' } = {
    'Hoy': 'today',
    'Ayer': 'yesterday',
    'Semana': 'week',
    'Mes': 'month',
    'Año': 'year'
  };

  // Memoize chart data transformations
  const chartData = useMemo(() => conversationsByHour.map(item => ({
    time: item.hour,
    nuevos: item.new,
    recurrentes: item.recurring,
    totales: item.total
  })), [conversationsByHour]);

  const barData = useMemo(() => messagesByHour.map(item => ({
    time: item.hour,
    recibidos: item.incoming,
    enviados: item.outgoing
  })), [messagesByHour]);

  // Procesar datos del heatmap
  const maxHeatmapValue = useMemo(() => Math.max(...heatmapData.map(d => d.value), 1), [heatmapData]);
  
  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = value / maxHeatmapValue;
    if (intensity < 0.25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (intensity < 0.5) return 'bg-emerald-400 dark:bg-emerald-700';
    if (intensity < 0.75) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('nuevo')) return 'bg-blue-500 hover:bg-blue-600';
    if (statusLower.includes('contactado') || statusLower.includes('en proceso')) return 'bg-yellow-500 hover:bg-yellow-600';
    if (statusLower.includes('calificado') || statusLower.includes('interesado')) return 'bg-green-500 hover:bg-green-600';
    if (statusLower.includes('propuesta') || statusLower.includes('negociacion')) return 'bg-purple-500 hover:bg-purple-600';
    if (statusLower.includes('ganado') || statusLower.includes('cerrado')) return 'bg-emerald-500 hover:bg-emerald-600';
    return 'bg-gray-500 hover:bg-gray-600';
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: es 
      });
    } catch {
      return 'hace poco';
    }
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'Sin teléfono';
    return phone.startsWith('+') ? phone : `+${phone}`;
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-32">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-2">
          {Object.keys(periodMap).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === periodMap[period] ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(periodMap[period])}
              className="h-8"
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-teal-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Clientes Activos Totales (chats)</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold">{stats.activeConversations}</h2>
                  <span className="text-sm text-red-500 flex items-center">
                    <ArrowDown className="h-3 w-3 mr-1" />
                    60%
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-teal-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Total de Mensajes (Enviados + Recibidos)</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold">{stats.totalMessages}</h2>
                  <span className="text-sm text-red-500 flex items-center">
                    <ArrowDown className="h-3 w-3 mr-1" />
                    64%
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Send className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Total de Mensajes Recibidos</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold">{stats.incomingMessages}</h2>
                  {stats.incomingMessages > 0 && (
                    <span className="text-sm text-green-500 flex items-center">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      {Math.round((stats.incomingMessages / Math.max(stats.totalMessages, 1)) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-purple-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Total de Mensajes Enviados</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold">{stats.outgoingMessages}</h2>
                  {stats.outgoingMessages > 0 && (
                    <span className="text-sm text-green-500 flex items-center">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      {Math.round((stats.outgoingMessages / Math.max(stats.totalMessages, 1)) * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Send className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Resumen Ejecutivo de Costos
            </CardTitle>
            <Badge variant={profitabilityStats.recommendedChannel === 'WhatsApp API' ? 'default' : 'secondary'}>
              Canal recomendado: {profitabilityStats.recommendedChannel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground">Costo externo</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(profitabilityStats.externalCost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Twilio + WhatsApp API</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground">Nuestro Sistema</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(profitabilityStats.internalCost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Costo interno estimado</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-sm text-muted-foreground">Ahorro estimado</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(profitabilityStats.totalSavings)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(profitabilityStats.dailySavings)} por día</p>
            </div>
          </div>

          {profitabilityStats.twilioCost > 150 && (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-foreground">
                Twilio lleva {formatCurrency(profitabilityStats.twilioCost)}. Conviene derivar tráfico a WhatsApp API para sostener una tarifa 30% menor.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Mensajes medidos: {profitabilityStats.totalMessages.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Twilio: {profitabilityStats.twilioMessages.toLocaleString()} · WhatsApp API: {profitabilityStats.whatsappApiMessages.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <WalletCards className="h-4 w-4" /> {profitabilityStats.mostProfitableChannel}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConsumptionAlertsPanel
        alerts={consumptionAlertHistory}
        isLoading={consumptionAlertsLoading}
        onMarkRead={markConsumptionAlertRead}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Conversaciones nuevas hoy</p><p className="mt-2 text-2xl font-bold">{stats.newConversationsToday}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Respondidas humano / IA</p><p className="mt-2 text-2xl font-bold">{stats.humanResponses} / {stats.aiResponses}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Cajeros activos</p><p className="mt-2 text-2xl font-bold text-primary">{stats.activeAgents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Embudo con más actividad</p><p className="mt-2 text-lg font-semibold truncate">{stats.mostActiveFunnel}</p></CardContent></Card>
      </div>

      {/* Charts */}
      <Card className="bg-gradient-to-br from-card to-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Clientes Activos Totales (chats)
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span className="text-sm text-muted-foreground">Nuevos prospectos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-sm text-muted-foreground">Clientes recurrentes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-muted-foreground">Totales</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorNuevos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRecurrentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
              <XAxis dataKey="time" stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="nuevos" 
                stroke="#14b8a6" 
                fill="url(#colorNuevos)" 
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="recurrentes" 
                stroke="#6b7280" 
                fill="url(#colorRecurrentes)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card className="bg-gradient-to-br from-card to-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Clientes Activos Totales (chats)
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span className="text-sm text-muted-foreground">Mensajes Recibidos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-sm text-muted-foreground">Mensajes Enviados</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
              <XAxis dataKey="time" stroke="#888" fontSize={12} />
              <YAxis stroke="#888" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="recibidos" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="enviados" fill="#6b7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Heatmap de Actividad */}
      <Card className="bg-gradient-to-br from-card to-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Mapa de Calor - Actividad por Horario (Últimos 30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header con horas */}
              <div className="flex gap-1 mb-1">
                <div className="w-12 shrink-0" />
                {HOURS.filter((_, i) => i % 2 === 0).map(hour => (
                  <div key={hour} className="flex-1 text-xs text-muted-foreground text-center">
                    {hour}
                  </div>
                ))}
              </div>
              
              {/* Filas por día */}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex gap-1 mb-1">
                  <div className="w-12 shrink-0 text-xs text-muted-foreground flex items-center">
                    {day}
                  </div>
                  <div className="flex-1 flex gap-0.5">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const data = heatmapData.find(d => d.day === dayIndex && d.hour === hour);
                      const value = data?.value || 0;
                      return (
                        <div
                          key={hour}
                          className={`flex-1 h-6 rounded-sm ${getHeatmapColor(value)} transition-colors`}
                          title={`${day} ${String(hour).padStart(2, '0')}:00 - ${value} mensajes`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Leyenda */}
              <div className="flex items-center justify-end gap-2 mt-4">
                <span className="text-xs text-muted-foreground">Menos</span>
                <div className="w-4 h-4 rounded-sm bg-muted" />
                <div className="w-4 h-4 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
                <div className="w-4 h-4 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
                <div className="w-4 h-4 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
                <div className="w-4 h-4 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Más</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Annual Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-teal-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Todo el Año</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-bold">{(stats.yearlyNewProspects ?? 0).toLocaleString()}</h2>
                </div>
                <p className="text-sm text-muted-foreground">Nuevos prospectos</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-teal-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Todo el Año</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-bold">{(stats.yearlyRecurringClients ?? 0).toLocaleString()}</h2>
                </div>
                <p className="text-sm text-muted-foreground">Clientes recurrentes</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Todo el Año</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-bold">{(stats.yearlyTotal ?? 0).toLocaleString()}</h2>
                </div>
                <p className="text-sm text-muted-foreground">Totales</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Target className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads & Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Target className="h-5 w-5 mr-2 text-primary" />
                Leads Recientes
              </span>
              <Button variant="ghost" size="sm">
                Ver todos
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.length > 0 ? recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-foreground">{lead.name}</h4>
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(lead.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{lead.company || 'Sin empresa'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatPhoneNumber(lead.phone)}</p>
                  </div>
                  <Badge className={getStatusColor(lead.column_name)}>
                    {lead.column_name}
                  </Badge>
                </div>
              )) : (
                <div className="text-center py-8">
                  <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No hay leads recientes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-accent" />
                Conversaciones Activas
              </span>
              <Button variant="ghost" size="sm">
                Ver chat
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeConversations.length > 0 ? activeConversations.map((conv) => (
                <div key={conv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-success rounded-full flex items-center justify-center text-white font-medium">
                      {(conv.pushname || conv.whatsapp_number || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground truncate">{conv.pushname || conv.whatsapp_number || 'Contacto'}</h4>
                        <span className="text-xs text-muted-foreground">
                          {conv.last_message_time ? formatTimeAgo(conv.last_message_time) : 'Sin fecha'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || 'Sin mensajes'}
                      </p>
                    </div>
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge className="bg-destructive text-destructive-foreground ml-2">
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              )) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No hay conversaciones activas</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default memo(Dashboard);
