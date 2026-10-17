import { http } from './http';

export type ListinoType = 'base' | 'partner' | 'promo' | 'market';

export interface ServiceConfigRow {
  id_servizio: number;
  servizio_descr?: string;
  servizio_nome?: string;
  // Campos del servizio (servizi_fornitori) para filtrado (L2).
  servizio_paese?: string;
  servizio_import?: 'S' | 'N';
  servizio_tipo?: 'EXP' | 'AIR' | 'SEA';
  servizio_prioritario?: 'N' | 'S' | 'E' | 'C';
  servizio_livello?: number;
  /** Fuel surcharge base del servizio (read-only, distinto del fuel_surc del cliente). */
  servizio_fuel?: number;
  id_listino_nome?: number;
  listino_nome?: string;
  /**
   * false = el servizio aún NO tiene fila en anagrafiche_listvol: se muestra
   * con los defaults heredados del servizio y la fila se crea en el primer
   * PATCH (el backend hace INSERT si no existe). El grid parte del catálogo
   * de servizi, no de las asignaciones, igual que el modal legacy.
   */
  has_row?: boolean;
  /** Nombre del listino base efectivo, para las filas con id_listino_nome=0. */
  base_listino_nome?: string | null;
  /**
   * Salud del listino asignado. 'archived'/'missing' significan que lo guardado
   * NO se aplica: el motor cae al listino base (ListyCli). Sin este aviso la
   * fila muestra un listino que en realidad no rige.
   */
  listino_health?: '' | 'ok' | 'archived' | 'missing';
  listino_stato?: string | null;
  tipo?: 'L' | 'P';
  coefficiente?: number;
  fuel_surc?: number;
  prf_mod?: number;
  prf_fix?: number | null;
  forza_API?: 'S' | 'N';
  blocked?: boolean;
  /** 'house_fee' = fila fija de la consolidata (servicio sintético): solo importe, vacío = valor del titular. */
  special?: 'house_fee';
  owner_prf_fix?: number | null;
  [k: string]: unknown;
}

const ENDPOINT = '/api_anagrafica_service_config';

export const serviceConfigService = {
  async list(idAnagrafica: number): Promise<ServiceConfigRow[]> {
    // El backend responde { success, data: { id_anagrafica, services, count } }.
    // El array de filas está en data.services (NO en data directamente).
    const raw = await http<{
      data?: { services?: ServiceConfigRow[] } | ServiceConfigRow[];
      services?: ServiceConfigRow[];
      items?: ServiceConfigRow[];
    }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica },
    });
    const d = raw?.data;
    if (d && !Array.isArray(d) && Array.isArray(d.services)) return d.services;
    if (Array.isArray(d)) return d;
    return raw?.services ?? raw?.items ?? [];
  },

  /**
   * Listini elegibles por servizio (del titolare del cliente), para el select
   * del campo id_listino_nome en la edición inline. Mapa { id_servizio: [...] }.
   */
  async availableListini(idAnagrafica: number): Promise<Record<number, { id: number; nome: string }[]>> {
    const raw = await http<{
      data?: { available_listini?: Record<string, { id: number; nome: string }[]> };
      available_listini?: Record<string, { id: number; nome: string }[]>;
    }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica, view: 'available_listini' },
    });
    const map = raw?.data?.available_listini ?? raw?.available_listini ?? {};
    const out: Record<number, { id: number; nome: string }[]> = {};
    for (const [k, v] of Object.entries(map)) out[Number(k)] = v;
    return out;
  },

  async updateField(
    idAnagrafica: number,
    idServizio: number,
    field: string,
    value: unknown,
  ): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'PATCH',
      body: { id_anagrafica: idAnagrafica, id_servizio: idServizio, field, value },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /**
   * Aplica el mismo campo/valor a varios servizi (operación batch, paridad
   * legacy FldUpdTp con `idl`). Se hace como PATCH secuenciales reutilizando
   * updateField; devuelve cuántos OK / fallidos.
   */
  async updateFieldBatch(
    idAnagrafica: number,
    idServizi: number[],
    field: string,
    value: unknown,
  ): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    for (const idServizio of idServizi) {
      try {
        await this.updateField(idAnagrafica, idServizio, field, value);
        ok++;
      } catch {
        failed++;
      }
    }
    return { ok, failed };
  },

  async toggleBlockBatch(
    idAnagrafica: number,
    idServizi: number[],
    blocked: boolean,
  ): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    for (const idServizio of idServizi) {
      try {
        await this.toggleBlock(idAnagrafica, idServizio, blocked);
        ok++;
      } catch {
        failed++;
      }
    }
    return { ok, failed };
  },

  async bulkAssign(
    idAnagrafica: number,
    listinoType: ListinoType,
    forza: boolean = false,
  ): Promise<{ updated: number; skipped: number; forza: boolean }> {
    const raw = await http<{ data?: { services_updated?: number; services_skipped?: number; forza?: boolean }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, action: 'bulk_assign', listino_type: listinoType, forza },
    });
    if (raw?.error) throw new Error(raw.error);
    return {
      updated: raw?.data?.services_updated ?? 0,
      skipped: raw?.data?.services_skipped ?? 0,
      forza: raw?.data?.forza ?? forza,
    };
  },

  /**
   * Bloqueo/desbloqueo masivo resuelto en SERVIDOR (una sola petición).
   *
   * `except` deja fuera los servizi indicados, lo que permite el gesto "dejar
   * disponibles solo estos". No usar toggleBlockBatch para esto: hace una
   * petición HTTP por servizio y aquí serían ~300 encadenadas.
   */
  async bulkBlock(
    idAnagrafica: number,
    blocked: boolean,
    except: number[] = [],
  ): Promise<{ changed: number; skipped: number }> {
    const raw = await http<{
      data?: { services_changed?: number; services_skipped?: number };
      error?: string;
    }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, action: 'bulk_block', blocked, except },
    });
    if (raw?.error) throw new Error(raw.error);
    return {
      changed: raw?.data?.services_changed ?? 0,
      skipped: raw?.data?.services_skipped ?? 0,
    };
  },

  async toggleBlock(idAnagrafica: number, idServizio: number, blocked: boolean): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, id_servizio: idServizio, action: 'block', blocked },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
