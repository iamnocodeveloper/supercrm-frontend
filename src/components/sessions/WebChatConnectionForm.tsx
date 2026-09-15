import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { toast } from 'sonner';
import { Upload, Copy, Check, MessageCircle, X, Send, Image } from 'lucide-react';

interface WebChatConfig {
  name: string;
  logoUrl: string;
  backgroundImageUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  placeholderText: string;
  position: 'bottom-right' | 'bottom-left';
  aiAgentId: string | null;
  widgetType: 'floating' | 'embedded';
  width: string;
  height: string;
}

interface AIAgent {
  id: string;
  name: string;
}

interface WebChatConnectionFormProps {
  onClose: () => void;
}

const COLOR_PALETTE = [
  '#00a884', '#128C7E', '#075E54', '#25D366',
  '#34B7F1', '#0088cc', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981',
];

export default function WebChatConnectionForm({ onClose }: WebChatConnectionFormProps) {
  const { effectiveUserId } = useEffectiveUserId();
  const [config, setConfig] = useState<WebChatConfig>({
    name: 'Asistente Virtual',
    logoUrl: '',
    backgroundImageUrl: '',
    primaryColor: '#00a884',
    welcomeMessage: '¡Hola! ¿En qué puedo ayudarte?',
    placeholderText: 'Escribe tu mensaje...',
    position: 'bottom-right',
    aiAgentId: null,
    widgetType: 'floating',
    width: '400px',
    height: '600px'
  });
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [effectiveUserId]);

  const fetchAgents = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('ai_agents')
      .select('id, name')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true);
    if (data) setAgents(data);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveUserId) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${effectiveUserId}/webchat-logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      setConfig(prev => ({ ...prev, logoUrl: publicUrl }));
      toast.success('Logo subido correctamente');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Error al subir el logo');
    } finally {
      setUploading(false);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveUserId) return;

    setUploadingBg(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${effectiveUserId}/webchat-bg-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      setConfig(prev => ({ ...prev, backgroundImageUrl: publicUrl }));
      toast.success('Imagen de fondo subida correctamente');
    } catch (error) {
      console.error('Error uploading background:', error);
      toast.error('Error al subir la imagen de fondo');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveUserId) return;
    if (!config.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('web_chatbots')
        .insert({
          user_id: effectiveUserId,
          name: config.name,
          logo_url: config.logoUrl || null,
          background_image_url: config.backgroundImageUrl || null,
          primary_color: config.primaryColor,
          welcome_message: config.welcomeMessage,
          placeholder_text: config.placeholderText,
          position: config.position,
          ai_agent_id: config.aiAgentId,
          widget_type: config.widgetType,
          width: config.width,
          height: config.height
        })
        .select()
        .single();

      if (error) throw error;
      
      setSavedId(data.id);
      toast.success('Web Chatbot creado correctamente');
    } catch (error) {
      console.error('Error saving webchat:', error);
      toast.error('Error al guardar el chatbot');
    } finally {
      setSaving(false);
    }
  };

  const getEmbedScript = () => {
    if (!savedId) return '';
    
    if (config.widgetType === 'embedded') {
      return `<!-- Web Chat Embebido -->
<div id="webchat-embedded-container" style="width: ${config.width}; height: ${config.height};"></div>
<script src="https://pxvembsxhwvpotydtiqa.supabase.co/functions/v1/web-chat-widget-embedded?id=${savedId}" async></script>`;
    }
    
    return `<!-- Web Chatbot Widget -->
<script>
(function() {
  var s = document.createElement('script');
  s.src = 'https://pxvembsxhwvpotydtiqa.supabase.co/functions/v1/web-chat-widget?id=${savedId}';
  s.async = true;
  document.body.appendChild(s);
})();
</script>`;
  };

  const copyScript = () => {
    navigator.clipboard.writeText(getEmbedScript());
    setCopied(true);
    toast.success('Script copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Web Chatbot</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Form */}
          <div className="space-y-4">
            <div>
              <Label>Nombre del Chat</Label>
              <Input
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Asistente Virtual"
              />
            </div>

            <div>
              <Label>Tipo de Widget</Label>
              <Tabs 
                value={config.widgetType} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, widgetType: v as 'floating' | 'embedded' }))}
                className="mt-2"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="floating">Flotante</TabsTrigger>
                  <TabsTrigger value="embedded">Embebido</TabsTrigger>
                </TabsList>
                <TabsContent value="floating" className="text-sm text-muted-foreground mt-2">
                  Icono flotante que abre un modal de chat
                </TabsContent>
                <TabsContent value="embedded" className="text-sm text-muted-foreground mt-2">
                  Chat siempre visible para insertar en tu página
                </TabsContent>
              </Tabs>
            </div>

            {config.widgetType === 'embedded' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ancho</Label>
                  <Input
                    value={config.width}
                    onChange={(e) => setConfig(prev => ({ ...prev, width: e.target.value }))}
                    placeholder="400px o 100%"
                  />
                </div>
                <div>
                  <Label>Alto</Label>
                  <Input
                    value={config.height}
                    onChange={(e) => setConfig(prev => ({ ...prev, height: e.target.value }))}
                    placeholder="600px o 100vh"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.logoUrl ? (
                  <div className="relative">
                    <img src={config.logoUrl} alt="Logo" className="w-12 h-12 rounded-full object-cover" />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, logoUrl: '' }))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={uploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Subiendo...' : 'Subir Logo'}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <Label>Imagen de Fondo (opcional)</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.backgroundImageUrl ? (
                  <div className="relative">
                    <img src={config.backgroundImageUrl} alt="Background" className="w-16 h-12 rounded object-cover" />
                    <button
                      onClick={() => setConfig(prev => ({ ...prev, backgroundImageUrl: '' }))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-12 rounded bg-muted flex items-center justify-center">
                    <Image className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={uploadingBg} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingBg ? 'Subiendo...' : 'Subir Fondo'}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <Label>Color Principal</Label>
              <div className="grid grid-cols-10 gap-2 mt-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => setConfig(prev => ({ ...prev, primaryColor: color }))}
                    className={`w-7 h-7 rounded-full transition-all ${
                      config.primaryColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Mensaje de Bienvenida</Label>
              <Textarea
                value={config.welcomeMessage}
                onChange={(e) => setConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                placeholder="¡Hola! ¿En qué puedo ayudarte?"
                rows={2}
              />
            </div>

            <div>
              <Label>Texto del Placeholder</Label>
              <Input
                value={config.placeholderText}
                onChange={(e) => setConfig(prev => ({ ...prev, placeholderText: e.target.value }))}
                placeholder="Escribe tu mensaje..."
              />
            </div>

            {config.widgetType === 'floating' && (
              <div>
                <Label>Posición</Label>
                <Select
                  value={config.position}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, position: v as 'bottom-right' | 'bottom-left' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Abajo Derecha</SelectItem>
                    <SelectItem value="bottom-left">Abajo Izquierda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Agente de IA</Label>
              <Select
                value={config.aiAgentId || 'none'}
                onValueChange={(v) => setConfig(prev => ({ ...prev, aiAgentId: v === 'none' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin agente (solo bienvenida)</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {savedId ? (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <Label>Script para insertar en tu web:</Label>
                <pre className="text-xs bg-background p-3 rounded overflow-x-auto whitespace-pre-wrap">
                  {getEmbedScript()}
                </pre>
                <Button onClick={copyScript} className="w-full">
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copiado!' : 'Copiar Script'}
                </Button>
              </div>
            ) : (
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Guardando...' : 'Guardar y Generar Script'}
              </Button>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="relative bg-gradient-to-br from-muted/50 to-muted rounded-lg p-4 min-h-[500px]">
            <div className="text-center text-sm text-muted-foreground mb-4">
              Vista previa del widget
            </div>
            
            {config.widgetType === 'embedded' ? (
              /* Embedded Preview */
              <div 
                className="bg-[#0d1418] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                style={{ height: '450px' }}
              >
                {/* Header */}
                <div 
                  className="p-4 flex items-center gap-3"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-sm">{config.name}</h3>
                    <span className="text-white/80 text-xs">● En línea</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="flex gap-2">
                    <div 
                      className="rounded-lg rounded-tl-none p-3 max-w-[85%] text-sm bg-[#202c33] text-[#e9edef]"
                    >
                      {config.welcomeMessage}
                      <div className="text-[10px] opacity-60 mt-1 text-right">12:00</div>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="p-3 bg-[#202c33] border-t border-[#2a3942] flex gap-2">
                  <input
                    placeholder={config.placeholderText}
                    className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 text-sm text-[#e9edef] outline-none"
                    disabled
                  />
                  <button 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: config.primaryColor }}
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            ) : (
              /* Floating Preview */
              <div className="relative h-[450px] bg-background rounded-lg border overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-3 w-full bg-muted/50 rounded" />
                  <div className="h-3 w-3/4 bg-muted/50 rounded" />
                  <div className="h-3 w-5/6 bg-muted/50 rounded" />
                </div>

                {/* Floating Button */}
                <button
                  onClick={() => setPreviewOpen(!previewOpen)}
                  className={`absolute bottom-4 ${config.position === 'bottom-right' ? 'right-4' : 'left-4'} w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110`}
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <MessageCircle className="w-6 h-6 text-white" />
                  )}
                </button>

                {/* Chat Modal Preview */}
                {previewOpen && (
                  <div 
                    className={`absolute bottom-20 ${config.position === 'bottom-right' ? 'right-4' : 'left-4'} w-[300px] bg-card rounded-2xl shadow-2xl overflow-hidden border`}
                  >
                    {/* Header */}
                    <div 
                      className="p-3 flex items-center gap-3"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">{config.name}</h3>
                        <span className="text-white/80 text-xs">En línea</span>
                      </div>
                      <button 
                        onClick={() => setPreviewOpen(false)}
                        className="text-white/80 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="h-[200px] p-3 bg-background overflow-y-auto">
                      <div className="flex gap-2">
                        <div 
                          className="rounded-lg rounded-tl-none p-2 max-w-[85%] text-sm"
                          style={{ backgroundColor: `${config.primaryColor}20` }}
                        >
                          {config.welcomeMessage}
                        </div>
                      </div>
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t bg-card">
                      <div className="flex gap-2">
                        <input
                          placeholder={config.placeholderText}
                          className="flex-1 bg-muted rounded-full px-3 py-2 text-sm outline-none"
                          disabled
                        />
                        <button 
                          className="w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: config.primaryColor }}
                        >
                          <Send className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
