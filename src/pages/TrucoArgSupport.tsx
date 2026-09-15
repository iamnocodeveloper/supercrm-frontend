import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Copy, RefreshCw, LifeBuoy, User, Shield, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  listConversaciones,
  listMensajes,
  listEventosRaw,
  responderTicket,
  webhookUrl,
  TA_CATEGORIAS,
  TA_ESTADOS,
  TAConversacion,
  TAEstado,
  TACategoria
} from '@/services/trucoargService';

const MAX_LEN = 3000;

const estadoColor: Record<string, string> = {
  abierto: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  respondido: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  cerrado: 'bg-muted text-muted-foreground border-border'
};

const autorMeta = {
  jugador: { label: 'Jugador', icon: User, cls: 'bg-muted text-foreground', side: 'start' },
  admin: { label: 'Equipo TrucoArg', icon: Shield, cls: 'bg-amber-500/15 text-foreground border border-amber-500/30', side: 'end' },
  crm: { label: 'Agente CRM', icon: Headphones, cls: 'bg-primary text-primary-foreground', side: 'end' }
} as const;

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const TrucoArgSupport: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<TAEstado | 'todos'>('todos');
  const [categoria, setCategoria] = useState<TACategoria | 'todas'>('todas');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversaciones = [], isLoading } = useQuery({
    queryKey: ['ta-convs', estado, categoria],
    queryFn: () => listConversaciones({ estado, categoria })
  });

  const selected: TAConversacion | undefined = useMemo(
    () => conversaciones.find(c => c.id === selectedId),
    [conversaciones, selectedId]
  );

  const { data: mensajes = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['ta-msgs', selectedId],
    queryFn: () => (selectedId ? listMensajes(selectedId) : Promise.resolve([])),
    enabled: !!selectedId
  });

  const { data: eventos = [], refetch: refetchEventos } = useQuery({
    queryKey: ['ta-eventos'],
    queryFn: () => listEventosRaw(30)
  });

  const abiertos = useMemo(() => conversaciones.filter(c => c.estado === 'abierto').length, [conversaciones]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('trucoarg-support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucoarg_mensajes' }, () => {
        qc.invalidateQueries({ queryKey: ['ta-msgs'] });
        qc.invalidateQueries({ queryKey: ['ta-convs'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucoarg_conversaciones' }, () => {
        qc.invalidateQueries({ queryKey: ['ta-convs'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length]);

  const handleSend = async () => {
    if (!selected) return;
    const msg = texto.trim();
    if (msg.length < 3) {
      toast({ title: 'Mensaje muy corto', description: 'Debe tener al menos 3 caracteres', variant: 'destructive' });
      return;
    }
    if (msg.length > MAX_LEN) return;
    setSending(true);
    const res = await responderTicket({
      ticketId: selected.trucoarg_ticket_id,
      mensaje: msg,
      agente: (user?.email || '').split('@')[0] || undefined
    });
    setSending(false);
    if (!res.ok) {
      toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' });
      return;
    }
    setTexto('');
    qc.invalidateQueries({ queryKey: ['ta-msgs', selected.id] });
    qc.invalidateQueries({ queryKey: ['ta-convs'] });
    toast({ title: 'Respuesta enviada' });
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl());
    toast({ title: 'URL copiada' });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-6 w-6" /> Soporte TrucoArg
          </h1>
          <p className="text-sm text-muted-foreground">Tickets del chat de soporte de TrucoArg dentro del CRM</p>
        </div>
        <Badge variant="outline" className={estadoColor.abierto}>{abiertos} abiertos</Badge>
      </div>

      <Tabs defaultValue="bandeja">
        <TabsList>
          <TabsTrigger value="bandeja">Bandeja</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="bandeja" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
            {/* Lista */}
            <Card className="h-[70vh] flex flex-col">
              <CardHeader className="pb-2 space-y-2">
                <div className="flex gap-2">
                  <Select value={estado} onValueChange={v => setEstado(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      {TA_ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={categoria} onValueChange={v => setCategoria(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {TA_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full">
                  {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : conversaciones.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-10 px-4">No hay tickets todavía.</p>
                  ) : (
                    conversaciones.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full text-left px-3 py-2 border-b border-border hover:bg-muted/60 transition-colors ${selectedId === c.id ? 'bg-muted' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {c.contacto?.username || c.contacto?.nombre || 'Jugador'}
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${estadoColor[c.estado]}`}>{c.estado}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.subject || 'Sin asunto'}</p>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="secondary" className="text-[10px]">{c.categoria}</Badge>
                          <span className="text-[10px] text-muted-foreground">{fmt(c.ultimo_mensaje_at)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Hilo */}
            <Card className="h-[70vh] flex flex-col">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Elegí un ticket para ver la conversación
                </div>
              ) : (
                <>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base">{selected.subject || 'Sin asunto'}</CardTitle>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Usuario: {selected.contacto?.username || '—'}</span>
                      <span>Nombre: {selected.contacto?.nombre || '—'}</span>
                      <span>Email: {selected.contacto?.email || '—'}</span>
                      <span>Categoría: {selected.categoria}</span>
                      <span>Estado: {selected.estado}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full p-4">
                      {loadingMsgs ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : (
                        <div className="space-y-3">
                          {mensajes.map(m => {
                            const meta = autorMeta[m.autor];
                            const Icon = meta.icon;
                            return (
                              <div key={m.id} className={`flex ${meta.side === 'end' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${meta.cls}`}>
                                  <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                                    <Icon className="h-3 w-3" />
                                    {meta.label}{m.agente ? ` · ${m.agente}` : ''}
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                                  <div className="text-[10px] opacity-70 mt-1 text-right">{fmt(m.creado_at)}</div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={bottomRef} />
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                  <div className="border-t p-3 space-y-2">
                    <Textarea
                      value={texto}
                      onChange={e => setTexto(e.target.value.slice(0, MAX_LEN))}
                      placeholder="Escribí la respuesta para el jugador..."
                      rows={3}
                      disabled={sending || selected.estado === 'cerrado'}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{texto.length}/{MAX_LEN}</span>
                      <Button onClick={handleSend} disabled={sending || texto.trim().length < 3 || selected.estado === 'cerrado'}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Responder
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">URL del webhook</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input readOnly value={webhookUrl()} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyUrl}><Copy className="h-4 w-4 mr-2" />Copiar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Últimos eventos recibidos</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetchEventos()}>
                <RefreshCw className="h-4 w-4 mr-2" />Actualizar
              </Button>
            </CardHeader>
            <CardContent>
              {eventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no llegó ningún evento.</p>
              ) : (
                <div className="space-y-2">
                  {eventos.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium">{ev.evento || 'evento'}</span>
                        <span className="text-muted-foreground"> · {ev.ticket_id?.slice(0, 8) || 'sin ticket'}</span>
                        {ev.error && <p className="text-destructive truncate">{ev.error}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={ev.firma_valida ? estadoColor.abierto : 'text-destructive border-destructive/40'}>
                          {ev.firma_valida ? 'firma ok' : 'firma inválida'}
                        </Badge>
                        <Badge variant={ev.procesado ? 'secondary' : 'outline'}>
                          {ev.procesado ? 'procesado' : 'pendiente'}
                        </Badge>
                        <span className="text-muted-foreground">{fmt(ev.recibido_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrucoArgSupport;
