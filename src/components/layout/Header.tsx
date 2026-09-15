import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, MessageSquare, Trash2, ChevronDown, User, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { dashboardService, ActiveConversation } from '@/services/dashboardService';
import { useProfile } from '@/hooks/useProfile';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { AgentPresenceChip } from './AgentPresenceChip';
import { playIncomingMessageSound, initNotificationSoundUnlock, isNotificationSoundMuted, setNotificationSoundMuted } from '@/lib/notificationSound';
export const Header = () => {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeConversations, setActiveConversations] = React.useState<ActiveConversation[]>([]);
  const unreadCount = React.useMemo(() => activeConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0), [activeConversations]);
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [soundMuted, setSoundMuted] = React.useState<boolean>(() => isNotificationSoundMuted());
  const lastSignatureRef = React.useRef<string>('');
  const clearAlerts = React.useCallback(() => {
    setActiveConversations([]);
  }, []);
  const toggleSound = React.useCallback(() => {
    setSoundMuted((prev) => {
      const next = !prev;
      setNotificationSoundMuted(next);
      if (!next) playIncomingMessageSound();
      return next;
    });
  }, []);
  const openConversationInFunnel = React.useCallback((conversationId: string) => {
    setAlertsOpen(false);
    navigate('/leads', { state: { conversationId } });
  }, [navigate]);
  const fetchActive = React.useCallback(async (opts?: { playOnNew?: boolean }) => {
    if (!effectiveUserId) return;
    const list = await dashboardService.getActiveConversations(effectiveUserId, 8);
    const signature = list.map((c) => `${c.id}:${c.last_message_time || ''}`).join('|');
    if (
      opts?.playOnNew &&
      lastSignatureRef.current &&
      signature !== lastSignatureRef.current &&
      list.some((c) => c.last_message_direction === 'inbound')
    ) {
      playIncomingMessageSound();
    }
    lastSignatureRef.current = signature;
    setActiveConversations(list);
  }, [effectiveUserId]);
  React.useEffect(() => {
    initNotificationSoundUnlock();
  }, []);
  React.useEffect(() => {
    fetchActive();
  }, [fetchActive]);
  React.useEffect(() => {
    if (!effectiveUserId) return;
    // Polling de respaldo cada 60s por si el realtime se cae
    const interval = setInterval(() => { fetchActive({ playOnNew: true }); }, 60000);
    const channel = supabase
      .channel(`realtime-alerts-${effectiveUserId}`)
      .on('postgres_changes', {
        schema: 'public',
        table: 'messages',
        event: 'INSERT',
      }, async (payload) => {
        const newMessage = payload.new as { direction?: string; user_id?: string } | null;
        // Filtrar en cliente por effectiveUserId (soporta subusuarios)
        if (newMessage?.user_id && newMessage.user_id !== effectiveUserId) return;
        if (newMessage?.direction === 'inbound' || newMessage?.direction === 'incoming') {
          playIncomingMessageSound();
        }
        await fetchActive();
      })
      .on('postgres_changes', {
        schema: 'public',
        table: 'conversations',
        event: 'UPDATE',
      }, async (payload) => {
        const conv = payload.new as { user_id?: string } | null;
        if (conv?.user_id && conv.user_id !== effectiveUserId) return;
        await fetchActive();
      })
      .subscribe();
    return () => {
      clearInterval(interval);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [effectiveUserId, fetchActive]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente"
    });
  };
  const userRole = profile?.profile_type === 'superadmin' ? 'Super Admin' : 
                   profile?.profile_type === 'client' ? 'Admin' : 
                   profile?.profile_type === 'cajero' ? 'Cajero' : 'Usuario';


  return (
    <header className="h-16 bg-background border-b border-border sticky top-0 z-30">
      <div className="flex items-center justify-between h-full px-6">
        {/* Right section - Actions */}
        <div className="flex items-center space-x-4 ml-auto">
          {/* Presence chip (cajero only) */}
          <AgentPresenceChip />

          {/* Notifications */}
          <DropdownMenu open={alertsOpen} onOpenChange={setAlertsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative hover:bg-muted/50"
                onClick={() => setAlertsOpen((o) => !o)}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-96" align="end">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Mensajes</span>
                <span className="text-xs text-muted-foreground">{unreadCount} sin leer</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {activeConversations.length === 0 && (
                <DropdownMenuItem className="text-muted-foreground">No hay mensajes</DropdownMenuItem>
              )}
              {activeConversations.length > 0 && (
                <ScrollArea className="h-72">
                  <div className="space-y-1 pr-1">
                    {activeConversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openConversationInFunnel(c.id)}
                        className="w-full px-2 py-2 text-left rounded-md hover:bg-muted/60 focus:bg-muted/60 focus:outline-none transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3 w-full">
                          <MessageSquare className="h-4 w-4 mt-1 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className={`text-sm truncate ${c.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}>
                                {c.pushname || c.contact_name || c.whatsapp_number || c.phone_number || 'Sin nombre'}
                              </div>
                              {c.last_message_time && (
                                <div className="text-[10px] text-muted-foreground shrink-0">
                                  {new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                              <div className="text-xs text-muted-foreground truncate min-w-0">
                                {c.last_message_direction === 'outbound' && (
                                  <span className="font-medium text-foreground/70">Tú: </span>
                                )}
                                {c.last_message || 'Sin vista previa'}
                              </div>
                            </div>
                            {c.last_message_time && (
                              <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                {new Date(c.last_message_time).toLocaleDateString()} {new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          {c.unread_count > 0 && (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <Button variant="ghost" size="sm" onClick={toggleSound} className="gap-2">
                  {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {soundMuted ? 'Sonido apagado' : 'Sonido activo'}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAlerts} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 hover:bg-muted/50 h-auto py-2 px-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                </div>
                <div className="w-9 h-9 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold shadow-lg">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">

              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between w-full cursor-pointer">
                  <span className="text-sm">Tema</span>
                  <ThemeToggle />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
