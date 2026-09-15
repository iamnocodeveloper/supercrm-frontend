import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Link2, Plus, Smartphone, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Loader2, Pencil, MessageSquare, ArrowDownLeft, ArrowUpRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SessionGroupsDialog } from '@/components/whatsapp/SessionGroupsDialog';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useTwilioUsage } from '@/hooks/useTwilioUsage';
import { useSessionStats } from '@/hooks/useSessionStats';
import { supabase } from '@/integrations/supabase/client';
import WhatsAppConnectionForm from './WhatsAppConnectionForm';
import ZernioConnectionForm from './ZernioConnectionForm';
import WhatsAppPasskeyForm from './WhatsAppPasskeyForm';
import WhatsAppPairingCodeForm from './WhatsAppPairingCodeForm';
import TelegramConnectionForm from './TelegramConnectionForm';
import TelegramBotConnectionForm from './TelegramBotConnectionForm';
import TwilioConnectionForm from './TwilioConnectionForm';
import WebChatConnectionForm from './WebChatConnectionForm';
import EditSessionDialog from './EditSessionDialog';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface Channel {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

interface Session {
  id: string;
  name: string;
  type: 'whatsapp' | 'whatsapp-passkey' | 'zernio' | 'telegram' | 'telegram-bot' | 'twilio' | 'webchat';
  identifier: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  workspace_id?: string | null;
  default_column_id?: string | null;
}

interface Workspace {
  id: string;
  name: string;
  position: number;
}

interface LeadColumn {
  id: string;
  name: string;
  color: string | null;
  workspace_id: string | null;
  position: number;
}

const channels: Channel[] = [
  { id: 'whatsapp-qr', name: 'WhatsApp QR', icon: '📱', color: 'hsl(var(--whatsapp-green))', enabled: true },
  { id: 'twilio-whatsapp', name: 'Twilio WhatsApp', icon: '📞', color: 'hsl(var(--twilio-red))', enabled: true },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'hsl(var(--telegram-blue))', enabled: true },
  { id: 'telegram-bot', name: 'Telegram Bot', icon: '🤖', color: 'hsl(var(--telegram-blue))', enabled: true },
  { id: 'whatsapp-code', name: 'WhatsApp Codigo', icon: '🔗', color: '#10b981', enabled: true },
  { id: 'whatsapp-passkey', name: 'WhatsApp Passkey', icon: '🔑', color: '#f59e0b', enabled: true },
  { id: 'zernio-whatsapp', name: 'WhatsApp API (Zernio)', icon: '🟢', color: '#25D366', enabled: true },
  { id: 'web-chat', name: 'Web Chatbot', icon: '💻', color: 'hsl(var(--primary))', enabled: true },
  { id: 'google-calendar', name: 'Google Calendar', icon: '📅', color: 'hsl(var(--muted))', enabled: false },
  { id: 'email', name: 'Email', icon: '✉️', color: 'hsl(var(--muted))', enabled: false },
];

type ChannelFilterType = 'all' | Session['type'];
type StatusFilterType = 'all' | 'connected' | 'disconnected';

const CONNECTED_STATUSES = ['connected', 'active', 'working', 'conectado'];
const isConnectedStatus = (status: string) => CONNECTED_STATUSES.includes(status);

const filterOptions: { value: ChannelFilterType; label: string; icon: string }[] = [
  { value: 'all', label: 'Todos los canales', icon: '📡' },
  { value: 'whatsapp', label: 'WhatsApp QR', icon: '📱' },
  { value: 'whatsapp-passkey', label: 'WhatsApp Passkey', icon: '🔑' },
  { value: 'zernio', label: 'WhatsApp API (Zernio)', icon: '🟢' },
  { value: 'twilio', label: 'Twilio', icon: '📞' },
  { value: 'telegram-bot', label: 'Telegram Bot', icon: '🤖' },
  { value: 'webchat', label: 'Web Chat', icon: '💻' },
];

