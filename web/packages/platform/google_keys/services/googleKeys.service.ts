import { http } from '../../anagrafiche/services/http';

/**
 * Google API keys admin service.
 *
 * Wraps /api_admin_google_keys (Web_Google_Keys_Admin_Controller). Values are
 * stored ENCRYPTED server-side; the API never returns the plaintext — only a
 * masked preview and a has_value flag. Editing follows the "leave blank = keep"
 * pattern (a PUT only overwrites when a non-empty value is sent).
 */

export interface GoogleKeyRow {
  key_name: string;
  has_value: boolean;
  masked: string;
  description: string | null;
  stato: string;
  modif_datetime: string | null;
}

export interface GoogleKeysListResponse {
  items: GoogleKeyRow[];
  environment: string;
  allowed_keys: string[];
}

interface RawListResponse {
  success?: boolean;
  data?: GoogleKeyRow[];
  environment?: string;
  allowed_keys?: string[];
  error?: string;
}

const ENDPOINT = '/api_admin_google_keys';

export const googleKeysService = {
  async list(environment = 'production'): Promise<GoogleKeysListResponse> {
    const raw = await http<RawListResponse>(ENDPOINT, { query: { environment } });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load Google keys');
    return {
      items: Array.isArray(raw?.data) ? raw!.data : [],
      environment: raw?.environment || environment,
      allowed_keys: Array.isArray(raw?.allowed_keys) ? raw!.allowed_keys : [],
    };
  },

  async save(
    key_name: string,
    value: string,
    environment = 'production',
    description?: string,
  ): Promise<GoogleKeyRow[]> {
    const raw = await http<RawListResponse>(ENDPOINT, {
      method: 'PUT',
      body: { key_name, value, environment, description },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Save failed');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async clear(key_name: string, environment = 'production'): Promise<GoogleKeyRow[]> {
    const raw = await http<RawListResponse>(ENDPOINT, {
      method: 'DELETE',
      body: { key_name, environment },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Clear failed');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },
};
