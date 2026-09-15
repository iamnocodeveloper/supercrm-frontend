import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquarePlus, Phone, User, FileText, AlertCircle, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
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

interface FileAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

const CreateConversation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, loading: userIdLoading } = useEffectiveUserId();

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<FileAttachment | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');

  // Data
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Cargar conexiones WAHA del usuario
  useEffect(() => {
    if (!userIdLoading && effectiveUserId) {
      fetchConnections();
      fetchWorkspaces();
    }
  }, [effectiveUserId, userIdLoading]);

  // Cargar columnas del workspace seleccionado
  useEffect(() => {
    if (selectedWorkspaceId && effectiveUserId) {
      fetchColumns(selectedWorkspaceId);
    } else {
      setColumns([]);
      setSelectedColumnId('');
    }
  }, [selectedWorkspaceId, effectiveUserId]);

  const fetchConnections = async () => {
    if (!effectiveUserId) return;
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .select('id, name, phone_number, status, workspace_id, default_column_id')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading connections:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las sesiones WAHA', variant: 'destructive' });
    } else {
      setConnections(data || []);
    }
    setLoading(false);
  };

  const fetchWorkspaces = async () => {
    if (!effectiveUserId) return;
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('user_id', effectiveUserId)
      .order('name');
    if (error) {
      console.error('Error loading workspaces:', error);
    } else {
      setWorkspaces(data || []);
    }
  };

  const fetchColumns = async (workspaceId: string) => {
    if (!effectiveUserId) return;
    const { data, error } = await supabase
      .from('lead_columns')
      .select('id, name, is_default, workspace_id')
      .eq('user_id', effectiveUserId)
      .eq('workspace_id', workspaceId)
      .order('position');
    if (error) {
      console.error('Error loading columns:', error);
    } else {
      setColumns(data || []);
      // Auto-seleccionar la columna por defecto
      const defaultCol = (data || []).find((c) => c.is_default);
      if (defaultCol) {
        setSelectedColumnId(defaultCol.id);
      } else if (data && data.length > 0) {
        setSelectedColumnId(data[0].id);
      }
    }
  };

  // Auto-seleccionar workspace de la conexión al elegirla
  const handleConnectionChange = (value: string) => {
    setSelectedConnectionId(value);
    const conn = connections.find((c) => c.id === value);
    if (conn?.workspace_id) {
      setSelectedWorkspaceId(conn.workspace_id);
      if (conn.default_column_id) {
        // Se seteará cuando se carguen las columnas de ese workspace
      }
    }
  };

  // Subir archivo a Supabase Storage
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 16 * 1024 * 1024) {
      toast({ title: 'Archivo demasiado grande', description: 'Máximo 16 MB', variant: 'destructive' });
      return;
    }
    setUploadingFile(true);
    try {
      const ext = f.name.split('.').pop() || 'bin';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, f, { contentType: f.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      setFile({
        url: urlData.publicUrl,
        filename: f.name,
        mimeType: f.type,
        size: f.size,
      });
      toast({ title: 'Archivo listo', description: f.name });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingFile(false);
    }
  };

  // Validar formulario
  const validation = useMemo(() => {
    const phoneClean = phoneNumber.replace(/[^0-9+]/g, '');
    const validPhone = phoneClean.length >= 7 && phoneClean.length <= 16;
    const hasContent = message.trim().length > 0 || !!file;
    const validConnection = !!selectedConnectionId;
    const validColumn = !!selectedColumnId;
    const validWorkspace = !!selectedWorkspaceId;
    return {
      validPhone,
      hasContent,
      validConnection,
      validWorkspace,
      validColumn,
      isValid: validPhone && hasContent && validConnection && validWorkspace && validColumn,
    };
  }, [phoneNumber, message, file, selectedConnectionId, selectedWorkspaceId, selectedColumnId]);

  // Estado bloqueante si no hay estructura
  const hasStructure = workspaces.length > 0;

  const handleSubmit = async () => {
    if (!validation.isValid || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('waha-create-conversation', {
        body: {
          connection_id: selectedConnectionId,
          phone_number: phoneNumber.replace(/[^0-9+]/g, ''),
          contact_name: contactName.trim() || null,
          message: message.trim() || null,
          file: file
            ? { url: file.url, filename: file.filename, mimeType: file.mimeType }
            : null,
          column_id: selectedColumnId,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast({ title: 'Error', description: error.message || 'No se pudo crear la conversación', variant: 'destructive' });
        return;
      }

      const result = data as { success: boolean; error?: string; conversation_id?: string };
      if (!result?.success) {
        toast({ title: 'Error', description: result?.error || 'Error desconocido', variant: 'destructive' });
        return;
      }

      toast({
        title: 'Conversación creada',
        description: 'Mensaje enviado y conversación creada correctamente',
      });

      // Navegar a la conversación recién creada
      if (result.conversation_id) {
        navigate(`/conversaciones?conv=${result.conversation_id}`);
      } else {
        navigate('/conversaciones');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquarePlus className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">#Crear conversación</h1>
          <p className="text-sm text-muted-foreground">Envía un mensaje nuevo a un contacto (solo sesiones WAHA)</p>
        </div>
      </div>

      {!hasStructure && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sin estructura de embudos</AlertTitle>
          <AlertDescription>
            Necesitas crear al menos un <strong>workspace</strong> y una <strong>columna</strong> antes de poder crear conversaciones.
            <br />
            <Button
              variant="link"
              className="p-0 h-auto mt-2"
              onClick={() => navigate('/leads')}
            >
              Ir a Embudos para crear uno →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {hasStructure && connections.length === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sin sesiones WAHA</AlertTitle>
          <AlertDescription>
            No tienes ninguna sesión de WhatsApp conectada. Crea una primero en{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/conexiones')}>
              Conexiones WhatsApp
            </Button>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Destinatario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="phone">Número de teléfono (con código de país)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="593999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={!hasStructure || connections.length === 0}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Se enviará al número con código internacional. Solo dígitos, sin '+'.
            </p>
          </div>
          <div>
            <Label htmlFor="contact">Nombre del contacto (opcional)</Label>
            <Input
              id="contact"
              placeholder="Juan Pérez"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={!hasStructure || connections.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si se omite, se usará el número como nombre del lead.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Sesión de WhatsApp
          </CardTitle>
          <CardDescription>Selecciona desde qué sesión de WhatsApp se enviará el mensaje</CardDescription>
        </CardHeader>
        <CardContent>
              <Select value={selectedConnectionId} onValueChange={handleConnectionChange} disabled={connections.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una sesión de WhatsApp" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <span>{c.name}</span>
                    {c.phone_number && <span className="text-muted-foreground text-xs">+{c.phone_number}</span>}
                    <Badge variant={c.status === 'WORKING' ? 'default' : 'secondary'} className="ml-2">
                      {c.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mensaje inicial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Escribe el mensaje que se enviará..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={!hasStructure || connections.length === 0}
          />
          {file && (
            <div className="flex items-center gap-2 p-2 border rounded">
              {file.mimeType.startsWith('image/') ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="text-sm flex-1 truncate">{file.filename}</span>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploadingFile || !hasStructure || connections.length === 0}
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {file ? 'Cambiar archivo' : 'Adjuntar archivo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embudo destino</CardTitle>
          <CardDescription>Dónde se creará el lead de esta conversación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Workspace</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId} disabled={workspaces.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedWorkspaceId && (
            <div>
              <Label>Columna</Label>
              <Select value={selectedColumnId} onValueChange={setSelectedColumnId} disabled={columns.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={columns.length === 0 ? 'Sin columnas en este workspace' : 'Selecciona columna'} />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.is_default && <span className="text-xs text-muted-foreground">(por defecto)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/conversaciones')} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!validation.isValid || submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar y crear
        </Button>
      </div>
    </div>
  );
};

export default CreateConversation;
