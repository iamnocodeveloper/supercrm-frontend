import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Clock, Users, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailSend {
  id: string;
  email: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string | null;
  account_id: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  subject?: string;
  accountsMap?: Record<string, string>;
  onRefreshed?: () => void;
}

export function EmailCampaignDetailModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  subject,
  accountsMap = {},
  onRefreshed,
}: Props) {
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_campaign_sends')
      .select('id, email, status, error_message, sent_at, created_at, account_id')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    setSends((data as EmailSend[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && campaignId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, campaignId]);

  const stats = useMemo(
    () => ({
      total: sends.length,
      sent: sends.filter((s) => s.status === 'sent').length,
      failed: sends.filter((s) => s.status === 'failed').length,
      pending: sends.filter((s) => s.status === 'pending' || s.status === 'queued').length,
    }),
    [sends],
  );

  const filtered = sends.filter((s) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'sent') return s.status === 'sent';
    if (activeTab === 'failed') return s.status === 'failed';
    return s.status === 'pending' || s.status === 'queued';
  });

  const exportCsv = () => {
    const header = ['Email', 'Estado', 'Cuenta', 'Error', 'Fecha'];
    const rows = sends.map((s) => [
      s.email,
      s.status,
      (s.account_id && accountsMap[s.account_id]) || '',
      (s.error_message || '').replace(/"/g, "'"),
      s.sent_at || s.created_at || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaignName.replace(/[^\w\-]+/g, '_')}_envios.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    if (status === 'sent')
      return (
        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />Enviado
        </Badge>
      );
    if (status === 'failed')
      return (
        <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />Fallido
        </Badge>
      );
    return (
      <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
        <Clock className="h-3 w-3 mr-1" />Pendiente
      </Badge>
    );
  };

  const fmt = (d: string | null) => {
    if (!d) return '-';
    try {
      return format(new Date(d), 'dd/MM/yy HH:mm', { locale: es });
    } catch {
      return '-';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">Resumen de campaña: {campaignName}</DialogTitle>
          {subject && <p className="text-sm text-muted-foreground">Asunto: {subject}</p>}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  load();
                  onRefreshed?.();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />Actualizar
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={sends.length === 0}>
                <Download className="h-4 w-4 mr-2" />Exportar CSV
              </Button>
            </div>

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
                        <TableHead className="w-[220px]">Correo</TableHead>
                        <TableHead className="w-[110px]">Estado</TableHead>
                        <TableHead className="w-[180px]">Cuenta SMTP</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead className="w-[110px]">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No hay envíos en esta categoría
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium truncate max-w-[220px]">{s.email}</TableCell>
                            <TableCell>{statusBadge(s.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                              {(s.account_id && accountsMap[s.account_id]) || '-'}
                            </TableCell>
                            <TableCell
                              className="text-red-500 text-sm max-w-[220px] truncate"
                              title={s.error_message || undefined}
                            >
                              {s.error_message || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {fmt(s.sent_at || s.created_at)}
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

export default EmailCampaignDetailModal;
