import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Edit, Trash2, Phone, Mail, User, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type ContactList = Tables<'contact_lists'>;

interface ContactWithMembership extends Contact {
  contact_list_members?: {
    added_at: string;
  }[];
}

const Contacts = () => {
  const { listId } = useParams<{ listId: string }>();
  const { effectiveUserId } = useEffectiveUserId();
  const navigate = useNavigate();
  const [contactList, setContactList] = useState<ContactList | null>(null);
  const [contacts, setContacts] = useState<ContactWithMembership[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddExistingDialogOpen, setIsAddExistingDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: ''
  });

  useEffect(() => {
    if (effectiveUserId && listId) {
      fetchContactList();
      fetchContacts();
      fetchAllContacts();
    }
  }, [effectiveUserId, listId]);

  const fetchContactList = async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', effectiveUserId)
        .single();

      if (error) throw error;
      setContactList(data);
    } catch (error) {
      console.error('Error fetching contact list:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la lista de contactos',
        variant: 'destructive'
      });
      navigate('/listas-contactos');
    }
  };

  const fetchContacts = async () => {
    if (!effectiveUserId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact_list_members!inner(
            added_at,
            contact_list_id
          )
        `)
        .eq('contact_list_members.contact_list_id', listId)
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllContacts = async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      setAllContacts(data || []);
    } catch (error) {
      console.error('Error fetching all contacts:', error);
    }
  };

  const handleCreateContact = async () => {
    if (!formData.name.trim() || !formData.phone_number.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre y teléfono son requeridos',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Create the contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: formData.name.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim() || null,
          user_id: effectiveUserId!
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Add to contact list
      const { error: memberError } = await supabase
        .from('contact_list_members')
        .insert({
          contact_id: newContact.id,
          contact_list_id: listId!
        });

      if (memberError) throw memberError;

      toast({
        title: 'Éxito',
        description: 'Contacto creado y agregado a la lista exitosamente'
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchContacts();
      fetchAllContacts();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el contacto',
        variant: 'destructive'
      });
    }
  };

  const handleEditContact = async () => {
    if (!formData.name.trim() || !formData.phone_number.trim() || !editingContact) {
      toast({
        title: 'Error',
        description: 'El nombre y teléfono son requeridos',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: formData.name.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Contacto actualizado exitosamente'
      });

      setIsEditDialogOpen(false);
      setEditingContact(null);
      resetForm();
      fetchContacts();
      fetchAllContacts();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el contacto',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveFromList = async (contactId: string, contactName: string) => {
    if (!confirm(`¿Estás seguro de que quieres quitar a "${contactName}" de esta lista?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_list_members')
        .delete()
        .eq('contact_id', contactId)
        .eq('contact_list_id', listId!);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Contacto removido de la lista exitosamente'
      });

      fetchContacts();
    } catch (error) {
      console.error('Error removing contact from list:', error);
      toast({
        title: 'Error',
        description: 'No se pudo remover el contacto de la lista',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente a "${contactName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      // First remove from all lists
      await supabase
        .from('contact_list_members')
        .delete()
        .eq('contact_id', contactId);

      // Then delete the contact
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Contacto eliminado exitosamente'
      });

      fetchContacts();
      fetchAllContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el contacto',
        variant: 'destructive'
      });
    }
  };

  const handleAddExistingContact = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contact_list_members')
        .insert({
          contact_id: contactId,
          contact_list_id: listId!
        });

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Contacto agregado a la lista exitosamente'
      });

      setIsAddExistingDialogOpen(false);
      fetchContacts();
    } catch (error) {
      console.error('Error adding existing contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el contacto a la lista',
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone_number: contact.phone_number,
      email: contact.email || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      email: ''
    });
  };

  const handleCancel = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setIsAddExistingDialogOpen(false);
    setEditingContact(null);
    resetForm();
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone_number.includes(searchTerm) ||
    (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableContacts = allContacts.filter(contact => 
    !contacts.some(listContact => listContact.id === contact.id)
  );

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
            <p className="text-muted-foreground">Cargando contactos...</p>
          </div>
        </div>
    );
  }

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/listas-contactos')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{contactList?.name}</h1>
            {contactList?.description && (
              <p className="text-muted-foreground mt-1">{contactList.description}</p>
            )}
          </div>
        </div>

        {/* Search and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar contactos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddExistingDialogOpen} onOpenChange={setIsAddExistingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  <User className="w-4 h-4 mr-2" />
                  Agregar Existente
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Agregar Contacto Existente</DialogTitle>
                <DialogDescription>
                  Selecciona un contacto existente para agregar a esta lista
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-60 overflow-y-auto">
                {availableContacts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No hay contactos disponibles para agregar</p>
                ) : (
                  <div className="space-y-2">
                    {availableContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-gray-600">{contact.phone_number}</p>
                          {contact.email && (
                            <p className="text-sm text-gray-600">{contact.email}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddExistingContact(contact.id)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Agregar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Contacto
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Contacto</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo contacto a tu lista
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nombre *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">
                    Teléfono *
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="col-span-3"
                    placeholder="Ej: +1234567890"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="col-span-3"
                    placeholder="email@ejemplo.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateContact} className="bg-primary hover:bg-primary/90">
                  Crear Contacto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Content */}
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchTerm ? 'No se encontraron contactos' : 'No hay contactos en esta lista'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega tu primer contacto para comenzar'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Primer Contacto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <Card key={contact.id} className="hover:shadow-lg transition-all duration-200 border-border hover:border-primary/50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {contact.name}
                      </CardTitle>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Phone className="w-4 h-4 mr-2" />
                          <span>{contact.phone_number}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Mail className="w-4 h-4 mr-2" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(contact)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromList(contact.id, contact.name)}
                        className="text-muted-foreground hover:text-orange-600"
                        title="Quitar de la lista"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id, contact.name)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Eliminar permanentemente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    Agregado: {contact.contact_list_members?.[0]?.added_at ? formatDate(contact.contact_list_members[0].added_at) : 'N/A'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Contacto</DialogTitle>
            <DialogDescription>
              Modifica los detalles del contacto
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Nombre *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="Nombre completo"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">
                Teléfono *
              </Label>
              <Input
                id="edit-phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="col-span-3"
                placeholder="Ej: +1234567890"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleEditContact} className="bg-primary hover:bg-primary/90">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    
  );
};

export default Contacts;