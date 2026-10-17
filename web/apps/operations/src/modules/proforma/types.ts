/**
 * Tipos del dominio proforma. Reflejan las tablas fattura_proforma (cabecera) y
 * fattura_proforma_dett (líneas), y las respuestas de los controllers
 * (Proforma_Crud / Proforma_Item / Proforma_Lookup / Proforma_Duplicate).
 *
 * Header ALLOWED_FIELDS: id_spedizione, iso_paese_origine, motivo, id_valuta, data
 * Item   ALLOWED_FIELDS: id_fattproforma, descrizione, voce_doganale, qta,
 *                        qta_unit, peso_netto, peso_lordo, peso_unit, valore
 */

/** Línea de mercancía de la proforma. */
export interface ProformaItem {
  id?: number | string;
  id_fattproforma?: number | string;
  descrizione: string | null;
  voce_doganale: string | null;
  qta: number | string | null;
  qta_unit: string | null;
  peso_netto: number | string | null;
  peso_lordo: number | string | null;
  peso_unit: string | null;
  valore: number | string | null;
  stato?: string;
}

/** Cabecera de proforma (con items embebidos en el GET single). */
export interface Proforma {
  id: number | string;
  id_spedizione: number | string;
  iso_paese_origine: string | null;
  motivo: string | null;
  id_valuta: number | string | null;
  data: string | null;
  insert_datetime?: string;
  // Campos derivados/enriquecidos por el backend:
  motivo_descr?: string;
  currency_code?: string;
  AWB?: string | null;
  RIF_cliente?: string;
  items?: ProformaItem[];
}

/** Filtros del listado. */
export interface ProformaFilters {
  id_spedizione: number | null;
  date_from: string | null;
  date_to: string | null;
  iso_paese_origine: string | null;
}

export function emptyFilters(): ProformaFilters {
  return {
    id_spedizione: null,
    date_from: null,
    date_to: null,
    iso_paese_origine: null,
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
}

export interface ProformaListResult {
  data: Proforma[];
  pagination: PaginationMeta;
}

/** Opción de lookup (motivi / units). */
export interface LookupOption {
  sigla_dhl: string;
  descriz?: string;
  sigla_traduz?: string;
}

/** Payload de escritura de la cabecera (con items opcionales para cascade). */
export interface ProformaWritePayload {
  id_spedizione: number;
  iso_paese_origine?: string | null;
  motivo?: string | null;
  id_valuta?: number | string | null;
  data?: string | null;
  items?: ProformaItem[];
}
