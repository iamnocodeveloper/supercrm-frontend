import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Gamepad2,
  Send,
  Loader2,
  Image as ImageIcon,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationService } from '@/services/conversationService';
import { STICKER_ACCEPT } from '@/services/stickerService';
import { playerChatCache, PortalMessage } from '@/services/playerChatCache';
import PlayerChatList from '@/components/conversations/PlayerChatList';
import { ContactInfoPanel } from '@/components/conversations/ContactInfoPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PlayerMessageRichContent from '@/components/player-chat/PlayerMessageRichContent';

const POLL_MS = 5000;
const LS_SELECTED_WORKSPACE = 'player_chat_selected_workspace_id';

const normalize = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

// Componente de mensaje
const Bubble: React.FC<{ m: PortalMessage }> = React.memo(({ m }) => {
  const isOutbound = m.sender === 'operator';
  const isSticker = m.message_type === 'sticker';
  const isImage = m.message_type === 'image';
  const fileUrl = m.file_url;
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[75%] p-2 overflow-hidden ${
          isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        {(isSticker || (isImage && fileUrl)) && (
          <img
            src={fileUrl ?? ''}
            alt={isSticker ? 'sticker' : 'imagen'}
            className={`rounded-md ${isSticker ? 'w-40 h-40 object-contain' : 'max-w-full max-h-72 object-contain'}`}
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

const PlayerChats: React.FC = () => {
  const { user: _user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const stickerInputRef = useRef<HTMLInputElement | null>(null);

  // Workspaces (placeholder para mantener la UI anterior)
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_SELECTED_WORKSPACE) || 'default';
    } catch {
      return 'default';
    }
  });

  const setSelectedWorkspace = useCallback((id: string | null) => {
    setSelectedWorkspaceState(id);
    setSelectedChatId(null);
    setMessages([]);
    try {
      if (id) localStorage.setItem(LS_SELECTED_WORKSPACE, id);
      else localStorage.removeItem(LS_SELECTED_WORKSPACE);
    } catch {
      /* ignore */
    }
  }, []);

  // Chat seleccionado
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingSticker, setSendingSticker] = useState(false);
  const [draft, setDraft] = useState('');
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cargar workspaces placeholder (se ejecuta solo una vez al montar)
  useEffect(() => {
    setWorkspaces([{ id: 'default', name: 'Chat Jugadores', channel_type: 'player_chat' }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat actualmente seleccionado (de cache o subscription)
  const [selectedChat, setSelectedChat] = useState<any>(null);

  // Suscripción al cache para mantener `selectedChat` actualizado
  useEffect(() => {
    if (!selectedChatId) {
      setSelectedChat(null);
      return;
    }
    const update = () => {
      const chats = playerChatCache.getChats() ?? [];
      setSelectedChat(chats.find((c) => c.id === selectedChatId) ?? null);
    };
    update();
    const unsubscribe = playerChatCache.subscribe(update);
    return unsubscribe;
  }, [selectedChatId]);

  // Cargar mensajes del chat seleccionado
  const fetchMessages = useCallback(
    async (chatId: string, silent = false) => {
      try {
        if (!silent) setLoadingMsgs(true);
        const msgs = await ConversationService.getPlayerChatMessages(chatId);
        setMessages((prev) => {
          if (
            prev.length === msgs.length &&
            prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id &&
            prev[prev.length - 1]?.created_at === msgs[msgs.length - 1]?.created_at
          ) {
            return prev; // idéntico → no re-render
          }
          return msgs;
        });
      } catch (e: any) {
        if (!silent) {
          toast({ title: 'Error al cargar mensajes', description: e?.message, variant: 'destructive' });
        }
      } finally {
        if (!silent) setLoadingMsgs(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedChatId) {
      const cached = playerChatCache.getMessages(selectedChatId);
      if (cached && cached.length > 0) {
        setMessages(cached);
        fetchMessages(selectedChatId, true);
      } else {
        fetchMessages(selectedChatId);
      }
      const i = setInterval(() => fetchMessages(selectedChatId, true), POLL_MS);
      return () => clearInterval(i);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-seleccionar chat desde state (navegación desde Kanban)
  useEffect(() => {
    const state = location.state as { chatId?: string; conversationId?: string } | null;
    if (!state) return;
    const targetId = state.chatId ?? state.conversationId;
    if (targetId) {
      setSelectedChatId(targetId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Handlers de envío
  const handleSend = async () => {
    if (!selectedChatId || !effectiveUserId || !draft.trim()) return;
    setSending(true);
    try {
      await ConversationService.sendPlayerChatMessage(selectedChatId, draft.trim());
      setDraft('');
      setTimeout(() => fetchMessages(selectedChatId, true), 300);
    } catch (e: any) {
      toast({ title: 'Error al enviar', description: e?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStickerFile = async (file: File) => {
    if (!selectedChatId || !effectiveUserId) return;
    setSendingSticker(true);
    try {
      await ConversationService.sendPlayerChatSticker(selectedChatId, file, effectiveUserId);
      setTimeout(() => fetchMessages(selectedChatId, true), 300);
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

  // Sin embudo seleccionado
  if (!selectedWorkspace) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] -m-3 md:-m-6 items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <Gamepad2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
          <h2 className="text-xl font-semibold mb-2">Sin embudo seleccionado</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Crea o selecciona un embudo de "Chat Jugadores" en la sección de Embudos.
          </p>
          <Button onClick={() => navigate('/leads')}>Ir a Embudos</Button>
        </div>
      </div>
    );
  }

  // Panel de chat: reutilizable entre desktop y mobile
  const chatPanel = (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      {selectedChatId ? (
        <>
          {/* Header del chat */}
          <div className="p-3 md:p-4 border-b border-border bg-card flex items-center gap-2">
            {isMobile && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedChatId(null)}
                title="Volver a la lista"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {!isMobile && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowInfoPanel((v) => !v)}
                title={showInfoPanel ? 'Ocultar info' : 'Mostrar info'}
                className="hidden md:flex"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-sm md:text-base">
                {selectedChat?.portal_players?.full_name ||
                  selectedChat?.portal_players?.username ||
                  'Jugador'}
              </div>
              {selectedChat?.portal_players?.whatsapp && (
                <div className="text-xs text-muted-foreground truncate">
                  {selectedChat.portal_players.whatsapp}
                </div>
              )}
            </div>
            {isMobile && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowInfoSheet(true)}
                title="Ver información"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Button>
            )}
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
            {loadingMsgs && messages.length === 0 ? (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} m={m} />)
            )}
          </div>

          {/* Input */}
          <div className="p-3 md:p-4 border-t border-border bg-card">
            <input
              ref={stickerInputRef}
              type="file"
              accept={STICKER_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleStickerFile(f);
              }}
            />
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                type="button"
                disabled={sendingSticker}
                onClick={() => stickerInputRef.current?.click()}
                title="Enviar sticker"
              >
                {sendingSticker ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
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
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-center p-4">
          <div>
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <div>Selecciona un chat para ver los mensajes</div>
          </div>
        </div>
      )}
    </div>
  );

  // Render mobile: drill-down (lista → chat → Sheet info)
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-3 md:-m-6">
        {selectedChatId ? (
          chatPanel
        ) : (
          <PlayerChatList selectedId={selectedChatId} onSelect={setSelectedChatId} />
        )}
        <Sheet open={showInfoSheet} onOpenChange={setShowInfoSheet}>
          <SheetContent side="right" className="w-[92vw] sm:w-[420px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Información del jugador</SheetTitle>
            </SheetHeader>
            <ContactInfoPanel
              contactName={selectedChat?.portal_players?.full_name || selectedChat?.portal_players?.username || 'Jugador'}
              phoneNumber={selectedChat?.portal_players?.username || selectedChat?.portal_players?.whatsapp || ''}
              whatsappNumber={selectedChat?.portal_players?.whatsapp || null}
              hideFunnel={true}
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Render desktop: 3 columnas (sidebar | chat | info)
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-3 md:-m-6">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (lista de chats) */}
        <div className="w-80 md:w-96 flex-shrink-0">
          <PlayerChatList selectedId={selectedChatId} onSelect={setSelectedChatId} />
        </div>

        {/* Panel de chat (centro) */}
        {chatPanel}

        {/* Panel de info (derecha) - ContactInfoPanel completo con casino, etiquetas, agente */}
        {showInfoPanel && !isMobile && (
          <div className="w-80 xl:w-96 flex-shrink-0">
            <ContactInfoPanel
              contactName={selectedChat?.portal_players?.full_name || selectedChat?.portal_players?.username || 'Jugador'}
              phoneNumber={selectedChat?.portal_players?.username || selectedChat?.portal_players?.whatsapp || ''}
              whatsappNumber={selectedChat?.portal_players?.whatsapp || null}
              hideFunnel={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerChats;
