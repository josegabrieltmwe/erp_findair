import { http } from '../../anagrafiche/services/http';

/**
 * Estado y sincronización del agente ConvAI `public_form` real en ElevenLabs.
 * Backend: /api_elevenlabs_sync (Elevenlabs_Agent_Controller), admin-only
 * (TMWE, anagrafica_id = 1). GET lee la config actual del agente; POST la
 * sobrescribe con el prompt y las tools versionadas en el ERP.
 */

export interface ElevenlabsAgentTool {
  name: string;
  type: string;
}

export interface ElevenlabsAgentStatus {
  agent_id: string | null;
  name: string | null;
  tools_count: number;
  tools: ElevenlabsAgentTool[];
}

export interface ElevenlabsAgentSyncResult {
  message: string;
  tools_synced: number;
}

interface RawStatusResponse {
  success?: boolean;
  error?: string;
  details?: unknown;
  agent_id?: string | null;
  name?: string | null;
  tools_count?: number;
  tools?: ElevenlabsAgentTool[];
}

interface RawSyncResponse {
  success?: boolean;
  error?: string;
  details?: unknown;
  message?: string;
  tools_synced?: number;
}

const ENDPOINT = '/api_elevenlabs_sync';

export const elevenlabsAgentSyncService = {
  async getStatus(): Promise<ElevenlabsAgentStatus> {
    const raw = await http<RawStatusResponse>(ENDPOINT);
    if (!raw?.success) throw new Error(raw?.error || 'Failed to get agent config');
    return {
      agent_id: raw.agent_id ?? null,
      name: raw.name ?? null,
      tools_count: raw.tools_count ?? 0,
      tools: Array.isArray(raw.tools) ? raw.tools : [],
    };
  },

  async sync(): Promise<ElevenlabsAgentSyncResult> {
    const raw = await http<RawSyncResponse>(ENDPOINT, { method: 'POST' });
    if (!raw?.success) throw new Error(raw?.error || 'Failed to sync agent');
    return {
      message: raw.message || '',
      tools_synced: raw.tools_synced ?? 0,
    };
  },
};
