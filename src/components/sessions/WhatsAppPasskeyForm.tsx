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
import { Loader2, KeyRound, Copy, CheckCircle, X, Shield, Globe } from 'lucide-react';

interface WhatsAppPasskeyFormProps {
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

const WhatsAppPasskeyForm = ({ onClose }: WhatsAppPasskeyFormProps) => {
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

  const [currentSession, setCurrentSession] = useState('');
  const [currentConnectionId, setCurrentConnectionId] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [passkeyRequired, setPasskeyRequired] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState('');
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
      toast({ title: 'Limite alcanzado', description: 'Has alcanzado el limite de conexiones de WhatsApp para tu plan', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const cleanPhoneNumber = formData.phone_number.replace(/\D/g, '');

      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('waha-create-session', {
        body: {
          user_id: effectiveUserId,
          session_name: formData.name,
          phone_number: cleanPhoneNumber,
          workspace_id: formData.workspace_id || null,
          default_column_id: formData.default_column_id || null,
          connection_subtype: 'passkey',
        },
      });

      if (sessionError) throw sessionError;
      if (!sessionData?.success) {
        throw new Error(sessionData?.error || 'Error al crear la sesion');
      }

      await incrementUsage('whatsapp_connections');

      const sessionName = sessionData.connection?.name || formData.name;
      const connectionId = sessionData.connection?.id;
      setCurrentSession(sessionName);
      setCurrentConnectionId(connectionId);

      toast({ title: 'Sesion creada', description: 'Solicitando codigo de emparejamiento...' });

      await requestCode(sessionName, cleanPhoneNumber);

    } catch (error: any) {
      console.error('Error creating session:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo crear la sesion', variant: 'destructive' });
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
          title: 'Error al generar codigo',
          description: result.error || 'No se pudo generar el codigo de emparejamiento',
          variant: 'destructive',
        });
        deleteSession(sessionName, currentConnectionId);
        setCreating(false);
      }
    } catch (error: any) {
      console.error('Error requesting code:', error);
      toast({ title: 'Error', description: error.message || 'No se pudo generar el codigo', variant: 'destructive' });
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
          toast({ title: 'Conectado!', description: 'WhatsApp conectado correctamente via Passkey' });
          setTimeout(() => handleClose(), 2500);
          return;
        }

        if (data?.waha_status === 'PASSKEY_REQUIRED') {
          setPasskeyRequired(true);
          setStatusText('Esperando passkey de la extension del navegador...');
        } else if (data?.waha_status === 'PASSKEY_CONFIRMATION_REQUIRED') {
          setPasskeyRequired(true);
          setStatusText('Confirmacion de passkey requerida...');
        } else if (data?.waha_status === 'STARTING') {
          setStatusText('Iniciando sesion...');
        } else {
          setStatusText(`Estado: ${data?.waha_status || data?.status || 'esperando...'}`);
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
      toast({ title: 'Copiado', description: 'Codigo copiado al portapapeles' });
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
            <span className="text-2xl">🔑</span>
            <span>Conectar WhatsApp con Passkey</span>
          </DialogTitle>
        </DialogHeader>

        {!pairingCode && !connected && (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pk-name">Nombre de la conexion *</Label>
              <Input
                id="pk-name"
                placeholder="ej: principal, ventas1, marketing2"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pk-phone">Tu numero de WhatsApp (con codigo de pais) *</Label>
              <Input
                id="pk-phone"
                placeholder="593999999999"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                El codigo se vinculara a este numero. WhatsApp debe estar disponible en el.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pk-workspace">Workspace</Label>
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
              <Label htmlFor="pk-column">Columna por defecto</Label>
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
              <Button type="submit" disabled={creating} className="flex-1 bg-amber-600 hover:bg-amber-700">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                {creating ? 'Generando...' : 'Conectar con Passkey'}
              </Button>
            </div>
          </form>
        )}

        {(pairingCode || creating) && !connected && (
          <div className="space-y-4 py-4">
            {creating && !pairingCode && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            )}

            {pairingCode && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Tu codigo de emparejamiento</p>
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
                      <li>Ve a <strong>Configuracion</strong> → <strong>Dispositivos vinculados</strong></li>
                      <li>Toca <strong>"Vincular con numero de telefono"</strong></li>
                      <li>Ingresa el codigo de arriba</li>
                    </ol>
                  </div>

                  {passkeyRequired && (
                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm space-y-2">
                      <p className="font-medium flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Shield className="h-4 w-4" />
                        Verificacion Passkey requerida
                      </p>
                      <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                        <li>Abre <strong>web.whatsapp.com</strong> en tu navegador</li>
                        <li>La extension WAHA Passkey completara la verificacion automaticamente</li>
                        <li>Asegurate de tener la extension instalada y activa</li>
                      </ol>
                    </div>
                  )}

                  {!passkeyRequired && (
                    <div className="bg-muted/50 rounded-md p-3 text-sm space-y-2">
                      <p className="font-medium flex items-center gap-1">
                        <Globe className="h-4 w-4" />
                        Metodo Passkey
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Despues de ingresar el codigo, se activara la verificacion Passkey automaticamente.
                        Asegurate de tener la extension WAHA Passkey instalada en tu navegador.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {statusText || 'Esperando emparejamiento...'}
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
              <p className="text-lg font-medium">Conectado!</p>
              <p className="text-sm text-muted-foreground">WhatsApp conectado correctamente via Passkey</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPasskeyForm;
