import { http } from './http';

/**
 * Docsstory service — outbound message history ("Storico messaggi inviati").
 * Talks to the modern `api_docsstory_*` surface (hybrid auth via the shared
 * http client). See docs/docsstory_dispatch_contract.md for the send pipeline.
 */

/** Delivery channel. */
export type DocsstoryMetodo = 'M' | 'S' | 'F' | 'C' | 'P';

/** Dispatch outcome (docsstory.esito enum — WRK/OK/KO). */
export type DocsstoryEsito = 'WRK' | 'OK' | 'KO';

export interface DocsstoryRecord {
  id: number;
  id_anagr: number;
  tipo: string;
  metodo: DocsstoryMetodo;
  dest_msg: string;
  descriz: string;
  esito: DocsstoryEsito;
  insert_datetime: string;
  file1_nome?: string | null;
}

export interface DocsstoryListFilters {
  id_anagr?: number;
  tipo?: string;
  metodo?: DocsstoryMetodo;
  esito?: DocsstoryEsito;
  page?: number;
  limit?: number;
}

export interface DocsstoryListResponse {
  success: boolean;
  data: DocsstoryRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface DocsstoryItemResponse {
  success: boolean;
  data: DocsstoryRecord;
}

export const CHANNEL_LABEL: Record<DocsstoryMetodo, string> = {
  M: 'Email',
  S: 'SMS',
  F: 'Fax',
  C: 'Carta',
  P: 'Push',
};

export const ESITO_LABEL: Record<DocsstoryEsito, string> = {
  WRK: 'In corso',
  OK: 'Inviato',
  KO: 'Errore',
};

export const docsstoryService = {
  /** Paginated list of outbound messages, newest first. */
  list(filters: DocsstoryListFilters = {}): Promise<DocsstoryListResponse> {
    const query: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') query[k] = v as string | number;
    }
    return http('/api_docsstory_crud', { query });
  },

  /** Single record by id. */
  get(id: number): Promise<DocsstoryItemResponse> {
    return http('/api_docsstory_crud', { query: { id } });
  },

  /**
   * Resend an existing message: clones the record and re-dispatches it
   * through its channel. Returns the newly created record.
   */
  resend(id: number): Promise<DocsstoryItemResponse> {
    return http('/api_docsstory_resend', {
      method: 'POST',
      body: { id },
    });
  },
};
