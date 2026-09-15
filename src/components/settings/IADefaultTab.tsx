import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { unifiedAIService, UnifiedAISettings, SessionAIStatus } from '@/services/unifiedAIService';
import { iaHumanizationService, IAHumanizationSettings } from '@/services/iaHumanizationService';
import { MessageSquare, Phone, Bot, Globe, Loader2, Shield, Sparkles } from 'lucide-react';
import AIUsageStats from './AIUsageStats';
import BlockedContactsPanel from './BlockedContactsPanel';

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <Phone className="h-4 w-4 text-green-500" />,
  telegram: <Bot className="h-4 w-4 text-blue-500" />,
  twilio: <Phone className="h-4 w-4 text-red-500" />,
  webchat: <Globe className="h-4 w-4 text-purple-500" />,
};

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram Bot',
  twilio: 'Twilio',
  webchat: 'Web Chat',
};

const IADefaultTab: React.FC = () => {
  const { toast } = useToast();
  const { effectiveUserId, loading: userIdLoading } = useEffectiveUserId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global AI enabled state
  const [globalAIEnabled, setGlobalAIEnabled] = useState(true);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  // Settings state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [cashierNumbers, setCashierNumbers] = useState('');
  const [cbu, setCbu] = useState('');
  const [casinoLink, setCasinoLink] = useState('https://bet32.fun/');
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [maxTokens, setMaxTokens] = useState(500);

  // Sessions state
  const [sessions, setSessions] = useState<SessionAIStatus[]>([]);
  const [togglingSession, setTogglingSession] = useState<string | null>(null);

  // Humanization settings state
  const [humanSettings, setHumanSettings] = useState<IAHumanizationSettings>(
    iaHumanizationService.getDefaultSettings()
  );

  useEffect(() => {
    const load = async () => {
      if (!effectiveUserId || userIdLoading) return;

      try {
        // Load unified AI settings
        const settings = await unifiedAIService.getSettings(effectiveUserId);
        if (settings) {
          setGlobalAIEnabled(settings.is_enabled ?? true);
          setSystemPrompt(settings.system_prompt || unifiedAIService.getDefaultPrompt());
          setCashierNumbers(settings.cashier_numbers || '');
          setCbu(settings.cbu || '');
          setCasinoLink(settings.casino_link || 'https://bet32.fun/');
          setModel(settings.model || 'google/gemini-2.5-flash');
          setMaxTokens(settings.max_tokens || 500);
        } else {
          setGlobalAIEnabled(true);
          setSystemPrompt(unifiedAIService.getDefaultPrompt());
        }

        // Load humanization settings
        const humanData = await iaHumanizationService.getSettings();
        if (humanData) {
          setHumanSettings(humanData);
        }

        // Load all sessions
        const allSessions = await unifiedAIService.getAllSessions(effectiveUserId);
        setSessions(allSessions);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la configuración de IA',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [effectiveUserId, userIdLoading, toast]);

  const handleToggleGlobalAI = async () => {
    if (!effectiveUserId) return;
    
    setTogglingGlobal(true);
    try {
      const newValue = !globalAIEnabled;
      await unifiedAIService.saveSettings({
        user_id: effectiveUserId,
        is_enabled: newValue,
        system_prompt: systemPrompt,
        cashier_numbers: cashierNumbers,
        cbu,
        casino_link: casinoLink,
        model,
        max_tokens: maxTokens,
      });
      setGlobalAIEnabled(newValue);
      toast({
        title: newValue ? 'IA Activada' : 'IA Desactivada',
        description: newValue 
          ? 'La IA predeterminada responderá en los canales habilitados.' 
          : 'La IA predeterminada está pausada globalmente.',
      });
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'No se pudo cambiar el estado.', variant: 'destructive' });
    } finally {
      setTogglingGlobal(false);
    }
  };

  const saveSettings = async () => {
    if (!effectiveUserId) return;

    setSaving(true);
    try {
      // Save AI settings
      await unifiedAIService.saveSettings({
        user_id: effectiveUserId,
        is_enabled: globalAIEnabled,
        system_prompt: systemPrompt,
        cashier_numbers: cashierNumbers,
        cbu,
        casino_link: casinoLink,
        model,
        max_tokens: maxTokens,
      });

      // Save humanization settings
      await iaHumanizationService.saveSettings(humanSettings);

      toast({ title: 'Guardado', description: 'Configuración de IA y humanización actualizada.' });
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSessionAI = async (session: SessionAIStatus) => {
    setTogglingSession(session.id);
    try {
      await unifiedAIService.toggleSessionAI(session.id, session.channel_type, !session.ai_enabled);
      setSessions(prev =>
        prev.map(s => (s.id === session.id ? { ...s, ai_enabled: !s.ai_enabled } : s))
      );
      toast({
        title: session.ai_enabled ? 'IA Desactivada' : 'IA Activada',
        description: `${session.name}: IA ${session.ai_enabled ? 'desactivada' : 'activada'}`,
      });
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'No se pudo cambiar el estado.', variant: 'destructive' });
    } finally {
      setTogglingSession(null);
    }
  };

  // Group sessions by channel type
  const sessionsByChannel = sessions.reduce((acc, session) => {
    if (!acc[session.channel_type]) {
      acc[session.channel_type] = [];
    }
    acc[session.channel_type].push(session);
    return acc;
  }, {} as Record<string, SessionAIStatus[]>);

  if (loading || userIdLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="h-6 w-6 text-primary">🧠</span>
          <h2 className="text-2xl font-bold">Inteligencia Artificial Unificada</h2>
        </div>
      </div>

      {/* Global AI Switch */}
      <Card className={`border-2 ${globalAIEnabled ? 'border-green-500/50 bg-green-500/5' : 'border-muted'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${globalAIEnabled ? 'bg-green-500/20' : 'bg-muted'}`}>
                <Bot className={`h-6 w-6 ${globalAIEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h3 className="font-semibold">IA Predeterminada</h3>
                <p className="text-sm text-muted-foreground">
                  {globalAIEnabled 
                    ? 'La IA está activa y responderá en los canales habilitados' 
                    : 'La IA está pausada globalmente (no responderá en ningún canal)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {togglingGlobal && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={globalAIEnabled}
                onCheckedChange={handleToggleGlobalAI}
                disabled={togglingGlobal}
                className="data-[state=checked]:bg-green-500"
              />
              <span className={`text-sm font-medium ${globalAIEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                {globalAIEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Usage Statistics */}
      <AIUsageStats userId={effectiveUserId} />

      {/* Blocked Contacts Panel */}
      <BlockedContactsPanel />

      {/* Activación por Sesión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Activación por Sesión
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Activa o desactiva la IA para cada sesión individual. La IA usará la configuración unificada de abajo.
          </p>

          {Object.keys(sessionsByChannel).length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">
              No tienes sesiones configuradas. Ve a "Sesiones" para agregar canales.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(sessionsByChannel).map(([channelType, channelSessions]) => (
                <div key={channelType} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase">
                    {channelIcons[channelType]}
                    {channelLabels[channelType] || channelType}
                  </div>
                  <div className="space-y-2 pl-6">
                    {channelSessions.map(session => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-card border"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{session.name}</span>
                          {session.phone_number && (
                            <span className="text-xs text-muted-foreground">{session.phone_number}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {togglingSession === session.id && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          <Switch
                            checked={session.ai_enabled}
                            onCheckedChange={() => handleToggleSessionAI(session)}
                            disabled={togglingSession === session.id}
                          />
                          <span className={`text-xs ${session.ai_enabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {session.ai_enabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anti-Spam / Humanization Settings */}
      <Card className="border-2 border-orange-500/30 bg-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Configuración Anti-Spam (Humanización)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configura los parámetros para que la IA responda de forma más humana y evite bloqueos por spam de Meta/WhatsApp.
          </p>

          {/* Delays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Delay mínimo antes de responder (ms)</Label>
              <Input
                type="number"
                value={humanSettings.min_response_delay_ms}
                onChange={(e) => setHumanSettings(prev => ({ ...prev, min_response_delay_ms: parseInt(e.target.value) || 2000 }))}
                min={500}
                max={10000}
              />
              <p className="text-xs text-muted-foreground">{humanSettings.min_response_delay_ms / 1000} segundos</p>
            </div>
            <div className="space-y-2">
              <Label>Delay máximo antes de responder (ms)</Label>
              <Input
                type="number"
                value={humanSettings.max_response_delay_ms}
                onChange={(e) => setHumanSettings(prev => ({ ...prev, max_response_delay_ms: parseInt(e.target.value) || 6000 }))}
                min={1000}
                max={15000}
              />
              <p className="text-xs text-muted-foreground">{humanSettings.max_response_delay_ms / 1000} segundos</p>
            </div>
          </div>

          {/* Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border">
              <div>
                <Label>Indicador de "escribiendo..."</Label>
                <p className="text-xs text-muted-foreground">Muestra que está escribiendo antes de enviar</p>
              </div>
              <Switch
                checked={humanSettings.enable_typing_indicator}
                onCheckedChange={(v) => setHumanSettings(prev => ({ ...prev, enable_typing_indicator: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border">
              <div>
                <Label>Variación de respuestas</Label>
                <p className="text-xs text-muted-foreground">Varía saludos, confirmaciones y emojis</p>
              </div>
              <Switch
                checked={humanSettings.enable_response_variation}
                onCheckedChange={(v) => setHumanSettings(prev => ({ ...prev, enable_response_variation: v }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border">
              <div>
                <Label>Combinar mensajes múltiples</Label>
                <p className="text-xs text-muted-foreground">Agrupa varios mensajes en uno solo</p>
              </div>
              <Switch
                checked={humanSettings.combine_multiple_messages}
                onCheckedChange={(v) => setHumanSettings(prev => ({ ...prev, combine_multiple_messages: v }))}
              />
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Frecuencia de emojis</Label>
                <span className="text-sm text-muted-foreground">{humanSettings.emoji_frequency}%</span>
              </div>
              <Slider
                value={[humanSettings.emoji_frequency]}
                onValueChange={([v]) => setHumanSettings(prev => ({ ...prev, emoji_frequency: v }))}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">0% = nunca usar emojis, 100% = siempre usar emojis</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Temperatura de IA (creatividad)</Label>
                <span className="text-sm text-muted-foreground">{humanSettings.ai_temperature}</span>
              </div>
              <Slider
                value={[humanSettings.ai_temperature * 100]}
                onValueChange={([v]) => setHumanSettings(prev => ({ ...prev, ai_temperature: v / 100 }))}
                min={30}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">Más alto = respuestas más variadas y menos predecibles</p>
            </div>
          </div>

          {/* Rate limiting */}
          <div className="space-y-2">
            <Label>Máx. respuestas por minuto</Label>
            <Input
              type="number"
              value={humanSettings.max_responses_per_minute}
              onChange={(e) => setHumanSettings(prev => ({ ...prev, max_responses_per_minute: parseInt(e.target.value) || 10 }))}
              min={1}
              max={30}
            />
            <p className="text-xs text-muted-foreground">Limita la velocidad de respuestas para evitar spam</p>
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Prompt del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Define las instrucciones y comportamiento de la IA. Usa {'{CBU}'}, {'{CAJERO}'} y {'{CASINO_LINK}'} como placeholders.
          </p>
          <Textarea
            placeholder="Escribe el prompt del sistema..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* CBU, Cajero y Link del Casino */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>CBU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              CBU para transacciones bancarias (reemplaza {'{CBU}'} en el prompt).
            </p>
            <Input
              placeholder="Ingresa el CBU..."
              value={cbu}
              onChange={(e) => setCbu(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Números de Cajeros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Link o número del cajero (reemplaza {'{CAJERO}'} en el prompt).
            </p>
            <Input
              placeholder="Ej: http://wa.link/cargacapibet"
              value={cashierNumbers}
              onChange={(e) => setCashierNumbers(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Link del Casino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Link del casino (reemplaza {'{CASINO_LINK}'} en el prompt).
            </p>
            <Input
              placeholder="Ej: https://bet32.fun/"
              value={casinoLink}
              onChange={(e) => setCasinoLink(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modelo y Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Modelo de IA</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-2 rounded-md border bg-background"
            >
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="openai/gpt-5-mini">GPT-5 Mini</option>
              <option value="openai/gpt-5">GPT-5</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Max Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              placeholder="500"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 500)}
              min={100}
              max={4000}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
};

export default IADefaultTab;
