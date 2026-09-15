import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageTriggerService } from '../services/messageTriggerService';
import { MessageTrigger, MessageTriggerInsert, MessageTriggerUpdate } from '../types/messageTriggers';
import { useEffectiveUserId } from './useEffectiveUserId';
import { toast } from 'sonner';

// Hook para obtener todos los disparadores del usuario
export const useMessageTriggers = () => {
  const { effectiveUserId } = useEffectiveUserId();
  
  return useQuery({
    queryKey: ['messageTriggers', effectiveUserId],
    queryFn: () => MessageTriggerService.getMessageTriggers(effectiveUserId!),
    enabled: !!effectiveUserId,
  });
};

// Hook para obtener disparadores por columna
export const useMessageTriggersByColumn = (columnId: string) => {
  return useQuery({
    queryKey: ['messageTriggers', 'column', columnId],
    queryFn: () => MessageTriggerService.getMessageTriggersByColumn(columnId),
    enabled: !!columnId,
  });
};

// Hook para obtener un disparador específico
export const useMessageTrigger = (id: string) => {
  return useQuery({
    queryKey: ['messageTrigger', id],
    queryFn: () => MessageTriggerService.getMessageTriggerById(id),
    enabled: !!id,
  });
};

// Hook para obtener disparadores con información de columna
export const useMessageTriggersWithColumnInfo = () => {
  const { effectiveUserId } = useEffectiveUserId();
  
  return useQuery({
    queryKey: ['messageTriggersWithColumnInfo', effectiveUserId],
    queryFn: () => MessageTriggerService.getMessageTriggersWithColumnInfo(effectiveUserId!),
    enabled: !!effectiveUserId,
  });
};

// Hook para crear un disparador
export const useCreateMessageTrigger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trigger: MessageTriggerInsert) => 
      MessageTriggerService.createMessageTrigger(trigger),
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['messageTriggers'] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggers', 'column', data.column_id] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggersWithColumnInfo'] });
      
      toast.success('Disparador creado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al crear disparador: ${error.message}`);
    },
  });
};

// Hook para actualizar un disparador
export const useUpdateMessageTrigger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MessageTriggerUpdate }) =>
      MessageTriggerService.updateMessageTrigger(id, updates),
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['messageTriggers'] });
      queryClient.invalidateQueries({ queryKey: ['messageTrigger', data.id] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggers', 'column', data.column_id] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggersWithColumnInfo'] });
      
      toast.success('Disparador actualizado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar disparador: ${error.message}`);
    },
  });
};

// Hook para eliminar un disparador
export const useDeleteMessageTrigger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => MessageTriggerService.deleteMessageTrigger(id),
    onSuccess: () => {
      // Invalidar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['messageTriggers'] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggersWithColumnInfo'] });
      
      toast.success('Disparador eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar disparador: ${error.message}`);
    },
  });
};

// Hook para activar/desactivar un disparador
export const useToggleMessageTrigger = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      MessageTriggerService.toggleMessageTrigger(id, isActive),
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['messageTriggers'] });
      queryClient.invalidateQueries({ queryKey: ['messageTrigger', data.id] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggers', 'column', data.column_id] });
      queryClient.invalidateQueries({ queryKey: ['messageTriggersWithColumnInfo'] });
      
      const status = data.is_active ? 'activado' : 'desactivado';
      toast.success(`Disparador ${status} exitosamente`);
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado del disparador: ${error.message}`);
    },
  });
};

// Hook para obtener disparadores activos por columna y condición
export const useActiveTriggersByColumnAndCondition = (columnId: string, condition: string) => {
  return useQuery({
    queryKey: ['activeTriggers', columnId, condition],
    queryFn: () => MessageTriggerService.getActiveTriggersByColumnAndCondition(columnId, condition),
    enabled: !!columnId && !!condition,
  });
};