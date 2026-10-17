import { http } from './http';

export type ScaglioniTipo = 'A' | 'S' | 'E';
export type ScaglioniUnit = 'metric' | 'imperial';
export type MarginType = 'PERCENT' | 'FIXED';

export interface ScaglioneTier {
  tier: number;
  kg: number;
  profit_pct: number;
  /** Aditivo (migración 20260817): ausente en fixtures/backends viejos = PERCENT. */
  margin_type?: MarginType;
  /** Solo relevante cuando margin_type es FIXED. */
  fixed_amount?: number;
}

export interface BracketData {
  id: number;
  id_anagrafica: number;
  tipo: ScaglioniTipo;
  id_preset_base: string | number;
  tiers: ScaglioneTier[];
  insurance_pct: number;
  insurance_min: number;
  /** Aditivo: moneda del importe fijo (default 'EUR'). Ausente = 'EUR'. */
  margin_currency?: string;
  unit: ScaglioniUnit;
}

export interface ScaglioniPreset {
  id: number;
  nome: string;
  tipo: ScaglioniTipo | null;
  is_base: boolean;
}

const ENDPOINT = '/api_anagrafica_scaglioni';

export const scaglioniService = {
  /**
   * Presets de profit disponibles para el partner titular del cliente.
   * El verbo viaja como `op` (no `action`, reservado por el router).
   */
  async listPresets(idAnagrafica: number, tipo: ScaglioniTipo): Promise<ScaglioniPreset[]> {
    const raw = await http<{ data?: { presets?: ScaglioniPreset[] } }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica, tipo, op: 'presets' },
    });
    return raw?.data?.presets ?? [];
  },

  async list(idAnagrafica: number, unit: ScaglioniUnit = 'metric'): Promise<BracketData[]> {
    const raw = await http<{ data?: { brackets?: BracketData[] } }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica, unit },
    });
    return raw?.data?.brackets ?? [];
  },

  /**
   * `value` acepta number (kgNN/prNN/fxNN/ass_*) o string (mtNN: 'P'|'F',
   * margin_currency: 'EUR'...) — el backend normaliza cada campo según su
   * tipo real en Scaglioni_Service::update_field().
   */
  async updateField(
    idAnagrafica: number,
    tipo: ScaglioniTipo,
    field: string,
    value: number | string,
    unit: ScaglioniUnit = 'metric',
  ): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'PATCH',
      body: { id_anagrafica: idAnagrafica, tipo, field, value, unit },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async applyPreset(idAnagrafica: number, tipo: ScaglioniTipo, presetId: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, tipo, preset_id: presetId },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /**
   * Crea la fila de escalones (anagrafiche_scaglioni) para un tipo que aún no
   * existe, dejándola a cero para editar. Paridad con el create_if_missing
   * legacy: el form asumía que las 3 filas (A/S/E) ya existían; aquí el
   * operador puede materializar la que falte. Idempotente (409 = ya existía).
   */
  async createBrackets(idAnagrafica: number, tipo: ScaglioniTipo): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, tipo },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async convertUnit(idAnagrafica: number, toUnit: ScaglioniUnit): Promise<{ converted_records: number }> {
    const raw = await http<{ data?: { converted_records?: number }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, action: 'convert_unit', to_unit: toUnit },
    });
    if (raw?.error) throw new Error(raw.error);
    return { converted_records: raw?.data?.converted_records ?? 0 };
  },
};
