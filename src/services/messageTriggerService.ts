import { supabase } from '../integrations/supabase/client';
import { MessageTrigger, MessageTriggerInsert, MessageTriggerUpdate } from '../types/messageTriggers';

export class MessageTriggerService {
  // Obtener todos los disparadores de un usuario
  static async getMessageTriggers(userId: string): Promise<MessageTrigger[]> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener disparadores: ${error.message}`);
    }

    return data || [];
  }

  // Obtener disparadores por columna
  static async getMessageTriggersByColumn(columnId: string): Promise<MessageTrigger[]> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select('*')
      .eq('column_id', columnId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener disparadores de la columna: ${error.message}`);
    }

    return data || [];
  }

  // Obtener un disparador por ID
  static async getMessageTriggerById(id: string): Promise<MessageTrigger | null> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No encontrado
      }
      throw new Error(`Error al obtener disparador: ${error.message}`);
    }

    return data;
  }

  // Crear un nuevo disparador
  static async createMessageTrigger(trigger: MessageTriggerInsert): Promise<MessageTrigger> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .insert(trigger)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al crear disparador: ${error.message}`);
    }

    return data;
  }

  // Actualizar un disparador
  static async updateMessageTrigger(id: string, updates: MessageTriggerUpdate): Promise<MessageTrigger> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar disparador: ${error.message}`);
    }

    return data;
  }

  // Eliminar un disparador
  static async deleteMessageTrigger(id: string): Promise<void> {
    const { error } = await supabase
      .from('column_message_triggers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar disparador: ${error.message}`);
    }
  }

  // Activar/desactivar un disparador
  static async toggleMessageTrigger(id: string, isActive: boolean): Promise<MessageTrigger> {
    return this.updateMessageTrigger(id, { is_active: isActive });
  }

  // Obtener disparadores por condición
  static async getTriggersByCondition(condition: string): Promise<MessageTrigger[]> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select('*')
      .eq('trigger_condition', condition)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener disparadores por condición: ${error.message}`);
    }

    return data || [];
  }

  // Obtener disparadores activos por columna y condición
  static async getActiveTriggersByColumnAndCondition(
    columnId: string, 
    condition: string
  ): Promise<MessageTrigger[]> {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select('*')
      .eq('column_id', columnId)
      .eq('is_active', true)
      .in('trigger_condition', [condition, 'on_both'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener disparadores activos: ${error.message}`);
    }

    return data || [];
  }

  // Obtener disparadores con información de la columna
  static async getMessageTriggersWithColumnInfo(userId: string) {
    const { data, error } = await supabase
      .from('column_message_triggers')
      .select(`
        *,
        lead_columns!inner(
          name,
          color
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener disparadores con información de columna: ${error.message}`);
    }

    return data || [];
  }
}
