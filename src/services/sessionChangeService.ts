// =====================================================================
// sessionChangeService
//
// Lógica ÚNICA de cambio de sesión de WhatsApp para una conversación.
// La usan Leads (Kanban) y Conversaciones, y replica lo que hace
// `waha-webhook` cuando entra un mensaje por otra sesión:
//
//   1) SIEMPRE reutiliza la conversación existente (nunca crea otra).
//   2) Actualiza whatsapp_number / connection_id / session_name.
//   3) Si la sesión nueva pertenece a OTRO embudo (workspace), mueve el
//      lead del contacto a la columna por defecto de ese workspace,
//      VALIDANDO que la columna pertenezca al workspace.
// =====================================================================

import { supabase } from '@/integrations/supabase/client';

export interface SessionConnection {
  id: string;
  name: string | null;
  workspace_id: string | null;
  default_column_id: string | null;
}

export interface ApplySessionChangeParams {
  conversation: {
    id: string;
    lead_id?: string | null;
    phone_number?: string | null;
    whatsapp_number?: string | null;
    connection_id?: string | null;
    channel_type?: string | null;
  };
  newSessionName: string | null;
  newSessionPhoneNumber?: string | null;
  /** Dueño real de la cuenta (effectiveUserId). */
  userId: string;
}

export interface ApplySessionChangeResult {
  /** Conversación actualizada (fila completa). */
  conversation: any | null;
  /** Conexión resuelta. */
  connection: SessionConnection | null;
  /** true si el lead cambió de embudo (columna/workspace). */
  moved: boolean;
  /** Workspace destino cuando moved = true. */
  targetWorkspaceId: string | null;
  /** Columna/embudo destino cuando moved = true. */
  targetColumnId: string | null;
  /** Nombre del embudo/columna destino cuando moved = true. */
  targetColumnName: string | null;
}

/** Busca la conexión por nombre; fallback por teléfono. */
export async function findSessionConnection(
  userId: string,
  newSessionName: string | null,
  newSessionPhoneNumber?: string | null,
): Promise<SessionConnection | null> {
  if (newSessionName) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('id, name, workspace_id, default_column_id')
      .eq('user_id', userId)
      .eq('name', newSessionName)
      .maybeSingle();
    if (data) return data as SessionConnection;
  }

  if (newSessionPhoneNumber) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('id, name, workspace_id, default_column_id')
      .eq('user_id', userId)
      .eq('phone_number', newSessionPhoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as SessionConnection;
  }

  return null;
}

/**
 * Resuelve el embudo (columna) destino de la sesión nueva:
 *   1) default_column_id de la conexión (es el "embudo de la sesión", sin
 *      importar si el workspace es el mismo o distinto)
 *   2) columna is_default del workspace de la conexión
 *   3) primera columna por position del workspace
 *
 * Devuelve también el workspace real de la columna para poder mover la vista.
 */
export async function resolveTargetColumn(
  connection: SessionConnection,
): Promise<{ columnId: string; workspaceId: string | null; columnName: string | null } | null> {
  const workspaceId = connection.workspace_id;

  if (connection.default_column_id) {
    const { data } = await supabase
      .from('lead_columns')
      .select('id, name, workspace_id')
      .eq('id', connection.default_column_id)
      .maybeSingle();
    if (data?.id) {
      return {
        columnId: data.id,
        workspaceId: data.workspace_id ?? workspaceId,
        columnName: data.name ?? null,
      };
    }
  }

  if (!workspaceId) return null;

  const { data: defCol } = await supabase
    .from('lead_columns')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .maybeSingle();
  if (defCol?.id) {
    return { columnId: defCol.id, workspaceId, columnName: defCol.name ?? null };
  }

  const { data: firstCol } = await supabase
    .from('lead_columns')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstCol?.id) {
    return { columnId: firstCol.id, workspaceId, columnName: firstCol.name ?? null };
  }

  return null;
}

/**
 * Aplica el cambio de sesión a una conversación de WhatsApp.
 * No lanza si el movimiento de embudo no es posible; devuelve moved=false.
 */
export async function applySessionChange(
  params: ApplySessionChangeParams,
): Promise<ApplySessionChangeResult> {
  const { conversation, newSessionName, newSessionPhoneNumber, userId } = params;

  const connection = await findSessionConnection(
    userId,
    newSessionName,
    newSessionPhoneNumber,
  );

  if (!connection) {
    throw new Error('No se encontró la conexión de WhatsApp seleccionada');
  }

  const nextPhone = newSessionPhoneNumber ?? conversation.whatsapp_number ?? null;

  let updated: any = null;

  const { data: updatedRow, error } = await supabase
    .from('conversations')
    .update({
      whatsapp_number: nextPhone,
      connection_id: connection.id,
      session_name: connection.name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)
    .select()
    .single();

  if (error) {
    // Índice único parcial conversations_unique_whatsapp_session
    // (user_id, phone_number, whatsapp_number, channel_type): ya existe otra
    // conversación del contacto con esa sesión (duplicado previo). En vez de
    // fallar, reutilizamos la existente.
    if ((error as { code?: string }).code === '23505' && conversation.phone_number && nextPhone) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('phone_number', conversation.phone_number)
        .eq('whatsapp_number', nextPhone)
        .eq('channel_type', 'whatsapp')
        .maybeSingle();

      if (!existing) throw error;

      updated = existing;

      // Si la conversación reutilizada no tiene lead, heredar el del contacto.
      if ((existing.lead_id ?? null) === null && conversation.lead_id) {
        await supabase
          .from('conversations')
          .update({ lead_id: conversation.lead_id, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        existing.lead_id = conversation.lead_id;
      }
    } else {
      throw error;
    }
  } else {
    updated = updatedRow;
  }

  let moved = false;
  let targetWorkspaceId: string | null = null;
  let targetColumnId: string | null = null;
  let targetColumnName: string | null = null;

  const leadId = conversation.lead_id;
  if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, column_id')
      .eq('id', leadId)
      .maybeSingle();

    if (lead?.column_id) {
      // Siempre apuntamos al embudo (columna por defecto) de la sesión nueva.
      // Antes solo se movía si cambiaba el workspace, pero todas las sesiones
      // de una cuenta suelen compartir workspace y diferenciarse por su
      // columna por defecto, así que el lead nunca se movía.
      const target = await resolveTargetColumn(connection);
      if (target && target.columnId !== lead.column_id) {
        const { error: moveError } = await supabase
          .from('leads')
          .update({ column_id: target.columnId, updated_at: new Date().toISOString() })
          .eq('id', lead.id);

        if (!moveError) {
          moved = true;
          targetWorkspaceId = target.workspaceId;
          targetColumnId = target.columnId;
          targetColumnName = target.columnName;
        } else {
          console.error('[sessionChange] Error moviendo lead de embudo:', moveError);
        }
      }
    }
  }

  return {
    conversation: updated ?? null,
    connection,
    moved,
    targetWorkspaceId,
    targetColumnId,
    targetColumnName,
  };
}
