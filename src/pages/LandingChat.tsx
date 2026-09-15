import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Send, ArrowDownLeft, ArrowUpRight, Globe, MessageCircle, Paperclip, Smile, File, Trash2, Settings, BarChart3, Zap, User } from 'lucide-react';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';
import { FileUploadService } from '@/services/fileUploadService';
import { Link } from 'react-router-dom';
import { WebchatConversionStats } from '@/components/landing-chat/WebchatConversionStats';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { ContactInfoPanel } from '@/components/conversations/ContactInfoPanel';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useTags } from '@/hooks/useTags';
import { Badge } from '@/components/ui/badge';

interface WebChatConversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number | null;
  tags?: string[];
}

interface WebChatMessage {
  id: string;
  content: string;
  direction: string;
  created_at: string | null;
  is_bot: boolean | null;
  file_url: string | null;
  attachment_url: string | null;
  message_type: string | null;
}

const LandingChat = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { getTagColor } = useTags();
  const [contactTags, setContactTags] = useState<Record<string, string[]>>({});
  
  
  // Web Chat state
  const [webChatConversations, setWebChatConversations] = useState<WebChatConversation[]>([]);
  const [webChatMessages, setWebChatMessages] = useState<WebChatMessage[]>([]);
  const [selectedWebChat, setSelectedWebChat] = useState<WebChatConversation | null>(null);
  const [webChatNewMessage, setWebChatNewMessage] = useState('');
  const [webChatLoading, setWebChatLoading] = useState(false);
  const [sendingWebChat, setSendingWebChat] = useState(false);
  const [showWebChatEmoji, setShowWebChatEmoji] = useState(false);
  const [webChatAttachment, setWebChatAttachment] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const webChatFileInputRef = useRef<HTMLInputElement>(null);
  const webChatMessagesEndRef = useRef<HTMLDivElement>(null);
  
  // Quick replies
  const { quickReplies } = useQuickReplies();
  const [showWebChatQuickReplies, setShowWebChatQuickReplies] = useState(false);
  const [showWebChatQuickReplyDropdown, setShowWebChatQuickReplyDropdown] = useState(false);
  const [webChatQuickReplyFilter, setWebChatQuickReplyFilter] = useState('');
  
  // Contact info panel
  const [showInfoPanel, setShowInfoPanel] = useState(true);


  // Web Chat Functions
  const fetchWebChatConversations = async () => {
    if (!effectiveUserId) return;
    setWebChatLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('channel_type', 'webchat')
        .order('last_message_time', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching webchat conversations:', error);
        return;
      }
      setWebChatConversations(data || []);
      
      // Cargar etiquetas de contactos
      if (data && data.length > 0) {
        const phoneNumbers = data.map(c => c.phone_number).filter(Boolean);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('phone_number, tags')
          .in('phone_number', phoneNumbers);
        
        if (contacts) {
          const tagsMap: Record<string, string[]> = {};
          contacts.forEach(c => {
            if (c.tags && c.tags.length > 0) {
              tagsMap[c.phone_number] = c.tags;
            }
          });
          setContactTags(tagsMap);
        }
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setWebChatLoading(false);
    }
  };

  const fetchWebChatMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching webchat messages:', error);
      return;
    }
    setWebChatMessages(data || []);
  };

  const sendWebChatMessage = async (attachmentUrl?: string, attachmentType?: string) => {
    if (!selectedWebChat || (!webChatNewMessage.trim() && !attachmentUrl)) return;
    setSendingWebChat(true);
    try {
      const { error } = await supabase.functions.invoke('web-chat-send', {
        body: {
          conversationId: selectedWebChat.id,
          message: webChatNewMessage.trim(),
          userId: effectiveUserId,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentType || undefined
        }
      });

      if (error) throw error;
      setWebChatNewMessage('');
      setWebChatAttachment(null);
      fetchWebChatMessages(selectedWebChat.id);
    } catch (error) {
      console.error('Error sending webchat message:', error);
      toast.error('Error al enviar mensaje');
    } finally {
      setSendingWebChat(false);
    }
  };

  const handleWebChatFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWebChat) return;

    const validation = FileUploadService.validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploadingAttachment(true);
    try {
      const result = await FileUploadService.uploadFile(file, effectiveUserId || '', selectedWebChat.id);
      await sendWebChatMessage(result.url, file.type);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir archivo');
    } finally {
      setUploadingAttachment(false);
      if (webChatFileInputRef.current) {
        webChatFileInputRef.current.value = '';
      }
    }
  };

  const handleWebChatEmojiSelect = (emojiData: any) => {
    setWebChatNewMessage(prev => prev + emojiData.emoji);
    setShowWebChatEmoji(false);
  };

  // Manejar cambio de input con detección de "/"
  const handleWebChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWebChatNewMessage(value);
    
    if (value.startsWith('/')) {
      setWebChatQuickReplyFilter(value.substring(1).toLowerCase());
      setShowWebChatQuickReplyDropdown(true);
    } else {
      setShowWebChatQuickReplyDropdown(false);
      setWebChatQuickReplyFilter('');
    }
  };

  // Filtrar respuestas rápidas
  const filteredWebChatQuickReplies = quickReplies.filter(reply => 
    reply.title.toLowerCase().includes(webChatQuickReplyFilter) ||
    reply.message.toLowerCase().includes(webChatQuickReplyFilter)
  );

  // Seleccionar respuesta rápida (y enviar automáticamente)
  const handleWebChatQuickReplySelect = (reply: any, autoSend: boolean = false) => {
    if (autoSend) {
      // Enviar directamente
      setWebChatNewMessage(reply.message);
      setShowWebChatQuickReplies(false);
      setShowWebChatQuickReplyDropdown(false);
      setWebChatQuickReplyFilter('');
      // Enviar inmediatamente
      setTimeout(() => sendWebChatMessage(), 0);
    } else {
      setWebChatNewMessage(reply.message);
      setShowWebChatQuickReplies(false);
      setShowWebChatQuickReplyDropdown(false);
      setWebChatQuickReplyFilter('');
    }
  };

  useEffect(() => {
    fetchWebChatConversations();
  }, [effectiveUserId]);

  useEffect(() => {
    if (selectedWebChat) {
      fetchWebChatMessages(selectedWebChat.id);
    }
  }, [selectedWebChat]);

  useEffect(() => {
    webChatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [webChatMessages]);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm', { locale: es });
    } else if (diffDays === 1) {
      return 'Ayer ' + format(date, 'HH:mm', { locale: es });
    } else if (diffDays < 7) {
      return format(date, 'EEEE HH:mm', { locale: es });
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between shrink-0 pb-4">
        <div className="flex items-center space-x-2">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Web Chat</h1>
        </div>
        <Link to="/configuracion" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
          <Settings className="h-4 w-4" />
          Configuración IA
        </Link>
      </div>

      <Tabs defaultValue="conversations" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4">
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversaciones
          </TabsTrigger>
          <TabsTrigger value="funnels" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Embudos
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="flex-1 min-h-0 mt-0">
          {/* Web Chat Content */}
          <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg">
            {/* Web Chat Conversations List */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
              <Card className="h-full flex flex-col bg-card border-border rounded-r-none">
              <CardHeader className="py-3 border-b border-border">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Web Chat ({webChatConversations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                  {webChatLoading ? (
                    <div className="p-4 text-center text-muted-foreground">Cargando...</div>
                  ) : webChatConversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No hay conversaciones de web chat
                    </div>
                  ) : (
                    webChatConversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedWebChat(conv)}
                        className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedWebChat?.id === conv.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <MessageCircle className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm text-foreground truncate">
                                {conv.contact_name || 'Visitante Web'}
                              </span>
                              {conv.last_message_time && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(conv.last_message_time), 'dd/MM', { locale: es })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conv.last_message || 'Sin mensaje'}
                            </p>
                            {/* Etiquetas */}
                            {contactTags[conv.phone_number] && contactTags[conv.phone_number].length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {contactTags[conv.phone_number].slice(0, 2).map((tag) => (
                                  <Badge 
                                    key={tag}
                                    variant="outline" 
                                    className="text-[9px] px-1 py-0 h-3.5 border-0"
                                    style={{ 
                                      backgroundColor: `${getTagColor(tag)}20`,
                                      color: getTagColor(tag)
                                    }}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {(conv.unread_count || 0) > 0 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 text-xs bg-primary text-primary-foreground rounded-full mt-1">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Web Chat Messages Area */}
            <ResizablePanel defaultSize={showInfoPanel && selectedWebChat ? 50 : 75} minSize={35}>
              <Card className="h-full flex flex-col bg-background border-border overflow-hidden rounded-none">
              {selectedWebChat ? (
                <>
                  <CardHeader className="py-3 border-b border-border bg-muted">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedWebChat(null)}
                          className="md:hidden text-foreground"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <MessageCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium text-foreground">
                            {selectedWebChat.contact_name || 'Visitante Web'}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Session: {selectedWebChat.phone_number.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!selectedWebChat) return;
                            if (!confirm('¿Borrar memoria de IA para esta conversación?')) return;
                            const { error } = await supabase
                              .from('messages')
                              .delete()
                              .eq('conversation_id', selectedWebChat.id);
                            if (error) {
                              toast.error('Error al borrar memoria');
                            } else {
                              setWebChatMessages([]);
                              toast.success('Memoria de IA borrada');
                            }
                          }}
                          className="text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                          title="Borrar memoria de IA"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Borrar Memoria
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowInfoPanel(!showInfoPanel)}
                          className={showInfoPanel ? 'text-primary' : 'text-muted-foreground'}
                          title={showInfoPanel ? 'Ocultar información' : 'Mostrar información'}
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-background">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-2">
                        {webChatMessages.map((msg) => {
                          const isOutgoing = msg.direction === 'outbound';
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] p-2 px-3 rounded-lg shadow-sm ${
                                  isOutgoing
                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                                    : 'bg-muted text-foreground rounded-tl-none'
                                }`}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  {isOutgoing ? (
                                    <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {isOutgoing ? (msg.is_bot ? 'Bot' : 'Enviado') : 'Recibido'}
                                  </span>
                                </div>
                                {/* Render attachments */}
                                {(msg.file_url || msg.attachment_url) && (
                                  <div className="mb-2">
                                    {msg.message_type === 'image' || (msg.file_url || msg.attachment_url)?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                      <img 
                                        src={msg.file_url || msg.attachment_url || ''} 
                                        alt="Attachment" 
                                        className="max-w-full rounded-lg"
                                      />
                                    ) : (
                                      <a 
                                        href={msg.file_url || msg.attachment_url || ''} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-primary hover:underline"
                                      >
                                        <File className="h-4 w-4" />
                                        <span className="text-sm">Ver archivo</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {msg.content || ''}
                                </p>
                                {msg.created_at && (
                                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                                    {formatMessageTime(msg.created_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={webChatMessagesEndRef} />
                      </div>
                    </ScrollArea>
                    
                    {/* Input Area */}
                    <div className="p-3 border-t border-border bg-muted">
                      <input 
                        type="file" 
                        ref={webChatFileInputRef}
                        onChange={handleWebChatFileSelect}
                        accept="image/*,.pdf,.doc,.docx"
                        className="hidden"
                      />
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => webChatFileInputRef.current?.click()}
                          disabled={uploadingAttachment}
                          className="text-muted-foreground hover:text-foreground hover:bg-accent"
                          title="Adjuntar archivo"
                        >
                          <Paperclip className="h-5 w-5" />
                        </Button>
                        <Popover open={showWebChatEmoji} onOpenChange={setShowWebChatEmoji}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Emojis"
                            >
                              <Smile className="h-5 w-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 border-none" side="top" align="start">
                            <EmojiPicker onEmojiClick={handleWebChatEmojiSelect} />
                          </PopoverContent>
                        </Popover>
                        
                        {/* Botón de respuestas rápidas */}
                        <Popover open={showWebChatQuickReplies} onOpenChange={setShowWebChatQuickReplies}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Respuestas rápidas"
                            >
                              <Zap className="h-5 w-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-2" side="top" align="start">
                            <p className="text-sm font-medium px-2 py-1">Respuestas Rápidas</p>
                            {quickReplies.length === 0 ? (
                              <p className="text-sm text-muted-foreground p-2">No hay respuestas rápidas configuradas</p>
                            ) : (
                              <ScrollArea className="max-h-60">
                                {quickReplies.map((reply) => (
                                  <button
                                    key={reply.id}
                                    onClick={() => handleWebChatQuickReplySelect(reply)}
                                    className="w-full text-left px-2 py-2 hover:bg-muted rounded-md"
                                  >
                                    <p className="font-medium text-sm">{reply.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{reply.message}</p>
                                  </button>
                                ))}
                              </ScrollArea>
                            )}
                          </PopoverContent>
                        </Popover>
                        
                        <div className="flex-1 relative">
                          {/* Dropdown al escribir "/" */}
                          {showWebChatQuickReplyDropdown && filteredWebChatQuickReplies.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                              <div className="p-2">
                                <p className="text-xs text-muted-foreground px-2 mb-1">
                                  Respuestas Rápidas ({filteredWebChatQuickReplies.length})
                                </p>
                                {filteredWebChatQuickReplies.map((reply) => (
                                  <button
                                    key={reply.id}
                                    onClick={() => handleWebChatQuickReplySelect(reply)}
                                    className="w-full text-left px-3 py-2 hover:bg-muted rounded-md"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-sm">{reply.title}</span>
                                      {reply.hotkey && (
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{reply.hotkey}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{reply.message}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <Input
                            placeholder="Escribe '/' para respuestas rápidas..."
                            value={webChatNewMessage}
                            onChange={handleWebChatInputChange}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                // Si hay dropdown abierto con respuestas filtradas, seleccionar y enviar la primera
                                if (showWebChatQuickReplyDropdown && filteredWebChatQuickReplies.length > 0) {
                                  handleWebChatQuickReplySelect(filteredWebChatQuickReplies[0], true);
                                } else {
                                  sendWebChatMessage();
                                }
                              }
                            }}
                            className="bg-input border-border"
                          />
                        </div>
                        <Button 
                          onClick={() => sendWebChatMessage()} 
                          size="icon"
                          className="bg-primary hover:bg-primary/90"
                          disabled={(!webChatNewMessage.trim() && !webChatAttachment) || sendingWebChat || uploadingAttachment}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center bg-background">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Selecciona una conversación</p>
                    <p className="text-sm mt-1">para ver los mensajes del Web Chat</p>
                  </div>
                </CardContent>
              )}
            </Card>
            </ResizablePanel>

            {/* Contact Info Panel */}
            {selectedWebChat && showInfoPanel && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                  <ContactInfoPanel
                    conversationId={selectedWebChat.id}
                    contactName={selectedWebChat.contact_name || 'Visitante Web'}
                    phoneNumber={selectedWebChat.phone_number}
                    whatsappNumber={null}
                    hideFunnel={true}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="funnels" className="flex-1 min-h-0 mt-0">
          <div className="h-full flex flex-col items-center justify-center gap-4 bg-muted/20 rounded-lg p-8">
            <Globe className="h-12 w-12 text-primary/50" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Embudos WebChat</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Gestiona tus leads de webchat en embudos visuales con la vista Kanban completa.
              </p>
            </div>
            <Link to="/leads-webchat">
              <Button className="mt-2">
                <Zap className="h-4 w-4 mr-2" />
                Ir a Embudos WebChat
              </Button>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <WebchatConversionStats />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LandingChat;
