import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useWebchatStats } from '@/hooks/useWebchatStats';
import { Users, UserCheck, Receipt, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const WebchatConversionStats = () => {
  const { stats, createdUsers, dailyStats, loading, refetch } = useWebchatStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Chats</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalConversations}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cuentas Creadas</p>
                <p className="text-2xl font-bold text-foreground">{stats.casinoUsersCreated}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa Conversión</p>
                <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comprobantes</p>
                <p className="text-2xl font-bold text-foreground">{stats.paymentReceiptsSent}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa Pagos</p>
                <p className="text-2xl font-bold text-foreground">{stats.receiptRate.toFixed(1)}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-teal-500/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-teal-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Actividad últimos 14 días</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: es })}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelFormatter={(value) => format(new Date(value), "dd 'de' MMMM", { locale: es })}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="conversations" 
                  name="Conversaciones"
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.2}
                />
                <Area 
                  type="monotone" 
                  dataKey="users_created" 
                  name="Cuentas creadas"
                  stroke="#22c55e" 
                  fill="#22c55e" 
                  fillOpacity={0.2}
                />
                <Area 
                  type="monotone" 
                  dataKey="receipts" 
                  name="Comprobantes"
                  stroke="#f59e0b" 
                  fill="#f59e0b" 
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Created Users Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Usuarios Casino Creados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Username</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Comprobante</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {createdUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      No hay usuarios creados aún
                    </td>
                  </tr>
                ) : (
                  createdUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3 text-sm text-foreground">
                        {user.created_at ? format(new Date(user.created_at), 'dd/MM/yy HH:mm', { locale: es }) : '-'}
                      </td>
                      <td className="p-3 text-sm font-mono text-foreground">
                        {user.casino_username || 'N/A'}
                      </td>
                      <td className="p-3 text-sm text-foreground">
                        {user.contact_name || 'Visitante'}
                      </td>
                      <td className="p-3">
                        {user.payment_receipt_sent ? (
                          <Badge variant="default" className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                            ✅ Sí
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">
                            ⏳ No
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {user.payment_receipt_sent ? (
                          <Badge variant="default" className="bg-primary/20 text-primary">
                            Listo para cajero
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Pendiente pago
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
