import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, TrendingUp, TrendingDown, Heart, AlertCircle, Target,
  MessageCircle, Loader2, RefreshCw, Filter, MessageSquare, Eye, Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

interface Analysis {
  sentiment: 'positivo' | 'neutral' | 'negativo';
  sentiment_score: number;
  positivity: number;
  negativity: number;
  intent: string;
  intent_confidence: number;
  summary: string;
  key_topics: string[];
  urgency: 'baja' | 'media' | 'alta';
  recommended_action: string;
  customer_satisfaction: number;
}

interface Highlights {
  positive?: string[];
  negative?: string[];
  urgency?: string[];
  topics?: Record<string, string[]>;
}

interface ConvOption {
  id: string;
  contact_name: string | null;
  phone_number: string | null;
  channel_type: string | null;
  whatsapp_number: string | null;
  twilio_connection_id: string | null;
  telegram_bot_id: string | null;
}

interface ChannelConnection {
  id: string;
  label: string;
  phone_number?: string | null;
  subtype?: string | null;
  type: 'whatsapp' | 'twilio' | 'telegram';
}

interface WhatsAppConnectionRow {
  id: string;
  name: string | null;
  phone_number: string | null;
  connection_subtype: string | null;
}

interface TwilioConnectionRow {
  id: string;
  connection_name: string | null;
  phone_number: string | null;
}

interface TelegramBotRow {
  id: string;
  bot_name: string | null;
  bot_username: string | null;
}

interface AnalyzedItem {
  conv: ConvOption;
  analysis: Analysis | null;
  highlights: Highlights | null;
  messageCount: number;
  groupKey: string;
  groupLabel: string;
  cached?: boolean;
  error?: string;
  warning?: string;
}

interface MessageRow {
  id: string;
  content: string | null;
  direction: string | null;
  created_at: string | null;
}

const BATCH_LIMIT = 10;
const SOURCE_LIMIT = 200;

const baseChannelOptions = [
  { value: 'all', label: 'Todos los canales' },
  { value: 'whatsapp_qr', label: 'WhatsApp QR' },
  { value: 'whatsapp_api', label: 'WhatsApp API' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'webchat', label: 'WebChat' },
];

const groupLabels: Record<string, string> = {
  whatsapp_qr: 'WhatsApp QR',
  whatsapp_api: 'WhatsApp API',
  twilio: 'Twilio',
  telegram: 'Telegram',
  webchat: 'WebChat',
};

const normalizePhone = (phone?: string | null) => (phone || '').replace(/\D/g, '');

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido';

const isInbound = (d?: string | null) => d === 'inbound' || d === 'incoming' || d === 'received';



type HighlightKind = 'positive' | 'negative' | 'urgency' | 'topic';

interface HighlightRule {
  phrase: string;
  kind: HighlightKind;
  label?: string;
}

const highlightStyle: Record<HighlightKind, string> = {
  positive: 'bg-success/20 text-success-foreground rounded px-0.5',
  negative: 'bg-destructive/20 text-destructive-foreground rounded px-0.5',
  urgency: 'bg-warning/30 text-warning-foreground rounded px-0.5',
  topic: 'bg-primary/20 text-primary rounded px-0.5',
};

const buildRules = (h: Highlights | null): HighlightRule[] => {
  if (!h) return [];
  const rules: HighlightRule[] = [];
  (h.positive || []).forEach((p) => p && rules.push({ phrase: p, kind: 'positive' }));
  (h.negative || []).forEach((p) => p && rules.push({ phrase: p, kind: 'negative' }));
  (h.urgency || []).forEach((p) => p && rules.push({ phrase: p, kind: 'urgency' }));
  Object.entries(h.topics || {}).forEach(([label, arr]) =>
    (arr || []).forEach((p) => p && rules.push({ phrase: p, kind: 'topic', label }))
  );
  // longest first to avoid partial overlap
  return rules.sort((a, b) => b.phrase.length - a.phrase.length);
};

