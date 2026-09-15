import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

const actionTypeLabels: Record<string, { label: string; color: string }> = {
  message_sent: { label: 'Mensaje Enviado', color: 'bg-green-500/20 text-green-400' },
  message_deleted: { label: 'Mensaje Eliminado', color: 'bg-red-500/20 text-red-400' },
  login: { label: 'Inicio Sesión', color: 'bg-blue-500/20 text-blue-400' },
  logout: { label: 'Cierre Sesión', color: 'bg-gray-500/20 text-gray-400' },
  config_changed: { label: 'Config. Cambiada', color: 'bg-yellow-500/20 text-yellow-400' },
  ai_agent_created: { label: 'Agente IA Creado', color: 'bg-purple-500/20 text-purple-400' },
  ai_agent_updated: { label: 'Agente IA Actualizado', color: 'bg-purple-500/20 text-purple-400' },
  campaign_sent: { label: 'Campaña Enviada', color: 'bg-orange-500/20 text-orange-400' },
  lead_created: { label: 'Lead Creado', color: 'bg-emerald-500/20 text-emerald-400' },
  lead_moved: { label: 'Lead Movido', color: 'bg-cyan-500/20 text-cyan-400' },
  contact_created: { label: 'Contacto Creado', color: 'bg-indigo-500/20 text-indigo-400' },
  settings_updated: { label: 'Config. Actualizada', color: 'bg-amber-500/20 text-amber-400' },
};

export const AuditLogTable: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        return;
      }

      // Fetch user emails for each log
      const userIds = [...new Set(data?.map(log => log.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const logsWithEmails = (data || []).map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id)?.email || 
                    `${profileMap.get(log.user_id)?.first_name || ''} ${profileMap.get(log.user_id)?.last_name || ''}`.trim() ||
                    log.user_id.substring(0, 8)
      }));

      setLogs(logsWithEmails);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user?.id, actionFilter, limit]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(search) ||
      log.entity_type?.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      JSON.stringify(log.details).toLowerCase().includes(search)
    );
  });

  const exportToCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'Detalles'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.user_email || '',
      log.action_type,
      log.entity_type || '',
      log.entity_id || '',
      JSON.stringify(log.details || {})
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getActionBadge = (actionType: string) => {
    const config = actionTypeLabels[actionType] || { label: actionType, color: 'bg-gray-500/20 text-gray-400' };
    return <Badge className={`${config.color} border-0`}>{config.label}</Badge>;
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="text-xl">Logs de Auditoría</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="message_sent">Mensajes enviados</SelectItem>
              <SelectItem value="login">Inicios de sesión</SelectItem>
              <SelectItem value="campaign_sent">Campañas</SelectItem>
              <SelectItem value="ai_agent_created">Agentes IA</SelectItem>
              <SelectItem value="lead_created">Leads</SelectItem>
              <SelectItem value="settings_updated">Configuración</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 registros</SelectItem>
              <SelectItem value="100">100 registros</SelectItem>
              <SelectItem value="200">200 registros</SelectItem>
              <SelectItem value="500">500 registros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px]">Fecha/Hora</TableHead>
                <TableHead className="w-[180px]">Usuario</TableHead>
                <TableHead className="w-[160px]">Acción</TableHead>
                <TableHead className="w-[120px]">Entidad</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Cargando logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron logs de auditoría
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {log.user_email}
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action_type)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entity_type || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {log.details ? JSON.stringify(log.details).substring(0, 100) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredLogs.length} de {logs.length} registros
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditLogTable;
