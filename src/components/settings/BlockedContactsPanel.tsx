import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Trash2, BotOff, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BlockedContact {
  id: string;
  numero: string;
  pushname: string | null;
  created_at: string;
}

const BlockedContactsPanel: React.FC = () => {
  const { toast } = useToast();
  const { effectiveUserId, loading: userIdLoading } = useEffectiveUserId();
  const [blockedContacts, setBlockedContacts] = useState<BlockedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    const loadBlockedContacts = async () => {
      if (!effectiveUserId || userIdLoading) return;

      try {
        const { data, error } = await supabase
          .from('contacto_bloqueado_bot')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBlockedContacts(data || []);
      } catch (error) {
        console.error('Error loading blocked contacts:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los contactos bloqueados',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadBlockedContacts();
  }, [effectiveUserId, userIdLoading, toast]);

  const handleUnblock = async (contact: BlockedContact) => {
    setUnblocking(contact.id);
    try {
      const { error } = await supabase
        .from('contacto_bloqueado_bot')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      setBlockedContacts(prev => prev.filter(c => c.id !== contact.id));
      toast({
        title: 'Contacto desbloqueado',
        description: `El bot ahora responderá a ${contact.pushname || contact.numero}`,
      });
    } catch (error) {
      console.error('Error unblocking contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo desbloquear el contacto',
        variant: 'destructive',
      });
    } finally {
      setUnblocking(null);
    }
  };

  const filteredContacts = blockedContacts.filter(
    contact =>
      contact.numero.toLowerCase().includes(search.toLowerCase()) ||
      (contact.pushname && contact.pushname.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading || userIdLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotOff className="h-5 w-5 text-orange-500" />
          Contactos con Bot Bloqueado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Estos contactos tienen el bot desactivado. La IA no les responderá automáticamente hasta que los desbloquees.
        </p>

        {blockedContacts.length === 0 ? (
          <div className="py-8 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay contactos con el bot bloqueado</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {contact.pushname || 'Sin nombre'}
                      </span>
                      <span className="text-sm text-muted-foreground">{contact.numero}</span>
                      <span className="text-xs text-muted-foreground">
                        Bloqueado: {format(new Date(contact.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblock(contact)}
                      disabled={unblocking === contact.id}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      {unblocking === contact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Bot className="h-4 w-4 mr-1" />
                          Desbloquear
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center">
              {filteredContacts.length} de {blockedContacts.length} contactos bloqueados
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockedContactsPanel;
