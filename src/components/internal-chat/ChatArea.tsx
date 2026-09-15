import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Profile = Database['public']['Tables']['profiles']['Row'];
type InternalMessage = Database['public']['Tables']['internal_messages']['Row'];

interface ChatAreaProps {
  currentUserId: string;
  selectedUser: Profile | null;
  onBack?: () => void;
  isMobile?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUserId,
  selectedUser,
  onBack,
  isMobile = false
}) => {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      markMessagesAsRead();

      // Suscribirse a nuevos mensajes en tiempo real
      const channel = supabase
        .channel(`chat-${selectedUser.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'internal_messages',
            filter: `sender_id=eq.${selectedUser.id},receiver_id=eq.${currentUserId}`
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as InternalMessage]);
            markMessagesAsRead();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'internal_messages',
            filter: `sender_id=eq.${currentUserId},receiver_id=eq.${selectedUser.id}`
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as InternalMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedUser, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('id, sender_id, receiver_id, content, is_read, created_at, updated_at')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los mensajes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!selectedUser) return;

    try {
      await supabase
        .from('internal_messages')
        .update({ is_read: true })
        .eq('sender_id', selectedUser.id)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('internal_messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: selectedUser.id,
          content: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getInitials = (user: Profile) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = (user: Profile) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'HH:mm', { locale: es });
    } else if (diffInHours < 168) {
      return format(date, 'EEE HH:mm', { locale: es });
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Selecciona un usuario</h3>
          <p className="text-muted-foreground">
            Elige un usuario de la lista para comenzar a chatear
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header del chat */}
      <div className="p-3 border-b border-border bg-card flex items-center gap-3 shadow-sm">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(selectedUser)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground">{getDisplayName(selectedUser)}</h2>
          <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay mensajes aún</p>
              <p className="text-sm">Envía el primer mensaje</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.sender_id === currentUserId;
              
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  {!isOwn && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(selectedUser)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm",
                    isOwn 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-card border border-border"
                  )}>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p className={cn(
                      "text-xs mt-1",
                      isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-card shadow-sm">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={isSending}
            className="flex-1 bg-background border-border"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="bg-gradient-primary hover:opacity-90 shadow-glow"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
