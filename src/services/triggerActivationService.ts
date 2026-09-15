import { supabase } from '../integrations/supabase/client';
import { MessageTriggerService } from './messageTriggerService';
import { MessageTrigger } from '../types/messageTriggers';

export interface TriggerActivationData {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  fromColumnId?: string;
  toColumnId: string;
  userId: string;
}

export class TriggerActivationService {
  // Activar disparadores cuando un lead se mueve a una columna
  static async activateTriggersOnLeadMove(data: TriggerActivationData): Promise<void> {
    const { leadId, leadName, leadPhone, fromColumnId, toColumnId, userId } = data;

    try {
      // Obtener disparadores activos para la columna de destino (on_enter y on_both)
      const enterTriggers = await MessageTriggerService.getActiveTriggersByColumnAndCondition(
        toColumnId,
        'on_enter'
      );

      // Obtener disparadores activos para la columna de origen (on_exit y on_both)
      let exitTriggers: MessageTrigger[] = [];
      if (fromColumnId) {
        exitTriggers = await MessageTriggerService.getActiveTriggersByColumnAndCondition(
          fromColumnId,
          'on_exit'
        );
      }

      // Combinar todos los disparadores
      const allTriggers = [...enterTriggers, ...exitTriggers];

      // Procesar cada disparador
      for (const trigger of allTriggers) {
        await this.processTrigger(trigger, {
          leadId,
          leadName,
          leadPhone,
          userId
        });
      }
    } catch (error) {
      console.error('Error al activar disparadores:', error);
      throw error;
    }
  }

  // Procesar un disparador individual
  private static async processTrigger(
    trigger: MessageTrigger,
    leadData: {
      leadId: string;
      leadName: string;
      leadPhone?: string;
      userId: string;
    }
  ): Promise<void> {
    const { leadId, leadName, leadPhone, userId } = leadData;

    try {
      // Verificar si el lead tiene número de teléfono para enviar mensaje
      if (!leadPhone) {
        console.warn(`Lead ${leadName} no tiene número de teléfono, omitiendo disparador ${trigger.id}`);
        return;
      }

      // Personalizar el contenido del mensaje
      const personalizedContent = this.personalizeMessage(trigger.message_content, {
        leadName,
        leadPhone
      });

      // Calcular el tiempo de envío
      const sendAt = this.calculateSendTime(trigger.delay_hours);

      // Registrar el mensaje programado en los logs
      await this.logScheduledMessage({
        triggerId: trigger.id,
        leadId,
        messageContent: personalizedContent,
        messageTitle: trigger.message_title,
        scheduledFor: sendAt,
        userId,
        leadPhone
      });

      console.log(`Disparador ${trigger.id} programado para lead ${leadName} a las ${sendAt}`);
    } catch (error) {
      console.error(`Error al procesar disparador ${trigger.id}:`, error);
      throw error;
    }
  }

  // Personalizar el contenido del mensaje con datos del lead
  private static personalizeMessage(
    content: string,
    data: { leadName: string; leadPhone: string }
  ): string {
    return content
      .replace(/\{\{nombre\}\}/g, data.leadName)
      .replace(/\{\{name\}\}/g, data.leadName)
      .replace(/\{\{telefono\}\}/g, data.leadPhone)
      .replace(/\{\{phone\}\}/g, data.leadPhone);
  }

  // Calcular el tiempo de envío basado en las horas de retraso
  private static calculateSendTime(delayHours: number | null): string {
    const now = new Date();
    const delayMs = (delayHours || 0) * 60 * 60 * 1000; // Convertir horas a milisegundos
    const sendTime = new Date(now.getTime() + delayMs);
    return sendTime.toISOString();
  }

  // Registrar el mensaje programado en los logs
  private static async logScheduledMessage(data: {
    triggerId: string;
    leadId: string;
    messageContent: string;
    messageTitle: string;
    scheduledFor: string;
    userId: string;
    leadPhone: string;
  }): Promise<void> {
    const {
      triggerId,
      leadId,
      messageContent,
      scheduledFor,
      userId,
      leadPhone
    } = data;

    try {
      // Obtener la instancia de WhatsApp activa del usuario
      const { data: whatsappConnection, error: connectionError } = await supabase
        .from('whatsapp_connections')
        .select('name')
        .eq('user_id', userId)
        .eq('status', 'conectado')
        .limit(1)
        .single();

      if (connectionError || !whatsappConnection) {
        console.warn(`No active WhatsApp connection found for user ${userId}, skipping message scheduling`);
        return;
      }

      const { error } = await supabase
        .from('automated_message_logs')
        .insert({
          trigger_id: triggerId,
          lead_id: leadId,
          message_content: messageContent,
          user_id: userId,
          phone_number: leadPhone,
          scheduled_for: scheduledFor,
          status: 'pending',
          retry_count: 0,
        });

      if (error) {
        throw new Error(`Error al registrar mensaje programado: ${error.message}`);
      }

      console.log(`✅ Mensaje programado para ${scheduledFor} via instancia ${whatsappConnection.name}`);
    } catch (error) {
      console.error('Error al registrar mensaje en logs:', error);
      throw error;
    }
  }

  // Obtener mensajes programados pendientes
  static async getPendingScheduledMessages(): Promise<any[]> {
    const { data, error } = await supabase
      .from('automated_message_logs')
      .select(`
        *,
        column_message_triggers!inner(
          message_title,
          column_id
        ),
        leads!inner(
          name,
          phone
        )
      `)
      .eq('status', 'scheduled')
      .lte('sent_at', new Date().toISOString())
      .order('sent_at', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener mensajes programados: ${error.message}`);
    }

    return data || [];
  }

  // Marcar mensaje como enviado
  static async markMessageAsSent(logId: string): Promise<void> {
    const { error } = await supabase
      .from('automated_message_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', logId);

    if (error) {
      throw new Error(`Error al marcar mensaje como enviado: ${error.message}`);
    }
  }

  // Marcar mensaje como fallido
  static async markMessageAsFailed(logId: string, errorMessage: string): Promise<void> {
    const { error } = await supabase
      .from('automated_message_logs')
      .update({
        status: 'failed',
        error_message: errorMessage
      })
      .eq('id', logId);

    if (error) {
      throw new Error(`Error al marcar mensaje como fallido: ${error.message}`);
    }
  }
}