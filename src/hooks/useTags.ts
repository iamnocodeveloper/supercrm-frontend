import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback, useMemo } from 'react';

export interface Etiqueta {
  id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
}

// Función de fetch separada para React Query
const fetchEtiquetas = async (): Promise<Etiqueta[]> => {
  const { data, error } = await supabase
    .from('etiquetas')
    .select('id, nombre, color, descripcion')
    .order('nombre');

  if (error) throw error;
  return data || [];
};

export const useTags = () => {
  const queryClient = useQueryClient();

  const { data: etiquetas = [], isLoading } = useQuery({
    queryKey: ['etiquetas'],
    queryFn: fetchEtiquetas,
    staleTime: 5 * 60 * 1000, // 5 minutos - evitar recargas innecesarias
    gcTime: 10 * 60 * 1000, // 10 minutos en cache
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Memoizar funciones de búsqueda
  const getTagColor = useCallback((tagName: string): string => {
    const tag = etiquetas.find(e => e.nombre === tagName);
    return tag?.color || '#6b7280';
  }, [etiquetas]);

  const getTagByName = useCallback((tagName: string): Etiqueta | undefined => {
    return etiquetas.find(e => e.nombre === tagName);
  }, [etiquetas]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['etiquetas'] });
  }, [queryClient]);

  return useMemo(() => ({
    etiquetas,
    isLoading,
    getTagColor,
    getTagByName,
    refresh,
  }), [etiquetas, isLoading, getTagColor, getTagByName, refresh]);
};

// Servicio para sincronizar tags entre contacts y leads
export const syncTagsBetweenContactAndLead = async (
  phoneNumber: string,
  tags: string[]
): Promise<void> => {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  try {
    // Actualizar en contacts
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .or(`phone_number.eq.${cleanPhone},phone_number.eq.${phoneNumber}`)
      .maybeSingle();
    
    if (contact) {
      await supabase
        .from('contacts')
        .update({ tags: tags.length > 0 ? tags : null })
        .eq('id', contact.id);
    }

    // Actualizar en leads
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .or(`phone.eq.${cleanPhone},phone.eq.${phoneNumber}`)
      .maybeSingle();
    
    if (lead) {
      await supabase
        .from('leads')
        .update({ tags: tags.length > 0 ? tags : null })
        .eq('id', lead.id);
    }
  } catch (error) {
    console.error('Error syncing tags:', error);
    throw error;
  }
};