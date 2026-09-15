import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageSquare, 
  Search,
  Filter,
  Calendar,
  User,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Download,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];

interface MessageWithDetails extends Message {
  conversations?: {
    whatsapp_number?: string;
    pushname?: string;
  };
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

const AdminMessages = () => {
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const messagesPerPage = 50;
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
  }, [currentPage, directionFilter, dateFilter, searchTerm]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * messagesPerPage, currentPage * messagesPerPage - 1);

      // Apply filters
      if (directionFilter !== 'all') {
        query = query.eq('direction', directionFilter);
      }

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
        query = query.or(`message.ilike.%${searchTerm}%,whatsapp_number.ilike.%${searchTerm}%,pushname.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Enrich messages with conversation and profile data
      const messagesWithDetails = await Promise.all(
        (data || []).map(async (message) => {
          // Get conversation data
          let conversationData = null;
          if (message.conversation_id) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('whatsapp_number, pushname')
              .eq('id', message.conversation_id)
              .single();
            conversationData = convData;
          }

          // Get user profile if user_id exists
          let userProfile = null;
          if (message.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', message.user_id)
              .single();
            userProfile = profileData;
          }

          return {
            ...message,
            conversations: conversationData,
            profiles: userProfile
          };
        })
      );

      setMessages(messagesWithDetails);
      setTotalMessages(count || 0);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los mensajes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(message => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      message.message?.toLowerCase().includes(searchLower) ||
      message.conversations?.whatsapp_number?.includes(searchTerm) ||
      message.conversations?.pushname?.toLowerCase().includes(searchLower) ||
      message.profiles?.first_name?.toLowerCase().includes(searchLower) ||
      message.profiles?.last_name?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(totalMessages / messagesPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando mensajes...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Gestión de Mensajes</h1>
        <p className="text-muted-foreground">
          Administra todos los mensajes de WhatsApp del sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMessages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.filter(m => m.direction === 'outgoing').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recibidos</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.filter(m => m.direction === 'incoming').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.filter(m => m.is_bot).length}
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
                  placeholder="Buscar mensaje, teléfono, contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Dirección" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="incoming">Entrantes</SelectItem>
                <SelectItem value="outgoing">Salientes</SelectItem>
              </SelectContent>
            </Select>
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
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mensajes ({filteredMessages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Mensaje</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Contacto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Usuario</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Dirección</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.map((message) => (
                  <tr key={message.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-900 truncate">
                          {message.message || 'Sin contenido'}
                        </p>
                        {message.attachment_url && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Adjunto
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {message.conversations?.pushname || 'Sin nombre'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {message.conversations?.whatsapp_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {message.profiles && (
                        <div className="text-sm text-gray-900">
                          {message.profiles.first_name} {message.profiles.last_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={message.direction === 'incoming' ? 'default' : 'secondary'}
                      >
                        {message.direction === 'incoming' ? 'Entrante' : 'Saliente'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {message.is_bot && (
                          <Badge variant="outline" className="text-xs">
                            Bot
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {message.message_type || 'text'}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {new Date(message.created_at).toLocaleDateString()}
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
                Mostrando {(currentPage - 1) * messagesPerPage + 1} a{' '}
                {Math.min(currentPage * messagesPerPage, totalMessages)} de{' '}
                {totalMessages} mensajes
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

          {filteredMessages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron mensajes
              </h3>
              <p className="text-gray-500">
                No hay mensajes que coincidan con los filtros aplicados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMessages;