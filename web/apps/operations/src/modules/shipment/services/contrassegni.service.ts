import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Catálogo de tipos de contrassegno (tabla contrassegni). `id_contrassegno` es
 * un FK int a contrassegni.id, no texto libre. Endpoint hybrid (sesión) porque
 * el api_master_cod_reports es OAuth-only.
 */
export interface Contrassegno {
  id: string | number;
  descr: string;
}

let cache: Contrassegno[] | null = null;
let inFlight: Promise<Contrassegno[]> | null = null;

export const contrassegniService = {
  async list(): Promise<Contrassegno[]> {
    if (cache) return cache;
    if (inFlight) return inFlight;
    inFlight = http<ApiEnvelope<Contrassegno[]>>("/api_master_cod_reports_web")
      .then((r) => {
        cache = r?.success && Array.isArray(r.data) ? r.data : [];
        return cache;
      })
      .catch(() => {
        cache = null;
        return [];
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
};
