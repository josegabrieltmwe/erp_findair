import { http } from '../../anagrafiche/services/http';

/**
 * Profit preset catalogue admin (profit_preset). Réplica moderna de la
 * página legacy `profit_preset.php` — SOLO la administración del catálogo
 * de plantillas de escalones. Aplicar un preset a un cliente concreto es un
 * flujo SEPARADO que ya existe en la ficha de cliente
 * (AnagraficaAssicurazioneSection.vue vía scaglioni.service.ts) y no se
 * toca desde aquí.
 *
 * Scope: siempre el partner de sesión — el backend lo resuelve por
 * identidad, no acepta un id_anagrafica del cliente (paridad legacy:
 * $idanagfrc). No hay selector de partner en esta UI.
 *
 * Backend: /api_profit_presets (Profit_Preset_Controller) — CRUD REST.
 *   GET ?tipo=E|A|S (opcional)   lista + usage_count
 *   GET ?id=N / POST / PUT / DELETE (rechazado si base='S')
 */

export type PresetTipo = 'E' | 'A' | 'S';
export type Flag = 'S' | 'N';

export type MarginMode = 'P' | 'F';

export interface ProfitPreset {
  id: number;
  id_anagrafica: number;
  base: Flag;
  tipo: PresetTipo;
  nome: string;
  ass_perc: number;
  ass_min: number;
  note: string;
  usage_count: number;
  /** Aditivo (migración 20260817): moneda del importe fijo, ausente = 'EUR'. */
  margin_currency?: string;
  kg01: number; pr01: number; mt01?: MarginMode; fx01?: number;
  kg02: number; pr02: number; mt02?: MarginMode; fx02?: number;
  kg03: number; pr03: number; mt03?: MarginMode; fx03?: number;
  kg04: number; pr04: number; mt04?: MarginMode; fx04?: number;
  kg05: number; pr05: number; mt05?: MarginMode; fx05?: number;
  kg06: number; pr06: number; mt06?: MarginMode; fx06?: number;
  kg07: number; pr07: number; mt07?: MarginMode; fx07?: number;
  kg08: number; pr08: number; mt08?: MarginMode; fx08?: number;
  kg09: number; pr09: number; mt09?: MarginMode; fx09?: number;
  kg10: number; pr10: number; mt10?: MarginMode; fx10?: number;
}

export interface ProfitPresetPayload {
  tipo: PresetTipo;
  nome: string;
  ass_perc: number;
  ass_min: number;
  margin_currency?: string;
  kg01: number; pr01: number; mt01?: MarginMode; fx01?: number;
  kg02: number; pr02: number; mt02?: MarginMode; fx02?: number;
  kg03: number; pr03: number; mt03?: MarginMode; fx03?: number;
  kg04: number; pr04: number; mt04?: MarginMode; fx04?: number;
  kg05: number; pr05: number; mt05?: MarginMode; fx05?: number;
  kg06: number; pr06: number; mt06?: MarginMode; fx06?: number;
  kg07: number; pr07: number; mt07?: MarginMode; fx07?: number;
  kg08: number; pr08: number; mt08?: MarginMode; fx08?: number;
  kg09: number; pr09: number; mt09?: MarginMode; fx09?: number;
  kg10: number; pr10: number; mt10?: MarginMode; fx10?: number;
  note: string;
}

const BASE = '/api_profit_presets';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[] } | null;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
}

export const profitPresetsService = {
  async list(tipo?: PresetTipo): Promise<ProfitPreset[]> {
    const raw = await http<unknown>(BASE, { query: tipo ? { tipo } : {} });
    return listOf<ProfitPreset>(raw);
  },

  async create(payload: ProfitPresetPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ProfitPresetPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
