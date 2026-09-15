import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { wahaAdminService } from '@/services/wahaAdminService';
import { WahaGroup } from '@/types/waha';
import { groupDisplayName, truncate } from '@/lib/wahaGroup';

interface Props {
  sessionId: string;
  sessionName: string;
}

const digits = (value: string) => value.replace(/\D/g, '');

export const SessionGroupsSection: React.FC<Props> = ({ sessionId, sessionName }) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<WahaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await wahaAdminService.listGroups(sessionId);
      setGroups(result.groups);
    } catch (error) {
      toast({ title: 'No se pudieron cargar los grupos', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [sessionId, toast]);

  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await wahaAdminService.refreshGroups(sessionId);
      if (!result.success) throw new Error(result.error || 'No se pudo sincronizar');
      await load();
      toast({ title: 'Lista sincronizada', description: `${groups.length} grupos en ${sessionName}` });
    } catch (error) {
      toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-emerald-500" />Grupos de esta sesión</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={sync} disabled={syncing || loading}>
            {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-3 w-3" />Crear grupo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-4 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando grupos…</div>
        ) : groups.length === 0 ? (
          <div className="space-y-2 py-3 text-center text-sm text-muted-foreground">
            <p>No hay grupos en esta sesión o la lista no está sincronizada.</p>
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Sincronizar desde el servidor
            </Button>
          </div>
        ) : (
          <>
            {groups.slice(0, 5).map((group) => (
              <div key={group.id ?? groupDisplayName(group)} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{truncate(groupDisplayName(group), 60)}</span>
                    {group.picture ? <Camera className="h-3 w-3 text-muted-foreground" /> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{truncate(group.description, 60) || 'Sin descripción'}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{group.participants?.length ?? 0}</Badge>
              </div>
            ))}
            {groups.length > 5 && (
              <Link to={`/grupos-whatsapp?session=${sessionId}&sync=1`} className="block text-center text-xs text-primary hover:underline">
                Ver todos los grupos ({groups.length}) →
              </Link>
            )}
          </>
        )}
        <Link to={`/grupos-whatsapp?session=${sessionId}&sync=1`} className="block pt-1 text-center text-xs text-muted-foreground hover:text-primary">
          Abrir gestión completa de grupos →
        </Link>
      </CardContent>
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} sessionId={sessionId} sessionName={sessionName} onCreated={load} />
    </Card>
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

export default SessionGroupsSection;
