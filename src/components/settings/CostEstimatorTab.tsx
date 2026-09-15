import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, TrendingDown, Loader2, RefreshCw, Plug } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DateRangeSelector } from '@/components/reports/DateRangeSelector';
import type { DateRange } from '@/services/reportsService';
import { CHANNEL_MESSAGE_COSTS } from '@/lib/channelCosts';
import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostEstimatorTabProps {
  userId: string;
}

const WHATSAPP_REFERENCE_COST = 0.0126;

const COSTS = {
  internal: CHANNEL_MESSAGE_COSTS.internal,
  twilio: CHANNEL_MESSAGE_COSTS.twilio,
  whatsappAverage: WHATSAPP_REFERENCE_COST,
  whatsappApi: CHANNEL_MESSAGE_COSTS.whatsappApi
};

const emptyChannelCounts = { twilio: 0, whatsappApi: 0, whatsappQr: 0 };

const createPresetRange = (preset: 'today' | '7days' | '30days' | 'thisMonth'): DateRange => {
  const now = new Date();
  if (preset === 'today') {
    return { startDate: startOfDay(now), endDate: endOfDay(now) };
  }
  if (preset === '7days') {
    return { startDate: startOfDay(subDays(now, 6)), endDate: endOfDay(now) };
  }
  if (preset === '30days') {
    return { startDate: startOfDay(subDays(now, 29)), endDate: endOfDay(now) };
  }
  return { startDate: startOfDay(startOfMonth(now)), endDate: endOfDay(now) };
};

