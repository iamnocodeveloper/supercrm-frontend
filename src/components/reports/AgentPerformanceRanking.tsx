import React from 'react';
import { MessageSquareText, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentPerformanceStats } from '@/services/reportsService';

interface AgentPerformanceRankingProps {
  agents: AgentPerformanceStats[];
  isLoading?: boolean;
}

const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin actividad';
const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;

export const AgentPerformanceRanking: React.FC<AgentPerformanceRankingProps> = ({ agents, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
        <CardContent className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-16" />)}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Cajeros / Agentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay agentes con actividad en el período seleccionado.</p>
        ) : agents.slice(0, 8).map((agent, index) => (
          <div key={agent.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Badge variant={index === 0 ? 'default' : 'secondary'} className="shrink-0">#{index + 1}</Badge>
              <div className="min-w-0">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">Última actividad: {formatDate(agent.lastActivityAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-right text-sm md:grid-cols-7">
              <div><p className="font-semibold">{agent.messagesSent}</p><p className="text-xs text-muted-foreground">Mensajes</p></div>
              <div><p className="font-semibold">{agent.assignedConversations}</p><p className="text-xs text-muted-foreground">Asignadas</p></div>
              <div><p className="font-semibold text-primary">{agent.unreadAssigned}</p><p className="text-xs text-muted-foreground">Pendientes</p></div>
              <div><p className="font-semibold">{agent.closedConversations}</p><p className="text-xs text-muted-foreground">Cerradas</p></div>
              <div><p className="font-semibold">{agent.averageResponseMinutes.toFixed(0)}m</p><p className="text-xs text-muted-foreground">Respuesta</p></div>
              <div><p className="font-semibold text-primary">{formatCurrency(agent.estimatedTotalCost || 0)}</p><p className="text-xs text-muted-foreground">Costo</p></div>
              <div><p className="font-semibold text-primary">{agent.performanceScore}</p><p className="text-xs text-muted-foreground">Score</p></div>
            </div>
          </div>
        ))}
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><MessageSquareText className="h-4 w-4 text-primary" /> Mensajes salientes por agente</div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><Users className="h-4 w-4 text-primary" /> Control de conversaciones asignadas</div>
        </div>
      </CardContent>
    </Card>
  );
};