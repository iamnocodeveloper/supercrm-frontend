import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useInfiniteLeads } from '@/hooks/useInfiniteLeads';
import { applySessionChange } from '@/services/sessionChangeService';
import { usePlayerChatLeads } from '@/hooks/usePlayerChatLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, MoreVertical, Building, Mail, Phone, DollarSign, Users, Search, ChevronDown, ArrowLeft, MessageSquare, RefreshCw, Loader2, CalendarDays, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import KanbanBoard from '@/components/KanbanBoard';
import { MessageTriggersDialog } from '@/components/MessageTriggersDialog';
import ChatModal from '@/components/conversations/ChatModal';
import ChatModalPlayerChat from '@/components/conversations/ChatModalPlayerChat';
import { useMessages, useConversations } from '@/hooks/useConversations';
import { ConversationService } from '@/services/conversationService';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { DateRangeSelector } from '@/components/reports/DateRangeSelector';
import type { DateRange } from '@/services/reportsService';
import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
type LeadColumn = Tables<'lead_columns'>;
type Lead = Tables<'leads'>;
type Workspace = Tables<'workspaces'>;
interface ConversationSummary {
  id: string;
  phone_number: string;
  pushname: string | null;
  created_at?: string | null;
  last_message: string | null;
  last_message_time: string | null;
  last_inbound_message_time?: string | null;
  unread_count: number | null;
  channel_type?: string | null;
}
interface LeadWithColumn extends Lead {
  lead_columns?: LeadColumn;
  conversations?: ConversationSummary[];
  isVirtual?: boolean; // Flag para identificar leads creados desde conversaciones huérfanas
  originalConversationId?: string; // ID de la conversación original para leads virtuales
}
type FunnelDateFilterType = 'conversation_created' | 'last_message' | 'last_inbound_message' | 'messages_in_range';

const createFunnelPresetRange = (preset: 'today' | '7days' | '30days' | 'thisMonth'): DateRange => {
  const now = new Date();
  if (preset === 'today') return { startDate: startOfDay(now), endDate: endOfDay(now) };
  if (preset === '7days') return { startDate: startOfDay(subDays(now, 6)), endDate: endOfDay(now) };
  if (preset === '30days') return { startDate: startOfDay(subDays(now, 29)), endDate: endOfDay(now) };
  return { startDate: startOfDay(startOfMonth(now)), endDate: endOfDay(now) };
};

