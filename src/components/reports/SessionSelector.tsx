import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SessionInfo } from '@/services/reportsService';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';

interface SessionSelectorProps {
  sessions: SessionInfo[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  isLoading?: boolean;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedSessionId,
  onSelect,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="h-10 w-full max-w-xs bg-muted animate-pulse rounded-md" />
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-2">
        No hay sesiones disponibles para este canal
      </div>
    );
  }

  return (
    <Select value={selectedSessionId || 'all'} onValueChange={onSelect}>
      <SelectTrigger className="w-full max-w-md">
        <SelectValue placeholder="Seleccionar sesión..." />
      </SelectTrigger>
      <SelectContent>
        {/* All sessions option */}
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="font-medium">Todas las sesiones</span>
            <Badge variant="secondary" className="text-xs">
              {sessions.length}
            </Badge>
          </div>
        </SelectItem>
        
        {/* Individual sessions */}
        {sessions.map(session => (
          <SelectItem key={session.id} value={session.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{session.name}</span>
              {session.phoneNumber && (
                <span className="text-muted-foreground text-sm">
                  ({session.phoneNumber})
                </span>
              )}
              <Badge 
                variant={session.status === 'active' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {session.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
