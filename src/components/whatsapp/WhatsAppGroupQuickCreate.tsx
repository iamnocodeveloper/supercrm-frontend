import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { wahaAdminService } from '@/services/wahaAdminService';
import { useToast } from '@/hooks/use-toast';

interface Props {
  phoneNumber: string;
  contactName?: string;
  whatsappNumber?: string | null;
  conversationId?: string;
}

interface ContactOption { id: string; name: string; phone_number: string }

const digits = (value: string) => value.replace(/\D/g, '');

export const WhatsAppGroupQuickCreate: React.FC<Props> = ({ phoneNumber, contactName, whatsappNumber, conversationId }) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { hasPermission, isAdmin } = useUserPermissions();
  const { getConnectionByPhoneNumber } = useWhatsAppConnections();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const allowed = isAdmin || hasPermission('puede_gestionar_whatsapp');
  const connection = getConnectionByPhoneNumber(whatsappNumber ?? null);
  const contactPhone = digits(phoneNumber);
  const contactAlreadyAdded = contactPhone.length >= 8 && contactPhone.length <= 15
    && selected.some((item) => digits(item) === contactPhone);

  useEffect(() => {
    if (!open || !effectiveUserId) return;
    supabase.from('contacts').select('id,name,phone_number').eq('user_id', effectiveUserId).order('name').limit(200)
      .then(({ data }) => setContacts((data ?? []) as ContactOption[]));
  }, [open, effectiveUserId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return contacts.slice(0, 8);
    return contacts.filter((item) => item.name.toLowerCase().includes(term) || item.phone_number.includes(term)).slice(0, 8);
  }, [contacts, search]);

  if (!allowed) return null;
  if (!connection) {
    return <Card className="p-3 text-xs text-muted-foreground">Esta conversación no está vinculada a una sesión WhatsApp activa, no se puede crear un grupo.</Card>;
  }

  const addNumber = (value: string) => {
    const clean = digits(value);
    if (clean.length < 8 || clean.length > 15) {
      toast({ title: 'Número inválido', description: 'Usa el código de país y entre 8 y 15 dígitos.', variant: 'destructive' });
      return;
    }
    setSelected((current) => current.some((item) => digits(item) === clean) ? current : [...current, clean]);
    setManual('');
  };

  const create = async () => {
    if (!name.trim()) {
      toast({ title: 'Falta el nombre', description: 'El grupo necesita un nombre.', variant: 'destructive' });
      return;
    }

    const contactToInclude = (contactPhone.length >= 8 && contactPhone.length <= 15) ? contactPhone : null;
    const alreadyInList = contactToInclude ? selected.some((p) => digits(p) === contactToInclude) : false;
    const initialParticipants = (contactToInclude && !alreadyInList)
      ? [contactToInclude, ...selected]
      : selected;

    if (!initialParticipants.length) {
      toast({ title: 'Faltan participantes', description: 'Agrega al menos un participante.', variant: 'destructive' });
      return;
    }

setSaving(true);
    let createdGroup: Awaited<ReturnType<typeof wahaAdminService.mutateGroup>> = null;
    try {
      createdGroup = await wahaAdminService.mutateGroup({
        action: 'create',
        connectionId: connection.id,
        name,
        description,
        participants: initialParticipants,
      });
      toast({ title: 'Grupo creado', description: `“${name.trim()}” fue creado en ${connection.name}. Aparecerá como nueva conversación en el sidebar.` });
    } catch (error) {
      toast({ title: 'No se pudo crear el grupo', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (!createdGroup?.id) {
      toast({ title: 'Grupo creado pero sin identificador', description: 'No se pudo crear la conversación del grupo. Usa "Ver grupos" en Configuración para localizarlo.', variant: 'destructive', duration: 10000 });
    } else {
      // Crear conversación nueva para el grupo (idempotente: si el webhook ya la creó, solo actualiza campos)
      try {
        await supabase.from('conversations').upsert({
          user_id: effectiveUserId,
          phone_number: createdGroup.id,
          whatsapp_number: connection.name,
          pushname: `👥 ${name.trim()}`,
          contact_name: name.trim(),
          channel_type: 'whatsapp',
          is_group: true,
          group_subject: name.trim(),
          status: 'active',
          last_message: `Grupo "${name.trim()}" creado`,
          last_message_time: new Date().toISOString(),
          unread_count: 0,
        }, {
          onConflict: 'user_id,phone_number,whatsapp_number,channel_type',
        });
      } catch (error) {
        console.warn('[WhatsAppGroupQuickCreate] No se pudo crear la conversación del grupo:', error);
      }

      try {
        await wahaAdminService.refreshGroups(connection.id);
      } catch {
        // refresh best-effort
      }
    }

    setOpen(false); setName(''); setDescription(''); setSelected([]);
    setSaving(false);
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium">GRUPO DE WHATSAPP</span></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">Crear grupo</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Crear grupo desde esta conversación</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Sesión</Label><Input value={connection.name} disabled /></div>
              <div><Label>Nombre del grupo</Label><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></div>
              <div><Label>Descripción (opcional)</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tema del grupo, reglas, etc." rows={3} maxLength={512} /></div>
              <div><Label>Buscar contactos del CRM</Label><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o número" /></div>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {filtered.map((contact) => <button key={contact.id} type="button" onClick={() => addNumber(contact.phone_number)} className="flex w-full justify-between rounded p-2 text-left text-sm hover:bg-muted"><span>{contact.name}</span><span className="text-muted-foreground">{contact.phone_number}</span></button>)}
              </div>
              <div><Label>Agregar número nuevo</Label><div className="flex gap-2"><Input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="593999999999" /><Button type="button" variant="secondary" onClick={() => addNumber(manual)}>Agregar</Button></div></div>
              {contactPhone.length >= 8 && contactPhone.length <= 15 && !contactAlreadyAdded && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
                  <Users className="mr-2 inline h-4 w-4 text-emerald-500" />
                  {contactName || contactPhone} se incluirá automáticamente como participante al crear el grupo.
                </div>
              )}
              <div className="flex flex-wrap gap-2">{selected.map((number) => <Badge key={number} variant="secondary">{number}<button type="button" onClick={() => setSelected((items) => items.filter((item) => item !== number))}><X className="ml-1 h-3 w-3" /></button></Badge>)}</div>
              <Button className="w-full" disabled={saving || !name.trim() || !selected.length} onClick={create}>{saving ? 'Creando…' : 'Crear grupo'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
};
