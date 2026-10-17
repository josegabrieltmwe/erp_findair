import { http } from '../../anagrafiche/services/http';

/**
 * Import masivo de datos DHL: aeropuertos (`dhl_airport`) y disponibilidad
 * de servicios prioritarios (`dhl_prioritari`). Réplica moderna de los dos
 * sub-imports de `dhl_files.php` (Fase 7/L14).
 *
 * ⚠️ Ambos son reemplazo TOTAL, no incremental: el backend borra/trunca la
 * tabla completa antes de cargar el archivo. Un archivo vacío o parcial
 * reemplaza el conjunto completo.
 *
 * ⚠️ Prioritarios es todo-o-nada (si una línea falla, no se importa nada).
 * Aeropuertos también lo es a nivel de archivo, pero con un tope de 500
 * errores acumulados antes de cortar la lectura (el archivo real tiene
 * ~1.6M líneas — no tiene sentido seguir leyendo todo si ya se sabe que
 * el archivo está mal formado).
 *
 * Backend: /api_admin_dhl_priority_import (JSON body, archivo pequeño) y
 * /api_admin_dhl_airport_import (multipart, archivo grande — hasta ~1.6M
 * filas / decenas de MB, sube el `.txt` directamente, NO el `.zip` legacy).
 */

export interface ImportErrorRow {
  row: number;
  message: string;
  line?: string;
}

export interface ImportReport {
  total: number;
  imported: number;
  failed: number;
  errors: ImportErrorRow[];
  errors_truncated?: boolean;
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  data?: { report: ImportReport };
}

const PRIORITY_BASE = '/api_admin_dhl_priority_import';
const AIRPORT_BASE = '/api_admin_dhl_airport_import';

export const dhlImportService = {
  async importPriorityServices(content: string): Promise<ImportReport> {
    const raw = await http<ApiResponse>(PRIORITY_BASE, {
      method: 'POST',
      body: { content },
    });
    if (raw.success === false || !raw.data) {
      throw new Error(raw.error || raw.message || 'Import failed');
    }
    return raw.data.report;
  },

  async importAirports(file: File): Promise<ImportReport> {
    const form = new FormData();
    form.append('file', file);
    const raw = await http<ApiResponse>(AIRPORT_BASE, {
      method: 'POST',
      body: form,
    });
    if (raw.success === false || !raw.data) {
      throw new Error(raw.error || raw.message || 'Import failed');
    }
    return raw.data.report;
  },
};
