import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CHANNEL_MESSAGE_COSTS, formatUsd } from '@/lib/channelCosts';

interface CampaignSend {
  id: string;
  phone_number: string;
  contact_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
  message_sent: string;
}

interface CampaignSendSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

export function CampaignSendSummaryModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
}: CampaignSendSummaryModalProps) {
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (isOpen && campaignId) {
      loadCampaignSends();
    }
  }, [isOpen, campaignId]);

  const loadCampaignSends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSends(data || []);
    } catch (error) {
      console.error('Error loading campaign sends:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: sends.length,
    sent: sends.filter((s) => s.status === 'sent').length,
    failed: sends.filter((s) => s.status === 'failed').length,
    pending: sends.filter((s) => s.status === 'pending' || s.status === 'queued').length,
  };
  const estimatedRealCost = stats.sent * CHANNEL_MESSAGE_COSTS.internal;
  const estimatedTwilioCost = stats.sent * CHANNEL_MESSAGE_COSTS.twilio;
  const estimatedSavings = Math.max(estimatedTwilioCost - estimatedRealCost, 0);

  const filteredSends = sends.filter((send) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'sent') return send.status === 'sent';
    if (activeTab === 'failed') return send.status === 'failed';
    if (activeTab === 'pending') return send.status === 'pending' || send.status === 'queued';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviado
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Fallido
          </Badge>
        );
      case 'pending':
      case 'queued':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yy HH:mm', { locale: es });
    } catch {
      return '-';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Resumen de Campaña: {campaignName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold text-green-500">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Costo real estimado</p><p className="text-lg font-bold text-foreground">{formatUsd(estimatedRealCost)}</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Costo si fuera Twilio</p><p className="text-lg font-bold text-foreground">{formatUsd(estimatedTwilioCost)}</p></div>
              <div className="bg-primary/10 rounded-lg p-3"><p className="text-xs text-muted-foreground">Ahorro estimado</p><p className="text-lg font-bold text-primary">{formatUsd(estimatedSavings)}</p></div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
                <TabsTrigger value="sent">Enviados ({stats.sent})</TabsTrigger>
                <TabsTrigger value="failed">Fallidos ({stats.failed})</TabsTrigger>
                <TabsTrigger value="pending">Pendientes ({stats.pending})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Contacto</TableHead>
                        <TableHead className="w-[140px]">Teléfono</TableHead>
                        <TableHead className="w-[100px]">Estado</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead className="w-[110px]">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSends.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No hay envíos en esta categoría
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSends.map((send) => (
                          <TableRow key={send.id}>
                            <TableCell className="font-medium">
                              {send.contact_name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {send.phone_number}
                            </TableCell>
                            <TableCell>{getStatusBadge(send.status)}</TableCell>
                            <TableCell className="text-red-500 text-sm max-w-[200px] truncate" title={send.error_message || undefined}>
                              {send.error_message || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(send.sent_at || send.created_at)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CampaignSendSummaryModal;
