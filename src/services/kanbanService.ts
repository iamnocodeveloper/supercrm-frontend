import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type LeadColumn = Database['public']['Tables']['lead_columns']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

export interface LeadData {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  value?: number;
  notes?: string;
}

export class KanbanService {
  /**
   * Obtiene todas las columnas del Kanban del usuario
   */
  static async getUserColumns(userId: string): Promise<LeadColumn[]> {
    const { data, error } = await supabase
      .from('lead_columns')
      .select('*')
      .eq('user_id', userId)
      .order('position');

    if (error) {
      console.error('Error loading columns:', error);
      throw new Error('Error al cargar las columnas del Kanban');
    }

    return data || [];
  }

  /**
   * Busca un lead existente por número de teléfono
   */
  static async findLeadByPhone(phone: string, userId: string): Promise<Lead | null> {
    if (!phone) return null;

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error searching lead:', error);
      throw new Error('Error al buscar el lead');
    }

    return data || null;
  }

  /**
   * Crea un nuevo lead en la columna especificada
   */
  static async createLead(
    leadData: LeadData,
    columnId: string,
    userId: string
  ): Promise<Lead> {
    // Obtener la posición para el nuevo lead
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('column_id', columnId);

    const position = count || 0;

    const leadInsert: LeadInsert = {
      name: leadData.name,
      phone: leadData.phone || null,
      email: leadData.email || null,
      company: leadData.company || null,
      value: leadData.value || null,
      notes: leadData.notes || null,
      column_id: columnId,
      user_id: userId,
      position
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(leadInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw new Error('Error al crear el lead');
    }

    return data;
  }

  /**
   * Actualiza un lead existente y lo mueve a una nueva columna
   */
  static async updateLeadColumn(
    leadId: string,
    columnId: string,
    userId: string
  ): Promise<Lead> {
    // Obtener la posición para el lead en la nueva columna
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('column_id', columnId);

    const position = count || 0;

    const { data, error } = await supabase
      .from('leads')
      .update({
        column_id: columnId,
        position
      })
      .eq('id', leadId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      throw new Error('Error al actualizar el lead');
    }

    return data;
  }

  /**
   * Crea la columna por defecto si no existe
   */
  static async createDefaultColumn(userId: string): Promise<LeadColumn> {
    const { data, error } = await supabase
      .from('lead_columns')
      .insert({
        name: 'Nuevos Leads',
        color: '#3b82f6',
        is_default: true,
        position: 0,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default column:', error);
      throw new Error('Error al crear la columna por defecto');
    }

    return data;
  }

  /**
   * Obtiene o crea la columna por defecto del usuario
   */
  static async getOrCreateDefaultColumn(userId: string): Promise<LeadColumn> {
    const columns = await this.getUserColumns(userId);
    
    // Buscar columna por defecto
    let defaultColumn = columns.find(col => col.is_default);
    
    if (!defaultColumn) {
      // Si no hay columna por defecto, usar la primera disponible
      defaultColumn = columns[0];
    }
    
    if (!defaultColumn) {
      // Si no hay columnas, crear la columna por defecto
      defaultColumn = await this.createDefaultColumn(userId);
    }
    
    return defaultColumn;
  }
}