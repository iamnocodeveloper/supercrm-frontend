import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAIUsageStats } from '@/hooks/useAIUsageStats';
import { Bot, DollarSign, TrendingUp, Activity, Phone, Globe, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface AIUsageStatsProps {
  userId: string | null;
}

const channelColors = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  twilio: '#F22F46',
  webchat: '#8B5CF6',
};

const channelLabels = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  twilio: 'Twilio',
  webchat: 'WebChat',
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}> = ({ title, value, subtitle, icon }) => (
  <Card className="bg-card">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const ChannelBar: React.FC<{
  channel: string;
  count: number;
  total: number;
  color: string;
}> = ({ channel, count, total, color }) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-2">
          {channel === 'whatsapp' && <Phone className="h-3 w-3" style={{ color }} />}
          {channel === 'telegram' && <Bot className="h-3 w-3" style={{ color }} />}
          {channel === 'twilio' && <Phone className="h-3 w-3" style={{ color }} />}
          {channel === 'webchat' && <Globe className="h-3 w-3" style={{ color }} />}
          {channelLabels[channel as keyof typeof channelLabels]}
        </span>
        <span className="text-muted-foreground">{count} ({percentage}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium mb-2">{formatDate(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{channelLabels[entry.dataKey as keyof typeof channelLabels] || entry.dataKey}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AIUsageStats: React.FC<AIUsageStatsProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [period, setPeriod] = useState(30);
  const { stats, loading, error } = useAIUsageStats(userId, period);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const totalChannelMessages = Object.values(stats.byChannel).reduce((a, b) => a + b, 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Estadísticas de Uso de IA
              </CardTitle>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Period Selector */}
            <div className="flex gap-2">
              {[7, 30, 90].map(p => (
                <Button
                  key={p}
                  variant={period === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriod(p)}
                >
                  {p} días
                </Button>
              ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Respuestas IA"
                value={stats.totalResponses.toLocaleString()}
                subtitle={`Últimos ${period} días`}
                icon={<Bot className="h-5 w-5 text-primary" />}
              />
              <StatCard
                title="Costo Estimado"
                value={`$${stats.estimatedCost.toFixed(2)}`}
                subtitle="USD"
                icon={<DollarSign className="h-5 w-5 text-green-500" />}
              />
              <StatCard
                title="Promedio/Día"
                value={stats.avgPerDay}
                subtitle="mensajes"
                icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
              />
              <StatCard
                title="Costo/Mensaje"
                value={`$${stats.costPerMessage.toFixed(5)}`}
                subtitle="USD"
                icon={<Activity className="h-5 w-5 text-purple-500" />}
              />
            </div>

            {/* Channel Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Uso por Canal</h4>
              <div className="space-y-3">
                {Object.entries(stats.byChannel).map(([channel, count]) => (
                  <ChannelBar
                    key={channel}
                    channel={channel}
                    count={count}
                    total={totalChannelMessages}
                    color={channelColors[channel as keyof typeof channelColors]}
                  />
                ))}
              </div>
            </div>

            {/* Usage Chart */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Uso de IA - Últimos {period} días</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="webchat"
                      name="WebChat"
                      stackId="1"
                      stroke={channelColors.webchat}
                      fill={channelColors.webchat}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="whatsapp"
                      name="WhatsApp"
                      stackId="1"
                      stroke={channelColors.whatsapp}
                      fill={channelColors.whatsapp}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="telegram"
                      name="Telegram"
                      stackId="1"
                      stroke={channelColors.telegram}
                      fill={channelColors.telegram}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="twilio"
                      name="Twilio"
                      stackId="1"
                      stroke={channelColors.twilio}
                      fill={channelColors.twilio}
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost Projection */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Proyección de Costos</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold">${(stats.avgPerDay * 30 * stats.costPerMessage).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Mensual Est.</p>
                </div>
                <div>
                  <p className="text-lg font-bold">${(stats.avgPerDay * 365 * stats.costPerMessage).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Anual Est.</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{Math.round(1 / stats.costPerMessage).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Msgs por $1 USD</p>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default AIUsageStats;
