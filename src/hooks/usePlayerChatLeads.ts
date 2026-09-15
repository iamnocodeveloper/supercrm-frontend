// usePlayerChatLeads.ts
// Hook que reemplaza useInfiniteLeads para workspaces de tipo player_chat.
// La fuente de datos es el cache/API externa (playerChatCache), NO Supabase.
// Las columnas (4 fijas) y las asignaciones chat→columna viven en Supabase
// (player_chat_columns + player_chat_assignments) y se cachean en memoria.

import { useEffect, useState, useCallback, useRef } from 'react';
import { playerChatCache, PortalChat } from '@/services/playerChatCache';
import { ConversationService } from '@/services/conversationService';

export interface PlayerChatLead {
  id: string; // virtual id: "virtual-{player_chat_id}"
  name: string;
  phone: string | null;
  email: null;
  company: null;
  notes: null;
  value: null;
  tags: null;
  column_id: string;
  position: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_inbound_message_time: string | null;
  bot_active: boolean;
  isVirtual: true;
  originalConversationId: string;
  conversations: Array<{
    id: string;
    phone_number: string | null;
    pushname: string | null;
    contact_name: string | null;
    external_player: any;
    created_at: string;
    last_message: string | null;
    last_message_time: string | null;
    last_inbound_message_time: string | null;
    unread_count: number | null;
    channel_type: 'player_chat';
    whatsapp_number: string | null;
  }>;
}

interface UsePlayerChatLeadsOptions {
  userId: string | null;
  workspaceId: string | null;
  defaultColumnId: string | null;
  pollIntervalMs?: number;
}

const DEFAULT_POLL_MS = 15000;

const chatToLead = (
  chat: PortalChat,
  index: number,
  defaultColumnId: string,
  userId: string
): PlayerChatLead => {
  const player = chat.portal_players;
  const displayName =
    player?.full_name ||
    player?.username ||
    (player?.whatsapp ? `+${player.whatsapp}` : null) ||
    'Jugador';
  const last = chat.last_message;
  const lastMessageText = last?.body ?? null;
  const lastMessageTime = chat.last_message_at ?? null;
  const lastInbound = last?.sender === 'player' ? chat.last_message_at ?? null : null;

  // Determinar la columna del lead:
  // 1) Si hay asignación en el cache (jugador movido por el usuario), usar esa
  // 2) Si no, asignar a defaultColumnId (la columna is_default)
  const assignedColumnId = playerChatCache.getAssignment(chat.id) ?? defaultColumnId;

  return {
    id: `virtual-${chat.id}`,
    name: displayName,
    phone: player?.whatsapp ?? null,
    email: null,
    company: null,
    notes: null,
    value: null,
    tags: null,
    column_id: assignedColumnId,
    position: index,
    user_id: userId,
    created_at: chat.last_message_at ?? new Date().toISOString(),
    updated_at: chat.last_message_at ?? new Date().toISOString(),
    last_inbound_message_time: lastInbound,
    bot_active: true,
    isVirtual: true,
    originalConversationId: chat.id,
    conversations: [
      {
        id: chat.id,
        phone_number: player?.whatsapp ?? null,
        pushname: null,
        contact_name: player?.full_name ?? player?.username ?? null,
        external_player: player,
        created_at: chat.last_message_at ?? new Date().toISOString(),
        last_message: lastMessageText,
        last_message_time: lastMessageTime,
        last_inbound_message_time: lastInbound,
        unread_count: chat.unread_operator ?? 0,
        channel_type: 'player_chat' as const,
        whatsapp_number: null
      }
    ]
  };
};

