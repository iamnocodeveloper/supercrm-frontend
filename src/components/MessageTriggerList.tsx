import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Clock,
  Edit,
  MoreVertical,
  Power,
  PowerOff,
  Trash2,
  Plus,
  MessageSquare,
} from 'lucide-react';
import {
  useMessageTriggersByColumn,
  useDeleteMessageTrigger,
  useToggleMessageTrigger,
} from '../hooks/useMessageTriggers';
import { MessageTrigger, TRIGGER_CONDITION_OPTIONS } from '../types/messageTriggers';
import { MessageTriggerModal } from './MessageTriggerModal';

interface MessageTriggerListProps {
  columnId: string;
  columnName: string;
}

export const MessageTriggerList: React.FC<MessageTriggerListProps> = ({
  columnId,
  columnName,
}) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'create' as 'create' | 'edit',
    trigger: null as MessageTrigger | null,
  });
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    triggerId: null as string | null,
  });

  const { data: triggers = [], isLoading } = useMessageTriggersByColumn(columnId);
  const deleteMutation = useDeleteMessageTrigger();
  const toggleMutation = useToggleMessageTrigger();

  const handleCreateTrigger = () => {
    setModalState({
      isOpen: true,
      mode: 'create',
      trigger: null,
    });
  };

  const handleEditTrigger = (trigger: MessageTrigger) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      trigger,
    });
  };

  const handleDeleteTrigger = (triggerId: string) => {
    setDeleteDialog({
      isOpen: true,
      triggerId,
    });
  };

  const confirmDelete = async () => {
    if (deleteDialog.triggerId) {
      await deleteMutation.mutateAsync(deleteDialog.triggerId);
      setDeleteDialog({ isOpen: false, triggerId: null });
    }
  };

  const handleToggleTrigger = async (triggerId: string, currentStatus: boolean) => {
    await toggleMutation.mutateAsync({
      id: triggerId,
      isActive: !currentStatus,
    });
  };

  const getTriggerConditionLabel = (condition: string) => {
    const option = TRIGGER_CONDITION_OPTIONS.find(opt => opt.value === condition);
    return option?.label || condition;
  };

  const formatDelayHours = (hours: number | null) => {
    if (!hours || hours === 0) return 'Inmediato';
    if (hours < 1) return `${hours * 60} min`;
    if (hours === 1) return '1 hora';
    return `${hours} horas`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Disparadores de {columnName}
          </h3>
          <p className="text-sm text-gray-600">
            {triggers.length} disparador{triggers.length !== 1 ? 'es' : ''} configurado{triggers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={handleCreateTrigger} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Disparador
        </Button>
      </div>

      {triggers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center mb-4">
              No hay disparadores configurados para esta columna
            </p>
            <Button onClick={handleCreateTrigger} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Crear primer disparador
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <Card key={trigger.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {trigger.message_title}
                      <Badge
                        variant={trigger.is_active ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {trigger.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {getTriggerConditionLabel(trigger.trigger_condition)}
                      {trigger.delay_hours !== null && trigger.delay_hours > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDelayHours(trigger.delay_hours)}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditTrigger(trigger)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleTrigger(trigger.id, trigger.is_active)}
                      >
                        {trigger.is_active ? (
                          <>
                            <PowerOff className="h-4 w-4 mr-2" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 mr-2" />
                            Activar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteTrigger(trigger.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {trigger.message_content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para crear/editar disparador */}
      <MessageTriggerModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, mode: 'create', trigger: null })}
        columnId={columnId}
        trigger={modalState.trigger}
        mode={modalState.mode}
      />

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => 
        setDeleteDialog({ isOpen: open, triggerId: null })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar disparador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El disparador será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};