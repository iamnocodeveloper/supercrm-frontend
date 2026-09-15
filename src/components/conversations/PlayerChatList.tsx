// PlayerChatList.tsx
// Sidebar de chats de jugadores. Usa ChatSidebar (shell genérico) + ChatListItem.
// Lee los chats del playerChatCache (que se llena desde la API externa del Player Portal).
// Replica visualmente la sidebar de Twilio/WhatsApp.

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ChatSidebar } from './ChatSidebar';
import ChatListItem, { ChatListItemData } from './ChatListItem';
import { playerChatCache, PortalChat } from '@/services/playerChatCache';
import { ConversationService } from '@/services/conversationService';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export interface PlayerChatListProps {
  selectedId: string | null;
  onSelect: (chatId: string) => void;
  /** Si está cargando (controlado externamente) */
  isLoading?: boolean;
}

const normalize = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const portalChatToItem = (chat: PortalChat): ChatListItemData => {
  const player = chat.portal_players;
  const displayName =
    player?.full_name || player?.username || (player?.whatsapp ? `+${player.whatsapp}` : 'Jugador');
  const initials = displayName
    .split(' ')
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'JD';
  const subName = player?.username ? `@${player.username}` : player?.whatsapp || undefined;
  const last = chat.last_message;

  return {
    id: chat.id,
    displayName,
    subName,
    initials,
    channelType: 'player_chat',
    lastMessage: last?.body ?? null,
    lastMessageSender: (last?.sender as 'outbound' | 'inbound') ?? null,
    lastMessageTime: chat.last_message_at ?? null,
    unreadCount: chat.unread_operator ?? 0,
    tags: []
  };
};

const PlayerChatList: React.FC<PlayerChatListProps> = ({ selectedId, onSelect, isLoading: externalLoading }) => {
  const { effectiveUserId } = useEffectiveUserId();
  const [chats, setChats] = useState<PortalChat[]>(() => playerChatCache.getChats() ?? []);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const inFlightRef = React.useRef(false);

  // Carga inicial + suscripción al cache
  useEffect(() => {
    const update = () => {
      const updated = playerChatCache.getChats() ?? [];
      setChats(updated);
    };
    update();
    const unsubscribe = playerChatCache.subscribe(update);
    return unsubscribe;
  }, []);

  // Polling cada 5s para refrescar desde la API externa
  const fetchChats = useCallback(
    async (force = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setInternalLoading(true);
      try {
        await ConversationService.refreshPlayerChats();
      } catch (e: any) {
        if (force) {
          toast({
            title: 'Error al sincronizar',
            description: e?.message ?? 'Error desconocido',
            variant: 'destructive'
          });
        }
      } finally {
        setInternalLoading(false);
        inFlightRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    fetchChats(false);
    const i = setInterval(() => fetchChats(true), 15000);
    return () => clearInterval(i);
  }, [fetchChats]);

  // Filtrado
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return chats;
    const term = normalize(searchTerm);
    return chats.filter((c) => {
      const player = c.portal_players;
      const last = c.last_message;
      return (
        normalize(player?.full_name).includes(term) ||
        normalize(player?.username).includes(term) ||
        normalize(player?.whatsapp).includes(term) ||
        normalize(last?.body).includes(term)
      );
    });
  }, [chats, searchTerm]);

  // Mapear a ChatListItemData
  const items = useMemo(() => filtered.map(portalChatToItem), [filtered]);

  // Total de no leídos
  const totalUnread = useMemo(
    () => chats.reduce((sum, c) => sum + (c.unread_operator ?? 0), 0),
    [chats]
  );

  return (
    <ChatSidebar
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      title="Chats"
      totalUnread={totalUnread}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      isLoading={externalLoading ?? internalLoading}
      emptyText={
        chats.length === 0
          ? 'No hay chats. Pulsa Sincronizar para traerlos del Player Portal.'
          : 'Sin resultados'
      }
      
      headerActions={
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchChats(true)}
            disabled={internalLoading}
            className="flex-1"
          >
            {internalLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Sincronizar
          </Button>
        </div>
      }
    />
  );
};

export default PlayerChatList;