const dateFilterLabels: Record<FunnelDateFilterType, string> = {
  conversation_created: 'Conversación creada',
  last_message: 'Último mensaje',
  last_inbound_message: 'Último mensaje recibido',
  messages_in_range: 'Mensajes dentro del rango'
};
const Leads = () => {
  const {
    user
  } = useAuth();
  const {
    hasPermission,
    isAdmin
  } = useUserPermissions();
  const {
    effectiveUserId,
    loading: effectiveUserIdLoading
  } = useEffectiveUserId();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSessionActiveByPhone, getSessionNameByPhone } = useWhatsAppConnections();

  // Permisos específicos de embudos
  const canCreateFunnels = isAdmin || hasPermission('puede_crear_embudos');
  const canEditFunnels = isAdmin || hasPermission('puede_editar_embudos');
  const canDeleteFunnels = isAdmin || hasPermission('puede_eliminar_embudos');
  const canMoveContacts = isAdmin || hasPermission('puede_mover_contactos_embudos');
  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [leads, setLeads] = useState<LeadWithColumn[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#22c55e');
  const [editingColumn, setEditingColumn] = useState<LeadColumn | null>(null);
  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    value: '',
    notes: '',
    column_id: ''
  });
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertingColumn, setConvertingColumn] = useState<LeadColumn | null>(null);
  const [contactListName, setContactListName] = useState('');
  const [showMessageTriggersDialog, setShowMessageTriggersDialog] = useState(false);
  const [selectedColumnForTriggers, setSelectedColumnForTriggers] = useState<LeadColumn | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [filteredLeads, setFilteredLeads] = useState<LeadWithColumn[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<FunnelDateFilterType>('last_message');
  const [dateRange, setDateRange] = useState<DateRange>(() => createFunnelPresetRange('30days'));
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [conversationIdsWithMessages, setConversationIdsWithMessages] = useState<Set<string>>(new Set());
  const [isLoadingMessageRange, setIsLoadingMessageRange] = useState(false);

  // Obtener IDs de columnas y columna por defecto
  const columnIds = useMemo(() => columns.map(c => c.id), [columns]);
  const defaultColumnId = useMemo(() => {
    const defaultCol = columns.find(c => c.is_default);
    return defaultCol?.id || columns[0]?.id || null;
  }, [columns]);

  // Obtener channel_type del workspace seleccionado
  const workspaceChannelType = useMemo(() => {
    const workspace = workspaces.find(w => w.id === selectedWorkspace);
    return workspace?.channel_type || null;
  }, [workspaces, selectedWorkspace]);

  const dateRangeLabel = useMemo(() => (
    `${format(dateRange.startDate, 'dd MMM yyyy', { locale: es })} al ${format(dateRange.endDate, 'dd MMM yyyy', { locale: es })}`
  ), [dateRange]);

  // Hook de paginación infinita
  // Si el workspace es player_chat, usamos usePlayerChatLeads (NO consulta Supabase,
  // solo usa el cache + API externa).
  const isPlayerChatWorkspace = workspaceChannelType === 'player_chat';

  const standardLeads = useInfiniteLeads({
    userId: effectiveUserId,
    workspaceId: selectedWorkspace,
    workspaceChannelType: isPlayerChatWorkspace ? null : workspaceChannelType,
    columnIds: isPlayerChatWorkspace ? [] : columnIds,
    defaultColumnId: isPlayerChatWorkspace ? null : defaultColumnId,
    pageSize: 20
  });

  const playerChatLeads = usePlayerChatLeads({
    userId: effectiveUserId,
    workspaceId: isPlayerChatWorkspace ? selectedWorkspace : null,
    defaultColumnId: isPlayerChatWorkspace ? defaultColumnId : null,
    pollIntervalMs: 5000
  });

  const {
    getAllLeads,
    getLeadsForColumn,
    getColumnState,
    loadMore,
    refreshAll,
    initialLoading: infiniteLoading,
    moveLeadOptimistic,
    isMoving
  } = isPlayerChatWorkspace ? playerChatLeads : standardLeads;

  // Ref para debounce de recargas realtime
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para el modal de chat
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [selectedWhatsAppSession, setSelectedWhatsAppSession] = useState<string | null>(null);

  // Handler de cambio de sesión WhatsApp desde el dropdown.
  // UNA sola conversación por contacto: SIEMPRE actualiza la conversación
  // existente a la sesión nueva. Si la sesión nueva pertenece a otro embudo
  // (workspace), mueve el contacto a ese embudo (columna por defecto) y
  // cambia la vista al embudo nuevo para que el contacto siga visible.
  const handleWhatsAppSessionChange = async (newSessionName: string | null, newSessionPhoneNumber?: string) => {
    if (!newSessionPhoneNumber || !selectedConversation || selectedConversation.channel_type !== 'whatsapp' || !effectiveUserId) return;
    if (selectedWhatsAppSession === newSessionName) return;

    setSelectedWhatsAppSession(newSessionName);

    try {
      const result = await applySessionChange({
        conversation: selectedConversation,
        newSessionName,
        newSessionPhoneNumber,
        userId: effectiveUserId,
      });

      const updated = result.conversation;
      setSelectedConversation(updated ?? {
        ...selectedConversation,
        whatsapp_number: newSessionPhoneNumber,
        connection_id: result.connection?.id ?? selectedConversation.connection_id,
        session_name: result.connection?.name ?? newSessionName,
      });

      if (result.moved && result.targetWorkspaceId) {
        const targetWs = workspaces.find(w => w.id === result.targetWorkspaceId);
        setSelectedWorkspace(result.targetWorkspaceId);
        toast({
          title: 'Contacto movido de embudo',
          description: `La conversación pasó al embudo "${result.targetColumnName ?? targetWs?.name ?? 'nuevo'}" con la sesión "${newSessionName}".`,
        });
      } else {
        toast({
          title: 'Sesión actualizada',
          description: 'La conversación ahora usa la nueva sesión seleccionada.',
        });
      }

      // Refrescar el tablero para reflejar el movimiento
      await refreshAll();
    } catch (err: any) {
      console.error('[Leads] Error updating session on conversation:', err);
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo actualizar la sesión de la conversación',
        variant: 'destructive',
      });
    }
  };

  // Estado para el modal de player_chat (no consulta Supabase)
  const [isPlayerChatModalOpen, setIsPlayerChatModalOpen] = useState(false);
  const [selectedPlayerChatId, setSelectedPlayerChatId] = useState<string | null>(null);
  const [selectedPlayerChat, setSelectedPlayerChat] = useState<any | null>(null);

  // Hook para mensajes del chat seleccionado
  const {
    messages,
    sendMessage,
    isSending
  } = useMessages(selectedConversationId);

  // Hook para marcar como leído
  const {
    markAsRead
  } = useConversations();

  // Manejar envío de mensaje desde el modal (soporta múltiples canales)
  const handleSendMessage = async (messageText: string, attachment?: File) => {
    if (!messageText.trim() && !attachment || !selectedConversation || !effectiveUserId) return;
    try {
      const channelType = selectedConversation.channel_type || 'whatsapp';
      const phoneNumber = selectedConversation.phone_number;

      // Por ahora solo soportamos mensajes de texto
      if (attachment) {
        console.warn('Attachments not yet supported');
        toast({
          title: "No soportado",
          description: "El envío de archivos aún no está disponible",
          variant: "default"
        });
        return;
      }

      // Si es Twilio - usar la conexión original de la conversación
      if (channelType === 'twilio') {
        const twilioConnectionId = selectedConversation.twilio_connection_id;
        
        if (!twilioConnectionId) {
          toast({
            title: "Error",
            description: "Esta conversación no tiene una conexión Twilio asignada. La sesión original puede haber sido eliminada.",
            variant: "destructive"
          });
          return;
        }
        
        await sendMessage({
          conversationId: selectedConversation.id,
          userId: effectiveUserId,
          message: messageText.trim(),
          sessionName: '',
          phoneNumber: phoneNumber,
          channelType: 'twilio',
          twilioConnectionId: twilioConnectionId
        });
        return;
      }

      // Si es Telegram
      if (channelType === 'telegram') {
        const telegramBotId = selectedConversation.telegram_bot_id;
        if (!telegramBotId) {
          toast({
            title: "Error",
            description: "No se encontró el bot de Telegram para esta conversación",
            variant: "destructive"
          });
          return;
        }
        await sendMessage({
          conversationId: selectedConversation.id,
          userId: effectiveUserId,
          message: messageText.trim(),
          sessionName: '',
          phoneNumber: phoneNumber,
          channelType: 'telegram',
          telegramBotId: telegramBotId
        });
        return;
      }

      // Si es WhatsApp (WAHA) - usar sesión seleccionada, con fallback a la original
      let sessionName = selectedWhatsAppSession;
      if (!sessionName && selectedConversation?.whatsapp_number) {
        sessionName = getSessionNameByPhone(selectedConversation.whatsapp_number) || selectedConversation.whatsapp_number;
      }
      
      if (!sessionName) {
        toast({
          title: "Sesión no seleccionada",
          description: "Selecciona una conexión de WhatsApp para enviar mensajes",
          variant: "destructive"
        });
        return;
      }
      
      await sendMessage({
        conversationId: selectedConversation.id,
        userId: effectiveUserId,
        message: messageText.trim(),
        sessionName: sessionName,
        phoneNumber: phoneNumber,
        channelType: 'whatsapp'
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      let description = "No se pudo enviar el mensaje";
      const body = error?.context?.body;
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.error) description = String(parsed.error);
        } catch {}
      } else if (error?.message && typeof error.message === 'string') {
        description = error.message;
      }
      if (description.length > 220) description = description.slice(0, 217) + '...';
      
      toast({
        title: "Error al enviar mensaje",
        description,
        variant: "destructive"
      });
    }
  };

  // Función para manejar click en lead y abrir conversación en modal
  const handleLeadClick = async (lead: LeadWithColumn) => {
    // Si el lead tiene conversaciones asociadas, abrir modal con la primera
    if (lead.conversations && lead.conversations.length > 0) {
      const firstConversation = lead.conversations[0];

      // Si es player_chat, abrir el modal player_chat (no consulta Supabase)
      if (firstConversation.channel_type === 'player_chat') {
        setSelectedPlayerChatId(firstConversation.id);
        setSelectedPlayerChat(firstConversation);
        setIsPlayerChatModalOpen(true);
        return;
      }

      // Setear sesión default según la conversación (la que recibió el mensaje)
      if (firstConversation.channel_type === 'whatsapp' && (firstConversation as any).whatsapp_number) {
        const sessionName = getSessionNameByPhone((firstConversation as any).whatsapp_number);
        setSelectedWhatsAppSession(sessionName || (firstConversation as any).whatsapp_number);
      } else {
        setSelectedWhatsAppSession(null);
      }

      // Cargar datos completos de la conversación
      const {
        data: fullConversation,
        error
      } = await supabase.from('conversations').select('*').eq('id', firstConversation.id).single();
      if (fullConversation && !error) {
        setSelectedConversation(fullConversation);
        setSelectedConversationId(fullConversation.id);
        setIsChatModalOpen(true);

        // Marcar como leído al abrir
        markAsRead(fullConversation.id);
      } else {
        toast({
          title: "Error",
          description: "No se pudo cargar la conversación",
          variant: "destructive"
        });
      }
    } else {
      // Si no tiene conversaciones, mostrar un mensaje
      toast({
        title: "Sin conversaciones",
        description: "Este contacto aún no tiene conversaciones de WhatsApp",
        variant: "default"
      });
    }
  };

  const openConversationById = useCallback(async (conversationId: string) => {
    const { data: fullConversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (fullConversation && !error) {
      setSelectedConversation(fullConversation);
      setSelectedConversationId(fullConversation.id);
      setIsChatModalOpen(true);
      markAsRead(fullConversation.id);
      return true;
    }

    toast({
      title: 'Error',
      description: 'No se pudo cargar la conversación',
      variant: 'destructive'
    });
    return false;
  }, [markAsRead]);
  useEffect(() => {
    if (effectiveUserId && !effectiveUserIdLoading) {
      loadData();
    }
  }, [effectiveUserId, effectiveUserIdLoading]);

  // Reload columns when workspace changes
  useEffect(() => {
    if (effectiveUserId && !effectiveUserIdLoading && selectedWorkspace) {
      loadColumns();
    }
  }, [selectedWorkspace, effectiveUserId, effectiveUserIdLoading]);

  // Función debounced para recargar leads (evita múltiples recargas seguidas)
  const debouncedLoadLeads = useCallback(() => {
    // Si hay un movimiento en progreso, ignorar el evento Realtime
    if (isMoving()) {
return;
    }
    
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }
    setIsRefreshing(true);
    reloadTimeoutRef.current = setTimeout(async () => {
      // Use refreshAll from useInfiniteLeads to update the actual displayed data
      await refreshAll();
      setIsRefreshing(false);
    }, 500);
  }, [isMoving, refreshAll]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  // Suscripción realtime para reordenar cuando lleguen nuevos mensajes y detectar nuevos leads/conversaciones
  useEffect(() => {
    if (!effectiveUserId) return;
    // En workspaces player_chat, la fuente de verdad es la API externa (Player Portal),
    // no Supabase. No nos suscribimos a Supabase Realtime porque las tablas
    // conversations/messages no son la fuente de player_chat y dispararían
    // refreshAll que podría pisar el cache de chats en momentos inoportunos.
    if (isPlayerChatWorkspace) return;

    // Canal fijo sin Date.now() para reutilizar conexiones
    const channelName = `leads-realtime-${effectiveUserId}`;
    const channel = supabase.channel(channelName)
    // Conversations: INSERT y UPDATE
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'conversations',
      filter: `user_id=eq.${effectiveUserId}`
    }, () => debouncedLoadLeads()).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'conversations',
      filter: `user_id=eq.${effectiveUserId}`
    }, () => debouncedLoadLeads())
    // Leads: INSERT, UPDATE y DELETE
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'leads',
      filter: `user_id=eq.${effectiveUserId}`
    }, () => debouncedLoadLeads()).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'leads',
      filter: `user_id=eq.${effectiveUserId}`
    }, () => debouncedLoadLeads()).on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'leads',
      filter: `user_id=eq.${effectiveUserId}`
    }, () => debouncedLoadLeads())
    // Messages: INSERT (sin filtro porque no tiene user_id directo)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, () => debouncedLoadLeads()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, debouncedLoadLeads]);

  // Obtener leads desde el hook de paginación
  const paginatedLeads = useMemo(() => getAllLeads(), [getAllLeads]);

  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    if (!state?.conversationId) return;

    openConversationById(state.conversationId).then((opened) => {
      if (opened) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    });
  }, [location.state, location.pathname, navigate, openConversationById]);

  useEffect(() => {
    const loadConversationIdsWithMessages = async () => {
      if (!effectiveUserId || !dateFilterEnabled || dateFilterType !== 'messages_in_range') {
        setConversationIdsWithMessages(new Set());
        return;
      }

      setIsLoadingMessageRange(true);
      try {
        const ids = new Set<string>();
        let from = 0;
        const pageSize = 1000;
        let keepLoading = true;

        while (keepLoading) {
          const { data, error } = await supabase
            .from('messages')
            .select('conversation_id')
            .eq('user_id', effectiveUserId)
            .gte('created_at', dateRange.startDate.toISOString())
            .lte('created_at', dateRange.endDate.toISOString())
            .range(from, from + pageSize - 1);

          if (error) throw error;
          (data || []).forEach(message => {
            if (message.conversation_id) ids.add(message.conversation_id);
          });
          keepLoading = (data?.length || 0) === pageSize;
          from += pageSize;
        }

        setConversationIdsWithMessages(ids);
      } catch (error) {
        console.error('Error loading conversation IDs by message range:', error);
        setConversationIdsWithMessages(new Set());
      } finally {
        setIsLoadingMessageRange(false);
      }
    };

    loadConversationIdsWithMessages();
  }, [effectiveUserId, dateFilterEnabled, dateFilterType, dateRange.startDate, dateRange.endDate]);

  // Filtrar leads en tiempo real - usar siempre los leads paginados
  useEffect(() => {
    const isInRange = (value?: string | null) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return time >= dateRange.startDate.getTime() && time <= dateRange.endDate.getTime();
    };

    let filtered = paginatedLeads;

    if (dateFilterEnabled) {
      filtered = filtered.filter(lead => {
        const conversation = lead.conversations?.[0];
        if (dateFilterType === 'conversation_created') return isInRange(conversation?.created_at || lead.created_at);
        if (dateFilterType === 'last_message') return isInRange(conversation?.last_message_time || lead.updated_at);
        if (dateFilterType === 'last_inbound_message') return isInRange(conversation?.last_inbound_message_time || lead.last_inbound_message_time);
        const conversationId = lead.originalConversationId || conversation?.id;
        return Boolean(conversationId && conversationIdsWithMessages.has(conversationId));
      });
    }

    if (searchFilter.trim()) {
      filtered = filtered.filter(lead => {
        const searchTerm = searchFilter.toLowerCase();
        const nameMatch = lead.name?.toLowerCase().includes(searchTerm);
        const phoneMatch = lead.phone?.toLowerCase().includes(searchTerm);
        return nameMatch || phoneMatch;
      });
    }

    setFilteredLeads(filtered);
  }, [paginatedLeads, searchFilter, dateFilterEnabled, dateFilterType, dateRange, conversationIdsWithMessages]);
  const loadData = async () => {
    try {
      setLoading(true);
      // Cargar workspaces PRIMERO para tener selectedWorkspace listo,
      // y solo DESPUÉS cargar columnas (que dependen del workspace seleccionado).
      // Antes se hacía en paralelo y eso causaba que loadColumns creara una
      // columna default con workspace_id=null en la primera carga.
      await loadWorkspaces();
      await loadColumns();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadWorkspaces = async () => {
    if (!effectiveUserId) return;

    // Mostrar todos los workspaces (incluyendo webchat y player_chat).
    // El Kanban filtra automáticamente por channel_type del workspace.
    const {
      data,
      error
    } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('position');
    if (error) {
      console.error('Error loading workspaces:', error);
      return;
    }

    // Si no hay workspaces normales, crear uno por defecto
    if (!data || data.length === 0) {
      const {
        data: newWorkspace,
        error: createError
      } = await supabase.from('workspaces').insert({
        user_id: effectiveUserId,
        name: 'Mi Espacio de Trabajo',
        position: 0
        // channel_type queda NULL = workspace normal
      }).select().single();
      if (createError) {
        console.error('Error creating default workspace:', createError);
        return;
      }

      // Crear columna por defecto en el nuevo workspace
      await supabase.from('lead_columns').insert({
        user_id: effectiveUserId,
        workspace_id: newWorkspace.id,
        name: 'Nuevos Contactos',
        color: '#22c55e',
        position: 0,
        is_default: true
      });
      setWorkspaces([newWorkspace]);
      setSelectedWorkspace(newWorkspace.id);
      return;
    }
    setWorkspaces(data || []);

    // Verificar que el workspace seleccionado sea válido
    const validWorkspaceIds = data.map(w => w.id);
    if (selectedWorkspace && !validWorkspaceIds.includes(selectedWorkspace)) {
const defaultWs = data.find(w => w.is_default) || data[0];
      setSelectedWorkspace(defaultWs.id);
    } else if (!selectedWorkspace && data.length > 0) {
      // Prefer workspace marked as default, otherwise first by position
      const defaultWs = data.find(w => w.is_default) || data[0];
      setSelectedWorkspace(defaultWs.id);
    }
  };
  const loadColumns = async () => {
    if (!effectiveUserId) return;
    let query = supabase.from('lead_columns').select('*').eq('user_id', effectiveUserId);

    // Filtrar SOLO por el workspace seleccionado.
    // Antes mezclaba columnas huérfanas (workspace_id IS NULL) que se asignaban
    // a todos los workspaces del usuario, causando duplicación de "default".
    if (selectedWorkspace) {
      query = query.eq('workspace_id', selectedWorkspace);
    }
    const {
      data,
      error
    } = await query.order('position');
    if (error) {
      console.error('Error loading columns:', error);
      return;
    }
    if (!data || data.length === 0) {
      // Crear columna por defecto si no existe ninguna
      await createDefaultColumn();
      return;
    }
    setColumns(data);
  };
  const createDefaultColumn = async () => {
    if (!effectiveUserId) return;

    // Idempotente: verificar primero si ya existe una columna default para este workspace.
    // Antes siempre creaba una nueva, causando duplicados "Nuevos Leads" cada vez
    // que loadColumns se ejecutaba sin encontrar columnas.
    if (selectedWorkspace) {
      const { data: existing } = await supabase
        .from('lead_columns')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('workspace_id', selectedWorkspace)
        .eq('is_default', true)
        .maybeSingle();

      if (existing) {
        setColumns([existing]);
        return;
      }
    }

    const {
      data,
      error
    } = await supabase.from('lead_columns').insert({
      name: 'Nuevos Leads',
      color: '#22c55e',
      position: 0,
      is_default: true,
      user_id: effectiveUserId,
      workspace_id: selectedWorkspace
    }).select().single();
    if (error) {
      console.error('Error creating default column:', error);
      return;
    }
    setColumns([data]);
  };
  const loadLeads = async () => {
    setIsRefreshing(true);
    await refreshAll();
    setIsRefreshing(false);
  };


  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la columna es requerido",
        variant: "destructive"
      });
      return;
    }
    if (!selectedWorkspace) {
      toast({
        title: "Error",
        description: "Por favor selecciona un espacio de trabajo primero",
        variant: "destructive"
      });
      return;
    }
    const {
      data,
      error
    } = await supabase.from('lead_columns').insert({
      name: newColumnName,
      color: newColumnColor,
      position: columns.length,
      is_default: false,
      user_id: effectiveUserId,
      workspace_id: selectedWorkspace
    }).select().single();
    if (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Error",
        description: "Error al crear la columna",
        variant: "destructive"
      });
      return;
    }
    setColumns([...columns, data]);
    setNewColumnName('');
    setNewColumnColor('#22c55e');
    setShowColumnDialog(false);
    toast({
      title: "Éxito",
      description: "Columna creada correctamente"
    });
  };
  const handleUpdateColumn = async () => {
    if (!editingColumn || !newColumnName.trim()) return;

    // Bifurcación: player_chat usa player_chat_columns, otros usan lead_columns
    if (isPlayerChatWorkspace) {
      try {
        await ConversationService.renamePlayerChatColumn(
          editingColumn.id,
          newColumnName,
          newColumnColor
        );
        setColumns(columns.map(col => col.id === editingColumn.id ? {
          ...col,
          name: newColumnName,
          color: newColumnColor
        } : col));
        setEditingColumn(null);
        setNewColumnName('');
        setNewColumnColor('#3b82f6');
        setShowColumnDialog(false);
        toast({ title: 'Éxito', description: 'Columna actualizada correctamente' });
      } catch (e: any) {
        console.error('Error updating player_chat column:', e);
        toast({
          title: 'Error',
          description: e?.message ?? 'Error al actualizar la columna',
          variant: 'destructive'
        });
      }
      return;
    }

    const {
      error
    } = await supabase.from('lead_columns').update({
      name: newColumnName,
      color: newColumnColor
    }).eq('id', editingColumn.id);
    if (error) {
      console.error('Error updating column:', error);
      toast({
        title: "Error",
        description: "Error al actualizar la columna",
        variant: "destructive"
      });
      return;
    }
    setColumns(columns.map(col => col.id === editingColumn.id ? {
      ...col,
      name: newColumnName,
      color: newColumnColor
    } : col));
    setEditingColumn(null);
    setNewColumnName('');
    setNewColumnColor('#3b82f6');
    setShowColumnDialog(false);
    toast({
      title: "Éxito",
      description: "Columna actualizada correctamente"
    });
  };
  const handleDeleteColumn = async (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (column?.is_default) {
      toast({
        title: "Error",
        description: "No se puede eliminar la columna inicial",
        variant: "destructive"
      });
      return;
    }
    const {
      error
    } = await supabase.from('lead_columns').delete().eq('id', columnId);
    if (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Error",
        description: "Error al eliminar la columna",
        variant: "destructive"
      });
      return;
    }
    setColumns(columns.filter(col => col.id !== columnId));
    setLeads(leads.filter(lead => lead.column_id !== columnId));
    toast({
      title: "Éxito",
      description: "Columna eliminada correctamente"
    });
  };
  const handleCreateLead = async () => {
    if (!newLead.name.trim()) return;
    const currentLeads = getAllLeads();

    // Si no se especifica columna, usar la columna por defecto
    let targetColumnId = newLead.column_id;
    if (!targetColumnId) {
      const defaultColumn = columns.find(col => col.is_default);
      if (defaultColumn) {
        targetColumnId = defaultColumn.id;
      } else if (columns.length > 0) {
        targetColumnId = columns[0].id;
      } else {
        toast({
          title: "Error",
          description: "No hay columnas disponibles",
          variant: "destructive"
        });
        return;
      }
    }
    const {
      data,
      error
    } = await supabase.from('leads').insert({
      name: newLead.name,
      email: newLead.email || null,
      phone: newLead.phone || null,
      company: newLead.company || null,
      value: newLead.value ? parseFloat(newLead.value) : null,
      notes: newLead.notes || null,
      column_id: targetColumnId,
      user_id: effectiveUserId,
      position: currentLeads.filter(l => l.column_id === targetColumnId).length
    }).select(`
        *,
        lead_columns(*)
      `).single();
    if (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Error al crear el lead",
        variant: "destructive"
      });
      return;
    }
    setLeads([...leads, data]);
    setNewLead({
      name: '',
      email: '',
      phone: '',
      company: '',
      value: '',
      notes: '',
      column_id: ''
    });
    setShowLeadDialog(false);
    toast({
      title: "Éxito",
      description: "Lead creado correctamente"
    });
  };
  const handleMoveLeadToColumn = async (leadId: string, targetColumnId: string) => {
    // Verificar si es un lead virtual (conversación huérfana)
    const isVirtualLead = leadId.startsWith('virtual-');

    // Player_chat: no creamos lead real, solo actualizamos la asignación
    // (la persistencia la hace el hook usePlayerChatLeads en player_chat_assignments)
    if (isVirtualLead && isPlayerChatWorkspace) {
      const currentLeads = getAllLeads();
      const lead = currentLeads.find(l => l.id === leadId);
      if (!lead) return;
      const sourceColumnId = lead.column_id;

      // UI optimista
      setLeads(currentLeads.map(l => l.id === leadId ? { ...l, column_id: targetColumnId } : l));
      // Persistencia + cache (lo hace el hook)
      await moveLeadOptimistic(leadId, sourceColumnId, targetColumnId);
      return;
    }

    if (isVirtualLead) {
      // Convertir lead virtual a lead real
      const currentLeads = getAllLeads();
      const virtualLead = currentLeads.find(l => l.id === leadId);
      if (!virtualLead || !virtualLead.originalConversationId) return;
      const previousLeads = [...getAllLeads()];

      // Remover el lead virtual de la UI inmediatamente
      setLeads(currentLeads.filter(l => l.id !== leadId));
      try {
        // Crear lead real en la base de datos
        const {
          data: newLead,
          error: createError
        } = await supabase.from('leads').insert({
          name: virtualLead.name,
          phone: virtualLead.phone,
          column_id: targetColumnId,
          position: currentLeads.filter(l => l.column_id === targetColumnId).length,
          user_id: effectiveUserId
        }).select(`
            *,
            lead_columns(*)
          `).single();
        if (createError) throw createError;

        // Vincular la conversación al nuevo lead
        const {
          error: linkError
        } = await supabase.from('conversations').update({
          lead_id: newLead.id
        }).eq('id', virtualLead.originalConversationId);
        if (linkError) {
          console.error('Error linking conversation:', linkError);
        }

        // Agregar el lead real a la lista
        setLeads(prev => [...prev.filter(l => l.id !== leadId), {
          ...newLead,
          conversations: virtualLead.conversations
        }]);
        toast({
          title: "Lead creado",
          description: `${virtualLead.name} fue agregado al embudo`
        });
      } catch (error) {
        console.error('Error converting virtual lead:', error);
        setLeads(previousLeads);
        toast({
          title: "Error",
          description: "Error al crear el lead",
          variant: "destructive"
        });
      }
      return;
    }

    // Lead real - comportamiento normal
    const currentLeads = getAllLeads();
    const lead = currentLeads.find(l => l.id === leadId);
    if (!lead) return;

    const sourceColumnId = lead.column_id;
    const previousLeads = [...currentLeads];

    // ✅ ACTUALIZACIÓN OPTIMISTA INMEDIATA - UI responde al instante
    // Actualizar estado local
    setLeads(currentLeads.map(l => l.id === leadId ? {
      ...l,
      column_id: targetColumnId,
      position: currentLeads.filter(x => x.column_id === targetColumnId).length
    } : l));

    // También actualizar el cache del hook de paginación
    moveLeadOptimistic(leadId, sourceColumnId, targetColumnId);

    // Llamada a BD en background (no bloquea UI)
    try {
      const {
        error
      } = await supabase.from('leads').update({
        column_id: targetColumnId,
        position: currentLeads.filter(l => l.column_id === targetColumnId).length
      }).eq('id', leadId);
      if (error) throw error;
    } catch (error) {
      // Revertir si falla
      console.error('Error moving lead:', error);
      setLeads(previousLeads);
      toast({
        title: "Error",
        description: "Error al mover el lead. Se revirtió el cambio.",
        variant: "destructive"
      });
    }
  };
  const handleDeleteLead = async (leadId: string) => {
    const {
      error
    } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) {
      console.error('Error deleting lead:', error);
      toast({
        title: "Error",
        description: "Error al eliminar el lead",
        variant: "destructive"
      });
      return;
    }
    setLeads(leads.filter(lead => lead.id !== leadId));
    toast({
      title: "Éxito",
      description: "Lead eliminado correctamente"
    });
  };
  const openEditColumnDialog = (column: LeadColumn) => {
    setEditingColumn(column);
    setNewColumnName(column.name);
    setNewColumnColor(column.color);
    setShowColumnDialog(true);
  };
  const openCreateColumnDialog = () => {
    if (!selectedWorkspace) {
      toast({
        title: "Atención",
        description: "Por favor selecciona un espacio de trabajo primero",
        variant: "default"
      });
      return;
    }
    setEditingColumn(null);
    setNewColumnName('');
    setNewColumnColor('#22c55e');
    setShowColumnDialog(true);
  };
  const openCreateLeadDialog = (columnId: string) => {
    setNewLead({
      name: '',
      email: '',
      phone: '',
      company: '',
      value: '',
      notes: '',
      column_id: columnId
    });
    setShowLeadDialog(true);
  };
  const openConvertDialog = (column: LeadColumn) => {
    setConvertingColumn(column);
    setContactListName(`Lista de ${column.name}`);
    setShowConvertDialog(true);
  };
  const openMessageTriggersDialog = (column: LeadColumn) => {
    setSelectedColumnForTriggers(column);
    setShowMessageTriggersDialog(true);
  };
  const closeMessageTriggersDialog = () => {
    setShowMessageTriggersDialog(false);
    setSelectedColumnForTriggers(null);
  };
  const handleConvertToContactList = async () => {
    if (!convertingColumn || !contactListName.trim()) return;
    try {
      // Obtener leads de la columna
      const columnLeads = leads.filter(lead => lead.column_id === convertingColumn.id);
      if (columnLeads.length === 0) {
        toast({
          title: "Error",
          description: "No hay leads en esta columna para convertir",
          variant: "destructive"
        });
        return;
      }

      // Crear la lista de contactos
      const {
        data: contactList,
        error: listError
      } = await supabase.from('contact_lists').insert({
        name: contactListName,
        description: `Lista creada desde la columna: ${convertingColumn.name}`,
        user_id: effectiveUserId
      }).select().single();
      if (listError) {
        console.error('Error creating contact list:', listError);
        toast({
          title: "Error",
          description: "Error al crear la lista de contactos",
          variant: "destructive"
        });
        return;
      }

      // Convertir leads a contactos
      const contactsToInsert = [];
      const contactListMembersToInsert = [];
      for (const lead of columnLeads) {
        if (lead.phone) {
          // Solo convertir leads que tengan teléfono
          // Crear contacto
          const {
            data: contact,
            error: contactError
          } = await supabase.from('contacts').insert({
            name: lead.name,
            phone_number: lead.phone,
            email: lead.email,
            user_id: effectiveUserId
          }).select().single();
          if (contactError) {
            console.error('Error creating contact:', contactError);
            continue; // Continuar con el siguiente lead
          }

          // Agregar a la lista de contactos
          const {
            error: memberError
          } = await supabase.from('contact_list_members').insert({
            contact_id: contact.id,
            contact_list_id: contactList.id
          });
          if (memberError) {
            console.error('Error adding contact to list:', memberError);
          }
        }
      }
      setShowConvertDialog(false);
      setConvertingColumn(null);
      setContactListName('');
      toast({
        title: "Éxito",
        description: `Lista de contactos "${contactListName}" creada correctamente`
      });
    } catch (error) {
      console.error('Error converting to contact list:', error);
      toast({
        title: "Error",
        description: "Error al convertir a lista de contactos",
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando...</div>
      </div>;
  }
  return <div className="space-y-6 bg-background min-h-screen p-6">
      {/* Header with Workspace Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Embudos </h1>
            <p className="text-muted-foreground mt-1">Organiza y gestiona tus leads en diferentes etapas</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Select value={selectedWorkspace || ''} onValueChange={setSelectedWorkspace}>
            <SelectTrigger className="w-[280px] bg-card border-border">
              <SelectValue placeholder="Seleccionar espacio" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map(workspace => <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>)}
            </SelectContent>
          </Select>

          {/* Indicador de actualización realtime */}
          {isRefreshing && <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md border border-primary/20">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs text-primary">Actualizando...</span>
            </div>}

          <Button variant="outline" size="icon" onClick={() => loadLeads()} disabled={loading || isRefreshing} title="Recargar leads">
            <RefreshCw className={`h-4 w-4 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {canCreateFunnels && !isPlayerChatWorkspace && <Button onClick={openCreateColumnDialog} className="bg-gradient-primary hover:opacity-90 transition-all duration-200 shadow-glow">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Columna
            </Button>}
        </div>
      </div>

      {/* Search and date filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_auto_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="lead-search" className="text-xs font-medium text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="lead-search"
                  value={searchFilter}
                  onChange={(event) => setSearchFilter(event.target.value)}
                  placeholder="Nombre o teléfono"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de fecha</Label>
              <Select value={dateFilterType} onValueChange={(value) => setDateFilterType(value as FunnelDateFilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(dateFilterLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Rango</Label>
              <DateRangeSelector
                dateRange={dateRange}
                onRangeChange={(range) => setDateRange({ startDate: startOfDay(range.startDate), endDate: endOfDay(range.endDate) })}
                onPresetSelect={(preset) => setDateRange(createFunnelPresetRange(preset))}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={dateFilterEnabled ? 'default' : 'outline'}
                onClick={() => setDateFilterEnabled(true)}
                className="flex-1 lg:flex-none"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Fechas
              </Button>
              {(dateFilterEnabled || searchFilter) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDateFilterEnabled(false);
                    setSearchFilter('');
                    setConversationIdsWithMessages(new Set());
                  }}
                  className="flex-1 lg:flex-none"
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Results Info */}
      {(searchFilter || dateFilterEnabled) && <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-2">
            {dateFilterEnabled ? <CalendarDays className="h-4 w-4 text-primary" /> : <Search className="h-4 w-4 text-primary" />}
            <span className="text-sm text-foreground">
              Mostrando {filteredLeads.length} de {paginatedLeads.length} conversaciones
              {dateFilterEnabled ? ` por ${dateFilterLabels[dateFilterType].toLowerCase()} entre ${dateRangeLabel}` : ''}
              {searchFilter ? ` que coinciden con "${searchFilter}"` : ''}
            </span>
            {isLoadingMessageRange && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          {filteredLeads.length === 0 && <span className="text-sm text-muted-foreground">No hay conversaciones en este rango de fechas</span>}
        </div>}

      <KanbanBoard
        columns={columns}
        leads={filteredLeads}
        onEditColumn={canEditFunnels ? openEditColumnDialog : undefined}
        onDeleteColumn={canDeleteFunnels ? handleDeleteColumn : undefined}
        onCreateLead={canCreateFunnels ? openCreateLeadDialog : undefined}
        onDeleteLead={canDeleteFunnels ? handleDeleteLead : undefined}
        onMoveLeadToColumn={canMoveContacts ? handleMoveLeadToColumn : undefined}
        onConvertToContactList={openConvertDialog}
        onManageMessageTriggers={openMessageTriggersDialog}
        onOpenConversation={handleLeadClick}
        onLoadMore={loadMore}
        getColumnState={getColumnState}
        isPlayerChatWorkspace={isPlayerChatWorkspace}
        allWorkspaces={workspaces}
      />

      {/* Column Dialog */}
      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent className="bg-[#2a3942] border-[#3e4c59] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">
              {editingColumn ? 'Editar embudo' : 'Agregar embudo'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Icono de edición centrado */}
          <div className="flex justify-center py-4">
            <div className="w-16 h-16 rounded-lg bg-[#202c33] flex items-center justify-center">
              <Edit className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="space-y-6">
            {/* Campo de nombre con badge */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3 bg-[#202c33] rounded-lg px-4 py-3">
                <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded">
                  {editingColumn ? columns.findIndex(c => c.id === editingColumn.id) + 1 : columns.length + 1}
                </span>
                <Input id="column-name" value={newColumnName} onChange={e => setNewColumnName(e.target.value)} placeholder="Nombre del embudo" className="flex-1 border-0 bg-transparent text-white placeholder:text-gray-500 focus-visible:ring-0 px-0 uppercase" />
              </div>
            </div>

            {/* Sección de colores */}
            <div className="space-y-3">
              <Label className="text-white text-lg font-semibold">Color</Label>
              <div className="grid grid-cols-9 gap-2">
                {/* Fila 1: Verdes */}
                {['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0891b2', '#0284c7', '#3b82f6', '#2563eb', '#1d4ed8'].map(color => <button key={color} type="button" onClick={() => setNewColumnColor(color)} className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${newColumnColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a3942]' : ''}`} style={{
                backgroundColor: color
              }} />)}
                
                {/* Fila 2: Purples y Magentas */}
                {['#8b5cf6', '#7c3aed', '#a855f7', '#d946ef', '#ec4899', '#db2777', '#ef4444', '#f87171', '#fb923c'].map(color => <button key={color} type="button" onClick={() => setNewColumnColor(color)} className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${newColumnColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a3942]' : ''}`} style={{
                backgroundColor: color
              }} />)}
                
                {/* Fila 3: Rojos y Naranjas */}
                {['#dc2626', '#b91c1c', '#b45309', '#d97706', '#f59e0b', '#f97316', '#fb923c', '#fbbf24', '#facc15'].map(color => <button key={color} type="button" onClick={() => setNewColumnColor(color)} className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${newColumnColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a3942]' : ''}`} style={{
                backgroundColor: color
              }} />)}
                
                {/* Fila 4: Grises y Negro */}
                {['#ffffff', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#000000'].map(color => <button key={color} type="button" onClick={() => setNewColumnColor(color)} className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${newColumnColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#2a3942]' : ''} ${color === '#ffffff' ? 'border border-gray-600' : ''}`} style={{
                backgroundColor: color
              }} />)}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button onClick={editingColumn ? handleUpdateColumn : handleCreateColumn} className="w-full bg-[#00a884] hover:bg-[#00a884]/90 text-white font-medium py-3 rounded-lg">
              <Edit className="h-4 w-4 mr-2" />
              {editingColumn ? 'Editar embudo' : 'Agregar embudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Dialog */}
      <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Embudo</DialogTitle>
            <DialogDescription>
              Agrega un nuevo embudo a la columna
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lead-name">Nombre *</Label>
              <Input id="lead-name" value={newLead.name} onChange={e => setNewLead({
              ...newLead,
              name: e.target.value
            })} placeholder="Nombre del lead" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={newLead.email} onChange={e => setNewLead({
              ...newLead,
              email: e.target.value
            })} placeholder="email@ejemplo.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-phone">Teléfono</Label>
              <Input id="lead-phone" value={newLead.phone} onChange={e => setNewLead({
              ...newLead,
              phone: e.target.value
            })} placeholder="+54 9 11 1234-5678" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-company">Empresa</Label>
              <Input id="lead-company" value={newLead.company} onChange={e => setNewLead({
              ...newLead,
              company: e.target.value
            })} placeholder="Nombre de la empresa" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-value">Valor Estimado</Label>
              <Input id="lead-value" type="number" value={newLead.value} onChange={e => setNewLead({
              ...newLead,
              value: e.target.value
            })} placeholder="1000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-notes">Notas</Label>
              <Textarea id="lead-notes" value={newLead.notes} onChange={e => setNewLead({
              ...newLead,
              notes: e.target.value
            })} placeholder="Notas adicionales..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLead}>
              Crear Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de conversión a lista de contactos */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Lista de Contactos</DialogTitle>
            <DialogDescription>
              Convertir todos los embudos de la columna "{convertingColumn?.name}" en una lista de contactos.
              Solo se convertirán los embudos que tengan número de teléfono.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact-list-name" className="text-right">
                Nombre de la lista
              </Label>
              <Input id="contact-list-name" value={contactListName} onChange={e => setContactListName(e.target.value)} className="col-span-3" placeholder="Nombre para la lista de contactos" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConvertToContactList}>
              Convertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Triggers Dialog */}
      <MessageTriggersDialog isOpen={showMessageTriggersDialog} onClose={closeMessageTriggersDialog} column={selectedColumnForTriggers} />
      {/* Modal de Chat */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setSelectedConversation(null);
          setSelectedConversationId(null);
          setSelectedWhatsAppSession(null);
        }}
        conversation={selectedConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        isSending={isSending}
        onWhatsAppSessionChange={handleWhatsAppSessionChange}
      />
      {/* Modal de Chat de Jugadores (player_chat) - usa cache + API externa, NO Supabase */}
      <ChatModalPlayerChat
        isOpen={isPlayerChatModalOpen}
        onClose={() => {
          setIsPlayerChatModalOpen(false);
          setSelectedPlayerChatId(null);
          setSelectedPlayerChat(null);
        }}
        playerChatId={selectedPlayerChatId}
        initialChat={selectedPlayerChat}
      />
    </div>;
};
export default Leads;