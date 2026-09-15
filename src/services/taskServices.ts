import { supabase } from '@/integrations/supabase/client';

// Tipos para las tareas
export interface TareaData {
    id?: number;
    titulo: string;
    descripion?: string; // Nota: mantenemos el typo de CapibetCRM para compatibilidad
    fecha: string;
    hora?: string;
    asignada?: number; // ID del usuario asignado
    creado_por?: number;
    categoria: string;
    prioridad: string;
}

export interface TareaResponse {
    id: number;
    created_at?: string;
    titulo: string;
    descripion?: string;
    fecha: string;
    hora?: string;
    asignada?: number;
    creado_por?: number;
    categoria: string;
    prioridad: string;
}

class TaskServices {
    /**
     * Obtiene todas las tareas
     */
    async getAllTareas(): Promise<{ success: boolean; data?: TareaResponse[]; error?: string }> {
        try {
            console.log('Obteniendo todas las tareas');

            const { data, error } = await supabase
                .from('tareas')
                .select('*')
                .order('fecha', { ascending: true });

            if (error) {
                console.error('Error al obtener tareas:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as TareaResponse[]
            };
        } catch (error) {
            console.error('Error al obtener tareas:', error);
            return {
                success: false,
                error: 'Error de conexión al obtener tareas'
            };
        }
    }

    /**
     * Obtiene tareas filtradas por usuario (para comerciales)
     */
    async getTareasByUser(userId: number): Promise<{ success: boolean; data?: TareaResponse[]; error?: string }> {
        try {
            console.log('Obteniendo tareas del usuario:', userId);

            const { data, error } = await supabase
                .from('tareas')
                .select('*')
                .or(`asignada.eq.${userId},creado_por.eq.${userId}`)
                .order('fecha', { ascending: true });

            if (error) {
                console.error('Error al obtener tareas del usuario:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as TareaResponse[]
            };
        } catch (error) {
            console.error('Error al obtener tareas del usuario:', error);
            return {
                success: false,
                error: 'Error de conexión al obtener tareas del usuario'
            };
        }
    }

    /**
     * Crea una nueva tarea
     */
    async createTarea(tareaData: TareaData): Promise<{ success: boolean; data?: TareaResponse; error?: string }> {
        try {
            console.log('Creando nueva tarea:', tareaData);

            const { data, error } = await supabase
                .from('tareas')
                .insert([tareaData])
                .select()
                .single();

            if (error) {
                console.error('Error al crear tarea:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as TareaResponse
            };
        } catch (error) {
            console.error('Error al crear tarea:', error);
            return {
                success: false,
                error: 'Error de conexión al crear tarea'
            };
        }
    }

    /**
     * Actualiza una tarea existente
     */
    async updateTarea(tareaId: number, tareaData: Partial<TareaData>): Promise<{ success: boolean; data?: TareaResponse; error?: string }> {
        try {
            console.log('Actualizando tarea:', tareaId, tareaData);

            const { data, error } = await supabase
                .from('tareas')
                .update(tareaData)
                .eq('id', tareaId)
                .select()
                .single();

            if (error) {
                console.error('Error al actualizar tarea:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return {
                success: true,
                data: data as TareaResponse
            };
        } catch (error) {
            console.error('Error al actualizar tarea:', error);
            return {
                success: false,
                error: 'Error de conexión al actualizar tarea'
            };
        }
    }

    /**
     * Elimina una tarea
     */
    async deleteTarea(tareaId: number): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('Eliminando tarea:', tareaId);

            const { error } = await supabase
                .from('tareas')
                .delete()
                .eq('id', tareaId);

            if (error) {
                console.error('Error al eliminar tarea:', error);
                return {
                    success: false,
                    error: error.message
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error al eliminar tarea:', error);
            return {
                success: false,
                error: 'Error de conexión al eliminar tarea'
            };
        }
    }

    /**
     * Obtiene el conteo de tareas
     */
    async getTareasCount(): Promise<{ success: boolean; data?: number; error?: string }> {
        try {
            const response = await this.getAllTareas();

            if (response.success && Array.isArray(response.data)) {
                return {
                    success: true,
                    data: response.data.length
                };
            }

            return {
                success: false,
                error: 'Error al obtener el conteo de tareas'
            };
        } catch (error) {
            console.error('Error counting tareas:', error);
            return {
                success: false,
                error: 'Error de conexión al contar tareas'
            };
        }
    }
}

// Exportar una instancia singleton del servicio
export const taskServices = new TaskServices();

// Exportar también la clase para casos especiales
export default TaskServices;
