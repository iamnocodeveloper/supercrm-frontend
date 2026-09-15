// =====================================================================
// zernioService — Capa fina sobre las Edge Functions de Zernio
// =====================================================================

import { supabase } from '@/integrations/supabase/client';

export interface ZernioAccountSafe {
  id: string;
  label: string;
  base_url: string;
  is_active: boolean;
  priority: number;
  status: string;
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InvokeResult<T> {
  success?: boolean;
  [key: string]: unknown;
}

const invoke = async <T = InvokeResult<unknown>>(
  fn: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message || `Error invocando ${fn}`);
  if (data?.error) throw new Error(data.error + (data.detail ? ` — ${data.detail}` : ''));
  return data as T;
};

export const zernioService = {
  // ---- Cuentas (multi-cuenta) ----
  listAccounts: () =>
    invoke<{ accounts: ZernioAccountSafe[] }>('zernio-accounts', { action: 'list' }),

  createAccount: (payload: { label: string; api_key: string; webhook_secret?: string; priority?: number }) =>
    invoke<{ account: ZernioAccountSafe }>('zernio-accounts', { action: 'create', ...payload }),

  updateAccount: (payload: { id: string; label?: string; is_active?: boolean; priority?: number; api_key?: string; webhook_secret?: string }) =>
    invoke<{ account: ZernioAccountSafe }>('zernio-accounts', { action: 'update', ...payload }),

  deleteAccount: (id: string) =>
    invoke('zernio-accounts', { action: 'delete', id }),

  testAccount: (id: string) =>
    invoke<{ success: boolean; account: ZernioAccountSafe }>('zernio-accounts', { action: 'test', id }),

  ensureWebhook: (id: string, url?: string) =>
    invoke<{ url: string; webhookId: string | null; events: string[] }>('zernio-accounts', {
      action: 'ensure_webhook',
      id,
      ...(url ? { url } : {}),
    }),

  // ---- Conexión de números ----
  startConnect: (payload: {
    zernio_account_id: string;
    connectionId?: string;
    name?: string;
    phone_number?: string;
    workspace_id?: string | null;
    default_column_id?: string | null;
    redirectUrl: string;
    onboarding?: 'api' | 'business_app';
    hosted?: boolean;
    brandName?: string;
    language?: 'es' | 'en';
  }) => invoke<{ connectionId: string; profileId: string; authUrl: string }>('zernio-connect', { action: 'start', ...payload }),

  completeConnect: (payload: {
    connectionId: string;
    code?: string;
    externalAccountId?: string;
    phoneNumber?: string;
    wabaId?: string;
    phoneNumberId?: string;
    expectedPhoneNumber?: string;
  }) => invoke('zernio-connect', { action: 'complete', ...payload }),

  credentialsConnect: (payload: {
    zernio_account_id: string;
    connectionId?: string;
    name?: string;
    phone_number?: string;
    workspace_id?: string | null;
    default_column_id?: string | null;
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
    pin?: string;
  }) => invoke('zernio-connect', { action: 'credentials', ...payload }),

  listNumbers: (connectionId: string, tempToken: string) =>
    invoke<{ phoneNumbers: unknown[] }>('zernio-connect', { action: 'listNumbers', connectionId, tempToken }),

  selectNumber: (payload: { connectionId: string; phoneNumberId: string; wabaId: string; tempToken: string }) =>
    invoke('zernio-connect', { action: 'selectNumber', ...payload }),

  register: (connectionId: string, pin?: string) =>
    invoke('zernio-connect', { action: 'register', connectionId, ...(pin ? { pin } : {}) }),

  status: (connectionId: string) =>
    invoke<{ success: boolean; info: Record<string, unknown> | null }>('zernio-connect', {
      action: 'status',
      connectionId,
    }),

  disconnect: (connectionId: string) =>
    invoke('zernio-connect', { action: 'disconnect', connectionId }),

  health: () => invoke<{ checked: number; results: unknown[] }>('zernio-health', {}),
};

/** Extrae los parámetros relevantes del redirect de Zernio (?connected=...&accountId=...). */
export const readZernioRedirect = (): {
  connected: string | null;
  accountId: string | null;
  profileId: string | null;
  username: string | null;
  error: string | null;
  step: string | null;
  tempToken: string | null;
} => {
  const q = new URLSearchParams(window.location.search);
  return {
    connected: q.get('connected'),
    accountId: q.get('accountId'),
    profileId: q.get('profileId'),
    username: q.get('username'),
    error: q.get('error'),
    step: q.get('step'),
    tempToken: q.get('tempToken'),
  };
};
