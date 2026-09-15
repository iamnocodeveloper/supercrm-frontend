import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useConversationAssignment } from '@/hooks/useConversationAssignment';
import { UserCheck, Wand2 } from 'lucide-react';

interface Props {
  conversationId: string;
}

export const AssignedAgentSection: React.FC<Props> = ({ conversationId }) => {
  const { isAdmin, hasPermission } = useUserPermissions();
  const { users, getCashiers } = useAccountUsers();
  const { assign, autoAssign, isAssigning } = useConversationAssignment();
  const canAssign = isAdmin || hasPermission('puede_asignar_tareas');

  const { data: conv } = useQuery({
    queryKey: ['conversation-assignment', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('assigned_to')
        .eq('id', conversationId)
        .single();
      return data;
    },
  });

  const assignedUser = users.find((u) => u.id === conv?.assigned_to);
  const cashiers = getCashiers();
  const assignableUsers = users; // admins también pueden ser asignados

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserCheck className="h-4 w-4 text-primary" />
        Agente asignado
      </div>

      {!canAssign ? (
        <div>
          {assignedUser ? (
            <Badge variant="secondary">
              {[assignedUser.first_name, assignedUser.last_name].filter(Boolean).join(' ') || assignedUser.email}
            </Badge>
          ) : (
            <Badge variant="outline">Sin asignar</Badge>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Select
            value={conv?.assigned_to || 'none'}
            onValueChange={(v) => assign({ conversationId, agentId: v === 'none' ? null : v })}
            disabled={isAssigning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {assignableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isAssigning || cashiers.length === 0}
            onClick={() => autoAssign(conversationId)}
          >
            <Wand2 className="h-3.5 w-3.5 mr-2" />
            Auto-asignar ahora
          </Button>
        </div>
      )}
    </Card>
  );
};
