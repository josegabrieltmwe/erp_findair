/**
 * Avisos de «Requiere tu atención» de la home: subconjunto de KPI del catálogo
 * que piden una acción del operador. El orden es la prioridad. Solo salen los
 * que valen más de 0. Se piden las fuentes `courier` y `cargo` (2 peticiones),
 * no los indicadores pesados.
 */
import { HOME_KPI_CATALOG, type HomeKpiDescriptor, type KpiCategory } from "@shared/dashboard/home_kpi_catalog";

export const ATTENTION_KEYS = ["indelay", "badaddr", "presefornF", "presefornW", "toqt", "toorg"] as const;

/** Categorías que hay que pedir para obtener ATTENTION_KEYS (courier + cargo). */
export const ATTENTION_CATEGORIES: KpiCategory[] = ["courier_ops_in", "courier_ops_out", "cargo_lifecycle"];

export const ATTENTION_LIMIT = 5;

export interface AttentionItem {
  kpi: HomeKpiDescriptor;
  count: number;
}

export function attentionDescriptors(): HomeKpiDescriptor[] {
  const byKey = new Map(HOME_KPI_CATALOG.map((k) => [k.key, k]));
  return ATTENTION_KEYS.map((k) => byKey.get(k)).filter((k): k is HomeKpiDescriptor => !!k);
}

/** Avisos con valor > 0, en orden de prioridad y con tope. */
export function pickAttention(counts: Record<string, number>, limit = ATTENTION_LIMIT): AttentionItem[] {
  return attentionDescriptors()
    .map((kpi) => ({ kpi, count: Number(counts[kpi.key] ?? 0) }))
    .filter((it) => it.count > 0)
    .slice(0, limit);
}