const renderHighlighted = (text: string, rules: HighlightRule[]) => {
  if (!text || rules.length === 0) return text;
  type Range = { start: number; end: number; kind: HighlightKind };
  const ranges: Range[] = [];
  const lower = text.toLowerCase();
  for (const r of rules) {
    if (!r.phrase) continue;
    const needle = r.phrase.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      // skip overlap
      const end = idx + needle.length;
      const overlap = ranges.some((rg) => idx < rg.end && end > rg.start);
      if (!overlap) ranges.push({ start: idx, end, kind: r.kind });
      idx = end;
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((rg, i) => {
    if (rg.start > cursor) parts.push(text.slice(cursor, rg.start));
    parts.push(
      <mark key={i} className={highlightStyle[rg.kind]}>
        {text.slice(rg.start, rg.end)}
      </mark>
    );
    cursor = rg.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

const getConversationGroup = (conv: ConvOption, conns: ChannelConnection[]) => {
  if (conv.channel_type === 'twilio' || conv.twilio_connection_id) return { key: 'twilio', label: 'Twilio' };
  if (conv.channel_type === 'telegram' || conv.telegram_bot_id) return { key: 'telegram', label: 'Telegram' };
  if (conv.channel_type === 'webchat') return { key: 'webchat', label: 'WebChat' };
  if (conv.channel_type === 'whatsapp' || conv.whatsapp_number) {
    const businessNumber = normalizePhone(conv.whatsapp_number);
    const c = conns.find((x) => x.type === 'whatsapp' && normalizePhone(x.phone_number) === businessNumber);
    const isApi = c?.subtype === 'api';
    return { key: isApi ? 'whatsapp_api' : 'whatsapp_qr', label: isApi ? 'WhatsApp API' : 'WhatsApp QR' };
  }
  return { key: conv.channel_type || 'otros', label: conv.channel_type || 'Otros' };
};

const ConversationAnalysis = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [items, setItems] = useState<AnalyzedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedConversation, setSelectedConversation] = useState<string>('all');
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [conversations, setConversations] = useState<ConvOption[]>([]);
  const [aggregate, setAggregate] = useState<{ pos: number; neg: number; sat: number; alta: number } | null>(null);

  const [detailItem, setDetailItem] = useState<AnalyzedItem | null>(null);
  const [detailMessages, setDetailMessages] = useState<MessageRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const filteredConversations = useMemo(() => {
    if (selectedChannel === 'all') return conversations;
    return conversations.filter((c) => getConversationGroup(c, connections).key === selectedChannel);
  }, [conversations, connections, selectedChannel]);

  const loadConnections = async (ownerId: string) => {
    const [w, t, tg] = await Promise.all([
      supabase.from('whatsapp_connections').select('id, name, phone_number, connection_subtype').eq('user_id', ownerId),
      supabase.from('twilio_connections').select('id, connection_name, phone_number').eq('user_id', ownerId),
      supabase.from('telegram_bots').select('id, bot_name, bot_username').eq('user_id', ownerId),
    ]);
    const loaded: ChannelConnection[] = [
      ...(((w.data || []) as WhatsAppConnectionRow[]).map((c) => ({
        id: c.id,
        label: `${c.connection_subtype === 'api' ? 'WA API' : 'WA QR'} · ${c.name || c.phone_number}`,
        phone_number: c.phone_number,
        subtype: c.connection_subtype,
        type: 'whatsapp' as const,
      }))),
      ...(((t.data || []) as TwilioConnectionRow[]).map((c) => ({
        id: c.id,
        label: `Twilio · ${c.connection_name || c.phone_number}`,
        phone_number: c.phone_number,
        type: 'twilio' as const,
      }))),
      ...(((tg.data || []) as TelegramBotRow[]).map((b) => ({
        id: b.id,
        label: `Telegram · ${b.bot_name || b.bot_username}`,
        phone_number: b.bot_username,
        type: 'telegram' as const,
      }))),
    ];
    setConnections(loaded);
    return loaded;
  };

  const loadConversations = async (ownerId: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('id, contact_name, phone_number, channel_type, whatsapp_number, twilio_connection_id, telegram_bot_id, updated_at')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(SOURCE_LIMIT);
    const list = (data || []) as ConvOption[];
    setConversations(list);
    return list;
  };

  const analyzeOne = async (conv: ConvOption, conns: ChannelConnection[], forceRefresh: boolean): Promise<AnalyzedItem> => {
    const group = getConversationGroup(conv, conns);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke('analyze-conversation', {
        body: { conversation_id: conv.id, force_refresh: forceRefresh },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (error) throw error;
      if (data?.error && !data?.analysis) throw new Error(data.user_message || data.error);
      return {
        conv,
        analysis: (data?.analysis ?? null) as Analysis | null,
        highlights: (data?.highlights ?? null) as Highlights | null,
        messageCount: data?.message_count || 0,
        groupKey: group.key,
        groupLabel: group.label,
        cached: !!data?.cached,
        warning: data?.warning,
      };
    } catch (e: unknown) {
      return {
        conv,
        analysis: null,
        highlights: null,
        messageCount: 0,
        groupKey: group.key,
        groupLabel: group.label,
        error: getErrorMessage(e) || 'No se pudo analizar',
      };
    }
  };

  const runAnalysis = async (forceRefresh = false) => {
    const ownerId = effectiveUserId || user?.id;
    if (!ownerId) return;
    setLoading(true);
    setItems([]);
    setAggregate(null);
    try {
      const conns = connections.length ? connections : await loadConnections(ownerId);
      const list = conversations.length ? conversations : await loadConversations(ownerId);

      let target: ConvOption[];
      if (selectedConversation !== 'all') {
        const found = list.find((c) => c.id === selectedConversation);
        target = found ? [found] : [];
      } else {
        target = list
          .filter((c) => selectedChannel === 'all' || getConversationGroup(c, conns).key === selectedChannel)
          .slice(0, BATCH_LIMIT);
      }

      if (target.length === 0) {
        toast.info('No hay conversaciones para analizar');
        setLoading(false);
        return;
      }

      const results = await Promise.all(target.map((c) => analyzeOne(c, conns, forceRefresh)));
      setItems(results);

      const valid = results.filter((r) => r.analysis) as (AnalyzedItem & { analysis: Analysis })[];
      if (valid.length > 0) {
        const sum = valid.reduce(
          (acc, r) => ({
            pos: acc.pos + (r.analysis.positivity || 0),
            neg: acc.neg + (r.analysis.negativity || 0),
            sat: acc.sat + (r.analysis.customer_satisfaction || 0),
            alta: acc.alta + (r.analysis.urgency === 'alta' ? 1 : 0),
          }),
          { pos: 0, neg: 0, sat: 0, alta: 0 }
        );
        setAggregate({
          pos: Math.round(sum.pos / valid.length),
          neg: Math.round(sum.neg / valid.length),
          sat: Math.round(sum.sat / valid.length),
          alta: sum.alta,
        });
      }
      const cachedCount = valid.filter((r) => r.cached).length;
      toast.success(
        `Análisis ${valid.length}/${results.length}` +
          (cachedCount ? ` · ${cachedCount} en caché` : '')
      );
    } catch (e: unknown) {
      toast.error('Error al analizar: ' + getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Initial load: connections + conversations
  useEffect(() => {
    const ownerId = effectiveUserId || user?.id;
    if (!ownerId) return;
    (async () => {
      await Promise.all([loadConnections(ownerId), loadConversations(ownerId)]);
    })();
  }, [user?.id, effectiveUserId]);

  // Re-run when filters change (use cache)
  useEffect(() => {
    if ((effectiveUserId || user?.id) && conversations.length > 0) runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, selectedConversation, conversations.length]);

  // Reset conv selection when channel changes
  useEffect(() => {
    setSelectedConversation('all');
  }, [selectedChannel]);

  const openDetail = async (it: AnalyzedItem) => {
    setDetailItem(it);
    setDetailMessages([]);
    setDetailLoading(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, content, direction, created_at')
        .eq('conversation_id', it.conv.id)
        .order('created_at', { ascending: true })
        .limit(200);
      setDetailMessages((data || []) as MessageRow[]);
    } finally {
      setDetailLoading(false);
    }
  };

  const detailRules = useMemo(() => buildRules(detailItem?.highlights ?? null), [detailItem]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, { label: string; items: AnalyzedItem[] }>();
    items.forEach((it) => {
      const existing = map.get(it.groupKey);
      if (existing) existing.items.push(it);
      else map.set(it.groupKey, { label: it.groupLabel || groupLabels[it.groupKey] || it.groupKey, items: [it] });
    });
    return Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [items]);

  const sentimentColor = (s?: string) =>
    s === 'positivo' ? 'bg-success text-success-foreground'
    : s === 'negativo' ? 'bg-destructive text-destructive-foreground'
    : 'bg-muted text-muted-foreground';

  const urgencyColor = (u?: string) =>
    u === 'alta' ? 'bg-destructive text-destructive-foreground'
    : u === 'media' ? 'bg-warning text-warning-foreground'
    : 'bg-success text-success-foreground';

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold">Análisis de Conversaciones con IA</h1>
            <p className="text-muted-foreground">Sentimiento, intención y recomendaciones · resultados cacheados por conversación</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-56">
            <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={loading}>
              <SelectTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Canal" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <div className="py-1.5 pl-8 pr-2 text-sm font-semibold text-muted-foreground">
                    Tipo de canal
                  </div>
                  {baseChannelOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="w-72">
            <Select value={selectedConversation} onValueChange={setSelectedConversation} disabled={loading}>
              <SelectTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Conversación" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <div className="py-1.5 pl-8 pr-2 text-sm font-semibold text-muted-foreground">
                    Conversación específica
                  </div>
                  <SelectItem value="all">Todas (top {BATCH_LIMIT})</SelectItem>
                  <SelectSeparator />
                  {filteredConversations.slice(0, 100).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contact_name || c.phone_number || c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => runAnalysis(false)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Cargar
          </Button>
          <Button onClick={() => runAnalysis(true)} disabled={loading} title="Vuelve a procesar con IA aunque haya caché">
            <Sparkles className="h-4 w-4 mr-2" /> Re-analizar IA
          </Button>
        </div>
      </div>

      {aggregate && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-success mb-2"><TrendingUp className="h-4 w-4" /> <span className="text-sm font-extrabold">Positividad</span></div>
            <div className="text-3xl font-extrabold text-success">{aggregate.pos}%</div>
            <Progress value={aggregate.pos} className="mt-2" />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-destructive mb-2"><TrendingDown className="h-4 w-4" /> <span className="text-sm font-extrabold">Negatividad</span></div>
            <div className="text-3xl font-extrabold text-destructive">{aggregate.neg}%</div>
            <Progress value={aggregate.neg} className="mt-2" />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><Heart className="h-4 w-4" /> <span className="text-sm font-extrabold">Satisfacción</span></div>
            <div className="text-3xl font-extrabold">{aggregate.sat}%</div>
            <Progress value={aggregate.sat} className="mt-2" />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-warning mb-2"><AlertCircle className="h-4 w-4" /> <span className="text-sm font-extrabold">Urgencia alta</span></div>
            <div className="text-3xl font-extrabold">{aggregate.alta}</div>
            <p className="text-xs text-muted-foreground mt-1">conversaciones requieren atención</p>
          </Card>
        </div>
      )}

      {loading && items.length === 0 && (
        <Card className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Analizando con IA...</p>
        </Card>
      )}

      {groupedItems.map(([key, group]) => (
        <div key={key} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold">{group.label}</h2>
            <Badge variant="secondary">{group.items.length}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {group.items.map((it) => {
              const { conv, analysis, messageCount, groupLabel, error, warning, cached } = it;
              return (
                <Card key={conv.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold">{conv.contact_name || conv.phone_number || conv.id.slice(0, 8)}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {groupLabel} · {messageCount} mensajes
                        {cached && <span className="inline-flex items-center gap-1 text-primary"><Database className="h-3 w-3" /> caché</span>}
                      </p>
                    </div>
                    {analysis && (
                      <div className="flex gap-2 flex-wrap justify-end">
                        <Badge className={sentimentColor(analysis.sentiment)}>{analysis.sentiment}</Badge>
                        <Badge className={urgencyColor(analysis.urgency)}>{analysis.urgency}</Badge>
                      </div>
                    )}
                  </div>

                  {warning && <p className="text-sm text-warning">{warning}</p>}
                  {error && <p className="text-sm text-destructive">{error}</p>}

                  {analysis && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex items-center gap-1 text-xs text-success font-extrabold mb-1"><TrendingUp className="h-3 w-3" /> Positividad {analysis.positivity}%</div>
                          <Progress value={analysis.positivity} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-xs text-destructive font-extrabold mb-1"><TrendingDown className="h-3 w-3" /> Negatividad {analysis.negativity}%</div>
                          <Progress value={analysis.negativity} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="font-extrabold capitalize">{analysis.intent}</span>
                        <Badge variant="outline" className="text-xs">{analysis.intent_confidence}%</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-3"><MessageCircle className="h-3 w-3 inline mr-1" />{analysis.summary}</p>

                      {Array.isArray(analysis.key_topics) && analysis.key_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {analysis.key_topics.slice(0, 5).map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}
                        </div>
                      )}

                      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 text-sm">
                        <p className="font-extrabold text-primary text-xs mb-1">Acción recomendada</p>
                        <p>{analysis.recommended_action}</p>
                      </div>

                      <Button size="sm" variant="outline" className="w-full" onClick={() => openDetail(it)}>
                        <Eye className="h-4 w-4 mr-2" /> Ver conversación resaltada
                      </Button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detailItem?.conv.contact_name || detailItem?.conv.phone_number || 'Conversación'}
            </DialogTitle>
            <DialogDescription>
              Frases resaltadas según el análisis IA: sentimiento, urgencia y tópicos detectados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/40 inline-block" /> Positivo</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/40 inline-block" /> Negativo</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/40 inline-block" /> Urgencia</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/30 inline-block" /> Tópico</span>
          </div>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            {detailLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : detailMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin mensajes.</p>
            ) : (
              <div className="space-y-2 py-2">
                {detailMessages.map((m) => {
                  const inbound = isInbound(m.direction);
                  return (
                    <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${inbound ? 'bg-muted' : 'bg-primary/10 border border-primary/20'}`}>
                        <p className="text-[10px] uppercase tracking-wide font-bold opacity-60 mb-1">
                          {inbound ? 'Cliente' : 'Agente'}
                        </p>
                        <p>{renderHighlighted(m.content || '', detailRules)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConversationAnalysis;
