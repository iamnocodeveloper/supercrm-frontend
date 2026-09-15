import React from 'react';
import { AlertTriangle, ArrowRight, BadgeDollarSign, CircleDollarSign, TrendingDown, WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CHANNEL_MESSAGE_COSTS } from '@/lib/channelCosts';
import type { ChannelProfitabilityStats } from '@/services/reportsService';

interface ChannelProfitabilityPanelProps {
  stats?: ChannelProfitabilityStats;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;
const formatRate = (value: number) => `$${value.toFixed(4)}`;

export const ChannelProfitabilityPanel: React.FC<ChannelProfitabilityPanelProps> = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28" />)}
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const cards = [
    { title: 'Costo Twilio', value: formatCurrency(stats.twilioCost), detail: `${stats.twilioMessages.toLocaleString()} mensajes · ${formatRate(CHANNEL_MESSAGE_COSTS.twilio)}/msg`, icon: CircleDollarSign },
    { title: 'Costo WhatsApp API', value: formatCurrency(stats.whatsappApiCost), detail: `${stats.whatsappApiMessages.toLocaleString()} mensajes · ${formatRate(CHANNEL_MESSAGE_COSTS.whatsappApi)}/msg`, icon: WalletCards },
    { title: 'Nuestro Sistema', value: formatCurrency(stats.internalCost), detail: `${stats.totalMessages.toLocaleString()} mensajes · ${formatRate(CHANNEL_MESSAGE_COSTS.internal)}/msg`, icon: BadgeDollarSign },
    { title: 'Ahorro Total', value: formatCurrency(stats.totalSavings), detail: `${stats.savingsPercentage.toFixed(1)}% de ahorro`, icon: TrendingDown },
  ];

  const projectedTwilioCost = stats.totalMessages * CHANNEL_MESSAGE_COSTS.twilio;
  const projectedWhatsappApiCost = stats.totalMessages * CHANNEL_MESSAGE_COSTS.whatsappApi;
  const projectedMigrationSavings = Math.max(projectedTwilioCost - projectedWhatsappApiCost, 0);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Rentabilidad por Canal
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Más caro: {stats.mostExpensiveChannel}</Badge>
            <Badge>Recomendado: {stats.recommendedChannel}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-lg border bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{card.title}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              </div>
            );
          })}
        </div>

        {stats.twilioCost > 150 && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-foreground">
              Twilio lleva {formatCurrency(stats.twilioCost)}. Migrar tráfico a WhatsApp API mantiene una tarifa 30% menor.
            </p>
          </div>
        )}

        {stats.totalMessages > 0 && stats.savingsPercentage < 35 && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-foreground">El ahorro bajó a {stats.savingsPercentage.toFixed(1)}%; revisa tarifas o migra tráfico al canal recomendado.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">Canal más rentable: {stats.mostProfitableChannel}</p>
            <p className="text-sm text-muted-foreground">Día: {formatCurrency(stats.dailySavings)} · Semana: {formatCurrency(stats.weeklySavings)} · Mes proyectado: {formatCurrency(stats.monthlyProjectedSavings)}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            Twilio <ArrowRight className="h-4 w-4" /> WhatsApp API
          </div>
        </div>

        {stats.totalMessages > 0 && (
          <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Simulación todo por Twilio</p>
              <p className="text-lg font-semibold">{formatCurrency(projectedTwilioCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Simulación todo por WhatsApp API</p>
              <p className="text-lg font-semibold text-primary">{formatCurrency(projectedWhatsappApiCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ahorro potencial migrando</p>
              <p className="text-lg font-semibold text-primary">{formatCurrency(projectedMigrationSavings)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};