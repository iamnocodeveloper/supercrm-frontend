import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  MessageSquare, 
  CreditCard, 
  TrendingUp,
  DollarSign,
  Phone,
  Calendar,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalLeads: number;
  totalCampaigns: number;
  activeConnections: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalConversations: 0,
    totalMessages: 0,
    totalLeads: 0,
    totalCampaigns: 0,
    activeConnections: 0,
    monthlyRevenue: 0,
    newUsersThisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total conversations
      const { count: totalConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      // Fetch total messages
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      // Fetch total leads
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      // Fetch total campaigns
      const { count: totalCampaigns } = await supabase
        .from('mass_campaigns')
        .select('*', { count: 'exact', head: true });

      // Fetch active WhatsApp connections
      const { count: activeConnections } = await supabase
        .from('whatsapp_connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'connected');

      // Fetch new users this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newUsersThisMonth } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      setStats({
        totalUsers: totalUsers || 0,
        totalConversations: totalConversations || 0,
        totalMessages: totalMessages || 0,
        totalLeads: totalLeads || 0,
        totalCampaigns: totalCampaigns || 0,
        activeConnections: activeConnections || 0,
        monthlyRevenue: 0, // This would need to be calculated based on subscription data
        newUsersThisMonth: newUsersThisMonth || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Usuarios",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Conversaciones",
      value: stats.totalConversations,
      icon: MessageSquare,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Mensajes",
      value: stats.totalMessages,
      icon: Phone,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Leads",
      value: stats.totalLeads,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      title: "Campañas",
      value: stats.totalCampaigns,
      icon: Calendar,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Conexiones Activas",
      value: stats.activeConnections,
      icon: Activity,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Nuevos Usuarios (Mes)",
      value: stats.newUsersThisMonth,
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    },
    {
      title: "Ingresos Mensuales",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando estadísticas...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Administración</h1>
          <p className="text-gray-600 mt-2">Resumen general del sistema</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-full ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Sistema funcionando correctamente</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">{stats.newUsersThisMonth} nuevos usuarios este mes</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">{stats.activeConnections} conexiones activas</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="font-medium text-gray-900">Gestionar Usuarios</div>
                  <div className="text-sm text-gray-600">Ver y administrar cuentas de usuario</div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="font-medium text-gray-900">Ver Estadísticas</div>
                  <div className="text-sm text-gray-600">Análisis detallado del sistema</div>
                </button>
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="font-medium text-gray-900">Configurar Planes</div>
                  <div className="text-sm text-gray-600">Administrar planes de suscripción</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default AdminDashboard;