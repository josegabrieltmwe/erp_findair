/**
 * Acceso a los endpoints de importación masiva (express + cargo). Ambos son
 * Web_* wrappers (hybrid auth sesión+Bearer) con el mismo contrato 3-fases:
 *   GET  → mapping + max_rows
 *   POST → preview (parse + validate, sin insertar)  body: { csv_data, delimiter }
 *   PUT  → import (confirma)                          body: { rows }
 *
 *   express → api_bulk_import
 *   cargo   → api_bulk_cargo_import
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  BulkMode,
  MappingResponse,
  PreviewResult,
  ImportResult,
  BulkRow,
} from "../types";

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function endpoint(mode: BulkMode): string {
  return mode === "cargo" ? "/api_bulk_cargo_import" : "/api_bulk_import";
}

export const bulkService = {
  async mapping(mode: BulkMode): Promise<MappingResponse> {
    const res = await http<Envelope<MappingResponse>>(endpoint(mode), {
      method: "GET",
    });
    return res.data;
  },

  async preview(
    mode: BulkMode,
    csvData: string,
    delimiter = ",",
  ): Promise<PreviewResult> {
    const res = await http<Envelope<PreviewResult>>(endpoint(mode), {
      method: "POST",
      body: { csv_data: csvData, delimiter },
    });
    return res.data;
  },

  async import(mode: BulkMode, rows: BulkRow[]): Promise<ImportResult> {
    const res = await http<Envelope<ImportResult>>(endpoint(mode), {
      method: "PUT",
      body: { rows },
    });
    return res.data;
  },
};
