import { http } from "./http";

/**
 * Cargo terminals (airports / ports) lookup by country.
 *
 * Wraps api_cargo_terminals → Terminal_Controller (replaces the legacy
 * terminal_ajax_terminal.php that populated the spedyc_form terminal dropdown).
 * Public lookup (is_secured=false), shared master data, callable with the
 * operator session.
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
  success: boolean;
  data?: {
    iso: string;
    type: string;
    terminals: TerminalOption[];
    count: number;
  };
}

export const terminalsService = {
  /**
   * List terminals for a country. `type` 'A'=airport, 'P'=port, 'R'=road;
   * omitted → A+P (legacy vtp=AIR semantics). `q` optional substring filter.
   */
  async list(iso: string, type = "", q = ""): Promise<TerminalOption[]> {
    const code = (iso ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code)) return [];
    const res = await http<TerminalsEnvelope>("/api_cargo_terminals", {
      query: { iso: code, ...(type ? { type } : {}), ...(q ? { q } : {}) },
    });
    return res?.data?.terminals ?? [];
  },
};
