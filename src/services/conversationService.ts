import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import logger from '@/lib/logger';
import { proxiedFetch } from '@/services/internalProxy';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export interface ConversationWithLastMessage extends Conversation {
  messages?: Message[];
}

export interface ConversationQueryOptions {
  restrictToAgentId?: string | null;
  includeUnassigned?: boolean;
  limit?: number;
  offset?: number;
  filterMode?: 'all' | 'unassigned' | 'funnel' | 'pending' | 'stale' | 'offline' | 'bot_off' | 'urgent' | 'groups' | 'individual';
  assignmentFilter?: 'all' | 'mine' | 'unassigned';
  currentUserId?: string | null;
  sessionFilter?: {
    type: 'whatsapp' | 'telegram' | 'twilio';
    id: string;
    identifier: string;
  } | null;
  searchTerm?: string;
  leadIds?: string[];
  offlineAgentIds?: string[];
}

export class ConversationService {
  /**
   * Obtiene todas las conversaciones del usuario actual
   */
  static async getConversations(
    userId: string,
    opts?: ConversationQueryOptions
  ): Promise<ConversationWithLastMessage[]> {
    try {
      // Seleccionar columnas necesarias (excluyendo mensajes) para reducir egress
      let query = supabase
        .from('conversations')
        .select('id, user_id, pushname, phone_number, whatsapp_number, connection_id, session_name, last_message, last_message_time, unread_count, status, channel_type, telegram_bot_id, twilio_connection_id, lead_id, created_at, updated_at, contact_name, casino_user_created, casino_username, last_inbound_message_time, payment_receipt_detected_at, payment_receipt_sent, assigned_to, assigned_at, assigned_by, snoozed_until, snoozed_by, snooze_reason, is_followup_due, is_group, group_subject, group_participants_count')
        .eq('user_id', userId)
        // Excluir estados/difusiones de WhatsApp (status@broadcast, <id>@broadcast)
        .not('phone_number', 'like', '%@broadcast');

      if (opts?.restrictToAgentId) {
        if (opts.includeUnassigned) {
          query = query.or(`assigned_to.eq.${opts.restrictToAgentId},assigned_to.is.null`);
        } else {
          query = query.eq('assigned_to', opts.restrictToAgentId);
        }
      }

      if (opts?.assignmentFilter === 'mine' && opts.currentUserId) {
        query = query.eq('assigned_to', opts.currentUserId);
      } else if (opts?.assignmentFilter === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      if (opts?.sessionFilter) {
        if (opts.sessionFilter.type === 'whatsapp') query = query.eq('whatsapp_number', opts.sessionFilter.identifier);
        if (opts.sessionFilter.type === 'telegram') query = query.eq('telegram_bot_id', opts.sessionFilter.id);
        if (opts.sessionFilter.type === 'twilio') query = query.eq('twilio_connection_id', opts.sessionFilter.id);
      }

      const filterMode = opts?.filterMode || 'all';
      if (filterMode === 'unassigned') query = query.is('lead_id', null);
      if (filterMode === 'pending') query = query.gt('unread_count', 0);
      if (filterMode === 'stale') {
        query = query.gt('unread_count', 0).lt('last_inbound_message_time', new Date(Date.now() - 30 * 60 * 1000).toISOString());
      }
      if (filterMode === 'offline' && opts?.offlineAgentIds?.length) query = query.in('assigned_to', opts.offlineAgentIds);
      if (filterMode === 'urgent') query = query.or('payment_receipt_detected_at.not.is.null,last_message.ilike.%comprobante%');
      if (filterMode === 'funnel' && opts?.leadIds?.length) query = query.in('lead_id', opts.leadIds);
      if (filterMode === 'funnel' && opts?.leadIds && opts.leadIds.length === 0) return [];
      if (filterMode === 'groups') query = query.eq('is_group', true);
      if (filterMode === 'individual') query = query.or('is_group.is.null,is_group.eq.false');

      const normalizedSearch = opts?.searchTerm?.trim();
      if (normalizedSearch && normalizedSearch.length >= 2) {
        const safeSearch = normalizedSearch.replace(/[,%]/g, '');
        query = query.or(
          `pushname.ilike.%${safeSearch}%,phone_number.ilike.%${safeSearch}%,contact_name.ilike.%${safeSearch}%,last_message.ilike.%${safeSearch}%,whatsapp_number.ilike.%${safeSearch}%`
        );
      }

      const limit = opts?.limit ?? 100;
      const offset = opts?.offset ?? 0;
      const { data, error } = await query
        .not('channel_type', 'in', '(webchat,player_chat)')
        .order('last_message_time', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching conversations:', error);
        throw error;
      }

      return (data || []) as unknown as ConversationWithLastMessage[];
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Obtiene una conversación específica por ID
   */
  static async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('Error fetching conversation:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getConversationById:', error);
      throw error;
    }
  }

  /**
   * Busca conversaciones por nombre o número de teléfono
   */
  static async searchConversations(userId: string, searchTerm: string): Promise<ConversationWithLastMessage[]> {
    try {
      // Seleccionar columnas necesarias (excluyendo mensajes) para reducir egress
      const { data, error } = await supabase
        .from('conversations')
        .select('id, user_id, pushname, phone_number, whatsapp_number, connection_id, session_name, last_message, last_message_time, unread_count, status, channel_type, telegram_bot_id, twilio_connection_id, lead_id, created_at, updated_at, contact_name, casino_user_created, casino_username, last_inbound_message_time, payment_receipt_detected_at, payment_receipt_sent, assigned_to, assigned_at, assigned_by, snoozed_until, snoozed_by, snooze_reason, is_followup_due, is_group, group_subject, group_participants_count')
        .eq('user_id', userId)
        .or(`pushname.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
        .order('last_message_time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error searching conversations:', error);
        throw error;
      }

      return (data || []) as unknown as ConversationWithLastMessage[];
    } catch (error) {
      console.error('Error in searchConversations:', error);
      throw error;
    }
  }

  /**
   * Obtiene los mensajes de una conversación específica
   */
  static async getMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    try {
      // Seleccionar solo columnas necesarias para reducir egress
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, user_id, content, message, direction, message_type, is_bot, status, created_at, attachment_url, file_url, metadata, responded_by')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      // Retornar en orden cronológico (más antiguos primero)
      return ((data || []) as unknown as Message[]).reverse();
    } catch (error) {
      console.error('Error in getMessages:', error);
      throw error;
    }
  }

  /**
   * Envía un nuevo mensaje usando el edge function de Supabase
   */
  static async sendMessage(
    conversationId: string,
    userId: string,
    message: string,
    sessionName: string,
    phoneNumber: string,
    channelType?: string,
    telegramBotId?: string | null,
    twilioConnectionId?: string | null
  ): Promise<Message | null> {
    try {
      // Si es WebChat, usar web-chat-send
      if (channelType === 'webchat') {
        logger.debug('[ConversationService] Sending via WebChat');
        
        const { data, error } = await supabase.functions.invoke('web-chat-send', {
          body: {
            conversationId,
            message,
            userId
          }
        });

        if (error) {
          console.error('[ConversationService] Error calling web-chat-send:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send WebChat message');
        }

        logger.debug('[ConversationService] WebChat message sent successfully');
        return data.savedMessage;
      }
      
      // Si es Telegram, usar telegram-send-message
      if (channelType === 'telegram' && telegramBotId) {
        logger.debug('[ConversationService] Sending via Telegram');
        
        const { data, error } = await supabase.functions.invoke('telegram-send-message', {
          body: {
            chatId: phoneNumber,
            message,
            userId,
            conversationId,
            telegramBotId,
            isBot: false
          }
        });

        if (error) {
          console.error('[ConversationService] Error calling telegram-send-message:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send Telegram message');
        }

        logger.debug('[ConversationService] Telegram message sent successfully');
        return data.savedMessage;
      }

      // Si es Twilio, usar twilio-send-message
      if (channelType === 'twilio' && twilioConnectionId) {
        logger.debug('[ConversationService] Sending via Twilio');
        
        const { data, error } = await supabase.functions.invoke('twilio-send-message', {
          body: {
            twilioConnectionId,
            phoneNumber,
            message,
            userId,
            conversationId,
            isBot: false
          }
        });

        if (error) {
          console.error('[ConversationService] Error calling twilio-send-message:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send Twilio message');
        }

        logger.debug('[ConversationService] Twilio message sent successfully');
        return data.savedMessage;
      }
      
      // Si es WhatsApp, usar waha-send-message
      logger.debug('[ConversationService] Sending via WhatsApp');
      
      const { data, error } = await supabase.functions.invoke('waha-send-message', {
        body: {
          sessionName,
          phoneNumber,
          message,
          userId,
          conversationId
        }
      });

      if (error) {
        console.error('[ConversationService] Error calling waha-send-message:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send WhatsApp message');
      }

      logger.debug('[ConversationService] WhatsApp message sent successfully');
      return data.savedMessage;
    } catch (error) {
      console.error('[ConversationService] Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Envía un mensaje solo al webhook sin guardarlo en la base de datos
   */
  static async sendMessageToWebhookOnly(messageData: {
    user_id: string;
    conversation_id?: string;
    whatsapp_number: string;
    instance_name: string;
    pushname?: string;
    message?: string;
    message_type?: string;
    direction: string;
    attachment_url?: string;
    file_url?: string;
    is_bot?: boolean;
  }): Promise<void> {
    try {
      const webhookUrl = 'enviar-mensaje';
      
      // Generar ID único para el mensaje
      const messageId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const payload = {
        id: messageId,
        user_id: messageData.user_id,
        conversation_id: messageData.conversation_id,
        whatsapp_number: messageData.whatsapp_number,
        instance_name: messageData.instance_name,
        pushname: messageData.pushname,
        message: messageData.message,
        message_type: messageData.message_type || 'text',
        direction: messageData.direction,
        attachment_url: messageData.attachment_url,
        file_url: messageData.file_url,
        is_bot: messageData.is_bot || false,
        created_at: now,
        updated_at: now,
      };

      const response = await proxiedFetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook response error: ${response.status}`);
      }

      logger.debug('Message sent to webhook successfully');
    } catch (error) {
      console.error('Error sending to webhook:', error);
      throw error; // Lanzamos el error para que se maneje en el componente
    }
  }

