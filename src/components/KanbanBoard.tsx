import React, { useState, useCallback, memo, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, MoreVertical, Building, Mail, Phone, DollarSign, Users, MessageSquare, BotOff, Bot, Tag, Clock, Loader2, Send, Globe, Plug, Gamepad2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper function to get channel icon
const getChannelIcon = (channelType: string | null | undefined, isWhatsAppApi?: boolean) => {
  if (!channelType) return null;
  switch (channelType.toLowerCase()) {
    case 'whatsapp':
      if (isWhatsAppApi) {
        return <Plug className="h-2.5 w-2.5 text-violet-500" />;
      }
      return <MessageSquare className="h-2.5 w-2.5 text-green-500" />;
    case 'telegram':
      return <Send className="h-2.5 w-2.5 text-blue-500" />;
    case 'twilio':
      return <Phone className="h-2.5 w-2.5 text-red-500" />;
    case 'webchat':
    case 'web':
      return <Globe className="h-2.5 w-2.5 text-primary" />;
    case 'player_chat':
      return <Gamepad2 className="h-2.5 w-2.5 text-orange-500" />;
    default:
      return <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />;
  }
};
import type { Tables } from '@/integrations/supabase/types';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { TriggerActivationService } from '@/services/triggerActivationService';
import { useAuth } from '@/hooks/useAuth';
import { useBotBlockMap } from '@/hooks/useBotBlockMap';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTags, syncTagsBetweenContactAndLead } from '@/hooks/useTags';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
type LeadColumn = Tables<'lead_columns'>;
type Lead = Tables<'leads'>;
interface ConversationSummary {
  id: string;
  phone_number: string;
  pushname: string | null;
  last_message: string | null;
  last_message_time: string | null;
  last_inbound_message_time?: string | null;
  unread_count: number | null;
  channel_type?: string | null;
  whatsapp_number?: string | null;
}
interface LeadWithColumn extends Lead {
  lead_columns?: LeadColumn;
  conversations?: ConversationSummary[];
  isVirtual?: boolean;
  originalConversationId?: string;
}
interface ColumnState {
  hasMore: boolean;
  loading: boolean;
  totalCount: number;
  loadedCount: number;
}
interface KanbanBoardProps {
  columns: LeadColumn[];
  leads: LeadWithColumn[];
  onEditColumn: (column: LeadColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  onCreateLead: (columnId: string) => void;
  onEditLead?: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onMoveLeadToColumn?: (leadId: string, targetColumnId: string) => void;
  onConvertToContactList?: (column: LeadColumn) => void;
  onManageMessageTriggers?: (column: LeadColumn) => void;
  onOpenConversation?: (lead: LeadWithColumn) => void;
  allWorkspaces?: {
    id: string;
    name: string;
    channel_type?: string;
  }[];
  onMoveLeadToWorkspace?: (leadId: string, targetWorkspaceId: string) => void;
  // Nuevas props para paginación
  onLoadMore?: (columnId: string) => void;
  getColumnState?: (columnId: string) => ColumnState;
  // Flag para player_chat: oculta botones de crear/eliminar columna y agregar lead
  isPlayerChatWorkspace?: boolean;
}
interface LeadCardProps {
  lead: LeadWithColumn;
  index: number;
  onEdit?: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
  onOpenConversation?: (lead: LeadWithColumn) => void;
  getTagColor: (tagName: string) => string;
  allWorkspaces?: {
    id: string;
    name: string;
    channel_type?: string;
  }[];
  onMoveToWorkspace?: (leadId: string, workspaceId: string) => void;
  apiConnectionNumbers?: Set<string>;
  botBlockMap?: ReturnType<typeof useBotBlockMap>;
}
const LeadCardComponent: React.FC<LeadCardProps & {
  etiquetas: any[];
  onTagsUpdated?: () => void;
}> = ({
  lead,
  index,
  onEdit,
  onDelete,
  onOpenConversation,
  getTagColor,
  etiquetas,
  onTagsUpdated,
  allWorkspaces,
  onMoveToWorkspace,
  apiConnectionNumbers,
  botBlockMap
}) => {
  const navigate = useNavigate();
  const isBlocked = botBlockMap?.isBlocked(lead.phone) ?? false;
  const isBotToggling = botBlockMap?.isLoading(lead.phone) ?? false;
  const toggleBotBlock = () => lead.phone && botBlockMap?.toggleBotBlock(lead.phone, lead.name);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [leadTags, setLeadTags] = useState<string[]>(lead.tags || []);
  const [savingTags, setSavingTags] = useState(false);
  
  // Ref para detectar click vs drag
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  
  const hasConversation = lead.conversations && lead.conversations.length > 0;
  const conversation = hasConversation ? lead.conversations[0] : null;

  // IMPORTANTE: estas declaraciones deben ir ANTES de cualquier useQuery que las use
  // (antes había un TDZ que causaba "Error al mostrar este componente")
  const displayName = conversation?.pushname || (conversation as any)?.contact_name || lead.name;
  const channelType = conversation?.channel_type || null;
  const isWhatsAppApi = channelType === 'whatsapp' && !!conversation?.whatsapp_number && !!apiConnectionNumbers?.has(conversation.whatsapp_number);
  const conversationIsGroup = (conversation as any)?.is_group === true || (conversation?.phone_number ?? '').endsWith('@g.us');
  const groupName = ((conversation as any)?.group_subject ?? '').trim()
    || (conversation?.pushname ?? '').replace(/^👥\s*/, '').trim()
    || 'Grupo';
  const lastMessage = conversation?.last_message;
  const lastMessageTime = conversation?.last_message_time;
  const unreadCount = conversation?.unread_count || 0;
  const hasUnread = unreadCount > 0;

  // Última dirección del mensaje para mostrar "Tú:" o nombre del contacto
  // Solo consultamos Supabase si NO es player_chat (esos datos viven en la API externa/cache)
  const { data: lastMsgDirection } = useQuery({
    queryKey: ['lastMsgDir', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return null;
      const { data } = await supabase
        .from('messages')
        .select('direction')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.direction as 'outbound' | 'inbound') || null;
    },
    enabled: !!conversation?.id && channelType !== 'player_chat',
    staleTime: 30000,
  });
  const handleOpenConversation = async () => {
    if (onOpenConversation) {
      onOpenConversation(lead);
      return;
    }
    // Player Chats: navega a /chat-jugadores (la página /conversaciones los excluye)
    if (channelType === 'player_chat' && conversation) {
      navigate('/chat-jugadores', {
        state: { conversationId: conversation.id }
      });
      return;
    }
    if (lead.phone) {
      // Buscar conversación por número de teléfono
      const {
        data: conversations
      } = await supabase.from('conversations').select('id').eq('phone_number', lead.phone.replace(/\D/g, '')).limit(1);
      if (conversations && conversations.length > 0) {
        navigate('/conversations', {
          state: {
            conversationId: conversations[0].id
          }
        });
      } else if (conversation) {
        // Fallback a la conversación pre-cargada
        navigate('/conversations', {
          state: {
            conversationId: conversation.id
          }
        });
      }
    }
  };

