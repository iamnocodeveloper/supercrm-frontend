import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, MessageSquare, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessageWithResponder {
  id: string;
  content: string;
  direction: string;
  is_bot: boolean;
  created_at: string;
  responded_by: string | null;
  responder_name?: string;
  conversation_pushname?: string;
  conversation_phone?: string;
}

export const MessageResponderTracker: React.FC = () => {
  const [messages, setMessages] = useState<MessageWithResponder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select(`
          id,
          content,
          direction,
          is_bot,
          created_at,
          responded_by,
          conversation_id
        `)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filterBy === 'human') {
        query = query.eq('is_bot', false).not('responded_by', 'is', null);
      } else if (filterBy === 'bot') {
        query = query.eq('is_bot', true);
      }

      const { data: messagesData, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      // Fetch responder profiles
      const responderIds = [...new Set(messagesData?.filter(m => m.responded_by).map(m => m.responded_by) || [])];
      const conversationIds = [...new Set(messagesData?.map(m => m.conversation_id) || [])];

      const [{ data: profiles }, { data: conversations }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', responderIds.length > 0 ? responderIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('conversations')
          .select('id, pushname, phone_number')
          .in('id', conversationIds)
      ]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const conversationMap = new Map(conversations?.map(c => [c.id, c]) || []);

      const messagesWithNames = (messagesData || []).map(msg => {
        const profile = msg.responded_by ? profileMap.get(msg.responded_by) : null;
        const conversation = conversationMap.get(msg.conversation_id);
        return {
          ...msg,
          responder_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
            : msg.is_bot ? 'Bot IA' : 'Sistema',
          conversation_pushname: conversation?.pushname || 'Desconocido',
          conversation_phone: conversation?.phone_number || ''
        };
      });

      setMessages(messagesWithNames);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [filterBy, limit]);

  const filteredMessages = messages.filter(msg => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      msg.content.toLowerCase().includes(search) ||
      msg.responder_name?.toLowerCase().includes(search) ||
      msg.conversation_pushname?.toLowerCase().includes(search) ||
      msg.conversation_phone?.includes(search)
    );
  });

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mensajes Enviados por Usuario
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por contenido, usuario o contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterBy} onValueChange={setFilterBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los mensajes</SelectItem>
              <SelectItem value="human">Solo humanos</SelectItem>
              <SelectItem value="bot">Solo bot</SelectItem>
            </SelectContent>
          </Select>
          <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 mensajes</SelectItem>
              <SelectItem value="100">100 mensajes</SelectItem>
              <SelectItem value="200">200 mensajes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Fecha/Hora</TableHead>
                <TableHead className="w-[140px]">Respondido por</TableHead>
                <TableHead className="w-[140px]">Contacto</TableHead>
                <TableHead>Mensaje</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Cargando mensajes...
                  </TableCell>
                </TableRow>
              ) : filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron mensajes
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((msg) => (
                  <TableRow key={msg.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(msg.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {msg.is_bot ? (
                          <Bot className="h-4 w-4 text-purple-400" />
                        ) : (
                          <User className="h-4 w-4 text-blue-400" />
                        )}
                        <span className="text-sm font-medium">{msg.responder_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{msg.conversation_pushname}</p>
                        <p className="text-xs text-muted-foreground">{msg.conversation_phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate">{msg.content}</p>
                    </TableCell>
                    <TableCell>
                      {msg.is_bot ? (
                        <Badge className="bg-purple-500/20 text-purple-400 border-0">Bot</Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-400 border-0">Humano</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Mostrando {filteredMessages.length} de {messages.length} mensajes enviados
        </div>
      </CardContent>
    </Card>
  );
};

export default MessageResponderTracker;
