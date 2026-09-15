import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Trash2, Settings, ShieldAlert } from 'lucide-react';
import { usersService } from '@/services/usersService';
import { userPermissionsService, UserPermissions } from '@/services/userPermissionsService';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { z } from 'zod';

type PermissionField = {
  key: keyof UserPermissions;
  label: string;
  group: string;
};

const PERMISSION_FIELDS: PermissionField[] = [
  { key: 'puede_ver_dashboard', label: 'Ver Dashboard', group: 'General' },
  { key: 'puede_ver_contactos', label: 'Ver Contactos', group: 'Contactos' },
  { key: 'puede_crear_contactos', label: 'Crear Contactos', group: 'Contactos' },
  { key: 'puede_editar_contactos', label: 'Editar Contactos', group: 'Contactos' },
  { key: 'puede_eliminar_contactos', label: 'Eliminar Contactos', group: 'Contactos' },
  { key: 'puede_importar_contactos', label: 'Importar Contactos', group: 'Contactos' },
  { key: 'puede_ver_chats', label: 'Ver Chats', group: 'Chats' },
  { key: 'puede_enviar_mensajes', label: 'Enviar Mensajes', group: 'Chats' },
  { key: 'puede_ver_mensajes_otros', label: 'Ver Mensajes de Otros', group: 'Chats' },
  { key: 'puede_eliminar_mensajes', label: 'Eliminar Mensajes', group: 'Chats' },
  { key: 'puede_ver_embudos', label: 'Ver Embudos', group: 'Embudos' },
  { key: 'puede_crear_embudos', label: 'Crear Embudos', group: 'Embudos' },
  { key: 'puede_editar_embudos', label: 'Editar Embudos', group: 'Embudos' },
  { key: 'puede_eliminar_embudos', label: 'Eliminar Embudos', group: 'Embudos' },
  { key: 'puede_mover_contactos_embudos', label: 'Mover Contactos en Embudos', group: 'Embudos' },
  { key: 'puede_ver_ventas', label: 'Ver Ventas', group: 'Ventas' },
  { key: 'puede_crear_ventas', label: 'Crear Ventas', group: 'Ventas' },
  { key: 'puede_editar_ventas', label: 'Editar Ventas', group: 'Ventas' },
  { key: 'puede_eliminar_ventas', label: 'Eliminar Ventas', group: 'Ventas' },
  { key: 'puede_ver_tareas', label: 'Ver Tareas', group: 'Tareas' },
  { key: 'puede_crear_tareas', label: 'Crear Tareas', group: 'Tareas' },
  { key: 'puede_asignar_tareas', label: 'Asignar Tareas', group: 'Tareas' },
  { key: 'puede_eliminar_tareas', label: 'Eliminar Tareas', group: 'Tareas' },
  { key: 'puede_ver_reportes', label: 'Ver Reportes', group: 'Reportes' },
  { key: 'puede_exportar_datos', label: 'Exportar Datos', group: 'Reportes' },
  { key: 'puede_ver_analytics', label: 'Ver Analytics', group: 'Reportes' },
  { key: 'puede_gestionar_usuarios', label: 'Gestionar Usuarios', group: 'Configuración' },
  { key: 'puede_ver_configuracion', label: 'Ver Configuración', group: 'Configuración' },
  { key: 'puede_editar_configuracion', label: 'Editar Configuración', group: 'Configuración' },
  { key: 'puede_gestionar_plantillas', label: 'Gestionar Plantillas', group: 'Configuración' },
  { key: 'puede_gestionar_respuestas_rapidas', label: 'Gestionar Respuestas Rápidas', group: 'Configuración' },
  { key: 'puede_gestionar_whatsapp', label: 'Gestionar WhatsApp', group: 'Canales' },
  { key: 'puede_gestionar_telegram', label: 'Gestionar Telegram', group: 'Canales' },
];

