import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Copy, ExternalLink, Link as LinkIcon, Loader2, Plus, RefreshCw, Search, ShieldCheck, ShieldMinus, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { wahaAdminService } from '@/services/wahaAdminService';
import { FileUploadService } from '@/services/fileUploadService';
import { WahaGroup, WahaParticipant } from '@/types/waha';
import { groupDisplayName, truncate, extractParticipantId, extractParticipantRole, extractParticipantPhone, extractParticipantName } from '@/lib/wahaGroup';
import { supabase } from '@/integrations/supabase/client';

interface SessionLike {
  id: string;
  name: string;
}

interface ContactOption { id: string; name: string; phone_number: string }

interface Props {
  session: SessionLike | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const participantIsAdmin = (item: WahaParticipant | string) => {
  const role = extractParticipantRole(item).toUpperCase();
  return role === 'ADMIN' || role === 'SUPERADMIN';
};
const digits = (value: string) => value.replace(/\D/g, '');

export const SessionGroupsDialog: React.FC<Props> = ({ session, open, onOpenChange }) => {
  if (!session) return null;
  return <SessionGroupsDialogInner key={session.id} session={session} open={open} onOpenChange={onOpenChange} />;
};

const SessionGroupsDialogInner: React.FC<Props> = ({ session, open, onOpenChange }) => {
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const [groups, setGroups] = useState<WahaGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WahaGroup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await wahaAdminService.listGroups(session.id);
      setGroups(result.groups);
    } catch (error) {
      toast({ title: 'No se pudieron cargar los grupos', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [session.id, toast]);

  useEffect(() => {
    if (open) { setSearch(''); void load(); }
  }, [open, load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await wahaAdminService.refreshGroups(session.id);
      if (!result.success) throw new Error(result.error || 'No se pudo sincronizar');
      await load();
      toast({ title: 'Lista sincronizada', description: `Grupos actualizados en ${session.name}.` });
    } catch (error) {
      toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const filtered = groups.filter((group) => {
    const name = (groupDisplayName(group) || '').toLowerCase();
    const id = (group.id ?? '').toLowerCase();
    const term = search.toLowerCase().trim();
    return !term || name.includes(term) || id.includes(term);
  });

  return (
    <>
      <Dialog open={open && !selected} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              Grupos de {session.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing || loading}>
              {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Sincronizar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-3 w-3" />Crear grupo
            </Button>
            <div className="relative ml-auto flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupo" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando grupos…</div>
          ) : filtered.length === 0 ? (
            <div className="space-y-2 rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p>{groups.length === 0 ? 'No hay grupos en esta sesión o la lista no está sincronizada.' : 'Sin resultados para la búsqueda.'}</p>
              {groups.length === 0 && (
                <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
                  {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                  Sincronizar desde el servidor
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((group, idx) => (
                <button key={group.id ?? `no-id-${idx}`} type="button" onClick={() => setSelected(group)} className="flex w-full items-center justify-between gap-2 rounded border p-3 text-left text-sm transition-colors hover:border-primary hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{truncate(groupDisplayName(group), 60)}</span>
                      {group.picture ? <Camera className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{truncate(group.description, 60) || 'Sin descripción'}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{group.participants?.length ?? 0}</Badge>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>{groups.length} grupo{groups.length === 1 ? '' : 's'} en esta sesión</span>
            <Link to={`/grupos-whatsapp?session=${session.id}&sync=1`} className="flex items-center gap-1 text-primary hover:underline">
              Abrir gestión completa <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <ManageGroupDialog group={selected} onClose={() => setSelected(null)} onChanged={load} sessionName={session.name} effectiveUserId={effectiveUserId} />
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} sessionId={session.id} sessionName={session.name} onCreated={load} />
    </>
  );
};

interface ManageGroupDialogProps {
  group: WahaGroup | null;
  onClose: () => void;
  onChanged: () => void;
  sessionName: string;
  effectiveUserId: string | undefined;
}

const ManageGroupDialog: React.FC<ManageGroupDialogProps> = ({ group, onClose, onChanged, sessionName, effectiveUserId }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [participant, setParticipant] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [crmContacts, setCrmContacts] = useState<ContactOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [liveGroup, setLiveGroup] = useState<WahaGroup | null>(null);

  useEffect(() => {
    if (group) {
      setName(groupDisplayName(group));
      setDescription(group.description || '');
      setInviteCode(null);
      setContactSearch('');
      setLiveGroup(group);
      void refreshParticipants(group);
    }
  }, [group]);

  useEffect(() => {
    if (group && effectiveUserId) {
      supabase.from('contacts').select('id,name,phone_number').eq('user_id', effectiveUserId).order('name').limit(200)
        .then(({ data }) => setCrmContacts((data ?? []) as ContactOption[]));
    }
  }, [group, effectiveUserId]);

  const refreshParticipants = useCallback(async (g: WahaGroup) => {
    try {
      const list = await wahaAdminService.getParticipants(g.connectionId, g.id);
      setLiveGroup({ ...g, participants: list });
    } catch (error) {
      setLiveGroup({ ...g, participants: g.participants });
      toast({ title: 'No se pudieron cargar los participantes', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    }
  }, [toast]);

  if (!group) return null;
  const current = liveGroup ?? group;

  const filteredCrmContacts = crmContacts.filter((c) => {
    const term = contactSearch.toLowerCase().trim();
    return !term || c.name.toLowerCase().includes(term) || c.phone_number.includes(term);
  }).slice(0, 8);

  const addNumber = (value: string) => {
    const clean = digits(value);
    if (clean.length < 8 || clean.length > 15) {
      toast({ title: 'Número inválido', description: 'Usa el código de país y entre 8 y 15 dígitos.', variant: 'destructive' });
      return;
    }
    setParticipant((current) => current);
    void mutate('participants.add', { participants: [clean] });
    setParticipant('');
  };

  const mutate = async (action: 'subject' | 'description' | 'leave' | 'delete' | 'participants.add' | 'participants.addAdmin' | 'participants.remove' | 'participants.promote' | 'participants.demote' | 'picture', extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await wahaAdminService.mutateGroup({ action, connectionId: current.connectionId, groupId: current.id, ...extra });
      toast({ title: 'Grupo actualizado' });
      if (action === 'delete' || action === 'leave') { onChanged(); onClose(); return; }
      onChanged();
      const refreshed = await wahaAdminService.listGroups(current.connectionId);
      const updated = refreshed.groups.find((g) => g.id === current.id);
      if (updated) await refreshParticipants(updated);
    } catch (error) {
      toast({ title: 'Operación fallida', description: error instanceof Error ? error.message : 'No se pudo actualizar el grupo', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const uploadPicture = async (file?: File) => {
    if (!file || !effectiveUserId) return;
    const validation = FileUploadService.validateFile(file, 10);
    if (!validation.valid || !file.type.startsWith('image/')) {
      toast({ title: 'Imagen inválida', description: validation.error || 'Selecciona una imagen.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await FileUploadService.uploadFile(file, effectiveUserId, `whatsapp-groups/${current.id.replace(/[^a-z0-9]/gi, '-')}`);
      await mutate('picture', { pictureUrl: uploaded.url });
    } finally { setBusy(false); }
  };

  const fetchInvite = async () => {
    setLoadingInvite(true);
    try {
      const code = await wahaAdminService.getInviteCode(current.connectionId, current.id);
      setInviteCode(code);
    } catch (error) {
      toast({ title: 'No se pudo obtener el código', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setLoadingInvite(false); }
  };

  const revokeInvite = async () => {
    if (!window.confirm('¿Revocar el código actual? El link anterior dejará de funcionar.')) return;
    setLoadingInvite(true);
    try {
      const { inviteCode: newCode } = await wahaAdminService.revokeInviteCode(current.connectionId, current.id);
      setInviteCode(newCode);
      toast({ title: 'Código revocado', description: 'Se generó un nuevo código de invitación.' });
    } catch (error) {
      toast({ title: 'No se pudo revocar', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setLoadingInvite(false); }
  };

  const copyInviteLink = () => {
    if (!inviteCode) return;
    const link = inviteCode.startsWith('http') ? inviteCode : `https://chat.whatsapp.com/${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => toast({ title: 'Link copiado al portapapeles' }));
  };

  const inviteLink = inviteCode ? (inviteCode.startsWith('http') ? inviteCode : `https://chat.whatsapp.com/${inviteCode}`) : '';

  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            {groupDisplayName(group)}
            <Badge variant="outline" className="ml-2">{sessionName}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
              <Button disabled={busy || !name.trim()} onClick={() => mutate('subject', { name })}>Guardar</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button disabled={busy} onClick={() => mutate('description', { description })}>Guardar descripción</Button>
          </div>
          <div className="space-y-2">
            <Label>Imagen del grupo</Label>
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">
              <Camera className="mr-2 h-4 w-4" />Cambiar imagen
              <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadPicture(event.target.files?.[0])} />
            </label>
          </div>

          <div className="space-y-2 rounded border p-3">
            <Label>Invitación al grupo</Label>
            {inviteCode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded bg-muted p-2 text-xs">
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  <code className="flex-1 truncate">{inviteLink}</code>
                  <Button size="sm" variant="outline" onClick={copyInviteLink}><Copy className="mr-1 h-3 w-3" />Copiar</Button>
                </div>
                <Button size="sm" variant="secondary" onClick={revokeInvite} disabled={loadingInvite}>
                  {loadingInvite ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                  Revocar y generar nuevo
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={fetchInvite} disabled={loadingInvite}>
                {loadingInvite ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <LinkIcon className="mr-1 h-3 w-3" />}
                Obtener link de invitación
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Agregar participante</Label>
            <div className="flex gap-2">
              <Input value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="593999999999" />
              <Button disabled={busy || !participant.trim()} onClick={() => { void mutate('participants.add', { participants: [participant] }); setParticipant(''); }}><UserPlus className="h-4 w-4" /></Button>
              <Button variant="secondary" disabled={busy || !participant.trim()} onClick={() => { void mutate('participants.addAdmin', { participants: [participant] }); setParticipant(''); }} title="Agregar y promover como administrador"><ShieldCheck className="mr-1 h-4 w-4" />Admin</Button>
            </div>
            <Input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar contacto del CRM" className="mt-2" />
            {contactSearch.trim() && filteredCrmContacts.length > 0 && (
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded border p-1">
                {filteredCrmContacts.map((c) => (
                  <button key={c.id} type="button" onClick={() => addNumber(c.phone_number)} className="flex w-full items-center justify-between rounded p-2 text-left text-xs hover:bg-muted">
                    <span className="truncate">{c.name}</span>
                    <span className="ml-2 shrink-0 text-muted-foreground">{c.phone_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Participantes ({(current.participants ?? []).length})</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {(current.participants ?? []).map((item) => {
                const id = extractParticipantId(item);
                const phone = extractParticipantPhone(item);
                const pushName = extractParticipantName(item);
                const admin = participantIsAdmin(item);
                return (
                  <div key={id || 'unknown'} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      {pushName ? (
                        <div className="truncate font-medium" title={pushName}>{pushName}</div>
                      ) : (
                        <div className="truncate text-muted-foreground">Sin nombre</div>
                      )}
                      {phone ? (
                        <div className="truncate font-mono text-xs text-muted-foreground" title={phone}>{phone}</div>
                      ) : (
                        <div className="truncate font-mono text-xs text-muted-foreground/60" title={id || ''}>{id || '(sin identificador)'}</div>
                      )}
                      {admin && <Badge className="mt-1">Admin</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title={admin ? 'Quitar administrador' : 'Hacer administrador'} onClick={() => mutate(admin ? 'participants.demote' : 'participants.promote', { participants: [id] })}>
                        {admin ? <ShieldMinus className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Quitar participante" onClick={() => mutate('participants.remove', { participants: [id] })}><UserMinus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button variant="outline" disabled={busy} onClick={() => window.confirm('¿Abandonar este grupo?') && mutate('leave')}>Abandonar</Button>
            <Button variant="destructive" disabled={busy} onClick={() => window.confirm('¿Eliminar este grupo? Esta acción no se puede deshacer.') && mutate('delete')}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
            <Link to={`/grupos-whatsapp?session=${current.connectionId}&sync=1`} className="ml-auto self-center text-xs text-muted-foreground hover:text-primary">
              Gestión completa →
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionName: string;
  onCreated: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ open, onOpenChange, sessionId, sessionName, onCreated }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [participantsText, setParticipantsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setName(''); setDescription(''); setParticipantsText(''); }
  }, [open]);

  const create = async () => {
    const participants = participantsText.split(/[\s,;\n]+/).map(digits).filter((item) => item.length >= 8 && item.length <= 15);
    if (!name.trim() || !participants.length) {
      toast({ title: 'Faltan datos', description: 'Nombre y al menos un participante son obligatorios.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await wahaAdminService.mutateGroup({ action: 'create', connectionId: sessionId, name, description, participants });
      toast({ title: 'Grupo creado', description: `"${name.trim()}" en ${sessionName}.` });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({ title: 'No se pudo crear el grupo', description: error instanceof Error ? error.message : 'No se pudo crear el grupo', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Crear grupo en {sessionName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Nombre del grupo</Label><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></div>
          <div><Label>Descripción (opcional)</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={512} /></div>
          <div><Label>Participantes (uno por línea, con código de país)</Label><Textarea value={participantsText} onChange={(event) => setParticipantsText(event.target.value)} rows={5} placeholder={'593999999999\n593888888888'} /></div>
          <Button className="w-full" disabled={saving || !name.trim()} onClick={create}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Crear grupo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionGroupsDialog;
