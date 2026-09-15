import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

export interface WhatsAppConnection {
  id: string;
  name: string | null;
  phone_number: string;
  status: string | null;
  created_at: string | null;
  connection_subtype: string | null;
}

export const useWhatsAppConnections = () => {
  const { effectiveUserId } = useEffectiveUserId();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['whatsapp-connections', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status, created_at, connection_subtype')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching WhatsApp connections:', error);
        throw error;
      }

      return data as WhatsAppConnection[];
    },
    enabled: !!effectiveUserId,
  });

  const activeConnections = connections.filter(
    conn => conn.status === 'WORKING' || conn.status === 'connected'
  );

  const getConnectionByName = (name: string | null) => {
    if (!name) return null;
    return connections.find(conn => conn.name === name);
  };

  // Buscar conexión por número de teléfono (whatsapp_number de la conversación)
  const getConnectionByPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return null;
    return connections.find(conn => conn.phone_number === phoneNumber);
  };

  const isSessionActive = (sessionName: string | null) => {
    if (!sessionName) return false;
    const connection = getConnectionByName(sessionName);
    return connection?.status === 'WORKING' || connection?.status === 'connected';
  };

  // Verificar si sesión está activa por número de teléfono
  const isSessionActiveByPhone = (phoneNumber: string | null) => {
    if (!phoneNumber) return false;
    const connection = getConnectionByPhoneNumber(phoneNumber);
    return connection?.status === 'WORKING' || connection?.status === 'connected';
  };

  // Obtener el nombre de la sesión a partir del número de teléfono
  const getSessionNameByPhone = (phoneNumber: string | null): string | null => {
    if (!phoneNumber) return null;
    const connection = getConnectionByPhoneNumber(phoneNumber);
    return connection?.name || null;
  };

  return {
    connections,
    activeConnections,
    isLoading,
    getConnectionByName,
    isSessionActive,
    getConnectionByPhoneNumber,
    isSessionActiveByPhone,
    getSessionNameByPhone,
  };
};
