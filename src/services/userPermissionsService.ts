import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type UserPermissions = Database['public']['Tables']['user_permissions']['Row'];
export type UserPermissionsInsert = Database['public']['Tables']['user_permissions']['Insert'];
export type UserPermissionsUpdate = Database['public']['Tables']['user_permissions']['Update'];

export const userPermissionsService = {
  /**
   * Get permissions for a specific user
   */
  async getByUserId(userId: string): Promise<UserPermissions | null> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Get permissions for current user
   */
  async getCurrentUserPermissions(): Promise<UserPermissions | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return this.getByUserId(user.id);
  },

  /**
   * Create permissions for a user
   */
  async create(permissions: UserPermissionsInsert) {
    const { data, error } = await supabase
      .from('user_permissions')
      .insert(permissions)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update permissions for a user
   */
  async update(userId: string, permissions: UserPermissionsUpdate) {
    const { data, error } = await supabase
      .from('user_permissions')
      .update(permissions)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Upsert permissions (create or update)
   */
  async upsert(permissions: UserPermissionsInsert) {
    const { data, error } = await supabase
      .from('user_permissions')
      .upsert(permissions)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete permissions for a user
   */
  async delete(userId: string) {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  }
};
