import React, { useEffect, useState } from 'react';
import { AlertTriangle, Save, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useConsumptionAlerts } from '@/hooks/useConsumptionAlerts';
import type { AlertSeverity, ConsumptionAlertSettings } from '@/services/consumptionAlertsService';

const numberFields: Array<keyof Pick<ConsumptionAlertSettings, 'twilio_monthly_cost_threshold' | 'twilio_monthly_message_threshold' | 'whatsapp_api_unusual_growth_percent' | 'agent_monthly_message_threshold' | 'minimum_savings_percent'>> = [
  'twilio_monthly_cost_threshold',
  'twilio_monthly_message_threshold',
  'whatsapp_api_unusual_growth_percent',
  'agent_monthly_message_threshold',
  'minimum_savings_percent'
];

export const ConsumptionAlertsTab: React.FC = () => {
  const { toast } = useToast();
  const { settings, isLoading, saveSettings, isSaving } = useConsumptionAlerts();
  const [form, setForm] = useState<ConsumptionAlertSettings | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const updateField = <K extends keyof ConsumptionAlertSettings>(field: K, value: ConsumptionAlertSettings[K]) => {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSave = async () => {
    if (!form) return;
    const normalized = numberFields.reduce((acc, field) => ({ ...acc, [field]: Number(acc[field]) || 0 }), form);
    await saveSettings(normalized);
    toast({ title: 'Alertas actualizadas', description: 'Los umbrales de consumo quedaron guardados.' });
  };

  if (isLoading || !form) {
    return <Card><CardHeader><Skeleton className="h-6 w-64" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" />Alertas de consumo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2"><Label>Twilio costo mensual máximo</Label><Input type="number" min="0" value={form.twilio_monthly_cost_threshold} onChange={e => updateField('twilio_monthly_cost_threshold', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Twilio mensajes mensuales máximos</Label><Input type="number" min="0" value={form.twilio_monthly_message_threshold} onChange={e => updateField('twilio_monthly_message_threshold', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>WhatsApp API crecimiento inusual (%)</Label><Input type="number" min="0" value={form.whatsapp_api_unusual_growth_percent} onChange={e => updateField('whatsapp_api_unusual_growth_percent', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Mensajes máximos por cajero</Label><Input type="number" min="0" value={form.agent_monthly_message_threshold} onChange={e => updateField('agent_monthly_message_threshold', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Ahorro mínimo esperado (%)</Label><Input type="number" min="0" max="100" value={form.minimum_savings_percent} onChange={e => updateField('minimum_savings_percent', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Severidad por defecto</Label><Select value={form.default_severity} onValueChange={(value: AlertSeverity) => updateField('default_severity', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Informativa</SelectItem><SelectItem value="warning">Advertencia</SelectItem><SelectItem value="critical">Crítica</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Activación de alertas</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            ['enable_twilio_cost_alert', 'Costo y mensajes de Twilio'],
            ['enable_whatsapp_api_unusual_alert', 'Consumo inusual WhatsApp API'],
            ['enable_agent_volume_alert', 'Cajeros con exceso de mensajes'],
            ['enable_low_savings_alert', 'Ahorro por debajo del objetivo']
          ].map(([field, label]) => (
            <div key={field} className="flex items-center justify-between rounded-lg border bg-background p-4">
              <Label htmlFor={field}>{label}</Label>
              <Switch id={field} checked={Boolean(form[field as keyof ConsumptionAlertSettings])} onCheckedChange={checked => updateField(field as keyof ConsumptionAlertSettings, checked as never)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto"><Save className="mr-2 h-4 w-4" />{isSaving ? 'Guardando...' : 'Guardar umbrales'}</Button>
    </div>
  );
};

export default ConsumptionAlertsTab;
