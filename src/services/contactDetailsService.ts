import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type ContactDetail = Database['public']['Tables']['contact_details']['Row'];
export type ContactSale = Database['public']['Tables']['contact_sales']['Row'];
export type ContactDetailInsert = Database['public']['Tables']['contact_details']['Insert'];
export type ContactSaleInsert = Database['public']['Tables']['contact_sales']['Insert'];

export const contactDetailsService = {
  async getByConversation(conversationId: string): Promise<ContactDetail | null> {
    const { data, error } = await supabase
      .from('contact_details')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching contact details:', error);
      return null;
    }

    return data;
  },

  async upsert(detail: Partial<ContactDetail>, conversationId: string, userId: string): Promise<ContactDetail | null> {
    const { data, error } = await supabase
      .from('contact_details')
      .upsert({
        ...detail,
        conversation_id: conversationId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting contact details:', error);
      throw error;
    }

    return data;
  },

  async getSales(contactDetailId: string): Promise<ContactSale[]> {
    const { data, error } = await supabase
      .from('contact_sales')
      .select('*')
      .eq('contact_detail_id', contactDetailId)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching contact sales:', error);
      return [];
    }

    return data || [];
  },

  async createSale(sale: ContactSaleInsert): Promise<ContactSale | null> {
    const { data, error } = await supabase
      .from('contact_sales')
      .insert(sale)
      .select()
      .single();

    if (error) {
      console.error('Error creating sale:', error);
      throw error;
    }

    return data;
  },

  async updateSale(id: string, updates: Partial<ContactSale>): Promise<ContactSale | null> {
    const { data, error } = await supabase
      .from('contact_sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sale:', error);
      throw error;
    }

    return data;
  },

  async deleteSale(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('contact_sales')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting sale:', error);
      return false;
    }

    return true;
  },
};