import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Bot, Loader2, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/logger';

interface TelegramBotConnectionFormProps {
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

const TelegramBotConnectionForm = ({ onClose }: TelegramBotConnectionFormProps) => {
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [leadColumns, setLeadColumns] = useState<LeadColumn[]>([]);
  const [formData, setFormData] = useState({
    bot_name: '',
    bot_token: '',
    workspace_id: '',
    default_column_id: ''
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

    if (!formData.bot_name || !formData.bot_token) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    let insertedBotId: string | null = null;
    
    try {
      // Paso 1: Validar el token con Telegram API
      logger.debug('[TelegramBot] Validando token con Telegram API...');
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${formData.bot_token}/getMe`);
      
      if (!botInfoResponse.ok) {
        throw new Error('No se pudo conectar con Telegram API');
      }
      
      const botInfoData = await botInfoResponse.json();
      
      if (!botInfoData.ok) {
        throw new Error('Token de bot inválido. Verifica que el token sea correcto.');
      }

      const botInfo = botInfoData.result;
      logger.debug('[TelegramBot] Token válido. Bot:', botInfo.username);
      
      // Paso 2: Insertar el bot en la base de datos
      logger.debug('[TelegramBot] Creando registro en base de datos...');
      const { data: insertedBot, error: insertError } = await supabase
        .from('telegram_bots')
        .insert({
          user_id: effectiveUserId,
          bot_name: formData.bot_name,
          bot_token: formData.bot_token,
          bot_id: botInfo.id,
          bot_username: botInfo.username,
          status: 'active',
          workspace_id: formData.workspace_id || null,
          default_column_id: formData.default_column_id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[TelegramBot] Error al insertar en DB:', insertError);
        throw new Error('No se pudo guardar el bot en la base de datos');
      }
      
      insertedBotId = insertedBot.id;
      console.log('[TelegramBot] Bot guardado con ID:', insertedBotId);

      // Paso 3: Configurar webhook del bot
      const webhookUrl = `https://pxvembsxhwvpotydtiqa.supabase.co/functions/v1/telegram-bot-webhook?bot_db_id=${insertedBot.id}`;
      console.log('[TelegramBot] Configurando webhook:', webhookUrl);
      
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${formData.bot_token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      
      if (!webhookResponse.ok) {
        throw new Error('No se pudo configurar el webhook en Telegram');
      }
      
      const webhookData = await webhookResponse.json();
      
      if (!webhookData.ok) {
        throw new Error(`Error de Telegram: ${webhookData.description || 'No se pudo configurar el webhook'}`);
      }

      console.log('[TelegramBot] Webhook configurado correctamente');

      // Paso 4: Actualizar el bot con la URL del webhook
      const { error: updateError } = await supabase
        .from('telegram_bots')
        .update({ webhook_url: webhookUrl })
        .eq('id', insertedBot.id);
      
      if (updateError) {
        console.error('[TelegramBot] Error al actualizar webhook_url:', updateError);
        // No lanzamos error aquí porque el webhook ya está configurado
      }

      console.log('[TelegramBot] ✅ Bot de Telegram creado y configurado exitosamente');

      toast({
        title: "Éxito",
        description: `Bot @${botInfo.username} creado y configurado correctamente`,
      });

      handleClose();
      
    } catch (error: any) {
      console.error('[TelegramBot] ❌ Error en el proceso:', error);
      
      // Si se creó el bot pero falló la configuración del webhook, intentar limpiarlo
      if (insertedBotId) {
        console.log('[TelegramBot] Limpiando bot incompleto...');
        await supabase
          .from('telegram_bots')
          .delete()
          .eq('id', insertedBotId);
      }
      
      toast({
        title: "Error al crear el bot",
        description: error.message || "No se pudo crear el bot de Telegram",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">🤖</span>
            <span>Conectar Bot de Telegram</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 p-3 bg-telegram-blue/10 rounded-lg border border-telegram-blue/20">
          <p className="text-sm text-muted-foreground mb-2">
            Para crear un bot de Telegram, habla con{' '}
            <a 
              href="https://t.me/BotFather" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-telegram-blue hover:underline inline-flex items-center"
            >
              @BotFather
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
            {' '}en Telegram y sigue las instrucciones.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot_name">Nombre del Bot *</Label>
            <Input
              id="bot_name"
              value={formData.bot_name}
              onChange={(e) => setFormData({ ...formData, bot_name: e.target.value })}
              placeholder="Mi Bot de Telegram"
              required
            />
            <p className="text-xs text-muted-foreground">
              Un nombre descriptivo para identificar tu bot
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot_token">Bot Token *</Label>
            <Input
              id="bot_token"
              type="password"
              value={formData.bot_token}
              onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              required
            />
            <p className="text-xs text-muted-foreground">
              El token que te proporcionó @BotFather
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Crear Bot
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramBotConnectionForm;
