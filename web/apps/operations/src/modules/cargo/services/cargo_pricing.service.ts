import { http } from "./http";

export interface PricingBreakdownLine {
  id: number;
  id_cargo: number;
  tipo: string;
  type: string;
  code: string;
  nome: string;
  somma: string;
  costo_unit: number;
  costo_min: number;
  costo_max: number;
}
export interface PricingBreakdown {
  base: {
    peso_tassabile: number;
    coeff_volm: number;
    scaglione_kg: number;
    scaglione_pr: number;
  };
  lines: PricingBreakdownLine[];
  surcharges: { code: string; amount: number; valuta: string }[];
  insurance: {
    perc: number;
    min: number;
    amount: number;
    valuta: string;
  } | null;
  currency_chain: string[];
  totals: {
    costo: number;
    carico: number;
    profit_perc: number;
    utile_previsto: number;
  };
}

export interface CargoCrmRelation {
  id: number;
  stato_pratica: string;
  last_activity: string | null;
  oggetto?: string;
  data_next?: string | null;
  /** SPA modern (paridad crm_form.php); preferir sobre legacy_url. */
  url?: string;
  legacy_url: string;
}

export interface CargoRelations {
  crm: CargoCrmRelation | null;
  crms: CargoCrmRelation[];
  crm_count: number;
  crm_allowed?: boolean;
  giacenze: {
    id: number;
    code: string;
    quantity: number;
    is_open?: boolean;
    legacy_url: string;
  }[];
  fatture: {
    id: number;
    kind: string;
    number: string;
    date: string | null;
    amount: number | null;
    legacy_url: string;
  }[];
}

export interface AuditEntry {
  id: number;
  ts: string;
  tabella: string;
  id_record: number;
  campo: string;
  valore_old: string | null;
  valore_new: string | null;
  user: string;
  user_name: string | null;
  ip: string | null;
}

/** Un escalón de la tabla de márgenes del cliente (anagrafiche_scaglioni). */
export interface MarginBracket {
  /** Peso a partir del cual aplica este escalón (columna kgNN). */
  min_weight: number;
  /** Markup sobre coste, en % (columna prNN). */
  margin_percent: number;
  /** Marcado en cliente: el escalón que corresponde al peso de esta expedición. */
  active?: boolean;
}

export interface MarginExplain {
  brackets: MarginBracket[];
  /** Origen de los escalones: pacto por vettore o tabla general del cliente. */
  source: string;
  vettore: string | null;
}

/**
 * Escalones de margen aplicables a una expedición, para explicar en pantalla de
 * dónde sale el porcentaje. Sólo lectura: no recalcula ni reescribe nada.
 */
export function fetchMarginExplain(cargo_id: number): Promise<MarginExplain> {
  return http<MarginExplain>("/api_cargo_margin_explain", {
    query: { cargo_id },
  });
}

export const cargoPricingService = {
  breakdown(cargo_id: number): Promise<PricingBreakdown> {
    return http<PricingBreakdown>("/api_cargo_pricing_breakdown", {
      query: { cargo_id },
    });
  },
};

export const cargoRelationsService = {
  get(cargo_id: number): Promise<CargoRelations> {
    return http<CargoRelations>("/api_cargo_relations", {
      query: { cargo_id },
    });
  },
};

export const cargoAuditService = {
  list(
    cargo_id: number,
    limit = 50,
  ): Promise<{
    items: AuditEntry[];
    cursor: { next: string | null; limit: number };
  }> {
    return http("/api_cargo_audit", { query: { cargo_id, limit } });
  },
  /** Per-field modification history (legacy log_modifiche.php / ShowLogMod). */
  async fieldHistory(
    cargo_id: number,
    campo: string,
    limit = 30,
  ): Promise<AuditEntry[]> {
    const r = await http<{ items: AuditEntry[] }>("/api_cargo_audit", {
      query: { cargo_id, campo, limit },
    });
    return r.items ?? [];
  },
};
