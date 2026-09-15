import { supabase } from '@/integrations/supabase/client';

export interface EtiquetaData {
    nombre: string;
    color: string;
    descripcion?: string;
    organizacion_id?: string;
}

export interface EtiquetaResponse {
    id: string;
    creado_en: string;
    nombre: string;
    color: string;
    descripcion?: string;
    creado_por?: string;
    organizacion_id?: string;
}

class TagsServices {
    /**
     * Obtiene todas las etiquetas
     */
    async getAllEtiquetas(): Promise<{ success: boolean; data?: EtiquetaResponse[]; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('etiquetas')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) {
                console.error('Error al obtener etiquetas:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EtiquetaResponse[]
            };
        } catch (error) {
            console.error('Error al obtener etiquetas:', error);
            return {
                success: false,
                error: 'Error de conexión al obtener etiquetas'
            };
        }
    }

    /**
     * Crea una nueva etiqueta
     */
    async createEtiqueta(etiquetaData: EtiquetaData): Promise<{ success: boolean; data?: EtiquetaResponse; error?: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return { success: false, error: 'Usuario no autenticado' };
            }

            const { data, error } = await supabase
                .from('etiquetas')
                .insert([{
                    ...etiquetaData,
                    creado_por: user.id
                }])
                .select()
                .single();

            if (error) {
                console.error('Error al crear etiqueta:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EtiquetaResponse
            };
        } catch (error) {
            console.error('Error al crear etiqueta:', error);
            return {
                success: false,
                error: 'Error de conexión al crear etiqueta'
            };
        }
    }

    /**
     * Actualiza una etiqueta existente
     */
    async updateEtiqueta(id: string, etiquetaData: Partial<EtiquetaData>): Promise<{ success: boolean; data?: EtiquetaResponse; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('etiquetas')
                .update(etiquetaData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error al actualizar etiqueta:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as EtiquetaResponse
            };
        } catch (error) {
            console.error('Error al actualizar etiqueta:', error);
            return {
                success: false,
                error: 'Error de conexión al actualizar etiqueta'
            };
        }
    }

    /**
     * Elimina una etiqueta
     */
    async deleteEtiqueta(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('etiquetas')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error al eliminar etiqueta:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error al eliminar etiqueta:', error);
            return {
                success: false,
                error: 'Error de conexión al eliminar etiqueta'
            };
        }
    }
}

export const tagsServices = new TagsServices();
export default TagsServices;
