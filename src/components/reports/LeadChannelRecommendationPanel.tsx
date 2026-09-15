import React from 'react';
import { Route, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeadChannelRecommendation } from '@/services/channelRecommendationService';

interface LeadChannelRecommendationPanelProps {
  recommendations: LeadChannelRecommendation[];
  isLoading?: boolean;
}

const labels = { nuevo: 'Lead nuevo', caliente: 'Lead caliente', seguimiento: 'En seguimiento' } as const;
const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;

export const LeadChannelRecommendationPanel: React.FC<LeadChannelRecommendationPanelProps> = ({ recommendations, isLoading }) => {
  if (isLoading) return <Card><CardHeader><Skeleton className="h-6 w-72" /></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Route className="h-5 w-5 text-primary" />Canal recomendado por tipo de lead</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {recommendations.map(item => (
          <div key={item.leadType} className="rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><p className="font-medium">{labels[item.leadType]}</p><Badge>{item.recommendedChannel}</Badge></div>
            <p className="text-2xl font-bold">{item.count}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
            <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground"><Sparkles className="mb-1 h-4 w-4 text-primary" />Ahorro proyectado: <span className="font-medium text-foreground">{formatCurrency(item.projectedSavings)}</span></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
