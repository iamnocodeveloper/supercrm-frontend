import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, MessageCircleWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SystemHealthStats } from '@/services/reportsService';

interface SystemHealthCenterProps {
  stats?: SystemHealthStats;
  isLoading?: boolean;
}

const StatusRow = ({ label, active, total }: { label: string; active: number; total: number }) => {
  const ok = total === 0 || active > 0;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={ok ? 'secondary' : 'destructive'}>{active}/{total} activos</Badge>
    </div>
  );
};

export const SystemHealthCenter: React.FC<SystemHealthCenterProps> = ({ stats, isLoading }) => {
  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-52" /></CardHeader><CardContent><Skeleton className="h-44" /></CardContent></Card>;
  }

  if (!stats) return null;

  const lastMessage = stats.lastMessageAt ? new Date(stats.lastMessageAt).toLocaleString('es-ES') : 'Sin mensajes';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Centro de Salud del Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatusRow label="WhatsApp QR" active={stats.whatsappActive} total={stats.whatsappTotal} />
          <StatusRow label="WhatsApp API" active={stats.whatsappApiActive} total={stats.whatsappApiTotal} />
          <StatusRow label="Twilio" active={stats.twilioActive} total={stats.twilioTotal} />
          <StatusRow label="Telegram" active={stats.telegramActive} total={stats.telegramTotal} />
          <StatusRow label="WebChat" active={stats.webchatActive} total={stats.webchatTotal} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Conversaciones pendientes</p>
            <p className="mt-1 text-2xl font-bold text-primary">{stats.pendingConversations}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Asignadas offline</p>
            <p className="mt-1 text-2xl font-bold">{stats.offlineAssignedConversations}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Último mensaje</p>
            <p className="mt-1 text-sm font-medium">{lastMessage}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Errores de envío</p>
            <p className="mt-1 text-2xl font-bold">{stats.recentSendErrors}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">IA activa</p>
            <p className="mt-1 text-2xl font-bold">{stats.aiActive}/{stats.aiTotal}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Realtime</p>
            <p className="mt-1 text-sm font-medium">{stats.realtimeStatus}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-primary/5 p-3 text-sm">
          Canal recomendado operativo: <span className="font-semibold text-primary">{stats.recommendedChannel}</span>
        </div>

        {stats.pendingConversations > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <MessageCircleWarning className="h-4 w-4 text-primary" /> Hay conversaciones pendientes; usa el filtro “Sin responder” en Chats.
          </div>
        )}
      </CardContent>
    </Card>
  );
};