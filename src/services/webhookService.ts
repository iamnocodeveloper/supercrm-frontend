import { proxiedFetch } from '@/services/internalProxy';

export const webhookService = {
  /**
   * Envía datos al backend interno de forma asíncrona y no bloqueante.
   * Si falla, solo registra el error sin interrumpir el flujo principal.
   */
  async sendToWebhook(data: any): Promise<void> {
    try {
      const response = await proxiedFetch('guardar_contacto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error('Webhook response not OK:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error calling webhook:', error);
      // No lanzamos el error para que no bloquee la operación principal
    }
  },

  /**
   * Envía datos de contacto creado manualmente (formulario simple)
   */
  async sendContactCreated(contactData: {
    id: string;
    name: string;
    phone_number: string;
    email?: string | null;
    user_id: string;
    contact_list_id?: string | null;
    created_at?: string;
  }): Promise<void> {
    const payload = {
      type: 'contact',
      source: 'manual_simple',
      timestamp: new Date().toISOString(),
      data: contactData,
    };

    await this.sendToWebhook(payload);
  },

  /**
   * Envía datos de contacto creado con formulario completo
   */
  async sendFullContactCreated(contactData: {
    id: string;
    first_name: string;
    last_name?: string | null;
    name: string;
    phone_number: string;
    email?: string | null;
    address?: string | null;
    website?: string | null;
    notes?: string | null;
    gender?: string | null;
    birth_date?: string | null;
    origin?: string | null;
    is_blocked?: boolean | null;
    user_id: string;
    created_at?: string;
    updated_at?: string;
  }): Promise<void> {
    const payload = {
      type: 'contact',
      source: 'manual_complete',
      timestamp: new Date().toISOString(),
      data: contactData,
    };

    await this.sendToWebhook(payload);
  },
};
