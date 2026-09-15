import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Loader2, CheckCircle, Copy, TestTube2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TwilioConnectionFormProps {
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

const TwilioConnectionForm = ({ onClose }: TwilioConnectionFormProps) => {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [connectionCreated, setConnectionCreated] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);
  const [formData, setFormData] = useState({
    connection_name: '',
    account_sid: '',
    auth_token: '',
    phone_number: '',
    workspace_id: '',
    default_column_id: '',
    n8n_webhook_url: ''
  });
  
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();

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

  // Reset test result when credentials change
  useEffect(() => {
    setTestResult(null);
  }, [formData.account_sid, formData.auth_token]);

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
    setTimeout(onClose, 200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "URL copiada al portapapeles",
    });
  };

  const testCredentials = async () => {
    if (!formData.account_sid || !formData.auth_token) {
      toast({
        title: "Error",
        description: "Ingresa Account SID y Auth Token para probar",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('twilio-verify-credentials', {
        body: {
          account_sid: formData.account_sid,
          auth_token: formData.auth_token
        }
      });

      if (error) throw error;

      if (data.valid) {
        setTestResult({ valid: true, message: `✓ ${data.message} - ${data.account_name}` });
        toast({
          title: "Conexión exitosa",
          description: `Cuenta válida: ${data.account_name}`,
        });
      } else {
        setTestResult({ valid: false, message: data.error });
        toast({
          title: "Credenciales inválidas",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error testing credentials:', error);
      setTestResult({ valid: false, message: 'Error al verificar' });
      toast({
        title: "Error",
        description: "No se pudo verificar las credenciales",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
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

    if (!formData.connection_name || !formData.account_sid || !formData.auth_token || !formData.phone_number) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const cleanPhoneNumber = formData.phone_number.replace(/\D/g, '');
      
      // Validar credenciales de Twilio
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('twilio-verify-credentials', {
        body: {
          account_sid: formData.account_sid,
          auth_token: formData.auth_token
        }
      });

      if (verifyError || !verifyData?.valid) {
        throw new Error(verifyData?.error || 'Credenciales de Twilio inválidas');
      }

      // Crear conexión en la base de datos
      const { data: connection, error: insertError } = await supabase
        .from('twilio_connections')
        .insert({
          user_id: effectiveUserId,
          connection_name: formData.connection_name,
          account_sid: formData.account_sid,
          auth_token: formData.auth_token,
          phone_number: cleanPhoneNumber,
          status: 'active',
          workspace_id: formData.workspace_id || null,
          default_column_id: formData.default_column_id || null,
          webhook_url: null, // Se actualizará después
          n8n_webhook_url: formData.n8n_webhook_url || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const generatedWebhookUrl = `https://pxvembsxhwvpotydtiqa.supabase.co/functions/v1/twilio-webhook?connectionId=${connection.id}`;
      
      // Guardar webhook_url en la conexión
      await supabase
        .from('twilio_connections')
        .update({ webhook_url: generatedWebhookUrl })
        .eq('id', connection.id);

      setWebhookUrl(generatedWebhookUrl);
      setConnectionCreated(true);

      toast({
        title: "¡Éxito!",
        description: "Conexión de Twilio creada correctamente",
      });
      
    } catch (error: any) {
      console.error('Error creating Twilio connection:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la conexión",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">📞</span>
            <span>Conectar Twilio WhatsApp</span>
          </DialogTitle>
        </DialogHeader>

        {!connectionCreated ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="connection_name">Nombre de la conexión *</Label>
              <Input
                id="connection_name"
                value={formData.connection_name}
                onChange={(e) => setFormData({ ...formData, connection_name: e.target.value })}
                placeholder="Ej: Twilio Principal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_sid">Account SID *</Label>
              <Input
                id="account_sid"
                value={formData.account_sid}
                onChange={(e) => setFormData({ ...formData, account_sid: e.target.value })}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth_token">Auth Token *</Label>
              <Input
                id="auth_token"
                type="password"
                value={formData.auth_token}
                onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
                placeholder="••••••••••••••••••••••••••••••••"
                required
              />
            </div>

            {/* Botón Probar Conexión */}
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={testCredentials}
                disabled={testing || !formData.account_sid || !formData.auth_token}
                className="flex-shrink-0"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    <TestTube2 className="mr-2 h-4 w-4" />
                    Probar Conexión
                  </>
                )}
              </Button>
              {testResult && (
                <div className={`flex items-center gap-1 text-sm ${testResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.valid ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de WhatsApp Business *</Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="1234567890 (sin + ni espacios)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Ingresa solo dígitos, sin el prefijo + (ej: 1234567890)
              </p>
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
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Crear Conexión
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                ¡Conexión creada exitosamente! Ahora configura el webhook en Twilio.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="font-semibold">URL del Webhook (copiar y pegar en Twilio)</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Método: <strong>HTTP POST</strong>
              </p>
            </div>

            <div className="space-y-2 text-sm bg-muted p-4 rounded-lg">
              <p className="font-semibold">📋 Instrucciones para configurar en Twilio:</p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Ve a <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.twilio.com</a></li>
                <li>Navega a <strong>Messaging → Try it out → Send a WhatsApp message</strong></li>
                <li>O ve a <strong>Messaging → Senders → WhatsApp senders</strong></li>
                <li>Selecciona tu número de WhatsApp</li>
                <li>En <strong>"When a message comes in"</strong>, pega la URL del webhook</li>
                <li>Asegúrate de que el método sea <strong>HTTP POST</strong></li>
                <li>Guarda los cambios</li>
              </ol>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleClose}>
                Finalizar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TwilioConnectionForm;
