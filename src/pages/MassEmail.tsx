import React, { useEffect, useMemo, useState } from 'react';
import EmailCampaignDetailModal from '@/components/email/EmailCampaignDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronRight, Clock, Download, Loader2, Mail, Plus, RefreshCw, Send, Trash2, Users, XCircle } from 'lucide-react';

interface SmtpAccount {
  id: string;
  name: string;
  from_email: string;
  host: string;
  port: number;
  is_active: boolean;
  last_status: string | null;
  last_verified_at: string | null;
}
interface EmailList {
  id: string;
  name: string;
  description: string | null;
}
interface EmailContact {
  id: string;
  email: string;
  name: string | null;
}
interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

const DEFAULT_HTML = `<div style="font-family: Arial, sans-serif; padding: 24px;">
  <h1>Hola {{nombre}}</h1>
  <p>Escribe aquí tu contenido HTML.</p>
</div>`;

export default function MassEmail() {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [liveProgress, setLiveProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [campaignName, setCampaignName] = useState('Campaña de email');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [testEmail, setTestEmail] = useState('');

  const [newListName, setNewListName] = useState('');
  const [bulkContacts, setBulkContacts] = useState('');

  const connectedCount = useMemo(
    () => accounts.filter((a) => a.last_status === 'connected').length,
    [accounts],
  );

  const accountsMap = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.from_email])) as Record<string, string>,
    [accounts],
  );

  // Repara campañas que quedaron en "sending" (p. ej. si la función se cortó):
  // recalcula los contadores reales desde los envíos registrados.
  const reconcileSendingCampaigns = async (list?: Campaign[]) => {
    const stuck = (list ?? []).filter((c) => c.status === 'sending');
    for (const c of stuck) {
      const { data: rows } = await supabase
        .from('email_campaign_sends')
        .select('status')
        .eq('campaign_id', c.id);
      const sentN = (rows ?? []).filter((r: any) => r.status === 'sent').length;
      const failedN = (rows ?? []).filter((r: any) => r.status === 'failed').length;
      const done = sentN + failedN >= (c.total_recipients || 0);
      const stale = Date.now() - new Date(c.created_at).getTime() > 10 * 60 * 1000;
      if (done || stale) {
        await supabase
          .from('email_campaigns')
          .update({
            status: sentN === 0 && failedN > 0 ? 'failed' : 'completed',
            sent_count: sentN,
            failed_count: failedN,
            completed_at: new Date().toISOString(),
          })
          .eq('id', c.id);
      } else if (sentN !== c.sent_count || failedN !== c.failed_count) {
        await supabase.from('email_campaigns').update({ sent_count: sentN, failed_count: failedN }).eq('id', c.id);
      }
    }
    return stuck.length > 0;
  };

  const loadAll = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    const [a, l, c] = await Promise.all([
      supabase.from('email_smtp_accounts').select('*').eq('user_id', effectiveUserId).order('from_email'),
      supabase.from('email_lists').select('*').eq('user_id', effectiveUserId).order('created_at'),
      supabase.from('email_campaigns').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false }).limit(30),
    ]);
    setAccounts((a.data as SmtpAccount[]) ?? []);
    setLists((l.data as EmailList[]) ?? []);
    let camps = (c.data as Campaign[]) ?? [];
    if (!sending && camps.some((x) => x.status === 'sending')) {
      await reconcileSendingCampaigns(camps);
      const { data: refreshed } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(30);
      camps = (refreshed as Campaign[]) ?? camps;
    }
    setCampaigns(camps);
    if (!selectedListId && l.data?.length) setSelectedListId(l.data[0].id);
    setLoading(false);
  };


  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  useEffect(() => {
    if (!selectedListId) {
      setContacts([]);
      return;
    }
    supabase
      .from('email_contacts')
      .select('id, email, name')
      .eq('list_id', selectedListId)
      .order('email')
      .then(({ data }) => setContacts((data as EmailContact[]) ?? []));
  }, [selectedListId]);

  const verifyAccounts = async () => {
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke('smtp-verify-accounts', { body: {} });
    setVerifying(false);
    if (error) {
      toast({ title: 'Error al verificar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Verificación completada',
      description: `${data.connected} de ${data.total} sesiones conectadas`,
    });
    loadAll();
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createList = async () => {
    if (!newListName.trim() || !effectiveUserId) return;
    const { data, error } = await supabase
      .from('email_lists')
      .insert({ user_id: effectiveUserId, name: newListName.trim() })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setNewListName('');
    setSelectedListId(data.id);
    loadAll();
  };

  const importContacts = async () => {
    if (!selectedListId || !effectiveUserId) return;
    const rows = bulkContacts
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter((r) => r.includes('@'))
      .map((r) => {
        const parts = r.split(/\s+/);
        const email = parts.find((p) => p.includes('@'))!.replace(/[<>]/g, '');
        const name = parts.filter((p) => !p.includes('@')).join(' ') || null;
        return { user_id: effectiveUserId, list_id: selectedListId, email: email.toLowerCase(), name };
      });
    if (rows.length === 0) {
      toast({ title: 'Sin correos válidos', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('email_contacts').upsert(rows, { onConflict: 'list_id,email' });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setBulkContacts('');
    toast({ title: 'Contactos importados', description: `${rows.length} correos agregados` });
    const { data } = await supabase.from('email_contacts').select('id, email, name').eq('list_id', selectedListId).order('email');
    setContacts((data as EmailContact[]) ?? []);
  };

  const deleteContact = async (id: string) => {
    await supabase.from('email_contacts').delete().eq('id', id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const send = async (test: boolean) => {
    if (selectedAccounts.length === 0) {
      toast({ title: 'Selecciona al menos una sesión SMTP', variant: 'destructive' });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Escribe un asunto', variant: 'destructive' });
      return;
    }
    setSending(true);
    setLiveProgress({ sent: 0, failed: 0, total: test ? 1 : contacts.length });

    // Poll de progreso mientras la función procesa los envíos
    const poll = window.setInterval(async () => {
      const { data: last } = await supabase
        .from('email_campaigns')
        .select('id, total_recipients')
        .eq('user_id', effectiveUserId!)
        .eq('status', 'sending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last) return;
      setActiveCampaignId(last.id);
      const { data: rows } = await supabase
        .from('email_campaign_sends')
        .select('status')
        .eq('campaign_id', last.id);
      const sentN = (rows ?? []).filter((r: any) => r.status === 'sent').length;
      const failedN = (rows ?? []).filter((r: any) => r.status === 'failed').length;
      setLiveProgress({ sent: sentN, failed: failedN, total: last.total_recipients || (rows?.length ?? 0) });
    }, 3000);

    const { data, error } = await supabase.functions.invoke('send-mass-email', {
      body: {
        name: campaignName,
        subject,
        html,
        accountIds: selectedAccounts,
        listId: test ? null : selectedListId,
        recipients: test ? [testEmail] : [],
        delaySeconds,
        testMode: test,
      },
    });
    window.clearInterval(poll);
    setSending(false);
    if (error) {
      toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
      await reconcileSendingCampaigns();
      loadAll();
      return;
    }
    if (data?.error) {
      toast({ title: 'Error al enviar', description: data.error, variant: 'destructive' });
      loadAll();
      return;
    }
    setLiveProgress({ sent: data.sent, failed: data.failed, total: data.total });
    toast({
      title: 'Envío finalizado',
      description: `${data.sent} enviados, ${data.failed} fallidos de ${data.total}`,
    });
    setActiveCampaignId(data.campaignId ?? null);
    loadAll();
  };

  return (
    <>
      <div className="space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" /> Email Masivo
            </h1>
            <p className="text-muted-foreground text-sm">
              {connectedCount} de {accounts.length} sesiones SMTP conectadas · {selectedAccounts.length} seleccionadas
            </p>
          </div>
          <Button onClick={verifyAccounts} disabled={verifying} variant="outline">
            {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Verificar sesiones
          </Button>
        </div>

        <Tabs defaultValue="enviar">
          <TabsList>
            <TabsTrigger value="enviar">Enviar</TabsTrigger>
            <TabsTrigger value="sesiones">Sesiones SMTP</TabsTrigger>
            <TabsTrigger value="listas">Listas de contactos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sesiones a utilizar</CardTitle>
                <CardDescription>Los envíos se reparten en rotación entre las cuentas seleccionadas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {accounts.map((acc) => (
                  <label key={acc.id} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
                    <Checkbox checked={selectedAccounts.includes(acc.id)} onCheckedChange={() => toggleAccount(acc.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{acc.from_email}</p>
                      <p className="text-xs text-muted-foreground">{acc.host}:{acc.port}</p>
                    </div>
                    <Badge variant={acc.last_status === 'connected' ? 'default' : acc.last_status === 'error' ? 'destructive' : 'secondary'}>
                      {acc.last_status === 'connected' ? 'Conectada' : acc.last_status === 'error' ? 'Error' : 'Sin verificar'}
                    </Badge>
                  </label>
                ))}
                {accounts.length === 0 && !loading && <p className="text-sm text-muted-foreground">No hay cuentas SMTP.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contenido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la campaña</Label>
                    <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lista de destinatarios</Label>
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                      <SelectTrigger><SelectValue placeholder="Selecciona una lista" /></SelectTrigger>
                      <SelectContent>
                        {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del correo" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Código HTML (usa {'{{nombre}}'} y {'{{email}}'})</Label>
                    <Textarea value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs h-80" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vista previa</Label>
                    <iframe title="Vista previa" srcDoc={html} className="w-full h-80 rounded-md border border-border bg-white" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <div className="space-y-2">
                    <Label>Retardo entre envíos (seg)</Label>
                    <Input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Correo de prueba</Label>
                    <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="prueba@correo.com" />
                  </div>
                  <Button variant="outline" onClick={() => send(true)} disabled={sending || !testEmail}>
                    Enviar prueba
                  </Button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={() => send(false)} disabled={sending || !selectedListId}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Enviar campaña ({contacts.length} destinatarios)
                  </Button>
                  {activeCampaignId && !sending && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const c = campaigns.find((x) => x.id === activeCampaignId);
                        if (c) setDetailCampaign(c);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />Ver detalles del último envío
                    </Button>
                  )}
                </div>
                {liveProgress && (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {sending ? 'Enviando…' : 'Último envío'}
                      </span>
                      <span className="text-muted-foreground">
                        {liveProgress.sent + liveProgress.failed} / {liveProgress.total}
                      </span>
                    </div>
                    <Progress
                      value={liveProgress.total ? ((liveProgress.sent + liveProgress.failed) / liveProgress.total) * 100 : 0}
                      className="h-2"
                    />
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" />{liveProgress.sent} enviados</span>
                      <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{liveProgress.failed} fallidos</span>
                      <span className="flex items-center gap-1 text-yellow-600"><Clock className="h-3 w-3" />{Math.max(liveProgress.total - liveProgress.sent - liveProgress.failed, 0)} pendientes</span>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sesiones" className="space-y-3">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4 flex-wrap">
                  <div>
                    <p className="font-medium">{acc.from_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.host}:{acc.port} · SSL/TLS · Última verificación:{' '}
                      {acc.last_verified_at ? new Date(acc.last_verified_at).toLocaleString('es-ES') : 'nunca'}
                    </p>
                  </div>
                  <Badge variant={acc.last_status === 'connected' ? 'default' : acc.last_status === 'error' ? 'destructive' : 'secondary'}>
                    {acc.last_status === 'connected' ? 'Conectada' : acc.last_status === 'error' ? 'Error' : 'Sin verificar'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="listas" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Nueva lista</CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nombre de la lista" />
                <Button onClick={createList}><Plus className="h-4 w-4 mr-2" />Crear</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Contactos</CardTitle>
                <CardDescription>Pega los correos (uno por línea o separados por coma). Formato opcional: Nombre correo@dominio.com</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecciona una lista" /></SelectTrigger>
                  <SelectContent>
                    {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea value={bulkContacts} onChange={(e) => setBulkContacts(e.target.value)} className="h-32" placeholder={'Juan Pérez juan@correo.com\nmaria@correo.com'} />
                <Button onClick={importContacts} disabled={!selectedListId}>Importar contactos</Button>
                <div className="divide-y divide-border rounded-md border border-border max-h-80 overflow-y-auto">
                  {contacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{c.name ? `${c.name} · ` : ''}{c.email}</span>
                      <Button size="icon" variant="ghost" onClick={() => deleteContact(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {contacts.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin contactos en esta lista.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadAll}>
                <RefreshCw className="h-4 w-4 mr-2" />Actualizar
              </Button>
            </div>
            {campaigns.map((c) => {
              const pending = Math.max((c.total_recipients || 0) - (c.sent_count || 0) - (c.failed_count || 0), 0);
              const pct = c.total_recipients ? Math.round(((c.sent_count + c.failed_count) / c.total_recipients) * 100) : 0;
              return (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:border-primary/60 transition-colors"
                  onClick={() => setDetailCampaign(c)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.subject} · {new Date(c.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" />{c.sent_count}</span>
                        <span className="flex items-center gap-1 text-red-500"><XCircle className="h-4 w-4" />{c.failed_count}</span>
                        <span className="flex items-center gap-1 text-yellow-600"><Clock className="h-4 w-4" />{pending}</span>
                        <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-4 w-4" />{c.total_recipients}</span>
                        <Badge variant={c.status === 'completed' ? 'default' : c.status === 'failed' ? 'destructive' : 'secondary'}>
                          {c.status === 'completed' ? 'Completada' : c.status === 'failed' ? 'Fallida' : c.status === 'sending' ? 'Enviando' : c.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    {c.status === 'sending' && <Progress value={pct} className="h-2" />}
                  </CardContent>
                </Card>
              );
            })}
            {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay campañas.</p>}
          </TabsContent>
        </Tabs>
      </div>

      {detailCampaign && (
        <EmailCampaignDetailModal
          isOpen={!!detailCampaign}
          onClose={() => setDetailCampaign(null)}
          campaignId={detailCampaign.id}
          campaignName={detailCampaign.name}
          subject={detailCampaign.subject}
          accountsMap={accountsMap}
          onRefreshed={loadAll}
        />
      )}
    </>
  );
}

