import React, { useEffect, useState, useRef } from 'react';
import { X, Send, Loader2, Image as ImageIcon, Phone, Gamepad2, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ConversationService } from '@/services/conversationService';
import { STICKER_ACCEPT } from '@/services/stickerService';
import { playerChatCache, PortalChat, PortalMessage } from '@/services/playerChatCache';
import PlayerChatList from '@/components/conversations/PlayerChatList';
import { ContactInfoPanel } from '@/components/conversations/ContactInfoPanel';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import PlayerMessageRichContent from '@/components/player-chat/PlayerMessageRichContent';

interface ChatModalPlayerChatProps {
  isOpen: boolean;
  onClose: () => void;
  playerChatId: string | null;
  initialChat?: PortalChat | null;
}

const Bubble: React.FC<{ m: PortalMessage }> = React.memo(({ m }) => {
  const isOutbound = m.sender !== 'player';
  const isSticker = m.message_type === 'sticker';
  const isImage = m.message_type === 'image';
  const fileUrl = m.file_url;
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[70%] p-2 overflow-hidden ${
          isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {(isSticker || (isImage && fileUrl)) && (
          <img
            src={fileUrl ?? ''}
            alt={isSticker ? 'sticker' : 'imagen'}
            className={`rounded-md ${isSticker ? 'w-32 h-32 object-contain' : 'max-w-full max-h-60 object-contain'}`}
            loading="lazy"
          />
        )}
        {m.body && !(isSticker && m.body === '🎨 Sticker') && (
          <PlayerMessageRichContent text={m.body} />
        )}
        <div className="text-[10px] mt-1 opacity-70 px-1">
          {new Date(m.created_at).toLocaleString()}
        </div>
      </Card>
    </div>
  );
});
Bubble.displayName = 'Bubble';

