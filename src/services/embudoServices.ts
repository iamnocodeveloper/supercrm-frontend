import { supabase } from '@/integrations/supabase/client';

export interface EmbudoData {
    name: string;
    position: number;
    color?: string;
}

export interface EmbudoResponse {
    id: string;
    name: string;
    user_id: string;
    position: number;
    color: string | null;
    is_default: boolean | null;
    workspace_id: string | null;
    created_at: string | null;
    updated_at: string | null;
}

class EmbudoServices {
    /**
     * Obtiene todas las columnas (embudos) de un espacio de trabajo
     */
    async getEmbudosByEspacio(workspaceId: string): Promise<{ success: boolean; data?: EmbudoResponse[]; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('lead_columns')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('position', { ascending: true });

            if (error) {
                console.error('Error al obtener embudos:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EmbudoResponse[]
            };
        } catch (error) {
            console.error('Error al obtener embudos:', error);
            return {
                success: false,
                error: 'Error de conexión al obtener embudos'
            };
        }
    }

    /**
     * Crea una nueva columna (embudo)
     */
    async createEmbudo(embudoData: EmbudoData & { workspace_id: string }): Promise<{ success: boolean; data?: EmbudoResponse; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return { success: false, error: 'Usuario no autenticado' };
            }

            const { data, error } = await supabase
                .from('lead_columns')
                .insert([{
                    name: embudoData.name,
                    position: embudoData.position,
                    color: embudoData.color || '#3b82f6',
                    workspace_id: embudoData.workspace_id,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) {
                console.error('Error al crear embudo:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EmbudoResponse
            };
        } catch (error) {
            console.error('Error al crear embudo:', error);
            return {
                success: false,
                error: 'Error de conexión al crear embudo'
            };
        }
    }

    /**
     * Actualiza una columna (embudo)
     */
    async updateEmbudo(id: string, embudoData: Partial<EmbudoData>): Promise<{ success: boolean; data?: EmbudoResponse; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('lead_columns')
                .update(embudoData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error al actualizar embudo:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EmbudoResponse
            };
        } catch (error) {
            console.error('Error al actualizar embudo:', error);
            return {
                success: false,
                error: 'Error de conexión al actualizar embudo'
            };
        }
    }

    /**
     * Actualiza las posiciones de múltiples embudos en batch
     */
    async updateEmbudoPositions(updates: { id: string; position: number }[]): Promise<{ success: boolean; error?: string }> {
        try {
            // Usar Promise.all para actualizar todas las posiciones en paralelo
            const updatePromises = updates.map(update =>
                supabase
                    .from('lead_columns')
                    .update({ position: update.position })
                    .eq('id', update.id)
            );

            const results = await Promise.all(updatePromises);
            
            // Verificar si hubo algún error
            const errorResult = results.find(r => r.error);
            if (errorResult?.error) {
                console.error('Error al actualizar posiciones:', errorResult.error);
                return {
                    success: false,
                    error: errorResult.error.message
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error al actualizar posiciones:', error);
            return {
                success: false,
                error: 'Error de conexión al actualizar posiciones'
            };
        }
    }

    /**
     * Elimina una columna (embudo)
     */
    async deleteEmbudo(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('lead_columns')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error al eliminar embudo:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error al eliminar embudo:', error);
            return {
                success: false,
                error: 'Error de conexión al eliminar embudo'
            };
        }
    }
}

export const embudoServices = new EmbudoServices();
export default EmbudoServices;
