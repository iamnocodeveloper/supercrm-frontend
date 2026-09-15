import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAgentPresence, PresenceStatus } from '@/hooks/useAgentPresence';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_META: Record<PresenceStatus, { label: string; color: string; dot: string }> = {
  online: { label: 'Disponible', color: 'text-green-600', dot: 'fill-green-500 text-green-500' },
  away: { label: 'Ausente', color: 'text-yellow-600', dot: 'fill-yellow-500 text-yellow-500' },
  busy: { label: 'Ocupado', color: 'text-orange-600', dot: 'fill-orange-500 text-orange-500' },
  offline: { label: 'Desconectado', color: 'text-muted-foreground', dot: 'fill-muted-foreground text-muted-foreground' },
};

export const AgentPresenceChip: React.FC = () => {
  const { isActive, effectiveStatus, setManualOverride } = useAgentPresence();

  if (!isActive) return null;

  const meta = STATUS_META[effectiveStatus];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Circle className={cn('h-2.5 w-2.5', meta.dot)} />
          <span className={cn('text-xs font-medium', meta.color)}>{meta.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Mi estado</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setManualOverride(null)}>
          <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500 mr-2" />
          Automático (Disponible)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setManualOverride('busy')}>
          <Circle className="h-2.5 w-2.5 fill-orange-500 text-orange-500 mr-2" />
          Ocupado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setManualOverride('away')}>
          <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500 mr-2" />
          Ausente
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setManualOverride('offline')}>
          <Circle className="h-2.5 w-2.5 fill-muted-foreground text-muted-foreground mr-2" />
          No molestar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
