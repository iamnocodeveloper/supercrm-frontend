import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type LeadColumn = Tables<'lead_columns'>;
type Lead = Tables<'leads'>;

interface ConversationSummary {
  id: string;
  phone_number: string;
  pushname: string | null;
  contact_name?: string | null;
  created_at?: string | null;
  last_message: string | null;
  last_message_time: string | null;
  last_inbound_message_time?: string | null;
  unread_count: number | null;
  channel_type?: string | null;
  whatsapp_number?: string | null;
}

export interface LeadWithColumn extends Lead {
  lead_columns?: LeadColumn;
  conversations?: ConversationSummary[];
  isVirtual?: boolean;
  originalConversationId?: string;
}

interface ColumnLeadsState {
  leads: LeadWithColumn[];
  hasMore: boolean;
  loading: boolean;
  offset: number;
  totalCount: number;
}

interface UseInfiniteLeadsOptions {
  userId: string | null;
  workspaceId: string | null;
  workspaceChannelType?: string | null;
  columnIds: string[];
  defaultColumnId: string | null;
  pageSize?: number;
}

const LEADS_PER_PAGE = 20;

export const useInfiniteLeads = ({
  userId,
  workspaceId,
  workspaceChannelType,
  columnIds,
  defaultColumnId,
  pageSize = LEADS_PER_PAGE
}: UseInfiniteLeadsOptions) => {
  const [columnLeadsState, setColumnLeadsState] = useState<Record<string, ColumnLeadsState>>({});
  const [orphanLeads, setOrphanLeads] = useState<LeadWithColumn[]>([]);
  const [orphanHasMore, setOrphanHasMore] = useState(true);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanOffset, setOrphanOffset] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const isInitialized = useRef(false);
  const isMovingLead = useRef(false);

  // Cargar leads de una columna específica
  const loadLeadsForColumn = useCallback(async (
    columnId: string, 
    offset: number = 0, 
    append: boolean = false
  ) => {
    if (!userId) return;

    // Marcar columna como cargando
    setColumnLeadsState(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        loading: true
      }
    }));

    try {
      // Cargar leads con paginación - columnas específicas para reducir egress
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, phone, email, company, tags, notes, value, column_id, position,
          bot_active, last_inbound_message_time, created_at, updated_at, user_id,
          lead_columns(id, name, color, position, workspace_id, is_default, created_at, updated_at, user_id),
          conversations:conversations!conversations_lead_id_fkey(
            id,
            phone_number,
            pushname,
            contact_name,
            created_at,
            last_message,
            last_message_time,
            last_inbound_message_time,
            unread_count,
            channel_type,
            whatsapp_number
          )
        `)
        .eq('column_id', columnId)
        .not('phone', 'like', '%@broadcast')
        .order('last_inbound_message_time', { ascending: false, nullsFirst: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error loading leads for column:', error);
        return;
      }

      // Usar todas las conversaciones incluyendo webchat
      const filteredLeads = (data || []).map(lead => ({
        ...lead,
        conversations: lead.conversations || []
      }));

      // Ordenar por último mensaje recibido (inbound)
      const sortedLeads = filteredLeads.sort((a, b) => {
        const aTime = a.conversations?.[0]?.last_inbound_message_time || a.conversations?.[0]?.last_message_time || a.updated_at;
        const bTime = b.conversations?.[0]?.last_inbound_message_time || b.conversations?.[0]?.last_message_time || b.updated_at;
        return new Date(bTime || 0).getTime() - new Date(aTime || 0).getTime();
      });

      setColumnLeadsState(prev => {
        const currentLeads = append ? (prev[columnId]?.leads || []) : [];
        return {
          ...prev,
          [columnId]: {
            leads: [...currentLeads, ...sortedLeads],
            hasMore: (data?.length || 0) === pageSize,
            loading: false,
            offset: offset + (data?.length || 0),
            totalCount: append ? Math.max(prev[columnId]?.totalCount || 0, offset + (data?.length || 0)) : (data?.length || 0)
          }
        };
      });
    } catch (error) {
      console.error('Error in loadLeadsForColumn:', error);
      setColumnLeadsState(prev => ({
        ...prev,
        [columnId]: {
          ...prev[columnId],
          loading: false
        }
      }));
    }
  }, [userId, pageSize]);

  // Cargar más leads de una columna
  const loadMoreForColumn = useCallback(async (columnId: string) => {
    const currentState = columnLeadsState[columnId];
    if (!currentState || currentState.loading || !currentState.hasMore) return;
    
    await loadLeadsForColumn(columnId, currentState.offset, true);
  }, [columnLeadsState, loadLeadsForColumn]);

  // Cargar conversaciones huérfanas (sin lead) - filtradas por workspace/conexión
  const loadOrphanConversations = useCallback(async (append: boolean = false) => {
    if (!userId || !defaultColumnId) return;

    setOrphanLoading(true);
    const currentOffset = append ? orphanOffset : 0;

    try {
      // Obtener IDs de conexiones según el channel_type del workspace
      let connectionIds: string[] = [];
      
      if (workspaceId && workspaceChannelType === 'twilio') {
        const { data: twilioConns } = await supabase
          .from('twilio_connections')
          .select('id')
          .eq('workspace_id', workspaceId);
        connectionIds = twilioConns?.map(c => c.id) || [];
      } else if (workspaceId && workspaceChannelType === 'telegram') {
        const { data: telegramBots } = await supabase
          .from('telegram_bots')
          .select('id')
          .eq('workspace_id', workspaceId);
        connectionIds = telegramBots?.map(b => b.id) || [];
      }

      // Base query para conversaciones huérfanas
      let query = supabase
        .from('conversations')
        .select('id, phone_number, pushname, contact_name, external_player, last_message, last_message_time, last_inbound_message_time, unread_count, channel_type, whatsapp_number, twilio_connection_id, telegram_bot_id, player_chat_id, created_at, updated_at')
        .eq('user_id', userId)
        .is('lead_id', null)
        .not('phone_number', 'like', '%@broadcast')
        ;

      // Aplicar filtro por conexiones si el workspace tiene channel_type específico
      if (workspaceChannelType === 'twilio') {
        if (connectionIds.length > 0) {
          // Incluir conexiones activas del workspace O conexiones eliminadas (NULL)
          // para mantener visibles las conversaciones de sesiones eliminadas
          query = query.or(
            `twilio_connection_id.in.(${connectionIds.join(',')}),twilio_connection_id.is.null`
          );
          query = query.eq('channel_type', 'twilio');
        } else {
          // Si no hay conexiones activas, solo mostrar las de conexiones eliminadas
          query = query.is('twilio_connection_id', null)
            .eq('channel_type', 'twilio');
        }
      } else if (workspaceChannelType === 'telegram' && connectionIds.length > 0) {
        query = query.in('telegram_bot_id', connectionIds);
      } else if (workspaceChannelType === 'whatsapp') {
        query = query.eq('channel_type', 'whatsapp');
      } else if (workspaceChannelType === 'player_chat') {
        query = query.eq('channel_type', 'player_chat');
      }
      // Si channel_type es null o 'all', no aplicar filtro adicional (comportamiento original)

      // Excluir player_chat solo si NO estamos en un workspace de tipo player_chat
      if (workspaceChannelType !== 'player_chat') {
        query = query.neq('channel_type', 'player_chat');
      }

      const { data, error } = await query
        .order('last_message_time', { ascending: false, nullsFirst: false })
        .range(currentOffset, currentOffset + pageSize - 1);

      if (error) {
        console.error('Error loading orphan conversations:', error);
        return;
      }

      // Crear leads virtuales
      const virtualLeads: LeadWithColumn[] = (data || []).map((conv, index) => {
        const ext = conv.external_player as any;
        const displayName =
          conv.contact_name ||
          ext?.full_name ||
          ext?.username ||
          conv.pushname ||
          conv.phone_number ||
          'Sin nombre';
        return {
          id: `virtual-${conv.id}`,
          name: displayName,
          phone: conv.phone_number,
          email: null,
          company: null,
          notes: null,
          value: null,
          tags: null,
          column_id: defaultColumnId,
          position: currentOffset + index,
          user_id: userId,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_inbound_message_time: conv.last_inbound_message_time,
          bot_active: true,
          isVirtual: true,
          originalConversationId: conv.id,
          conversations: [{
            id: conv.id,
            phone_number: conv.phone_number,
            pushname: conv.pushname,
            contact_name: conv.contact_name,
            external_player: conv.external_player,
            created_at: conv.created_at,
            last_message: conv.last_message,
            last_message_time: conv.last_message_time,
            last_inbound_message_time: conv.last_inbound_message_time,
            unread_count: conv.unread_count,
            channel_type: conv.channel_type,
            whatsapp_number: conv.whatsapp_number
          }]
        };
      });

      if (append) {
        setOrphanLeads(prev => [...prev, ...virtualLeads]);
      } else {
        setOrphanLeads(virtualLeads);
      }

      setOrphanHasMore((data?.length || 0) === pageSize);
      setOrphanOffset(currentOffset + (data?.length || 0));
    } catch (error) {
      console.error('Error in loadOrphanConversations:', error);
    } finally {
      setOrphanLoading(false);
    }
  }, [userId, workspaceId, workspaceChannelType, defaultColumnId, orphanOffset, pageSize]);

  // Cargar más conversaciones huérfanas
  const loadMoreOrphans = useCallback(async () => {
    if (orphanLoading || !orphanHasMore) return;
    await loadOrphanConversations(true);
  }, [orphanLoading, orphanHasMore, loadOrphanConversations]);

  // Carga inicial de todas las columnas
  const loadInitial = useCallback(async () => {
    if (!userId || columnIds.length === 0) return;

    setInitialLoading(true);
    
    try {
      const visibleColumnIds = columnIds.slice(0, 4);
      const backgroundColumnIds = columnIds.slice(4);

      await Promise.all([
        ...visibleColumnIds.map(colId => loadLeadsForColumn(colId, 0, false)),
        loadOrphanConversations(false)
      ]);

      if (backgroundColumnIds.length > 0) {
        window.setTimeout(() => {
          Promise.all(backgroundColumnIds.map(colId => loadLeadsForColumn(colId, 0, false)));
        }, 250);
      }
    } finally {
      setInitialLoading(false);
      isInitialized.current = true;
    }
  }, [userId, columnIds, loadLeadsForColumn, loadOrphanConversations]);

  // Refrescar una columna específica
  const refreshColumn = useCallback(async (columnId: string) => {
    await loadLeadsForColumn(columnId, 0, false);
  }, [loadLeadsForColumn]);

  // Refrescar todo
  const refreshAll = useCallback(async () => {
    isInitialized.current = false;
    setOrphanOffset(0);
    await loadInitial();
  }, [loadInitial]);

  // Obtener todos los leads combinados (para compatibilidad)
  const getAllLeads = useCallback((): LeadWithColumn[] => {
    const allRealLeads = Object.values(columnLeadsState).flatMap(state => state.leads);
    return [...allRealLeads, ...orphanLeads].sort((a, b) => {
      const aTime = a.conversations?.[0]?.last_inbound_message_time || a.conversations?.[0]?.last_message_time || a.updated_at;
      const bTime = b.conversations?.[0]?.last_inbound_message_time || b.conversations?.[0]?.last_message_time || b.updated_at;
      return new Date(bTime || 0).getTime() - new Date(aTime || 0).getTime();
    });
  }, [columnLeadsState, orphanLeads]);

  // Obtener leads de una columna específica
  const getLeadsForColumn = useCallback((columnId: string): LeadWithColumn[] => {
    const realLeads = columnLeadsState[columnId]?.leads || [];
    const virtualForColumn = orphanLeads.filter(lead => lead.column_id === columnId);
    
    return [...realLeads, ...virtualForColumn].sort((a, b) => {
      const aTime = a.conversations?.[0]?.last_inbound_message_time || a.conversations?.[0]?.last_message_time || a.updated_at;
      const bTime = b.conversations?.[0]?.last_inbound_message_time || b.conversations?.[0]?.last_message_time || b.updated_at;
      return new Date(bTime || 0).getTime() - new Date(aTime || 0).getTime();
    });
  }, [columnLeadsState, orphanLeads]);

  // Obtener estado de una columna
  const getColumnState = useCallback((columnId: string) => {
    const state = columnLeadsState[columnId];
    const isDefaultColumn = columnId === defaultColumnId;
    
    return {
      hasMore: state?.hasMore || (isDefaultColumn && orphanHasMore),
      loading: state?.loading || (isDefaultColumn && orphanLoading),
      totalCount: (state?.totalCount || 0) + (isDefaultColumn ? orphanLeads.length : 0),
      loadedCount: (state?.leads?.length || 0) + (isDefaultColumn ? orphanLeads.length : 0)
    };
  }, [columnLeadsState, defaultColumnId, orphanHasMore, orphanLoading, orphanLeads.length]);

  // Cargar más para una columna (incluye huérfanos si es la columna por defecto)
  const loadMore = useCallback(async (columnId: string) => {
    await loadMoreForColumn(columnId);
    
    // Si es la columna por defecto, también cargar más huérfanos
    if (columnId === defaultColumnId) {
      await loadMoreOrphans();
    }
  }, [loadMoreForColumn, loadMoreOrphans, defaultColumnId]);

  // Effect para cargar datos cuando cambian las columnas
  useEffect(() => {
    if (userId && columnIds.length > 0 && defaultColumnId && !isInitialized.current) {
loadInitial();
    }
  }, [userId, workspaceId, columnIds.length, defaultColumnId, loadInitial]);

  // Reset cuando cambia el workspace
  useEffect(() => {
    isInitialized.current = false;
  }, [workspaceId]);

  // Mover un lead optimisticamente entre columnas
  const moveLeadOptimistic = useCallback((leadId: string, sourceColumnId: string, targetColumnId: string) => {
    isMovingLead.current = true;
    
    setColumnLeadsState(prev => {
      const newState = { ...prev };
      
      // Encontrar el lead en la columna origen
      const sourceState = newState[sourceColumnId];
      if (!sourceState) return prev;
      
      const leadIndex = sourceState.leads.findIndex(l => l.id === leadId);
      if (leadIndex === -1) return prev;
      
      const lead = sourceState.leads[leadIndex];
      const updatedLead = { ...lead, column_id: targetColumnId };
      
      // Remover de la columna origen
      newState[sourceColumnId] = {
        ...sourceState,
        leads: sourceState.leads.filter(l => l.id !== leadId),
        totalCount: Math.max(0, (sourceState.totalCount || 0) - 1)
      };
      
      // Agregar a la columna destino
      const targetState = newState[targetColumnId] || {
        leads: [],
        hasMore: false,
        loading: false,
        offset: 0,
        totalCount: 0
      };
      
      newState[targetColumnId] = {
        ...targetState,
        leads: [updatedLead, ...targetState.leads],
        totalCount: (targetState.totalCount || 0) + 1
      };
      
      return newState;
    });
    
    // Resetear flag después de un breve delay para ignorar el evento Realtime que viene
    setTimeout(() => {
      isMovingLead.current = false;
    }, 1000);
  }, []);
  
  // Verificar si hay un movimiento en progreso (para uso externo)
  const isMoving = useCallback(() => isMovingLead.current, []);
  
  // Pausar/reanudar actualizaciones Realtime durante movimientos
  const setMovingState = useCallback((moving: boolean) => {
    isMovingLead.current = moving;
  }, []);

  return {
    // Estado
    columnLeadsState,
    orphanLeads,
    initialLoading,
    
    // Getters
    getAllLeads,
    getLeadsForColumn,
    getColumnState,
    
    // Actions
    loadMore,
    loadMoreForColumn,
    loadMoreOrphans,
    refreshColumn,
    refreshAll,
    loadInitial,
    moveLeadOptimistic,
    isMoving,
    setMovingState
  };
};

export default useInfiniteLeads;
