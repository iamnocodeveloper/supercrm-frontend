import { Tables, TablesInsert, TablesUpdate } from '../integrations/supabase/types';

// Tipos base de la tabla column_message_triggers
export type MessageTrigger = Tables<'column_message_triggers'>;
export type MessageTriggerInsert = TablesInsert<'column_message_triggers'>;
export type MessageTriggerUpdate = TablesUpdate<'column_message_triggers'>;

// Tipos específicos para la UI
export interface MessageTriggerFormData {
  message_title: string;
  message_content: string;
  delay_hours: number;
  trigger_condition: string;
  is_active: boolean;
}

// Opciones para las condiciones de disparo
export const TRIGGER_CONDITIONS = {
  ON_ENTER: 'on_enter',
  ON_EXIT: 'on_exit',
  ON_BOTH: 'on_both'
} as const;

export type TriggerCondition = typeof TRIGGER_CONDITIONS[keyof typeof TRIGGER_CONDITIONS];

// Opciones para las condiciones de disparo con etiquetas
export const TRIGGER_CONDITION_OPTIONS = [
  { value: TRIGGER_CONDITIONS.ON_ENTER, label: 'Al entrar a la columna' },
  { value: TRIGGER_CONDITIONS.ON_EXIT, label: 'Al salir de la columna' },
  { value: TRIGGER_CONDITIONS.ON_BOTH, label: 'Al entrar y salir' }
];

// Tipo para el estado del modal
export interface MessageTriggerModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  columnId: string | null;
  triggerId: string | null;
}

// Tipo para la respuesta de la API con información adicional
export interface MessageTriggerWithColumn extends MessageTrigger {
  column_name?: string;
  column_color?: string;
}

// Tipo para los logs de mensajes automatizados
export type AutomatedMessageLog = Tables<'automated_message_logs'>;