import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Trash2, Key, Eye, EyeOff, Save, X } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type AIApiKey = Database['public']['Tables']['ai_api_keys']['Row'];
type AIApiKeyInsert = Database['public']['Tables']['ai_api_keys']['Insert'];
type AIApiKeyUpdate = Database['public']['Tables']['ai_api_keys']['Update'];

interface FormData {
  provider: string;
  api_key: string;
  is_active: boolean;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' }
];

const Integrations = () => {
  const [integrations, setIntegrations] = useState<AIApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<AIApiKey | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState<FormData>({
    provider: '',
    api_key: '',
    is_active: true
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('ai_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las integraciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    try {
      if (editingIntegration) {
        // Actualizar integración existente
        const updateData: AIApiKeyUpdate = {
          provider: formData.provider,
          api_key: formData.api_key,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('ai_api_keys')
          .update(updateData)
          .eq('id', editingIntegration.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Integración actualizada correctamente",
        });
      } else {
        // Crear nueva integración
        const insertData: AIApiKeyInsert = {
          user_id: user.id,
          provider: formData.provider,
          api_key: formData.api_key,
          is_active: formData.is_active
        };

        const { error } = await supabase
          .from('ai_api_keys')
          .insert(insertData);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Integración creada correctamente",
        });
      }

      resetForm();
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la integración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (integration: AIApiKey) => {
    setEditingIntegration(integration);
    setFormData({
      provider: integration.provider,
      api_key: integration.api_key,
      is_active: integration.is_active
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta integración?')) return;

    try {
      const { error } = await supabase
        .from('ai_api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Integración eliminada correctamente",
      });

      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la integración",
        variant: "destructive",
      });
    }
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const resetForm = () => {
    setFormData({
      provider: '',
      api_key: '',
      is_active: true
    });
    setShowCreateForm(false);
    setEditingIntegration(null);
  };

  const getProviderLabel = (provider: string) => {
    const providerObj = PROVIDERS.find(p => p.value === provider);
    return providerObj ? providerObj.label : provider;
  };

  const maskApiKey = (apiKey: string) => {
    if (apiKey.length <= 8) return apiKey;
    return apiKey.substring(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando integraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Key className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Integraciones de IA</h2>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Integración
        </Button>
      </div>

      {/* Formulario de creación/edición */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingIntegration ? 'Editar Integración' : 'Nueva Integración'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Proveedor</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, provider: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Ingresa tu API Key"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Activa</Label>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !formData.provider || !formData.api_key}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Guardando...' : (editingIntegration ? 'Actualizar' : 'Crear')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de integraciones */}
      <div className="grid grid-cols-1 gap-4">
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay integraciones</h3>
              <p className="text-muted-foreground text-center mb-4">
                Agrega tu primera integración de IA para comenzar a usar las funcionalidades avanzadas.
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Integración
              </Button>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold">
                          {getProviderLabel(integration.provider)}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          integration.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {integration.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          API Key: {showApiKeys[integration.id] ? integration.api_key : maskApiKey(integration.api_key)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleApiKeyVisibility(integration.id)}
                        >
                          {showApiKeys[integration.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Creada: {new Date(integration.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(integration)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(integration.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Integrations;