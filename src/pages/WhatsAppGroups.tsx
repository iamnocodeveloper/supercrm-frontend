import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Copy, Link as LinkIcon, Loader2, LogIn, RefreshCw, Search, ShieldCheck, ShieldMinus, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useToast } from '@/hooks/use-toast';
import { wahaAdminService } from '@/services/wahaAdminService';
import { FileUploadService } from '@/services/fileUploadService';
import { WahaGroup, WahaGroupAction, WahaParticipant } from '@/types/waha';
import { groupDisplayName, truncate, extractParticipantId, extractParticipantRole, extractParticipantPhone, extractParticipantName } from '@/lib/wahaGroup';
import { supabase } from '@/integrations/supabase/client';

interface ContactOption { id: string; name: string; phone_number: string }

const participantIsAdmin = (item: WahaParticipant | string) => {
  const role = extractParticipantRole(item).toUpperCase();
  return role === 'ADMIN' || role === 'SUPERADMIN';
};

const WhatsAppGroups: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeConnections } = useWhatsAppConnections();
  const { effectiveUserId } = useEffectiveUserId();
  const { hasPermission, isAdmin, loading: permissionLoading } = useUserPermissions();
  const { toast } = useToast();
  const [groups, setGroups] = useState<WahaGroup[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [syncSession, setSyncSession] = useState('all');
  const [selected, setSelected] = useState<WahaGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [participant, setParticipant] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pageLimit] = useState(50);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [infoAdminOnly, setInfoAdminOnly] = useState<boolean | null>(null);
  const [messagesAdminOnly, setMessagesAdminOnly] = useState<boolean | null>(null);
  const [crmContacts, setCrmContacts] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const allowed = isAdmin || hasPermission('puede_gestionar_whatsapp');

  const load = useCallback(async (connectionId?: string) => {
    setLoading(true);
    try {
      const result = await wahaAdminService.listGroups(connectionId);
      if (connectionId) setGroups((current) => [...current.filter((item) => item.connectionId !== connectionId), ...result.groups]);
      else setGroups(result.groups);
      setErrors(result.errors);
      setLastSyncedAt(new Date());
    } catch (error) {
      toast({ title: 'No se pudieron cargar los grupos', description: error instanceof Error ? error.message : 'No se pudieron cargar los grupos', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  const syncFromServer = useCallback(async (connectionId: string) => {
    setLoading(true);
    try {
      const result = await wahaAdminService.refreshGroups(connectionId);
      if (!result.success) throw new Error(result.error || 'No se pudo sincronizar');
      toast({ title: 'Lista sincronizada con el servidor' });
      await load();
    } catch (error) {
      toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'No se pudo sincronizar', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [load, toast]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (!allowed || autoSyncedRef.current) return;
    const sessionParam = searchParams.get('session');
    const syncParam = searchParams.get('sync');
    if (!sessionParam) return;
    setSessionFilter(sessionParam);
    autoSyncedRef.current = true;
    if (syncParam === '1') {
      void syncFromServer(sessionParam).then(() => {
        searchParams.delete('session');
        searchParams.delete('sync');
        setSearchParams(searchParams, { replace: true });
      });
    } else {
      void load(sessionParam);
      searchParams.delete('session');
      setSearchParams(searchParams, { replace: true });
    }
  }, [allowed, searchParams, syncFromServer, load, setSearchParams]);

  const filtered = useMemo(() => groups.filter((group) => {
    const name = (groupDisplayName(group) || '').toLowerCase();
    const id = (group.id ?? '').toLowerCase();
    return (sessionFilter === 'all' || group.connectionId === sessionFilter) &&
      (!search.trim() || name.includes(search.toLowerCase()) || id.includes(search.toLowerCase()));
  }), [groups, search, sessionFilter]);

  const refreshParticipants = useCallback(async (group: WahaGroup) => {
    try {
      const list = await wahaAdminService.getParticipants(group.connectionId, group.id);
      setSelected({ ...group, participants: list });
    } catch {
      // mantener participants actuales si falla
    }
  }, []);

  const openGroup = (group: WahaGroup) => {
    setSelected(group);
    setName(groupDisplayName(group));
    setDescription(group.description || '');
    setInviteCode(null);
    setContactSearch('');
    void refreshParticipants({ ...group, participants: group.participants });
  };

  useEffect(() => {
    if (selected && effectiveUserId) {
      supabase.from('contacts').select('id,name,phone_number').eq('user_id', effectiveUserId).order('name').limit(200)
        .then(({ data }) => setCrmContacts((data ?? []) as ContactOption[]));
    }
  }, [selected, effectiveUserId]);

  const filteredCrmContacts = useMemo(() => {
    const term = contactSearch.toLowerCase().trim();
    return crmContacts.filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone_number.includes(term)).slice(0, 8);
  }, [crmContacts, contactSearch]);

  const addParticipantFromCrm = async (phone: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await wahaAdminService.mutateGroup({ action: 'participants.add', connectionId: selected!.connectionId, groupId: selected!.id, participants: [phone] });
      toast({ title: 'Participante agregado' });
      await load(selected!.connectionId);
    } catch (error) {
      toast({ title: 'No se pudo agregar', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const mutate = async (action: WahaGroupAction, extra: Record<string, unknown> = {}) => {
    if (!selected) return;
    setBusy(true);
    try {
      await wahaAdminService.mutateGroup({ action, connectionId: selected.connectionId, groupId: selected.id, ...extra });
      toast({ title: 'Grupo actualizado' });
      await load(selected.connectionId);
      if (action === 'delete' || action === 'leave') { setSelected(null); return; }
      const refreshed = await wahaAdminService.listGroups(selected.connectionId);
      const updated = refreshed.groups.find((g) => g.id === selected.id);
      if (updated) {
        const list = await wahaAdminService.getParticipants(selected.connectionId, selected.id);
        setSelected({ ...updated, participants: list });
      }
    } catch (error) {
      toast({ title: 'Operación fallida', description: error instanceof Error ? error.message : 'No se pudo actualizar el grupo', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const uploadPicture = async (file?: File) => {
    if (!file || !selected || !effectiveUserId) return;
    const validation = FileUploadService.validateFile(file, 10);
    if (!validation.valid || !file.type.startsWith('image/')) {
      toast({ title: 'Imagen inválida', description: validation.error || 'Selecciona una imagen.', variant: 'destructive' }); return;
    }
    setBusy(true);
    try {
      const uploaded = await FileUploadService.uploadFile(file, effectiveUserId, `whatsapp-groups/${selected.id.replace(/[^a-z0-9]/gi, '-')}`);
      await mutate('picture', { pictureUrl: uploaded.url });
    } finally { setBusy(false); }
  };

  const fetchInviteCode = async () => {
    if (!selected) return;
    setLoadingInvite(true);
    try {
      const code = await wahaAdminService.getInviteCode(selected.connectionId, selected.id);
      setInviteCode(code);
    } catch (error) {
      toast({ title: 'No se pudo obtener el código', description: error instanceof Error ? error.message : 'No se pudo obtener el código', variant: 'destructive' });
    } finally { setLoadingInvite(false); }
  };

  const revokeInviteCode = async () => {
    if (!selected) return;
    if (!window.confirm('¿Revocar el código actual? El link anterior dejará de funcionar.')) return;
    setLoadingInvite(true);
    try {
      const { inviteCode: newCode } = await wahaAdminService.revokeInviteCode(selected.connectionId, selected.id);
      setInviteCode(newCode);
      toast({ title: 'Código revocado', description: 'Se generó un nuevo código de invitación.' });
    } catch (error) {
      toast({ title: 'No se pudo revocar', description: error instanceof Error ? error.message : 'No se pudo revocar', variant: 'destructive' });
    } finally { setLoadingInvite(false); }
  };

  const copyInviteLink = () => {
    if (!inviteCode) return;
    const link = inviteCode.startsWith('http') ? inviteCode : `https://chat.whatsapp.com/${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => toast({ title: 'Link copiado al portapapeles' }));
  };

  const joinGroup = async () => {
    if (!joinSessionId || !joinCode.trim()) {
      toast({ title: 'Faltan datos', description: 'Selecciona sesión e ingresa el código o link.', variant: 'destructive' });
      return;
    }
    setJoining(true);
    try {
      await wahaAdminService.joinGroup(joinSessionId, joinCode.trim());
      toast({ title: 'Te uniste al grupo', description: 'Sincronizando la lista...' });
      setJoinOpen(false);
      setJoinCode('');
      await syncFromServer(joinSessionId);
    } catch (error) {
      toast({ title: 'No se pudo unir al grupo', description: error instanceof Error ? error.message : 'No se pudo unir al grupo', variant: 'destructive' });
    } finally { setJoining(false); }
  };

  if (permissionLoading) return <div className="p-8">Cargando permisos…</div>;
  if (!allowed) return <div className="p-8"><Card><CardContent className="p-6">No tienes permiso para gestionar WhatsApp.</CardContent></Card></div>;

  const inviteLink = inviteCode ? (inviteCode.startsWith('http') ? inviteCode : `https://chat.whatsapp.com/${inviteCode}`) : '';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Grupos WhatsApp</h1>
          <p className="text-muted-foreground">Grupos visibles en todas las sesiones QR y API conectadas.</p>
          {lastSyncedAt && <p className="text-xs text-muted-foreground">Última sincronización: {lastSyncedAt.toLocaleTimeString('es-ES')}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={syncSession} onValueChange={setSyncSession}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sesion a sincronizar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sesiones</SelectItem>
              {activeConnections.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={async () => { if (syncSession === 'all') { await load(); } else { await syncFromServer(syncSession); } }} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Sincronizar
          </Button>
          <Button onClick={() => load()} disabled={loading} variant="outline">Recargar</Button>
          <Button onClick={() => { setJoinSessionId(activeConnections[0]?.id ?? ''); setJoinOpen(true); }} disabled={!activeConnections.length}>
            <LogIn className="mr-2 h-4 w-4" />Unirse a grupo
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupo" /></div>
        <Select value={sessionFilter} onValueChange={setSessionFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sesiones</SelectItem>
            {activeConnections.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {errors.map((error) => <div key={error} className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</div>)}
      {!loading && !filtered.length && <Card><CardContent className="p-10 text-center text-muted-foreground">No se encontraron grupos. Si esperas ver grupos recién creados, prueba "Sincronizar" para refrescar la lista desde el servidor.</CardContent></Card>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((group, idx) => (
          <Card key={`${group.connectionId}-${group.id ?? 'no-id-' + idx}`} className="cursor-pointer hover:border-primary" onClick={() => openGroup(group)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 shrink-0" /><span className="truncate">{truncate(groupDisplayName(group), 60) || 'Grupo sin nombre'}</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant="outline">{group.session}</Badge>
              <p className="line-clamp-2 text-muted-foreground">{truncate(group.description, 60) || 'Sin descripción'}</p>
              <p>{group.participants?.length ?? 0} participantes</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Gestionar grupo</DialogTitle></DialogHeader>
          {selected && (
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
                    <Button size="sm" variant="secondary" onClick={revokeInviteCode} disabled={loadingInvite}>
                      {loadingInvite ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      Revocar y generar nuevo
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={fetchInviteCode} disabled={loadingInvite}>
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
                      <button key={c.id} type="button" onClick={() => addParticipantFromCrm(c.phone_number)} className="flex w-full items-center justify-between rounded p-2 text-left text-xs hover:bg-muted">
                        <span className="truncate">{c.name}</span>
                        <span className="ml-2 shrink-0 text-muted-foreground">{c.phone_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Participantes</Label>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {(selected.participants ?? []).map((item) => {
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
              <div className="space-y-2 rounded border p-3">
                <Label>Seguridad</Label>
                <p className="text-xs text-muted-foreground">Los cambios se aplican al instante.</p>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm">Solo administradores editan info del grupo</span>
                  <input
                    type="checkbox"
                    checked={infoAdminOnly ?? false}
                    disabled={busy}
                    onChange={async (event) => {
                      const value = event.target.checked;
                      setInfoAdminOnly(value);
                      try {
                        await wahaAdminService.mutateGroup({ action: 'settings.infoAdminOnly', connectionId: selected.connectionId, groupId: selected.id, adminsOnly: value });
                        toast({ title: value ? 'Solo admins pueden editar' : 'Todos pueden editar' });
                      } catch (error) {
                        setInfoAdminOnly(!value);
                        toast({ title: 'No se pudo cambiar', description: error instanceof Error ? error.message : 'No se pudo cambiar', variant: 'destructive' });
                      }
                    }}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm">Solo administradores envian mensajes</span>
                  <input
                    type="checkbox"
                    checked={messagesAdminOnly ?? false}
                    disabled={busy}
                    onChange={async (event) => {
                      const value = event.target.checked;
                      setMessagesAdminOnly(value);
                      try {
                        await wahaAdminService.mutateGroup({ action: 'settings.messagesAdminOnly', connectionId: selected.connectionId, groupId: selected.id, adminsOnly: value });
                        toast({ title: value ? 'Solo admins envian mensajes' : 'Todos pueden enviar mensajes' });
                      } catch (error) {
                        setMessagesAdminOnly(!value);
                        toast({ title: 'No se pudo cambiar', description: error instanceof Error ? error.message : 'No se pudo cambiar', variant: 'destructive' });
                      }
                    }}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button variant="outline" disabled={busy} onClick={() => window.confirm('¿Abandonar este grupo?') && mutate('leave')}>Abandonar</Button>
                <Button variant="destructive" disabled={busy} onClick={() => window.confirm('¿Eliminar este grupo? Esta acción no se puede deshacer.') && mutate('delete')}><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Unirse a un grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sesión</Label>
              <Select value={joinSessionId} onValueChange={setJoinSessionId}>
                <SelectTrigger><SelectValue placeholder="Selecciona la cuenta" /></SelectTrigger>
                <SelectContent>
                  {activeConnections.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código o link de invitación</Label>
              <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="ABC123XYZ o https://chat.whatsapp.com/ABC123XYZ" />
              <p className="text-xs text-muted-foreground">Pega el código corto o el link completo.</p>
            </div>
            <Button className="w-full" disabled={joining} onClick={joinGroup}>
              {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Unirse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppGroups;
