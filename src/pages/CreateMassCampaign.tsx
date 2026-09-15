import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, Smile, Clock, Plus, Upload, X, Mic, FileAudio, Play, Pause, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { useTelegramConnections } from '@/hooks/useTelegramConnections';
import { useTwilioConnections } from '@/hooks/useTwilioConnections';
import { useTwilioUsage } from '@/hooks/useTwilioUsage';
import { CHANNEL_MESSAGE_COSTS, formatUsd, getRecommendedChannel } from '@/lib/channelCosts';
interface AttachmentFile {
  file: File;
  mimeType: string;
  isAudio: boolean;
  previewUrl?: string;
}

export default function CreateMassCampaign() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [campaignName, setCampaignName] = useState('');
  const [channelType, setChannelType] = useState<'whatsapp' | 'telegram' | 'twilio'>('whatsapp');
  const [selectedConnection, setSelectedConnection] = useState('');
  const [selectedWhatsAppConnections, setSelectedWhatsAppConnections] = useState<string[]>([]);
  const [selectedContactList, setSelectedContactList] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [messagesPerRound, setMessagesPerRound] = useState('10');
  const [waitTime, setWaitTime] = useState('30');
  const [waitTimeEnabled, setWaitTimeEnabled] = useState(true);
  const [editWithAi, setEditWithAi] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  
  // Hooks para las conexiones
  const { activeConnections: whatsappConnections } = useWhatsAppConnections();
  const { activeConnections: telegramConnections } = useTelegramConnections();
  const { activeConnections: twilioConnections } = useTwilioConnections();
  const { getUsageByConnectionId, getRemainingMessages, getUsagePercentage, dailyLimit, isNearLimit } = useTwilioUsage(selectedConnection);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    const loadRecipientCount = async () => {
      if (!selectedContactList) {
        setEstimatedRecipients(0);
        return;
      }
      const { count } = await supabase
        .from('contact_list_members')
        .select('id', { count: 'exact', head: true })
        .eq('contact_list_id', selectedContactList);
      setEstimatedRecipients(count || 0);
    };
    loadRecipientCount();
  }, [selectedContactList]);

  // Cargar campaña existente si hay ID
  useEffect(() => {
    if (user && id) {
      loadCampaign();
    }
  }, [user, id, whatsappConnections, telegramConnections, twilioConnections]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      });
    };
  }, [attachments]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Cargar listas de contactos
      const { data: lists } = await supabase
        .from('contact_lists')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');
      
      setContactLists(lists || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadCampaign = async () => {
    if (!id || !user) return;
    
    setLoadingCampaign(true);
    try {
      const { data: campaign, error } = await supabase
        .from('mass_campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!campaign) return;

      setIsEditMode(true);
      setCampaignName(campaign.name || '');
      setMessage(campaign.message || '');
      setChannelType((campaign.channel_type as 'whatsapp' | 'telegram' | 'twilio') || 'whatsapp');
      setSelectedContactList(campaign.contact_list_id || '');
      setEditWithAi(campaign.edit_with_ai || false);
      setWaitTime(String(campaign.min_delay || 30));
      setWaitTimeEnabled((campaign.min_delay || 0) > 0);

      // Cargar conexión según el tipo de canal
      if (campaign.channel_type === 'whatsapp') {
        // Load multi-session if available
        const connectionIds = (campaign as any).whatsapp_connection_ids;
        if (connectionIds && Array.isArray(connectionIds) && connectionIds.length > 0) {
          setSelectedWhatsAppConnections(connectionIds);
        } else if (campaign.whatsapp_connection_id) {
          setSelectedWhatsAppConnections([campaign.whatsapp_connection_id]);
          setSelectedConnection(campaign.whatsapp_connection_id);
        }
      } else if (campaign.channel_type === 'telegram' && campaign.telegram_bot_id) {
        setSelectedConnection(campaign.telegram_bot_id);
      } else if (campaign.channel_type === 'twilio' && campaign.twilio_connection_id) {
        setSelectedConnection(campaign.twilio_connection_id);
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la campaña",
        variant: "destructive",
      });
    } finally {
      setLoadingCampaign(false);
    }
  };

  // Obtener las conexiones activas según el canal seleccionado
  const getCurrentConnections = () => {
    if (channelType === 'whatsapp') return whatsappConnections;
    if (channelType === 'telegram') return telegramConnections;
    if (channelType === 'twilio') return twilioConnections;
    return [];
  };

  // Resetear la conexión seleccionada cuando cambia el tipo de canal (solo si no estamos en modo edición cargando)
  useEffect(() => {
    if (!loadingCampaign && !isEditMode) {
      setSelectedConnection('');
    }
  }, [channelType]);

  const isAudioFile = (mimeType: string) => {
    return mimeType.startsWith('audio/');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AttachmentFile[] = Array.from(e.target.files).map(file => ({
        file,
        mimeType: file.type || 'application/octet-stream',
        isAudio: isAudioFile(file.type),
        previewUrl: isAudioFile(file.type) ? URL.createObjectURL(file) : undefined,
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
    // Reset input
    e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: AttachmentFile[] = Array.from(e.target.files).map(file => ({
        file,
        mimeType: file.type || 'audio/mpeg',
        isAudio: true,
        previewUrl: URL.createObjectURL(file),
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => {
      const att = prev[index];
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleAudioPlay = (previewUrl: string) => {
    const audio = document.getElementById(`audio-${previewUrl}`) as HTMLAudioElement;
    if (audio) {
      if (playingAudio === previewUrl) {
        audio.pause();
        setPlayingAudio(null);
      } else {
        // Pause any currently playing audio
        if (playingAudio) {
          const currentAudio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement;
          if (currentAudio) currentAudio.pause();
        }
        audio.play();
        setPlayingAudio(previewUrl);
      }
    }
  };

  const handleSubmit = async () => {
    // Validar que haya conexión seleccionada
    if (channelType === 'whatsapp') {
      if (selectedWhatsAppConnections.length === 0) {
        toast({
          title: "Error",
          description: "Por favor selecciona al menos una sesión de WhatsApp",
          variant: "destructive",
        });
        return;
      }
    } else if (!selectedConnection) {
      toast({
        title: "Error",
        description: "Por favor selecciona una sesión",
        variant: "destructive",
      });
      return;
    }

    // Validar que haya lista de contactos
    if (!selectedContactList) {
      toast({
        title: "Error",
        description: "Por favor selecciona una lista de contactos",
        variant: "destructive",
      });
      return;
    }

    // Validar que haya mensaje O audio/archivos
    if (!message && attachments.length === 0) {
      toast({
        title: "Error",
        description: "Por favor escribe un mensaje o adjunta un archivo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload attachments if any
      let attachmentUrls: string[] = [];
      let attachmentNames: string[] = [];
      let attachmentMimeTypes: string[] = [];
      
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          const file = attachment.file;
          const fileExt = file.name.split('.').pop();
          const fileName = `${user!.id}/${Date.now()}-${Math.random()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(fileName);

          attachmentUrls.push(publicUrl);
          attachmentNames.push(file.name);
          attachmentMimeTypes.push(attachment.mimeType);
        }
      }

      // Preparar datos según el canal
      const campaignData: any = {
        user_id: user!.id,
        name: campaignName.trim() || `Campaña ${new Date().toLocaleDateString()}`,
        message: message || '📎 Archivo adjunto',
        contact_list_id: selectedContactList,
        min_delay: waitTimeEnabled ? parseInt(waitTime) : 0,
        max_delay: waitTimeEnabled ? parseInt(waitTime) + 10 : 10,
        edit_with_ai: editWithAi,
        attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : null,
        attachment_names: attachmentNames.length > 0 ? attachmentNames : null,
        attachment_mime_types: attachmentMimeTypes.length > 0 ? attachmentMimeTypes : null,
        status: 'pending',
        channel_type: channelType,
      };

      // Asignar la conexión según el tipo de canal
      if (channelType === 'whatsapp') {
        // Multi-session support
        campaignData.whatsapp_connection_ids = selectedWhatsAppConnections;
        // Keep backward compat - use first selected as primary
        campaignData.whatsapp_connection_id = selectedWhatsAppConnections[0];
        const selectedNames = selectedWhatsAppConnections.map(id => {
          const conn = whatsappConnections.find(c => c.id === id);
          return conn?.name || conn?.phone_number || 'WhatsApp';
        });
        campaignData.whatsapp_connection_name = selectedNames.join(', ');
      } else if (channelType === 'telegram') {
        const selectedConn = telegramConnections.find(c => c.id === selectedConnection);
        campaignData.telegram_bot_id = selectedConnection;
        campaignData.whatsapp_connection_name = selectedConn?.bot_name || 'Telegram';
      } else if (channelType === 'twilio') {
        const selectedConn = twilioConnections.find(c => c.id === selectedConnection);
        campaignData.twilio_connection_id = selectedConnection;
        campaignData.whatsapp_connection_name = selectedConn?.connection_name || selectedConn?.phone_number || 'Twilio';
      }

      // Crear o actualizar campaña
      if (id) {
        // Actualizar campaña existente
        const { error } = await supabase
          .from('mass_campaigns')
          .update(campaignData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Campaña actualizada correctamente",
        });
      } else {
        // Crear nueva campaña
        const { data: campaign, error } = await supabase
          .from('mass_campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Campaña creada correctamente",
        });
      }

      navigate('/campanas-masivas');
    } catch (error: any) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la campaña",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const audioAttachments = attachments.filter(a => a.isAudio);
  const otherAttachments = attachments.filter(a => !a.isAudio);
  const selectedChannelCost = channelType === 'twilio' ? CHANNEL_MESSAGE_COSTS.twilio : channelType === 'whatsapp' ? CHANNEL_MESSAGE_COSTS.whatsappApi : CHANNEL_MESSAGE_COSTS.internal;
  const estimatedCampaignCost = estimatedRecipients * selectedChannelCost;
  const estimatedTwilioCost = estimatedRecipients * CHANNEL_MESSAGE_COSTS.twilio;
  const estimatedWhatsappApiCost = estimatedRecipients * CHANNEL_MESSAGE_COSTS.whatsappApi;
  const projectedCampaignSavings = Math.max(estimatedTwilioCost - estimatedWhatsappApiCost, 0);
  const recommendedCampaignChannel = getRecommendedChannel({
    twilioCost: estimatedTwilioCost,
    whatsappApiCost: estimatedWhatsappApiCost,
    whatsappApiActive: whatsappConnections.length > 0,
    whatsappQrActive: whatsappConnections.length > 0,
    twilioActive: twilioConnections.length > 0,
    telegramActive: telegramConnections.length > 0,
    campaignSize: estimatedRecipients,
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/campanas-masivas')}
            className="hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {id ? 'Editar campaña' : 'Nuevo envío masivo'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {id ? 'Modifica los datos de tu campaña' : 'Configura tu campaña de mensajería'}
            </p>
          </div>
        </div>

        {loadingCampaign && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Nombre de la campaña */}
        <div className="mb-4">
          <Label className="text-foreground mb-2 block">Nombre de la campaña</Label>
          <Input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Ej: Promoción de Navidad"
            className="bg-card border-border text-foreground"
          />
        </div>

        {/* Selección de canal */}
        <div className="mb-4">
          <Label className="text-foreground mb-2 block">Canal de comunicación</Label>
          <Select value={channelType} onValueChange={(value: any) => setChannelType(value)}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Seleccionar canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="twilio">Twilio (SMS/WhatsApp Business)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selección de sesión y lista de contactos */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-foreground mb-2 block">
              {channelType === 'whatsapp' ? 'Sesiones de WhatsApp (multi-selección)' : `Sesión de ${channelType === 'telegram' ? 'Telegram' : 'Twilio'}`}
            </Label>
            
            {channelType === 'whatsapp' ? (
              /* Multi-select checkboxes for WhatsApp */
              <div className="bg-card border border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {whatsappConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay sesiones activas</p>
                ) : (
                  whatsappConnections.map((conn) => (
                    <label key={conn.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md">
                      <Checkbox
                        checked={selectedWhatsAppConnections.includes(conn.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedWhatsAppConnections(prev => [...prev, conn.id]);
                          } else {
                            setSelectedWhatsAppConnections(prev => prev.filter(id => id !== conn.id));
                          }
                        }}
                      />
                      <span className="text-sm text-foreground">{conn.name || conn.phone_number}</span>
                    </label>
                  ))
                )}
                {selectedWhatsAppConnections.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                    {selectedWhatsAppConnections.length} sesión(es) seleccionada(s) — los mensajes se distribuirán en round-robin
                  </p>
                )}
              </div>
            ) : (
              /* Single select for Telegram/Twilio */
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="bg-card border-border text-foreground">
                  <SelectValue placeholder={`Buscar sesión de ${channelType}`} />
                </SelectTrigger>
                <SelectContent>
                  {getCurrentConnections().map((conn: any) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {channelType === 'telegram'
                        ? `${conn.bot_name}`
                        : `${conn.connection_name} - ${conn.phone_number}`
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Twilio Usage Warning */}
            {channelType === 'twilio' && selectedConnection && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uso hoy: {getUsageByConnectionId(selectedConnection)}/{dailyLimit}</span>
                  <span className={isNearLimit(selectedConnection) ? 'text-warning font-medium' : ''}>
                    {getRemainingMessages(selectedConnection)} restantes
                  </span>
                </div>
                <Progress 
                  value={getUsagePercentage(selectedConnection)} 
                  className={`h-1.5 ${isNearLimit(selectedConnection) ? '[&>div]:bg-warning' : ''}`}
                />
                {isNearLimit(selectedConnection) && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      ¡Atención! Has usado más del 80% del límite diario de Twilio.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-foreground mb-2 block">Lista de contactos</Label>
            <Select value={selectedContactList} onValueChange={setSelectedContactList}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue placeholder="Buscar lista de contactos" />
              </SelectTrigger>
              <SelectContent>
                {contactLists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Personalizar con IA */}
        {estimatedRecipients > 0 && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div><p className="text-sm text-muted-foreground">Destinatarios</p><p className="text-xl font-bold">{estimatedRecipients}</p></div>
              <div><p className="text-sm text-muted-foreground">Costo estimado</p><p className="text-xl font-bold">{formatUsd(estimatedCampaignCost)}</p></div>
              <div><p className="text-sm text-muted-foreground">Ahorro usando API</p><p className="text-xl font-bold text-primary">{formatUsd(projectedCampaignSavings)}</p></div>
              <div><p className="text-sm text-muted-foreground">Canal recomendado</p><p className="text-xl font-bold text-primary">{recommendedCampaignChannel}</p></div>
            </div>
            {channelType === 'twilio' && estimatedCampaignCost > 150 && (
              <Alert variant="destructive" className="mt-3"><AlertTriangle className="h-4 w-4" /><AlertDescription>Esta campaña proyecta un costo alto en Twilio. Considera WhatsApp API.</AlertDescription></Alert>
            )}
          </div>
        )}

        {/* Personalizar con IA */}
        <div className="mb-4">
          <div className="bg-gradient-to-br from-card to-card/80 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Personalizar con IA</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  La IA personalizará cada mensaje para que sea único
                </p>
              </div>
              <Switch
                checked={editWithAi}
                onCheckedChange={setEditWithAi}
              />
            </div>
          </div>
        </div>

        {/* Etiquetas disponibles */}
        <div className="mb-4">
          <Label className="text-foreground mb-2 block">Etiquetas disponibles</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Haz clic para insertar en el mensaje. Se reemplazarán con los datos del contacto.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMessage(prev => prev + '[nombre]')}
              className="text-xs border-primary/50 hover:bg-primary/10"
            >
              [nombre]
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMessage(prev => prev + '[telefono]')}
              className="text-xs border-primary/50 hover:bg-primary/10"
            >
              [telefono]
            </Button>
          </div>
        </div>

        {/* Área de mensaje */}
        <div className="mb-4">
          <div className="bg-gradient-to-br from-card to-card/80 border border-border rounded-xl p-3">
            <div className="flex items-start gap-2 mb-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent">
                <Smile className="h-5 w-5" />
              </Button>
              
              {/* Botón para archivos generales */}
              <label htmlFor="file-upload">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent" asChild>
                  <span>
                    <Paperclip className="h-5 w-5" />
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {/* Botón específico para audio */}
              <label htmlFor="audio-upload">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent" asChild>
                  <span>
                    <Mic className="h-5 w-5" />
                  </span>
                </Button>
              </label>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                onChange={handleAudioUpload}
                className="hidden"
              />
              
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hola [nombre], ¿cómo estás? Te escribimos para... (opcional si adjuntas audio)"
                className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 resize-none min-h-[100px]"
              />
            </div>
            
            {/* Audio attachments preview */}
            {audioAttachments.length > 0 && (
              <div className="space-y-2 mt-3 border-t border-border pt-3">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileAudio className="h-3 w-3" /> Audios adjuntos
                </Label>
                {audioAttachments.map((att, index) => (
                  <div key={`audio-${index}`} className="flex items-center gap-3 bg-background/50 px-3 py-2 rounded-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={() => att.previewUrl && toggleAudioPlay(att.previewUrl)}
                    >
                      {playingAudio === att.previewUrl ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <span className="text-sm text-foreground">{att.file.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({(att.file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    {att.previewUrl && (
                      <audio
                        id={`audio-${att.previewUrl}`}
                        src={att.previewUrl}
                        onEnded={() => setPlayingAudio(null)}
                        className="hidden"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachments.indexOf(att))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Other attachments */}
            {otherAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {otherAttachments.map((att, index) => (
                  <div key={`file-${index}`} className="flex items-center gap-2 bg-background px-3 py-1 rounded-md">
                    <span className="text-sm text-foreground">{att.file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachments.indexOf(att))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Puedes enviar solo texto, solo audio, o ambos. Los archivos adjuntos se enviarán junto con el mensaje.
          </p>
        </div>

        {/* Configuración de envío */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-card to-card/80 border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-1" />
              <div className="flex-1">
                <h3 className="text-foreground font-medium mb-1">Mensajes por ronda y sesión</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Número de mensajes para enviar por cada ronda de envío
                </p>
                <Input
                  type="number"
                  value={messagesPerRound}
                  onChange={(e) => setMessagesPerRound(e.target.value)}
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-card to-card/80 border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-1" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-foreground font-medium">Tiempo de espera (segundos)</h3>
                  <Switch
                    checked={waitTimeEnabled}
                    onCheckedChange={setWaitTimeEnabled}
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Tiempo de espera entre cada mensaje enviado
                </p>
                <Input
                  type="number"
                  value={waitTime}
                  onChange={(e) => setWaitTime(e.target.value)}
                  disabled={!waitTimeEnabled}
                  className="bg-background border-border text-foreground disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Botón de envío */}
        <Button
          onClick={handleSubmit}
          disabled={loading || loadingCampaign}
          className="w-full bg-gradient-to-r from-primary to-primary/90 font-semibold py-6 text-lg rounded-xl"
        >
          {loading ? 'PROCESANDO...' : id ? 'GUARDAR CAMBIOS' : 'INICIAR ENVÍO MASIVO'}
        </Button>
      </div>
    </div>
  );
}
