import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, Send, Edit, Trash2, MessageSquare, Clock, Eye, Pause, Play, RotateCcw, Copy } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { CampaignSendSummaryModal } from '@/components/campaigns/CampaignSendSummaryModal';

type Campaign = Database['public']['Tables']['mass_campaigns']['Row'];
type CampaignSend = Database['public']['Tables']['campaign_sends']['Row'];

export function MassCampaigns() {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingCampaign, setSendingCampaign] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, { queued: number; sent: number; failed: number; pending: number; total: number }>>({});
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('');

  useEffect(() => {
    if (effectiveUserId) {
      fetchCampaigns();
    }
  }, [effectiveUserId]);

  const fetchCampaigns = async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('mass_campaigns')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      await loadProgress(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las campañas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = useCallback(async (list: Campaign[]) => {
    const entries = await Promise.all(list.map(async (c) => {
      const { data } = await supabase
        .from('campaign_sends')
        .select('id, status')
        .eq('campaign_id', c.id);
      const queued = (data || []).filter(d => d.status === 'queued').length;
      const sent = (data || []).filter(d => d.status === 'sent').length;
      const failed = (data || []).filter(d => d.status === 'failed').length;
      const pending = (data || []).filter(d => d.status === 'pending').length;
      const total = queued + sent + failed + pending;
      return [c.id, { queued, sent, failed, pending, total }] as const;
    }));
    setProgressMap(Object.fromEntries(entries));
  }, []);

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta campaña?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('mass_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      toast({
        title: 'Éxito',
        description: 'Campaña eliminada correctamente',
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la campaña',
        variant: 'destructive',
      });
    }
  };

  const handleSendCampaign = async (campaign: Campaign) => {
    setSendingCampaign(campaign.id);
    
    try {
      // Iniciar el envío usando el edge function local
      const { data, error } = await supabase.functions.invoke('send-mass-campaign', {
        body: { campaign_id: campaign.id }
      });

      if (error) throw error;

      // Actualizar el estado local
      setCampaigns(campaigns.map(c => 
        c.id === campaign.id ? { ...c, status: 'sending' } : c
      ));

      toast({
        title: 'Éxito',
        description: `Campaña encolada: ${data.enqueued_count}/${data.total_count}`,
      });

      // Recargar campañas para obtener el estado actualizado
      setTimeout(() => {
        fetchCampaigns();
      }, 1000);

    } catch (error) {
      console.error('Error sending campaign:', error);
      
      const { error: revertError } = await supabase
        .from('mass_campaigns')
        .update({ status: 'ready' })
        .eq('id', campaign.id);

      if (!revertError) {
        setCampaigns(campaigns.map(c => 
          c.id === campaign.id ? { ...c, status: 'ready' } : c
        ));
      }

      toast({
        title: 'Error',
        description: 'No se pudo enviar la campaña',
        variant: 'destructive',
      });
    } finally {
      setSendingCampaign(null);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from('mass_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId);

      if (error) throw error;

      setCampaigns(campaigns.map(c => 
        c.id === campaignId ? { ...c, status: 'paused' } : c
      ));

      toast({
        title: 'Campaña pausada',
        description: 'La campaña ha sido pausada',
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo pausar la campaña',
        variant: 'destructive',
      });
    }
  };

  const handleResumeCampaign = async (campaign: Campaign) => {
    setSendingCampaign(campaign.id);
    
    try {
      // Reanudar envío
      const { data, error } = await supabase.functions.invoke('send-mass-campaign', {
        body: { campaign_id: campaign.id }
      });

      if (error) throw error;

      setCampaigns(campaigns.map(c => 
        c.id === campaign.id ? { ...c, status: 'sending' } : c
      ));

      toast({
        title: 'Campaña reanudada',
        description: 'La campaña se está enviando nuevamente',
      });

      setTimeout(() => fetchCampaigns(), 1000);
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reanudar la campaña',
        variant: 'destructive',
      });
    } finally {
      setSendingCampaign(null);
    }
  };

  const handleRetryCampaign = async (campaign: Campaign) => {
    if (!confirm('¿Reintentar enviar a los contactos que fallaron?')) return;
    
    setSendingCampaign(campaign.id);
    
    try {
      // Marcar campaña como sending y reintentar
      await supabase
        .from('mass_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id);

      const { data, error } = await supabase.functions.invoke('send-mass-campaign', {
        body: { campaign_id: campaign.id, retry_failed: true }
      });

      if (error) throw error;

      toast({
        title: 'Reintentando envío',
        description: 'Se están reenviando los mensajes fallidos',
      });

      setTimeout(() => fetchCampaigns(), 1000);
    } catch (error) {
      console.error('Error retrying campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reintentar la campaña',
        variant: 'destructive',
      });
    } finally {
      setSendingCampaign(null);
    }
  };

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    try {
      const { id, created_at, updated_at, sent_count, total_count, status, ...campaignData } = campaign;
      
      const { data: newCampaign, error } = await supabase
        .from('mass_campaigns')
        .insert({
          ...campaignData,
          name: `Copia de ${campaign.name}`,
          status: 'draft',
          sent_count: 0,
          total_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Campaña duplicada',
        description: 'Se creó una copia de la campaña',
      });
      
      navigate(`/crear-campana-masiva/${newCampaign.id}`);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo duplicar la campaña',
        variant: 'destructive',
      });
    }
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Suscripción realtime para actualizar progreso en tiempo real
  useEffect(() => {
    const sendingCampaignIds = campaigns
      .filter(c => c.status === 'sending')
      .map(c => c.id);
    
    if (sendingCampaignIds.length === 0) return;
    
    const channel = supabase
      .channel('campaign-sends-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_sends'
        },
        (payload) => {
          const record = payload.new as CampaignSend | undefined;
          const campaignId = record?.campaign_id;
          
          if (campaignId && sendingCampaignIds.includes(campaignId)) {
            // Actualizar progreso para esa campaña específica
            setProgressMap(prev => {
              const current = prev[campaignId] || { queued: 0, sent: 0, failed: 0, pending: 0, total: 0 };
              const status = record?.status;
              
              if (payload.eventType === 'INSERT') {
                return {
                  ...prev,
                  [campaignId]: {
                    ...current,
                    pending: current.pending + 1,
                    total: current.total + 1
                  }
                };
              } else if (payload.eventType === 'UPDATE' && status) {
                // Recalcular basado en el nuevo estado
                const oldRecord = payload.old as CampaignSend | undefined;
                const oldStatus = oldRecord?.status || 'pending';
                
                const newProgress = { ...current };
                
                // Decrementar el contador del estado anterior
                if (oldStatus === 'sent') newProgress.sent = Math.max(0, newProgress.sent - 1);
                else if (oldStatus === 'failed') newProgress.failed = Math.max(0, newProgress.failed - 1);
                else if (oldStatus === 'queued') newProgress.queued = Math.max(0, newProgress.queued - 1);
                else if (oldStatus === 'pending') newProgress.pending = Math.max(0, newProgress.pending - 1);
                
                // Incrementar el contador del nuevo estado
                if (status === 'sent') newProgress.sent++;
                else if (status === 'failed') newProgress.failed++;
                else if (status === 'queued') newProgress.queued++;
                else if (status === 'pending') newProgress.pending++;
                
                return { ...prev, [campaignId]: newProgress };
              }
              
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaigns]);

  // Polling de respaldo cada 10 segundos para campañas en envío
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending');
    if (!hasSending) return;
    const interval = setInterval(() => {
      fetchCampaigns();
    }, 10000);
    return () => clearInterval(interval);
  }, [campaigns]);

  const getStatusBadge = (status: string, updatedAt?: string | null) => {
    // Check if campaign is stuck in "sending" for more than 10 minutes
    const isStuck = status === 'sending' && updatedAt && 
      (Date.now() - new Date(updatedAt).getTime()) > 10 * 60 * 1000;
    
    const statusConfig = {
      draft: { label: 'Borrador', variant: 'secondary' as const },
      ready: { label: 'Lista', variant: 'default' as const },
      sending: { label: isStuck ? '⚠️ Atascada' : 'Enviando...', variant: isStuck ? 'destructive' as const : 'default' as const },
      paused: { label: '⏸️ Pausada', variant: 'secondary' as const },
      sent: { label: 'Enviada', variant: 'default' as const },
      completed: { label: 'Completada', variant: 'default' as const },
      partial: { label: 'Parcial', variant: 'secondary' as const },
      failed: { label: 'Fallida', variant: 'destructive' as const },
      error: { label: 'Error', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campañas Masivas</h1>
            <p className="text-muted-foreground mt-1">Gestiona tus campañas de mensajería</p>
          </div>
          <Button 
            onClick={() => navigate('/crear-campana-masiva')}
            className="bg-gradient-to-r from-primary to-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Campaña
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar campañas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {filteredCampaigns.length === 0 ? (
          <Card className="bg-gradient-to-br from-card to-card/80 border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm ? 'No se encontraron campañas' : 'No tienes campañas aún'}
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Crea tu primera campaña masiva para comenzar'
                }
              </p>
              {!searchTerm && (
                <Button 
                  onClick={() => navigate('/crear-campana-masiva')}
                  className="bg-gradient-to-r from-primary to-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <Card key={campaign.id} className="bg-gradient-to-br from-card to-card/80 border-l-4 border-l-primary hover:shadow-lg transition-shadow rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-foreground mb-1">
                        {campaign.name}
                      </CardTitle>
                      {campaign.description && (
                        <CardDescription className="text-sm text-muted-foreground">
                          {campaign.description}
                        </CardDescription>
                      )}
                    </div>
                    {getStatusBadge(campaign.status || 'draft', campaign.updated_at)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview del mensaje */}
                  {campaign.message && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {campaign.message}
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {campaign.whatsapp_connection_name || campaign.channel_type || 'Sin conexión'}
                      </span>
                    </div>
                    
                    {/* Mostrar información del lote durante el envío */}
                    {campaign.status === 'sending' && progressMap[campaign.id] && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        📦 Lote {Math.ceil((progressMap[campaign.id].sent + progressMap[campaign.id].failed + 1) / 200)} de {Math.ceil((campaign.total_count || progressMap[campaign.id].total || 1) / 200)}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        Delay: {campaign.min_delay}s - {campaign.max_delay}s
                      </span>
                    </div>
                    {campaign.edit_with_ai && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary">✨ Con IA</span>
                      </div>
                    )}
                    
                    {/* Progress Bar Visual */}
                    {(() => {
                      const progress = progressMap[campaign.id];
                      const sent = progress?.sent || 0;
                      const failed = progress?.failed || 0;
                      const pending = (progress?.pending || 0) + (progress?.queued || 0);
                      const total = progress?.total || sent + failed + pending || campaign.total_count || 1;
                      
                      const sentPercent = (sent / total) * 100;
                      const failedPercent = (failed / total) * 100;
                      const pendingPercent = (pending / total) * 100;
                      const isSending = campaign.status === 'sending';
                      
                      return (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-xs">
                            <span className={isSending ? "text-primary font-medium" : "text-muted-foreground"}>
                              {isSending ? '📤 Enviando...' : 'Progreso'}
                            </span>
                            <span className="font-bold text-foreground">
                              {sent}/{total}
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-green-500 transition-all duration-150" 
                              style={{ width: `${sentPercent}%` }} 
                            />
                            <div 
                              className="h-full bg-red-500 transition-all duration-150" 
                              style={{ width: `${failedPercent}%` }} 
                            />
                            <div 
                              className="h-full bg-yellow-500 transition-all duration-150" 
                              style={{ width: `${pendingPercent}%` }} 
                            />
                          </div>
                          {isSending && pending > 0 ? (
                            <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Enviando mensaje {sent + 1} de {total}...</span>
                            </div>
                          ) : (
                            <div className="flex justify-between text-xs">
                              <span className="text-green-500">✓ {sent}</span>
                              <span className="text-red-500">✗ {failed}</span>
                              <span className="text-yellow-500">⏳ {pending}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/crear-campana-masiva/${campaign.id}`)}
                      className="flex-1 border-border hover:bg-muted"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setSelectedCampaignName(campaign.name);
                      }}
                      className="border-border hover:bg-muted"
                      title="Ver detalles de envío"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateCampaign(campaign)}
                      className="border-border hover:bg-muted"
                      title="Duplicar campaña"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="border-border hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Botones de acción según estado */}
                  <div className="space-y-2">
                    {/* Pausar - solo si está enviando */}
                    {campaign.status === 'sending' && (
                      <Button
                        variant="outline"
                        onClick={() => handlePauseCampaign(campaign.id)}
                        className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pausar Campaña
                      </Button>
                    )}

                    {/* Reanudar - si está pausada */}
                    {campaign.status === 'paused' && (
                      <Button
                        onClick={() => handleResumeCampaign(campaign)}
                        disabled={sendingCampaign === campaign.id}
                        className="w-full bg-gradient-to-r from-green-600 to-green-500"
                      >
                        {sendingCampaign === campaign.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Reanudar Campaña
                      </Button>
                    )}

                    {/* Reintentar fallidos - si completada con errores */}
                    {(campaign.status === 'completed' || campaign.status === 'sent' || campaign.status === 'partial') && 
                     progressMap[campaign.id]?.failed > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => handleRetryCampaign(campaign)}
                        disabled={sendingCampaign === campaign.id}
                        className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                      >
                        {sendingCampaign === campaign.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        Reintentar Fallidos ({progressMap[campaign.id]?.failed})
                      </Button>
                    )}

                    {/* Enviar - si no está enviada ni enviando */}
                    {campaign.status !== 'sent' && campaign.status !== 'completed' && 
                     campaign.status !== 'sending' && campaign.status !== 'paused' && (
                      <Button
                        onClick={() => handleSendCampaign(campaign)}
                        disabled={sendingCampaign === campaign.id}
                        className="w-full bg-gradient-to-r from-primary to-primary/90"
                      >
                        {sendingCampaign === campaign.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar Campaña
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de resumen */}
      <CampaignSendSummaryModal
        isOpen={!!selectedCampaignId}
        onClose={() => setSelectedCampaignId(null)}
        campaignId={selectedCampaignId || ''}
        campaignName={selectedCampaignName}
      />
    </div>
  );
}

export default MassCampaigns;
