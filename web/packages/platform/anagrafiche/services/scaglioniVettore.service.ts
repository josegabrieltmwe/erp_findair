import { http } from './http';
import type { ScaglioniTipo } from './scaglioni.service';

/**
 * Márgenes de cargo POR VETTORE (aerolínea o proveedor de quote).
 *
 * Nivel 1 de la cascada de márgenes: un pacto específico con un proveedor
 * (KL, AF, BA, WEBCARGO…) que sustituye a los escalones generales del cliente
 * SOLO para ese proveedor. Un vettore sin configuración cae a los escalones
 * generales, así que dar de alta uno nuevo nunca altera el precio de los demás.
 */

/**
 * Un tramo: desde `kg` kilos se aplica `pr`% de recargo sobre el coste, O
 * (aditivo, migración 20260817) un importe fijo `fx` cuando `mt === 'F'`.
 * `mt`/`fx` ausentes = tramo porcentual, igual que antes de que existieran
 * — ver Scaglioni_Vettore_Service::save()/validate_brackets() en el backend.
 */
export interface VettoreBracket {
  n: number;
  kg: number;
  pr: number;
  mt?: 'P' | 'F';
  fx?: number;
}

/** Proveedor seleccionable en el modal. */
export interface AvailableVettore {
  code: string;
  label: string;
  kind: 'airline' | 'aggregator';
  /** Ya tiene configuración para este cliente: la UI lo deshabilita. */
  configured: boolean;
}

/** Fila persistida (20 columnas kg/pr planas, como anagrafiche_scaglioni). */
export interface VettoreConfiguration {
  id: number;
  id_anagrafica: number;
  tipo: ScaglioniTipo;
  vettore: string;
  vettore_label: string;
  ass_perc: number;
  ass_min: number;
  [key: string]: unknown;
}

export interface VettoreListResponse {
  configurations: VettoreConfiguration[];
  available_vettori: AvailableVettore[];
}

export interface SeedResponse {
  brackets: VettoreBracket[];
  /** 'client' = precargado de los escalones generales; 'empty' = sin base. */
  source: 'client' | 'empty';
  ass_perc: number;
  ass_min: number;
}

const ENDPOINT = '/api_anagrafica_scaglioni_vettore';

export const scaglioniVettoreService = {
  /** Configuraciones existentes + catálogo de proveedores. */
  async list(idAnagrafica: number, tipo: ScaglioniTipo = 'A'): Promise<VettoreListResponse> {
    const raw = await http<{ data?: VettoreListResponse }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica, tipo },
    });
    return {
      configurations: raw?.data?.configurations ?? [],
      available_vettori: raw?.data?.available_vettori ?? [],
    };
  },

  /**
   * Tramos con los que arranca el modal: una COPIA editable de los escalones
   * generales del cliente. No es un vínculo — lo que se guarde queda como
   * configuración propia del vettore y no vuelve a heredar.
   *
   * El verbo viaja como `op` (`action` está reservado por el router).
   */
  async seed(idAnagrafica: number, tipo: ScaglioniTipo = 'A'): Promise<SeedResponse> {
    const raw = await http<{ data?: SeedResponse }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica, tipo, op: 'seed' },
    });
    return {
      brackets: raw?.data?.brackets ?? [],
      source: raw?.data?.source ?? 'empty',
      ass_perc: raw?.data?.ass_perc ?? 0,
      ass_min: raw?.data?.ass_min ?? 0,
    };
  },

  /** Alta o actualización (upsert) de la configuración de un vettore. */
  async save(
    idAnagrafica: number,
    vettore: string,
    brackets: VettoreBracket[],
    extra: { ass_perc?: number; ass_min?: number; margin_currency?: string } = {},
    tipo: ScaglioniTipo = 'A',
  ): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: {
        id_anagrafica: idAnagrafica,
        vettore,
        tipo,
        brackets,
        ass_perc: extra.ass_perc ?? 0,
        ass_min: extra.ass_min ?? 0,
        margin_currency: extra.margin_currency ?? 'EUR',
      },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /** Quita el pacto: ese proveedor vuelve a los escalones generales. */
  async remove(idAnagrafica: number, vettore: string, tipo: ScaglioniTipo = 'A'): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      body: { id_anagrafica: idAnagrafica, vettore, tipo },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