const SessionsManager = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelSelectorOpen, setChannelSelectorOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [verifyingSession, setVerifyingSession] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [groupsSession, setGroupsSession] = useState<Session | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [embudos, setEmbudos] = useState<LeadColumn[]>();
  const [channelFilter, setChannelFilter] = useState<ChannelFilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [verifyingAll, setVerifyingAll] = useState(false);
  const { effectiveUserId, loading: userIdLoading } = useEffectiveUserId();
  const { toast } = useToast();
  const { getUsageByConnectionId, getUsagePercentage, getRemainingMessages, dailyLimit, isNearLimit } = useTwilioUsage();
  const { getStatsBySessionId, loading: statsLoading } = useSessionStats(effectiveUserId);

  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (channelFilter !== 'all') {
      result = result.filter(session => session.type === channelFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(session =>
        statusFilter === 'connected'
          ? isConnectedStatus(session.status)
          : !isConnectedStatus(session.status)
      );
    }

    return result;
  }, [sessions, channelFilter, statusFilter]);

  useEffect(() => {
    if (!userIdLoading && effectiveUserId) {
      fetchAllSessions();
      loadWorkspacesAndEmbudos();
    }
  }, [effectiveUserId, userIdLoading]);

  // Auto-abrir el formulario de Zernio al volver del Embedded Signup
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const zernioErrors = [
      'whatsapp_error',
      'one_whatsapp_per_profile',
      'whatsapp_number_already_connected',
      'whatsapp_number_pinned_to_profile',
      'connection_cancelled',
    ];
    if (q.get('connected') === 'whatsapp' || zernioErrors.includes(q.get('error') ?? '')) {
      setSelectedChannel('zernio-whatsapp');
    }
  }, []);

  const loadWorkspacesAndEmbudos = async () => {
    if (!effectiveUserId) return;

    try {
      // Cargar workspaces del usuario
      const { data: workspacesData } = await supabase
        .from('workspaces')
        .select('id, name, position')
        .eq('user_id', effectiveUserId)
        .order('position');
      
      setWorkspaces(workspacesData || []);
      
      // Cargar embudos del usuario
      const { data: embudosData } = await supabase
        .from('lead_columns')
        .select('id, name, color, workspace_id, position')
        .eq('user_id', effectiveUserId)
        .order('position');
      
      setEmbudos(embudosData || []);
    } catch (error) {
      console.error('Error loading workspaces and embudos:', error);
    }
  };


  const fetchAllSessions = async () => {
    if (!effectiveUserId) return;

    try {
      setLoading(true);

      // Fetch WhatsApp connections (excluding deleted/stopped/failed)
      const { data: whatsappData } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status, created_at, updated_at, workspace_id, default_column_id, connection_subtype, engine')
        .eq('user_id', effectiveUserId)
        .not('status', 'in', '("deleted","STOPPED","FAILED")')
        .order('created_at', { ascending: false });

      // Fetch Telegram bots
      const { data: telegramBotData } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      // Fetch Twilio connections
      const { data: twilioData } = await supabase
        .from('twilio_connections')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      const allSessions: Session[] = [];

      // Add WhatsApp sessions
      if (whatsappData) {
        whatsappData.forEach(conn => {
          const subtype = (conn as any).connection_subtype;
          const engine = (conn as any).engine;
          allSessions.push({
            id: conn.id,
            name: conn.name || 'Sin nombre',
            type: subtype === 'passkey'
              ? 'whatsapp-passkey'
              : (subtype === 'api' && engine === 'zernio')
                ? 'zernio'
                : 'whatsapp',
            identifier: conn.phone_number,
            status: conn.status || 'disconnected',
            created_at: conn.created_at,
            updated_at: (conn as any).updated_at || conn.created_at,
            workspace_id: conn.workspace_id,
            default_column_id: conn.default_column_id
          });
        });
      }

      // Add Telegram Bot sessions
      if (telegramBotData) {
        telegramBotData.forEach(bot => {
          allSessions.push({
            id: bot.id,
            name: bot.bot_name,
            type: 'telegram-bot',
            identifier: bot.bot_username || bot.bot_token?.substring(0, 20) + '...',
            status: bot.status || 'active',
            created_at: bot.created_at,
            updated_at: (bot as any).updated_at || bot.created_at,
            workspace_id: bot.workspace_id,
            default_column_id: bot.default_column_id
          });
        });
      }

      // Add Twilio sessions
      if (twilioData) {
        twilioData.forEach(conn => {
          allSessions.push({
            id: conn.id,
            name: conn.connection_name,
            type: 'twilio',
            identifier: conn.phone_number,
            status: conn.status || 'active',
            created_at: conn.created_at,
            updated_at: (conn as any).updated_at || conn.created_at,
            workspace_id: conn.workspace_id,
            default_column_id: conn.default_column_id
          });
        });
      }

      // Fetch Web Chatbots
      const { data: webchatData } = await supabase
        .from('web_chatbots')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      // Add Web Chatbot sessions
      if (webchatData) {
        webchatData.forEach(chat => {
          allSessions.push({
            id: chat.id,
            name: chat.name,
            type: 'webchat',
            identifier: chat.id.substring(0, 8) + '...',
            status: chat.is_active ? 'active' : 'inactive',
            created_at: chat.created_at,
            updated_at: (chat as any).updated_at || chat.created_at,
            workspace_id: (chat as any).workspace_id || null,
            default_column_id: (chat as any).default_column_id || null
          });
        });
      }

      // Sort by creation date
      allSessions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setSessions(allSessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel?.enabled) {
      setSelectedChannel(channelId);
      setChannelSelectorOpen(false);
    }
  };

  const handleCloseForm = () => {
    setSelectedChannel(null);
    fetchAllSessions();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'disconnected':
      case 'inactive':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return '📱';
      case 'whatsapp-passkey': return '🔑';
      case 'zernio': return '🟢';
      case 'telegram': return '✈️';
      case 'telegram-bot': return '🤖';
      case 'twilio': return '📞';
      case 'webchat': return '💻';
      default: return '📡';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'whatsapp': return 'hsl(var(--whatsapp-green))';
      case 'whatsapp-passkey': return '#f59e0b';
      case 'zernio': return '#25D366';
      case 'telegram':
      case 'telegram-bot': return 'hsl(var(--telegram-blue))';
      case 'twilio': return 'hsl(var(--twilio-red))';
      case 'webchat': return 'hsl(var(--primary))';
      default: return 'hsl(var(--muted))';
    }
  };

  // Verifica una sesión según su modalidad. Devuelve success=false cuando el
  // proveedor respondió pero la sesión está caída (solo aplica a Twilio).
  const verifyOne = async (session: Session) => {
    if (session.type === 'twilio') {
      const { data, error } = await supabase.functions.invoke('twilio-verify-connection', {
        body: { connection_id: session.id }
      });
      if (error) throw error;
      return { success: !!data?.success, data };
    }

    if (session.type === 'zernio') {
      const { data, error } = await supabase.functions.invoke('zernio-connect', {
        body: { action: 'status', connectionId: session.id },
      });
      if (error) throw error;
      return {
        success: !!data?.success,
        data: {
          status: data?.success
            ? (data?.info?.connection_status ?? data?.info?.status ?? 'connected')
            : 'error',
        },
      };
    }

    if (session.type === 'whatsapp' || session.type === 'whatsapp-passkey') {
      const { data, error } = await supabase.functions.invoke('waha-session-status', {
        body: {
          session_name: session.name,
          connection_id: session.id,
          update_db: true // Solo el botón Verificar actualiza el estado en BD
        }
      });

      if (error) throw error;

      // Forzar actualización de updated_at para reflejar la última verificación
      await supabase
        .from('whatsapp_connections')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', session.id);

      return { success: true, data };
    }

    throw new Error('Tipo de sesión no verificable');
  };

  const handleVerifyStatus = async (session: Session) => {
    if (session.type !== 'whatsapp' && session.type !== 'whatsapp-passkey' && session.type !== 'zernio') {
      toast({
        title: "No disponible",
        description: "La verificación de estatus solo está disponible para WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setVerifyingSession(session.id);
    try {
      const { data } = await verifyOne(session);

      toast({
        title: "Estado de sesión",
        description: `Estado actual: ${data?.status || 'desconocido'}`,
      });

      // Refresh sessions to update status
      fetchAllSessions();
    } catch (error: any) {
      console.error('Error verifying status:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar el estado de la sesión",
        variant: "destructive",
      });
    } finally {
      setVerifyingSession(null);
    }
  };

  const handleVerifyTwilio = async (session: Session) => {
    setVerifyingSession(session.id);
    try {
      const { success, data } = await verifyOne(session);

      if (success) {
        const presenceLabel = data.presence === 'online' ? 'Online' : 'Offline';
        const numberLabel =
          data.number_found === false
            ? ' · El número ya no está en la cuenta'
            : data.number_found === true
              ? ' · Número activo'
              : '';
        toast({
          title: `Twilio: ${presenceLabel}`,
          description: `Cuenta ${data.account_status}${numberLabel}`,
          variant: data.presence === 'online' ? 'default' : 'destructive',
        });
      } else {
        toast({
          title: 'Twilio: Offline',
          description: data?.error || 'No se pudo verificar la conexión',
          variant: 'destructive',
        });
      }

      fetchAllSessions();
    } catch (error: any) {
      console.error('Error verifying Twilio connection:', error);
      toast({
        title: 'Error',
        description: 'No se pudo verificar la conexión de Twilio',
        variant: 'destructive',
      });
    } finally {
      setVerifyingSession(null);
    }
  };

  // Verifica de una todas las sesiones verificables del filtro actual
  // (WhatsApp QR / Passkey / Código y Twilio), sin importar la modalidad.
  const handleVerifyAll = async () => {
    const verifiable = filteredSessions.filter(
      s => s.type === 'whatsapp' || s.type === 'whatsapp-passkey' || s.type === 'zernio' || s.type === 'twilio'
    );

    if (verifiable.length === 0) {
      toast({
        title: 'Sin sesiones verificables',
        description: 'No hay sesiones de WhatsApp o Twilio en el filtro actual.',
      });
      return;
    }

    setVerifyingAll(true);
    let ok = 0;
    let fail = 0;

    for (const session of verifiable) {
      try {
        const result = await verifyOne(session);
        if (session.type === 'twilio' && !result.success) fail++;
        else ok++;
      } catch (error) {
        console.error('Error verificando sesión:', session.name, error);
        fail++;
      }
    }

    await fetchAllSessions();
    setVerifyingAll(false);

    toast({
      title: 'Verificación completada',
      description: `${ok} verificada${ok === 1 ? '' : 's'}${fail > 0 ? ` · ${fail} con error` : ''}`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  };

  const handleEditSession = (session: Session) => {
    setEditingSession(session);
  };

  const handleEditSuccess = () => {
    fetchAllSessions();
  };

  const handleDeleteSession = async (session: Session) => {
    const confirmed = window.confirm(`¿Estás seguro de que quieres eliminar la sesión "${session.name}"?`);
    if (!confirmed) return;

    setDeletingSession(session.id);
    try {
      switch (session.type) {
        case 'whatsapp':
        case 'whatsapp-passkey':
          const { error: wahaError } = await supabase.functions.invoke('waha-delete-session', {
            body: { 
              session_name: session.name,
              connection_id: session.id 
            }
          });
          // Si hay error en WAHA, hacer fallback a eliminación directa de BD
          if (wahaError) {
            console.warn('WAHA delete error, attempting direct DB delete:', wahaError);
            const { error: dbError } = await supabase
              .from('whatsapp_connections')
              .delete()
              .eq('id', session.id);
            if (dbError) throw dbError;
          }
          break;

        case 'zernio': {
          await supabase.functions.invoke('zernio-connect', {
            body: { action: 'disconnect', connectionId: session.id },
          });
          const { error: zernioDeleteError } = await supabase
            .from('whatsapp_connections')
            .delete()
            .eq('id', session.id);
          if (zernioDeleteError) throw zernioDeleteError;
          break;
        }

        case 'telegram-bot':
          const { error: telegramError } = await supabase
            .from('telegram_bots')
            .delete()
            .eq('id', session.id);
          if (telegramError) throw telegramError;
          break;

        case 'twilio':
          // Clean up related records before deletion
          await supabase
            .from('ai_response_buffer')
            .delete()
            .eq('twilio_connection_id', session.id);
          
          await supabase
            .from('mass_campaigns')
            .update({ twilio_connection_id: null })
            .eq('twilio_connection_id', session.id);
          
          const { error: twilioError } = await supabase
            .from('twilio_connections')
            .delete()
            .eq('id', session.id);
          if (twilioError) throw twilioError;
          break;

        case 'webchat':
          const { error: webchatError } = await supabase
            .from('web_chatbots')
            .delete()
            .eq('id', session.id);
          if (webchatError) throw webchatError;
          break;

        default:
          throw new Error('Tipo de sesión no soportado');
      }

      toast({
        title: "Sesión eliminada",
        description: "La sesión ha sido eliminada correctamente",
      });

      fetchAllSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la sesión",
        variant: "destructive",
      });
    } finally {
      setDeletingSession(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Sesiones</h2>
          <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
            {filteredSessions.length}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as ChannelFilterType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por canal" />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilterType)}>
            <SelectTrigger className="w-[175px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🌐 Todos los estados</SelectItem>
              <SelectItem value="connected">🟢 Conectadas</SelectItem>
              <SelectItem value="disconnected">🔴 Desconectadas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyAll}
            disabled={verifyingAll || loading}
          >
            {verifyingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar sesiones
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setChannelSelectorOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Añadir Canal
          </Button>
        </div>
      </div>
      
      <p className="text-muted-foreground text-sm">
        Crear, editar y eliminar tus sesiones vinculadas.
      </p>

      {/* Sessions List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {statusFilter !== 'all'
                ? `No hay sesiones ${statusFilter === 'connected' ? 'conectadas' : 'desconectadas'}`
                : channelFilter === 'all'
                  ? 'No hay sesiones conectadas'
                  : `No hay sesiones de ${filterOptions.find(o => o.value === channelFilter)?.label}`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter !== 'all'
                ? 'Probá cambiando el filtro de estado o de canal.'
                : channelFilter === 'all'
                  ? 'Comienza añadiendo tu primer canal de comunicación'
                  : 'Prueba seleccionando otro filtro o añade una nueva sesión'}
            </p>
            <Button onClick={() => setChannelSelectorOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir Canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(session => (
            <Card 
              key={session.id}
              className="hover:shadow-md transition-shadow border-l-4"
              style={{ borderLeftColor: getTypeColor(session.type) }}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getTypeIcon(session.type)}</span>
                    <span className="truncate">{session.name}</span>
                  </div>
                  {getStatusIcon(session.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">ID:</span> {session.identifier}
                </div>
                
                {/* Session Stats - Para todos los tipos de sesión */}
                {(() => {
                  const sessionStats = getStatsBySessionId(session.id);
                  return (
                    <div className="space-y-1.5 p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          Conversaciones
                        </span>
                        <span className="font-medium text-foreground">
                          {sessionStats?.total_conversations || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ArrowDownLeft className="h-3 w-3" />
                          Recibidos
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {sessionStats?.received_messages || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ArrowUpRight className="h-3 w-3" />
                          Enviados
                        </span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {sessionStats?.sent_messages || 0}
                        </span>
                      </div>
                      {/* Twilio daily limit adicional */}
                      {session.type === 'twilio' && (
                        <>
                          <div className="border-t border-border my-1.5" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Hoy</span>
                            <span className={`font-medium ${isNearLimit(session.id) ? 'text-warning' : 'text-foreground'}`}>
                              {getUsageByConnectionId(session.id)} / {dailyLimit}
                            </span>
                          </div>
                          <Progress 
                            value={getUsagePercentage(session.id)} 
                            className={`h-1.5 ${isNearLimit(session.id) ? '[&>div]:bg-warning' : ''}`}
                          />
                        </>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-1 border-t border-border pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Último mensaje recibido</span>
                    <span className="font-medium text-foreground">
                      {(() => {
                        const s = getStatsBySessionId(session.id);
                        const ts = s?.last_inbound_at || null;
                        return ts
                          ? new Date(ts).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                          : 'Sin mensajes';
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Conexión inicial</span>
                    <span className="font-medium text-foreground">
                      {new Date(session.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Días conectado</span>
                    <span className="font-medium text-foreground">
                      {(() => {
                        const days = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 86400000);
                        return days === 0 ? 'Hoy' : `${days} día${days === 1 ? '' : 's'}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Última verificación</span>
                    <span className="font-medium text-foreground">
                      {session.updated_at
                        ? new Date(session.updated_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isConnectedStatus(session.status)
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {isConnectedStatus(session.status) ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSession(session)}
                    className="flex-1"
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="ml-1 text-xs">Editar</span>
                  </Button>
                  {(session.type === 'whatsapp' || session.type === 'whatsapp-passkey') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerifyStatus(session)}
                      disabled={verifyingSession === session.id}
                      className="flex-1"
                    >
                      {verifyingSession === session.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="ml-1 text-xs">Verificar</span>
                    </Button>
                  )}
                  {session.type === 'twilio' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerifyTwilio(session)}
                      disabled={verifyingSession === session.id}
                      className="flex-1"
                    >
                      {verifyingSession === session.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      <span className="ml-1 text-xs">Verificar</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSession(session)}
                    disabled={deletingSession === session.id}
                    className="flex-1 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {deletingSession === session.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    <span className="ml-1 text-xs">Eliminar</span>
                  </Button>
                </div>
                {(session.type === 'whatsapp' || session.type === 'whatsapp-passkey') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGroupsSession(session)}
                    className="mt-1 w-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
                  >
                    <Users className="mr-1 h-3 w-3" />
                    <span className="text-xs">Ver grupos</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Channel Selector Dialog */}
      <Dialog open={channelSelectorOpen} onOpenChange={setChannelSelectorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Seleccionar Canal</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Elige el tipo de canal que deseas conectar
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel.id)}
                  disabled={!channel.enabled}
                  className={`
                    relative p-6 rounded-lg border-2 transition-all
                    ${channel.enabled 
                      ? 'cursor-pointer hover:shadow-lg hover:scale-105 hover:border-primary' 
                      : 'cursor-not-allowed opacity-40'
                    }
                    border-border
                  `}
                  style={{
                    backgroundColor: channel.enabled 
                      ? 'hsl(var(--card))'
                      : 'hsl(var(--muted) / 0.3)'
                  }}
                >
                  <div className="flex flex-col items-center space-y-3">
                    <span className="text-4xl">{channel.icon}</span>
                    <span 
                      className={`text-sm font-medium text-center ${
                        channel.enabled ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {channel.name}
                    </span>
                    {!channel.enabled && (
                      <span className="text-xs text-muted-foreground">Próximamente</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection Forms */}
      {selectedChannel === 'whatsapp-qr' && (
        <WhatsAppConnectionForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'whatsapp-passkey' && (
        <WhatsAppPasskeyForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'zernio-whatsapp' && (
        <ZernioConnectionForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'whatsapp-code' && (
        <WhatsAppPairingCodeForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'telegram' && (
        <TelegramConnectionForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'telegram-bot' && (
        <TelegramBotConnectionForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'twilio-whatsapp' && (
        <TwilioConnectionForm onClose={handleCloseForm} />
      )}
      {selectedChannel === 'web-chat' && (
        <WebChatConnectionForm onClose={handleCloseForm} />
      )}

      {/* Edit Session Dialog */}
      {editingSession && (
        <EditSessionDialog
          open={!!editingSession}
          onClose={() => setEditingSession(null)}
          sessionType={editingSession.type === 'telegram-bot' ? 'telegram' : editingSession.type === 'whatsapp-passkey' ? 'whatsapp' : editingSession.type === 'zernio' ? 'whatsapp' : editingSession.type}
          session={{
            id: editingSession.id,
            name: editingSession.name,
            workspace_id: editingSession.workspace_id,
            default_column_id: editingSession.default_column_id
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Groups Dialog desde card */}
      <SessionGroupsDialog
        session={groupsSession ? { id: groupsSession.id, name: groupsSession.name } : null}
        open={!!groupsSession}
        onOpenChange={(open) => { if (!open) setGroupsSession(null); }}
      />
    </div>
  );
};

export default SessionsManager;
