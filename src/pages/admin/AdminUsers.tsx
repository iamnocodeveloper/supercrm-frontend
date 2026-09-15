import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Mail,
  Phone,
  Building,
  Calendar,
  Shield,
  User,
  LogIn,
  Key
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ProfileType = Database['public']['Enums']['profile_type'];

interface UserWithAuth extends Profile {
  email: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserWithAuth[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAuth | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    profile_type: 'client' as ProfileType
  });
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get auth emails via secure edge function (single batched call)
      let emailMap = new Map<string, string>();
      try {
        const { data: emailData, error: emailErr } = await supabase.functions.invoke(
          'admin-list-users',
          { body: {} }
        );
        if (!emailErr && emailData?.success && Array.isArray(emailData.users)) {
          for (const u of emailData.users) {
            if (u?.id && u?.email) emailMap.set(u.id, u.email);
          }
        }
      } catch (err) {
        console.warn('Could not fetch auth emails (admin-list-users):', err);
      }

      const usersWithEmail = (profiles || []).map((profile) => ({
        ...profile,
        email: emailMap.get(profile.id) || profile.email || 'No disponible',
      }));

      setUsers(usersWithEmail);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Email y contraseña son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);

      // Create user via secure edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          firstName: formData.first_name || '',
          lastName: formData.last_name || '',
          role: 'user',
        },
      });

      if (error) throw new Error(error.message || 'No se pudo crear el usuario');
      if (!data?.success) throw new Error(data?.error || 'No se pudo crear el usuario');

      // Update profile fields not handled by create-user (phone, company, profile_type)
      if (data.user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone: formData.phone || null,
            company_name: formData.company_name || null,
            profile_type: formData.profile_type,
          })
          .eq('id', data.user.id);

        if (profileError) {
          console.warn('Profile fields not fully updated:', profileError);
        }
      }

      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
      });

      setIsCreateDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        company_name: '',
        profile_type: 'client'
      });

      try {
        await fetchUsers();
      } catch (fetchError) {
        console.error('Error refreshing users list:', fetchError);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setUpdating(true);

      // Update profile data
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          phone: formData.phone || null,
          company_name: formData.company_name || null,
          profile_type: formData.profile_type
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario han sido actualizados",
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!selectedUser || !formData.email) return;

    try {
      setChangingEmail(true);

      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: { userId: selectedUser.id, email: formData.email },
      });

      if (error) throw new Error(error.message || 'No se pudo cambiar el email');
      if (!data?.success) throw new Error(data?.error || 'No se pudo cambiar el email');

      toast({
        title: "Email actualizado",
        description: "El email del usuario ha sido cambiado exitosamente",
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error changing email:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el email",
        variant: "destructive",
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;

    try {
      setChangingPassword(true);

      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: { userId: selectedUser.id, password: newPassword },
      });

      if (error) throw new Error(error.message || 'No se pudo cambiar la contraseña');
      if (!data?.success) throw new Error(data?.error || 'No se pudo cambiar la contraseña');

      toast({
        title: "Contraseña actualizada",
        description: "La contraseña del usuario ha sido cambiada exitosamente",
      });

      setNewPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleQuickLogin = (userId: string) => {
    try {
      // Simple redirect to dashboard with user ID as parameter
      // This allows super admin to view user's panel directly
      window.location.href = `/?impersonate=${userId}`;
    } catch (error: any) {
      console.error('Error with quick login:', error);
      toast({
        title: "Error",
        description: "No se pudo acceder al panel del usuario",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Delete profile (auth user deletion would need admin privileges)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado del sistema",
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: UserWithAuth) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      company_name: user.company_name || '',
      profile_type: user.profile_type
    });
    setIsEditDialogOpen(true);
  };

  const filteredUsers = users.filter(user => 
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando usuarios...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="mr-3 h-8 w-8" />
              Gestión de Usuarios
            </h1>
            <p className="text-gray-600 mt-2">Administra las cuentas de usuario del sistema</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Contraseña segura"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">Nombre</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="Nombre"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Apellido</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Apellido"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Número de teléfono"
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">Empresa</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div>
                  <Label htmlFor="profile_type">Tipo de Perfil</Label>
                  <Select value={formData.profile_type} onValueChange={(value: ProfileType) => setFormData({ ...formData, profile_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Cliente</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateUser} disabled={creating}>
                    {creating ? "Creando..." : "Crear Usuario"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar usuarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="secondary">
            {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Usuario</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Contacto</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Empresa</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            {user.profile_type === 'superadmin' ? (
                              <Shield className="h-4 w-4 text-primary-foreground" />
                            ) : (
                              <User className="h-4 w-4 text-primary-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.first_name || user.last_name ? 
                                `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
                                'Sin nombre'
                              }
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {user.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-3 w-3 mr-1" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {user.company_name && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Building className="h-3 w-3 mr-1" />
                            {user.company_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.profile_type === 'superadmin' ? 'default' : 'secondary'}>
                          {user.profile_type === 'superadmin' ? 'Super Admin' : 'Cliente'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {user.profile_type === 'client' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleQuickLogin(user.id)}
                              title="Acceder al panel del usuario"
                            >
                              <LogIn className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta del usuario.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron usuarios
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Authentication Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Key className="mr-2 h-4 w-4" />
                  Autenticación
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit_email">Email</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="edit_email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="usuario@ejemplo.com"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangeEmail}
                        disabled={changingEmail || !formData.email}
                      >
                        {changingEmail ? "Cambiando..." : "Cambiar"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit_password">Nueva Contraseña</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="edit_password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword}
                      >
                        {changingPassword ? "Cambiando..." : "Cambiar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Información del Perfil
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_first_name">Nombre</Label>
                      <Input
                        id="edit_first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Nombre"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_last_name">Apellido</Label>
                      <Input
                        id="edit_last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Apellido"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit_phone">Teléfono</Label>
                    <Input
                      id="edit_phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Número de teléfono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_company_name">Empresa</Label>
                    <Input
                      id="edit_company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_profile_type">Tipo de Perfil</Label>
                    <Select value={formData.profile_type} onValueChange={(value: ProfileType) => setFormData({ ...formData, profile_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={updating}>
                  {updating ? "Actualizando..." : "Actualizar Perfil"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default AdminUsers;