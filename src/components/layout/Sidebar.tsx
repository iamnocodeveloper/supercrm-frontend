import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Users, UserPlus, Send, Settings, Menu, X, Bot, Phone, MessagesSquare, Globe, BarChart3, Sparkles, Copy, Gamepad2, MessageSquarePlus, Mail, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useTheme } from 'next-themes';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Usuario con acceso exclusivo al módulo de Email Masivo (configurable por entorno)
const EMAIL_ONLY_USER = import.meta.env.VITE_EMAIL_ONLY_USER || '';

interface SidebarItem {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  href: string;
  badge?: number;
  permission?: string;
  adminOnly?: boolean;
  emailOnly?: string;
  dataTour?: string;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();
  const { unreadCount } = useConversations();
  const { resolvedTheme } = useTheme();
  const { hasPermission, isAdmin, loading: permissionsLoading } = useUserPermissions();
  const logoLightUrl = new URL('../../assets/logocapinegro.png', import.meta.url).href;
  const logoDarkUrl = new URL('../../assets/logocapi.png', import.meta.url).href;

  // Función para detectar si una ruta está activa
  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  };

  // Mapeo de rutas a permisos
  const permissionMap: Record<string, string> = {
    '/': 'puede_ver_dashboard',
    '/conversaciones': 'puede_ver_chats',
    '/crear-conversacion': 'puede_ver_chats',
    '/chat-landing': 'puede_ver_chats',
    '/chat-interno': 'puede_ver_chats',
    '/soporte-trucoarg': 'puede_ver_chats',
    '/grupos-whatsapp': 'puede_gestionar_whatsapp',
    '/estados-whatsapp': 'puede_gestionar_whatsapp',
    '/campanas-masivas': 'puede_enviar_mensajes',
    '/leads': 'puede_ver_embudos',
    '/leads-webchat': 'puede_ver_embudos',
    '/contactos': 'puede_ver_contactos',
    '/listas-contactos': 'puede_ver_contactos',
    '/asistente-ia': 'puede_ver_configuracion',
    '/ventas': 'puede_ver_ventas',
    '/reportes': 'puede_ver_dashboard',
    '/configuracion': 'puede_ver_configuracion',
  };

  // Crear grupos de sidebar dinámicamente con el contador de conversaciones
  const allSidebarGroups: SidebarGroup[] = [{
    label: 'Principal',
    items: [{
      label: 'Panel Principal',
      icon: LayoutDashboard,
      href: '/',
      permission: 'puede_ver_dashboard'
    }, {
      label: 'Reportes',
      icon: BarChart3,
      href: '/reportes',
      permission: 'puede_ver_dashboard'
    }, {
      label: 'Análisis IA',
      icon: Sparkles,
      href: '/analisis-conversaciones',
      permission: 'puede_ver_dashboard'
    }]
  }, {
    label: 'Comunicaciones',
    items: [{
      label: 'Conversaciones',
      icon: MessageSquare,
      href: '/conversaciones',
      badge: unreadCount > 0 ? unreadCount : undefined,
      permission: 'puede_ver_chats'
    }, {
      label: '#Crear conversación',
      icon: MessageSquarePlus,
      href: '/crear-conversacion',
      permission: 'puede_ver_chats'
    }, {
      label: 'Chat - Landing',
      icon: Globe,
      href: '/chat-landing',
      permission: 'puede_ver_chats'
    }, {
      label: 'Chat Interno',
      icon: MessagesSquare,
      href: '/chat-interno',
      permission: 'puede_ver_chats'
    }, {
      label: 'Campañas Masivas',
      icon: Send,
      href: '/campanas-masivas',
      permission: 'puede_enviar_mensajes'
    }, {
      label: 'Chat Jugadores',
      icon: Gamepad2,
      href: '/chat-jugadores',
      permission: 'puede_ver_chats'
    }, {
      label: 'Grupos WhatsApp',
      icon: Users,
      href: '/grupos-whatsapp',
      permission: 'puede_gestionar_whatsapp'
    }, {
      label: 'Estados WhatsApp',
      icon: Send,
      href: '/estados-whatsapp',
      permission: 'puede_gestionar_whatsapp'
    }, {
      label: 'Soporte TrucoArg',
      icon: LifeBuoy,
      href: '/soporte-trucoarg',
      permission: 'puede_ver_chats'
    }]
  }, {
    label: 'Gestión',
    items: [{
      label: 'Embudos',
      icon: UserPlus,
      href: '/leads',
      permission: 'puede_ver_embudos'
    }, {
      label: 'Embudos WebChat',
      icon: Globe,
      href: '/leads-webchat',
      permission: 'puede_ver_embudos'
    }, {
      label: 'Contactos',
      icon: Users,
      href: '/contactos',
      permission: 'puede_ver_contactos'
    }, {
      label: 'Listas de Contactos',
      icon: Users,
      href: '/listas-contactos',
      permission: 'puede_ver_contactos'
    }, {
      label: 'Contactos duplicados',
      icon: Copy,
      href: '/contactos-duplicados',
      adminOnly: true,
      dataTour: 'duplicates-sidebar'
    }, {
      label: 'Asistente IA',
      icon: Bot,
      href: '/asistente-ia',
      permission: 'puede_ver_configuracion'
    }]
  }, {
    label: 'Email',
    items: [{
      label: 'Email Masivo',
      icon: Mail,
      href: '/email-masivo',
      emailOnly: EMAIL_ONLY_USER
    }]
  }, {
    label: 'Sistema',
    items: [{
      label: 'Configuración',
      icon: Settings,
      href: '/configuracion'
      // No requiere permiso específico - todos pueden acceder a su perfil
    }]
  }];

  // Filtrar items del sidebar según permisos
  const isEmailOnlyUser = user?.email?.toLowerCase() === EMAIL_ONLY_USER;

  const sidebarGroups = useMemo(() => {
    // Usuario exclusivo de Email Masivo: solo ve ese módulo
    if (isEmailOnlyUser) {
      return allSidebarGroups
        .map(group => ({ ...group, items: group.items.filter(item => item.emailOnly) }))
        .filter(group => group.items.length > 0);
    }

    if (permissionsLoading) {
      return allSidebarGroups
        .map(group => ({ ...group, items: group.items.filter(item => !item.emailOnly) }))
        .filter(group => group.items.length > 0);
    }

    return allSidebarGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Módulo exclusivo de un usuario específico
        if (item.emailOnly) return false;

        // adminOnly: solo admins
        if (item.adminOnly && !isAdmin) return false;

        // Admins ven todo
        if (isAdmin) return true;

        // Si no hay permiso requerido, mostrar
        if (!item.permission) return true;

        // Verificar permiso
        return hasPermission(item.permission as any);
      })
    })).filter(group => group.items.length > 0);
  }, [isAdmin, hasPermission, permissionsLoading, unreadCount, isEmailOnlyUser]);
  return <TooltipProvider delayDuration={300}>
      {/* Mobile overlay */}
      {isMobileOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileOpen(false)} />}

      {/* Mobile menu button */}
      <button onClick={() => setIsMobileOpen(true)} className="fixed top-4 left-4 z-50 md:hidden p-2 bg-card rounded-lg shadow-lg border border-border">
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <div className={cn("fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300", "md:relative md:translate-x-0", isCollapsed ? "w-16" : "w-64", isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!isCollapsed && <div className="flex items-center space-x-3">
                <img src={resolvedTheme === 'dark' ? logoDarkUrl : logoLightUrl} alt="CAPIBET" className="h-12 w-auto" />
              </div>}
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex p-2 hover:bg-sidebar-accent rounded-lg transition-colors">
              {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>
            <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-2 hover:bg-sidebar-accent rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {sidebarGroups.map((group, groupIndex) => <div key={groupIndex} className="mb-6">
                {!isCollapsed && <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-3 px-3">
                    {group.label}
                  </h3>}
                <div className="space-y-1">
                  {group.items.map((item, itemIndex) => isCollapsed ? (
                    <Tooltip key={itemIndex}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          data-tour={item.dataTour}
                          className={cn(
                            "group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 hover:bg-sidebar-accent relative",
                            isActiveRoute(item.href) && "bg-sidebar-accent shadow-md"
                          )}
                        >
                          <item.icon className={cn("h-6 w-6 transition-colors", isActiveRoute(item.href) ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary")} />
                          {item.badge && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link key={itemIndex} to={item.href} data-tour={item.dataTour} className={cn("group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-sidebar-accent", isActiveRoute(item.href) && "bg-sidebar-accent border border-sidebar-border shadow-sm")}>
                      <item.icon className={cn("h-5 w-5 transition-colors", isActiveRoute(item.href) ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary")} />
                      
                      <div className="flex items-center justify-between w-full">
                        <span className={cn("font-medium transition-colors", isActiveRoute(item.href) ? "text-sidebar-primary" : "text-sidebar-foreground group-hover:text-sidebar-primary")}>
                          {item.label}
                        </span>
                        
                        {item.badge && <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                            {item.badge}
                          </span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>)}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className={cn("flex items-center space-x-3 p-3 rounded-lg bg-sidebar-accent", isCollapsed && "justify-center")}>
              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.email}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">Usuario</p>
                </div>}
            </div>
            {!isCollapsed && <div className="text-xs text-muted-foreground text-center mt-3">
                Versión 3.11.0 10-09-26
              </div>}
          </div>
        </div>
      </div>
    </TooltipProvider>;
};
