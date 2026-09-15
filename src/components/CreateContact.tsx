import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { webhookService } from '@/services/webhookService';

type ContactList = Tables<'contact_lists'>;

interface CreateContactProps {
  onContactCreated?: () => void;
  triggerButton?: React.ReactNode;
  defaultContactListId?: string;
  showContactListSelector?: boolean;
}

const CreateContact: React.FC<CreateContactProps> = ({ 
  onContactCreated,
  triggerButton,
  defaultContactListId,
  showContactListSelector = true
}) => {
  const { effectiveUserId } = useEffectiveUserId();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    contact_list_id: defaultContactListId || ''
  });

  useEffect(() => {
    if (effectiveUserId && showContactListSelector) {
      fetchContactLists();
    }
  }, [effectiveUserId, showContactListSelector]);

  useEffect(() => {
    if (defaultContactListId) {
      setFormData(prev => ({ ...prev, contact_list_id: defaultContactListId }));
    }
  }, [defaultContactListId]);

  const fetchContactLists = async () => {
    if (!effectiveUserId) return;
    
    try {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('name');

      if (error) throw error;
      setContactLists(data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.phone_number.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre y teléfono son requeridos',
        variant: 'destructive'
      });
      return;
    }

    if (showContactListSelector && !formData.contact_list_id) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar una lista de contactos',
        variant: 'destructive'
      });
      return;
    }

    if (!effectiveUserId) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado para crear un contacto',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Create the contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: formData.name.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim() || null,
          user_id: effectiveUserId
        })
        .select()
        .single();

      if (contactError) {
        throw contactError;
      }

      // Enviar datos al webhook de n8n (asíncrono, no bloqueante)
      webhookService.sendContactCreated({
        id: newContact.id,
        name: newContact.name,
        phone_number: newContact.phone_number,
        email: newContact.email,
        user_id: newContact.user_id,
        contact_list_id: formData.contact_list_id || null,
        created_at: newContact.created_at,
      }).catch(err => console.error('Error sending to webhook:', err));

      // Add to contact list if specified
      if (formData.contact_list_id) {
        const { error: memberError } = await supabase
          .from('contact_list_members')
          .insert({
            contact_id: newContact.id,
            contact_list_id: formData.contact_list_id
          });

        if (memberError) {
          // If adding to list fails, we should still consider the contact created
          console.error('Error adding contact to list:', memberError);
          toast({
            title: 'Advertencia',
            description: 'Contacto creado pero no se pudo agregar a la lista',
            variant: 'destructive'
          });
        }
      }

      toast({
        title: 'Éxito',
        description: formData.contact_list_id 
          ? 'Contacto creado y agregado a la lista exitosamente'
          : 'Contacto creado exitosamente'
      });

      // Reset form
      setFormData({ 
        name: '', 
        phone_number: '', 
        email: '', 
        contact_list_id: defaultContactListId || '' 
      });
      setIsOpen(false);
      
      // Notify parent component
      if (onContactCreated) {
        onContactCreated();
      }
    } catch (error: any) {
      console.error('Error creating contact:', error);
      
      let errorMessage = 'No se pudo crear el contacto';
      
      if (error.code === '23505') {
        errorMessage = 'Ya existe un contacto con ese número de teléfono';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ 
      name: '', 
      phone_number: '', 
      email: '', 
      contact_list_id: defaultContactListId || '' 
    });
    setIsOpen(false);
  };

  const defaultTrigger = (
    <Button className="bg-green-600 hover:bg-green-700">
      <UserPlus className="w-4 h-4 mr-2" />
      Nuevo Contacto
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Contacto</DialogTitle>
          <DialogDescription>
            Agrega un nuevo contacto {showContactListSelector ? 'y asígnalo a una lista' : ''}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
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
                maxLength={100}
                required
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
                maxLength={20}
                required
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
                maxLength={100}
              />
            </div>
            
            {showContactListSelector && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contact-list" className="text-right">
                  Lista *
                </Label>
                <Select
                  value={formData.contact_list_id}
                  onValueChange={(value) => setFormData({ ...formData, contact_list_id: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.length === 0 ? (
                      <SelectItem value="" disabled>
                        No hay listas disponibles
                      </SelectItem>
                    ) : (
                      contactLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                          {list.description && (
                            <span className="text-gray-500 ml-2">- {list.description}</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-green-600 hover:bg-green-700"
              disabled={loading || !formData.name.trim() || !formData.phone_number.trim() || (showContactListSelector && !formData.contact_list_id)}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear Contacto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateContact;