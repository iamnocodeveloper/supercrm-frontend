import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { userPermissionsService, UserPermissions } from '@/services/userPermissionsService';
import { useAccountUsers } from '@/hooks/useAccountUsers';

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleType: 'admin' | 'cashier';
  roleName: string;
}

type PermissionField = {
  key: string;
  label: string;
  group: string;
};

const PERMISSION_FIELDS: PermissionField[] = [
  // General
  { key: 'puede_ver_dashboard', label: 'Ver Dashboard', group: 'General' },
  
  // Contactos
  { key: 'puede_ver_contactos', label: 'Ver Contactos', group: 'Contactos' },
  { key: 'puede_crear_contactos', label: 'Crear Contactos', group: 'Contactos' },
  { key: 'puede_editar_contactos', label: 'Editar Contactos', group: 'Contactos' },
  { key: 'puede_eliminar_contactos', label: 'Eliminar Contactos', group: 'Contactos' },
  { key: 'puede_importar_contactos', label: 'Importar Contactos', group: 'Contactos' },
  
  // Listas de Contactos
  { key: 'puede_ver_listas_contactos', label: 'Ver Listas', group: 'Listas de Contactos' },
  { key: 'puede_crear_listas_contactos', label: 'Crear Listas', group: 'Listas de Contactos' },
  { key: 'puede_editar_listas_contactos', label: 'Editar Listas', group: 'Listas de Contactos' },
  { key: 'puede_eliminar_listas_contactos', label: 'Eliminar Listas', group: 'Listas de Contactos' },
  
  // Chats
  { key: 'puede_ver_chats', label: 'Ver Chats', group: 'Chats' },
  { key: 'puede_enviar_mensajes', label: 'Enviar Mensajes', group: 'Chats' },
  { key: 'puede_ver_mensajes_otros', label: 'Ver Mensajes de Otros', group: 'Chats' },
  { key: 'puede_eliminar_mensajes', label: 'Eliminar Mensajes', group: 'Chats' },
  
  // Chat Landing
  { key: 'puede_ver_chat_landing', label: 'Ver Chat Landing', group: 'Chat Web' },
  { key: 'puede_responder_chat_landing', label: 'Responder Chat Landing', group: 'Chat Web' },
  
  // Chat Interno
  { key: 'puede_ver_chat_interno', label: 'Ver Chat Interno', group: 'Chat Interno' },
  { key: 'puede_enviar_chat_interno', label: 'Enviar Mensajes Internos', group: 'Chat Interno' },
  
  // Campañas Masivas
  { key: 'puede_ver_campanas_masivas', label: 'Ver Campañas', group: 'Campañas Masivas' },
  { key: 'puede_crear_campanas_masivas', label: 'Crear Campañas', group: 'Campañas Masivas' },
  { key: 'puede_editar_campanas_masivas', label: 'Editar Campañas', group: 'Campañas Masivas' },
  { key: 'puede_eliminar_campanas_masivas', label: 'Eliminar Campañas', group: 'Campañas Masivas' },
  { key: 'puede_enviar_campanas_masivas', label: 'Enviar Campañas', group: 'Campañas Masivas' },
  
  // Embudos
  { key: 'puede_ver_embudos', label: 'Ver Embudos', group: 'Embudos' },
  { key: 'puede_crear_embudos', label: 'Crear Embudos', group: 'Embudos' },
  { key: 'puede_editar_embudos', label: 'Editar Embudos', group: 'Embudos' },
  { key: 'puede_eliminar_embudos', label: 'Eliminar Embudos', group: 'Embudos' },
  { key: 'puede_mover_contactos_embudos', label: 'Mover Contactos en Embudos', group: 'Embudos' },
  
  // Ventas
  { key: 'puede_ver_ventas', label: 'Ver Ventas', group: 'Ventas' },
  { key: 'puede_crear_ventas', label: 'Crear Ventas', group: 'Ventas' },
  { key: 'puede_editar_ventas', label: 'Editar Ventas', group: 'Ventas' },
  { key: 'puede_eliminar_ventas', label: 'Eliminar Ventas', group: 'Ventas' },
  
  // Calendario/Tareas
  { key: 'puede_ver_calendario', label: 'Ver Calendario', group: 'Calendario' },
  { key: 'puede_ver_tareas', label: 'Ver Tareas', group: 'Calendario' },
  { key: 'puede_crear_tareas', label: 'Crear Tareas', group: 'Calendario' },
  { key: 'puede_editar_tareas', label: 'Editar Tareas', group: 'Calendario' },
  { key: 'puede_asignar_tareas', label: 'Asignar Tareas', group: 'Calendario' },
  { key: 'puede_eliminar_tareas', label: 'Eliminar Tareas', group: 'Calendario' },
  
  // Agentes IA
  { key: 'puede_ver_agentes_ia', label: 'Ver Agentes IA', group: 'Agentes IA' },
  { key: 'puede_crear_agentes_ia', label: 'Crear Agentes IA', group: 'Agentes IA' },
  { key: 'puede_editar_agentes_ia', label: 'Editar Agentes IA', group: 'Agentes IA' },
  { key: 'puede_eliminar_agentes_ia', label: 'Eliminar Agentes IA', group: 'Agentes IA' },
  
  // Reportes
  { key: 'puede_ver_reportes', label: 'Ver Reportes', group: 'Reportes' },
  { key: 'puede_exportar_datos', label: 'Exportar Datos', group: 'Reportes' },
  { key: 'puede_ver_analytics', label: 'Ver Analytics', group: 'Reportes' },
  
  // Config: Espacios de Trabajo
  { key: 'puede_gestionar_workspaces', label: 'Gestionar Espacios', group: 'Config: Espacios' },
  
  // Config: Sesiones/Conexiones
  { key: 'puede_gestionar_whatsapp', label: 'Gestionar WhatsApp', group: 'Config: Sesiones' },
  { key: 'puede_gestionar_telegram', label: 'Gestionar Telegram', group: 'Config: Sesiones' },
  
  // Config: Respuestas Rápidas
  { key: 'puede_gestionar_respuestas_rapidas', label: 'Gestionar Respuestas', group: 'Config: Respuestas' },
  
  // Config: Usuarios
  { key: 'puede_gestionar_usuarios', label: 'Gestionar Usuarios', group: 'Config: Usuarios' },
  
  // Config: Bot
  { key: 'puede_configurar_bot', label: 'Configurar Bot', group: 'Config: Bot' },
  
  // Config: Integraciones
  { key: 'puede_gestionar_integraciones', label: 'Gestionar Integraciones', group: 'Config: Integraciones' },
  
  // Config: IA Default
  { key: 'puede_gestionar_ia', label: 'Gestionar IA Default', group: 'Config: IA' },
  
  // Config: Etiquetas
  { key: 'puede_gestionar_etiquetas', label: 'Gestionar Etiquetas', group: 'Config: Etiquetas' },
  
  // Config: General
  { key: 'puede_ver_configuracion', label: 'Ver Configuración', group: 'Config: General' },
  { key: 'puede_editar_configuracion', label: 'Editar Configuración', group: 'Config: General' },
  { key: 'puede_gestionar_plantillas', label: 'Gestionar Plantillas', group: 'Config: General' },
];

