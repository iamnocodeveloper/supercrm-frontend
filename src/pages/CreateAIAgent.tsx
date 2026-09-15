import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Bot, Save, X, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string | null;
}

interface TelegramBot {
  id: string;
  bot_name: string;
  bot_username: string | null;
  status: string | null;
}

interface WebChatbot {
  id: string;
  name: string;
  is_active: boolean | null;
}

interface FormData {
  name: string;
  channel_type: 'whatsapp' | 'telegram' | 'webchat' | 'none';
  whatsapp_connection_id: string;
  telegram_bot_id: string;
  web_chatbot_id: string;
  instructions: string;
  message_delay: number;
  is_active: boolean;
}

const CreateAIAgent = () => {
  const navigate = useNavigate();
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);
  const [telegramBots, setTelegramBots] = useState<TelegramBot[]>([]);
  const [webChatbots, setWebChatbots] = useState<WebChatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    channel_type: 'none',
    whatsapp_connection_id: 'none',
    telegram_bot_id: 'none',
    web_chatbot_id: 'none',
    instructions: '',
    message_delay: 1,
    is_active: false
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadConnections();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      
      // Cargar conexiones de WhatsApp
      const { data: whatsappData, error: whatsappError } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (whatsappError) throw whatsappError;
      setWhatsappConnections(whatsappData || []);

      // Cargar bots de Telegram
      const { data: telegramData, error: telegramError } = await supabase
        .from('telegram_bots')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (telegramError) throw telegramError;
      setTelegramBots(telegramData || []);

      // Cargar Web Chatbots
      const { data: webChatData, error: webChatError } = await supabase
        .from('web_chatbots')
        .select('id, name, is_active')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (webChatError) throw webChatError;
      setWebChatbots(webChatData || []);
      
    } catch (error) {
      console.error('Error loading connections:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las conexiones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.instructions.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      await createAgent();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const createAgent = async () => {
    try {
      const agentData: any = {
        user_id: user?.id!,
        name: formData.name.trim(),
        system_prompt: formData.instructions.trim(),
        is_active: formData.is_active,
        channel_type: formData.channel_type === 'none' ? 'all' : formData.channel_type,
      };

      // Asignar la conexión según el tipo de canal
      if (formData.channel_type === 'whatsapp' && formData.whatsapp_connection_id !== 'none') {
        agentData.whatsapp_connection_id = formData.whatsapp_connection_id;
      } else if (formData.channel_type === 'telegram' && formData.telegram_bot_id !== 'none') {
        agentData.telegram_bot_id = formData.telegram_bot_id;
      } else if (formData.channel_type === 'webchat' && formData.web_chatbot_id !== 'none') {
        agentData.web_chatbot_id = formData.web_chatbot_id;
      }
      
      const { data, error } = await supabase
        .from('ai_agents')
        .insert(agentData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Agente de IA creado correctamente"
      });

      setTimeout(() => {
        navigate('/asistente-ia');
      }, 1500);
      
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el agente de IA",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    navigate('/asistente-ia');
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
    );
  }

  return (
    
      <div className="space-y-6">
        <div className="flex items-center space-x-3 mb-6">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Agentes
          </Button>
        </div>
        <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-to-br from-card to-card/80 border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-foreground">Crear Nuevo Agente de IA</CardTitle>
                  <p className="text-muted-foreground mt-1">
                    Configura un nuevo asistente de inteligencia artificial
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Agente *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Asistente de Ventas"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="channel_type">Tipo de Canal *</Label>
                <Select
                  value={formData.channel_type}
                  onValueChange={(value: any) => setFormData(prev => ({ 
                    ...prev, 
                    channel_type: value,
                    whatsapp_connection_id: 'none',
                    telegram_bot_id: 'none',
                    web_chatbot_id: 'none'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo de canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin canal específico</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="telegram">Telegram Bot</SelectItem>
                    <SelectItem value="webchat">Web Chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.channel_type === 'whatsapp' && (
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_connection">Conexión WhatsApp</Label>
                  <Select
                    value={formData.whatsapp_connection_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, whatsapp_connection_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar conexión" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin conexión</SelectItem>
                      {whatsappConnections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{connection.name} ({connection.phone_number})</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              connection.status === 'conectado' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {connection.status || 'desconectado'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.channel_type === 'telegram' && (
                <div className="space-y-2">
                  <Label htmlFor="telegram_bot">Bot de Telegram</Label>
                  <Select
                    value={formData.telegram_bot_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, telegram_bot_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar bot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin bot</SelectItem>
                      {telegramBots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{bot.bot_name} (@{bot.bot_username})</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              bot.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {bot.status || 'inactivo'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.channel_type === 'webchat' && (
                <div className="space-y-2">
                  <Label htmlFor="web_chatbot">Web Chatbot</Label>
                  <Select
                    value={formData.web_chatbot_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, web_chatbot_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar chatbot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin chatbot</SelectItem>
                      {webChatbots.map((chatbot) => (
                        <SelectItem key={chatbot.id} value={chatbot.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{chatbot.name}</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                              chatbot.is_active 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {chatbot.is_active ? 'activo' : 'inactivo'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="instructions">Instrucciones del Agente *</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  placeholder="Describe cómo debe comportarse el agente, qué respuestas debe dar, etc."
                  rows={8}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="message_delay">Retraso de Mensaje (segundos)</Label>
                  <Input
                    id="message_delay"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={formData.message_delay}
                    onChange={(e) => setFormData(prev => ({ ...prev, message_delay: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="is_active">Estado del Agente</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active" className="text-sm">
                      {formData.is_active ? 'Activo' : 'Inactivo'}
                    </Label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-6 border-t">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Crear Agente
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    
  );
};

export default CreateAIAgent;