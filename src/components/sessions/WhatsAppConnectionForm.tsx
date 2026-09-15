import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Loader2, QrCode, CheckCircle, X } from 'lucide-react';

interface WhatsAppConnectionFormProps {
  onClose: () => void;
}

interface Workspace {
  id: string;
  name: string;
}

interface LeadColumn {
  id: string;
  name: string;
  workspace_id: string | null;
}

const WhatsAppConnectionForm = ({ onClose }: WhatsAppConnectionFormProps) => {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState('');
  const [currentConnectionId, setCurrentConnectionId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const closingRef = useRef(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    workspace_id: '',
    default_column_id: '',
    n8n_webhook_url: ''
  });
  
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const { enforceLimit, incrementUsage } = useUsageLimits();

  useEffect(() => {
    if (effectiveUserId) {
      fetchWorkspaces();
      fetchLeadColumns();
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (formData.workspace_id && effectiveUserId) {
      fetchLeadColumns(formData.workspace_id);
    } else if (!formData.workspace_id && effectiveUserId) {
      fetchLeadColumns();
    }
  }, [formData.workspace_id, effectiveUserId]);

  const fetchWorkspaces = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('position');
    if (data) setWorkspaces(data);
  };

  const fetchLeadColumns = async (workspaceId?: string) => {
    if (!effectiveUserId) return;
    let query = supabase
      .from('lead_columns')
      .select('*')
      .eq('user_id', effectiveUserId);
    
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    const { data } = await query.order('position');
    if (data) setLeadColumns(data);
  };

  const handleClose = () => {
    setOpen(false);
    setQrModalOpen(false);
    setTimeout(onClose, 200);
  };

  const deleteSession = async (sessionName: string, connectionId: string) => {
    try {
      await supabase.functions.invoke('waha-delete-session', {
        body: {
          session_name: sessionName,
          connection_id: connectionId,
        },
      });
      setCurrentSession('');
      setCurrentConnectionId('');
    } catch (e) {
      // Ignorar
    }
  };

  const handleCancel = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (currentSession) {
      await deleteSession(currentSession, currentConnectionId);
    }
    handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!effectiveUserId) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.phone_number) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    const canCreate = await enforceLimit('whatsapp_connections');
    if (!canCreate) {
      toast({
        title: "Límite alcanzado",
        description: "Has alcanzado el límite de conexiones de WhatsApp para tu plan",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const cleanPhoneNumber = formData.phone_number.replace(/\D/g, '');
      
      // Crear sesión en WAHA primero
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('waha-create-session', {
        body: {
          user_id: effectiveUserId,
          session_name: formData.name,
          phone_number: cleanPhoneNumber,
          workspace_id: formData.workspace_id || null,
          default_column_id: formData.default_column_id || null,
          n8n_webhook_url: formData.n8n_webhook_url || null,
        }
      });

      if (sessionError) throw sessionError;

      if (!sessionData?.success) {
        throw new Error(sessionData?.error || 'Error al crear la sesión');
      }

      await incrementUsage('whatsapp_connections');

      toast({
        title: "Éxito",
        description: "Sesión creada correctamente",
      });

      // Usar el session_name sanitizado devuelto por el backend
      const sessionName = sessionData.connection?.name || formData.name;
      const connectionId = sessionData.connection?.id;
      setCurrentSession(sessionName);
      setCurrentConnectionId(connectionId);
      handleQRConnect(sessionName);
      
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la sesión",
        variant: "destructive",
      });
      if (currentSession) {
        deleteSession(currentSession, currentConnectionId);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleQRConnect = async (sessionName: string) => {
    setQrLoading(true);
    setQrModalOpen(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('waha-get-qr', {
        body: { session_name: sessionName }
      });

      if (error) throw error;

      if (data?.qr) {
        setQrImage(data.qr);
      }
    } catch (error: any) {
      console.error('Error getting QR:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo obtener el código QR",
        variant: "destructive",
      });
      setQrModalOpen(false);
      deleteSession(sessionName, currentConnectionId);
      handleClose();
    } finally {
      setQrLoading(false);
    }
  };

  const handleQRConnected = async () => {
    setVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('waha-session-status', {
        body: { 
          session_name: currentSession,
          connection_id: currentConnectionId,
          update_db: true // Solo verificación manual actualiza BD
        }
      });

      if (error) throw error;

      if (data?.status === 'connected') {
        toast({
          title: "¡Conectado!",
          description: "WhatsApp conectado correctamente",
        });

        setQrModalOpen(false);
        handleClose();
      } else {
        toast({
          title: "Aún no conectado",
          description: `Estado actual: ${data?.status || 'desconocido'}. Por favor escanea el código QR con tu teléfono`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error verifying connection:', error);
      toast({
        title: "Error",
        description: "No se pudo verificar la conexión",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;
    
    const confirmed = window.confirm('¿Estás seguro de que quieres eliminar esta sesión de WAHA?');
    if (!confirmed) return;

    try {
      const { error: wahaError } = await supabase.functions.invoke('waha-delete-session', {
        body: { 
          session_name: currentSession,
          connection_id: currentConnectionId 
        }
      });

      // Si hay error en WAHA pero tenemos connection_id, eliminar de BD como fallback
      if (wahaError) {
        console.warn('Error deleting from WAHA:', wahaError);
        if (currentConnectionId) {
          const { error: dbError } = await supabase
            .from('whatsapp_connections')
            .delete()
            .eq('id', currentConnectionId);
          if (dbError) throw dbError;
        }
      }

      toast({
        title: "Sesión eliminada",
        description: "La sesión de WAHA ha sido eliminada correctamente",
      });

      setQrModalOpen(false);
      handleClose();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la sesión",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span className="text-2xl">📱</span>
              <span>Conectar WhatsApp</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la conexión *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: WhatsApp Principal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de teléfono *</Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="593983859723"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace">Espacio de trabajo (opcional)</Label>
              <Select
                value={formData.workspace_id}
                onValueChange={(value) => setFormData({ ...formData, workspace_id: value, default_column_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un espacio" />
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
              <Label htmlFor="column">Columna predeterminada (opcional)</Label>
              <Select
                value={formData.default_column_id}
                onValueChange={(value) => setFormData({ ...formData, default_column_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una columna" />
                </SelectTrigger>
                <SelectContent>
                  {leadColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="n8n_webhook">Webhook n8n (opcional)</Label>
              <Input
                id="n8n_webhook"
                value={formData.n8n_webhook_url}
                onChange={(e) => setFormData({ ...formData, n8n_webhook_url: e.target.value })}
                placeholder="https://tu-n8n.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                Los mensajes entrantes se enviarán a esta URL para procesamiento con IA.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Crear y Conectar'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5" />
              <span>Escanear código QR</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center items-center min-h-[300px] bg-muted rounded-lg">
              {qrLoading ? (
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              ) : qrImage ? (
                <img src={qrImage} alt="QR Code" className="max-w-full h-auto" />
              ) : (
                <p className="text-muted-foreground">No se pudo cargar el código QR</p>
              )}
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                1. Abre WhatsApp en tu teléfono
              </p>
              <p className="text-sm text-muted-foreground">
                2. Ve a Configuración → Dispositivos vinculados
              </p>
              <p className="text-sm text-muted-foreground">
                3. Toca "Vincular un dispositivo" y escanea este código
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleQRConnected} 
                disabled={verifying}
                className="flex-1"
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verificar Conexión
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDeleteSession} 
                variant="destructive"
                disabled={verifying}
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Eliminar Sesión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppConnectionForm;
