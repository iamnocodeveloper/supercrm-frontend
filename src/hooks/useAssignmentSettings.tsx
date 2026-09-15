import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

export type AssignStrategy = 'round_robin' | 'least_load' | 'manual';

export interface AssignmentSettings {
  account_owner_id: string;
  auto_assign_enabled: boolean;
  assign_strategy: AssignStrategy;
  include_unassigned_for_all: boolean;
  last_assigned_user_id: string | null;
}

const DEFAULTS: Omit<AssignmentSettings, 'account_owner_id'> = {
  auto_assign_enabled: false,
  assign_strategy: 'manual',
  include_unassigned_for_all: true,
  last_assigned_user_id: null,
};

export const useAssignmentSettings = () => {
  const { effectiveUserId } = useEffectiveUserId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['assignment-settings', effectiveUserId],
    queryFn: async (): Promise<AssignmentSettings> => {
      if (!effectiveUserId) throw new Error('No effective user');
      const { data, error } = await supabase
        .from('assignment_settings')
        .select('*')
        .eq('account_owner_id', effectiveUserId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return { account_owner_id: effectiveUserId, ...DEFAULTS };
      }
      return data as AssignmentSettings;
    },
    enabled: !!effectiveUserId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<AssignmentSettings>) => {
      if (!effectiveUserId) throw new Error('No effective user');
      const { data, error } = await supabase
        .from('assignment_settings')
        .upsert(
          {
            account_owner_id: effectiveUserId,
            ...DEFAULTS,
            ...query.data,
            ...patch,
          },
          { onConflict: 'account_owner_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data as AssignmentSettings;
    },
    onSuccess: (data) => {
      qc.setQueryData(['assignment-settings', effectiveUserId], data);
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
};