export const usePlayerChatLeads = ({
  userId,
  workspaceId,
  defaultColumnId,
  pollIntervalMs = DEFAULT_POLL_MS
}: UsePlayerChatLeadsOptions) => {
  const [leads, setLeads] = useState<PlayerChatLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const inFlightRef = useRef(false);

  // Inicializar columnas + assignments al montar
  useEffect(() => {
    if (!userId || !workspaceId) return;

    let cancelled = false;

    const init = async () => {
      try {
        // 1) Asegurar que existan las 4 columnas
        await ConversationService.listPlayerChatColumns(workspaceId, userId);
        if (cancelled) return;

        // 2) Cargar asignaciones existentes
        await ConversationService.listPlayerChatAssignments(userId);
      } catch (e) {
        console.error('[usePlayerChatLeads] init error:', e);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [userId, workspaceId]);

  // Render inicial + suscripción al cache (reactividad en vivo)
  useEffect(() => {
    if (!userId || !defaultColumnId) {
      setLoading(false);
      return;
    }

    // 1) Render inmediato desde cache (si existe)
    const cached = playerChatCache.getChats();
    if (cached) {
      const mapped = cached.map((c, i) => chatToLead(c, i, defaultColumnId, userId));
      setLeads(mapped);
      setLoading(false);
    }

    // 2) Suscripción reactiva al cache (re-render cuando cambian los datos)
    const unsubscribe = playerChatCache.subscribe(() => {
      const updated = playerChatCache.getChats();
      if (updated) {
        const mapped = updated.map((c, i) => chatToLead(c, i, defaultColumnId, userId));
        setLeads(mapped);
      }
    });

    return unsubscribe;
  }, [userId, defaultColumnId]);

  // Fetch inicial + polling
  const fetchChats = useCallback(
    async (force = false) => {
      if (!userId || !defaultColumnId || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        if (!playerChatCache.getChats()) {
          setLoading(true);
        }
        const chats = await ConversationService.listPlayerChats(force);
        playerChatCache.setChats(chats);
        const mapped = chats.map((c, i) => chatToLead(c, i, defaultColumnId, userId));
        setLeads(mapped);
      } catch (e) {
        console.error('[usePlayerChatLeads] fetchChats error:', e);
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [userId, defaultColumnId]
  );

  useEffect(() => {
    fetchChats(false);
    const i = setInterval(() => fetchChats(true), pollIntervalMs);
    return () => clearInterval(i);
  }, [fetchChats, pollIntervalMs]);

  // Handlers compatibles con useInfiniteLeads
  const getAllLeads = useCallback((): PlayerChatLead[] => leads, [leads]);

  const getLeadsForColumn = useCallback(
    (columnId: string): PlayerChatLead[] => leads.filter((l) => l.column_id === columnId),
    [leads]
  );

  const getColumnState = useCallback(
    (columnId: string) => {
      const filtered = getLeadsForColumn(columnId);
      return {
        hasMore: false,
        loading: false,
        totalCount: filtered.length,
        loadedCount: filtered.length
      };
    },
    [getLeadsForColumn]
  );

  const loadMore = useCallback(() => {
    // No hay paginación
  }, []);

  const refreshAll = useCallback(() => fetchChats(true), [fetchChats]);

  // Mover un lead a otra columna: persiste en BD, actualiza cache y re-render
  const moveLeadOptimistic = useCallback(
    async (leadId: string, _sourceColumnId: string, targetColumnId: string) => {
      if (!userId) return;
      setIsMoving(true);
      try {
        // Extraer el chatId del virtual leadId
        const chatId = leadId.startsWith('virtual-') ? leadId.replace('virtual-', '') : leadId;

        // Persistir en BD
        await ConversationService.assignPlayerChatToColumn(chatId, targetColumnId, userId);

        // Actualizar cache (también lo hace el servicio, pero aquí es explícito)
        playerChatCache.setAssignment(chatId, targetColumnId);

        // Re-render local
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, column_id: targetColumnId } : l))
        );
      } catch (e) {
        console.error('[usePlayerChatLeads] moveLeadOptimistic error:', e);
      } finally {
        setIsMoving(false);
      }
    },
    [userId]
  );

  return {
    getAllLeads,
    getLeadsForColumn,
    getColumnState,
    loadMore,
    refreshAll,
    initialLoading: loading,
    moveLeadOptimistic,
    isMoving: () => isMoving
  };
};

export default usePlayerChatLeads;
