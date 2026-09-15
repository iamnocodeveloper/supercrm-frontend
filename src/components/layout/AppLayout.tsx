import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

const AppLayout = ({ children, noPadding = false }: AppLayoutProps) => {
  const { isImpersonating, profile } = useProfile();

  const exitImpersonation = () => {
    // Remove impersonate parameter and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('impersonate');
    window.location.href = url.toString();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {isImpersonating && (
          <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Modo Impersonación: Viendo como {profile?.first_name} {profile?.last_name} ({profile?.company_name})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitImpersonation}
              className="text-white hover:bg-orange-600 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <Header />
        <main className={`flex-1 overflow-y-auto ${noPadding ? 'p-0' : 'p-3 md:p-6'}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;