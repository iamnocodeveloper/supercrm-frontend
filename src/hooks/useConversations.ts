import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConversationQueryOptions, ConversationService, ConversationWithLastMessage } from '@/services/conversationService';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useAuth } from './useAuth';
import { useUserPermissions } from './useUserPermissions';
import { useAssignmentSettings } from './useAssignmentSettings';
import { Database } from '@/integrations/supabase/types';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

/**
 * Hook para gestionar conversaciones
 */
export const useConversations = (options: Omit<ConversationQueryOptions, 'restrictToAgentId' | 'includeUnassigned' | 'currentUserId'> = {}) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { user } = useAuth();
  const { isAdmin, hasPermission } = useUserPermissions();
  const { settings } = useAssignmentSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canSeeAll = isAdmin || hasPermission('puede_ver_mensajes_otros');
  const restrictToAgentId = !canSeeAll && user?.id ? user.id : null;
  const includeUnassigned = settings?.include_unassigned_for_all ?? true;
  const optionsKey = JSON.stringify(options);
  const stableOptions = useMemo(() => options, [optionsKey]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', effectiveUserId, restrictToAgentId, includeUnassigned, stableOptions],
    queryFn: () =>
      ConversationService.getConversations(effectiveUserId || '', {
        restrictToAgentId,
        includeUnassigned,
        currentUserId: user?.id || null,
        ...stableOptions,
      }),
    enabled: !!effectiveUserId,
    staleTime: 60000,
    refetchInterval: 120000,
  });

  // Query para obtener el conteo de no leídos - usa RPC eficiente
  const unreadCountQuery = useQuery({
    queryKey: ['unreadCount', effectiveUserId],
    queryFn: () => ConversationService.getUnreadCount(effectiveUserId || ''),
    enabled: !!effectiveUserId,
    staleTime: 60000, // 60 segundos
    refetchInterval: 60000, // 60 segundos
  });

  // Mutation para marcar como leído
  const markAsReadMutation = useMutation({
    mutationFn: ConversationService.markAsRead,
    onSuccess: (_, conversationId) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error) => {
      console.error('Error marking as read:', error);
      toast({
        title: 'Error',
        description: 'No se pudo marcar la conversación como leída',
        variant: 'destructive',
      });
    },
  });

  // Suscripción a cambios en tiempo real - también escuchar mensajes nuevos
  useEffect(() => {
    if (!effectiveUserId) return;

    // Suscribirse a cambios en conversaciones
    const conversationsSubscription = ConversationService.subscribeToConversations(
      effectiveUserId,
      (payload) => {
                // Si es UPDATE, actualizar el cache directamente y reordenar
        if (payload.eventType === 'UPDATE' && payload.new) {
          queryClient.setQueryData<ConversationWithLastMessage[]>(
            ['conversations', effectiveUserId, restrictToAgentId, includeUnassigned, stableOptions],
            (old) => {
              if (!old) return old;
              
              // Actualizar la conversación modificada
              const updated = old.map(conv => 
                conv.id === payload.new.id ? { ...conv, ...payload.new } : conv
              );
              
              // Reordenar por last_message_time (más reciente primero)
              return updated.sort((a, b) => {
                const aTime = a.last_message_time || a.updated_at || '';
                const bTime = b.last_message_time || b.updated_at || '';
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
            }
          );
        } else {
          // Para INSERT o DELETE, invalidar para refetch completo
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          // Actualizar unread count solo en INSERT/DELETE
          queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        }
      }
    );

    // Suscribirse a nuevos mensajes para reordenar conversaciones
    const messagesChannel = supabase
      .channel(`messages-global-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMsg = payload.new as any;
                    // Actualizar unread count directamente en cache
          if (newMsg?.direction === 'inbound' || newMsg?.direction === 'incoming') {
            queryClient.setQueryData<number>(
              ['unreadCount', effectiveUserId],
              (old = 0) => old + 1
            );
          }
          
          // Actualizar la conversación afectada directamente en cache en vez de refetch completo
          queryClient.setQueryData<ConversationWithLastMessage[]>(
            ['conversations', effectiveUserId, restrictToAgentId, includeUnassigned, stableOptions],
            (old) => {
              if (!old) return old;
              
              const convId = newMsg?.conversation_id;
              if (!convId) return old;
              
              const updated = old.map(conv => {
                if (conv.id === convId) {
                  return {
                    ...conv,
                    last_message: newMsg.content || conv.last_message,
                    last_message_time: newMsg.created_at || new Date().toISOString(),
                    unread_count: (newMsg.direction === 'inbound' || newMsg.direction === 'incoming')
                      ? (conv.unread_count || 0) + 1
                      : conv.unread_count
                  };
                }
                return conv;
              });
              
              // Reordenar por last_message_time
              return updated.sort((a, b) => {
                const aTime = a.last_message_time || a.updated_at || '';
                const bTime = b.last_message_time || b.updated_at || '';
                return new Date(bTime).getTime() - new Date(aTime).getTime();
              });
            }
          );
        }
      )
      .subscribe();

    return () => {
      conversationsSubscription.unsubscribe();
      supabase.removeChannel(messagesChannel);
    };
  }, [effectiveUserId, queryClient, restrictToAgentId, includeUnassigned, stableOptions]);

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error,
    unreadCount: unreadCountQuery.data || 0,
    markAsRead: markAsReadMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    refetch: conversationsQuery.refetch,
  };
};

/**
 * Hook para buscar conversaciones
 */
export const useSearchConversations = (searchTerm: string) => {
  const { effectiveUserId } = useEffectiveUserId();
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return useQuery({
    queryKey: ['searchConversations', effectiveUserId, debouncedSearchTerm],
    queryFn: () => ConversationService.searchConversations(effectiveUserId || '', debouncedSearchTerm),
    enabled: !!effectiveUserId && debouncedSearchTerm.length >= 2,
    staleTime: 10000,
  });
};

/**
 * Hook para gestionar mensajes de una conversación específica
 */
export const useMessages = (conversationId: string | null) => {
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();

  const [messageLimit, setMessageLimit] = useState(50);

  useEffect(() => {
    setMessageLimit(50);
  }, [conversationId]);
  // Query para obtener mensajes - optimizado
  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId, effectiveUserId, messageLimit],
    queryFn: () => ConversationService.getMessages(conversationId || '', effectiveUserId || '', messageLimit),
    enabled: !!conversationId && !!effectiveUserId,
    staleTime: 60000, // 60 segundos - el realtime maneja nuevos mensajes
    refetchInterval: 60000, // 60 segundos - polling de respaldo
  });

  // Mutation para enviar mensaje a través de WAHA o Telegram
  const sendMessageMutation = useMutation({
    mutationFn: ({ 
      conversationId, 
      userId, 
      message, 
      sessionName, 
      phoneNumber,
      channelType,
      telegramBotId,
      twilioConnectionId
    }: {
      conversationId: string;
      userId: string;
      message: string;
      sessionName: string;
      phoneNumber: string;
      channelType?: string;
      telegramBotId?: string | null;
      twilioConnectionId?: string | null;
    }) => ConversationService.sendMessage(
      conversationId, 
      userId, 
      message, 
      sessionName, 
      phoneNumber,
      channelType,
      telegramBotId,
      twilioConnectionId
    ),
    // Optimistic update - mostrar mensaje inmediatamente
    onMutate: async (variables) => {
      // Cancelar queries en curso
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      
      // Snapshot del estado anterior
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', conversationId, effectiveUserId, messageLimit]);
      
      // Crear mensaje temporal optimista
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: variables.conversationId,
        user_id: variables.userId,
        content: variables.message,
        message: variables.message,
        direction: 'outbound',
        message_type: 'text',
        is_bot: false,
        status: 'sending',
        created_at: new Date().toISOString(),
        attachment_url: null,
        file_url: null,
        metadata: null,
        responded_by: null,
        is_group_message: false,
        participant_jid: null,
        participant_name: null,
      } as unknown as Message;
      
      // Agregar mensaje optimista a la cache
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId, effectiveUserId, messageLimit],
        (old = []) => [...old, tempMessage]
      );
      
      return { previousMessages };
    },
    onSuccess: (savedMessage) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error, variables, context) => {
      console.error('Error sending message:', error);
      // Revertir al estado anterior en caso de error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', conversationId, effectiveUserId, messageLimit], context.previousMessages);
      }
      
      // Extraer mensaje de error del backend si está disponible
      let description = 'No se pudo enviar el mensaje';
      const err = error as any;
      const body = err?.context?.body;
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.error) description = String(parsed.error);
        } catch {}
      } else if (err?.message && typeof err.message === 'string') {
        description = err.message;
      }
      // Truncar descripción para el toast
      if (description.length > 220) description = description.slice(0, 217) + '...';
      
      toast({
        title: 'Error al enviar mensaje',
        description,
        variant: 'destructive',
      });
    },
  });

  // Mutation para enviar mensaje con adjunto
  const sendMessageWithAttachmentMutation = useMutation({
    mutationFn: ({ 
      conversationId, 
      userId, 
      message, 
      sessionName, 
      phoneNumber,
      fileUrl,
      fileName,
      mimeType,
      channelType,
      telegramBotId,
      twilioConnectionId
    }: {
      conversationId: string;
      userId: string;
      message: string;
      sessionName: string;
      phoneNumber: string;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      channelType?: string;
      telegramBotId?: string | null;
      twilioConnectionId?: string | null;
    }) => ConversationService.sendMessageWithAttachment(
      conversationId, 
      userId, 
      message, 
      sessionName, 
      phoneNumber,
      fileUrl,
      fileName,
      mimeType,
      channelType,
      telegramBotId,
      twilioConnectionId
    ),
    onSuccess: () => {
      toast({
        title: 'Mensaje enviado',
        description: 'El archivo se envió correctamente',
      });
      // Invalidar mensajes para refrescar
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error) => {
      console.error('Error sending message with attachment:', error);
      
      // Extraer mensaje de error del backend si está disponible
      let description = 'No se pudo enviar el archivo';
      const err = error as any;
      const body = err?.context?.body;
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.error) description = String(parsed.error);
        } catch {}
      } else if (err?.message && typeof err.message === 'string') {
        description = err.message;
      }
      if (description.length > 220) description = description.slice(0, 217) + '...';
      
      toast({
        title: 'Error al enviar archivo',
        description,
        variant: 'destructive',
      });
    },
  });

  // Suscripción a cambios en tiempo real de mensajes
  useEffect(() => {
    if (!conversationId) return;

    const subscription = ConversationService.subscribeToMessages(
      conversationId,
      (payload) => {
                if (payload.eventType === 'INSERT') {
          // Agregar nuevo mensaje a la cache con la key correcta (incluye effectiveUserId)
          queryClient.setQueryData(
            ['messages', conversationId, effectiveUserId, messageLimit],
            (oldMessages: Message[] = []) => {
              // Evitar duplicados por ID real
              const exists = oldMessages.some(msg => msg.id === payload.new.id);
              if (exists) return oldMessages;
              // Remover mensajes temporales optimistas que coincidan con este mensaje real
              const filtered = oldMessages.filter(msg => {
                if (!msg.id.startsWith('temp-')) return true;
                // Si el mensaje temporal tiene el mismo contenido y conversación, reemplazar
                return msg.content !== payload.new.content || msg.conversation_id !== payload.new.conversation_id;
              });
              return [...filtered, payload.new];
            }
          );
        }

      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, queryClient, effectiveUserId, messageLimit]);

  return {
    messages: messagesQuery.data || [],
    hasMoreMessages: (messagesQuery.data?.length || 0) >= messageLimit,
    isLoadingOlderMessages: messagesQuery.isFetching && messageLimit > 50,
    loadOlderMessages: () => setMessageLimit(prev => prev + 50),
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    sendMessage: sendMessageMutation.mutate,
    sendMessageWithAttachment: sendMessageWithAttachmentMutation.mutate,
    isSending: sendMessageMutation.isPending || sendMessageWithAttachmentMutation.isPending,
    refetch: messagesQuery.refetch,
  };
};

export const useConversation = (conversationId: string | null) => {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => ConversationService.getConversationById(conversationId || ''),
    enabled: !!conversationId,
    staleTime: 60000,
  });
};