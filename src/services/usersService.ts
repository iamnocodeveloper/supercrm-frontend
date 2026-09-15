import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];
export type ProfileType = Database['public']['Enums']['profile_type'];

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_type: ProfileType | null;
  role: AppRole | null;
  created_at: string;
}

export const usersService = {
  /**
   * Get all users belonging to the current client admin's account
   */
  async getAllUsers(): Promise<UserProfile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current user's profile to check if they're admin or have parent
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, parent_user_id, profile_type')
      .eq('id', user.id)
      .single();

    if (!currentProfile) throw new Error('Profile not found');

    // Determine the account owner ID
    const accountOwnerId = currentProfile.parent_user_id || currentProfile.id;

    // Get all profiles in this account (users with this parent_user_id + the admin itself)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, profile_type, parent_user_id, created_at')
      .or(`id.eq.${accountOwnerId},parent_user_id.eq.${accountOwnerId}`)
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      profiles.map(async (profile) => {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .maybeSingle();

        return {
          ...profile,
          role: userRole?.role || null
        };
      })
    );

    return usersWithRoles;
  },

  /**
   * Create a new user (cajero) for the current client admin using Edge Function
   */
  async createUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: AppRole = 'user',
    permissions?: Record<string, boolean>
  ) {
    // Call the create-user edge function
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email,
        password,
        firstName,
        lastName,
        role,
        permissions
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      throw new Error(error.message || 'Error al crear usuario');
    }

    if (!data.success) {
      throw new Error(data.error || 'Error al crear usuario');
    }

    return data.user;
  },

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: AppRole) {
    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: newRole
      });

    if (error) throw error;
  },

  /**
   * Delete user via Edge Function
   */
  async deleteUser(userId: string) {
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { userId }
    });

    if (error) {
      console.error('Error deleting user:', error);
      throw new Error(error.message || 'Error al eliminar usuario');
    }

    if (!data.success) {
      throw new Error(data.error || 'Error al eliminar usuario');
    }

    return data;
  }
};
