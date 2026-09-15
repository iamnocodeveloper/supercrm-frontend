import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useProfile } from '@/hooks/useProfile';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Download, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { ContactFormDialog } from '@/components/contacts/ContactFormDialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  phone_number: string;
  email: string | null;
  address: string | null;
  website: string | null;
  gender: string | null;
  birth_date: string | null;
  origin: string | null;
  tags: string[] | null;
  is_blocked: boolean | null;
  notes: string | null;
  created_at: string | null;
}

export default function ContactsNew() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { isCajero } = useProfile();
  const { hasPermission, isAdmin } = useUserPermissions();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  // Permisos específicos de contactos
  const canCreate = isAdmin || hasPermission('puede_crear_contactos');
  const canEdit = isAdmin || hasPermission('puede_editar_contactos');
  const canDelete = isAdmin || hasPermission('puede_eliminar_contactos');
  const canImport = isAdmin || hasPermission('puede_importar_contactos');
  const canExport = isAdmin || hasPermission('puede_exportar_datos');

  // Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone: string) => {
    if (!phone) return '';
    return '****' + phone.slice(-4);
  };

  useEffect(() => {
    if (effectiveUserId) {
      fetchContacts();
    }
  }, [effectiveUserId, currentPage, searchTerm]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('user_id', effectiveUserId!)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query.range(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage - 1
      );

      if (error) throw error;
      
      setContacts(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactToDelete);

      if (error) throw error;

      toast({
        title: 'Contacto eliminado',
        description: 'El contacto se eliminó correctamente',
      });
      
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el contacto',
        variant: 'destructive',
      });
    } finally {
      setContactToDelete(null);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingContact(null);
    fetchContacts();
  };

  const handleExport = () => {
    const csv = [
      ['Nombre', 'Apellido', 'Teléfono', 'Email', 'Dirección', 'Sitio Web', 'Género', 'Fecha Nacimiento', 'Origen', 'Bloqueado', 'Notas'].join(','),
      ...contacts.map(c => [
        c.first_name || '',
        c.last_name || '',
        isCajero ? maskPhoneNumber(c.phone_number) : c.phone_number,
        c.email || '',
        c.address || '',
        c.website || '',
        c.gender || '',
        c.birth_date || '',
        c.origin || '',
        c.is_blocked ? 'Sí' : 'No',
        c.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES');
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contactos</h1>
          <p className="text-muted-foreground mt-1">Gestiona tu base de datos de contactos</p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          {canImport && (
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setIsFormOpen(true)} className="bg-gradient-primary hover:opacity-90 transition-all duration-200 shadow-glow">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Contacto
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contactos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedContacts.length === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Género</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead>Bloqueado</TableHead>
              <TableHead>Fecha Creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  No hay contactos
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.address || '-'}</TableCell>
                  <TableCell>
                    {isCajero ? maskPhoneNumber(contact.phone_number) : contact.phone_number}
                  </TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>{contact.gender || '-'}</TableCell>
                  <TableCell>{contact.origin || '-'}</TableCell>
                  <TableCell>
                    {contact.tags && contact.tags.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.is_blocked ? (
                      <Badge variant="destructive" className="text-xs">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Activo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(contact.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(contact)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setContactToDelete(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, contacts.length)} - {Math.min(currentPage * itemsPerPage, contacts.length)} de {contacts.length} contactos
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ANTERIOR
          </Button>
          <div className="flex items-center px-4">
            Página {currentPage} de {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            SIGUIENTE
          </Button>
        </div>
      </div>

      <ContactFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        contact={editingContact}
      />

      <AlertDialog open={!!contactToDelete} onOpenChange={() => setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El contacto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
