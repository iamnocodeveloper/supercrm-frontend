import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];

export const salesService = {
  // Products
  async getProducts(userId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, price, stock, user_id, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createProduct(product: ProductInsert): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Sales
  async getSales(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, client_id, product_id, quantity, total_amount, sale_date, seller_id, user_id, created_at, updated_at,
        product:products(id, name, price),
        client:leads(id, name, phone)
      `)
      .eq('user_id', userId)
      .order('sale_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createSale(sale: SaleInsert): Promise<Sale> {
    // First, get the product and update stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .eq('id', sale.product_id)
      .single();

    if (productError) throw productError;
    if (!product) throw new Error('Product not found');

    const newStock = product.stock - (sale.quantity || 0);
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', sale.product_id);

    if (updateError) throw updateError;

    // Create sale
    const { data, error } = await supabase
      .from('sales')
      .insert(sale)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSale(id: string, updates: Partial<Sale>): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteSale(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get leads (clients) for sales
  async getLeads(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },
};