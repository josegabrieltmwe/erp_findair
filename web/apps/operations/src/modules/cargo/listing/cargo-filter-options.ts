import type { FilterOptionDef } from "@shared/listing/filterOptions";

/**
 * Opciones de los selects del panel de filtros del listado cargo
 * (CargoFilterPanel). La página del listado las reutiliza para etiquetar los
 * chips de filtro activo con el texto de la opción y no con el valor crudo.
 */
export const LOCATION_SCOPE_OPTIONS: readonly FilterOptionDef[] = [
  // '' = sin lado: el backend busca en origen Y destino.
  { value: "", key: "filters.value.any_side" },
  { value: "P", key: "filters.value.origin" },
  { value: "D", key: "filters.value.destination" },
];

export const GESTIONE_OPTIONS: readonly FilterOptionDef[] = [
  { value: "N", key: "enums.gestione.to_quote" },
  { value: "F", key: "enums.gestione.quoting" },
  { value: "O", key: "enums.gestione.sent" },
];

export const OFFERTA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "A", key: "enums.offerta.accepted" },
  { value: "R", key: "enums.offerta.rejected" },
];

// Cargo `controllata` es binaria (S/N): no hay 'O' como en express (el flujo
// de oferta vive en su propia columna `offerta`).
export const CONTROLLATA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "common.yes" },
  { value: "N", key: "common.no" },
];

export const CONSEGNA_FIRMA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "enums.delivered.yes" },
  { value: "N", key: "enums.delivered.no" },
];

export const ARCHIVIATA_OPTIONS: readonly FilterOptionDef[] = [
  { value: "S", key: "enums.archived.yes" },
  { value: "N", key: "enums.archived.no" },
];

// Enum legacy `$cargoct` — primeros valores de spedyc_form.
export const TIPO_MERCE_OPTIONS: readonly FilterOptionDef[] = [
  { value: "DOC", key: "enums.cargo_type.documents" },
  { value: "NDC", key: "enums.cargo_type.non_doc" },
  { value: "SPL", key: "enums.cargo_type.special" },
];

// Enum legacy `$cargovtERPsrc`.
export const VETTORE_TIPO_OPTIONS: readonly FilterOptionDef[] = [
  { value: "intl", key: "enums.carrier_type.international" },
  { value: "dom", key: "enums.carrier_type.domestic" },
  { value: "express", key: "enums.carrier_type.express" },
];

/** Campo del estado del listado → lista de opciones que lo etiqueta. */
export const CARGO_FILTER_OPTIONS: Readonly<
  Record<string, readonly FilterOptionDef[]>
> = {
  gestione: GESTIONE_OPTIONS,
  offerta: OFFERTA_OPTIONS,
  controllata: CONTROLLATA_OPTIONS,
  consegna_firma: CONSEGNA_FIRMA_OPTIONS,
  archiviata: ARCHIVIATA_OPTIONS,
  tipo_merce: TIPO_MERCE_OPTIONS,
  vettore_tipo: VETTORE_TIPO_OPTIONS,
};
