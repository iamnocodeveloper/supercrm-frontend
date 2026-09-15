import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Loader2, Search, Send, Type, Video, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadService } from '@/services/fileUploadService';
import { wahaAdminService } from '@/services/wahaAdminService';
import { WhatsAppStatusPayload } from '@/types/waha';

interface ContactOption { id: string; name: string; phone_number: string }
type StatusType = 'text' | 'image' | 'video';

interface ProgressItem { session: string; connection_id: string; success: boolean; error?: string; status_id?: string }
interface JobProgress { done: number; total: number; current?: string | null; results?: ProgressItem[] }
interface JobRow {
  id: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  progress: JobProgress | null;
  sent_count: number;
  failed_count: number;
  error_message: string | null;
}

interface PublishedRow {
  id: string;
  connection_id: string;
  session_name: string;
  type: string;
  status_id: string;
  preview: string | null;
  file_url: string | null;
  created_at: string;
}

const WhatsAppStatuses: React.FC = () => {
  const { connections, activeConnections } = useWhatsAppConnections();
  const { effectiveUserId } = useEffectiveUserId();
  const { hasPermission, isAdmin, loading: permissionLoading } = useUserPermissions();
  const { toast } = useToast();
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [type, setType] = useState<StatusType>('text');
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#38b42f');
  const [file, setFile] = useState<File | null>(null);
  const [audience, setAudience] = useState<'all' | 'selected'>('all');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [currentJob, setCurrentJob] = useState<JobRow | null>(null);
  const [published, setPublished] = useState<PublishedRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const allowed = isAdmin || hasPermission('puede_gestionar_whatsapp');

  useEffect(() => {
    if (!effectiveUserId || !allowed) return;
    supabase.from('contacts').select('id,name,phone_number').eq('user_id', effectiveUserId).order('name').limit(500)
      .then(({ data }) => setContacts((data ?? []) as ContactOption[]));
  }, [effectiveUserId, allowed]);

  // Cargar estados publicados
  const refreshPublished = React.useCallback(async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('whatsapp_published_statuses')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    setPublished((data ?? []) as PublishedRow[]);
  }, [effectiveUserId]);

  useEffect(() => { refreshPublished(); }, [refreshPublished]);

  // Suscripción realtime al job actual
  useEffect(() => {
    if (!currentJob?.id) return;
    const channel = supabase
      .channel(`status-job-${currentJob.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'whatsapp_status_queue', filter: `id=eq.${currentJob.id}`,
      }, (payload) => {
        const row = payload.new as JobRow;
        setCurrentJob(row);
        if (row.status === 'sent' || row.status === 'failed') {
          setPublishing(false);
          refreshPublished();
          const ok = row.sent_count ?? 0;
          const ko = row.failed_count ?? 0;
          if (ko === 0) toast({ title: `Estado publicado en ${ok} sesión(es)` });
          else if (ok === 0) toast({ title: 'Fallo total al publicar', description: row.error_message ?? undefined, variant: 'destructive', duration: 10000 });
          else toast({ title: `Publicado en ${ok} de ${ok + ko}`, description: 'Ver detalles abajo.', variant: 'destructive', duration: 8000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentJob?.id, refreshPublished, toast]);

  const filteredContacts = useMemo(() => {
    const term = contactSearch.toLowerCase().trim();
    return contacts.filter((item) => !term || item.name.toLowerCase().includes(term) || item.phone_number.includes(term)).slice(0, 30);
  }, [contacts, contactSearch]);

  const filteredSessions = useMemo(() => {
    const term = sessionSearch.toLowerCase().trim();
    return connections.filter((connection) => {
      if (!term) return true;
      const name = connection.name?.toLowerCase() ?? '';
      const phone = connection.phone_number?.toLowerCase() ?? '';
      const subtype = connection.connection_subtype?.toLowerCase() ?? '';
      return name.includes(term) || phone.includes(term) || subtype.includes(term);
    });
  }, [connections, sessionSearch]);

  const publish = async () => {
    if (!effectiveUserId || !selectedSessions.length) return;
    if (audience === 'selected' && !selectedContacts.length) { toast({ title: 'Selecciona contactos', variant: 'destructive' }); return; }
    setPublishing(true); setCurrentJob(null);
    try {
      let fileUrl: string | undefined;
      let fileMimetype: string | undefined;
      if (type === 'image' || type === 'video') {
        if (!file) throw new Error(type === 'image' ? 'Selecciona una imagen' : 'Selecciona un video');
        const maxMB = type === 'video' ? 30 : 10;
        const validation = FileUploadService.validateFile(file, maxMB);
        if (!validation.valid) throw new Error(validation.error);
        fileMimetype = file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');
        fileUrl = (await FileUploadService.uploadFile(file, effectiveUserId, `whatsapp-status/${Date.now()}`)).url;
      }
      const response = await wahaAdminService.publishStatus({
        connectionIds: selectedSessions,
        type,
        text,
        caption,
        fileUrl,
        fileMimetype,
        backgroundColor,
        contacts: audience === 'selected' ? selectedContacts : undefined,
        queue: true,
      } as WhatsAppStatusPayload);
      if (response.queued && response.jobId) {
        setCurrentJob({
          id: response.jobId, status: 'pending',
          progress: { done: 0, total: selectedSessions.length, results: [] },
          sent_count: 0, failed_count: 0, error_message: null,
        });
        toast({ title: 'Envío iniciado', description: `Procesando ${selectedSessions.length} sesión(es) secuencialmente.` });
      }
    } catch (error) {
      setPublishing(false);
      toast({ title: 'No se pudo publicar', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    }
  };

  const deleteStatus = async (row: PublishedRow) => {
    setDeletingId(row.id);
    try {
      await wahaAdminService.publishStatus({
        connectionIds: [row.connection_id],
        type: 'delete',
        statusId: row.status_id,
      } as WhatsAppStatusPayload);
      await supabase.from('whatsapp_published_statuses').delete().eq('id', row.id);
      toast({ title: 'Estado eliminado' });
      refreshPublished();
    } catch (error) {
      toast({ title: 'No se pudo borrar', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (permissionLoading) return <div className="p-8">Cargando permisos…</div>;
  if (!allowed) return <div className="p-8"><Card><CardContent className="p-6">No tienes permiso para gestionar WhatsApp.</CardContent></Card></div>;

  const typeIcon = type === 'text' ? <Type className="h-4 w-4" /> : type === 'image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />;
  const progressPct = currentJob?.progress ? Math.round((currentJob.progress.done / Math.max(currentJob.progress.total, 1)) * 100) : 0;

  return <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <div><h1 className="text-2xl font-bold">Estados WhatsApp</h1><p className="text-muted-foreground">Publica en una o varias sesiones QR/API. Envío secuencial sesión por sesión.</p></div>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Contenido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => { setType(value as StatusType); setFile(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagen</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'text' && (
            <>
              <div><Label>Texto</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} /></div>
              <div><Label>Color de fondo</Label><Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-12" /></div>
            </>
          )}
          {type === 'image' && (
            <>
              <div><Label>Imagen (máximo 10 MB)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div><Label>Descripción</Label><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
            </>
          )}
          {type === 'video' && (
            <>
              <div><Label>Video (máximo 30 MB, MP4 recomendado)</Label><Input type="file" accept="video/mp4,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div><Label>Descripción</Label><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} /></div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:flex lg:flex-col">
        <Card className="flex min-h-0 flex-col lg:flex-1">
          <CardHeader className="flex-shrink-0">
            <CardTitle>Sesiones</CardTitle>
            <p className="text-xs text-muted-foreground">Conectadas: <span className="text-green-500 font-medium">{activeConnections.length}</span> · Desconectadas: <span className="text-red-500 font-medium">{connections.length - activeConnections.length}</span></p>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-2">
            {connections.length > 0 && (
              <div className="relative flex-shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} placeholder="Buscar sesión" className="pl-9" />
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredSessions.map((connection) => {
                const isWorking = connection.status === 'WORKING' || connection.status === 'connected';
                return (
                  <label key={connection.id} className={`flex items-center gap-3 rounded border p-3 ${!isWorking ? 'opacity-50' : ''}`}>
                    <Checkbox
                      checked={selectedSessions.includes(connection.id)}
                      disabled={!isWorking}
                      onCheckedChange={(checked) => setSelectedSessions((items) => checked ? [...items, connection.id] : items.filter((id) => id !== connection.id))}
                    />
                    <span className="flex-1 truncate">{connection.name}</span>
                    {isWorking
                      ? <span title="Conectada"><CheckCircle className="h-4 w-4 text-green-500" /></span>
                      : <span title="Desconectada"><XCircle className="h-4 w-4 text-red-500" /></span>}
                    <Badge variant="outline">{connection.connection_subtype || 'qr'}</Badge>
                  </label>
                );
              })}
              {!connections.length && <p className="text-muted-foreground">No hay sesiones configuradas.</p>}
              {connections.length > 0 && !filteredSessions.length && <p className="text-muted-foreground text-sm">Sin resultados para "{sessionSearch}"</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audiencia</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={audience} onValueChange={(value) => setAudience(value as 'all' | 'selected')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos mis contactos</SelectItem><SelectItem value="selected">Contactos seleccionados</SelectItem></SelectContent>
            </Select>
            {audience === 'selected' && (
              <>
                <Input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Buscar contacto" />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filteredContacts.map((contact) => (
                    <label key={contact.id} className="flex items-center gap-2 rounded p-2 hover:bg-muted">
                      <Checkbox checked={selectedContacts.includes(contact.phone_number)} onCheckedChange={(checked) => setSelectedContacts((items) => checked ? [...items, contact.phone_number] : items.filter((phone) => phone !== contact.phone_number))} />
                      <span className="flex-1 text-sm">{contact.name}</span>
                      <span className="text-xs text-muted-foreground">{contact.phone_number}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>

    <Button
      size="lg"
      disabled={publishing || !selectedSessions.length || (type === 'text' ? !text.trim() : !file)}
      onClick={publish}
    >
      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      {typeIcon}
      <span className="ml-2">{publishing ? 'Enviando…' : `Publicar estado (${selectedSessions.length})`}</span>
    </Button>

    {currentJob && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progreso del envío</span>
            <Badge variant={currentJob.status === 'sent' ? 'default' : currentJob.status === 'failed' ? 'destructive' : 'secondary'}>
              {currentJob.status === 'pending' && 'Pendiente'}
              {currentJob.status === 'sending' && 'Enviando'}
              {currentJob.status === 'sent' && 'Completado'}
              {currentJob.status === 'failed' && 'Fallido'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>{currentJob.progress?.done ?? 0} / {currentJob.progress?.total ?? 0} sesiones</span>
            <span className="text-muted-foreground">
              {currentJob.progress?.current ? `Enviando a: ${currentJob.progress.current}` : ' '}
            </span>
          </div>
          <Progress value={progressPct} />
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(currentJob.progress?.results ?? []).map((r, idx) => (
              <div key={`${r.connection_id}-${idx}`} className="flex items-center justify-between rounded border p-2 text-sm">
                <span className="truncate flex items-center gap-2">
                  {r.success
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-red-500" />}
                  {r.session}
                </span>
                {r.success
                  ? <Badge variant="outline">OK</Badge>
                  : <span className="text-xs text-red-500 truncate max-w-[60%]" title={r.error}>{r.error}</span>}
              </div>
            ))}
            {currentJob.status === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Esperando procesamiento…</div>
            )}
          </div>
        </CardContent>
      </Card>
    )}

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Estados publicados</span>
          <Button variant="outline" size="sm" onClick={refreshPublished}>Refrescar</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!published.length && <p className="text-sm text-muted-foreground">Aún no hay estados publicados registrados.</p>}
        {published.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded border p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{row.type}</Badge>
                <span className="truncate font-medium">{row.session_name}</span>
                <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              {row.preview && <p className="text-xs text-muted-foreground truncate mt-1">{row.preview}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingId === row.id}
              onClick={() => deleteStatus(row)}
            >
              {deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>;
};

export default WhatsAppStatuses;