  // Manejar toggle de etiqueta
  const handleTagToggle = (tagName: string) => {
    setLeadTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };

  // Guardar etiquetas
  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      // Actualizar lead
      const {
        error
      } = await supabase.from('leads').update({
        tags: leadTags
      }).eq('id', lead.id);
      if (error) throw error;

      // Sincronizar con contacto si tiene teléfono
      if (lead.phone) {
        await syncTagsBetweenContactAndLead(lead.phone, leadTags);
      }
      toast({
        title: 'Etiquetas actualizadas'
      });
      setShowTagDialog(false);
      onTagsUpdated?.();
    } catch (error) {
      console.error('Error saving tags:', error);
      toast({
        title: 'Error al guardar etiquetas',
        variant: 'destructive'
      });
    } finally {
      setSavingTags(false);
    }
  };
  // Format time and date (hour above, date below)
  const formattedTime = lastMessageTime 
    ? format(new Date(lastMessageTime), 'hh:mm a', { locale: es })
    : null;
  const formattedDate = lastMessageTime
    ? format(new Date(lastMessageTime), 'dd/MM', { locale: es })
    : null;

  return <>
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`mb-2 transition-all duration-200 ${snapshot.isDragging ? 'scale-105 rotate-1 z-50 opacity-95' : 'animate-kanban-drop'}`}>
<Card
            className={`p-3 transition-all cursor-grab border-border/40 bg-card/80 ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/30 cursor-grabbing' : 'hover:bg-muted/30 hover:shadow-md'} ${lead.isVirtual ? 'border-l-4 border-l-amber-500/70' : ''} ${conversationIsGroup && !hasUnread ? 'border-l-4 border-l-emerald-500/60' : ''} ${hasUnread ? 'border-l-4 border-l-primary bg-primary/10 ring-1 ring-primary/20 shadow-sm' : ''}`}
            onMouseDown={(e) => {
              dragStartPos.current = { x: e.clientX, y: e.clientY };
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              // Ignorar si es un botón
              if (target.closest('button')) return;

              // Ignorar si estaba arrastrando
              if (snapshot.isDragging) return;

              // Verificar si fue un click real (mouse no se movió mucho)
              if (dragStartPos.current) {
                const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
                const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
                if (deltaX > 5 || deltaY > 5) {
                  // Fue un intento de drag, no abrir conversación
                  return;
                }
              }

              // Siempre abrir conversación: el modal decide qué hacer según channel_type.
              // Antes se exigía lead.phone truthy, lo que impedía abrir conversaciones
              // player_chat sin WhatsApp registrado.
              handleOpenConversation();
            }}
          >
            <div className="flex items-start gap-3">
              {/* Avatar con icono de canal superpuesto */}
              <div className="relative shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${lead.isVirtual ? 'bg-amber-500/20 text-amber-600' : conversationIsGroup ? 'bg-emerald-600 text-white' : hasUnread ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {conversationIsGroup ? <Users className="h-5 w-5" /> : displayName.charAt(0).toUpperCase()}
                </div>
                {hasUnread && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />}
                {/* Icono de canal superpuesto */}
                {channelType && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                    {conversationIsGroup ? <Users className="h-2.5 w-2.5 text-emerald-600" /> : getChannelIcon(channelType, isWhatsAppApi)}
                  </div>
                )}
              </div>
              
              {/* Contenido principal */}
              <div className="flex-1 min-w-0">
                {/* Fila 1: Nombre + Hora */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm truncate ${hasUnread ? 'font-bold text-foreground' : 'font-semibold'}`}>
                      {displayName}
                    </span>
                    {lead.isVirtual && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30 shrink-0">
                        Nuevo
                      </Badge>
                    )}
                    {conversationIsGroup && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/30 shrink-0">
                        <Users className="h-2.5 w-2.5 mr-0.5" />{groupName}
                      </Badge>
                    )}
                    {hasUnread && (
                      <Badge variant="destructive" className="min-h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                        {unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {formattedTime}
                    </span>
                    <span className="text-[9px] text-muted-foreground/70 leading-tight">
                      {formattedDate}
                    </span>
                  </div>
                </div>
                
                {/* Fila 2: Último mensaje + Icono bot */}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={`text-xs truncate flex-1 ${hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {lastMessage ? (
                      <>
                        {lastMsgDirection === 'outbound' && (
                          <span className="font-medium text-foreground/80">Tú: </span>
                        )}
                        {lastMsgDirection === 'inbound' && displayName && (
                          <span className="font-medium text-foreground/80">{displayName.split(' ')[0]}: </span>
                        )}
                        {lastMessage.length > 35 ? lastMessage.substring(0, 35) + '...' : lastMessage}
                      </>
                    ) : 'Sin mensajes'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {lead.phone && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0 hover:bg-primary/10" 
                        onClick={toggleBotBlock} 
                        disabled={isBotToggling}
                        title={isBlocked ? 'Bot desactivado - Click para activar' : 'Bot activo - Click para desactivar'}
                      >
                        {isBlocked ? <BotOff className="h-3.5 w-3.5 text-destructive" /> : <Bot className="h-3.5 w-3.5 text-green-500" />}
                      </Button>
                    )}
                    {(onEdit || onDelete || lead.phone) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {lead.phone && (
                            <DropdownMenuItem onClick={handleOpenConversation}>
                              <MessageSquare className="h-3 w-3 mr-2" />
                              Ver Conversación
                            </DropdownMenuItem>
                          )}
                          {lead.phone && (
                            <DropdownMenuItem onClick={toggleBotBlock} disabled={isBotToggling}>
                              {isBlocked ? (
                                <>
                                  <Bot className="h-3 w-3 mr-2" />
                                  Activar Bot
                                </>
                              ) : (
                                <>
                                  <BotOff className="h-3 w-3 mr-2" />
                                  Desactivar Bot
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(lead)}>
                              <Edit className="h-3 w-3 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setShowTagDialog(true)}>
                            <Tag className="h-3 w-3 mr-2" />
                            Etiquetas
                          </DropdownMenuItem>
                          {allWorkspaces && allWorkspaces.length > 1 && onMoveToWorkspace && (
                            <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                              <Users className="h-3 w-3 mr-2" />
                              Mover a otro espacio
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem onClick={() => onDelete(lead.id)} className="text-destructive">
                              <Trash2 className="h-3 w-3 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                
                {/* Fila 3: Etiquetas */}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lead.tags.slice(0, 3).map(tag => (
                      <Badge 
                        key={tag} 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 h-4 border-0" 
                        style={{
                          backgroundColor: `${getTagColor(tag)}20`,
                          color: getTagColor(tag)
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                    {lead.tags.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        +{lead.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>}
    </Draggable>
    {/* Dialog de etiquetas - fuera del Draggable */}
    <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gestionar Etiquetas</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-60">
          <div className="space-y-2 p-1">
            {etiquetas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">
                No hay etiquetas disponibles
              </p> : etiquetas.map(etiqueta => <div key={etiqueta.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => handleTagToggle(etiqueta.nombre)}>
                  <Checkbox checked={leadTags.includes(etiqueta.nombre)} onCheckedChange={() => handleTagToggle(etiqueta.nombre)} />
                  <div className="w-3 h-3 rounded-full" style={{
                backgroundColor: etiqueta.color
              }} />
                  <span className="text-sm">{etiqueta.nombre}</span>
                </div>)}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowTagDialog(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveTags} disabled={savingTags}>
            {savingTags ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Dialog para mover a otro workspace */}
    <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mover a otro espacio</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-60">
          <div className="space-y-2 p-1">
            {allWorkspaces && allWorkspaces.length > 0 ? allWorkspaces.map(ws => <Button key={ws.id} variant="ghost" className="w-full justify-start" onClick={() => {
              if (onMoveToWorkspace) {
                onMoveToWorkspace(lead.id, ws.id);
                setShowMoveDialog(false);
              }
            }}>
                  <Users className="h-4 w-4 mr-2" />
                  {ws.name}
                  {ws.channel_type && <Badge variant="secondary" className="ml-auto text-xs">
                      {ws.channel_type}
                    </Badge>}
                </Button>) : <p className="text-sm text-muted-foreground text-center py-4">
                No hay otros espacios disponibles
              </p>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>;
};

// Memoized LeadCard component
const LeadCard = memo(LeadCardComponent, (prevProps, nextProps) => {
  return prevProps.lead.id === nextProps.lead.id && prevProps.lead.name === nextProps.lead.name && prevProps.lead.phone === nextProps.lead.phone && prevProps.lead.column_id === nextProps.lead.column_id && prevProps.lead.value === nextProps.lead.value && prevProps.index === nextProps.index && JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags) && JSON.stringify(prevProps.lead.conversations) === JSON.stringify(nextProps.lead.conversations);
});
LeadCard.displayName = 'LeadCard';
export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  leads,
  onEditColumn,
  onDeleteColumn,
  onCreateLead,
  onEditLead,
  onDeleteLead,
  onMoveLeadToColumn,
  onConvertToContactList,
  onManageMessageTriggers,
  onOpenConversation,
  allWorkspaces,
  onMoveLeadToWorkspace,
  onLoadMore,
  getColumnState,
  isPlayerChatWorkspace = false
}) => {
  const {
    user
  } = useAuth();
  const {
    getTagColor,
    etiquetas,
    refresh: refreshTags
  } = useTags();
  const queryClient = useQueryClient();
  const safeLeads = useMemo(() => leads.filter((lead): lead is LeadWithColumn => Boolean(lead?.id)), [leads]);
  const visiblePhones = useMemo(() => safeLeads.map(lead => lead.phone).filter(Boolean) as string[], [safeLeads]);
  const botBlockMap = useBotBlockMap(visiblePhones);

  // Fetch WhatsApp API connection phone numbers
  const { data: apiConnectionNumbers } = useQuery({
    queryKey: ['whatsapp-api-connection-numbers', user?.id],
    queryFn: async () => {
      if (!user?.id) return new Set<string>();
      const { data } = await supabase
        .from('whatsapp_connections')
        .select('phone_number, connection_subtype')
        .eq('user_id', user.id)
        .eq('connection_subtype', 'api');
      return new Set((data || []).map(c => c.phone_number));
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });
  const getLeadsByColumn = (columnId: string) => {
    return safeLeads.filter(lead => lead.column_id === columnId).sort((a, b) => {
      // Obtener el último mensaje de cada lead
      const lastMessageA = a.conversations?.[0]?.last_message_time;
      const lastMessageB = b.conversations?.[0]?.last_message_time;

      // Si ninguno tiene conversación, mantener orden por posición
      if (!lastMessageA && !lastMessageB) return a.position - b.position;

      // Leads sin conversación van al final
      if (!lastMessageA) return 1;
      if (!lastMessageB) return -1;

      // Ordenar por fecha descendente (más reciente primero)
      return new Date(lastMessageB).getTime() - new Date(lastMessageA).getTime();
    });
  };
  const handleDragEnd = (result: DropResult) => {
    const {
      destination,
      source,
      draggableId
    } = result;
    if (!destination) {
      return;
    }
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Move lead to different column
    if (destination.droppableId !== source.droppableId && onMoveLeadToColumn) {
      // ✅ MOVER PRIMERO (actualización optimista inmediata)
      onMoveLeadToColumn(draggableId, destination.droppableId);

      // Encontrar el lead que se está moviendo
      const movedLead = leads.find(lead => lead.id === draggableId);

      // ✅ TRIGGERS EN BACKGROUND (fire and forget - no bloquea UI)
      if (movedLead && user) {
        TriggerActivationService.activateTriggersOnLeadMove({
          leadId: movedLead.id,
          leadName: movedLead.name,
          leadPhone: movedLead.phone || undefined,
          fromColumnId: source.droppableId,
          toColumnId: destination.droppableId,
          userId: user.id
        }).catch(error => {
          console.error('Error al activar disparadores:', error);
        });
      }
    }
  };
  return <DragDropContext onDragEnd={handleDragEnd}>
      <TooltipProvider>
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-4 px-1 snap-x snap-mandatory md:snap-none scroll-smooth">
          {columns.map(column => {
          const columnLeads = getLeadsByColumn(column.id);
          const columnState = getColumnState?.(column.id);

          // Contar conversaciones en este embudo
          const conversationsCount = columnLeads.reduce((count, lead) => {
            return count + (lead.conversations?.length || 0);
          }, 0);
           return <ColumnWithInfiniteScroll key={column.id} column={column} columnLeads={columnLeads} columnState={columnState} conversationsCount={conversationsCount} onEditColumn={onEditColumn} onDeleteColumn={onDeleteColumn} onCreateLead={onCreateLead} onEditLead={onEditLead} onDeleteLead={onDeleteLead} onConvertToContactList={onConvertToContactList} onManageMessageTriggers={onManageMessageTriggers} onOpenConversation={onOpenConversation} onLoadMore={onLoadMore} allWorkspaces={allWorkspaces} onMoveLeadToWorkspace={onMoveLeadToWorkspace} getTagColor={getTagColor} etiquetas={etiquetas} refreshTags={refreshTags} queryClient={queryClient} apiConnectionNumbers={apiConnectionNumbers} botBlockMap={botBlockMap} isPlayerChatWorkspace={isPlayerChatWorkspace} />;
        })}
        </div>
      </TooltipProvider>
    </DragDropContext>;
};

// Componente de columna con scroll infinito
interface ColumnWithInfiniteScrollProps {
  column: LeadColumn;
  columnLeads: LeadWithColumn[];
  columnState?: ColumnState;
  conversationsCount: number;
  onEditColumn: (column: LeadColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  onCreateLead: (columnId: string) => void;
  onEditLead?: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onConvertToContactList?: (column: LeadColumn) => void;
  onManageMessageTriggers?: (column: LeadColumn) => void;
  onOpenConversation?: (lead: LeadWithColumn) => void;
  onLoadMore?: (columnId: string) => void;
  allWorkspaces?: {
    id: string;
    name: string;
    channel_type?: string;
  }[];
  onMoveLeadToWorkspace?: (leadId: string, targetWorkspaceId: string) => void;
  getTagColor: (tagName: string) => string;
  etiquetas: any[];
  refreshTags: () => void;
  queryClient: any;
  apiConnectionNumbers?: Set<string>;
  botBlockMap?: ReturnType<typeof useBotBlockMap>;
  isPlayerChatWorkspace?: boolean; // Cuando es true: oculta eliminar columna y agregar lead
}
const ColumnWithInfiniteScroll: React.FC<ColumnWithInfiniteScrollProps> = ({
  column,
  columnLeads,
  columnState,
  conversationsCount,
  onEditColumn,
  onDeleteColumn,
  isPlayerChatWorkspace = false,
  onCreateLead,
  onEditLead,
  onDeleteLead,
  onConvertToContactList,
  onManageMessageTriggers,
  onOpenConversation,
  onLoadMore,
  allWorkspaces,
  onMoveLeadToWorkspace,
  getTagColor,
  etiquetas,
  refreshTags,
  queryClient,
  apiConnectionNumbers,
  botBlockMap
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  // Filtrar leads por no leídos si está activo
  const filteredLeads = useMemo(() => {
    if (!showOnlyUnread) return columnLeads;
    return columnLeads.filter(lead => {
      const conversation = lead.conversations?.[0];
      return conversation && (conversation.unread_count || 0) > 0;
    });
  }, [columnLeads, showOnlyUnread]);

  // IntersectionObserver para detectar cuando llega al final
  useEffect(() => {
    if (!onLoadMore || !columnState?.hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !columnState.loading && columnState.hasMore) {
        onLoadMore(column.id);
      }
    }, {
      root: scrollContainerRef.current,
      rootMargin: '100px',
      threshold: 0.1
    });
    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [column.id, onLoadMore, columnState?.hasMore, columnState?.loading]);
  return <div className="flex-shrink-0 w-[85vw] max-w-[320px] md:w-64 snap-center md:snap-align-none">
      <Card className="h-full border-t-4 bg-card/50 backdrop-blur-sm" style={{
      borderTopColor: column.color
    }}>
        <CardHeader className="pb-2 pt-3 px-3 md:pb-3 md:pt-4 md:px-4">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 flex-1 cursor-help">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide truncate">
                    {column.name}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-bold shrink-0">
                    {columnState?.totalCount !== undefined ? `${columnLeads.length}/${columnState.totalCount}` : columnLeads.length}
                  </Badge>
                  {column.is_default && <Badge variant="outline" className="text-xs shrink-0">
                      Por defecto
                    </Badge>}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#1f2c34] border-[#2a3942] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{column.name}</span>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">{conversationsCount}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={showOnlyUnread ? "default" : "ghost"} 
                  size="sm" 
                  className={`ml-auto h-7 w-7 p-0 ${showOnlyUnread ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setShowOnlyUnread(!showOnlyUnread)}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showOnlyUnread ? 'Ver todos los leads' : 'Solo no leídos'}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditColumn(column)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {onManageMessageTriggers && <DropdownMenuItem onClick={() => onManageMessageTriggers(column)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Disparadores de Mensaje
                  </DropdownMenuItem>}
                {onConvertToContactList && <DropdownMenuItem onClick={() => onConvertToContactList(column)}>
                    <Users className="h-4 w-4 mr-2" />
                    Convertir a Lista de Contactos
                  </DropdownMenuItem>}
                {!column.is_default && !isPlayerChatWorkspace && <DropdownMenuItem onClick={() => onDeleteColumn(column.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {/* Add Lead Button - oculto en player_chat (no se pueden agregar leads manualmente) */}
          {!isPlayerChatWorkspace && (
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8" onClick={() => onCreateLead(column.id)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              <span className="text-xs">Agregar Lead</span>
            </Button>
          )}

          {/* Droppable Area for Leads con scroll */}
          <div ref={scrollContainerRef} className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-[200px] space-y-2 rounded-lg transition-all duration-200 ${snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary/40 p-2 scale-[1.01]' : 'border-2 border-transparent'}`}>
                  {filteredLeads.map((lead, index) => <LeadCard key={lead.id} lead={lead} index={index} onEdit={onEditLead} onDelete={onDeleteLead} onOpenConversation={onOpenConversation} getTagColor={getTagColor} etiquetas={etiquetas} allWorkspaces={allWorkspaces} onMoveToWorkspace={onMoveLeadToWorkspace} apiConnectionNumbers={apiConnectionNumbers} botBlockMap={botBlockMap} onTagsUpdated={() => {
                refreshTags();
                queryClient.invalidateQueries({
                  queryKey: ['leads']
                });
              }} />)}
                  {provided.placeholder}
                  
                  {/* Sentinel para infinite scroll */}
                  {columnState?.hasMore && !showOnlyUnread && <div ref={sentinelRef} className="py-4 flex justify-center">
                      {columnState.loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Button variant="ghost" size="sm" onClick={() => onLoadMore?.(column.id)} className="text-xs text-muted-foreground">
                          Cargar más...
                        </Button>}
                    </div>}
                  
                  {filteredLeads.length === 0 && columnLeads.length > 0 && showOnlyUnread && <div className="text-center text-muted-foreground text-sm py-8">
                      No hay mensajes no leídos
                    </div>}
                  
                  {columnLeads.length === 0 && !columnState?.loading && <div className="text-center text-muted-foreground text-sm py-8">
                      No hay leads en esta columna
                    </div>}
                  
                  {columnLeads.length === 0 && columnState?.loading && <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>}
                </div>}
            </Droppable>
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default KanbanBoard;