import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Search, MessageCircle, Phone, Send, SlidersHorizontal, AlertCircle, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import EmbudosFilter from './EmbudosFilter';
import { EmbudoResponse } from '@/services/embudoServices';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from '@/hooks/useProfile';
import { FilterMode, SessionOption } from '@/pages/Conversations';
import { useTags } from '@/hooks/useTags';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

type Conversation = Database['public']['Tables']['conversations']['Row'];

interface ContactWithTags {
  phone_number: string;
  tags: string[] | null;
}

interface Workspace {
  id: string;
  name: string;
  position: number;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isLoading: boolean;
  unreadCount: number;
  workspaces?: Workspace[];
  selectedWorkspace?: Workspace | null;
  onWorkspaceSelect?: (workspace: Workspace | null) => void;
  embudos?: EmbudoResponse[];
  selectedEmbudo?: EmbudoResponse | null;
  onEmbudoSelect?: (embudo: EmbudoResponse | null) => void;
  filterMode?: FilterMode;
  onFilterModeChange?: (mode: FilterMode) => void;
  sessionOptions?: SessionOption[];
  selectedSessionFilter?: string | null;
  onSessionFilterChange?: (sessionId: string | null) => void;
  assignmentFilter?: 'all' | 'mine' | 'unassigned';
  onAssignmentFilterChange?: (val: 'all' | 'mine' | 'unassigned') => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchTerm,
  onSearchChange,
  isLoading,
  unreadCount,
  workspaces = [],
  selectedWorkspace = null,
  onWorkspaceSelect = () => {},
  embudos = [],
  selectedEmbudo = null,
  onEmbudoSelect = () => {},
  filterMode = 'all',
  onFilterModeChange = () => {},
  sessionOptions = [],
  selectedSessionFilter = null,
  onSessionFilterChange = () => {},
  assignmentFilter = 'all',
  onAssignmentFilterChange = () => {}
}) => {
  const { isCajero } = useProfile();
  const { etiquetas, getTagColor } = useTags();
  const isMobile = useIsMobile();
  const [contactTags, setContactTags] = useState<Record<string, string[]>>({});
  const [lastMsgDir, setLastMsgDir] = useState<Record<string, 'outbound' | 'inbound'>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeight = 89;
  const overscan = 6;
  const viewportHeight = 720;

  // Cuántos filtros activos hay (para badge en mobile)
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (assignmentFilter !== 'all') n++;
    if (filterMode !== 'all') n++;
    if (selectedSessionFilter) n++;
    return n;
  }, [assignmentFilter, filterMode, selectedSessionFilter]);

  const pendingCount = useMemo(
    () => conversations.filter(conversation => (conversation.unread_count || 0) > 0).length,
    [conversations]
  );

  // Cargar etiquetas de contactos - lazy loading con debounce
  // Solo cargar cuando hay conversaciones visibles, no en cada cambio
  useEffect(() => {
    const loadContactTags = async () => {
      if (conversations.length === 0) return;
      
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(conversations.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);
      const visibleConversations = conversations.slice(startIndex, endIndex);
      const phoneNumbers = visibleConversations
        .map(c => c.phone_number)
        .filter(Boolean)
        .filter(phone => !contactTags[phone]); // Solo números que no tenemos cached
      
      if (phoneNumbers.length === 0) return;

      const { data: contacts } = await supabase
        .from('contacts')
        .select('phone_number, tags')
        .in('phone_number', phoneNumbers);

      if (contacts) {
        setContactTags(prev => {
          const updated = { ...prev };
          contacts.forEach(c => {
            if (c.tags && c.tags.length > 0) {
              updated[c.phone_number] = c.tags;
            }
          });
          return updated;
        });
      }
    };

    // Debounce para evitar llamadas excesivas
    const timeoutId = setTimeout(loadContactTags, 300);
    return () => clearTimeout(timeoutId);
  }, [conversations, scrollTop, contactTags]);

  // Cargar dirección del último mensaje (para mostrar "Tú:" o nombre del contacto)
  useEffect(() => {
    const loadLastMsgDir = async () => {
      if (conversations.length === 0) return;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(conversations.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);
      const visibleConversations = conversations.slice(startIndex, endIndex);
      const idsToFetch = visibleConversations
        .map(c => c.id)
        .filter(id => !(id in lastMsgDir));
      if (idsToFetch.length === 0) return;

      const results = await Promise.all(idsToFetch.map(async (id) => {
        const { data } = await supabase
          .from('messages')
          .select('direction')
          .eq('conversation_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { id, direction: (data?.direction as 'outbound' | 'inbound') || null };
      }));

      setLastMsgDir(prev => {
        const updated = { ...prev };
        results.forEach(r => {
          if (r.direction) updated[r.id] = r.direction;
        });
        return updated;
      });
    };
    const timeoutId = setTimeout(loadLastMsgDir, 300);
    return () => clearTimeout(timeoutId);
  }, [conversations, scrollTop, lastMsgDir]);

  // Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone: string | null) => {
    if (!phone) return 'Contacto';
    return '****' + phone.slice(-4);
  };
  
  // Formatear tiempo
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 168) {
      // 7 días
      return date.toLocaleDateString('es-ES', {
        weekday: 'short'
      });
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  // Obtener iniciales del nombre
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  const getSessionIcon = (type: SessionOption['type']) => {
    switch (type) {
      case 'whatsapp':
        return <Phone className="h-3 w-3 text-primary" />;
      case 'telegram':
        return <Send className="h-3 w-3 text-telegram-blue" />;
      case 'twilio':
        return <MessageCircle className="h-3 w-3 text-[hsl(var(--twilio-red))]" />;
    }
  };

  // Bloque reutilizable de selectores
  const filtersBlock = (
    <>
      {/* Filtro de Asignación */}
      <Select value={assignmentFilter} onValueChange={(v: 'all' | 'mine' | 'unassigned') => onAssignmentFilterChange(v)}>
        <SelectTrigger className="w-full mb-2 text-sm">
          <SelectValue placeholder="Asignación" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las asignaciones</SelectItem>
          <SelectItem value="mine">Mis conversaciones</SelectItem>
          <SelectItem value="unassigned">Sin asignar</SelectItem>
        </SelectContent>
      </Select>

      {/* Filtro de Modo */}
      <Select value={filterMode} onValueChange={(value: FilterMode) => onFilterModeChange(value)}>
        <SelectTrigger className="w-full mb-2 text-sm">
          <SelectValue placeholder="Mostrar conversaciones" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las conversaciones</SelectItem>
          <SelectItem value="pending">Sin responder</SelectItem>
          <SelectItem value="stale">Sin respuesta +30 min</SelectItem>
          <SelectItem value="offline">Asignadas offline</SelectItem>
          <SelectItem value="bot_off">IA apagada / sin humano</SelectItem>
          <SelectItem value="urgent">Urgentes comprobante</SelectItem>
          <SelectItem value="unassigned">Sin embudo asignado</SelectItem>
          <SelectItem value="funnel">Por embudo</SelectItem>
          <SelectItem value="groups">Grupos</SelectItem>
          <SelectItem value="individual">Individuales</SelectItem>
        </SelectContent>
      </Select>

      {/* Selector de Sesión */}
      {sessionOptions.length > 0 && (
        <Select 
          value={selectedSessionFilter || 'all'} 
          onValueChange={value => onSessionFilterChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-full mb-2 text-sm">
            <SelectValue placeholder="Todas las sesiones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sesiones</SelectItem>
            {sessionOptions.map(session => (
              <SelectItem key={session.id} value={session.id}>
                <div className="flex items-center gap-2">
                  {getSessionIcon(session.type)}
                  <span>{session.name}</span>
                  <span className="text-xs text-muted-foreground">({session.identifier.slice(-6)})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Selector de Workspace (solo cuando filterMode es 'funnel') */}
      {filterMode === 'funnel' && workspaces.length > 0 && (
        <Select value={selectedWorkspace?.id || ''} onValueChange={value => {
          const workspace = workspaces.find(w => w.id === value);
          onWorkspaceSelect(workspace || null);
        }}>
          <SelectTrigger className="w-full bg-primary text-primary-foreground border-2 border-primary hover:bg-primary/90 font-medium text-sm">
            <SelectValue placeholder="Seleccionar espacio">
              {selectedWorkspace?.name || 'Seleccionar espacio'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map(workspace => (
              <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(conversations.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);
    return { start, end, items: conversations.slice(start, end) };
  }, [conversations, scrollTop]);

  return <div className="h-full border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Chats</h1>
            {unreadCount > 0 && <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>}
          </div>
          {isMobile && (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="text-xs">Filtros</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center text-[10px] absolute -top-1 -right-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {filtersBlock}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Filtros inline solo en desktop */}
        {!isMobile && filtersBlock}

        {/* Barra de búsqueda */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conversaciones..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="pl-10" />
        </div>

        {filterMode === 'pending' && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 text-primary" />
            <span>{pendingCount} conversación{pendingCount === 1 ? '' : 'es'} con mensajes pendientes</span>
          </div>
        )}
      </div>

      {/* Filtro de Embudos (solo cuando filterMode es 'funnel') */}
      {filterMode === 'funnel' && embudos.length > 0 && (
        <EmbudosFilter embudos={embudos} selectedEmbudo={selectedEmbudo} onEmbudoSelect={onEmbudoSelect} />
      )}


      {/* Lista de conversaciones */}
      <ScrollArea className="flex-1" onScrollCapture={(event) => setScrollTop((event.target as HTMLElement).scrollTop)}>
        {isLoading ? <div className="p-4 text-center text-muted-foreground">
            Cargando conversaciones...
          </div> : conversations.length === 0 ? <div className="p-4 text-center text-muted-foreground">
            {searchTerm ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
          </div> : <div className="relative" style={{ height: conversations.length * itemHeight }}>
            <div className="absolute left-0 right-0 divide-y divide-border" style={{ transform: `translateY(${visibleRange.start * itemHeight}px)` }}>
              {visibleRange.items.map(conversation => <ConversationItem key={conversation.id} conversation={conversation} isSelected={selectedConversation?.id === conversation.id} onSelect={() => onSelectConversation(conversation)} formatTime={formatTime} getInitials={getInitials} isCajero={isCajero} maskPhoneNumber={maskPhoneNumber} tags={contactTags[conversation.phone_number] || []} getTagColor={getTagColor} lastMsgDirection={lastMsgDir[conversation.id]} />)}
            </div>
          </div>}
      </ScrollArea>
    </div>;
};

// Componente separado y memoizado para cada item de conversación
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  formatTime: (dateString: string) => string;
  getInitials: (name: string | null) => string;
  isCajero: boolean;
  maskPhoneNumber: (phone: string | null) => string;
  tags: string[];
  getTagColor: (tagName: string) => string;
  lastMsgDirection?: 'outbound' | 'inbound';
}

const ConversationItem = memo<ConversationItemProps>(({
  conversation,
  isSelected,
  onSelect,
  formatTime,
  getInitials,
  isCajero,
  maskPhoneNumber,
  tags,
  getTagColor,
  lastMsgDirection
}) => {
  const hasUnread = (conversation.unread_count || 0) > 0;

  // Determinar el ícono según el tipo de canal
  const channelIcon = useMemo(() => {
    if (conversation.channel_type === 'whatsapp') {
      return <Phone className="h-4 w-4 text-green-500" />;
    }
    if (conversation.channel_type === 'telegram') {
      return <MessageCircle className="h-4 w-4 text-telegram-blue" />;
    }
    if (conversation.channel_type === 'twilio') {
      return <MessageCircle className="h-4 w-4 text-[hsl(var(--twilio-red))]" />;
    }
    return null;
  }, [conversation.channel_type]);

  const isGroup = conversation.is_group === true || (conversation.phone_number ?? '').endsWith('@g.us');
  const groupName = (conversation.group_subject ?? conversation.pushname ?? conversation.contact_name ?? '').replace(/^👥\s*/, '').trim();
  // Mostrar pushname (nickname de WhatsApp) primero; si falta, contact_name; finalmente el número
  const contactDisplayName = conversation.pushname || conversation.contact_name || null;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "h-[89px] p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted border-l-4 border-l-transparent",
        hasUnread && !isGroup && "bg-primary/10 border-l-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]",
        hasUnread && isGroup && "bg-emerald-500/10 border-l-emerald-500 shadow-[inset_0_0_0_1px_hsl(var(--emerald-500)/0.15)]",
        isGroup && !hasUnread && "border-l-emerald-500/40",
        isSelected && "bg-muted"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-11 w-11 md:h-12 md:w-12">
            <AvatarFallback className={cn(isGroup ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground")}>
              {isGroup ? <Users className="h-5 w-5" /> : getInitials(contactDisplayName)}
            </AvatarFallback>
          </Avatar>
          {channelIcon && (
            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border">
              {channelIcon}
            </div>
          )}
          {hasUnread && (
            <span className={cn("absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background", isGroup ? "bg-emerald-500" : "bg-primary")} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isGroup && <Users className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
              <h3 className={cn("text-sm md:text-base truncate", hasUnread ? "font-bold text-foreground" : "font-medium")}>
                {isGroup ? (groupName || 'Grupo') : (contactDisplayName || (isCajero ? maskPhoneNumber(conversation.whatsapp_number) : conversation.whatsapp_number))}
              </h3>
            </div>
            <span className="text-[11px] md:text-xs text-muted-foreground shrink-0">
              {conversation.last_message_time && formatTime(conversation.last_message_time)}
            </span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.slice(0, 2).map((tag) => (
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
              {tags.length > 2 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <p className={cn("text-sm truncate", hasUnread ? "font-medium text-foreground" : "text-muted-foreground")}>
              {conversation.last_message ? (
                <>
                  {lastMsgDirection === 'outbound' && (
                    <span className="font-medium text-foreground/80">Tú: </span>
                  )}
                  {lastMsgDirection === 'inbound' && contactDisplayName && (
                    <span className="font-medium text-foreground/80">{contactDisplayName.split(' ')[0]}: </span>
                  )}
                  {conversation.last_message}
                </>
              ) : 'Sin mensajes'}
            </p>
            {hasUnread && (
              <Badge variant="destructive" className="text-xs ml-2 min-w-6 justify-center shadow-sm">
                {conversation.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default memo(ConversationList);