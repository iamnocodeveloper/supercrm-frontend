import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Edit, Plus, Users, Calendar, UserPlus, Upload, FileText, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

import type { Tables } from '@/integrations/supabase/types';

type ContactList = Tables<'contact_lists'>;

interface ContactListWithCount extends ContactList {
  contact_count?: number;
}

interface ParsedContact {
  name: string;
  phone_number: string;
}

const ContactLists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contactLists, setContactLists] = useState<ContactListWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddContactsDialogOpen, setIsAddContactsDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [addingToList, setAddingToList] = useState<ContactList | null>(null);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  // Estados para importación CSV/TXT
  const [importedContacts, setImportedContacts] = useState<ParsedContact[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Estados para entrada manual
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualContacts, setManualContacts] = useState<ParsedContact[]>([]);

  // Estados para pegar texto masivo
  const [bulkText, setBulkText] = useState('');
  const [parsedBulkContacts, setParsedBulkContacts] = useState<ParsedContact[]>([]);

  useEffect(() => {
    if (user) {
      fetchContactLists();
    }
  }, [user]);

  const fetchContactLists = async () => {
    try {
      setLoading(true);
      
      const { data: lists, error } = await supabase
        .from('contact_lists')
        .select(`
          *,
          contact_list_members(count)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listsWithCount = lists?.map(list => ({
        ...list,
        contact_count: list.contact_list_members?.[0]?.count || 0
      })) || [];

      setContactLists(listsWithCount);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las listas de contactos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la lista es requerido',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_lists')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          user_id: user?.id!
        });

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Lista de contactos creada exitosamente'
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchContactLists();
    } catch (error) {
      console.error('Error creating contact list:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la lista de contactos',
        variant: 'destructive'
      });
    }
  };

  const handleEditList = async () => {
    if (!formData.name.trim() || !editingList) {
      toast({
        title: 'Error',
        description: 'El nombre de la lista es requerido',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_lists')
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingList.id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Lista de contactos actualizada exitosamente'
      });

      setIsEditDialogOpen(false);
      setEditingList(null);
      resetForm();
      fetchContactLists();
    } catch (error) {
      console.error('Error updating contact list:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la lista de contactos',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la lista "${listName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await supabase
        .from('contact_list_members')
        .delete()
        .eq('contact_list_id', listId);

      const { error } = await supabase
        .from('contact_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Lista de contactos eliminada exitosamente'
      });

      fetchContactLists();
    } catch (error) {
      console.error('Error deleting contact list:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la lista de contactos',
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (list: ContactList) => {
    setEditingList(list);
    setFormData({
      name: list.name,
      description: list.description || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    });
  };

  const handleCancel = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsAddContactsDialogOpen(false);
    setEditingList(null);
    setAddingToList(null);
    setSelectedContacts([]);
    setImportedContacts([]);
    setManualContacts([]);
    setManualName('');
    setManualPhone('');
    setBulkText('');
    setParsedBulkContacts([]);
    resetForm();
  };

  // Parsear texto pegado masivo
  const handleParseBulkText = () => {
    if (!bulkText.trim()) {
      toast({
        title: 'Error',
        description: 'Pega el texto con los contactos',
        variant: 'destructive'
      });
      return;
    }

    const lines = bulkText.split('\n').filter(l => l.trim());
    const parsed: ParsedContact[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Parsear formato: nombre, telefono o nombre;telefono o nombre\ttelefono
      const parts = trimmed.split(/[,;\t]/).map(p => p.trim());
      
      if (parts.length >= 2) {
        // nombre, telefono
        const cleanPhone = parts[1].replace(/\D/g, '');
        if (cleanPhone) {
          parsed.push({ name: parts[0] || cleanPhone, phone_number: cleanPhone });
        }
      } else if (parts.length === 1) {
        // Solo número, usar como nombre
        const cleanPhone = parts[0].replace(/\D/g, '');
        if (cleanPhone) {
          parsed.push({ name: cleanPhone, phone_number: cleanPhone });
        }
      }
    }
    
    // Eliminar duplicados por teléfono
    const uniqueContacts = parsed.filter((contact, index, self) =>
      index === self.findIndex(c => c.phone_number === contact.phone_number)
    );
    
    setParsedBulkContacts(uniqueContacts);
    
    if (uniqueContacts.length === 0) {
      toast({
        title: 'Sin contactos',
        description: 'No se encontraron contactos válidos en el texto',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Texto procesado',
        description: `Se encontraron ${uniqueContacts.length} contactos`
      });
    }
  };

  // Agregar contactos del texto pegado a la lista
  const handleAddBulkContacts = async () => {
    if (!addingToList || parsedBulkContacts.length === 0) return;

    setImportLoading(true);
    try {
      let addedCount = 0;
      
      for (const contact of parsedBulkContacts) {
        // Buscar o crear contacto
        let { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user?.id)
          .eq('phone_number', contact.phone_number)
          .maybeSingle();
        
        let contactId = existing?.id;
        
        if (!contactId) {
          const { data: created } = await supabase
            .from('contacts')
            .insert({
              user_id: user?.id!,
              phone_number: contact.phone_number,
              name: contact.name,
              first_name: contact.name,
              origin: 'bulk_paste'
            })
            .select('id')
            .single();
          contactId = created?.id;
        }
        
        if (contactId) {
          // Verificar si ya está en la lista
          const { data: existing_member } = await supabase
            .from('contact_list_members')
            .select('id')
            .eq('contact_list_id', addingToList.id)
            .eq('contact_id', contactId)
            .maybeSingle();
          
          if (!existing_member) {
            await supabase.from('contact_list_members').insert({
              contact_list_id: addingToList.id,
              contact_id: contactId
            });
            addedCount++;
          }
        }
      }

      toast({
        title: 'Éxito',
        description: `${addedCount} contacto(s) agregado(s) a la lista`
      });

      setParsedBulkContacts([]);
      setBulkText('');
      fetchContactLists();
    } catch (error) {
      console.error('Error adding bulk contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los contactos',
        variant: 'destructive'
      });
    } finally {
      setImportLoading(false);
    }
  };

  const openAddContactsDialog = async (list: ContactList) => {
    setAddingToList(list);
    
    try {
      const { data: existingMembers } = await supabase
        .from('contact_list_members')
        .select('contact_id')
        .eq('contact_list_id', list.id);
      
      const existingContactIds = existingMembers?.map(m => m.contact_id) || [];
      
      const { data: allContacts, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, email')
        .eq('user_id', user?.id)
        .order('name');
      
      if (error) throw error;
      
      const available = allContacts?.filter(c => !existingContactIds.includes(c.id)) || [];
      setAvailableContacts(available);
      setIsAddContactsDialogOpen(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos',
        variant: 'destructive'
      });
    }
  };

  const handleAddContactsToList = async () => {
    if (!addingToList || selectedContacts.length === 0) return;

    try {
      const members = selectedContacts.map(contactId => ({
        contact_list_id: addingToList.id,
        contact_id: contactId
      }));

      const { error } = await supabase
        .from('contact_list_members')
        .insert(members);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: `${selectedContacts.length} contacto(s) agregado(s) a la lista`
      });

      setIsAddContactsDialogOpen(false);
      setAddingToList(null);
      setSelectedContacts([]);
      fetchContactLists();
    } catch (error) {
      console.error('Error adding contacts to list:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los contactos',
        variant: 'destructive'
      });
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // Manejar subida de archivo CSV/TXT
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      const parsed: ParsedContact[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Intentar parsear como CSV (nombre,telefono) o solo telefono
        const parts = trimmed.split(/[,;\t]/).map(p => p.trim());
        
        if (parts.length >= 2) {
          parsed.push({ name: parts[0], phone_number: parts[1].replace(/\D/g, '') });
        } else if (parts.length === 1 && parts[0]) {
          // Solo número, usar como nombre también
          const cleanPhone = parts[0].replace(/\D/g, '');
          if (cleanPhone) {
            parsed.push({ name: cleanPhone, phone_number: cleanPhone });
          }
        }
      }
      
      setImportedContacts(parsed);
      
      if (parsed.length === 0) {
        toast({
          title: 'Archivo vacío',
          description: 'No se encontraron contactos válidos en el archivo',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Archivo procesado',
          description: `Se encontraron ${parsed.length} contactos`
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Error',
        description: 'No se pudo procesar el archivo',
        variant: 'destructive'
      });
    }
    
    // Reset input
    e.target.value = '';
  };

  // Agregar contactos importados a la lista
  const handleAddImportedContacts = async () => {
    if (!addingToList || importedContacts.length === 0) return;

    setImportLoading(true);
    try {
      let addedCount = 0;
      
      for (const contact of importedContacts) {
        // Buscar o crear contacto
        let { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user?.id)
          .eq('phone_number', contact.phone_number)
          .maybeSingle();
        
        let contactId = existing?.id;
        
        if (!contactId) {
          const { data: created } = await supabase
            .from('contacts')
            .insert({
              user_id: user?.id!,
              phone_number: contact.phone_number,
              name: contact.name,
              first_name: contact.name,
              origin: 'import'
            })
            .select('id')
            .single();
          contactId = created?.id;
        }
        
        if (contactId) {
          // Verificar si ya está en la lista
          const { data: existing_member } = await supabase
            .from('contact_list_members')
            .select('id')
            .eq('contact_list_id', addingToList.id)
            .eq('contact_id', contactId)
            .maybeSingle();
          
          if (!existing_member) {
            await supabase.from('contact_list_members').insert({
              contact_list_id: addingToList.id,
              contact_id: contactId
            });
            addedCount++;
          }
        }
      }

      toast({
        title: 'Éxito',
        description: `${addedCount} contacto(s) agregado(s) a la lista`
      });

      setImportedContacts([]);
      fetchContactLists();
    } catch (error) {
      console.error('Error adding imported contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los contactos',
        variant: 'destructive'
      });
    } finally {
      setImportLoading(false);
    }
  };

  // Agregar contacto manual a la lista temporal
  const handleAddManualContact = () => {
    if (!manualPhone.trim()) {
      toast({
        title: 'Error',
        description: 'El teléfono es requerido',
        variant: 'destructive'
      });
      return;
    }

    const cleanPhone = manualPhone.replace(/\D/g, '');
    const name = manualName.trim() || cleanPhone;
    
    // Verificar duplicados
    if (manualContacts.some(c => c.phone_number === cleanPhone)) {
      toast({
        title: 'Duplicado',
        description: 'Este número ya está en la lista',
        variant: 'destructive'
      });
      return;
    }

    setManualContacts(prev => [...prev, { name, phone_number: cleanPhone }]);
    setManualName('');
    setManualPhone('');
  };

  // Eliminar contacto de lista temporal
  const removeManualContact = (phone: string) => {
    setManualContacts(prev => prev.filter(c => c.phone_number !== phone));
  };

  // Agregar contactos manuales a la lista
  const handleAddManualContacts = async () => {
    if (!addingToList || manualContacts.length === 0) return;

    setImportLoading(true);
    try {
      let addedCount = 0;
      
      for (const contact of manualContacts) {
        // Buscar o crear contacto
        let { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user?.id)
          .eq('phone_number', contact.phone_number)
          .maybeSingle();
        
        let contactId = existing?.id;
        
        if (!contactId) {
          const { data: created } = await supabase
            .from('contacts')
            .insert({
              user_id: user?.id!,
              phone_number: contact.phone_number,
              name: contact.name,
              first_name: contact.name,
              origin: 'manual'
            })
            .select('id')
            .single();
          contactId = created?.id;
        }
        
        if (contactId) {
          // Verificar si ya está en la lista
          const { data: existing_member } = await supabase
            .from('contact_list_members')
            .select('id')
            .eq('contact_list_id', addingToList.id)
            .eq('contact_id', contactId)
            .maybeSingle();
          
          if (!existing_member) {
            await supabase.from('contact_list_members').insert({
              contact_list_id: addingToList.id,
              contact_id: contactId
            });
            addedCount++;
          }
        }
      }

      toast({
        title: 'Éxito',
        description: `${addedCount} contacto(s) agregado(s) a la lista`
      });

      setManualContacts([]);
      fetchContactLists();
    } catch (error) {
      console.error('Error adding manual contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los contactos',
        variant: 'destructive'
      });
    } finally {
      setImportLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando listas de contactos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Listas de Contactos</h1>
            <p className="text-muted-foreground mt-2">Gestiona tus listas de contactos para campañas y comunicaciones</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Crear Nueva Lista de Contactos</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crea una nueva lista para organizar tus contactos
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right text-foreground">
                    Nombre *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3 bg-background border-border text-foreground"
                    placeholder="Ej: Clientes VIP"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right text-foreground">
                    Descripción
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="col-span-3 bg-background border-border text-foreground"
                    placeholder="Descripción opcional de la lista"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel} className="border-border hover:bg-muted">
                  Cancelar
                </Button>
                <Button onClick={handleCreateList} className="bg-gradient-to-r from-primary to-primary/90">
                  Crear Lista
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {contactLists.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No tienes listas de contactos</h3>
            <p className="text-muted-foreground mb-6">Crea tu primera lista para comenzar a organizar tus contactos</p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-to-r from-primary to-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Lista
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contactLists.map((list) => (
              <Card key={list.id} className="bg-gradient-to-br from-card to-card/80 border-l-4 border-l-primary hover:shadow-lg transition-shadow rounded-xl">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle 
                        className="text-lg font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => navigate(`/contactos/${list.id}`)}
                      >
                        {list.name}
                      </CardTitle>
                      {list.description && (
                        <CardDescription className="mt-2 text-muted-foreground">
                          {list.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(list)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteList(list.id, list.name)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      <span>{list.contact_count || 0} contactos</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{formatDate(list.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddContactsDialog(list)}
                    className="w-full border-border hover:bg-muted"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Agregar Contactos
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Lista de Contactos</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Modifica los detalles de tu lista de contactos
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right text-foreground">
                  Nombre *
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3 bg-background border-border text-foreground"
                  placeholder="Ej: Clientes VIP"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right text-foreground">
                  Descripción
                </Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3 bg-background border-border text-foreground"
                  placeholder="Descripción opcional de la lista"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} className="border-border hover:bg-muted">
                Cancelar
              </Button>
              <Button onClick={handleEditList} className="bg-gradient-to-r from-primary to-primary/90">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Contacts Dialog with Tabs */}
        <Dialog open={isAddContactsDialogOpen} onOpenChange={setIsAddContactsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Agregar Contactos a "{addingToList?.name}"
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Selecciona cómo deseas agregar contactos a esta lista
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="existing" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="existing" className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Existentes
                </TabsTrigger>
                <TabsTrigger value="import" className="flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  CSV/TXT
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="bulk" className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Pegar Texto
                </TabsTrigger>
              </TabsList>

              {/* Tab: Contactos Existentes */}
              <TabsContent value="existing" className="space-y-4">
                {availableContacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No hay contactos disponibles para agregar
                  </p>
                ) : (
                  <>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {availableContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer"
                          onClick={() => toggleContactSelection(contact.id)}
                        >
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => toggleContactSelection(contact.id)}
                          />
                          <div className="flex-1">
                            <p className="text-foreground font-medium">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">{contact.phone_number}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleAddContactsToList}
                      disabled={selectedContacts.length === 0}
                      className="w-full bg-gradient-to-r from-primary to-primary/90"
                    >
                      Agregar {selectedContacts.length} Contacto(s)
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Tab: Importar CSV/TXT */}
              <TabsContent value="import" className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Sube un archivo CSV o TXT
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Formato: nombre,telefono (uno por línea)
                  </p>
                  <label htmlFor="file-import">
                    <Button variant="outline" asChild className="cursor-pointer">
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Seleccionar Archivo
                      </span>
                    </Button>
                  </label>
                  <input
                    id="file-import"
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {importedContacts.length > 0 && (
                  <>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Vista previa ({importedContacts.length} contactos):
                      </p>
                      {importedContacts.slice(0, 10).map((contact, idx) => (
                        <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                          <span className="text-foreground">{contact.name}</span>
                          <span className="text-muted-foreground">{contact.phone_number}</span>
                        </div>
                      ))}
                      {importedContacts.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center">
                          ... y {importedContacts.length - 10} más
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleAddImportedContacts}
                      disabled={importLoading}
                      className="w-full bg-gradient-to-r from-primary to-primary/90"
                    >
                      {importLoading ? 'Importando...' : `Importar ${importedContacts.length} Contacto(s)`}
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Tab: Agregar Manual */}
              <TabsContent value="manual" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="flex-1 bg-background border-border"
                  />
                  <Input
                    placeholder="Teléfono *"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="flex-1 bg-background border-border"
                  />
                  <Button onClick={handleAddManualContact} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {manualContacts.length > 0 && (
                  <>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Contactos a agregar ({manualContacts.length}):
                      </p>
                      {manualContacts.map((contact, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-muted rounded">
                          <div>
                            <span className="text-foreground">{contact.name}</span>
                            <span className="text-muted-foreground ml-2">{contact.phone_number}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeManualContact(contact.phone_number)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={handleAddManualContacts}
                      disabled={importLoading}
                      className="w-full bg-gradient-to-r from-primary to-primary/90"
                    >
                      {importLoading ? 'Agregando...' : `Agregar ${manualContacts.length} Contacto(s)`}
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Tab: Pegar Texto Masivo */}
              <TabsContent value="bulk" className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Pega los contactos, uno por línea. Formato: <strong>nombre, telefono</strong>
                  </p>
                  <Textarea
                    placeholder={`Ejemplo:\nJuan Pérez, 5491123456789\nMaría García, 5491198765432\nPedro, 5491155555555`}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="min-h-[150px] bg-background border-border font-mono text-sm"
                  />
                  <Button 
                    onClick={handleParseBulkText} 
                    variant="outline" 
                    className="w-full"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Procesar Texto
                  </Button>
                </div>

                {parsedBulkContacts.length > 0 && (
                  <>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Vista previa ({parsedBulkContacts.length} contactos):
                      </p>
                      {parsedBulkContacts.slice(0, 15).map((contact, idx) => (
                        <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                          <span className="text-foreground">{contact.name}</span>
                          <span className="text-muted-foreground">{contact.phone_number}</span>
                        </div>
                      ))}
                      {parsedBulkContacts.length > 15 && (
                        <p className="text-xs text-muted-foreground text-center">
                          ... y {parsedBulkContacts.length - 15} más
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleAddBulkContacts}
                      disabled={importLoading}
                      className="w-full bg-gradient-to-r from-primary to-primary/90"
                    >
                      {importLoading ? 'Agregando...' : `Agregar ${parsedBulkContacts.length} Contacto(s)`}
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} className="border-border hover:bg-muted">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ContactLists;