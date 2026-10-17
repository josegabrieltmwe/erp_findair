/** Modo de importación: express (spedizioni) o cargo (spedizioni_cargo). */
export type BulkMode = "express" | "cargo";

/** Mapeo columna CSV → columna BD (del GET de cada endpoint). */
export type ColumnMapping = Record<string, string>;

export interface MappingResponse {
  default_mapping: ColumnMapping;
  max_rows: number;
}

/** Una fila ya parseada (asociativa header→valor). */
export type BulkRow = Record<string, string>;

export interface PreviewError {
  row: number;
  messages: string[];
}

export interface PreviewSummary {
  total: number;
  valid: number;
  invalid: number;
}

export interface PreviewResult {
  preview: boolean;
  headers_detected: string[];
  mapping_used: ColumnMapping;
  summary: PreviewSummary;
  errors: PreviewError[];
  valid_rows: BulkRow[];
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  ids?: number[];
  errors: ImportError[];
}