export default function EditPermissionsDialog({
  open,
  onOpenChange,
  roleType,
  roleName
}: EditPermissionsDialogProps) {
  const { users: accountUsers, loading: loadingUsers, refetch } = useAccountUsers();
  const [permsByUser, setPermsByUser] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Filter users based on role type
  const users = accountUsers.filter(user => {
    if (roleType === 'admin') {
      // Show only admin users (users without parent_user_id)
      return user.parent_user_id === null;
    } else if (roleType === 'cashier') {
      // Show only cashier users (users with parent_user_id)
      return user.parent_user_id !== null;
    }
    return false;
  });

  const groupedFields = PERMISSION_FIELDS.reduce((acc, field) => {
    if (!acc[field.group]) acc[field.group] = [];
    acc[field.group].push(field);
    return acc;
  }, {} as Record<string, PermissionField[]>);

  // Crear objeto con todos los permisos en false
  const createDefaultPermissions = (): Record<string, boolean> => {
    const defaultPerms: Record<string, boolean> = {};
    PERMISSION_FIELDS.forEach(field => {
      defaultPerms[field.key] = false;
    });
    return defaultPerms;
  };

  const loadPermissions = async () => {
    if (users.length === 0) return;
    
    setLoading(true);
    try {
      const permsMap: Record<string, Record<string, boolean>> = {};
      await Promise.all(
        users.map(async (user) => {
          try {
            const perms = await userPermissionsService.getByUserId(user.id);
            if (perms) {
              // Combinar permisos existentes con defaults (para campos nuevos)
              const defaultPerms = createDefaultPermissions();
              Object.keys(perms).forEach(key => {
                if (key in defaultPerms && typeof (perms as any)[key] === 'boolean') {
                  defaultPerms[key] = (perms as any)[key];
                }
              });
              permsMap[user.id] = defaultPerms;
            } else {
              // Sin permisos existentes, usar todos en false
              permsMap[user.id] = createDefaultPermissions();
            }
          } catch (e) {
            permsMap[user.id] = createDefaultPermissions();
          }
        })
      );
      setPermsByUser(permsMap);
    } catch (e: any) {
      console.error('Error loading permissions:', e);
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && users.length > 0) {
      loadPermissions();
    }
  }, [open, users.length]);

  const toggleField = (userId: string, fieldKey: string) => {
    setPermsByUser(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [fieldKey]: !(prev[userId]?.[fieldKey])
      }
    }));
  };

  const setAllForUser = (userId: string, value: boolean) => {
    const next: Record<string, boolean> = {};
    PERMISSION_FIELDS.forEach(f => {
      next[f.key] = value;
    });
    setPermsByUser(prev => ({ ...prev, [userId]: next }));
  };

  const saveUserPerms = async (userId: string) => {
    setSavingUserId(userId);
    try {
      const current = permsByUser[userId] || {};
      
      // Construir objeto completo con TODOS los permisos
      const fullPermissions: Record<string, any> = { user_id: userId };
      PERMISSION_FIELDS.forEach(field => {
        fullPermissions[field.key] = current[field.key] ?? false;
      });
      
      await userPermissionsService.upsert(fullPermissions as any);
      
      toast.success('Permisos guardados correctamente');
    } catch (e: any) {
      console.error('Error saving permissions:', e);
      toast.error('Error al guardar permisos');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Permisos - {roleName}</DialogTitle>
          <DialogDescription>
            Configura los permisos para los usuarios con rol {roleName}
          </DialogDescription>
        </DialogHeader>

        {loading || loadingUsers ? (
          <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay usuarios con este rol
          </div>
        ) : (
          <div className="space-y-6">
            {users.map(user => (
              <div key={user.id} className="border border-border rounded-lg">
                <div className="flex items-center justify-between p-4 bg-muted/50">
                  <div>
                    <div className="font-medium text-foreground">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setAllForUser(user.id, true)}
                      variant="outline"
                      size="sm"
                    >
                      Todos
                    </Button>
                    <Button
                      onClick={() => setAllForUser(user.id, false)}
                      variant="outline"
                      size="sm"
                    >
                      Ninguno
                    </Button>
                    <Button
                      onClick={() => saveUserPerms(user.id)}
                      disabled={savingUserId === user.id}
                      size="sm"
                    >
                      {savingUserId === user.id ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {Object.entries(groupedFields).map(([groupName, fields]) => (
                    <div key={groupName} className="space-y-2">
                      <div className="text-sm font-medium text-foreground">{groupName}</div>
                      <div className="space-y-1.5">
                        {fields.map(field => (
                          <label
                            key={field.key}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(permsByUser[user.id]?.[field.key])}
                              onChange={() => toggleField(user.id, field.key)}
                              className="rounded border-input"
                            />
                            <span className="text-muted-foreground">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
