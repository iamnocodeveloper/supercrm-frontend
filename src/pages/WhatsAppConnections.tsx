import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, List, Trash2, QrCode, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import UsageLimitAlert from '@/components/UsageLimitAlert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditSessionDialog from '@/components/sessions/EditSessionDialog';

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
  created_at: string;
  workspace_id?: string | null;
  default_column_id?: string | null;
}

interface Workspace {
  id: string;
  name: string;
}

interface LeadColumn {
  id: string;
  name: string;
  is_default: boolean;
  workspace_id: string | null;
}

const colorOptions = [
  { name: 'Azul', value: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Verde', value: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Rojo', value: '#ef4444', bg: 'bg-red-500' },
  { name: 'Púrpura', value: '#8b5cf6', bg: 'bg-violet-500' },
  { name: 'Naranja', value: '#f97316', bg: 'bg-orange-500' },
  { name: 'Rosa', value: '#ec4899', bg: 'bg-pink-500' },
];

const WhatsAppConnections = () => {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string>('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    workspace_id: '',
    default_column_id: ''
  });
  const [editingSession, setEditingSession] = useState<WhatsAppConnection | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, loading: userIdLoading } = useEffectiveUserId();
  const { enforceLimit, incrementUsage } = useUsageLimits();

  useEffect(() => {
    // Solo ejecutar fetchConnections cuando tenemos un effectiveUserId válido
    if (!userIdLoading && effectiveUserId) {
      fetchConnections();
      fetchWorkspaces();
      fetchLeadColumns();
    }
  }, [effectiveUserId, userIdLoading]);

  // Cargar columnas cuando cambia el workspace seleccionado
  useEffect(() => {
    if (formData.workspace_id && effectiveUserId) {
      fetchLeadColumns(formData.workspace_id);
    } else if (!formData.workspace_id && effectiveUserId) {
      fetchLeadColumns();
    }
  }, [formData.workspace_id, effectiveUserId]);

  const fetchConnections = async () => {
    // Verificar que tengamos un effectiveUserId válido antes de hacer la consulta
    if (!effectiveUserId) {
      console.log('No effectiveUserId available, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status, created_at, workspace_id, default_column_id')
        .eq('user_id', effectiveUserId)
        .not('status', 'in', '("deleted","STOPPED","FAILED")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las conexiones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    if (!effectiveUserId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('user_id', effectiveUserId)
        .order('position');

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchLeadColumns = async (workspaceId?: string) => {
    if (!effectiveUserId) {
      return;
    }

    try {
      let query = supabase
        .from('lead_columns')
        .select('id, name, is_default, workspace_id')
        .eq('user_id', effectiveUserId)
        .order('position');

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeadColumns(data || []);
      
      // Auto-seleccionar la columna por defecto
      if (data && data.length > 0 && !formData.default_column_id) {
        const defaultColumn = data.find(col => col.is_default);
        if (defaultColumn) {
          setFormData(prev => ({ ...prev, default_column_id: defaultColumn.id }));
        } else {
          setFormData(prev => ({ ...prev, default_column_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching lead columns:', error);
    }
  };

  const handleQRConnect = async (sessionName: string) => {
    setCurrentSession(sessionName);
    setQrModalOpen(true);
    setQrLoading(true);
    setQrImage(null);

    if (!effectiveUserId || !user) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      setQrLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('waha-get-qr', {
        body: {
          session_name: sessionName,
          user_id: effectiveUserId
        }
      });

      if (error) throw error;

      console.log('QR Response completa:', data);

      // WAHA devuelve el QR como string con data URL completo ya construido por el edge function
      if (data?.qr) {
        const qrImageData = typeof data.qr === 'string' ? data.qr : data.qr.data;
        
        console.log('QR Image Data (primeros 100 chars):', qrImageData?.substring(0, 100) + '...');
        setQrImage(qrImageData);
        toast({
          title: "Código QR generado",
          description: "Escanea el código QR con WhatsApp para conectar",
        });
      } else {
        console.error('No se encontró data.qr en la respuesta:', data);
        throw new Error('No se recibió el código QR');
      }
    } catch (error) {
      console.error('Error al obtener QR:', error);
      toast({
        title: "Error",
        description: "No se pudo obtener el código QR. Verifica que la sesión esté iniciada.",
        variant: "destructive",
      });
      setQrModalOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleQRConnected = async () => {
    if (!currentSession || !effectiveUserId) return;

    setVerifying(currentSession);
    try {
      const connection = connections.find(c => c.name === currentSession);
      
      const { data, error } = await supabase.functions.invoke('waha-session-status', {
        body: {
          session_name: currentSession,
          connection_id: connection?.id,
          user_id: effectiveUserId,
          update_db: true // Solo verificación manual actualiza BD
        }
      });

      if (error) throw error;
      
      if (data?.status === 'connected') {
        setQrModalOpen(false);
        setQrImage(null);
        setCurrentSession('');
        await fetchConnections();
        
        toast({
          title: "¡Conectado!",
          description: "WhatsApp conectado exitosamente",
        });
      } else {
        toast({
          title: "Aún no conectado",
          description: "Por favor, escanea el código QR con WhatsApp",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error al verificar conexión:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar la conexión",
        variant: "destructive",
      });
    } finally {
      setVerifying(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone_number) {
      toast({
        title: "Error",
        description: "Por favor, completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    if (!formData.default_column_id) {
      toast({
        title: "Error",
        description: "Por favor, selecciona un embudo donde se guardarán los leads",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id || !effectiveUserId) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      return;
    }

    const canCreate = await enforceLimit('whatsapp_connections', 1);
    if (!canCreate) {
      return;
    }

    setCreating(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, company_name, plan_type, profile_type, email')
        .eq('id', effectiveUserId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      let workspaceName = '';
      if (formData.workspace_id) {
        const workspace = workspaces.find(w => w.id === formData.workspace_id);
        workspaceName = workspace?.name || '';
      }

      const { data, error } = await supabase.functions.invoke('waha-create-session', {
        body: {
          user_id: effectiveUserId,
          session_name: formData.name,
          phone_number: formData.phone_number,
          workspace_id: formData.workspace_id || null,
          workspace_name: workspaceName,
          default_column_id: formData.default_column_id,
          email: profileData?.email || user.email,
          first_name: profileData?.first_name,
          last_name: profileData?.last_name,
          company_name: profileData?.company_name,
          plan_type: profileData?.plan_type,
        }
      });

      if (error) throw error;

      await incrementUsage('whatsapp_connections', 1);

      toast({
        title: "Conexión creada",
        description: "La conexión de WhatsApp se creó correctamente. Ahora puedes conectarla mediante código QR.",
      });

      setDialogOpen(false);
      setFormData({ name: '', phone_number: '', workspace_id: '', default_column_id: '' });
      fetchConnections();
    } catch (error: any) {
      console.error('Error creating connection:', error);
      
      let errorMessage = "No se pudo crear la conexión";
      const body = error?.context?.body;
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.error) errorMessage = String(parsed.error);
        } catch {}
      } else if (error?.message) {
        errorMessage = error.message;
      }
      if (errorMessage.length > 220) errorMessage = errorMessage.slice(0, 217) + '...';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (connectionId: string, connectionName: string) => {
    if (!effectiveUserId) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      return;
    }

    setDeleting(connectionId);
    try {
      // 1. Primero eliminar la sesión de WAHA
      const { error: wahaError } = await supabase.functions.invoke('waha-delete-session', {
        body: { 
          session_name: connectionName,
          connection_id: connectionId 
        }
      });

      // Si WAHA devuelve error, intentamos eliminar de BD de todas formas
      if (wahaError) {
        console.warn('Error deleting from WAHA (continuing with DB deletion):', wahaError);
        
        // Fallback: eliminar directamente de la BD
        const { error: dbError } = await supabase
          .from('whatsapp_connections')
          .delete()
          .eq('id', connectionId)
          .eq('user_id', effectiveUserId);

        if (dbError) throw dbError;
      }

      toast({
        title: "Conexión eliminada",
        description: `La conexión "${connectionName}" se eliminó correctamente`,
      });

      fetchConnections();
    } catch (error: any) {
      console.error('Error deleting connection:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la conexión",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleVerifyStatus = async (sessionName: string, connectionId: string) => {
    if (!effectiveUserId) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      return;
    }

    setVerifying(connectionId);
    
    try {
      const { data, error } = await supabase.functions.invoke('waha-session-status', {
        body: {
          session_name: sessionName,
          connection_id: connectionId,
          user_id: effectiveUserId,
          update_db: true // Solo verificación manual actualiza BD
        }
      });

      if (error) throw error;

      await fetchConnections();

      // El edge function ya devuelve estados normalizados: connected, disconnected, pending_qr
      const displayStatus = data.status || 'disconnected';

      toast({
        title: "Estado actualizado",
        description: `Estado de la conexión: ${displayStatus}`,
      });
    } catch (error) {
      console.error('Error al verificar estado:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar el estado de la conexión",
        variant: "destructive",
      });
    } finally {
      setVerifying(null);
    }
  };

  if (loading || userIdLoading) {
    return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Conexiones WhatsApp</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
    );
  }

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Conexiones WhatsApp</h1>
            <p className="text-muted-foreground mt-1">Gestiona tus conexiones de WhatsApp y mantén tus sesiones activas</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 transition-all duration-200 shadow-glow">
                <Plus className="h-4 w-4 mr-2" />
              Nueva Conexión
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva Conexión de WhatsApp</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la conexión</Label>
                <Input
                  id="name"
                  placeholder="Ej: WhatsApp Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Número de WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="Ej: +5491123456789"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace">Espacio de trabajo</Label>
                <Select
                  value={formData.workspace_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, workspace_id: value, default_column_id: '' });
                  }}
                  disabled={creating}
                >
                  <SelectTrigger id="workspace">
                    <SelectValue placeholder="Seleccionar espacio de trabajo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="column">Embudo para leads automáticos *</Label>
                <Select
                  value={formData.default_column_id}
                  onValueChange={(value) => setFormData({ ...formData, default_column_id: value })}
                  disabled={creating || leadColumns.length === 0}
                >
                  <SelectTrigger id="column">
                    <SelectValue placeholder="Seleccionar embudo" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadColumns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name} {column.is_default && '(Por defecto)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Los leads de WhatsApp se crearán automáticamente en este embudo
                </p>
              </div>
              <Button 
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600"
                disabled={creating}
              >
                {creating ? 'Creando conexión...' : 'Crear Conexión'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Modal QR */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp con Código QR</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna izquierda - Código QR */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                {qrLoading ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Generando código QR...</p>
                  </div>
                ) : qrImage ? (
                  <img 
                    src={qrImage} 
                    alt="Código QR de WhatsApp" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Código QR no disponible</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Sesión: <span className="font-medium">{currentSession}</span>
              </p>
            </div>
            
            {/* Columna derecha - Instrucciones */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Instrucciones para conectar</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">1</div>
                  <p className="text-sm">Abre WhatsApp en tu teléfono</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">2</div>
                  <p className="text-sm">Ve a <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong></p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">3</div>
                  <p className="text-sm">Toca <strong>"Vincular un dispositivo"</strong></p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">4</div>
                  <p className="text-sm">Escanea el código QR que aparece a la izquierda</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">5</div>
                  <p className="text-sm">Una vez conectado, haz clic en el botón de abajo</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleQRConnected}
                  className="w-full bg-emerald-500 hover:bg-emerald-600"
                  disabled={qrLoading || !qrImage}
                >
                  Ya he conectado mi WhatsApp
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <p><strong>Nota:</strong> El código QR es válido por tiempo limitado. Si expira, cierra esta ventana y vuelve a intentarlo.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alerta de límites */}
      <UsageLimitAlert resourceType="whatsapp_connections_used" />

      {connections.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No hay conexiones</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primera conexión de WhatsApp para comenzar a comunicarte con tus clientes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => {
            const isConnected = connection.status === 'conectado' || connection.status === 'working';
            return (
              <Card key={connection.id} className={`bg-gradient-to-br from-card to-card/80 border-l-4 transition-all duration-200 hover:shadow-lg ${
                isConnected ? 'border-l-primary' : 'border-l-destructive'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isConnected ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                      }`}>
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{connection.name}</h3>
                        <p className="text-sm text-muted-foreground">{connection.phone_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
                        {connection.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingSession(connection)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={deleting === connection.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar conexión?</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que quieres eliminar la conexión "{connection.name}"? 
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(connection.id, connection.name)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {deleting === connection.id ? 'Eliminando...' : 'Eliminar'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Creado: {new Date(connection.created_at).toLocaleDateString()}
                  </p>
                  
                  {/* Botones de acción */}
                  <div className="space-y-2">
                    {/* Botón Conectar con QR - Solo mostrar si no está conectado */}
                    {connection.status !== 'conectado' && connection.status !== 'working' && (
                      <Button 
                        onClick={() => handleQRConnect(connection.name)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={qrLoading}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Conectar con QR
                      </Button>
                    )}
                    
                    {/* Botón Verificar Estatus */}
                    <Button 
                      onClick={() => handleVerifyStatus(connection.name, connection.id)}
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={verifying === connection.id}
                    >
                      {verifying === connection.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Verificando...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verificar Estatus
                        </>
                      )}
                    </Button>
                    
                    {/* Mensaje para conexiones ya conectadas */}
                    {(connection.status === 'conectado' || connection.status === 'working') && (
                      <div className="w-full p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-md text-center">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                          ✓ WhatsApp conectado
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de edición de sesión */}
      {editingSession && (
        <EditSessionDialog
          open={!!editingSession}
          onClose={() => setEditingSession(null)}
          sessionType="whatsapp"
          session={{
            id: editingSession.id,
            name: editingSession.name,
            workspace_id: editingSession.workspace_id,
            default_column_id: editingSession.default_column_id
          }}
          onSuccess={fetchConnections}
        />
      )}

      <div className="flex items-center justify-center pt-8">
        <Button variant="outline" size="sm">
          <List className="h-4 w-4 mr-2" />
          Conexiones Existentes
        </Button>
      </div>
      </div>
    
  );
};

export default WhatsAppConnections;