import { supabase } from '@/integrations/supabase/client';
import { WahaGroup, WahaGroupRequest, WahaParticipant, WhatsAppStatusPayload, WahaStatusResult, WahaStatusQueueResult } from '@/types/waha';
import { extractGroupId, extractGroupSubject, normalizeWahaGroup } from '@/lib/wahaGroup';

const normalizeGroup = normalizeWahaGroup;

interface GroupListResult {
  connection: { id: string; name: string };
  groups: Array<Omit<WahaGroup, 'connectionId' | 'session'>> | Record<string, unknown>;
  success: boolean;
  error?: string;
}

const invoke = async <T>(functionName: string, body: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw error;
  if (data?.success === false) throw new Error(data.error || 'No se pudo completar la operación');
  return data as T;
};

interface PairingCodeResult {
  success: boolean;
  code?: string;
  session_name?: string;
  phone_number?: string | null;
  error?: string;
}

interface PasskeyChallengeResult {
  success: boolean;
  action: string;
  session_name: string;
  result?: {
    challenge: unknown;
    timeout: number;
    rpId: string;
    allowCredentials: Array<{
      id: string;
      type: string;
      transports: string[];
    }>;
    userVerification: string;
    extensions: Record<string, unknown>;
  };
  error?: string;
}

interface PasskeyAssertionResult {
  success: boolean;
  action: string;
  session_name: string;
  result?: unknown;
  error?: string;
}

interface PasskeyConfirmationResult {
  success: boolean;
  action: string;
  session_name: string;
  result?: {
    code: string;
  };
  error?: string;
}