const UserManagement = () => {
  const { users, loading, refetch } = useAccountUsers();
  const { hasPermission, isAdmin } = useUserPermissions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditPermissionsDialog, setShowEditPermissionsDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<Partial<UserPermissions>>({});
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const { toast } = useToast();
  
  // Verificar si tiene permisos para gestionar usuarios
  const canManageUsers = isAdmin || hasPermission('puede_gestionar_usuarios');

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user' as 'admin' | 'cashier' | 'user'
  });

  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, boolean>>({
    puede_ver_dashboard: true,
    puede_ver_contactos: true,
    puede_ver_chats: true,
    puede_enviar_mensajes: true,
    puede_ver_embudos: false,
    puede_mover_contactos_embudos: false,
    puede_gestionar_workspaces: false,
    puede_ver_tareas: true
  });

  const handleCreateUser = async () => {
    // Validate input using zod schema
    const userSchema = z.object({
      email: z.string()
        .trim()
        .email({ message: "Email inválido" })
        .max(255, { message: "Email demasiado largo" }),
      password: z.string()
        .min(6, { message: "La contraseña debe tener al menos 6 caracteres" })
        .max(72, { message: "Contraseña demasiado larga" }),
      firstName: z.string()
        .trim()
        .min(1, { message: "El nombre es requerido" })
        .max(100, { message: "Nombre demasiado largo" }),
      lastName: z.string()
        .trim()
        .min(1, { message: "El apellido es requerido" })
        .max(100, { message: "Apellido demasiado largo" }),
      role: z.enum(['admin', 'user'])
    });

    try {
      // Validate form data
      userSchema.parse(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Error de validación',
          description: error.issues[0].message,
          variant: 'destructive'
        });
        return;
      }
    }

    setCreatingUser(true);
    try {
      await usersService.createUser(
        newUser.email.trim(),
        newUser.password,
        newUser.firstName.trim(),
        newUser.lastName.trim(),
        newUser.role,
        newUserPermissions
      );
      
      toast({
        title: 'Éxito',
        description: 'Usuario creado correctamente'
      });
      
      setShowCreateDialog(false);
      setNewUser({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'user'
      });
      setNewUserPermissions({
        puede_ver_dashboard: true,
        puede_ver_contactos: true,
        puede_ver_chats: true,
        puede_enviar_mensajes: true,
        puede_ver_embudos: false,
        puede_mover_contactos_embudos: false,
        puede_gestionar_workspaces: false,
        puede_ver_tareas: true
      });
      refetch();
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Show specific error message
      let errorMessage = 'No se pudo crear el usuario';
      if (error.message?.includes('email address has already been registered') || 
          error.message?.includes('ya está registrado')) {
        errorMessage = 'Este email ya está registrado. Por favor usa otro email.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

    try {
      await usersService.deleteUser(userId);
      toast({
        title: 'Éxito',
        description: 'Usuario eliminado correctamente'
      });
      refetch();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el usuario',
        variant: 'destructive'
      });
    }
  };

  const handleEditPermissions = async (userId: string) => {
    try {
      const perms = await userPermissionsService.getByUserId(userId);
      setSelectedUserId(userId);
      setSelectedUserPermissions(perms || {});
      setShowEditPermissionsDialog(true);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los permisos',
        variant: 'destructive'
      });
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUserId) return;

    setSavingPermissions(true);
    try {
      await userPermissionsService.upsert({
        user_id: selectedUserId,
        ...selectedUserPermissions
      } as any);
      
      toast({
        title: 'Éxito',
        description: 'Permisos actualizados correctamente'
      });
      setShowEditPermissionsDialog(false);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron actualizar los permisos',
        variant: 'destructive'
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  const getRoleLabel = (parentUserId: string | null) => {
    return parentUserId === null ? 'Administrador' : 'Cajero';
  };

  const toggleNewUserPermission = (key: string) => {
    setNewUserPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleEditPermission = (key: keyof UserPermissions) => {
    setSelectedUserPermissions(prev => ({
      ...prev,
      [key]: !(prev[key] as boolean)
    }));
  };

  const setAllNewUserPermissions = (value: boolean) => {
    const allPerms: Record<string, boolean> = {};
    PERMISSION_FIELDS.forEach(field => {
      allPerms[field.key] = value;
    });
    setNewUserPermissions(allPerms);
  };

  const setAllEditPermissions = (value: boolean) => {
    const allPerms: Partial<UserPermissions> = { ...selectedUserPermissions };
    PERMISSION_FIELDS.forEach(field => {
      (allPerms as any)[field.key] = value;
    });
    setSelectedUserPermissions(allPerms);
  };

  const groupedFields = PERMISSION_FIELDS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, PermissionField[]>);

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

  // Si no tiene permisos, mostrar mensaje de acceso denegado
  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">Acceso Denegado</h2>
          <p className="text-muted-foreground">No tienes permisos para gestionar usuarios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
          <p className="text-muted-foreground">Administra los usuarios y sus permisos</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Crear Usuario
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Fecha de Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name || user.last_name
                      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                      : 'Sin nombre'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.parent_user_id === null ? 'default' : 'secondary'}>
                      {getRoleLabel(user.parent_user_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {user.parent_user_id !== null && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPermissions(user.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Completa los datos del nuevo usuario y selecciona sus permisos
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="space-y-6 pr-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Información Básica</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Cajero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Permisos</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllNewUserPermissions(true)}
                    >
                      Seleccionar Todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAllNewUserPermissions(false)}
                    >
                      Deseleccionar Todos
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(groupedFields).map(([groupName, fields]) => (
                    <div key={groupName} className="space-y-2">
                      <div className="text-sm font-medium text-foreground">{groupName}</div>
                      <div className="space-y-1.5">
                        {fields.map(field => (
                          <label
                            key={String(field.key)}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={Boolean(newUserPermissions[field.key])}
                              onCheckedChange={() => toggleNewUserPermission(field.key)}
                            />
                            <span className="text-muted-foreground">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={showEditPermissionsDialog} onOpenChange={setShowEditPermissionsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Permisos</DialogTitle>
            <DialogDescription>
              Configura los permisos para este usuario
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="space-y-4 pr-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Permisos</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAllEditPermissions(true)}
                  >
                    Seleccionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAllEditPermissions(false)}
                  >
                    Deseleccionar Todos
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(groupedFields).map(([groupName, fields]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="text-sm font-medium text-foreground">{groupName}</div>
                    <div className="space-y-1.5">
                      {fields.map(field => (
                        <label
                          key={String(field.key)}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={Boolean(selectedUserPermissions[field.key])}
                            onCheckedChange={() => toggleEditPermission(field.key)}
                          />
                          <span className="text-muted-foreground">{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPermissionsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={savingPermissions}>
              {savingPermissions ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
