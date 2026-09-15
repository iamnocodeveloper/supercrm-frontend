import React from 'react';
import { WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentPerformanceStats } from '@/services/reportsService';

interface AgentCostPanelProps {
  agents: AgentPerformanceStats[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;

export const AgentCostPanel: React.FC<AgentCostPanelProps> = ({ agents, isLoading }) => {
  if (isLoading) return <Card><CardHeader><Skeleton className="h-6 w-64" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></CardContent></Card>;
  const total = agents.reduce((sum, agent) => sum + (agent.estimatedTotalCost || 0), 0);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" />Consumo y costos por cajero</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? <p className="text-sm text-muted-foreground">No hay consumo por agente en este período.</p> : agents.slice(0, 6).map(agent => (
          <div key={agent.id} className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{agent.name}</p><p className="text-xs text-muted-foreground">{agent.messagesSent} mensajes · {((agent.estimatedTotalCost || 0) / Math.max(total, 1) * 100).toFixed(1)}% del costo del equipo</p></div><Badge variant={(agent.recommendation || '').includes('exceso') ? 'destructive' : 'secondary'}>{formatCurrency(agent.estimatedTotalCost || 0)}</Badge></div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><span>Twilio: {agent.twilioMessages || 0}</span><span>API: {agent.whatsappApiMessages || 0}</span><span>Interno: {formatCurrency(agent.internalCost || 0)}</span><span>Ahorro: {formatCurrency(agent.estimatedSavings || 0)}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{agent.recommendation}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
