import { http } from './http';

/**
 * Cargo terminals (aeropuertos / puertos) por país. Envuelve
 * api_cargo_terminals → Terminal_Controller (lookup público, master data
 * compartida). Alimenta los selectores de aeropuerto cargo y puerto marítimo
 * de la ficha de sede. Portado desde apps/cargo_express/services/terminals.service.
 *
 * type: 'A'=airport, 'P'=port, 'R'=road; omitido → A+P.
 */
export interface TerminalOption {
  sigla: string;
  nome: string;
  citta: string;
  iso_paese: string;
  tipo: string;
  principal: boolean;
  label: string;
}

interface TerminalsEnvelope {
  success?: boolean;
  data?: { iso: string; type: string; terminals: TerminalOption[]; count: number };
}

export const terminalsService = {
  async list(iso: string, type = '', q = ''): Promise<TerminalOption[]> {
    const code = (iso ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code)) return [];
    const res = await http<TerminalsEnvelope>('/api_cargo_terminals', {
      query: { iso: code, ...(type ? { type } : {}), ...(q ? { q } : {}) },
    });
    return res?.data?.terminals ?? [];
  },
};
