import React, { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserListProps {
  currentUserId: string;
  selectedUser: Profile | null;
  onSelectUser: (user: Profile) => void;
  isMobile?: boolean;
}

export const UserList: React.FC<UserListProps> = ({
  currentUserId,
  selectedUser,
  onSelectUser,
  isMobile = false
}) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsers();
    loadUnreadCounts();

    // Suscribirse a nuevos mensajes para actualizar contadores
    const channel = supabase
      .channel('internal-messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCounts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .order('email', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('sender_id')
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((msg) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error loading unread counts:', error);
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower)
    );
  });

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

  return (
    <div className={cn(
      "border-r border-border flex flex-col bg-card",
      isMobile ? "w-full" : "w-80"
    )}>
      {/* Search y Badge */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Usuarios</h3>
          {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
            <Badge variant="default" className="bg-primary">
              {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se encontraron usuarios</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200",
                  "hover:bg-accent/80",
                  selectedUser?.id === user.id && "bg-accent shadow-sm"
                )}
              >
                <Avatar className="h-10 w-10 ring-2 ring-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground truncate">{getDisplayName(user)}</p>
                    {unreadCounts[user.id] > 0 && (
                      <Badge variant="default" className="ml-2 h-5 min-w-[20px] px-1.5 bg-primary">
                        {unreadCounts[user.id]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