const CostEstimatorTab: React.FC<CostEstimatorTabProps> = ({ userId }) => {
  const [messageCounts, setMessageCounts] = useState(emptyChannelCounts);
  const [isLoadingReal, setIsLoadingReal] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(() => createPresetRange('30days'));
  const { toast } = useToast();

  const countMessagesForConversations = async (conversationIds: string[]) => {
    if (conversationIds.length === 0) return 0;

    let total = 0;
    for (let index = 0; index < conversationIds.length; index += 500) {
      const batch = conversationIds.slice(index, index + 500);
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('conversation_id', batch)
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString());

      if (error) throw error;
      total += count || 0;
    }

    return total;
  };

  const fetchAllConvs = async <T extends { id: string }>(
    columns: string,
    apply: (q: any) => any
  ): Promise<T[]> => {
    const PAGE = 1000;
    const all: T[] = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = apply(
        supabase.from('conversations').select(columns).eq('user_id', userId).range(from, from + PAGE - 1)
      );
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as T[];
      all.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const loadRealMessageCount = async (showToast = false) => {
    setIsLoadingReal(true);
    try {
      const [twilioConversations, { data: allWhatsAppConnections, error: apiConnectionsError }, allWaConvs] = await Promise.all([
        fetchAllConvs<{ id: string }>('id', q => q.or('channel_type.eq.twilio,twilio_connection_id.not.is.null')),
        supabase
          .from('whatsapp_connections')
          .select('phone_number, connection_subtype')
          .eq('user_id', userId),
        fetchAllConvs<{ id: string; whatsapp_number: string | null }>('id, whatsapp_number', q => q.eq('channel_type', 'whatsapp')),
      ]);

      if (apiConnectionsError) throw apiConnectionsError;

      const apiSet = new Set(
        (allWhatsAppConnections || [])
          .filter(c => c.connection_subtype === 'api')
          .map(c => c.phone_number)
          .filter(Boolean) as string[]
      );

      // API conversations = whatsapp_number matches an API connection
      // QR conversations = everything else under channel_type='whatsapp' (incl. orphaned numbers)
      const apiConversationIds = allWaConvs.filter(c => c.whatsapp_number && apiSet.has(c.whatsapp_number)).map(c => c.id);
      const qrConversationIds = allWaConvs.filter(c => !c.whatsapp_number || !apiSet.has(c.whatsapp_number)).map(c => c.id);

      const [twilioCount, whatsappApiCount, whatsappQrCount] = await Promise.all([
        countMessagesForConversations(twilioConversations.map(c => c.id)),
        countMessagesForConversations(apiConversationIds),
        countMessagesForConversations(qrConversationIds)
      ]);

      setMessageCounts({ twilio: twilioCount, whatsappApi: whatsappApiCount, whatsappQr: whatsappQrCount });
      if (showToast) {
        toast({
          title: 'Datos actualizados',
          description: `Twilio: ${twilioCount.toLocaleString()} · API: ${whatsappApiCount.toLocaleString()} · QR: ${whatsappQrCount.toLocaleString()}`,
        });
      }
    } catch (error) {
      console.error('Error loading message count:', error);
      if (showToast) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos reales',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoadingReal(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadRealMessageCount(false);
    }
  }, [userId, dateRange.startDate, dateRange.endDate]);

  const handleRangeChange = (range: DateRange) => {
    setDateRange({ startDate: startOfDay(range.startDate), endDate: endOfDay(range.endDate) });
  };

  const totalMessageCount = messageCounts.twilio + messageCounts.whatsappApi + messageCounts.whatsappQr;
  const internalCost = totalMessageCount * COSTS.internal;
  const twilioCost = messageCounts.twilio * COSTS.twilio;
  const whatsappApiCost = messageCounts.whatsappApi * COSTS.whatsappApi;
  const whatsappQrCost = 0;

  const calculateSavings = (cost: number, count: number) => cost - (count * COSTS.internal);
  const calculateSavingsPercentage = (cost: number, count: number) => cost > 0 ? (calculateSavings(cost, count) / cost) * 100 : 0;

  const formatCurrency = (value: number) => `$${value.toFixed(2)} USD`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const rangeLabel = `${format(dateRange.startDate, 'dd MMM yyyy', { locale: es })} al ${format(dateRange.endDate, 'dd MMM yyyy', { locale: es })}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Estimador de Costos de Mensajería
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
            <Label>Rango de consumo</Label>
            <DateRangeSelector
              dateRange={dateRange}
              onRangeChange={handleRangeChange}
              onPresetSelect={(preset) => setDateRange(createPresetRange(preset))}
            />
            <p className="text-sm text-muted-foreground">
              Consumo del {rangeLabel}. Twilio: {messageCounts.twilio.toLocaleString()} · WhatsApp API: {messageCounts.whatsappApi.toLocaleString()} · WhatsApp QR: {messageCounts.whatsappQr.toLocaleString()} mensajes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="twilioMessageCount">Mensajes Twilio</Label>
              <Input
                id="twilioMessageCount"
                type="number"
                min={0}
                value={messageCounts.twilio}
                onChange={(e) => setMessageCounts(prev => ({ ...prev, twilio: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="Mensajes Twilio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappApiMessageCount">Mensajes WhatsApp API</Label>
              <Input
                id="whatsappApiMessageCount"
                type="number"
                min={0}
                value={messageCounts.whatsappApi}
                onChange={(e) => setMessageCounts(prev => ({ ...prev, whatsappApi: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="Mensajes WhatsApp API"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappQrMessageCount">Mensajes WhatsApp QR</Label>
              <Input
                id="whatsappQrMessageCount"
                type="number"
                min={0}
                value={messageCounts.whatsappQr}
                onChange={(e) => setMessageCounts(prev => ({ ...prev, whatsappQr: Math.max(0, parseInt(e.target.value) || 0) }))}
                placeholder="Mensajes WhatsApp QR"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => loadRealMessageCount(true)}
              disabled={isLoadingReal}
              className="flex items-center gap-2"
            >
              {isLoadingReal ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar datos
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Nuestro Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(internalCost)}</p>
            <p className="text-sm text-muted-foreground mt-1">Costo aproximado por {totalMessageCount.toLocaleString()} mensajes reales</p>
            <p className="text-xs text-muted-foreground mt-2">Tarifa referencial: ${COSTS.internal.toFixed(4)} USD por mensaje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Twilio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(twilioCost)}</p>
            <p className="text-sm text-muted-foreground">Costo real estimado por {messageCounts.twilio.toLocaleString()} mensajes Twilio</p>
            <p className="text-xs text-muted-foreground mt-2">Promedio real actualizado: $0.064 USD por mensaje</p>
          </CardContent>
        </Card>

        <Card className="border-accent/50 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plug className="h-5 w-5 text-accent-foreground" />
              WhatsApp API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(whatsappApiCost)}</p>
            <p className="text-sm text-muted-foreground">30% menos que Twilio · {messageCounts.whatsappApi.toLocaleString()} mensajes</p>
            <p className="text-xs text-muted-foreground mt-2">Tarifa referencial: ${COSTS.whatsappApi.toFixed(4)} USD por mensaje</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              WhatsApp QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(whatsappQrCost)}</p>
            <p className="text-sm text-muted-foreground">Sin costo externo · {messageCounts.whatsappQr.toLocaleString()} mensajes estimados</p>
            <p className="text-xs text-muted-foreground mt-2">Tarifa: $0.0000 USD por mensaje (conexión propia vía WAHA)</p>
          </CardContent>
        </Card>
      </div>

      {totalMessageCount > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <TrendingDown className="h-5 w-5" />
              Comparativa de Ahorro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground">vs Twilio</p>
                <p className="text-lg font-semibold text-primary">{formatPercentage(calculateSavingsPercentage(twilioCost, messageCounts.twilio))} ahorro</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(calculateSavings(twilioCost, messageCounts.twilio))}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-accent/40">
                <p className="text-sm text-muted-foreground">vs WhatsApp API</p>
                <p className="text-lg font-semibold text-primary">{formatPercentage(calculateSavingsPercentage(whatsappApiCost, messageCounts.whatsappApi))} ahorro</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(calculateSavings(whatsappApiCost, messageCounts.whatsappApi))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Los costos mostrados son aproximados y pueden variar según el volumen y tipo de mensajes.
      </p>
    </div>
  );
};

export default CostEstimatorTab;
