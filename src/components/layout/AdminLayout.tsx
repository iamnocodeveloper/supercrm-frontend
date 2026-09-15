import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings, 
  Menu, 
  X,
  LogOut,
  BarChart3,
  DollarSign,
  Shield,
  Calendar,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logocapinegro.png';
import { useNavigate, useLocation } from 'react-router-dom';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    }
  };

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      href: '/admin',
      active: location.pathname === '/admin'
    },
    {
      icon: Users,
      label: 'Usuarios',
      href: '/admin/usuarios',
      active: location.pathname === '/admin/usuarios'
    },
    {
      icon: CreditCard,
      label: 'Planes de Pago',
      href: '/admin/planes',
      active: location.pathname === '/admin/planes'
    },
    {
      icon: DollarSign,
      label: 'Métodos de Pago',
      href: '/admin/metodos-pago',
      active: location.pathname === '/admin/metodos-pago'
    },
    {
      icon: BarChart3,
      label: 'Estadísticas',
      href: '/admin/estadisticas',
      active: location.pathname === '/admin/estadisticas'
    },
    {
      icon: Calendar,
      label: 'Suscripciones',
      href: '/admin/gestion-suscripciones',
      active: location.pathname === '/admin/gestion-suscripciones'
    },
    {
      icon: FileText,
      label: 'Auditoría',
      href: '/admin/auditoria',
      active: location.pathname === '/admin/auditoria'
    }
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo section */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center space-x-2">
            <img src={logo} alt="Capibet" className="h-10 w-auto bg-white rounded-lg p-1" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <div className="space-y-1">
              <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                  Administración
                </h3>
              </div>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                      item.active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
                    )}
                  >
                    <Icon className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      item.active
                        ? "text-sidebar-primary-foreground"
                        : "text-sidebar-foreground group-hover:text-sidebar-primary"
                    )} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-sidebar-accent">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  Super Admin
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  Panel de Administración
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-3 mb-3">
              Versión 3.11.0 10-09-26
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-10 flex h-16 bg-card/50 backdrop-blur-sm border-b border-border lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="px-4"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-lg font-semibold text-foreground">Admin Panel</h1>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;