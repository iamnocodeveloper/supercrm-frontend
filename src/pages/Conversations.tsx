import React, { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConversationsTour } from '@/hooks/useConversationsTour';

import ConversationList from '@/components/conversations/ConversationList';
import ChatArea from '@/components/conversations/ChatArea';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ContactInfoPanel } from '@/components/conversations/ContactInfoPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useConversations, useMessages } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { useTwilioConnections } from '@/hooks/useTwilioConnections';
import { useTelegramConnections } from '@/hooks/useTelegramConnections';
import { useIsMobile } from '@/hooks/use-mobile';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { embudoServices, EmbudoResponse } from '@/services/embudoServices';
import { applySessionChange } from '@/services/sessionChangeService';
import { toast } from '@/hooks/use-toast';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export type FilterMode = 'all' | 'unassigned' | 'funnel' | 'pending' | 'stale' | 'offline' | 'bot_off' | 'urgent' | 'groups' | 'individual';

export interface SessionOption {
  id: string;
  name: string;
  type: 'whatsapp' | 'telegram' | 'twilio';
  identifier: string;
}

const Conversations = () => {
  const { reset: restartTour } = useConversationsTour();
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [embudos, setEmbudos] = useState<EmbudoResponse[]>([]);
  const [selectedEmbudo, setSelectedEmbudo] = useState<EmbudoResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(null);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([]);
  const [workspaceLeadIds, setWorkspaceLeadIds] = useState<string[]>([]);
  const [embudoLeadIds, setEmbudoLeadIds] = useState<string[]>([]);
  const [selectedWhatsAppSession, setSelectedWhatsAppSession] = useState<string | null>(null);
  const [selectedTwilioConnection, setSelectedTwilioConnection] = useState<string | null>(null);
  
  // Nuevos estados para filtros
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [onlineAgentIds, setOnlineAgentIds] = useState<string[]>([]);
  const [allAgentIds, setAllAgentIds] = useState<string[]>([]);

  const { activeConnections, isSessionActiveByPhone, getSessionNameByPhone, connections: whatsappConnections } = useWhatsAppConnections();
  const { connections: twilioConnections, activeConnections: activeTwilioConnections, isConnectionActive } = useTwilioConnections();
  const { connections: telegramConnections } = useTelegramConnections();

  // Construir lista de sesiones disponibles para filtro
  const sessionOptions: SessionOption[] = React.useMemo(() => {
    const options: SessionOption[] = [];
    
    whatsappConnections.forEach(conn => {
      options.push({
        id: conn.phone_number,
        name: conn.name || conn.phone_number,
        type: 'whatsapp',
        identifier: conn.phone_number
      });
    });
    
    telegramConnections.forEach(conn => {
      options.push({
        id: conn.id,
        name: conn.bot_name,
        type: 'telegram',
        identifier: conn.bot_username || conn.id
      });
    });
    
    twilioConnections.forEach(conn => {
      options.push({
        id: conn.id,
        name: conn.connection_name,
        type: 'twilio',
        identifier: conn.phone_number
      });
    });
    
    return options;
  }, [whatsappConnections, telegramConnections, twilioConnections]);

  const activeLeadIds = filterMode === 'funnel'
    ? selectedEmbudo
      ? embudoLeadIds
      : selectedWorkspace
        ? workspaceLeadIds
        : []
    : undefined;
  const selectedSessionOption = selectedSessionFilter ? sessionOptions.find(session => session.id === selectedSessionFilter) : null;
  const offlineAgentIds = useMemo(() => allAgentIds.filter(id => !onlineAgentIds.includes(id)), [allAgentIds, onlineAgentIds]);
  const conversationQueryOptions = useMemo(() => ({
    limit: 120,
    searchTerm,
    filterMode,
    assignmentFilter,
    sessionFilter: selectedSessionOption ? {
      type: selectedSessionOption.type,
      id: selectedSessionOption.id,
      identifier: selectedSessionOption.identifier,
    } : null,
    leadIds: activeLeadIds,
    offlineAgentIds,
  }), [searchTerm, filterMode, assignmentFilter, selectedSessionOption, activeLeadIds, offlineAgentIds]);

  // Hooks para gestionar datos
  const { conversations, isLoading, unreadCount, markAsRead } = useConversations(conversationQueryOptions);
  const { messages, hasMoreMessages, isLoadingOlderMessages, loadOlderMessages, sendMessage, sendMessageWithAttachment, isSending } = useMessages(selectedConversation?.id || null);

  // Cargar workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: workspacesData } = await supabase
            .from('workspaces')
            .select('*')
            .eq('user_id', user.id)
            .order('position');

          if (workspacesData && workspacesData.length > 0) {
            setWorkspaces(workspacesData);
            setSelectedWorkspace(workspacesData[0]);
          }
        }
      } catch (error) {
        console.error('Error loading workspaces:', error);
      }
    };
    loadWorkspaces();
  }, []);

  // Cargar embudos cuando cambia el workspace seleccionado
  useEffect(() => {
    const loadEmbudos = async () => {
      if (!selectedWorkspace) {
        setEmbudos([]);
        setColumns([]);
        setWorkspaceLeadIds([]);
        return;
      }

      try {
        const response = await embudoServices.getEmbudosByEspacio(selectedWorkspace.id);
        if (response.success && response.data) {
          setEmbudos(response.data);
          setColumns(response.data.map(e => ({ id: e.id, name: e.name })));
          const columnIds = response.data.map(e => e.id);
          if (columnIds.length > 0) {
            const { data: leadsData } = await supabase
              .from('leads')
              .select('id')
              .in('column_id', columnIds);
            setWorkspaceLeadIds((leadsData || []).map(l => l.id as string));
          } else {
            setWorkspaceLeadIds([]);
          }
        }
      } catch (error) {
        console.error('Error loading embudos:', error);
      }
    };
    loadEmbudos();
  }, [selectedWorkspace]);

  useEffect(() => {
    const loadPresence = async () => {
      if (!effectiveUserId) return;
      const { data } = await supabase
        .from('agent_presence')
        .select('user_id, status, manual_override, last_seen_at')
        .eq('account_owner_id', effectiveUserId)
        .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString());
      const agents = data || [];
      setAllAgentIds(Array.from(new Set(agents.map(agent => agent.user_id))));
      setOnlineAgentIds(agents.filter(agent => !['busy', 'offline'].includes(agent.manual_override || agent.status || 'offline')).map(agent => agent.user_id));
    };
    loadPresence();
  }, [effectiveUserId]);

  useEffect(() => {
    const loadLeadsByEmbudo = async () => {
      if (!selectedEmbudo) {
        setEmbudoLeadIds([]);
        return;
      }
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id')
        .eq('column_id', selectedEmbudo.id);
      setEmbudoLeadIds((leadsData || []).map(l => l.id as string));
    };
    loadLeadsByEmbudo();
  }, [selectedEmbudo]);

  // Las conversaciones ya llegan filtradas y ordenadas desde Supabase.
  const displayConversations = React.useMemo(() => conversations, [conversations]);

  // Seleccionar conversación automáticamente desde navegación de embudos
  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    if (state?.conversationId && conversations.length > 0) {
      const conversation = conversations.find(conv => conv.id === state.conversationId);
      if (conversation) {
        handleSelectConversation(conversation);
        // Limpiar el estado de navegación
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, conversations]);

  // Manejar selección de conversación
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unread_count && conversation.unread_count > 0) {
markAsRead(conversation.id);
    }
    
    // Auto-seleccionar sesión WhatsApp: SIEMPRE usar la sesión que recibió el mensaje como default
    if (conversation.channel_type === 'whatsapp' && conversation.whatsapp_number) {
      const sessionName = getSessionNameByPhone(conversation.whatsapp_number);
      setSelectedWhatsAppSession(sessionName || conversation.whatsapp_number);
    }

    // Auto-seleccionar conexión Twilio si está activa
    if (conversation.channel_type === 'twilio' && conversation.twilio_connection_id) {
      if (isConnectionActive(conversation.twilio_connection_id)) {
        setSelectedTwilioConnection(conversation.twilio_connection_id);
      } else if (activeTwilioConnections.length > 0) {
        setSelectedTwilioConnection(activeTwilioConnections[0].id);
      } else {
        setSelectedTwilioConnection(null);
      }
    }
  };

  // Manejar cambio de sesión WhatsApp desde el dropdown.
  // UNA sola conversación por contacto: SIEMPRE actualiza la conversación
  // existente. Si la sesión nueva pertenece a otro embudo (workspace), mueve
  // el contacto a ese embudo y cambia la vista para que siga visible.
  const handleSessionChange = async (newSessionName: string, newSessionPhoneNumber?: string) => {
    if (!newSessionPhoneNumber || !selectedConversation || selectedConversation.channel_type !== 'whatsapp' || !effectiveUserId) return;
    if (selectedWhatsAppSession === newSessionName) return;

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
      setSelectedWhatsAppSession(newSessionName);

      if (result.moved && result.targetWorkspaceId) {
        const ws = workspaces.find((w: any) => w.id === result.targetWorkspaceId);
        if (ws) {
          setSelectedWorkspace(ws);
          setSelectedEmbudo(null);
        }
        toast({
          title: 'Contacto movido de embudo',
          description: `La conversación pasó al embudo "${result.targetColumnName ?? ws?.name ?? 'nuevo'}" con la sesión "${newSessionName}".`,
        });
      } else {
        toast({
          title: 'Sesión actualizada',
          description: 'La conversación ahora usa la nueva conexión seleccionada.',
        });
      }
    } catch (err: any) {
      console.error('[Conversations] Error updating session on conversation:', err);
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo actualizar la sesión de la conversación',
        variant: 'destructive',
      });
    }
  };

  // Manejar envío de mensaje
  const handleSendMessage = async (messageText: string, attachment?: File) => {
    if ((!messageText.trim() && !attachment) || !selectedConversation || !effectiveUserId) return;

    try {
      const channelType = selectedConversation.channel_type || 'whatsapp';
      
      // Si es Telegram
      if (channelType === 'telegram') {
        const chatId = selectedConversation.phone_number;
        const telegramBotId = selectedConversation.telegram_bot_id;
        
        if (!telegramBotId) {
          console.error('No telegram_bot_id found for this conversation');
          return;
        }

        // Si hay archivo adjunto
        if (attachment) {
          // Subir archivo a Storage
          const FileUploadService = (await import('@/services/fileUploadService')).FileUploadService;
          const { url, path } = await FileUploadService.uploadFile(
            attachment,
            effectiveUserId,
            selectedConversation.id
          );

          await sendMessageWithAttachment({
            conversationId: selectedConversation.id,
            userId: effectiveUserId,
            message: messageText.trim(),
            sessionName: '',
            phoneNumber: chatId,
            fileUrl: url,
            fileName: attachment.name,
            mimeType: attachment.type,
            channelType: 'telegram',
            telegramBotId: telegramBotId,
            twilioConnectionId: null
          });
        } else {
          await sendMessage({
            conversationId: selectedConversation.id,
            userId: effectiveUserId,
            message: messageText.trim(),
            sessionName: '', // No usado en Telegram
            phoneNumber: chatId,
            channelType: 'telegram',
            telegramBotId: telegramBotId
          });
        }
        
        return;
      }

      // Si es Twilio
      if (channelType === 'twilio') {
        if (!selectedTwilioConnection) {
          toast({
            title: 'Conexión no seleccionada',
            description: 'Selecciona una conexión de Twilio para enviar mensajes',
            variant: 'destructive',
          });
          return;
        }

        // Si hay archivo adjunto
        if (attachment) {
          // Subir archivo a Storage
          const FileUploadService = (await import('@/services/fileUploadService')).FileUploadService;
          const { url, path } = await FileUploadService.uploadFile(
            attachment,
            effectiveUserId,
            selectedConversation.id
          );

          await sendMessageWithAttachment({
            conversationId: selectedConversation.id,
            userId: effectiveUserId,
            message: messageText.trim(),
            sessionName: '',
            phoneNumber: selectedConversation.phone_number,
            fileUrl: url,
            fileName: attachment.name,
            mimeType: attachment.type,
            channelType: 'twilio',
            telegramBotId: null,
            twilioConnectionId: selectedTwilioConnection
          });
        } else {
          await sendMessage({
            conversationId: selectedConversation.id,
            userId: effectiveUserId,
            message: messageText.trim(),
            sessionName: '',
            phoneNumber: selectedConversation.phone_number,
            channelType: 'twilio',
            telegramBotId: null,
            twilioConnectionId: selectedTwilioConnection
          });
        }
        
        return;
      }
      
      // Si es WhatsApp
      // Prioridad: session_name guardado en la conversación > sesión seleccionada > lookup por número
      let whatsappSessionName =
        (selectedConversation as any)?.session_name ||
        selectedWhatsAppSession ||
        null;
      if (!whatsappSessionName && selectedConversation?.whatsapp_number) {
        whatsappSessionName = getSessionNameByPhone(selectedConversation.whatsapp_number) || selectedConversation.whatsapp_number;
      }
      if (!whatsappSessionName) {
        toast({
          title: 'Sesión no seleccionada',
          description: 'Selecciona una conexión de WhatsApp para enviar mensajes',
          variant: 'destructive',
        });
        return;
      }

      const sessionName = whatsappSessionName;
      const phoneNumber = selectedConversation.phone_number;

      // Si hay archivo adjunto
      if (attachment) {
        // Subir archivo a Storage
        const FileUploadService = (await import('@/services/fileUploadService')).FileUploadService;
        const { url, path } = await FileUploadService.uploadFile(
          attachment,
          effectiveUserId,
          selectedConversation.id
        );

        await sendMessageWithAttachment({
          conversationId: selectedConversation.id,
          userId: effectiveUserId,
          message: messageText.trim(),
          sessionName: sessionName,
          phoneNumber: phoneNumber,
          fileUrl: url,
          fileName: attachment.name,
          mimeType: attachment.type,
          channelType: 'whatsapp',
          telegramBotId: null
        });
      } else {
        await sendMessage({
          conversationId: selectedConversation.id,
          userId: effectiveUserId,
          message: messageText.trim(),
          sessionName: sessionName,
          phoneNumber: phoneNumber,
          channelType: 'whatsapp',
          telegramBotId: null
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      let description = 'No se pudo enviar el mensaje';
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
        title: 'Error al enviar mensaje',
        description,
        variant: 'destructive',
      });
    }
  };

  // Common props
  const conversationListProps = {
    conversations: displayConversations,
    selectedConversation,
    onSelectConversation: handleSelectConversation,
    searchTerm,
    onSearchChange: setSearchTerm,
    isLoading,
    unreadCount,
    workspaces,
    selectedWorkspace,
    onWorkspaceSelect: setSelectedWorkspace,
    embudos,
    selectedEmbudo,
    onEmbudoSelect: setSelectedEmbudo,
    filterMode,
    onFilterModeChange: setFilterMode,
    sessionOptions,
    selectedSessionFilter,
    onSessionFilterChange: setSelectedSessionFilter,
    assignmentFilter,
    onAssignmentFilterChange: setAssignmentFilter,
  };

  const originalSessionStatus: 'active' | 'disconnected' | 'deleted' =
    selectedConversation?.channel_type === 'whatsapp'
      ? isSessionActiveByPhone(selectedConversation.whatsapp_number)
        ? 'active'
        : 'disconnected'
      : selectedConversation?.channel_type === 'twilio'
        ? isConnectionActive(selectedConversation.twilio_connection_id)
          ? 'active'
          : 'disconnected'
        : 'active';

  // ===== Mobile drill-down layout =====
  if (isMobile) {
    return (
      <div className="flex h-full bg-background">
        {!selectedConversation ? (
          <div className="w-full h-full">
            <ConversationList {...conversationListProps} />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col min-h-0">
            <ChatArea
              conversation={selectedConversation}
              messages={messages}
              hasMoreMessages={hasMoreMessages}
              isLoadingOlderMessages={isLoadingOlderMessages}
              onLoadOlderMessages={loadOlderMessages}
              onSendMessage={handleSendMessage}
              isSending={isSending}
              onToggleInfoPanel={() => setShowInfoPanel(true)}
              whatsappConnections={activeConnections}
              selectedSession={selectedWhatsAppSession}
              onSessionChange={handleSessionChange}
              twilioConnections={twilioConnections}
              selectedTwilioConnection={selectedTwilioConnection}
              onTwilioConnectionChange={setSelectedTwilioConnection}
              originalSessionStatus={originalSessionStatus}
              onBack={() => setSelectedConversation(null)}
            />
            <Sheet open={showInfoPanel} onOpenChange={setShowInfoPanel}>
              <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0 overflow-y-auto">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle>Información del contacto</SheetTitle>
                </SheetHeader>
                <ContactInfoPanel
                  conversationId={selectedConversation.id}
                  contactName={selectedConversation.contact_name || selectedConversation.pushname || 'Contacto'}
                  phoneNumber={selectedConversation.phone_number}
                  whatsappNumber={selectedConversation.whatsapp_number}
                  channelType={selectedConversation.channel_type}
                />
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    );
  }

  // ===== Desktop layout (sin cambios) =====
  return (
    <div className="flex h-full bg-background relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={restartTour}
        title="Ver tour de novedades"
        className="absolute bottom-3 right-3 z-30 h-9 w-9 rounded-full bg-card/80 backdrop-blur border border-border shadow-md hover:bg-accent"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={23} minSize={15} maxSize={40}>
          <ConversationList {...conversationListProps} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={showInfoPanel ? 52 : 77} minSize={40} className="h-full min-h-0">
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            isSending={isSending}
            onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
            whatsappConnections={activeConnections}
            selectedSession={selectedWhatsAppSession}
            onSessionChange={handleSessionChange}
            twilioConnections={twilioConnections}
            selectedTwilioConnection={selectedTwilioConnection}
            onTwilioConnectionChange={setSelectedTwilioConnection}
            originalSessionStatus={originalSessionStatus}
          />
        </ResizablePanel>

        {selectedConversation && showInfoPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="h-full min-h-0">
              <ContactInfoPanel
                conversationId={selectedConversation.id}
                contactName={selectedConversation.contact_name || selectedConversation.pushname || 'Contacto'}
                phoneNumber={selectedConversation.phone_number}
                whatsappNumber={selectedConversation.whatsapp_number}
                channelType={selectedConversation.channel_type}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
};

export default Conversations;
