import { supabase } from '@/integrations/supabase/client';

interface CasinoConfig {
  agentUsername: string;
  parentId: string;
  skinId: string;
  webhookUrl?: string;
}

interface CasinoApiResponse<T = any> {
  result: T;
  targetUrl: string | null;
  success: boolean;
  error: string | null;
  unAuthorizedRequest: boolean;
  __abp: boolean;
}

interface PlayerBalance { id: string; balance: number; }
interface AgentInfo { userName: string; balance: number; id: string; rolename: string; currency: string; playersCount: number; email: string; name: string; surname: string; }
interface TransactionResult { transactionId: string; status: string; code: string | null; message: string; }

// Fetch casino config for a workspace.
// Only non-sensitive metadata is read here: provider credentials and the base
// URL are held exclusively by the private backend.
export async function getCasinoConfigForWorkspace(workspaceId: string): Promise<CasinoConfig | null> {
  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('casino_api_config_id')
      .eq('id', workspaceId)
      .single();

    if (!workspace?.casino_api_config_id) return null;

    const { data: config } = await supabase
      .from('casino_api_configs')
      .select('agent_username, parent_id, skin_id, webhook_url')
      .eq('id', workspace.casino_api_config_id)
      .single();

    if (!config) return null;

    return {
      agentUsername: (config as any).agent_username || '',
      parentId: (config as any).parent_id || '',
      skinId: (config as any).skin_id || '',
      webhookUrl: (config as any).webhook_url || undefined,
    };
  } catch (error) {
    console.error('Error fetching casino config for workspace:', error);
    return null;
  }
}

// Factory: create a casino API client bound to a workspace config.
// Every operation is executed server-side by the private "casino-proxy"
// edge function; no provider credentials are handled in the browser.
function createCasinoApiClient(config: CasinoConfig) {
  const casinoApiRequest = async <T = any>(
    action: string,
    args: Record<string, unknown> = {}
  ): Promise<CasinoApiResponse<T>> => {
    const { data, error } = await supabase.functions.invoke('casino-proxy', {
      body: { action, args, config },
    });

    if (error) {
      throw new Error(`Casino proxy request failed: ${error.message}`);
    }

    return data as CasinoApiResponse<T>;
  };

  return {
    getAgentBalance: (agentId: string, username: string) =>
      casinoApiRequest<number>('getAgentBalance', { agentId, username }),
    getAgentInfo: (agentId: string) =>
      casinoApiRequest<AgentInfo>('getAgentInfo', { agentId }),
    addPlayer: (userName: string, password: string) =>
      casinoApiRequest<{ id: string; userName: string; status: string }>('addPlayer', { userName, password }),
    doDeposit: (userName: string, amount: number, userType: number = 1) =>
      casinoApiRequest<TransactionResult>('doDeposit', { userName, amount, userType }),
    doWithdraw: (userName: string, amount: number, userType: number = 1) =>
      casinoApiRequest<TransactionResult>('doWithdraw', { userName, amount, userType }),
    changePassword: (username: string, newPassword: string) =>
      casinoApiRequest<string>('changePassword', { username, newPassword }),
    getPlayerHistory: (userId: string, playerName: string, startTime: string, endTime: string, pageSize = 20, offset = 0) =>
      casinoApiRequest('getPlayerHistory', { userId, playerName, startTime, endTime, pageSize, offset }),
    getMoneyTransfers: (startTime: string, endTime: string, userType = 'Agent', pageSize = 200) =>
      casinoApiRequest('getMoneyTransfers', { startTime, endTime, userType, pageSize }),
    getBalances: (playerIds: string[]) =>
      casinoApiRequest<PlayerBalance[]>('getBalances', { playerIds }),
    getAgentTreeView: (parentId: string) =>
      casinoApiRequest('getAgentTreeView', { parentId }),
    createAgentUser: (userName: string, password: string, rolename = 'Agente', email = '', name = '', surname = '', language = 'es') =>
      casinoApiRequest<{ id: string; userName: string; status: string }>('createAgentUser', { userName, password, rolename, email, name, surname, language }),
    constants: { AGENT_USERNAME: config.agentUsername, PARENT_ID: config.parentId, SKIN_ID: config.skinId },
  };
}

const defaultConfig: CasinoConfig = {
  agentUsername: '',
  parentId: '',
  skinId: '',
};

export const casinoApiService = createCasinoApiClient(defaultConfig);
export { createCasinoApiClient, type CasinoConfig };
