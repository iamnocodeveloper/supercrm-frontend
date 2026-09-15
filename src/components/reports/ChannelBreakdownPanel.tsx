import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { getChannelMessageBreakdown, type ChannelBreakdownItem, type DateRange } from '@/services/reportsService';

interface Props {
  userId: string;
  dateRange: DateRange;
}

type DirectionFilter = 'all' | 'sent' | 'received';

const CHANNEL_COLOR: Record<ChannelBreakdownItem['key'], string> = {
  whatsapp_qr: 'text-emerald-500',
  whatsapp_api: 'text-green-600',
  twilio: 'text-red-500',
  telegram: 'text-sky-500',
  webchat: 'text-purple-500',
};

export const ChannelBreakdownPanel: React.FC<Props> = ({ userId, dateRange }) => {
  const [direction, setDirection] = useState<DirectionFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['report-channel-breakdown', userId, dateRange.startDate.toISOString(), dateRange.endDate.toISOString()],
    queryFn: () => getChannelMessageBreakdown(userId, dateRange),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });

  const items = data || [];
  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);
  const grandSent = useMemo(() => items.reduce((s, i) => s + i.sent, 0), [items]);
  const grandReceived = useMemo(() => items.reduce((s, i) => s + i.received, 0), [items]);

  const valueFor = (item: ChannelBreakdownItem) =>
    direction === 'sent' ? item.sent : direction === 'received' ? item.received : item.total;
  const referenceTotal = direction === 'sent' ? grandSent : direction === 'received' ? grandReceived : grandTotal;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Desglose de mensajes por canal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(['all', 'sent', 'received'] as DirectionFilter[]).map(d => (
              <Button
                key={d}
                variant={direction === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDirection(d)}
                className="h-7 text-xs"
              >
                {d === 'all' ? 'Todos' : d === 'sent' ? 'Enviados' : 'Recibidos'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total mensajes</p>
                <p className="text-xl font-bold">{grandTotal.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Enviados</p>
                <p className="text-xl font-bold text-blue-500">{grandSent.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Recibidos</p>
                <p className="text-xl font-bold text-emerald-500">{grandReceived.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              {items
                .slice()
                .sort((a, b) => valueFor(b) - valueFor(a))
                .map(item => {
                  const value = valueFor(item);
                  const pct = referenceTotal > 0 ? (value / referenceTotal) * 100 : 0;
                  return (
                    <div key={item.key} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-medium ${CHANNEL_COLOR[item.key]}`}>{item.label}</span>
                          <Badge variant="secondary" className="text-xs">{item.conversations} chats</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">↑ {item.sent.toLocaleString()}</span>
                          <span className="text-muted-foreground">↓ {item.received.toLocaleString()}</span>
                          <span className="font-bold tabular-nums">{value.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
