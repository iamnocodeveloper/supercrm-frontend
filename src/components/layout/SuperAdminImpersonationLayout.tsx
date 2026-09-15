import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface SuperAdminImpersonationLayoutProps {
  children: React.ReactNode;
}

const SuperAdminImpersonationLayout = ({ children }: SuperAdminImpersonationLayoutProps) => {
  const { isImpersonating, profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const exitImpersonation = () => {
    // Remove impersonate parameter and redirect to admin panel
    const url = new URL(window.location.href);
    url.searchParams.delete('impersonate');
    window.location.href = '/admin/usuarios';
  };

  const goToAdminPanel = () => {
    // Keep impersonation but go to admin panel
    navigate('/admin/usuarios');
    toast({
      title: "Regresando al panel de administración",
      description: "Puedes volver a acceder al panel del usuario desde la lista",
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Super Admin Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold">
                  Modo Super Admin - Impersonando Usuario
                </div>
                <div className="text-xs opacity-90">
                  Viendo como: {profile?.first_name} {profile?.last_name} 
                  {profile?.company_name && ` (${profile.company_name})`}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToAdminPanel}
                className="text-white hover:bg-white/20 text-xs px-3 py-1 h-auto"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Panel Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={exitImpersonation}
                className="text-white hover:bg-white/20 h-6 w-6 p-0"
                title="Salir del modo impersonación"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminImpersonationLayout;