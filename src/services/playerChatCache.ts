// playerChatCache.ts
// Cache in-memory con TTL para los chats de jugadores.
// La fuente de verdad es SIEMPRE la API externa (Player Portal).
// El cache solo se usa para acelerar el render y evitar requests repetidos.
//
// Características:
//   - TTL configurable (default 5 segundos para chats, 2 segundos para mensajes)
//   - Invalidación selectiva (forzar refresh de un chat específico)
//   - Suscripción a cambios para que los componentes se actualicen reactively
//   - Limpieza automática de entradas expiradas
//   - Sin persistencia: el cache vive solo en memoria (se pierde al recargar)

export interface PortalPlayer {
  username?: string;
  full_name?: string;
  whatsapp?: string;
}

export interface PortalLastMessage {
  sender: 'player' | 'operator';
  body: string;
  created_at: string;
}

export interface PortalChat {
  id: string;
  unread_operator: number;
  last_message_at: string | null;
  portal_players?: PortalPlayer;
  last_message?: PortalLastMessage | null;
}

export interface PortalMessage {
  id: string;
  sender: 'player' | 'operator';
  body: string;
  created_at: string;
  message_type?: 'text' | 'image' | 'sticker' | 'file';
  file_url?: string;
  file_name?: string;
}

export interface PlayerChatColumn {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

type Listener = () => void;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_CHATS_TTL_MS = 5_000;
const DEFAULT_MESSAGES_TTL_MS = 2_000;

class PlayerChatCache {
  private chats: CacheEntry<PortalChat[]> | null = null;
  private messages = new Map<string, CacheEntry<PortalMessage[]>>();
  private chatsInFlight: Promise<PortalChat[]> | null = null;
  private messagesInFlight = new Map<string, Promise<PortalMessage[]>>();
  private listeners = new Set<Listener>();
  // Columnas de player_chat (en memoria, TTL 30s, suficiente para la sesión)
  private columns: CacheEntry<PlayerChatColumn[]> | null = null;
  // Asignaciones chat → columna (en memoria, simple Map<string, string>)
  // player_chat_id → column_id
  private assignments: Map<string, string> = new Map();
  // IDs de mensajes optimistas del operador pendientes de reconciliación con el portal
  private pendingOperatorIds: Map<string, Set<string>> = new Map();

