import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Result {
  message_id: string;
  conversation_id: string;
  content: string;
  direction: string;
  created_at: string;
  channel_type: string;
  contact_name: string | null;
  phone_number: string;
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export default function GlobalSearchModal({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState<string>('all');
  const [direction, setDirection] = useState<string>('all');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    if (query.length < 2) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('search_messages_global', {
        _query: query,
        _channel: channel === 'all' ? null : channel,
        _direction: direction === 'all' ? null : direction,
        _from: null,
        _to: null,
        _limit: 50,
        _offset: 0,
      });
      if (!error) setResults((data || []) as Result[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, channel, direction, open]);

  const highlight = (text: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text.slice(0, 200);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 80);
    const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    return snippet.split(new RegExp(`(${query})`, 'gi')).map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-primary/30">{part}</mark> : part,
    );
  };

  const goTo = (r: Result) => {
    onOpenChange(false);
    navigate(`/conversations?conversation=${r.conversation_id}&message=${r.message_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Búsqueda global de mensajes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input autoFocus placeholder="Buscar en todos los mensajes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los canales</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="webchat">Web Chat</SelectItem>
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda dirección</SelectItem>
                <SelectItem value="inbound">Entrantes</SelectItem>
                <SelectItem value="outbound">Salientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {!loading && results.length === 0 && query.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin resultados</p>
            )}
            {results.map((r) => (
              <button key={r.message_id} onClick={() => goTo(r)} className="w-full text-left rounded-lg border p-3 hover:bg-accent transition">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{r.contact_name || r.phone_number}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{r.channel_type}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{highlight(r.content || '')}</p>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