const ChatModalPlayerChat: React.FC<ChatModalPlayerChatProps> = ({
  isOpen,
  onClose,
  playerChatId,
  initialChat
}) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const stickerInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);

  const [chat, setChat] = useState<PortalChat | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingSticker, setSendingSticker] = useState(false);
  const [draft, setDraft] = useState('');

  // Cargar el chat: initialChat (prop) → cache
  useEffect(() => {
    if (!isOpen || !playerChatId) return;

    if (initialChat && initialChat.id === playerChatId) {
      setChat(initialChat);
    } else {
      const cachedChats = playerChatCache.getChats() ?? [];
      const found = cachedChats.find((c) => c.id === playerChatId);
      if (found) setChat(found);
    }

    const unsubscribe = playerChatCache.subscribe(() => {
      const updated = playerChatCache.getChats() ?? [];
      const found2 = updated.find((c) => c.id === playerChatId);
      if (found2) setChat(found2);
      const msgs = playerChatCache.getMessages(playerChatId);
      // Solo actualizamos si hay datos; evita borrar mensajes al invalidar cache
      if (msgs && msgs.length > 0) setMessages(msgs);
    });

    return unsubscribe;
  }, [isOpen, playerChatId, initialChat]);

  // Cargar mensajes cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !playerChatId) return;

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const msgs = await ConversationService.getPlayerChatMessages(playerChatId);
        setMessages(msgs);
      } catch (e: any) {
        console.error('Error loading player chat messages:', e);
        toast({
          title: 'Error',
          description: e?.message ?? 'No se pudieron cargar los mensajes',
          variant: 'destructive'
        });
      } finally {
        setLoadingMessages(false);
      }
    };

    const cached = playerChatCache.getMessages(playerChatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
    } else {
      fetchMessages();
    }
  }, [isOpen, playerChatId, toast]);

  // Polling de mensajes cada 15s
  useEffect(() => {
    if (!isOpen || !playerChatId) return;
    const i = setInterval(async () => {
      try {
        await ConversationService.refreshPlayerChatMessages(playerChatId);
        const updated = playerChatCache.getMessages(playerChatId);
        if (updated) setMessages(updated);
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 15000);
    return () => clearInterval(i);
  }, [isOpen, playerChatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!playerChatId || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      await ConversationService.sendPlayerChatMessage(playerChatId, text);
      // Pintar el optimístico ya presente en el cache al instante.
      // El poll de 5s reconciliará con el portal preservando el optimístico
      // hasta que el portal devuelva el mensaje real.
      const updated = playerChatCache.getMessages(playerChatId);
      if (updated) setMessages(updated);
    } catch (e: any) {
      setDraft(text);
      toast({
        title: 'Error al enviar',
        description: e?.message ?? 'Error desconocido',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const handleSticker = async (file: File) => {
    if (!playerChatId || !effectiveUserId) return;
    setSendingSticker(true);
    try {
      await ConversationService.sendPlayerChatSticker(playerChatId, file, effectiveUserId);
      const updated = playerChatCache.getMessages(playerChatId);
      if (updated) setMessages(updated);
    } catch (e: any) {
      toast({
        title: 'Error al enviar sticker',
        description: e?.message ?? 'Error desconocido',
        variant: 'destructive'
      });
    } finally {
      setSendingSticker(false);
      if (stickerInputRef.current) stickerInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const player = chat?.portal_players;
  const displayName = player?.full_name || player?.username || 'Jugador';
  const lastActivity = chat?.last_message_at
    ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true, locale: es })
    : null;

  // Panel de chat (compartido entre mobile y desktop)
  const chatPanel = (
    <div className="flex-1 flex flex-col bg-[#0d1418] min-w-0 text-white">
      {/* Header del chat */}
      <div className="flex items-center gap-2 p-3 border-b border-[#2a3942] flex-shrink-0">
        {isMobile && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSelectedChatId(null)}
            className="text-white hover:bg-[#2a3942]"
            title="Volver a la lista"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate text-sm md:text-base">{displayName}</div>
          {lastActivity && (
            <div className="text-[11px] text-gray-400 truncate">Última actividad: {lastActivity}</div>
          )}
        </div>
        {isMobile && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowInfoSheet(true)}
            className="text-white hover:bg-[#2a3942]"
            title="Ver información"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-[#2a3942]"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Info rápida del jugador (header secundario en desktop) */}
      {!isMobile && player?.whatsapp && (
        <div className="px-3 py-2 border-b border-[#2a3942] bg-[#182229] text-xs flex flex-wrap gap-3">
          <span className="flex items-center gap-1 text-gray-300">
            <Phone className="h-3 w-3" /> {player.whatsapp}
          </span>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loadingMessages && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <div>No hay mensajes aún</div>
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2a3942] bg-[#182229]">
        <input
          ref={stickerInputRef}
          type="file"
          accept={STICKER_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleSticker(f);
          }}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => stickerInputRef.current?.click()}
            disabled={sendingSticker}
            title="Enviar sticker"
            className="bg-[#2a3942] border-[#2a3942] text-white hover:bg-[#324654]"
          >
            {sendingSticker ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          </Button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escribe tu respuesta..."
            disabled={sending}
            className="flex-1 bg-[#2a3942] border-[#2a3942] text-white placeholder:text-gray-400"
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()} className="bg-primary">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  // Helper: setter para selectedChatId (para drill-down mobile)
  const setSelectedChatId = (id: string | null) => {
    if (id) {
      // Al seleccionar, cargar el chat
      const cachedChats = playerChatCache.getChats() ?? [];
      const found = cachedChats.find((c) => c.id === id);
      if (found) setChat(found);
      // Cargar mensajes
      const cached = playerChatCache.getMessages(id);
      if (cached) setMessages(cached);
      else {
        ConversationService.getPlayerChatMessages(id)
          .then(setMessages)
          .catch(() => undefined);
      }
    } else {
      setChat(null);
      setMessages([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-card rounded-none sm:rounded-lg w-full max-w-7xl h-[100dvh] sm:h-[90vh] flex overflow-hidden text-foreground">
        {isMobile ? (
          // Mobile: drill-down (lista → chat → Sheet info)
          <>
            {chat ? (
              chatPanel
            ) : (
              <PlayerChatList
                selectedId={chat?.id ?? null}
                onSelect={(id) => {
                  setSelectedChatId(id);
                }}
              />
            )}
            <Sheet open={showInfoSheet} onOpenChange={setShowInfoSheet}>
              <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Información del jugador</SheetTitle>
                </SheetHeader>
                <ContactInfoPanel
                  contactName={chat?.portal_players?.full_name || chat?.portal_players?.username || 'Jugador'}
                  phoneNumber={chat?.portal_players?.username || chat?.portal_players?.whatsapp || ''}
                  whatsappNumber={chat?.portal_players?.whatsapp || null}
                  hideFunnel={true}
                />
              </SheetContent>
            </Sheet>
          </>
        ) : (
          // Desktop: 3 columnas (sidebar | chat | info)
          <>
            {/* Sidebar (lista de chats) */}
            <div className="w-80 xl:w-96 flex-shrink-0 border-r border-border">
              <PlayerChatList
                selectedId={chat?.id ?? null}
                onSelect={(id) => {
                  setSelectedChatId(id);
                }}
              />
            </div>
            {/* Panel de chat (centro) */}
            {chat ? (
              chatPanel
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-center p-4 bg-[#0d1418] text-gray-400">
                <div>
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div>Selecciona un chat para ver los mensajes</div>
                </div>
              </div>
            )}
            {/* Panel de info (derecha) - ContactInfoPanel completo con darkMode */}
            {chat && (
              <div className="w-80 xl:w-96 flex-shrink-0 border-l border-[#2a3942] bg-[#0d1418]">
                <ContactInfoPanel
                  contactName={chat?.portal_players?.full_name || chat?.portal_players?.username || 'Jugador'}
                  phoneNumber={chat?.portal_players?.username || chat?.portal_players?.whatsapp || ''}
                  whatsappNumber={chat?.portal_players?.whatsapp || null}
                  hideFunnel={true}
                  darkMode={true}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatModalPlayerChat;
