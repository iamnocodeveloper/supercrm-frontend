import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Loader2, AlertTriangle, Pencil } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SessionGroupsSection } from '@/components/whatsapp/SessionGroupsSection';

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

type SessionType = 'whatsapp' | 'twilio' | 'telegram' | 'webchat';

interface EditSessionDialogProps {
  open: boolean;
  onClose: () => void;
  sessionType: SessionType;
  session: {
    id: string;
    name: string;
    workspace_id?: string | null;
    default_column_id?: string | null;
  };
  onSuccess: () => void;
}

const EditSessionDialog = ({ open, onClose, sessionType, session, onSuccess }: EditSessionDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [migrateConversations, setMigrateConversations] = useState(false);
  const [formData, setFormData] = useState({
    name: session.name,
    workspace_id: session.workspace_id || '',
    default_column_id: session.default_column_id || '',
    n8n_webhook_url: ''
  });
  const [originalWorkspaceId, setOriginalWorkspaceId] = useState(session.workspace_id || '');
  
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();

  // Cargar datos iniciales
  useEffect(() => {
    if (open && effectiveUserId) {
      setFormData({
        name: session.name,
        workspace_id: session.workspace_id || '',
        default_column_id: session.default_column_id || '',
        n8n_webhook_url: ''
      });
      setOriginalWorkspaceId(session.workspace_id || '');
      setMigrateConversations(false);
      fetchWorkspaces();
      fetchLeadColumns(session.workspace_id || undefined);
      fetchConversationCount();
      fetchN8nWebhookUrl();
    }
  }, [open, session, effectiveUserId]);

  const fetchN8nWebhookUrl = async () => {
    if (!effectiveUserId) return;
    // Solo WhatsApp y Twilio tienen n8n_webhook_url
    if (sessionType === 'telegram' || sessionType === 'webchat') return;
    
    const tableName = getTableName();
    const { data } = await supabase
      .from(tableName)
      .select('n8n_webhook_url')
      .eq('id', session.id)
      .single();
    if (data && 'n8n_webhook_url' in data && data.n8n_webhook_url) {
      setFormData(prev => ({ ...prev, n8n_webhook_url: data.n8n_webhook_url as string }));
    }
  };

  // Cargar columnas cuando cambia el workspace
  useEffect(() => {
    if (formData.workspace_id && effectiveUserId) {
      fetchLeadColumns(formData.workspace_id);
    }
  }, [formData.workspace_id, effectiveUserId]);

  const fetchWorkspaces = async () => {
    if (!effectiveUserId) return;
    let query = supabase
      .from('workspaces')
      .select('id, name, channel_type')
      .eq('user_id', effectiveUserId);
    
    // Filtrar por channel_type según el tipo de sesión
    if (sessionType === 'webchat') {
      query = query.or('channel_type.eq.webchat,channel_type.eq.all');
    } else {
      // Para WhatsApp, Twilio, Telegram - excluir webchat exclusivo
      query = query.or('channel_type.is.null,channel_type.neq.webchat');
    }
    
    const { data } = await query.order('position');
    if (data) setWorkspaces(data);
  };

  const fetchLeadColumns = async (workspaceId?: string) => {
    if (!effectiveUserId) return;
    let query = supabase
      .from('lead_columns')
      .select('id, name, is_default, workspace_id')
      .eq('user_id', effectiveUserId);
    
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    const { data } = await query.order('position');
    if (data) {
      setLeadColumns(data);
      // Auto-seleccionar columna por defecto si no hay selección
      if (!formData.default_column_id && data.length > 0) {
        const defaultCol = data.find(c => c.is_default) || data[0];
        setFormData(prev => ({ ...prev, default_column_id: defaultCol.id }));
      }
    }
  };

  const fetchConversationCount = async () => {
    if (!effectiveUserId) return;

    // Contar conversaciones asociadas a esta sesión
    if (sessionType === 'whatsapp') {
      // Para WAHA, las conversaciones se relacionan por whatsapp_number (nombre de sesión)
      const { data: connectionData } = await supabase
        .from('whatsapp_connections')
        .select('name')
        .eq('id', session.id)
        .single();
      
      if (connectionData) {
        const { count } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId)
          .eq('whatsapp_number', connectionData.name);
        setConversationCount(count || 0);
      }
    } else if (sessionType === 'twilio') {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('twilio_connection_id', session.id);
      setConversationCount(count || 0);
    } else if (sessionType === 'telegram') {
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_bot_id', session.id);
      setConversationCount(count || 0);
    } else if (sessionType === 'webchat') {
      // Para webchat, contar conversaciones con channel_type = 'webchat' del usuario
      // No hay un campo específico de webchat_id en conversations, usamos channel_type
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .eq('channel_type', 'webchat');
      setConversationCount(count || 0);
    }
  };

  const workspaceChanged = formData.workspace_id !== originalWorkspaceId;

  const getTableName = (): 'whatsapp_connections' | 'twilio_connections' | 'telegram_bots' | 'web_chatbots' => {
    switch (sessionType) {
      case 'whatsapp': return 'whatsapp_connections';
      case 'twilio': return 'twilio_connections';
      case 'telegram': return 'telegram_bots';
      case 'webchat': return 'web_chatbots';
    }
  };

  const getNameField = (): string => {
    switch (sessionType) {
      case 'whatsapp': return 'name';
      case 'twilio': return 'connection_name';
      case 'telegram': return 'bot_name';
      case 'webchat': return 'name';
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

    setSaving(true);
    try {
      const tableName = getTableName();
      const nameField = getNameField();

      // Actualizar la sesión
      const updateData: Record<string, any> = {
        [nameField]: formData.name,
        workspace_id: formData.workspace_id || null,
        default_column_id: formData.default_column_id || null,
      };
      
      // Solo agregar n8n_webhook_url para WhatsApp y Twilio
      if (sessionType !== 'telegram' && sessionType !== 'webchat') {
        updateData.n8n_webhook_url = formData.n8n_webhook_url || null;
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', session.id);

      if (updateError) throw updateError;

      // Si el workspace cambió y el usuario quiere migrar conversaciones
      if (workspaceChanged && migrateConversations && formData.default_column_id) {
        await migrateConversationsToNewWorkspace();
      }

      toast({
        title: "Éxito",
        description: migrateConversations && workspaceChanged 
          ? `Sesión actualizada y ${conversationCount} conversaciones migradas`
          : "Sesión actualizada correctamente",
      });

      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('Error updating session:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la sesión",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const migrateConversationsToNewWorkspace = async () => {
    if (!effectiveUserId || !formData.default_column_id) return;

    // Obtener la columna destino
    const targetColumnId = formData.default_column_id;

    // Buscar conversaciones y sus leads asociados
    let conversationQuery;
    
    if (sessionType === 'whatsapp') {
      const { data: connectionData } = await supabase
        .from('whatsapp_connections')
        .select('name')
        .eq('id', session.id)
        .single();
      
      if (!connectionData) return;
      
      conversationQuery = supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('user_id', effectiveUserId)
        .eq('whatsapp_number', connectionData.name);
    } else if (sessionType === 'twilio') {
      conversationQuery = supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('twilio_connection_id', session.id);
    } else if (sessionType === 'telegram') {
      conversationQuery = supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('telegram_bot_id', session.id);
    } else if (sessionType === 'webchat') {
      conversationQuery = supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('user_id', effectiveUserId)
        .eq('channel_type', 'webchat');
    } else {
      return;
    }

    const { data: conversations } = await conversationQuery;
    
    if (!conversations || conversations.length === 0) return;

    // Obtener IDs de leads únicos
    const leadIds = [...new Set(conversations.map(c => c.lead_id).filter(Boolean))] as string[];
    
    if (leadIds.length === 0) return;

    // Actualizar los leads a la nueva columna
    const { error: leadsError } = await supabase
      .from('leads')
      .update({ column_id: targetColumnId })
      .in('id', leadIds);

    if (leadsError) {
      console.error('Error migrating leads:', leadsError);
      throw new Error('Error al migrar los leads');
    }

    console.log(`Migrated ${leadIds.length} leads to column ${targetColumnId}`);
  };

  const getSessionTypeName = () => {
    switch (sessionType) {
      case 'whatsapp': return 'WhatsApp';
      case 'twilio': return 'Twilio';
      case 'telegram': return 'Telegram';
      case 'webchat': return 'Web Chat';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Pencil className="h-5 w-5" />
            <span>Editar Sesión de {getSessionTypeName()}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la sesión</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre de la conexión"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace">Espacio de trabajo</Label>
            <Select
              value={formData.workspace_id}
              onValueChange={(value) => {
                setFormData({ ...formData, workspace_id: value, default_column_id: '' });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar espacio de trabajo" />
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
            <Label htmlFor="column">Embudo / Columna predeterminada</Label>
            <Select
              value={formData.default_column_id}
              onValueChange={(value) => setFormData({ ...formData, default_column_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar columna" />
              </SelectTrigger>
              <SelectContent>
                {leadColumns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.name} {column.is_default && '(Por defecto)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Solo mostrar webhook n8n para WhatsApp y Twilio */}
          {sessionType !== 'telegram' && sessionType !== 'webchat' && (
            <div className="space-y-2">
              <Label htmlFor="n8n_webhook">Webhook n8n (opcional)</Label>
              <Input
                id="n8n_webhook"
                value={formData.n8n_webhook_url}
                onChange={(e) => setFormData({ ...formData, n8n_webhook_url: e.target.value })}
                placeholder="https://tu-n8n.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                Los mensajes entrantes se enviarán a esta URL para procesamiento con IA externa.
              </p>
            </div>
          )}

          {/* Solo WhatsApp: gestión rápida de grupos de la sesión */}
          {sessionType === 'whatsapp' && (
            <div className="border-t border-border pt-4">
              <SessionGroupsSection sessionId={session.id} sessionName={session.name} />
            </div>
          )}

          {/* Mostrar checkbox de migración solo si cambió el workspace */}
          {workspaceChanged && conversationCount > 0 && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="migrate"
                    checked={migrateConversations}
                    onCheckedChange={(checked) => setMigrateConversations(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="migrate" className="text-sm cursor-pointer">
                    Mover las <strong>{conversationCount} conversaciones existentes</strong> al nuevo embudo
                  </label>
                </div>
                <p className="text-xs mt-2 ml-6 text-amber-600 dark:text-amber-400">
                  Si no marcas esta opción, solo las nuevas conversaciones irán al nuevo embudo.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {workspaceChanged && conversationCount === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay conversaciones existentes para migrar.
            </p>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSessionDialog;
