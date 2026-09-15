// ChatSidebar.tsx
// Shell genérico para la sidebar de lista de chats.
// Replica la UI/UX de ConversationList de Twilio/WhatsApp pero desacoplado
// de la fuente de datos (acepta un array de ChatListItemData).

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import ChatListItem, { ChatListItemData } from './ChatListItem';

export interface ChatSidebarProps {
  items: ChatListItemData[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Título del sidebar (default: 'Chats') */
  title?: string;
  /** Total de no leídos para mostrar en el badge del header */
  totalUnread?: number;
  /** Término de búsqueda controlado (el padre maneja el estado) */
  searchTerm?: string;
  onSearchChange?: (v: string) => void;
  /** Si está cargando (muestra spinner) */
  isLoading?: boolean;
  /** Texto a mostrar cuando no hay items */
  emptyText?: string;
  /** Slot para filtros o botones extra en el header (debajo de la búsqueda) */
  headerActions?: React.ReactNode;
  /** Altura de cada item (default: 89) */
  itemHeight?: number;
  /** Función custom de formatTime (opcional) */
  formatTime?: (dateString: string) => string;
}

const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Formatea una fecha de manera simple sin dependencias externas de locale.
 * Devuelve HH:MM si es hoy, día de la semana (es) si es esta semana, dd/MM si es más antiguo.
 */
const defaultFormatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7 && daysDiff >= 0) {
      return WEEKDAYS_ES[date.getDay()] ?? '';
    }
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${MM}`;
  } catch {
    return '';
  }
};

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  items,
  selectedId,
  onSelect,
  title = 'Chats',
  totalUnread = 0,
  searchTerm = '',
  onSearchChange,
  isLoading = false,
  emptyText = 'No hay chats',
  headerActions,
  itemHeight = 89,
  formatTime = defaultFormatTime
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(720);

  // Observar el tamaño del contenedor para virtualización responsive
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setContainerHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Cálculos de virtualización
  const overscan = 6;
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header con título y badge de no leídos */}
      <div className="p-4 border-b border-border flex items-center gap-2 flex-shrink-0">
        <h2 className="text-base font-semibold flex items-center gap-2">
          {title}
          {totalUnread > 0 && (
            <Badge variant="default" className="ml-1">
              {totalUnread}
            </Badge>
          )}
        </h2>
      </div>

      {/* Búsqueda */}
      {onSearchChange && (
        <div className="p-2 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {/* Acciones de header (filtros, etc.) */}
      {headerActions && (
        <div className="border-b border-border flex-shrink-0">{headerActions}</div>
      )}

      {/* Lista virtualizada */}
      {isLoading && items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
          {emptyText}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleItems.map((item) => (
                <ChatListItem
                  key={item.id}
                  data={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => onSelect(item.id)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
