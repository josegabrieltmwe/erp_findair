import { http } from '../../anagrafiche/services/http';

/**
 * Cuentas bancarias del EMISOR/partner (tabla `banche`, scoped al partner
 * autenticado). Estas cuentas son las que luego se seleccionan como
 * "banca indicata in fattura" en la ficha de cada cliente.
 * Backend: Issuer_Bank_Accounts_Controller (paridad banchenew.php).
 */
export interface IssuerBankAccount {
  id: number;
  id_anagrafica: number;
  nome?: string;
  agenzia?: string;
  iban?: string;
  abi?: string;
  cab?: string;
  cin?: string;
  cc?: string;
  swift?: string;
  paese_digit?: string;
  riferimento?: string;
  tel?: string;
  fax?: string;
  note?: string;
  orderby?: number;
  stato?: string;
  [k: string]: unknown;
}

export interface IssuerBankAccountPayload {
  nome?: string;
  agenzia?: string;
  iban?: string;
  abi?: string;
  cab?: string;
  cin?: string;
  cc?: string;
  swift?: string;
  paese_digit?: string;
  riferimento?: string;
  tel?: string;
  fax?: string;
  note?: string;
  orderby?: number;
}

interface RawList {
  success?: boolean;
  data?: IssuerBankAccount[];
  total?: number;
  error?: string;
}

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: { id: number };
}

const ENDPOINT = '/api_issuer_bank_accounts';

export const issuerBankAccountsService = {
  async list(): Promise<IssuerBankAccount[]> {
    const raw = await http<RawList>(ENDPOINT);
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? [];
  },

  async create(payload: IssuerBankAccountPayload): Promise<number> {
    const raw = await http<RawWrite>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data?.id ?? 0;
  },

  async update(id: number, payload: IssuerBankAccountPayload): Promise<void> {
    const raw = await http<RawWrite>(ENDPOINT, { method: 'PUT', query: { id }, body: payload });
    if (raw?.error) throw new Error(raw.error);
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(ENDPOINT, { method: 'DELETE', query: { id } });
    if (raw?.error) throw new Error(raw.error);
  },
};
