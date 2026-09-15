import React from 'react';
import { Send, MessageCircle, Users, Clock, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SessionStats } from '@/services/reportsService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface StatsCardsProps {
  stats: SessionStats | undefined;
  isLoading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLoading }) => {
  const cards = [
    {
      title: 'Mensajes Enviados',
      value: stats?.totalSent || 0,
      change: stats?.sentChange || 0,
      icon: Send,
      color: 'text-blue-500'
    },
    {
      title: 'Mensajes Recibidos',
      value: stats?.totalReceived || 0,
      change: stats?.receivedChange || 0,
      icon: MessageCircle,
      color: 'text-green-500'
    },
    {
      title: 'Conversaciones',
      value: stats?.totalConversations || 0,
      icon: Users,
      color: 'text-purple-500'
    },
    {
      title: 'Conversaciones Nuevas',
      value: stats?.newConversationsInPeriod || 0,
      change: stats?.newConversationsChange || 0,
      icon: UserPlus,
      color: 'text-cyan-500'
    },
    {
      title: 'Último Mensaje',
      value: stats?.lastMessageAt 
        ? formatDistanceToNow(new Date(stats.lastMessageAt), { addSuffix: true, locale: es })
        : 'Sin actividad',
      icon: Clock,
      color: 'text-orange-500',
      isText: true
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-24 mb-2" />
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="bg-card border-border hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "font-bold",
                  card.isText ? "text-lg" : "text-2xl"
                )}>
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </span>
                {card.change !== undefined && card.change !== 0 && (
                  <span className={cn(
                    "text-xs font-medium",
                    card.change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  )}>
                    {card.change > 0 ? '+' : ''}{card.change}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
