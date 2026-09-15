import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  icon: LucideIcon;
  gradient?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  gradient = false
}) => {
  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
      gradient && "bg-gradient-primary text-white border-0 shadow-glow"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className={cn(
          "text-sm font-medium flex items-center justify-between",
          gradient ? "text-white/90" : "text-muted-foreground"
        )}>
          {title}
          <Icon className={cn(
            "h-5 w-5",
            gradient ? "text-white/80" : "text-muted-foreground"
          )} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={cn(
            "text-2xl font-bold",
            gradient ? "text-white" : "text-foreground"
          )}>
            {value}
          </div>
          
          {change && (
            <div className="flex items-center text-sm">
              <span className={cn(
                "flex items-center font-medium",
                change.trend === 'up' 
                  ? (gradient ? "text-green-200" : "text-success") 
                  : (gradient ? "text-red-200" : "text-destructive")
              )}>
                {change.trend === 'up' ? '↗' : '↘'} {Math.abs(change.value)}%
              </span>
              <span className={cn(
                "ml-1",
                gradient ? "text-white/70" : "text-muted-foreground"
              )}>
                vs mes anterior
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};