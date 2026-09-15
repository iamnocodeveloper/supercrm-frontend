import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface AccountUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_type: Database['public']['Enums']['profile_type'] | null;
  parent_user_id: string | null;
  role: AppRole | null;
  created_at: string;
}

const fetchAccountUsers = async (userId: string): Promise<AccountUser[]> => {
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id, parent_user_id, profile_type')
    .eq('id', userId)
    .single();

  if (!currentProfile) {
    throw new Error('Perfil no encontrado');
  }

  const accountOwnerId = currentProfile.parent_user_id || currentProfile.id;

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, profile_type, parent_user_id, created_at')
    .or(`id.eq.${accountOwnerId},parent_user_id.eq.${accountOwnerId}`)
    .order('created_at', { ascending: false });

  if (profilesError) throw profilesError;

  const usersWithRoles = await Promise.all(
    profiles.map(async (profile) => {
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id)
        .maybeSingle();

      return {
        ...profile,
        role: userRole?.role || null,
      };
    })
  );

  return usersWithRoles as AccountUser[];
};

/**
 * Hook para obtener todos los usuarios de la misma cuenta (empresa)
 * Incluye el admin y todos los usuarios cajero que creó
 */
export const useAccountUsers = () => {
  const { user } = useAuth();

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['account-users', user?.id],
    queryFn: () => fetchAccountUsers(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    users,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    getUsersByRole: (role: AppRole) => users.filter(u => u.role === role),
    getCashiers: () => users.filter(u => u.parent_user_id !== null),
    getAdmin: () => users.find(u => u.parent_user_id === null),
  };
};
