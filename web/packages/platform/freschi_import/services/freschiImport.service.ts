import { http } from '../../anagrafiche/services/http';

/**
 * Import masivo de zonas KO/RM del proveedor "Freschi e Schiavoni" en
 * `aree_ko_remote`. Réplica moderna de `freschi_files.php`/
 * `freschi_files_set.php` (Fase 7/L13).
 *
 * ⚠️ Todo-o-nada: si cualquier línea del archivo es inválida, el backend no
 * importa nada (paridad con el legacy) — no es un import fila-a-fila con
 * tolerancia a errores parciales, como sí lo son los de courier
 * (DHL/TNT/Arrivi).
 *
 * ⚠️ Reemplazo transaccional: el backend borra TODAS las zonas existentes
 * del proveedor+país antes de insertar las del archivo — no es un upsert
 * incremental. Un archivo vacío o parcial reemplaza el conjunto completo.
 *
 * El CRUD fila-a-fila de `aree_ko_remote` ya existe en
 * `/settings/geographic-config` (pestaña "Áreas KO / remotas") — este
 * servicio cubre solo el import masivo, que no tenía equivalente moderno.
 *
 * Backend NUEVO: /api_admin_freschi_remote_area_import
 * (Freschi_Remote_Area_Import_Controller).
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
}

export interface FreschiImportResult {
  iso: string;
  report: ImportReport;
}

const BASE = '/api_admin_freschi_remote_area_import';

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  data?: FreschiImportResult;
}

export const freschiImportService = {
  async import(content: string, iso = 'IT'): Promise<FreschiImportResult> {
    const raw = await http<ApiResponse>(BASE, {
      method: 'POST',
      body: { content, iso },
    });
    if (raw.success === false || !raw.data) {
      throw new Error(raw.error || raw.message || 'Import failed');
    }
    return raw.data;
  },
};
