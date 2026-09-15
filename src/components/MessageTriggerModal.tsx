import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';
import { Loader2 } from 'lucide-react';
import {
  MessageTriggerFormData,
  TRIGGER_CONDITION_OPTIONS,
  MessageTrigger,
} from '../types/messageTriggers';
import {
  useCreateMessageTrigger,
  useUpdateMessageTrigger,
} from '../hooks/useMessageTriggers';
import { useAuth } from '../hooks/useAuth';

interface MessageTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: string;
  trigger?: MessageTrigger | null;
  mode: 'create' | 'edit';
}

const initialFormData: MessageTriggerFormData = {
  message_title: '',
  message_content: '',
  delay_hours: 0,
  trigger_condition: 'on_enter',
  is_active: true,
};

export const MessageTriggerModal: React.FC<MessageTriggerModalProps> = ({
  isOpen,
  onClose,
  columnId,
  trigger,
  mode,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<MessageTriggerFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof MessageTriggerFormData, string>>>({});

  const createMutation = useCreateMessageTrigger();
  const updateMutation = useUpdateMessageTrigger();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Cargar datos del disparador en modo edición
  useEffect(() => {
    if (mode === 'edit' && trigger) {
      setFormData({
        message_title: trigger.message_title,
        message_content: trigger.message_content,
        delay_hours: trigger.delay_hours || 0,
        trigger_condition: trigger.trigger_condition,
        is_active: trigger.is_active,
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors({});
  }, [mode, trigger, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof MessageTriggerFormData, string>> = {};

    if (!formData.message_title.trim()) {
      newErrors.message_title = 'El título es requerido';
    }

    if (!formData.message_content.trim()) {
      newErrors.message_content = 'El contenido del mensaje es requerido';
    }

    if (Number(formData.delay_hours) < 0) {
      newErrors.delay_hours = 'Las horas de retraso no pueden ser negativas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync({
          ...formData,
          column_id: columnId,
          user_id: user.id,
        });
      } else if (mode === 'edit' && trigger) {
        await updateMutation.mutateAsync({
          id: trigger.id,
          updates: formData,
        });
      }
      onClose();
    } catch (error) {
      // El error ya se maneja en los hooks
    }
  };

  const handleInputChange = (field: keyof MessageTriggerFormData, value: any) => {
    // Ensure delay_hours is always a number
    const processedValue = field === 'delay_hours' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Crear Disparador de Mensaje' : 'Editar Disparador de Mensaje'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message_title">Título del Mensaje</Label>
            <Input
              id="message_title"
              value={formData.message_title}
              onChange={(e) => handleInputChange('message_title', e.target.value)}
              placeholder="Ej: Mensaje de bienvenida"
              className={errors.message_title ? 'border-red-500' : ''}
            />
            {errors.message_title && (
              <p className="text-sm text-red-500">{errors.message_title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message_content">Contenido del Mensaje</Label>
            <Textarea
              id="message_content"
              value={formData.message_content}
              onChange={(e) => handleInputChange('message_content', e.target.value)}
              placeholder="Escribe el mensaje que se enviará..."
              rows={4}
              className={errors.message_content ? 'border-red-500' : ''}
            />
            {errors.message_content && (
              <p className="text-sm text-red-500">{errors.message_content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger_condition">Condición de Disparo</Label>
            <Select
              value={formData.trigger_condition}
              onValueChange={(value) => handleInputChange('trigger_condition', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuándo disparar" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_CONDITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay_hours">Retraso en Horas</Label>
            <Input
              id="delay_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.delay_hours}
              onChange={(e) => handleInputChange('delay_hours', parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={errors.delay_hours ? 'border-red-500' : ''}
            />
            <p className="text-sm text-gray-500">
              Tiempo de espera antes de enviar el mensaje (0 = inmediato)
            </p>
            {errors.delay_hours && (
              <p className="text-sm text-red-500">{errors.delay_hours}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Disparador activo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Crear' : 'Actualizar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};