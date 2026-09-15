import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { wahaAdminService } from '@/services/wahaAdminService';
import { Loader2, KeyRound, Copy, CheckCircle, Clock, X } from 'lucide-react';

interface WhatsAppPairingCodeFormProps {
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

const WhatsAppPairingCodeForm = ({ onClose }: WhatsAppPairingCodeFormProps) => {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    workspace_id: '',
    default_column_id: '',
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);

  // Estado del código de emparejamiento
  const [currentSession, setCurrentSession] = useState('');
  const [currentConnectionId, setCurrentConnectionId] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [connected, setConnected] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);
  const closingRef = useRef(false);

  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const { enforceLimit, incrementUsage } = useUsageLimits();

  useEffect(() => {
    if (effectiveUserId) {
      fetchWorkspaces();
      fetchLeadColumns();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setOpen(false);
    setTimeout(onClose, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveUserId) {
      toast({ title: 'Error', description: 'Usuario no autenticado', variant: 'destructive' });
      return;
    }
    if (!formData.name || !formData.phone_number) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos requeridos', variant: 'destructive' });
      return;
    }

    const canCreate = await enforceLimit('whatsapp_connections');
    if (!canCreate) {
      toast({ title: 'Límite alcanzado', description: 'Has alcanzado el límite de conexiones de WhatsApp para tu plan', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const cleanPhoneNumber = formData.phone_number.replace(/\D/g, '');

      // 1. Crear la sesión en WAHA
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('waha-create-session', {
        body: {
          user_id: effectiveUserId,
          session_name: formData.name,
          phone_number: cleanPhoneNumber,
          workspace_id: formData.workspace_id || null,
          default_column_id: formData.default_column_id || null,
          connection_subtype: 'pairing_code',
        },
      });

      if (sessionError) throw sessionError;
      if (!sessionData?.success) {
        throw new Error(sessionData?.error || 'Error al crear la sesión');
      }

      await incrementUsage('whatsapp_connections');

      const sessionName = sessionData.connection?.name || formData.name;
      const connectionId = sessionData.connection?.id;
      setCurrentSession(sessionName);
      setCurrentConnectionId(connectionId);

      toast({ title: 'Sesión creada', description: 'Solicitando código de emparejamiento...' });

      // 2. Solicitar el código de emparejamiento
      await requestCode(sessionName, cleanPhoneNumber);

    } catch (error: any) {
      console.error('Error creating session:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo crear la sesión', variant: 'destructive' });
      if (currentSession) {
        deleteSession(currentSession, currentConnectionId);
      }
      setCreating(false);
    }
  };

  const requestCode = async (sessionName: string, phoneNumber: string) => {
    try {
      const result = await wahaAdminService.requestPairingCode(sessionName, phoneNumber);
      if (result.success && result.code) {
        setPairingCode(result.code);
        startPolling(sessionName);
      } else {
        toast({
          title: 'Error al generar código',
          description: result.error || 'No se pudo generar el código de emparejamiento',
          variant: 'destructive',
        });
        deleteSession(sessionName, currentConnectionId);
        setCreating(false);
      }
    } catch (error: any) {
      console.error('Error requesting code:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo generar el código', variant: 'destructive' });
      deleteSession(sessionName, currentConnectionId);
      setCreating(false);
    }
  };

  const startPolling = (sessionName: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('waha-session-status', {
          body: {
            session_name: sessionName,
            connection_id: currentConnectionId,
            update_db: true,
          },
        });
        if (error) return;
        if (data?.status === 'connected' || data?.waha_status === 'WORKING') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setConnected(true);
          toast({ title: '¡Conectado!', description: 'WhatsApp emparejado correctamente' });
          setTimeout(() => handleClose(), 2500);
        }
      } catch (e) {
        // Silenciar errores de polling
      }
    }, 5000);
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCodeCopied(true);
      toast({ title: 'Copiado', description: 'Código copiado al portapapeles' });
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' });
    }
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
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      await deleteSession(currentSession, currentConnectionId);
    }
    handleClose();
  };

  // Mostrar código con formato (A B C D - E F G H)
  const formatCode = (code: string) => {
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4, 8)}`;
    }
    return code;
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">🔗</span>
            <span>Conectar WhatsApp con código</span>
          </DialogTitle>
        </DialogHeader>

        {!pairingCode && !connected && (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pc-name">Nombre de la conexión *</Label>
              <Input
                id="pc-name"
                placeholder="ej: principal, ventas1, marketing2"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pc-phone">Tu número de WhatsApp (con código de país) *</Label>
              <Input
                id="pc-phone"
                placeholder="593999999999"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                El código se vinculará a este número. WhatsApp debe estar disponible en él.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pc-workspace">Workspace</Label>
              <Select value={formData.workspace_id} onValueChange={(value) => setFormData(prev => ({ ...prev, workspace_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pc-column">Columna por defecto</Label>
              <Select
                value={formData.default_column_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_column_id: value }))}
                disabled={leadColumns.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={leadColumns.length === 0 ? 'Sin columnas' : 'Seleccionar columna'} />
                </SelectTrigger>
                <SelectContent>
                  {leadColumns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={creating} className="flex-1">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                {creating ? 'Generando...' : 'Generar código'}
              </Button>
            </div>
          </form>
        )}

        {(pairingCode || creating) && !connected && (
          <div className="space-y-4 py-4">
            {creating && !pairingCode && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {pairingCode && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Tu código de emparejamiento</p>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="text-3xl font-mono font-bold tracking-widest hover:bg-muted px-4 py-2 rounded-md transition-colors inline-flex items-center gap-2"
                    >
                      {formatCode(pairingCode)}
                      {codeCopied ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    <p className="font-medium">En tu WhatsApp:</p>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                      <li>Ve a <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong></li>
                      <li>Toca <strong>"Vincular con número de teléfono"</strong></li>
                      <li>Ingresa el código de arriba</li>
                    </ol>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Esperando emparejamiento...
                  </div>
                </CardContent>
              </Card>
            )}

            <Button variant="outline" onClick={handleCancel} className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}

        {connected && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium">¡Conectado!</p>
              <p className="text-sm text-muted-foreground">WhatsApp emparejado correctamente</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPairingCodeForm;
