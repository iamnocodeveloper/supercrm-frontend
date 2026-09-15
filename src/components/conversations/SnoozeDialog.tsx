import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';
import { useConversationSnooze } from '@/hooks/useConversationSnooze';

interface Props {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const presets = [
  { label: '1 hora', mins: 60 },
  { label: '4 horas', mins: 240 },
  { label: 'Mañana 9 AM', mins: -1 },
  { label: 'En 3 días', mins: 60 * 24 * 3 },
];

const SnoozeDialog: React.FC<Props> = ({ conversationId, open, onOpenChange }) => {
  const { snooze } = useConversationSnooze();
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const applyPreset = async (mins: number) => {
    setSaving(true);
    try {
      let when: Date;
      if (mins === -1) {
        when = new Date();
        when.setDate(when.getDate() + 1);
        when.setHours(9, 0, 0, 0);
      } else {
        when = new Date(Date.now() + mins * 60_000);
      }
      await snooze(conversationId, when, reason || undefined);
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const applyCustom = async () => {
    if (!custom) return;
    setSaving(true);
    try {
      await snooze(conversationId, new Date(custom), reason || undefined);
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Posponer conversación</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Atajos</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {presets.map(p => (
                <Button key={p.label} variant="outline" size="sm" disabled={saving} onClick={() => applyPreset(p.mins)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="custom">Fecha y hora específica</Label>
            <Input id="custom" type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input id="reason" placeholder="Ej. Esperando comprobante" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!custom || saving} onClick={applyCustom}>Posponer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SnoozeDialog;
