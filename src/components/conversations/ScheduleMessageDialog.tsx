import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, X } from 'lucide-react';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { useToast } from '@/hooks/use-toast';

interface Props {
  conversationId: string;
  channelType: string;
  whatsappSessionName?: string | null;
  whatsappConnectionId?: string | null;
  twilioConnectionId?: string | null;
  telegramBotId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ScheduleMessageDialog: React.FC<Props> = ({
  conversationId, channelType, whatsappSessionName, whatsappConnectionId,
  twilioConnectionId, telegramBotId, open, onOpenChange,
}) => {
  const { messages, schedule, cancel, loading } = useScheduledMessages(conversationId);
  const [content, setContent] = useState('');
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSchedule = async () => {
    if (!content.trim() || !when) return;
    const scheduledFor = new Date(when);
    if (scheduledFor.getTime() < Date.now() + 30_000) {
      toast({ title: 'Fecha inválida', description: 'Debe ser al menos 30 segundos en el futuro', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await schedule({
        conversation_id: conversationId,
        content: content.trim(),
        scheduled_for: scheduledFor.toISOString(),
        channel_type: channelType,
        whatsapp_session_name: whatsappSessionName ?? null,
        whatsapp_connection_id: whatsappConnectionId ?? null,
        twilio_connection_id: twilioConnectionId ?? null,
        telegram_bot_id: telegramBotId ?? null,
      });
      toast({ title: '📅 Mensaje programado', description: `Se enviará el ${scheduledFor.toLocaleString('es-AR')}` });
      setContent('');
      setWhen('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Programar mensaje</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="msg">Mensaje</Label>
            <Textarea id="msg" rows={3} placeholder="Escribe el mensaje a enviar..." value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="when">Fecha y hora</Label>
            <Input id="when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </div>
        </div>

        {messages.length > 0 && (
          <div className="border-t border-border pt-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Programados ({messages.length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {messages.map(m => (
                <div key={m.id} className="flex items-start justify-between gap-2 p-2 bg-muted rounded-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.scheduled_for).toLocaleString('es-AR')}
                      {m.status === 'failed' && <span className="ml-2 text-destructive">⚠ Falló</span>}
                    </p>
                    <p className="text-sm truncate">{m.content}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => cancel(m.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button disabled={!content.trim() || !when || saving} onClick={handleSchedule}>
            {saving ? 'Programando...' : 'Programar envío'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMessageDialog;
