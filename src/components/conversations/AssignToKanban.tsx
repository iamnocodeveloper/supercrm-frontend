import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { KanbanService, LeadData } from '@/services/kanbanService';
import { Database } from '@/integrations/supabase/types';
import { Kanban, Plus, User, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

type LeadColumn = Database['public']['Tables']['lead_columns']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'];

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface TwilioConnection {
  id: string;
  connection_name: string;
  phone_number: string;
  status: string;
}

interface AssignToKanbanProps {
  conversationId?: string;
  conversationPhone?: string;
  conversationName?: string;
  conversationChannelType?: 'whatsapp' | 'twilio' | 'telegram' | 'webchat' | 'player_chat' | null;
  conversationWhatsappNumber?: string | null;
  conversationTwilioConnectionId?: string | null;
  onLeadAssigned?: (lead: Lead) => void;
  onSessionChange?: (sessionName: string, sessionPhoneNumber?: string) => void;
  onTwilioConnectionChange?: (connectionId: string) => void;
  iconOnly?: boolean;
}

export const AssignToKanban: React.FC<AssignToKanbanProps> = ({
  conversationId,
  conversationPhone,
  conversationName,
  conversationChannelType,
  conversationWhatsappNumber,
  conversationTwilioConnectionId,
  onLeadAssigned,
  onSessionChange,
  onTwilioConnectionChange,
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [existingLead, setExistingLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assign' | 'create' | 'session'>('assign');

  // Para la pestaña de sesión
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);
  const [twilioConnections, setTwilioConnections] = useState<TwilioConnection[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedTwilioConn, setSelectedTwilioConn] = useState<string>('');
  const [updatingSession, setUpdatingSession] = useState(false);

  // Formulario para nuevo lead
  const [newLeadData, setNewLeadData] = useState<LeadData>({
    name: conversationName || '',
    phone: conversationPhone || '',
    email: '',
    company: '',
    value: undefined,
    notes: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Cargar columnas y buscar lead existente
  useEffect(() => {
    if (isOpen && user?.id) {
      loadData();
      if (conversationChannelType === 'whatsapp' || conversationChannelType === 'twilio') {
        loadSessionData();
      }
    }
  }, [isOpen, user?.id, conversationPhone]);

  const loadData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Cargar columnas
      const userColumns = await KanbanService.getUserColumns(user.id);
      setColumns(userColumns);

      // Buscar lead existente por teléfono
      if (conversationPhone) {
        const lead = await KanbanService.findLeadByPhone(conversationPhone, user.id);
        setExistingLead(lead);

        if (lead) {
          setActiveTab('assign');
          setSelectedColumn(lead.column_id);
        } else {
          setActiveTab('create');
          // Seleccionar columna por defecto
          if (userColumns.length > 0) {
            const defaultColumn = userColumns.find(col => col.is_default) || userColumns[0];
            setSelectedColumn(defaultColumn.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los datos del Kanban',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionData = async () => {
    if (!user?.id) return;
    try {
      if (conversationChannelType === 'whatsapp') {
        const { data } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number, status')
          .eq('user_id', user.id);
        const conns = (data || []) as WhatsAppConnection[];
        setWhatsappConnections(conns);
        // Los <SelectItem value> usan el NOMBRE de la conexión, no el teléfono.
        const current = conns.find(
          (c) => c.phone_number === conversationWhatsappNumber || c.name === conversationWhatsappNumber,
        );
        setSelectedSession(current?.name || '');
      } else if (conversationChannelType === 'twilio') {
        const { data } = await supabase
          .from('twilio_connections')
          .select('id, connection_name, phone_number, status')
          .eq('user_id', user.id);
        setTwilioConnections((data || []) as TwilioConnection[]);
        setSelectedTwilioConn(conversationTwilioConnectionId || '');
      }
    } catch (e) {
      console.error('Error loading session data:', e);
    }
  };

  const handleAssignExisting = async () => {
    if (!existingLead || !selectedColumn || !user?.id) return;

    setIsLoading(true);
    try {
      const updatedLead = await KanbanService.updateLeadColumn(
        existingLead.id,
        selectedColumn,
        user.id
      );

      toast({
        title: 'Lead asignado',
        description: `Lead movido a la columna seleccionada exitosamente`
      });

      onLeadAssigned?.(updatedLead);
      setIsOpen(false);
    } catch (error) {
      console.error('Error assigning lead:', error);
      toast({
        title: 'Error',
        description: 'Error al asignar el lead a la columna',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async () => {
    if (!selectedColumn || !user?.id || !newLeadData.name.trim()) return;

    setIsLoading(true);
    try {
      const newLead = await KanbanService.createLead(
        newLeadData,
        selectedColumn,
        user.id
      );

      toast({
        title: 'Lead creado',
        description: `Nuevo lead "${newLead.name}" creado y asignado exitosamente`
      });

      onLeadAssigned?.(newLead);
      setIsOpen(false);

      // Resetear formulario
      setNewLeadData({
        name: conversationName || '',
        phone: conversationPhone || '',
        email: '',
        company: '',
        value: undefined,
        notes: ''
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: 'Error',
        description: 'Error al crear el nuevo lead',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionUpdate = async () => {
    if (!conversationId || !user?.id) return;
    setUpdatingSession(true);
    try {
      if (conversationChannelType === 'whatsapp' && selectedSession) {
        const conn = whatsappConnections.find(c => c.name === selectedSession);
        if (!conn) throw new Error('Conexión no encontrada');

        // Delegar al padre: handleSessionChange en Conversations.tsx o Leads.tsx
        // decide si crear conversación nueva o actualizar la existente
        onSessionChange?.(selectedSession, conn.phone_number);
        setIsOpen(false);
      } else if (conversationChannelType === 'twilio' && selectedTwilioConn) {
        const { error } = await supabase
          .from('conversations')
          .update({
            twilio_connection_id: selectedTwilioConn,
          })
          .eq('id', conversationId);
        if (error) throw error;

        onTwilioConnectionChange?.(selectedTwilioConn);
        toast({
          title: 'Conexión Twilio actualizada',
        });
        setIsOpen(false);
      }
    } catch (error: any) {
      console.error('Error updating session:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUpdatingSession(false);
    }
  };

  const selectedColumnName = columns.find(col => col.id === selectedColumn)?.name || '';
  const hasSessionTab = conversationChannelType === 'whatsapp' || conversationChannelType === 'twilio';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="sm" title="Asignar a Kanban">
            <Kanban className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Kanban className="h-4 w-4" />
            Asignar a Kanban
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Kanban className="h-5 w-5" />
            Asignar a Kanban
          </DialogTitle>
          <DialogDescription>
            {conversationPhone ?
              `Asignar conversación de ${conversationName || conversationPhone} al sistema Kanban` :
              'Asignar conversación al sistema Kanban'
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'assign' | 'create' | 'session')}>
            <TabsList className={`grid w-full ${hasSessionTab ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="assign" disabled={!existingLead}>
                <User className="h-4 w-4 mr-2" />
                Lead Existente
              </TabsTrigger>
              <TabsTrigger value="create">
                <Plus className="h-4 w-4 mr-2" />
                Crear Nuevo
              </TabsTrigger>
              {hasSessionTab && (
                <TabsTrigger value="session">
                  <Phone className="h-4 w-4 mr-2" />
                  Sesión
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="assign" className="space-y-4">
              {existingLead ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Lead Encontrado</CardTitle>
                    <CardDescription>
                      Se encontró un lead existente para este contacto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <strong>Nombre:</strong> {existingLead.name}
                    </div>
                    {existingLead.phone && (
                      <div className="text-sm">
                        <strong>Teléfono:</strong> {existingLead.phone}
                      </div>
                    )}
                    {existingLead.company && (
                      <div className="text-sm">
                        <strong>Empresa:</strong> {existingLead.company}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                      No se encontró un lead existente para este contacto.
                      Usa la pestaña "Crear Nuevo" para crear uno.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={newLeadData.name}
                    onChange={(e) => setNewLeadData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del lead"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={newLeadData.phone}
                    onChange={(e) => setNewLeadData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Número de teléfono"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLeadData.email}
                    onChange={(e) => setNewLeadData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Correo electrónico"
                  />
                </div>

                <div>
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={newLeadData.company}
                    onChange={(e) => setNewLeadData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Nombre de la empresa"
                  />
                </div>

                <div>
                  <Label htmlFor="value">Valor Estimado</Label>
                  <Input
                    id="value"
                    type="number"
                    value={newLeadData.value || ''}
                    onChange={(e) => setNewLeadData(prev => ({
                      ...prev,
                      value: e.target.value ? Number(e.target.value) : undefined
                    }))}
                    placeholder="Valor en $"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={newLeadData.notes}
                    onChange={(e) => setNewLeadData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales"
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {hasSessionTab && (
              <TabsContent value="session" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cambiar sesión</CardTitle>
                    <CardDescription>
                      Selecciona desde qué conexión responder los mensajes de esta conversación
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {conversationChannelType === 'whatsapp' ? (
                      <>
                        <Label htmlFor="wa-session">Conexión WhatsApp</Label>
                        <Select value={selectedSession} onValueChange={setSelectedSession}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona sesión" />
                          </SelectTrigger>
                          <SelectContent>
                            {whatsappConnections.map((c) => (
                              <SelectItem key={c.id} value={c.name || ''}>
                                <div className="flex items-center gap-2">
                                  <span>{c.name}</span>
                                  <span className="text-xs text-muted-foreground">+{c.phone_number}</span>
                                  <Badge variant={c.status === 'WORKING' ? 'default' : 'secondary'} className="ml-1">
                                    {c.status}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <Label htmlFor="twilio-conn">Conexión Twilio</Label>
                        <Select value={selectedTwilioConn} onValueChange={setSelectedTwilioConn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona conexión Twilio" />
                          </SelectTrigger>
                          <SelectContent>
                            {twilioConnections.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <span>{c.connection_name}</span>
                                  <span className="text-xs text-muted-foreground">+{c.phone_number}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        {!isLoading && activeTab !== 'session' && columns.length > 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="column">Columna de Destino *</Label>
              <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar columna" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        {column.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={activeTab === 'assign' ? handleAssignExisting : handleCreateNew}
                disabled={!selectedColumn || (activeTab === 'create' && !newLeadData.name.trim())}
                className="flex-1"
              >
                {activeTab === 'assign' ?
                  `Mover a ${selectedColumnName}` :
                  `Crear en ${selectedColumnName}`
                }
              </Button>
            </div>
          </div>
        )}

        {!isLoading && activeTab === 'session' && hasSessionTab && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSessionUpdate}
              disabled={
                updatingSession ||
                (conversationChannelType === 'whatsapp' && !selectedSession) ||
                (conversationChannelType === 'twilio' && !selectedTwilioConn)
              }
              className="flex-1"
            >
              {updatingSession ? 'Guardando...' : 'Cambiar sesión'}
            </Button>
          </div>
        )}

        {!isLoading && columns.length === 0 && activeTab !== 'session' && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                No tienes columnas en tu Kanban. Ve al módulo Kanban para crear columnas primero.
              </p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};
