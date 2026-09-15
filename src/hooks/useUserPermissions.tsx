import { useState, useEffect } from 'react';
import { userPermissionsService, UserPermissions } from '@/services/userPermissionsService';
import { useProfile } from './useProfile';

export const useUserPermissions = () => {
  const { profile, isSuperAdmin } = useProfile();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Superadmins and clients have all permissions
        if (isSuperAdmin || profile.profile_type === 'client') {
          // Set all permissions to true for admins
          setPermissions({
            id: profile.id,
            user_id: profile.id,
            // Dashboard
            puede_ver_dashboard: true,
            // Contactos
            puede_ver_contactos: true,
            puede_crear_contactos: true,
            puede_editar_contactos: true,
            puede_eliminar_contactos: true,
            puede_importar_contactos: true,
            // Chats
            puede_ver_chats: true,
            puede_enviar_mensajes: true,
            puede_ver_mensajes_otros: true,
            puede_eliminar_mensajes: true,
            // Embudos
            puede_ver_embudos: true,
            puede_crear_embudos: true,
            puede_editar_embudos: true,
            puede_eliminar_embudos: true,
            puede_mover_contactos_embudos: true,
            // Ventas
            puede_ver_ventas: true,
            puede_crear_ventas: true,
            puede_editar_ventas: true,
            puede_eliminar_ventas: true,
            // Tareas
            puede_ver_tareas: true,
            puede_crear_tareas: true,
            puede_editar_tareas: true,
            puede_asignar_tareas: true,
            puede_eliminar_tareas: true,
            // Calendario
            puede_ver_calendario: true,
            // Reportes
            puede_ver_reportes: true,
            puede_exportar_datos: true,
            puede_ver_analytics: true,
            // Configuración
            puede_gestionar_usuarios: true,
            puede_ver_configuracion: true,
            puede_editar_configuracion: true,
            puede_gestionar_plantillas: true,
            puede_gestionar_respuestas_rapidas: true,
            puede_configurar_bot: true,
            puede_gestionar_etiquetas: true,
            puede_gestionar_workspaces: true,
            puede_gestionar_integraciones: true,
            // Integraciones
            puede_gestionar_whatsapp: true,
            puede_gestionar_telegram: true,
            // Campañas Masivas
            puede_ver_campanas_masivas: true,
            puede_crear_campanas_masivas: true,
            puede_editar_campanas_masivas: true,
            puede_eliminar_campanas_masivas: true,
            puede_enviar_campanas_masivas: true,
            // Listas de Contactos
            puede_ver_listas_contactos: true,
            puede_crear_listas_contactos: true,
            puede_editar_listas_contactos: true,
            puede_eliminar_listas_contactos: true,
            // Agentes IA
            puede_ver_agentes_ia: true,
            puede_crear_agentes_ia: true,
            puede_editar_agentes_ia: true,
            puede_eliminar_agentes_ia: true,
            // Chat Landing
            puede_ver_chat_landing: true,
            puede_responder_chat_landing: true,
            // Chat Interno
            puede_ver_chat_interno: true,
            puede_enviar_chat_interno: true,
            // IA Default
            puede_gestionar_ia: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as UserPermissions);
        } else {
          // Fetch permissions for regular users
          const data = await userPermissionsService.getCurrentUserPermissions();
          setPermissions(data);
        }
      } catch (err: any) {
        console.error('Error fetching permissions:', err);
        setError(err.message || 'Error al cargar permisos');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [profile, isSuperAdmin]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permissionKey: keyof UserPermissions): boolean => {
    if (!permissions) return false;
    if (isSuperAdmin || profile?.profile_type === 'client') return true;
    
    const value = permissions[permissionKey];
    return typeof value === 'boolean' ? value : false;
  };

  /**
   * Check if user is admin (client or superadmin)
   */
  const isAdmin = isSuperAdmin || profile?.profile_type === 'client';

  return {
    permissions,
    loading,
    error,
    hasPermission,
    isAdmin,
    refetch: () => {
      setLoading(true);
      setPermissions(null);
    }
  };
};
