import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConsumptionAlertHistory } from '@/services/consumptionAlertsService';

interface ConsumptionAlertsPanelProps {
  alerts: ConsumptionAlertHistory[];
  isLoading?: boolean;
  onMarkRead: (id: string) => void;
}

const severityLabel = { info: 'Info', warning: 'Advertencia', critical: 'Crítica' } as const;

export const ConsumptionAlertsPanel: React.FC<ConsumptionAlertsPanelProps> = ({ alerts, isLoading, onMarkRead }) => {
  if (isLoading) return <Card><CardHeader><Skeleton className="h-6 w-56" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Alertas y recomendaciones</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4"><CheckCircle2 className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Sin alertas críticas recientes.</p></div>
        ) : alerts.slice(0, 5).map(alert => (
          <div key={alert.id} className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>{severityLabel[alert.severity]}</Badge>{!alert.is_read && <Badge variant="outline">Nueva</Badge>}</div>
                <p className="font-medium">{alert.title}</p>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
              {!alert.is_read && <Button variant="outline" size="sm" onClick={() => onMarkRead(alert.id)}>Marcar leída</Button>}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/40 p-3 text-sm"><Clock className="mt-0.5 h-4 w-4 text-primary" /><span>{alert.recommended_action}</span></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
