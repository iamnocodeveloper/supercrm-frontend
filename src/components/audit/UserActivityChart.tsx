import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Activity, MessageSquare, Clock } from 'lucide-react';

interface UserActivity {
  user_id: string;
  user_email: string;
  action_count: number;
  last_action: string;
}

interface ActionStats {
  action_type: string;
  count: number;
}

interface DailyStats {
  date: string;
  count: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export const UserActivityChart: React.FC = () => {
  const [period, setPeriod] = useState('7');
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [actionStats, setActionStats] = useState<ActionStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [totalActions, setTotalActions] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchActivityData = async () => {
    setLoading(true);
    const daysAgo = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();
    const endDate = endOfDay(new Date()).toISOString();

    try {
      // Fetch audit logs for the period
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('user_id, action_type, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activity data:', error);
        return;
      }

      // Fetch user profiles
      const userIds = [...new Set(logs?.map(l => l.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Calculate user activity
      const userActivityMap = new Map<string, { count: number; lastAction: string }>();
      const actionCountMap = new Map<string, number>();
      const dailyCountMap = new Map<string, number>();

      logs?.forEach(log => {
        // User activity
        const existing = userActivityMap.get(log.user_id) || { count: 0, lastAction: log.created_at };
        userActivityMap.set(log.user_id, {
          count: existing.count + 1,
          lastAction: log.created_at > existing.lastAction ? log.created_at : existing.lastAction
        });

        // Action stats
        actionCountMap.set(log.action_type, (actionCountMap.get(log.action_type) || 0) + 1);

        // Daily stats
        const day = format(new Date(log.created_at), 'dd/MM');
        dailyCountMap.set(day, (dailyCountMap.get(day) || 0) + 1);
      });

      // Convert to arrays
      const userActivityArray: UserActivity[] = Array.from(userActivityMap.entries())
        .map(([userId, data]) => {
          const profile = profileMap.get(userId);
          return {
            user_id: userId,
            user_email: profile?.email || 
                       `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
                       userId.substring(0, 8),
            action_count: data.count,
            last_action: data.lastAction
          };
        })
        .sort((a, b) => b.action_count - a.action_count)
        .slice(0, 10);

      const actionStatsArray: ActionStats[] = Array.from(actionCountMap.entries())
        .map(([action_type, count]) => ({ action_type, count }))
        .sort((a, b) => b.count - a.count);

      const dailyStatsArray: DailyStats[] = Array.from(dailyCountMap.entries())
        .map(([date, count]) => ({ date, count }))
        .reverse();

      setUserActivity(userActivityArray);
      setActionStats(actionStatsArray);
      setDailyStats(dailyStatsArray);
      setTotalActions(logs?.length || 0);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityData();
  }, [period]);

  const actionLabels: Record<string, string> = {
    message_sent: 'Mensajes',
    login: 'Logins',
    campaign_sent: 'Campañas',
    lead_created: 'Leads',
    ai_agent_created: 'Agentes IA',
    settings_updated: 'Config.',
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Actividad de Usuarios</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <Clock className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24 horas</SelectItem>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Acciones</p>
                <p className="text-2xl font-bold">{totalActions.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuarios Activos</p>
                <p className="text-2xl font-bold">{userActivity.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promedio/Día</p>
                <p className="text-2xl font-bold">
                  {dailyStats.length > 0 
                    ? Math.round(totalActions / dailyStats.length).toLocaleString()
                    : 0}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Actividad Diaria</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Distribution */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Distribución de Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            {actionStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={actionStats.slice(0, 6)}
                    dataKey="count"
                    nameKey="action_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ action_type }) => actionLabels[action_type] || action_type}
                  >
                    {actionStats.slice(0, 6).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Users Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Usuarios Más Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userActivity.map((user, index) => (
              <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{user.user_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Última actividad: {format(new Date(user.last_action), 'dd/MM HH:mm', { locale: es })}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {user.action_count} acciones
                </Badge>
              </div>
            ))}

            {userActivity.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay actividad de usuarios en este período
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserActivityChart;
