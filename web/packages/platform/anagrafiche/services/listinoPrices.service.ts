import { http } from './http';

/**
 * Lectura de la matriz peso×zona de un listino, para el "Show price list" del
 * modal de listini (paridad legacy ShowListino → pp=listy_show).
 *
 * Cadena: id_listino_nome → listini_pack (variantes P/D/U) → matriz de precios.
 * Reutiliza los endpoints existentes (hybrid/sesión):
 *   - api_listini_pack?listino_id={id_listino_nome}  → packs del listino
 *   - api_listini_prices_web?pack_id={pack}          → matriz peso×zona
 */

export interface ListinoPack {
  id: number;
  pack?: string;          // P/D/U (variante)
  id_listino_nome?: number;
  [k: string]: unknown;
}

export interface PriceMatrixRow {
  zona: string | number;
  peso_max: number;
  prezzo: number;
  prezzo2?: number | string;
  prezzo_base?: number | string;
  prezzo_min?: number | string;
  [k: string]: unknown;
}

export interface ListinoSupplement {
  id: number;
  supplemento_nome?: string;
  costo_fisso?: number | string;
  costo_kg?: number | string;
  costo_collo?: number | string;
  costo_gg?: number | string;
  costo_perc?: number | string;
  costo_min?: number | string;
  costo_maxduro?: number | string;
  costo_max?: number | string;
  [k: string]: unknown;
}

export interface BancaleMatrix {
  types: Array<{ id: number; nome: string; code: string; dims: string }>;
  zones: string[];
  cells: Record<string, Record<string, number>>;
}

export interface ListinoVersion {
  data_start: string;
  data_stop: string;
  estado: 'in_corso' | 'futuro' | 'scaduto';
}

export interface ListinoEnriched {
  metadata?: {
    listino_nome?: string;
    servizio_nome?: string;
    valuta_sigla?: string;
    metric_imperial?: string;
    pack?: string;
    peso_bancale?: string;
    note?: string;
    maggiorazione?: number | string;
    listino_magg_nome?: string;
    usa_costo_base?: string;
    usa_costo_min?: string;
    costo_a_collo2?: string;
    moltipl_step?: string;
    moltipl_ogni_x_kg?: number | string;
    zone_dist_km?: string;
    [k: string]: unknown;
  } | null;
  zone_names?: Record<string, string>;
  supplements?: ListinoSupplement[];
  ext_prices?: PriceMatrixRow[];
  bancale?: BancaleMatrix;
  versions?: ListinoVersion[];
  active_version?: string | null;
}

export interface PriceMatrix {
  pack_id: number;
  prices: PriceMatrixRow[];
  zones_ko?: unknown[];
  enriched?: ListinoEnriched;
}

function unwrap<T>(raw: unknown): T | undefined {
  const r = raw as { data?: T } | T;
  return (r as { data?: T })?.data ?? (r as T);
}

export interface PricePreviewRow {
  zona: string;
  base: number;
  extra?: number;
  suppl?: number;
  fuel_perc: number;
  fuel: number;
  total: number;
  error?: string;
}

export interface PricePreview {
  service_id: number;
  peso: number;
  currency: string;
  rows: PricePreviewRow[];
  error?: string;
}

export interface BancaleType {
  id: number;
  code: string;
  name: string;
  max_base: string;
  max_height: string;
  max_weight: string;
}

export const listinoPricesService = {
  /** Packs (variantes) de un listino_nome. */
  async packs(listinoNomeId: number): Promise<ListinoPack[]> {
    const raw = await http<unknown>('/api_listini_pack', {
      query: { listino_id: listinoNomeId },
    });
    const d = unwrap<{ items?: ListinoPack[]; packs?: ListinoPack[] } | ListinoPack[]>(raw);
    if (Array.isArray(d)) return d;
    return d?.items ?? d?.packs ?? [];
  },

  /** Matriz peso×zona de un pack + datos enriquecidos (metadatos, nombres de
   *  zona, suplementos, peso extra) para la vista completa del operador. */
  async matrix(packId: number, date?: string): Promise<PriceMatrix> {
    const raw = await http<unknown>('/api_listini_prices_web', {
      query: { pack_id: packId, enriched: 1, ...(date ? { date } : {}) },
    });
    const d = unwrap<PriceMatrix>(raw);
    return {
      pack_id: d?.pack_id ?? packId,
      prices: Array.isArray(d?.prices) ? d!.prices : [],
      zones_ko: d?.zones_ko ?? [],
      enriched: d?.enriched,
    };
  },

  /** Precio que pagaría el cliente para un servizio a un peso, por zona
   *  (base + peso extra + fuel del cliente). Reutiliza el motor de rating. */
  async preview(
    idAnagrafica: number,
    idServizio: number,
    peso: number,
    zonas: string[],
    listinoNomeId = 0,
    withSupplements = false,
  ): Promise<PricePreview> {
    const raw = await http<unknown>('/api_listino_price_preview', {
      query: {
        id_anagrafica: idAnagrafica,
        id_servizio: idServizio,
        peso,
        zonas: zonas.join(','),
        ...(listinoNomeId ? { listino_nome_id: listinoNomeId } : {}),
        ...(withSupplements ? { supplements: 1 } : {}),
      },
    });
    const d = unwrap<PricePreview>(raw);
    return {
      service_id: d?.service_id ?? idServizio,
      peso: d?.peso ?? peso,
      currency: d?.currency ?? '€',
      rows: Array.isArray(d?.rows) ? d!.rows : [],
      error: d?.error,
    };
  },

  /** Tipos de pallet/bancale del listino (para listinos peso_bancale='B'). */
  async bancaleTypes(
    idAnagrafica: number, idServizio: number, listinoNomeId = 0,
  ): Promise<{ is_bancale: boolean; types: BancaleType[] }> {
    const raw = await http<unknown>('/api_listino_price_preview', {
      query: { id_anagrafica: idAnagrafica, id_servizio: idServizio, mode: 'types', ...(listinoNomeId ? { listino_nome_id: listinoNomeId } : {}) },
    });
    const d = unwrap<{ is_bancale?: boolean; types?: BancaleType[] }>(raw);
    return { is_bancale: !!d?.is_bancale, types: Array.isArray(d?.types) ? d!.types : [] };
  },

  /** Precio bancale por zona para unos colli (dimensiones). */
  async previewBancale(
    idAnagrafica: number, idServizio: number,
    colli: Array<{ l1: number; l2: number; l3: number; peso: number; qty: number }>,
    zonas: string[], listinoNomeId = 0,
  ): Promise<PricePreview> {
    const raw = await http<unknown>('/api_listino_price_preview', {
      query: {
        id_anagrafica: idAnagrafica, id_servizio: idServizio, mode: 'bancale',
        zonas: zonas.join(','), colli: JSON.stringify(colli),
        ...(listinoNomeId ? { listino_nome_id: listinoNomeId } : {}),
      },
    });
    const d = unwrap<PricePreview>(raw);
    return {
      service_id: d?.service_id ?? idServizio,
      peso: 0,
      currency: d?.currency ?? '€',
      rows: Array.isArray(d?.rows) ? d!.rows : [],
      error: d?.error,
    };
  },
};
