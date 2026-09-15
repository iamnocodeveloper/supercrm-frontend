// ChatListItem.tsx
// Item genérico reutilizable para cualquier sidebar de lista de chats.
// Replica exactamente el diseño visual de ConversationItem (Twilio/WhatsApp).
// Acepta un shape normalizado (ChatListItemData) para desacoplar de la fuente de datos.

import React, { memo, useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Gamepad2 } from 'lucide-react';

export type ChannelType = 'whatsapp' | 'telegram' | 'twilio' | 'player_chat' | 'webchat';

export interface ChatListItemTag {
  name: string;
  color: string;
}

export interface ChatListItemData {
  id: string;
  displayName: string;        // Nombre principal a mostrar
  subName?: string;            // Sub-nombre opcional (@username, número, etc.)
  initials: string;            // Letras del avatar (1-2 chars)
  channelType?: ChannelType;   // Para el ícono del canal
  lastMessage?: string | null;
  lastMessageSender?: 'outbound' | 'inbound' | 'operator' | 'player' | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
  tags?: ChatListItemTag[];
  /** Texto a mostrar si no hay lastMessage (default: 'Sin mensajes') */
  noMessagesText?: string;
}

export interface ChatListItemProps {
  data: ChatListItemData;
  isSelected: boolean;
  onSelect: () => void;
  formatTime: (dateString: string) => string;
  /** Mostrar subName debajo del displayName (true por defecto) */
  showSubName?: boolean;
}

const channelIconRender = (channelType?: ChannelType) => {
  switch (channelType) {
    case 'whatsapp':
      return <Phone className="h-3 w-3 text-green-500" />;
    case 'telegram':
      return <MessageCircle className="h-3 w-3 text-telegram-blue" />;
    case 'twilio':
      return <MessageCircle className="h-3 w-3 text-[hsl(var(--twilio-red))]" />;
    case 'player_chat':
      return <Gamepad2 className="h-3 w-3 text-orange-500" />;
    default:
      return null;
  }
};

const ChatListItem: React.FC<ChatListItemProps> = memo(
  ({ data, isSelected, onSelect, formatTime, showSubName = true }) => {
    const hasUnread = (data.unreadCount ?? 0) > 0;
    const channelIcon = useMemo(() => channelIconRender(data.channelType), [data.channelType]);
    const tags = data.tags ?? [];
    const noMessagesText = data.noMessagesText ?? 'Sin mensajes';

    return (
      <div
        onClick={onSelect}
        className={cn(
          "h-[89px] p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted border-l-4 border-l-transparent",
          hasUnread && "bg-primary/10 border-l-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]",
          isSelected && "bg-muted"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-11 w-11 md:h-12 md:w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {data.initials}
              </AvatarFallback>
            </Avatar>
            {channelIcon && (
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border">
                {channelIcon}
              </div>
            )}
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  className={cn(
                    "text-sm md:text-base truncate",
                    hasUnread ? "font-bold text-foreground" : "font-medium"
                  )}
                >
                  {data.displayName}
                </h3>
              </div>
              <span className="text-[11px] md:text-xs text-muted-foreground shrink-0">
                {data.lastMessageTime && formatTime(data.lastMessageTime)}
              </span>
            </div>

            {showSubName && data.subName && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {data.subName}
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.slice(0, 2).map((tag) => (
                  <Badge
                    key={tag.name}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-0"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {tags.length > 2 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    +{tags.length - 2}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-1">
              <p
                className={cn(
                  "text-sm truncate",
                  hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {data.lastMessage ? (
                  <>
                    {(data.lastMessageSender === 'outbound' || data.lastMessageSender === 'operator') && (
                      <span className="font-medium text-foreground/80">Tú: </span>
                    )}
                    {data.lastMessageSender === 'inbound' && data.displayName && (
                      <span className="font-medium text-foreground/80">
                        {data.displayName.split(' ')[0]}:{' '}
                      </span>
                    )}
                    {data.lastMessage}
                  </>
                ) : (
                  noMessagesText
                )}
              </p>
              {hasUnread && (
                <Badge
                  variant="destructive"
                  className="text-xs ml-2 min-w-6 justify-center shadow-sm"
                >
                  {data.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatListItem.displayName = 'ChatListItem';

export default ChatListItem;
