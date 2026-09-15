import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { UserList } from '@/components/internal-chat/UserList';
import { ChatArea } from '@/components/internal-chat/ChatArea';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const InternalChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header simplificado */}
      <div className="h-14 border-b border-border bg-card px-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Chat Interno</h1>
      </div>

      {/* Contenido del chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de usuarios - ocultar en móvil cuando hay usuario seleccionado */}
        {(!isMobileView || !selectedUser) && (
          <UserList
            currentUserId={user?.id || ''}
            selectedUser={selectedUser}
            onSelectUser={setSelectedUser}
            isMobile={isMobileView}
          />
        )}

        {/* Área de chat */}
        <ChatArea
          currentUserId={user?.id || ''}
          selectedUser={selectedUser}
          onBack={() => setSelectedUser(null)}
          isMobile={isMobileView}
        />
      </div>
    </div>
  );
};

export default InternalChat;