  // --- Suscripción ---
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('[playerChatCache] listener error:', e);
      }
    });
  }

  // --- Helpers de igualdad barata ---
  private chatsSignature(data: PortalChat[]): string {
    if (!data.length) return '0|';
    const last = data[data.length - 1];
    return `${data.length}|${last?.id}|${last?.last_message_at ?? ''}|${last?.unread_operator ?? 0}`;
  }

  private messagesSignature(data: PortalMessage[]): string {
    if (!data.length) return '0|';
    const first = data[0];
    const last = data[data.length - 1];
    return `${data.length}|${first?.id}|${first?.created_at ?? ''}|${last?.id}|${last?.created_at ?? ''}`;
  }

  // --- Chats ---
  getChats(): PortalChat[] | null {
    if (!this.chats) return null;
    if (Date.now() > this.chats.expiresAt) {
      this.chats = null;
      return null;
    }
    return this.chats.data;
  }

  setChats(data: PortalChat[], ttlMs: number = DEFAULT_CHATS_TTL_MS): void {
    const prevSig = this.chats ? this.chatsSignature(this.chats.data) : null;
    const nextSig = this.chatsSignature(data);
    this.chats = { data, expiresAt: Date.now() + ttlMs };
    if (prevSig !== nextSig) this.notify();
  }

  invalidateChats(): void {
    const had = this.chats !== null;
    this.chats = null;
    if (had) this.notify();
  }

  getChatsInFlight(): Promise<PortalChat[]> | null {
    return this.chatsInFlight;
  }

  setChatsInFlight(promise: Promise<PortalChat[]> | null): void {
    this.chatsInFlight = promise;
  }

  // --- Mensajes ---
  getMessages(chatId: string): PortalMessage[] | null {
    const entry = this.messages.get(chatId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.messages.delete(chatId);
      return null;
    }
    return entry.data;
  }

  setMessages(chatId: string, data: PortalMessage[], ttlMs: number = DEFAULT_MESSAGES_TTL_MS): void {
    const prev = this.messages.get(chatId)?.data;
    const prevSig = prev ? this.messagesSignature(prev) : null;
    const nextSig = this.messagesSignature(data);
    this.messages.set(chatId, { data, expiresAt: Date.now() + ttlMs });
    if (prevSig !== nextSig) this.notify();
  }

  invalidateMessages(chatId: string): void {
    const had = this.messages.has(chatId);
    this.messages.delete(chatId);
    if (had) this.notify();
  }

  invalidateAll(): void {
    this.chats = null;
    this.messages.clear();
    this.notify();
  }

  getMessagesInFlight(chatId: string): Promise<PortalMessage[]> | undefined {
    return this.messagesInFlight.get(chatId);
  }

  setMessagesInFlight(chatId: string, promise: Promise<PortalMessage[]> | undefined): void {
    if (promise) {
      this.messagesInFlight.set(chatId, promise);
    } else {
      this.messagesInFlight.delete(chatId);
    }
  }

  // --- Append optimístico (después de enviar un mensaje) ---
  appendMessage(chatId: string, message: PortalMessage): void {
    const existing = this.getMessages(chatId);
    const base = existing ?? [];
    if (base.some((m) => m.id === message.id)) return;
    this.setMessages(chatId, [...base, message]);
    // Registrar como pendiente si es optimístico del operador
    if (message.sender === 'operator' && message.id.startsWith('local-')) {
      let set = this.pendingOperatorIds.get(chatId);
      if (!set) {
        set = new Set();
        this.pendingOperatorIds.set(chatId, set);
      }
      set.add(message.id);
    }
  }

  /**
   * Reconcilia mensajes frescos del portal con los optimistas locales.
   * Conserva los `local-*` de operador que aún no aparezcan en `fresh`
   * (matching por body + tolerancia temporal) y elimina los ya persistidos.
   */
  reconcileMessages(chatId: string, freshInput: PortalMessage[]): PortalMessage[] {
    // 1) Normalizar: ordenar por fecha asc, deduplicar por id, y si el portal
    //    devuelve más de 200, quedarnos con los 200 MÁS RECIENTES.
    const dedup = new Map<string, PortalMessage>();
    for (const m of freshInput) dedup.set(m.id, m);
    let fresh = Array.from(dedup.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (fresh.length > 200) fresh = fresh.slice(fresh.length - 200);

    const pendingSet = this.pendingOperatorIds.get(chatId);
    const existing = this.messages.get(chatId)?.data ?? [];

    // 2) Preservar mensajes locales que son MÁS NUEVOS que el último `fresh`
    //    (el portal aún no los indexó). Se mantienen hasta que aparezcan.
    const lastFreshTs = fresh.length ? new Date(fresh[fresh.length - 1].created_at).getTime() : 0;
    const freshIds = new Set(fresh.map((m) => m.id));
    const postTail = existing.filter(
      (m) => !freshIds.has(m.id) && new Date(m.created_at).getTime() > lastFreshTs
    );

    // 3) Reconciliar optimistas del operador (`local-*`)
    const stillPending: PortalMessage[] = [];
    if (pendingSet && pendingSet.size > 0) {
      const TOLERANCE_MS = 90_000;
      const pendingMsgs = existing.filter((m) => pendingSet.has(m.id));
      for (const opt of pendingMsgs) {
        const optTime = new Date(opt.created_at).getTime();
        const matched = fresh.some(
          (f) =>
            f.sender === 'operator' &&
            f.body === opt.body &&
            Math.abs(new Date(f.created_at).getTime() - optTime) < TOLERANCE_MS
        );
        if (matched) pendingSet.delete(opt.id);
        else if (!postTail.some((p) => p.id === opt.id)) stillPending.push(opt);
      }
      if (pendingSet.size === 0) this.pendingOperatorIds.delete(chatId);
    }

    const merged = [...fresh, ...postTail, ...stillPending].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    this.setMessages(chatId, merged);
    return merged;
  }

  // --- Columnas de player_chat ---
  getColumns(): PlayerChatColumn[] | null {
    if (!this.columns) return null;
    if (Date.now() > this.columns.expiresAt) {
      this.columns = null;
      return null;
    }
    return this.columns.data;
  }

  setColumns(data: PlayerChatColumn[], ttlMs: number = 30_000): void {
    this.columns = { data, expiresAt: Date.now() + ttlMs };
    this.notify();
  }

  invalidateColumns(): void {
    this.columns = null;
    this.notify();
  }

  getColumnById(columnId: string): PlayerChatColumn | null {
    return this.getColumns()?.find((c) => c.id === columnId) ?? null;
  }

  getDefaultColumn(): PlayerChatColumn | null {
    return this.getColumns()?.find((c) => c.is_default) ?? null;
  }

  // --- Asignaciones chat → columna (en memoria) ---
  getAllAssignments(): Record<string, string> {
    return Object.fromEntries(this.assignments);
  }

  getAssignment(playerChatId: string): string | null {
    return this.assignments.get(playerChatId) ?? null;
  }

  setAssignment(playerChatId: string, columnId: string): void {
    this.assignments.set(playerChatId, columnId);
    this.notify();
  }

  setAssignmentsBulk(assignments: Record<string, string>): void {
    this.assignments.clear();
    Object.entries(assignments).forEach(([k, v]) => this.assignments.set(k, v));
    this.notify();
  }

  // Inicializa el mapa de asignaciones con la columna default para todos los chatIds dados
  // (útil para sincronización inicial cuando una conversación aparece por primera vez)
  initializeDefaultAssignments(chatIds: string[], defaultColumnId: string): void {
    chatIds.forEach((id) => {
      if (!this.assignments.has(id)) {
        this.assignments.set(id, defaultColumnId);
      }
    });
  }

  clearAllAssignments(): void {
    this.assignments.clear();
    this.notify();
  }

  // Invalida todo lo relacionado con un workspace específico
  // (útil al cambiar de workspace)
  invalidateWorkspaceData(): void {
    this.columns = null;
    this.assignments.clear();
    this.notify();
  }
}

export const playerChatCache = new PlayerChatCache();

export default playerChatCache;
