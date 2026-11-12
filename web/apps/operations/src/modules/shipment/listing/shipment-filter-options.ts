import type { FilterOptionDef } from "@shared/listing/filterOptions";

/**
 * Opciones de los selects del panel de filtros del listado express
 * (ShipmentFilterPanel). La página del listado las reutiliza para etiquetar
 * los chips de filtro activo: «Controlada: Sí» en vez de «Controlada: S».
 */
export const LOCATION_SCOPE_OPTIONS: readonly FilterOptionDef[] = [
  // '' = sin lado: el backend busca en origen Y destino.
  { value: "", key: "filters.value.any_side" },
  { value: "P", key: "filters.value.origin" },
  { value: "D", key: "filters.value.destination" },
];

export const CONTROLLATA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "common.yes" },
  { value: "N", key: "common.no" },
  { value: "O", key: "enums.controllata.offer" },
];

export const CONSEGNA_FIRMA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "enums.delivered.yes" },
  { value: "N", key: "enums.delivered.no" },
];

export const PRESA_STATO_OPTIONS: readonly FilterOptionDef[] = [
  { value: "N", key: "enums.presa_stato.new" },
  { value: "W", key: "enums.presa_stato.in_progress" },
  { value: "F", key: "enums.presa_stato.finished" },
  { value: "C", key: "enums.presa_stato.cancelled" },
  { value: "T", key: "enums.presa_stato.transferred" },
];

export const ARCHIVIATA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "enums.archived.yes" },
  { value: "N", key: "enums.archived.no" },
];

/**
 * Tramos de cargo en el listado courier. Sin valor (por defecto) solo salen las expediciones courier puras; estas dos
 * opciones muestran, en su lugar, solo las recogidas o solo las entregas de cargo.
 */
export const CARGO_LEG_OPTIONS: readonly FilterOptionDef[] = [
  { value: "pickup", key: "enums.cargo_leg.pickup" },
  { value: "delivery", key: "enums.cargo_leg.delivery" },
];

export const STATO_GIAC_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "enums.stato_giac.has_any" },
  { value: "A", key: "enums.stato_giac.open" },
  { value: "X", key: "enums.stato_giac.closed_only" },
  { value: "N", key: "enums.stato_giac.none" },
];

/** Estados de entrega con acceso directo desde la home (la card «Devoluciones»). */
export const CONSEGNA_STATO_OPTIONS: readonly FilterOptionDef[] = [
  { value: "5", key: "filters.value.returned" },
];

/** Campo del estado del listado → lista de opciones que lo etiqueta. */
export const SHIPMENT_FILTER_OPTIONS: Readonly<
  Record<string, readonly FilterOptionDef[]>
> = {
  controllata: CONTROLLATA_OPTIONS,
  consegna_firma: CONSEGNA_FIRMA_OPTIONS,
  presa_stato: PRESA_STATO_OPTIONS,
  archiviata: ARCHIVIATA_OPTIONS,
  stato_giac: STATO_GIAC_OPTIONS,
  consegna_stato: CONSEGNA_STATO_OPTIONS,
  cargo_leg: CARGO_LEG_OPTIONS,
};
