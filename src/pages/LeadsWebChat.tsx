import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Building, Mail, Phone, DollarSign, Users, Search, ChevronDown, ArrowLeft, MessageSquare, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import KanbanBoard from '@/components/KanbanBoard';
import { MessageTriggersDialog } from '@/components/MessageTriggersDialog';
import ChatModal from '@/components/conversations/ChatModal';
import { useMessages, useConversations } from '@/hooks/useConversations';

type LeadColumn = Tables<'lead_columns'>;
type Lead = Tables<'leads'>;
type Workspace = Tables<'workspaces'>;

interface ConversationSummary {
  id: string;
  phone_number: string;
  pushname: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number | null;
}

interface LeadWithColumn extends Lead {
  lead_columns?: LeadColumn;
  conversations?: ConversationSummary[];
}

const LeadsWebChat = () => {
  const { user } = useAuth();
  const { hasPermission, isAdmin } = useUserPermissions();
  const { effectiveUserId, loading: effectiveUserIdLoading } = useEffectiveUserId();
  const navigate = useNavigate();
  
  const canCreateFunnels = isAdmin || hasPermission('puede_crear_embudos');
  const canMoveContacts = isAdmin || hasPermission('puede_mover_contactos_embudos');

  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [leads, setLeads] = useState<LeadWithColumn[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#22c55e');
  const [editingColumn, setEditingColumn] = useState<LeadColumn | null>(null);
  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    value: '',
    notes: '',
    column_id: ''
  });
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showMessageTriggersDialog, setShowMessageTriggersDialog] = useState(false);
  const [selectedColumnForTriggers, setSelectedColumnForTriggers] = useState<LeadColumn | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [filteredLeads, setFilteredLeads] = useState<LeadWithColumn[]>([]);

  // Estado para el modal de chat
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  const { messages, sendMessage, isSending } = useMessages(selectedConversationId);
  const { markAsRead } = useConversations();

  const handleSendMessage = async (messageText: string, attachment?: File) => {
    if (!messageText.trim() && !attachment || !selectedConversation || !effectiveUserId) return;
    
    try {
      // WebChat messages via edge function
      const { error } = await supabase.functions.invoke('web-chat-send', {
        body: {
          conversationId: selectedConversation.id,
          message: messageText.trim(),
          userId: effectiveUserId
        }
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  };

  const handleLeadClick = async (lead: LeadWithColumn) => {
    if (lead.conversations && lead.conversations.length > 0) {
      const firstConversation = lead.conversations[0];
      const { data: fullConversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', firstConversation.id)
        .single();
        
      if (fullConversation && !error) {
        setSelectedConversation(fullConversation);
        setSelectedConversationId(fullConversation.id);
        setIsChatModalOpen(true);
        markAsRead(fullConversation.id);
      }
    } else {
      toast({
        title: "Sin conversaciones",
        description: "Este contacto aún no tiene conversaciones de WebChat",
        variant: "default"
      });
    }
  };

  useEffect(() => {
    if (effectiveUserId && !effectiveUserIdLoading) {
      loadData();
    }
  }, [effectiveUserId, effectiveUserIdLoading]);

  useEffect(() => {
    if (effectiveUserId && !effectiveUserIdLoading && selectedWorkspace) {
      loadColumns();
      loadLeads();
    }
  }, [selectedWorkspace, effectiveUserId, effectiveUserIdLoading]);

  useEffect(() => {
    if (!effectiveUserId) return;
    
    const channel = supabase
      .channel(`webchat-leads-${effectiveUserId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${effectiveUserId}`
      }, () => loadLeads())
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [effectiveUserId]);

  useEffect(() => {
    if (!searchFilter.trim()) {
      setFilteredLeads(leads);
    } else {
      const filtered = leads.filter(lead => {
        const searchTerm = searchFilter.toLowerCase();
        return lead.name?.toLowerCase().includes(searchTerm) || lead.phone?.toLowerCase().includes(searchTerm);
      });
      setFilteredLeads(filtered);
    }
  }, [leads, searchFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadWorkspaces(), loadColumns(), loadLeads()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Error", description: "Error al cargar los datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaces = async () => {
    if (!effectiveUserId) return;
    
    // Solo cargar workspaces de tipo webchat
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('channel_type', 'webchat')
      .order('position');
    
    if (error) {
      console.error('Error loading workspaces:', error);
      return;
    }

    if (!data || data.length === 0) {
      // Crear workspace webchat por defecto
      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          user_id: effectiveUserId,
          name: 'Embudos WebChat',
          position: 0,
          channel_type: 'webchat'
        })
        .select()
        .single();
        
      if (createError) {
        console.error('Error creating default workspace:', createError);
        return;
      }

      await supabase.from('lead_columns').insert({
        user_id: effectiveUserId,
        workspace_id: newWorkspace.id,
        name: 'Nuevos Visitantes',
        color: '#22c55e',
        position: 0,
        is_default: true
      });
      
      setWorkspaces([newWorkspace]);
      setSelectedWorkspace(newWorkspace.id);
      return;
    }
    
    setWorkspaces(data || []);
    if (data && data.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(data[0].id);
    }
  };

  const loadColumns = async () => {
    if (!effectiveUserId || !selectedWorkspace) return;
    
    const { data, error } = await supabase
      .from('lead_columns')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('workspace_id', selectedWorkspace)
      .order('position');
    
    if (error) {
      console.error('Error loading columns:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      const { data: newCol } = await supabase
        .from('lead_columns')
        .insert({
          name: 'Nuevos Visitantes',
          color: '#22c55e',
          position: 0,
          is_default: true,
          user_id: effectiveUserId,
          workspace_id: selectedWorkspace
        })
        .select()
        .single();
      
      if (newCol) setColumns([newCol]);
      return;
    }
    
    setColumns(data);
  };

  const loadLeads = async () => {
    if (!effectiveUserId || !selectedWorkspace) return;
    
    const { data: columnsData } = await supabase
      .from('lead_columns')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('workspace_id', selectedWorkspace);
    
    const columnIds = columnsData?.map(col => col.id) || [];
    if (columnIds.length === 0) {
      setLeads([]);
      return;
    }

    // Cargar leads con conversaciones de webchat
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        lead_columns(*),
        conversations:conversations!conversations_lead_id_fkey(
          id, phone_number, pushname, last_message, last_message_time, unread_count, channel_type
        )
      `)
      .in('column_id', columnIds)
      .order('position');
    
    if (error) {
      console.error('Error loading leads:', error);
      return;
    }
    
    // Filtrar solo leads con conversaciones webchat
    const filteredData = (data || []).map(lead => ({
      ...lead,
      conversations: lead.conversations?.filter((c: any) => c.channel_type === 'webchat') || []
    }));
    
    // Ordenar por último mensaje (más reciente arriba)
    const sortedData = filteredData.sort((a, b) => {
      const aTime = a.conversations?.[0]?.last_message_time || a.updated_at;
      const bTime = b.conversations?.[0]?.last_message_time || b.updated_at;
      return new Date(bTime || 0).getTime() - new Date(aTime || 0).getTime();
    });
    
    setLeads(sortedData);
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim() || !selectedWorkspace) return;
    
    const { data, error } = await supabase
      .from('lead_columns')
      .insert({
        name: newColumnName,
        color: newColumnColor,
        position: columns.length,
        is_default: false,
        user_id: effectiveUserId,
        workspace_id: selectedWorkspace
      })
      .select()
      .single();
    
    if (error) {
      toast({ title: "Error", description: "Error al crear la columna", variant: "destructive" });
      return;
    }
    
    setColumns([...columns, data]);
    setNewColumnName('');
    setNewColumnColor('#22c55e');
    setShowColumnDialog(false);
    toast({ title: "Éxito", description: "Columna creada correctamente" });
  };

  const handleUpdateColumn = async () => {
    if (!editingColumn || !newColumnName.trim()) return;
    
    const { error } = await supabase
      .from('lead_columns')
      .update({ name: newColumnName, color: newColumnColor })
      .eq('id', editingColumn.id);
    
    if (error) {
      toast({ title: "Error", description: "Error al actualizar la columna", variant: "destructive" });
      return;
    }
    
    setColumns(columns.map(col => 
      col.id === editingColumn.id ? { ...col, name: newColumnName, color: newColumnColor } : col
    ));
    setEditingColumn(null);
    setNewColumnName('');
    setNewColumnColor('#22c55e');
    setShowColumnDialog(false);
    toast({ title: "Éxito", description: "Columna actualizada correctamente" });
  };

  const handleDeleteColumn = async (columnId: string) => {
    const columnLeads = leads.filter(l => l.column_id === columnId);
    if (columnLeads.length > 0) {
      toast({ title: "Error", description: "No se puede eliminar una columna con leads", variant: "destructive" });
      return;
    }
    
    const { error } = await supabase.from('lead_columns').delete().eq('id', columnId);
    if (error) {
      toast({ title: "Error", description: "Error al eliminar la columna", variant: "destructive" });
      return;
    }
    
    setColumns(columns.filter(col => col.id !== columnId));
    toast({ title: "Éxito", description: "Columna eliminada correctamente" });
  };

  const handleCreateLead = async () => {
    if (!newLead.name.trim() || !newLead.column_id) return;
    
    const columnLeads = leads.filter(l => l.column_id === newLead.column_id);
    
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: newLead.name,
        email: newLead.email || null,
        phone: newLead.phone || null,
        company: newLead.company || null,
        value: newLead.value ? parseFloat(newLead.value) : null,
        notes: newLead.notes || null,
        column_id: newLead.column_id,
        position: columnLeads.length,
        user_id: effectiveUserId
      })
      .select('*, lead_columns(*)')
      .single();
    
    if (error) {
      toast({ title: "Error", description: "Error al crear el lead", variant: "destructive" });
      return;
    }
    
    setLeads([...leads, data]);
    setNewLead({ name: '', email: '', phone: '', company: '', value: '', notes: '', column_id: '' });
    setShowLeadDialog(false);
    toast({ title: "Éxito", description: "Lead creado correctamente" });
  };

  const handleUpdateLead = async () => {
    if (!editingLead || !newLead.name.trim()) return;
    
    const { error } = await supabase
      .from('leads')
      .update({
        name: newLead.name,
        email: newLead.email || null,
        phone: newLead.phone || null,
        company: newLead.company || null,
        value: newLead.value ? parseFloat(newLead.value) : null,
        notes: newLead.notes || null
      })
      .eq('id', editingLead.id);
    
    if (error) {
      toast({ title: "Error", description: "Error al actualizar el lead", variant: "destructive" });
      return;
    }
    
    setLeads(leads.map(l => l.id === editingLead.id ? { ...l, ...newLead, value: newLead.value ? parseFloat(newLead.value) : null } : l));
    setEditingLead(null);
    setNewLead({ name: '', email: '', phone: '', company: '', value: '', notes: '', column_id: '' });
    setShowLeadDialog(false);
    toast({ title: "Éxito", description: "Lead actualizado correctamente" });
  };

  const handleDeleteLead = async (leadId: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) {
      toast({ title: "Error", description: "Error al eliminar el lead", variant: "destructive" });
      return;
    }
    setLeads(leads.filter(l => l.id !== leadId));
    toast({ title: "Éxito", description: "Lead eliminado correctamente" });
  };

  const handleMoveLeadToColumn = async (leadId: string, targetColumnId: string) => {
    const { error } = await supabase
      .from('leads')
      .update({ column_id: targetColumnId })
      .eq('id', leadId);
    
    if (error) {
      toast({ title: "Error", description: "Error al mover el lead", variant: "destructive" });
      return;
    }
    
    setLeads(leads.map(l => l.id === leadId ? { ...l, column_id: targetColumnId } : l));
  };

  const openCreateColumnDialog = () => {
    setEditingColumn(null);
    setNewColumnName('');
    setNewColumnColor('#22c55e');
    setShowColumnDialog(true);
  };

  const openEditColumnDialog = (column: LeadColumn) => {
    setEditingColumn(column);
    setNewColumnName(column.name);
    setNewColumnColor(column.color || '#22c55e');
    setShowColumnDialog(true);
  };

  const openCreateLeadDialog = (columnId: string) => {
    setEditingLead(null);
    setNewLead({ name: '', email: '', phone: '', company: '', value: '', notes: '', column_id: columnId });
    setShowLeadDialog(true);
  };

  const openEditLeadDialog = (lead: Lead) => {
    setEditingLead(lead);
    setNewLead({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      value: lead.value?.toString() || '',
      notes: lead.notes || '',
      column_id: lead.column_id
    });
    setShowLeadDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando embudos WebChat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Embudos WebChat</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {leads.length} leads
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Workspace */}
          <Select value={selectedWorkspace || ''} onValueChange={setSelectedWorkspace}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar espacio" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          
          {canCreateFunnels && (
            <Button onClick={openCreateColumnDialog} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Columna
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          columns={columns}
          leads={searchFilter ? filteredLeads : leads}
          onEditColumn={openEditColumnDialog}
          onDeleteColumn={handleDeleteColumn}
          onCreateLead={openCreateLeadDialog}
          onEditLead={openEditLeadDialog}
          onDeleteLead={handleDeleteLead}
          onMoveLeadToColumn={handleMoveLeadToColumn}
          onManageMessageTriggers={(column) => {
            setSelectedColumnForTriggers(column);
            setShowMessageTriggersDialog(true);
          }}
          onOpenConversation={handleLeadClick}
        />
      </div>

      {/* Column Dialog */}
      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingColumn ? 'Editar Columna' : 'Nueva Columna'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Nombre de la columna"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColumnColor(color)}
                    className={`w-8 h-8 rounded-full ${newColumnColor === color ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColumnDialog(false)}>Cancelar</Button>
            <Button onClick={editingColumn ? handleUpdateColumn : handleCreateColumn}>
              {editingColumn ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Dialog */}
      <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Editar Lead' : 'Nuevo Lead'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                placeholder="Nombre del lead"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input
                  value={newLead.company}
                  onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                  placeholder="Empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  value={newLead.value}
                  onChange={(e) => setNewLead({ ...newLead, value: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                placeholder="Notas adicionales"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadDialog(false)}>Cancelar</Button>
            <Button onClick={editingLead ? handleUpdateLead : handleCreateLead}>
              {editingLead ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Triggers Dialog */}
      <MessageTriggersDialog
        isOpen={showMessageTriggersDialog}
        onClose={() => setShowMessageTriggersDialog(false)}
        column={selectedColumnForTriggers}
      />

      {/* Chat Modal */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setSelectedConversation(null);
          setSelectedConversationId(null);
        }}
        conversation={selectedConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        isSending={isSending}
      />
    </div>
  );
};

export default LeadsWebChat;
