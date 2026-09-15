import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Copy, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIAssistPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onUseDraft: (text: string) => void;
}

interface AssistResult {
  summary?: string;
  intent?: string;
  urgency?: 'baja' | 'media' | 'alta';
  detected_language?: string;
  next_action?: string;
  draft_replies?: { tone: string; text: string }[];
  cached?: boolean;
}

const urgencyColors: Record<string, string> = {
  alta: 'bg-destructive text-destructive-foreground',
  media: 'bg-yellow-500 text-white',
  baja: 'bg-emerald-500 text-white',
};

export default function AIAssistPanel({ open, onOpenChange, conversationId, onUseDraft }: AIAssistPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AssistResult | null>(null);

  const fetchAssist = async (force = false) => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('conversation-ai-assist', {
        body: { conversation_id: conversationId, mode: 'assist', force_refresh: force },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.user_message || res.error);
      setData(res);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo generar la asistencia');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && conversationId) fetchAssist(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Asistencia IA
          </SheetTitle>
          <SheetDescription>Resumen y borradores generados con IA</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button variant="outline" size="sm" onClick={() => fetchAssist(true)} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Regenerar análisis
          </Button>

          {loading && !data && (
            <div className="text-sm text-muted-foreground text-center py-8">Analizando conversación…</div>
          )}

          {data && (
            <>
              <section className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {data.urgency && <Badge className={urgencyColors[data.urgency]}>{data.urgency.toUpperCase()}</Badge>}
                  {data.intent && <Badge variant="secondary">{data.intent}</Badge>}
                  {data.detected_language && <Badge variant="outline">🌐 {data.detected_language}</Badge>}
                </div>
                <p className="text-sm">{data.summary}</p>
                {data.next_action && (
                  <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    <strong>Próxima acción:</strong> {data.next_action}
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Borradores de respuesta</h4>
                {(data.draft_replies || []).map((d, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <Badge variant="outline" className="capitalize">{d.tone}</Badge>
                    <p className="text-sm whitespace-pre-wrap">{d.text}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { onUseDraft(d.text); onOpenChange(false); }}>
                        <Send className="h-3 w-3 mr-1" /> Usar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { navigator.clipboard.writeText(d.text); toast.success('Copiado'); }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
