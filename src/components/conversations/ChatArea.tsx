import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { MoreVertical, Send, Paperclip, Smile, X, BotOff, Bot, Zap, UserCircle, MessageSquare, Loader2, Phone, ArrowLeft, FolderKanban, Clock, Calendar, StickyNote, Sparkles, Users, Smartphone, RefreshCw } from 'lucide-react';
import SnoozeDialog from './SnoozeDialog';
import ScheduleMessageDialog from './ScheduleMessageDialog';
import AIAssistPanel from './AIAssistPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { AssignToKanban } from './AssignToKanban';
import EmojiPicker from 'emoji-picker-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AttachmentRenderer from './AttachmentRenderer';
import StickerPicker from './StickerPicker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useBotBlock } from '@/hooks/useBotBlock';
import { useBotAutoStop } from '@/hooks/useBotAutoStop';
import { useAuth } from '@/hooks/useAuth';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { useConversationPresence } from '@/hooks/useConversationPresence';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProfile } from '@/hooks/useProfile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WhatsAppConnection } from '@/hooks/useWhatsAppConnections';
import { TwilioConnection } from '@/hooks/useTwilioConnections';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/use-mobile';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  hasMoreMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onSendMessage: (message: string, attachment?: File) => void;
  isSending: boolean;
  onToggleInfoPanel: () => void;
  whatsappConnections: WhatsAppConnection[];
  selectedSession: string | null;
  onSessionChange: (sessionName: string, sessionPhoneNumber?: string) => void;
  twilioConnections: TwilioConnection[];
  selectedTwilioConnection: string | null;
  onTwilioConnectionChange: (connectionId: string) => void;
  originalSessionStatus: 'active' | 'disconnected' | 'deleted';
  onBack?: () => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  hasMoreMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
  onSendMessage,
  isSending,
  onToggleInfoPanel,
  whatsappConnections,
  selectedSession,
  onSessionChange,
  twilioConnections,
  selectedTwilioConnection,
  onTwilioConnectionChange,
  originalSessionStatus,
  onBack,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showQuickReplyDropdown, setShowQuickReplyDropdown] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { quickReplies } = useQuickReplies();
  const { isBlocked, isLoading: isBotToggling, toggleBotBlock } = useBotBlock(
    conversation?.phone_number || null,
    conversation?.pushname || null
  );
  const { autoStopEnabled } = useBotAutoStop();
  const { isCajero } = useProfile();
  const isMobile = useIsMobile();
  const { othersTyping, othersViewing, setTyping } = useConversationPresence(
    conversation?.id || null,
    conversation?.user_id || null,
  );

  // Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone: string | null) => {
    if (!phone) return '';
    return '****' + phone.slice(-4);
  };

  const previousConversationIdRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);

  const isNearBottom = useCallback(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return true;
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (!messagesEndRef.current) return;

    const conversationChanged = previousConversationIdRef.current !== conversation?.id;
    const messageCountIncreased = messages.length > previousMessageCountRef.current;
    const shouldAutoScroll = conversationChanged || (messageCountIncreased && isNearBottom());

    if (shouldAutoScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: conversationChanged ? 'auto' : 'smooth' });
    }

    previousConversationIdRef.current = conversation?.id || null;
    previousMessageCountRef.current = messages.length;
  }, [conversation?.id, messages.length, isNearBottom]);

  // Manejar envío de mensaje
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !conversation || isSending || isUploading) return;

    try {
      setIsUploading(true);

      // === NOTA INTERNA: se guarda en messages pero NO se envía a ningún canal ===
      if (isNoteMode) {
        const { error } = await supabase.from('messages').insert({
          conversation_id: conversation.id,
          user_id: conversation.user_id,
          content: newMessage.trim(),
          direction: 'internal',
          message_type: 'internal_note',
          responded_by: user?.id ?? null,
          status: 'sent',
        });
        if (error) throw error;
        setNewMessage('');
        setSelectedFile(null);
        setShowEmojiPicker(false);
        toast({ title: '📌 Nota interna guardada', description: 'Solo visible para tu equipo' });
        return;
      }

      let attachment: File | undefined = undefined;
      if (selectedFile) attachment = selectedFile;

      await onSendMessage(newMessage.trim(), attachment);

      // Si auto-stop está activado y el bot no está bloqueado, bloquear automáticamente
      if (autoStopEnabled && !isBlocked) {
        await toggleBotBlock();
      }

      setNewMessage('');
      setSelectedFile(null);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Manejar selección de archivo
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tamaño (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Archivo muy grande',
          description: 'El archivo debe ser menor a 10MB',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Enviar un sticker (ya subido a Storage / guardado en la biblioteca)
  const [isSendingSticker, setIsSendingSticker] = useState(false);
  const handleSendSticker = async (sticker: { url: string; name: string; mimeType: string }) => {
    if (!conversation || !user?.id) return;
    if (isNoteMode) {
      toast({
        title: 'Modo nota activa',
        description: 'Desactiva el modo nota para enviar stickers',
        variant: 'destructive'
      });
      return;
    }
    try {
      setIsSendingSticker(true);
      const now = new Date().toISOString();
      const channelType = conversation.channel_type;
      const phoneNumber = conversation.phone_number || '';
      const sessionName = selectedSession || '';
      const twilioConnectionId = conversation.twilio_connection_id || null;
      const telegramBotId = conversation.telegram_bot_id || null;
      // Guardar mensaje local con tipo 'sticker' (optimista)
      const { data: saved, error: saveErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
          content: '🎨 Sticker',
          direction: 'outbound',
          message_type: 'sticker',
          file_url: sticker.url,
          attachment_url: sticker.url,
          status: 'sending',
          is_bot: false,
          created_at: now,
          metadata: { file_name: sticker.name, mime_type: sticker.mimeType }
        })
        .select()
        .single();
      if (saveErr) throw saveErr;
      await supabase
        .from('conversations')
        .update({ last_message: '🎨 Sticker', last_message_time: now, updated_at: now })
        .eq('id', conversation.id);
      // Reenviar por el canal correspondiente
      try {
        if (channelType === 'twilio' && twilioConnectionId) {
          await supabase.functions.invoke('twilio-send-file', {
            body: {
              twilioConnectionId,
              phoneNumber,
              message: '',
              fileUrl: sticker.url,
              fileName: sticker.name,
              mimeType: sticker.mimeType,
              userId: user.id,
              conversationId: conversation.id,
              messageType: 'sticker'
            }
          });
        } else if (channelType === 'telegram' && telegramBotId) {
          await supabase.functions.invoke('telegram-send-file', {
            body: {
              chatId: phoneNumber,
              fileUrl: sticker.url,
              caption: '',
              mimeType: sticker.mimeType,
              userId: user.id,
              conversationId: conversation.id,
              telegramBotId,
              isBot: false
            }
          });
        } else {
          // Default: WhatsApp (WAHA) – usa el endpoint nativo de stickers
          await supabase.functions.invoke('waha-send-file', {
            body: {
              sessionName,
              phoneNumber,
              message: '',
              fileUrl: sticker.url,
              fileName: sticker.name,
              mimeType: sticker.mimeType,
              userId: user.id,
              conversationId: conversation.id,
              messageType: 'sticker'
            }
          });
        }
        if (saved?.id) {
          await supabase.from('messages').update({ status: 'delivered' }).eq('id', saved.id);
        }
        toast({ title: 'Sticker enviado' });
      } catch (sendErr: any) {
        if (saved?.id) {
          await supabase
            .from('messages')
            .update({ status: 'failed' })
            .eq('id', saved.id);
        }
        throw sendErr;
      }
    } catch (e: any) {
      console.error('Sticker error:', e);
      toast({
        title: 'Error al enviar sticker',
        description: e?.message ?? 'Error desconocido',
        variant: 'destructive'
      });
    } finally {
      setIsSendingSticker(false);
    }
  };


  // Manejar selección de emoji
  const handleEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.emoji);
    setShowEmojiPicker(false);
  };

  // Manejar selección de respuesta rápida (y enviar automáticamente)
  const handleQuickReplySelect = (reply: any, autoSend: boolean = false) => {
    if (autoSend) {
      // Enviar directamente sin poner en el input
      onSendMessage(reply.message, undefined);
      setShowQuickReplies(false);
      setShowQuickReplyDropdown(false);
      setQuickReplyFilter('');
      setNewMessage('');
    } else {
      setNewMessage(reply.message);
      setShowQuickReplies(false);
      setShowQuickReplyDropdown(false);
      setQuickReplyFilter('');
    }
  };

  // Manejar cambio de input con detección de "/"
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    if (value.length > 0) setTyping(true);
    
    if (value.startsWith('/')) {
      const filter = value.substring(1).toLowerCase();
      setQuickReplyFilter(filter);
      setShowQuickReplyDropdown(true);
    } else {
      setShowQuickReplyDropdown(false);
      setQuickReplyFilter('');
    }
  };

  const filteredQuickReplies = useMemo(() => quickReplies.filter(reply => 
    reply.title.toLowerCase().includes(quickReplyFilter) ||
    reply.message.toLowerCase().includes(quickReplyFilter)
  ), [quickReplies, quickReplyFilter]);

  // Remover archivo seleccionado
  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Formatear tiempo
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 días
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }
  };

  // Obtener iniciales del nombre
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Agrupar mensajes por fecha
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };


  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Selecciona una conversación</h3>
          <p className="text-muted-foreground">
            Elige una conversación de la lista para comenzar a chatear
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      {/* Header del chat */}
      <div className="p-2.5 md:p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 md:gap-3">
          {isMobile && onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-9 w-9 p-0 shrink-0"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-9 w-9 md:h-10 md:w-10 shrink-0">
            <AvatarFallback className={cn((conversation.is_group || (conversation.phone_number ?? '').endsWith('@g.us')) ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground")}>
              {(conversation.is_group || (conversation.phone_number ?? '').endsWith('@g.us')) ? <Users className="h-4 w-4 md:h-5 md:w-5" /> : getInitials(conversation.pushname)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-sm md:text-base truncate leading-tight">
                {(conversation.is_group || (conversation.phone_number ?? '').endsWith('@g.us'))
                  ? ((conversation.group_subject ?? conversation.pushname ?? '').replace(/^👥\s*/, '').trim() || 'Grupo')
                  : (conversation.pushname || (isCajero ? maskPhoneNumber(conversation.phone_number) : conversation.phone_number))}
              </h2>
              {(conversation.is_group || (conversation.phone_number ?? '').endsWith('@g.us')) && (
                <Badge variant="outline" className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                  <Users className="h-3 w-3 mr-1" />Grupo{conversation.group_participants_count ? ` · ${conversation.group_participants_count}` : ''}
                </Badge>
              )}
            </div>
            <p className="text-[11px] md:text-sm text-muted-foreground truncate leading-tight flex items-center gap-1.5">
              <span>{isCajero ? maskPhoneNumber(conversation.phone_number) : conversation.phone_number}</span>
              {conversation.channel_type === 'whatsapp' && (() => {
                const sessionName = selectedSession
                  || ((conversation as any).session_name as string | null)
                  || (conversation.whatsapp_number ? whatsappConnections.find(c => c.phone_number === conversation.whatsapp_number)?.name : null);
                if (!sessionName) return null;
                return (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Smartphone className="h-3 w-3" />
                      {sessionName}
                    </span>
                  </>
                );
              })()}
            </p>
            {(othersTyping.length > 0 || othersViewing.length > 0) && (
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                {othersTyping.length > 0 && <span className="text-primary animate-pulse">✍️ Otro agente escribiendo…</span>}
                {othersTyping.length === 0 && othersViewing.length > 0 && (
                  <span>👀 {othersViewing.length} {othersViewing.length === 1 ? 'agente mirando' : 'agentes mirando'}</span>
                )}
              </div>
            )}
            {/* Mostrar sesión Twilio si aplica */}
            {conversation.channel_type === 'twilio' && (() => {
              const currentTwilioConnection = twilioConnections.find(
                conn => conn.id === conversation.twilio_connection_id
              );
              return currentTwilioConnection ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3 text-[hsl(var(--twilio-red))]" />
                  <span className="text-[10px] md:text-xs text-[hsl(var(--twilio-red))] truncate">
                    {currentTwilioConnection.connection_name} • {currentTwilioConnection.phone_number}
                  </span>
                </div>
              ) : null;
            })()}
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* AssignToKanban: visible inline solo en desktop */}
            {!isMobile && (
              <AssignToKanban
                conversationId={conversation.id}
                conversationPhone={conversation.whatsapp_number}
                conversationName={conversation.pushname}
                conversationChannelType={conversation.channel_type as 'whatsapp' | 'twilio' | 'telegram' | 'webchat' | 'player_chat'}
                conversationWhatsappNumber={conversation.whatsapp_number}
                conversationTwilioConnectionId={conversation.twilio_connection_id}
                onLeadAssigned={() => {}}
                onSessionChange={onSessionChange}
                onTwilioConnectionChange={onTwilioConnectionChange}
                iconOnly
              />
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onToggleInfoPanel}
              className="h-9 w-9 md:h-9 md:w-auto p-0 md:px-3"
              title="Mostrar/Ocultar información del contacto"
            >
              <UserCircle className="h-5 w-5 md:h-4 md:w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 md:h-9 md:w-auto p-0 md:px-3">
                  <MoreVertical className="h-5 w-5 md:h-4 md:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* En mobile, AssignToKanban aparece dentro del menú */}
                {isMobile && (
                  <div className="px-1 py-1">
                    <AssignToKanban
                      conversationId={conversation.id}
                      conversationPhone={conversation.whatsapp_number}
                      conversationName={conversation.pushname}
                      conversationChannelType={conversation.channel_type as 'whatsapp' | 'twilio' | 'telegram' | 'webchat' | 'player_chat'}
                      conversationWhatsappNumber={conversation.whatsapp_number}
                      conversationTwilioConnectionId={conversation.twilio_connection_id}
                      onLeadAssigned={() => {}}
                      onSessionChange={onSessionChange}
                      onTwilioConnectionChange={onTwilioConnectionChange}
                    />
                  </div>
                )}
                <DropdownMenuItem 
                  onClick={toggleBotBlock}
                  disabled={isBotToggling}
                >
                  {isBlocked ? (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Activar Bot
                    </>
                  ) : (
                    <>
                      <BotOff className="h-4 w-4 mr-2" />
                      Desactivar Bot
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAIAssist(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Asistencia IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowScheduleDialog(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Programar mensaje
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSnoozeDialog(true)}>
                  <Clock className="h-4 w-4 mr-2" />
                  {conversation.snoozed_until ? 'Cambiar recordatorio' : 'Posponer conversación'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Selector de sesión WhatsApp: solo informativo si sesión caída; opcional si hay 2+ conexiones */}
      {conversation.channel_type === 'whatsapp' && whatsappConnections.length > 0 && (
        <div className="mx-3 mt-3">
          {originalSessionStatus !== 'active' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                La sesión original no está disponible.
                {whatsappConnections.length > 1 && ' Usa "Responder con otra sesión" para cambiar a una conexión activa.'}
              </AlertDescription>
            </Alert>
          )}
          {whatsappConnections.length > 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSessionSelector(!showSessionSelector)}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Responder con otra sesión
              </Button>
              {showSessionSelector && (
                <div className="mt-2">
                  <Select
                    value={selectedSession || ''}
                    onValueChange={(value) => {
                      const conn = whatsappConnections.find(c => c.name === value);
                      onSessionChange(value, conn?.phone_number);
                      setShowSessionSelector(false);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar conexión" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.name || ''}>
                          {conn.name} - {conn.phone_number}
                          {conn.phone_number === conversation.whatsapp_number ? ' (actual)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Selector de conexión Twilio si la original no está activa */}
      {conversation.channel_type === 'twilio' && originalSessionStatus !== 'active' && twilioConnections.length > 0 && (
        <div className="mx-3 mt-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              La conexión original no está disponible. Selecciona una conexión activa:
              <Select value={selectedTwilioConnection || ''} onValueChange={onTwilioConnectionChange}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Seleccionar conexión Twilio" />
                </SelectTrigger>
                <SelectContent>
                  {twilioConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.connection_name} - {conn.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Indicador de contacto bloqueado */}
      {isBlocked && (
        <div className="mx-3 mt-3">
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <BotOff className="h-4 w-4 text-orange-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-orange-700 dark:text-orange-400">
                Este contacto tiene el bot desactivado. La IA no responderá automáticamente.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleBotBlock}
                disabled={isBotToggling}
                className="ml-2 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
              >
                {isBotToggling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-1" />
                    Activar Bot
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Banner de conversación pospuesta */}
      {conversation.snoozed_until && new Date(conversation.snoozed_until) > new Date() && (
        <div className="mx-3 mt-3">
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <Clock className="h-4 w-4 text-blue-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-blue-700 dark:text-blue-300 text-sm">
                Pospuesta hasta {new Date(conversation.snoozed_until).toLocaleString('es-AR')}
                {conversation.snooze_reason && <> · {conversation.snooze_reason}</>}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await supabase.from('conversations')
                    .update({ snoozed_until: null, snoozed_by: null, snooze_reason: null, is_followup_due: false })
                    .eq('id', conversation.id);
                }}
                className="ml-2 shrink-0"
              >
                Quitar
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Banner de seguimiento pendiente */}
      {conversation.is_followup_due && (
        <div className="mx-3 mt-3">
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <Clock className="h-4 w-4 text-orange-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-orange-700 dark:text-orange-400 text-sm font-medium">
                🔔 Recordatorio de seguimiento — es momento de retomar esta conversación
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await supabase.from('conversations')
                    .update({ is_followup_due: false })
                    .eq('id', conversation.id);
                }}
                className="ml-2 shrink-0"
              >
                Listo
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Área de mensajes */}
      <ScrollArea 
        className="flex-1 min-h-0 p-3 md:p-4 bg-background"
        ref={scrollAreaRef}
      >
        <div className="space-y-4">
          {hasMoreMessages && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={onLoadOlderMessages} disabled={isLoadingOlderMessages}>
                {isLoadingOlderMessages ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar anteriores'}
              </Button>
            </div>
          )}
          {Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Separador de fecha */}
              <div className="flex items-center justify-center mb-3">
                <div className="bg-muted px-3 py-1.5 rounded-md text-xs text-muted-foreground shadow-sm">
                  {date}
                </div>
              </div>
              
              {/* Mensajes del día */}
              <div className="space-y-2">
                {dateMessages.map((message, index) => {
                  const prevMessage = index > 0 ? dateMessages[index - 1] : null;
                  const showAvatar = !prevMessage || prevMessage.direction !== message.direction;
                  
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      showAvatar={showAvatar}
                      formatTime={formatTime}
                      getInitials={getInitials}
                      conversation={conversation}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input de mensaje */}
      <div className={cn("p-3 border-t border-border", isNoteMode ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400/50" : "bg-card")}>

        {isNoteMode && (
          <div className="mb-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
            <StickyNote className="h-3 w-3" />
            <span>Modo nota interna — el mensaje NO se enviará al cliente, solo lo verá tu equipo.</span>
          </div>
        )}


        {/* Preview de archivo seleccionado */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-muted rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <span className="text-sm">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({Math.round(selectedFile.size / 1024)} KB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeSelectedFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <StickerPicker
            disabled={isUploading || isSendingSticker}
            isSending={isSendingSticker}
            onSelect={handleSendSticker}
          />


          <Button
            variant={isNoteMode ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setIsNoteMode(v => !v)}
            disabled={isUploading || isSending}
            title="Nota interna (no se envía al cliente)"
            className={cn(isNoteMode && "bg-yellow-500 hover:bg-yellow-600 text-white")}
          >
            <StickyNote className="h-4 w-4" />
          </Button>

          {/* Botón de respuestas rápidas - siempre visible */}
          <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={isUploading || isSending}
                title="Respuestas rápidas"
              >
                <Zap className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align="start">
              <div className="space-y-1">
                <p className="text-sm font-medium px-2 py-1">Respuestas Rápidas</p>
                {quickReplies.length === 0 ? (
                  <div className="px-2 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No tienes respuestas rápidas configuradas.
                    </p>
                    <a 
                      href="/configuracion" 
                      className="text-sm text-primary hover:underline mt-2 inline-block"
                    >
                      Crear una respuesta rápida
                    </a>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        onClick={() => handleQuickReplySelect(reply)}
                        className="w-full text-left px-2 py-2 hover:bg-muted rounded-md transition-colors"
                      >
                        <p className="font-medium text-sm">{reply.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {reply.message}
                        </p>
                      </button>
                    ))}
                  </ScrollArea>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex-1 relative">
            {/* Dropdown de respuestas rápidas al escribir "/" */}
            {showQuickReplyDropdown && filteredQuickReplies.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-2 mb-1">
                    Respuestas Rápidas ({filteredQuickReplies.length})
                  </p>
                  {filteredQuickReplies.map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReplySelect(reply)}
                      className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{reply.title}</span>
                        {reply.hotkey && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{reply.hotkey}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {reply.message}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              placeholder="Escribe '/' para respuestas rápidas..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Si hay dropdown abierto con respuestas filtradas, seleccionar y enviar la primera
                  if (showQuickReplyDropdown && filteredQuickReplies.length > 0) {
                    handleQuickReplySelect(filteredQuickReplies[0], true);
                  } else {
                    handleSendMessage();
                  }
                }
              }}
              className="pr-10 bg-muted border border-input text-foreground placeholder:text-muted-foreground"
              disabled={isSending || isUploading}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            
            {/* Selector de emojis */}
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width={300}
                  height={400}
                />
              </div>
            )}
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFile) || isSending || isUploading}
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <SnoozeDialog
        conversationId={conversation.id}
        open={showSnoozeDialog}
        onOpenChange={setShowSnoozeDialog}
      />
      <ScheduleMessageDialog
        conversationId={conversation.id}
        channelType={conversation.channel_type || 'whatsapp'}
        whatsappSessionName={conversation.whatsapp_number}
        twilioConnectionId={conversation.twilio_connection_id}
        telegramBotId={conversation.telegram_bot_id}
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
      />
      <AIAssistPanel
        open={showAIAssist}
        onOpenChange={setShowAIAssist}
        conversationId={conversation.id}
        onUseDraft={(text) => setNewMessage(text)}
      />
    </div>
  );
};

// Memoized message bubble component
interface MessageBubbleProps {
  message: Message;
  showAvatar: boolean;
  formatTime: (dateString: string) => string;
  getInitials: (name: string | null) => string;
  conversation: Conversation;
}

const MessageBubble = memo<MessageBubbleProps>(({
  message,
  showAvatar,
  formatTime,
  getInitials,
  conversation,
}) => {
  const isOutgoing = message.direction === 'outbound' || message.direction === 'outgoing';
  const isInternalNote = message.message_type === 'internal_note' || message.direction === 'internal';

  if (isInternalNote) {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400/50 text-yellow-900 dark:text-yellow-100 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] font-medium text-yellow-700 dark:text-yellow-300 mb-1">
            📌 Nota interna
          </div>
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
          <div className="text-[10px] text-yellow-700/70 dark:text-yellow-300/70 mt-1 text-right">
            {formatTime(message.created_at)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2 mb-1", isOutgoing ? "justify-end" : "justify-start")}>
      {!isOutgoing && (
        <Avatar className={cn("h-8 w-8", !showAvatar && "invisible")}> 
          <AvatarFallback className="bg-success text-success-foreground text-xs">
            {getInitials(conversation.pushname)}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2 text-sm relative shadow-md",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted text-foreground rounded-tl-none"
        )}
      >
        {/* Contenido del mensaje */}
        {(message.file_url || message.attachment_url) && (
          <AttachmentRenderer 
            attachmentUrl={message.file_url || message.attachment_url}
            messageType={message.message_type}
            isOutgoing={isOutgoing}
            twilioConnectionId={conversation.twilio_connection_id}
          />
        )}
        
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
        
        {/* Información del mensaje */}
        <div className={cn(
          "flex items-center justify-end gap-1 mt-1 text-[10px]",
          isOutgoing
            ? "text-primary-foreground/80"
            : "text-muted-foreground"
        )}>
          {message.is_bot && (
            <span className="mr-1 text-xs">🤖</span>
          )}
          <span>{formatTime(message.created_at)}</span>
          {isOutgoing && (
            <svg viewBox="0 0 16 15" width="16" height="15" className="ml-1">
              <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>
          )}
        </div>
      </div>
      
      {isOutgoing && (
        <div className="w-8" /> // Espacio para mantener alineación
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.file_url === nextProps.message.file_url &&
    prevProps.message.attachment_url === nextProps.message.attachment_url &&
    prevProps.message.message_type === nextProps.message.message_type &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.showAvatar === nextProps.showAvatar
  );
});

MessageBubble.displayName = 'MessageBubble';

export default memo(ChatArea);