export const wahaAdminService = {
  async requestPairingCode(sessionName: string, phoneNumber?: string): Promise<PairingCodeResult> {
    return await invoke<PairingCodeResult>('waha-request-pairing-code', {
      session_name: sessionName,
      phone_number: phoneNumber,
    });
  },

  async getPasskeyChallenge(sessionName: string): Promise<PasskeyChallengeResult> {
    return await invoke<PasskeyChallengeResult>('waha-passkey-auth', {
      session_name: sessionName,
      action: 'getChallenge',
    });
  },

  async submitPasskeyAssertion(sessionName: string, assertion: unknown): Promise<PasskeyAssertionResult> {
    return await invoke<PasskeyAssertionResult>('waha-passkey-auth', {
      session_name: sessionName,
      action: 'submitAssertion',
      data: assertion,
    });
  },

  async getPasskeyConfirmation(sessionName: string): Promise<PasskeyConfirmationResult> {
    return await invoke<PasskeyConfirmationResult>('waha-passkey-auth', {
      session_name: sessionName,
      action: 'getConfirmation',
    });
  },

  async confirmPasskey(sessionName: string): Promise<{ success: boolean; error?: string }> {
    return await invoke<{ success: boolean; error?: string }>('waha-passkey-auth', {
      session_name: sessionName,
      action: 'confirm',
    });
  },

  async listGroups(connectionId?: string): Promise<{ groups: WahaGroup[]; errors: string[] }> {
    const data = await invoke<{ results: GroupListResult[]; debug?: { totalSessionsInDb: number; includedInQuery: number; sessions: Array<{ id: string; name: string; status: string | null; connection_subtype: string | null; included: boolean }> } }>('waha-groups', { action: 'list', connectionId });
    if (typeof window !== 'undefined') {
      console.log('[waha-groups] raw results:', JSON.stringify(data.results, null, 2));
      if (data.debug) {
        console.log('[waha-groups] SESSION DEBUG:', JSON.stringify(data.debug, null, 2));
        const excluded = data.debug.sessions.filter((s) => !s.included);
        if (excluded.length) {
          console.warn('[waha-groups] SESIONES EXCLUIDAS POR STATUS:', excluded.map((s) => `${s.name} (status="${s.status}")`).join(', '));
        }
      }
    }
    const errors: string[] = [];
    const groups = data.results.flatMap((entry) => {
      if (!entry.success) {
        errors.push(`${entry.connection.name}: ${entry.error || 'No se pudieron cargar los grupos'}`);
        return [];
      }
      const raw = entry.groups;
      let values: unknown[] = [];
      if (Array.isArray(raw)) {
        values = raw;
      } else if (Array.isArray((raw as { data?: unknown[] })?.data)) {
        values = (raw as { data: unknown[] }).data;
      } else if (Array.isArray((raw as { groups?: unknown[] })?.groups)) {
        values = (raw as { groups: unknown[] }).groups;
      } else if (Array.isArray((raw as { result?: unknown[] })?.result)) {
        values = (raw as { result: unknown[] }).result;
      } else if (Array.isArray((raw as { items?: unknown[] })?.items)) {
        values = (raw as { items: unknown[] }).items;
      } else if (Array.isArray((raw as { payload?: unknown[] })?.payload)) {
        values = (raw as { payload: unknown[] }).payload;
      }
      const normalized = values.map((group) => normalizeGroup({ ...(group as object), connectionId: entry.connection.id, session: entry.connection.name })) as WahaGroup[];
      if (typeof window !== 'undefined' && normalized.length > 0) {
        const sample = normalized[0];
        const rawSample = values[0] as Record<string, unknown>;
        console.log('[waha-groups] first RAW group:', JSON.stringify(rawSample, null, 2));
        console.log('[waha-groups] first NORMALIZED group:', JSON.stringify(sample, null, 2));
        console.log('[waha-groups] raw keys:', Object.keys(rawSample ?? {}));
        console.log('[waha-groups] resolved subject/id:', { id: sample.id, subject: sample.subject, participantsCount: sample.participants?.length ?? 0 });
      }
      return normalized;
    });
    return { groups, errors };
  },

  async refreshGroups(connectionId: string): Promise<{ success: boolean; error?: string }> {
    return invoke<{ success: boolean; error?: string }>('waha-groups', { action: 'refresh', connectionId });
  },

  async getGroupCount(connectionId: string): Promise<number> {
    const data = await invoke<{ count: number }>('waha-groups', { action: 'count', connectionId });
    return data.count;
  },

  async getInviteCode(connectionId: string, groupId: string): Promise<string> {
    const data = await invoke<{ result: { inviteCode?: string; code?: string } | string }>('waha-groups', { action: 'inviteCode', connectionId, groupId });
    const result = data.result;
    if (typeof result === 'string') return result;
    return result?.inviteCode || result?.code || '';
  },

  async revokeInviteCode(connectionId: string, groupId: string): Promise<{ inviteCode: string }> {
    const data = await invoke<{ result: { inviteCode?: string; code?: string } | string }>('waha-groups', { action: 'inviteCode.revoke', connectionId, groupId });
    const result = data.result;
    if (typeof result === 'string') return { inviteCode: result };
    return { inviteCode: result?.inviteCode || result?.code || '' };
  },

  async joinGroup(connectionId: string, code: string): Promise<{ groupId: string }> {
    const data = await invoke<{ result: { id?: string; groupId?: string } | string }>('waha-groups', { action: 'join', connectionId, code });
    const result = data.result;
    if (typeof result === 'string') return { groupId: result };
    return { groupId: result?.id || result?.groupId || '' };
  },

  async getParticipants(connectionId: string, groupId: string): Promise<WahaParticipant[]> {
    const data = await invoke<{ result: WahaParticipant[] }>('waha-groups', { action: 'participants.get', connectionId, groupId });
    if (typeof window !== 'undefined') console.log('[waha-groups] getParticipants raw:', JSON.stringify(data.result, null, 2));
    return data.result;
  },

  async mutateGroup(request: WahaGroupRequest): Promise<WahaGroup | null> {
    const data = await invoke<{ result: unknown }>('waha-groups', request);
    const result = data.result;
    if (typeof window !== 'undefined') console.log('[waha-groups] mutate raw result:', JSON.stringify(result, null, 2));
    if (!result || typeof result !== 'object') return null;
    if (request.action === 'create') {
      const normalized = normalizeGroup({ ...(result as Record<string, unknown>), connectionId: request.connectionId ?? '', session: '' }) as unknown as WahaGroup;
      if (typeof window !== 'undefined') console.log('[waha-groups] mutate normalized:', JSON.stringify(normalized, null, 2));
      return normalized;
    }
    return null;
  },

  async publishStatus(payload: WhatsAppStatusPayload): Promise<WahaStatusQueueResult> {
    const data = await invoke<WahaStatusQueueResult>('waha-status', payload);
    return data;
  },

  async addParticipantsBatch(
    connectionId: string,
    groupId: string,
    toAdd: string[],
    toAddAsAdmin: string[],
  ): Promise<{ ok: string[]; failed: Array<{ jid: string; error: string }> }> {
    const ok: string[] = [];
    const failed: Array<{ jid: string; error: string }> = [];

    const tasks: Array<Promise<void>> = [];

    if (toAdd.length) {
      tasks.push((async () => {
        try {
          await this.mutateGroup({ action: 'participants.add', connectionId, groupId, participants: toAdd });
          ok.push(...toAdd);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error desconocido';
          for (const jid of toAdd) failed.push({ jid, error: msg });
        }
      })());
    }

    if (toAddAsAdmin.length) {
      tasks.push((async () => {
        try {
          await this.mutateGroup({ action: 'participants.addAdmin', connectionId, groupId, participants: toAddAsAdmin });
          ok.push(...toAddAsAdmin);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error desconocido';
          for (const jid of toAddAsAdmin) failed.push({ jid, error: msg });
        }
      })());
    }

    await Promise.all(tasks);
    return { ok, failed };
  },
};