  /**
   * Envía mensaje al webhook de n8n
   */
  private static async sendToWebhook(messageData: Message): Promise<void> {
    try {
      const webhookUrl = 'enviar-mensaje';
      
      // Obtener información de la conversación para los campos faltantes
      const { data: conversation } = await supabase
        .from('conversations')
        .select('whatsapp_number, pushname')
        .eq('id', messageData.conversation_id)
        .single();
      
      const payload = {
        id: messageData.id,
        user_id: messageData.user_id,
        conversation_id: messageData.conversation_id,
        whatsapp_number: conversation?.whatsapp_number || '',
        pushname: conversation?.pushname || '',
        message: messageData.message,
        message_type: messageData.message_type,
        direction: messageData.direction,
        attachment_url: messageData.attachment_url,
        file_url: messageData.file_url,
        is_bot: messageData.is_bot,
        created_at: messageData.created_at,
      };

      await proxiedFetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      logger.debug('Message sent to webhook successfully');
    } catch (error) {
      console.error('Error sending to webhook:', error);
      // No lanzamos el error para que no afecte el flujo principal
    }
  }

  /**
   * Actualiza el último mensaje de una conversación
   */
  static async updateConversationLastMessage(
    conversationId: string,
    lastMessage: string,
    lastMessageAt: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          last_message: lastMessage,
          last_message_time: lastMessageAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        console.error('Error updating conversation:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in updateConversationLastMessage:', error);
      throw error;
    }
  }

  /**
   * Marca los mensajes de una conversación como leídos
   */
  static async markAsRead(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          unread_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        console.error('Error marking conversation as read:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in markAsRead:', error);
      throw error;
    }
  }

  /**
   * Obtiene el conteo de conversaciones no leídas
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      // Usar RPC para calcular en la base de datos y reducir egress
      const { data, error } = await supabase.rpc('get_unread_count', { user_uuid: userId });

      if (error) {
        console.error('Error getting unread count:', error);
        throw error;
      }

      return data || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      throw error;
    }
  }

  /**
   * Suscribirse a cambios en tiempo real de conversaciones
   */
  static subscribeToConversations(userId: string, callback: (payload: any) => void) {
    // Usar nombre de canal fijo para reusar conexiones (sin Date.now())
    const channelName = `conversations-${userId}`;
    
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('[Realtime] Conversation change received:', payload.eventType, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Conversations subscription status:', status);
      });
  }

  /**
   * Suscribirse a cambios en tiempo real de mensajes
   */
  static subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    // Usar nombre de canal fijo para reusar conexiones (sin Date.now())
    const channelName = `messages-${conversationId}`;
    
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('[Realtime] Message change received:', payload.eventType, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Messages subscription status:', status);
      });
  }

  /**
   * Actualiza la sesión de WhatsApp asociada a una conversación
   */
  static async updateConversationSession(
    conversationId: string,
    newWhatsAppNumber: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          whatsapp_number: newWhatsAppNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        console.error('Error updating conversation session:', error);
        throw error;
      }

      console.log('[ConversationService] Session updated successfully');
    } catch (error) {
      console.error('Error in updateConversationSession:', error);
      throw error;
    }
  }

  /**
   * Envía un mensaje con archivo adjunto
   */
  static async sendMessageWithAttachment(
    conversationId: string,
    userId: string,
    message: string,
    sessionName: string,
    phoneNumber: string,
    fileUrl: string,
    fileName: string,
    mimeType: string,
    channelType?: string,
    telegramBotId?: string | null,
    twilioConnectionId?: string | null,
    messageType?: 'sticker' | 'image' | 'video' | 'audio' | 'document'
  ): Promise<Message | null> {
    try {
      console.log('[ConversationService] Sending message with attachment...', {
        channelType,
        fileName,
        mimeType,
        messageType
      });

      // Si es Telegram, usar telegram-send-file
      if (channelType === 'telegram' && telegramBotId) {
        console.log('[ConversationService] Sending via Telegram with file...');

        const { data, error } = await supabase.functions.invoke('telegram-send-file', {
          body: {
            chatId: phoneNumber,
            fileUrl,
            caption: message,
            mimeType,
            userId,
            conversationId,
            telegramBotId,
            isBot: false
          }
        });

        if (error) {
          console.error('[ConversationService] Error calling telegram-send-file:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send Telegram file');
        }

        console.log('[ConversationService] Telegram file sent successfully');
        return data.savedMessage;
      }

      // Si es Twilio, usar twilio-send-file
      if (channelType === 'twilio' && twilioConnectionId) {
        console.log('[ConversationService] Sending via Twilio with file...');

        const { data, error } = await supabase.functions.invoke('twilio-send-file', {
          body: {
            twilioConnectionId,
            phoneNumber,
            message,
            fileUrl,
            fileName,
            mimeType,
            userId,
            conversationId,
            messageType
          }
        });

        if (error) {
          console.error('[ConversationService] Error calling twilio-send-file:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send Twilio file');
        }

        console.log('[ConversationService] Twilio file sent successfully');
        return data.savedMessage;
      }

      // Si es WhatsApp (WAHA), usar waha-send-file
      console.log('[ConversationService] Sending via WhatsApp with file...');

      const { data, error } = await supabase.functions.invoke('waha-send-file', {
        body: {
          sessionName,
          phoneNumber,
          message,
          fileUrl,
          fileName,
          mimeType,
          userId,
          conversationId,
          messageType
        }
      });

      if (error) {
        console.error('[ConversationService] Error calling waha-send-file:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send WhatsApp file');
      }

      console.log('[ConversationService] WhatsApp file sent successfully');
      return data.savedMessage;
    } catch (error) {
      console.error('[ConversationService] Error in sendMessageWithAttachment:', error);
      throw error;
    }
  }

  /**
   * ============================================
   * Player Chat (channel_type = 'player_chat')
   * ============================================
   * La fuente de verdad es SIEMPRE el Player Portal externo.
   * NO se guarda nada en Supabase. Todo se cachea localmente en memoria
   * (TTL 5s para chats, 2s para mensajes) para acelerar el render.
   */

  /**
   * Lista chats desde el Player Portal (con cache en memoria).
   * Usa deduplicación de in-flight requests para evitar llamadas concurrentes.
   */
  static async listPlayerChats(forceRefresh = false): Promise<import('./playerChatCache').PortalChat[]> {
    const { playerChatCache } = await import('./playerChatCache');

    if (!forceRefresh) {
      const cached = playerChatCache.getChats();
      if (cached) return cached;

      const inFlight = playerChatCache.getChatsInFlight();
      if (inFlight) return inFlight;
    } else {
      playerChatCache.invalidateChats();
    }

    const promise = (async () => {
      const { data, error } = await supabase.functions.invoke('player-portal-proxy', {
        body: { action: 'list' }
      });
      if (error) {
        console.error('[PlayerChats] list error:', error);
        throw error;
      }
      const chats = (data?.chats ?? []) as import('./playerChatCache').PortalChat[];
      playerChatCache.setChats(chats);
      return chats;
    })();

    playerChatCache.setChatsInFlight(promise);
    try {
      const result = await promise;
      return result;
    } finally {
      playerChatCache.setChatsInFlight(null);
    }
  }

  /**
   * Refresca la lista de chats desde la API externa (invalida cache).
   */
  static async refreshPlayerChats(): Promise<import('./playerChatCache').PortalChat[]> {
    return this.listPlayerChats(true);
  }

  /**
   * Devuelve los chats en cache SIN hacer fetch (para render inmediato).
   */
  static getCachedPlayerChats(): import('./playerChatCache').PortalChat[] {
    // No podemos usar await aquí, así que usamos require síncrono
    // Como el cache es singleton, importamos dinámicamente y leemos directamente
    return (playerChatCacheGlobal?.getChats() ?? []);
  }

  /**
   * Obtiene los mensajes de un chat de jugadores desde el Player Portal externo.
   * Usa cache en memoria con TTL.
   */
  static async getPlayerChatMessages(
    playerChatId: string,
    forceRefresh = false
  ): Promise<import('./playerChatCache').PortalMessage[]> {
    const { playerChatCache } = await import('./playerChatCache');

    if (!forceRefresh) {
      const cached = playerChatCache.getMessages(playerChatId);
      if (cached) return cached;

      const inFlight = playerChatCache.getMessagesInFlight(playerChatId);
      if (inFlight) return inFlight;
    } else {
      playerChatCache.invalidateMessages(playerChatId);
    }

    const promise = (async () => {
      const { data, error } = await supabase.functions.invoke('player-portal-proxy', {
        body: { action: 'messages', chat_id: playerChatId, limit: 1000 }
      });

      if (error) {
        console.error('[PlayerChats] get messages error:', error);
        throw error;
      }
      const messages = (data?.messages ?? []) as import('./playerChatCache').PortalMessage[];
      console.log('[PlayerChats] get messages response', {
        chat_id: playerChatId,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : null,
        messagesCount: messages.length
      });
      // Reconciliar en vez de sobrescribir: preserva mensajes optimistas del operador
      // y mensajes locales que sean más nuevos que el último devuelto por el portal.
      const merged = playerChatCache.reconcileMessages(playerChatId, messages);
      return merged;
    })();

    playerChatCache.setMessagesInFlight(playerChatId, promise);
    try {
      const result = await promise;
      return result;
    } finally {
      playerChatCache.setMessagesInFlight(playerChatId, undefined);
    }
  }

  /**
   * Refresca los mensajes de un chat (invalida cache).
   */
  static async refreshPlayerChatMessages(playerChatId: string): Promise<import('./playerChatCache').PortalMessage[]> {
    return this.getPlayerChatMessages(playerChatId, true);
  }

  /**
   * Devuelve los mensajes en cache SIN hacer fetch.
   */
  static getCachedPlayerChatMessages(playerChatId: string): import('./playerChatCache').PortalMessage[] {
    return (playerChatCacheGlobal?.getMessages(playerChatId) ?? []);
  }

  /**
   * Envía un mensaje a un chat de jugadores: solo llama al proxy externo.
   * NO guarda nada en Supabase. El mensaje aparecerá cuando se refresquen los mensajes.
   */
  static async sendPlayerChatMessage(
    playerChatId: string,
    body: string
  ): Promise<void> {
    if (!body?.trim()) return;
    const { playerChatCache } = await import('./playerChatCache');

    const content = body.trim();
    const now = new Date().toISOString();

    // Sembrar el cache si está vacío para que el append optimístico persista
    if (playerChatCache.getMessages(playerChatId) === null) {
      playerChatCache.setMessages(playerChatId, []);
    }

    // Append optimístico al cache para feedback inmediato
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    playerChatCache.appendMessage(playerChatId, {
      id: optimisticId,
      sender: 'operator',
      body: content,
      created_at: now,
      message_type: 'text'
    });

    // Enviar al proxy externo
    const { error: proxyErr } = await supabase.functions.invoke('player-portal-proxy', {
      body: {
        action: 'send',
        chat_id: playerChatId,
        body: content,
        message_type: 'text'
      }
    });
    if (proxyErr) {
      console.error('[PlayerChats] send error:', proxyErr);
      // Invalidar cache para forzar re-fetch en el siguiente poll (revierte el optimístico)
      playerChatCache.invalidateMessages(playerChatId);
      throw proxyErr;
    }

    // Refrescar preview del listado. NO invalidamos mensajes: dejamos el optimístico
    // hasta que el próximo poll reconcilie con el portal.
    playerChatCache.invalidateChats();
  }

  /**
   * Envía un sticker a un chat de jugadores.
   * - Sube el sticker a Supabase Storage.
   * - Llama al proxy externo como 'sticker'.
   * - NO guarda nada en la tabla messages de Supabase.
   */
  static async sendPlayerChatSticker(
    playerChatId: string,
    file: File,
    userId: string
  ): Promise<void> {
    const { uploadSticker } = await import('./stickerService');
    const { playerChatCache } = await import('./playerChatCache');

    // 1) Subir sticker a Storage
    const upload = await uploadSticker(file, userId);
    if (!upload.success || !upload.publicUrl) {
      throw new Error(upload.error || 'Error al subir sticker');
    }

    const now = new Date().toISOString();
    // Sembrar el cache si está vacío
    if (playerChatCache.getMessages(playerChatId) === null) {
      playerChatCache.setMessages(playerChatId, []);
    }
    // Append optimístico
    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    playerChatCache.appendMessage(playerChatId, {
      id: optimisticId,
      sender: 'operator',
      body: '🎨 Sticker',
      created_at: now,
      message_type: 'sticker',
      file_url: upload.publicUrl,
      file_name: file.name
    });

    // 2) Reenviar al proxy externo
    const { error: proxyErr } = await supabase.functions.invoke('player-portal-proxy', {
      body: {
        action: 'send',
        chat_id: playerChatId,
        message_type: 'sticker',
        file_url: upload.publicUrl,
        file_name: file.name,
        caption: ''
      }
    });
    if (proxyErr) {
      console.error('[PlayerChats] send sticker error:', proxyErr);
      playerChatCache.invalidateMessages(playerChatId);
      throw proxyErr;
    }

    // Solo refrescamos el preview de la lista; conservamos el optimístico en mensajes
    playerChatCache.invalidateChats();
  }

  /**
   * Suscripción a cambios del cache (para reactividad en componentes).
   * Devuelve función de cleanup.
   */
  static async subscribeToPlayerCache(callback: () => void): Promise<() => void> {
    const { playerChatCache } = await import('./playerChatCache');
    return playerChatCache.subscribe(callback);
  }

  /**
   * Invalida todo el cache (útil al hacer logout o cambiar de cuenta).
   */
  static async clearPlayerCache(): Promise<void> {
    const { playerChatCache } = await import('./playerChatCache');
    playerChatCache.invalidateAll();
  }

  // ============================================
  // Columnas y asignaciones del kanban player_chat
  // ============================================

  /**
   * Lista las columnas de player_chat de un workspace.
   * Si no existen, crea las 4 columnas por defecto automáticamente.
   */
  static async listPlayerChatColumns(
    workspaceId: string,
    userId: string
  ): Promise<import('./playerChatCache').PlayerChatColumn[]> {
    const { playerChatCache } = await import('./playerChatCache');

    // Cache hit
    const cached = playerChatCache.getColumns();
    if (cached) return cached;

    // Intentar obtener de Supabase
    const { data, error } = await supabase
      .from('player_chat_columns')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('position');

    if (error) {
      console.error('[PlayerChats] list columns error:', error);
      throw error;
    }

    // Si no hay columnas, crear las 4 por defecto vía RPC
    if (!data || data.length === 0) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_default_player_chat_columns',
        { p_workspace_id: workspaceId, p_user_id: userId }
      );
      if (rpcError) {
        console.error('[PlayerChats] create default columns error:', rpcError);
        // fallback: insertar manualmente
        const defaults = [
          { name: 'Nuevos', color: '#22c55e', position: 0, is_default: true },
          { name: 'En conversación', color: '#3b82f6', position: 1, is_default: false },
          { name: 'Esperando respuesta', color: '#eab308', position: 2, is_default: false },
          { name: 'Cerrados', color: '#6b7280', position: 3, is_default: false }
        ];
        const { data: insData, error: insErr } = await supabase
          .from('player_chat_columns')
          .insert(defaults.map((d) => ({ ...d, user_id: userId, workspace_id: workspaceId })))
          .select();
        if (insErr) throw insErr;
        const columns = (insData ?? []) as import('./playerChatCache').PlayerChatColumn[];
        playerChatCache.setColumns(columns);
        return columns;
      }
      const columns = (rpcData ?? []) as import('./playerChatCache').PlayerChatColumn[];
      playerChatCache.setColumns(columns);
      return columns;
    }

    const columns = data as import('./playerChatCache').PlayerChatColumn[];
    playerChatCache.setColumns(columns);
    return columns;
  }

  /**
   * Renombra una columna y/o cambia su color.
   * Solo se permite editar name y color (no position, no is_default, no crear/eliminar).
   */
  static async renamePlayerChatColumn(
    columnId: string,
    name: string,
    color?: string
  ): Promise<void> {
    const { playerChatCache } = await import('./playerChatCache');

    const patch: Record<string, any> = {};
    if (name && name.trim().length > 0) patch.name = name.trim();
    if (color) patch.color = color;

    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from('player_chat_columns')
      .update(patch)
      .eq('id', columnId);

    if (error) {
      console.error('[PlayerChats] rename column error:', error);
      throw error;
    }

    // Invalidar cache para forzar refresh
    playerChatCache.invalidateColumns();
  }

  /**
   * Lista las asignaciones chat → columna de un usuario.
   * Devuelve un mapa { player_chat_id: column_id }.
   */
  static async listPlayerChatAssignments(
    userId: string
  ): Promise<Record<string, string>> {
    const { playerChatCache } = await import('./playerChatCache');

    // Si ya hay asignaciones en cache, devolverlas
    const cached = playerChatCache.getAllAssignments();
    if (Object.keys(cached).length > 0) return cached;

    const { data, error } = await supabase
      .from('player_chat_assignments')
      .select('player_chat_id, column_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[PlayerChats] list assignments error:', error);
      throw error;
    }

    const map: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
      map[row.player_chat_id] = row.column_id;
    });

    playerChatCache.setAssignmentsBulk(map);
    return map;
  }

  /**
   * Asigna (o reasigna) un chat a una columna.
   * Si la asignación no existe, se crea. Si existe, se actualiza.
   */
  static async assignPlayerChatToColumn(
    playerChatId: string,
    columnId: string,
    userId: string
  ): Promise<void> {
    const { playerChatCache } = await import('./playerChatCache');

    // Update optimístico del cache
    playerChatCache.setAssignment(playerChatId, columnId);

    const { error } = await supabase
      .from('player_chat_assignments')
      .upsert(
        { user_id: userId, player_chat_id: playerChatId, column_id: columnId },
        { onConflict: 'user_id,player_chat_id' }
      );

    if (error) {
      console.error('[PlayerChats] assign to column error:', error);
      // Rollback del cache
      const all = playerChatCache.getAllAssignments();
      if (!all[playerChatId]) {
        // No había antes, eliminar del cache
        playerChatCache.setAssignmentsBulk({ ...all, [playerChatId]: '' });
        delete (all as any)[playerChatId];
        playerChatCache.setAssignmentsBulk(all);
      }
      throw error;
    }
  }
}

// Singleton global para acceso síncrono desde getCachedPlayerChats/getCachedPlayerChatMessages
let playerChatCacheGlobal: any = null;
// Inicializamos de forma perezosa
import('./playerChatCache').then((mod) => {
  playerChatCacheGlobal = mod.playerChatCache;
});