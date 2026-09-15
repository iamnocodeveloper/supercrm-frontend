import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HourlyStats } from '@/services/reportsService';

interface HourlyDistributionChartProps {
  data: HourlyStats[];
  isLoading?: boolean;
}

export const HourlyDistributionChart: React.FC<HourlyDistributionChartProps> = ({ data, isLoading }) => {
  const formattedData = data.map(item => ({
    ...item,
    hourLabel: `${item.hour.toString().padStart(2, '0')}:00`
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribución por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted/20 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some(d => d.sent > 0 || d.received > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribución por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar en este período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📊 Distribución por Hora
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="hourLabel" 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                interval={2}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar
                dataKey="sent"
                name="Enviados"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="received"
                name="Recibidos"
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
