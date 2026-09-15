import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageCircle, 
  Search,
  Filter,
  Calendar,
  User,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  MessageSquare,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['conversations']['Row'];

interface ConversationWithDetails extends Conversation {
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
  message_count?: number;
}

const AdminConversations = () => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalConversations, setTotalConversations] = useState(0);
  const conversationsPerPage = 20;
  const { toast } = useToast();
  const [users, setUsers] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([]);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  useEffect(() => {
    fetchConversations();
  }, [currentPage, dateFilter, searchTerm, selectedUserId, selectedWorkspaceId, selectedColumnId]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .order('first_name', { ascending: true });

        setUsers((profiles || []).map(p => ({ id: p.id as string, first_name: p.first_name || null, last_name: p.last_name || null })));

        const { data: ws } = await supabase
          .from('workspaces')
          .select('id, name')
          .order('position', { ascending: true });

        setWorkspaces((ws || []).map(w => ({ id: w.id as string, name: w.name as string })));
      } catch (e) {
        /* silent */
      }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    const loadColumns = async () => {
      try {
        if (!selectedWorkspaceId) {
          setColumns([]);
          setSelectedColumnId('');
          return;
        }
        const { data: cols } = await supabase
          .from('lead_columns')
          .select('id, name')
          .eq('workspace_id', selectedWorkspaceId)
          .order('position', { ascending: true });
        setColumns((cols || []).map(c => ({ id: c.id as string, name: c.name as string })));
        if ((cols || []).length === 0) setSelectedColumnId('');
      } catch (e) {
        /* silent */
      }
    };
    loadColumns();
  }, [selectedWorkspaceId]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range((currentPage - 1) * conversationsPerPage, currentPage * conversationsPerPage - 1);

      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      if (searchTerm) {
        query = query.or(`pushname.ilike.%${searchTerm}%,whatsapp_number.ilike.%${searchTerm}%`);
      }

      if (selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      if (selectedColumnId || selectedWorkspaceId) {
        let leadIds: string[] = [];
        if (selectedColumnId) {
          const { data: leadsData, error: leadsErr } = await supabase
            .from('leads')
            .select('id')
            .eq('column_id', selectedColumnId);
          if (leadsErr) throw leadsErr;
          leadIds = (leadsData || []).map(l => l.id as string);
        } else if (selectedWorkspaceId) {
          const { data: colData, error: colErr } = await supabase
            .from('lead_columns')
            .select('id')
            .eq('workspace_id', selectedWorkspaceId);
          if (colErr) throw colErr;
          const columnIds = (colData || []).map(c => c.id as string);
          if (columnIds.length > 0) {
            const { data: leadsData, error: leadsErr } = await supabase
              .from('leads')
              .select('id')
              .in('column_id', columnIds);
            if (leadsErr) throw leadsErr;
            leadIds = (leadsData || []).map(l => l.id as string);
          }
        }
        if (leadIds.length === 0) {
          setConversations([]);
          setTotalConversations(0);
          setLoading(false);
          return;
        }
        query = query.in('lead_id', leadIds);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Get message counts for each conversation
      const conversationsWithCounts = await Promise.all(
        (data || []).map(async (conversation) => {
          const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation.id);

          // Get user profile if user_id exists
          let userProfile = null;
          if (conversation.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', conversation.user_id)
              .single();
            userProfile = profileData;
          }

          return {
            ...conversation,
            message_count: messageCount || 0,
            profiles: userProfile
          };
        })
      );
      
      setConversations(conversationsWithCounts);
      setTotalConversations(count || 0);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las conversaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      conversation.pushname?.toLowerCase().includes(searchLower) ||
      conversation.whatsapp_number?.includes(searchTerm) ||
      conversation.profiles?.first_name?.toLowerCase().includes(searchLower) ||
      conversation.profiles?.last_name?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalConversations / conversationsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Gestión de Conversaciones</h1>
        <p className="text-muted-foreground">
          Administra todas las conversaciones de WhatsApp del sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversaciones</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(c => {
                const today = new Date();
                const conversationDate = new Date(c.last_message_time || c.created_at);
                return conversationDate.toDateString() === today.toDateString();
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Mensajes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(c => (c.message_count || 0) > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(conversations.map(c => c.user_id).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre, teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fechas</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full md:w-[220px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los usuarios</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {(u.first_name || '') + ' ' + (u.last_name || '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWorkspaceId} onValueChange={(v) => { setSelectedWorkspaceId(v); setSelectedColumnId(''); }}>
              <SelectTrigger className="w-full md:w-[220px]">
                <MessageCircle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por espacio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los espacios</SelectItem>
                {workspaces.map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedColumnId} onValueChange={setSelectedColumnId} disabled={!selectedWorkspaceId}>
              <SelectTrigger className="w-full md:w-[220px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por embudo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los embudos</SelectItem>
                {columns.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Conversaciones ({filteredConversations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contacto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">WhatsApp</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Usuario</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Mensajes</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Último Mensaje</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((conversation) => (
                  <tr key={conversation.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {conversation.pushname || 'Sin nombre'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {conversation.whatsapp_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {conversation.whatsapp_number}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {conversation.profiles && (
                        <div className="text-sm text-gray-900">
                          {conversation.profiles.first_name} {conversation.profiles.last_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {conversation.message_count || 0} mensajes
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-900 truncate">
                          {conversation.last_message || 'Sin mensajes'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {new Date(conversation.last_message_time || conversation.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <p className="text-sm text-gray-500">
                Mostrando {(currentPage - 1) * conversationsPerPage + 1} a{' '}
                {Math.min(currentPage * conversationsPerPage, totalConversations)} de{' '}
                {totalConversations} conversaciones
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-500">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {filteredConversations.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron conversaciones
              </h3>
              <p className="text-gray-500">
                No hay conversaciones que coincidan con los filtros aplicados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminConversations;