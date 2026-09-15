import { supabase } from '@/integrations/supabase/client';

export type TAEstado = 'abierto' | 'respondido' | 'cerrado';
export type TACategoria = 'pago' | 'bug' | 'cuenta' | 'torneo' | 'referido' | 'otro';

export const TA_ESTADOS: TAEstado[] = ['abierto', 'respondido', 'cerrado'];
export const TA_CATEGORIAS: TACategoria[] = ['pago', 'bug', 'cuenta', 'torneo', 'referido', 'otro'];

export interface TAContacto {
  id: string;
  trucoarg_user_id: string;
  username: string | null;
  nombre: string | null;
  email: string | null;
}

export interface TAConversacion {
  id: string;
  trucoarg_ticket_id: string;
  contacto_id: string;
  subject: string | null;
  categoria: TACategoria;
  estado: TAEstado;
  ultimo_mensaje_at: string | null;
  creado_at: string;
  contacto?: TAContacto | null;
}

export interface TAMensaje {
  id: string;
  conversacion_id: string;
  autor: 'jugador' | 'admin' | 'crm';
  texto: string;
  agente: string | null;
  creado_at: string;
}

export interface TAEventoRaw {
  id: number;
  evento: string | null;
  ticket_id: string | null;
  firma_valida: boolean;
  procesado: boolean;
  error: string | null;
  recibido_at: string;
}

export async function listConversaciones(filters: {
  estado?: TAEstado | 'todos';
  categoria?: TACategoria | 'todas';
}): Promise<TAConversacion[]> {
  let query = supabase
    .from('trucoarg_conversaciones')
    .select('*, contacto:trucoarg_contactos(id, trucoarg_user_id, username, nombre, email)')
    .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
    .limit(300);

  if (filters.estado && filters.estado !== 'todos') query = query.eq('estado', filters.estado);
  if (filters.categoria && filters.categoria !== 'todas') query = query.eq('categoria', filters.categoria);

  const { data, error } = await query;
  if (error) {
    console.error('[trucoarg] listConversaciones', error);
    return [];
  }
  return (data || []) as unknown as TAConversacion[];
}

export async function countAbiertos(): Promise<number> {
  const { count, error } = await supabase
    .from('trucoarg_conversaciones')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'abierto');
  if (error) return 0;
  return count ?? 0;
}

export async function listMensajes(conversacionId: string): Promise<TAMensaje[]> {
  const { data, error } = await supabase
    .from('trucoarg_mensajes')
    .select('id, conversacion_id, autor, texto, agente, creado_at')
    .eq('conversacion_id', conversacionId)
    .order('creado_at', { ascending: true });
  if (error) {
    console.error('[trucoarg] listMensajes', error);
    return [];
  }
  return (data || []) as TAMensaje[];
}

export async function responderTicket(params: {
  ticketId: string;
  mensaje: string;
  agente?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('trucoarg-reply', {
    body: params
  });
  if (error) {
    return { ok: false, error: (data as any)?.error || error.message };
  }
  if ((data as any)?.error) return { ok: false, error: (data as any).error };
  return { ok: true };
}

export async function listEventosRaw(limit = 30): Promise<TAEventoRaw[]> {
  const { data, error } = await supabase
    .from('trucoarg_eventos_raw')
    .select('id, evento, ticket_id, firma_valida, procesado, error, recibido_at')
    .order('recibido_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[trucoarg] listEventosRaw', error);
    return [];
  }
  return (data || []) as TAEventoRaw[];
}

export function webhookUrl(): string {
  const base =
    import.meta.env.VITE_SUPABASE_URL ||
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  return `${base}/functions/v1/trucoarg-webhook`;
}
