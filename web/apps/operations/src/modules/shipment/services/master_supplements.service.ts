import { http } from "./http";

/**
 * Catálogo maestro de suplementos.
 *
 * Wraps GET /api_master_supplements → Web_Supplementi_Controller
 * (parity v7). The legacy spedy_form rendered every catalog item as a
 * checkbox grouped by `gruppo` (1-5); the SPA uses this list to
 * populate the "Add supplement" picker dialog.
 */

export interface MasterSupplement {
  id: number | string;
  /** Group bucket 1-5, used by the picker to render section headers. */
  gruppo: "1" | "2" | "3" | "4" | "5" | number | string;
  orderby?: string;
  nome: string;
  nome_EN?: string;
  help?: string;
  help_EN?: string;
  /** When 'S' the supplement is shown as a checkbox on the form. */
  sped_ckbox?: "S" | "N";
  /** When 'S' the price is fixed (catalog) instead of computed. */
  fisso?: "S" | "N";
  /** When 'S' the supplement applies to express shipments. */
  courier?: "S" | "N";
  /** When 'S' the supplement applies to cargo shipments. */
  cargo?: "S" | "N";
  iso_paese?: string | null;
  import?: "S" | "N";
  export?: "S" | "N";
  blocca?: "S" | "N";
  stato: "A" | "I";
}

export interface MasterSupplementsResponse {
  success: boolean;
  data?: MasterSupplement[];
  error?: string;
}

/**
 * Filters accepted by the backend (Supplementi_Model::get_list). When
 * present, the SQL WHERE clause adds the corresponding constraint.
 *
 * - `sped_ckbox='S'`   : only items rendered as checkboxes in the form.
 * - `autosize='N'`     : exclude auto-sized supplements (computed from
 *   weight/dimensions, not user-selectable).
 * - `fisso='N'`        : exclude fixed-price supplements applied
 *   automatically by service config.
 * - `courier='S'`      : only express-eligible items.
 * - `cargo='S'`        : only cargo-eligible items.
 * - `picker_manual='S'`: exclude the legacy `$sppaut` blacklist
 *   (supplementi the pricing engine applies automatically — see
 *   `Supplementi_Model::AUTO_APPLIED_IDS`). Required for the manual
 *   add-supplement dialog to mirror spedy_form.php behaviour.
 */
export interface MasterSupplementsFilters {
  sped_ckbox?: "S" | "N";
  autosize?: "S" | "N";
  fisso?: "S" | "N";
  courier?: "S" | "N";
  cargo?: "S" | "N";
  picker_manual?: "S" | "N";
  gruppo?: number | string;
  import?: "S" | "N";
  export?: "S" | "N";
}

export const masterSupplementsService = {
  /**
   * GET /api_master_supplements — full catalog. Cached at the store
   * layer so the picker dialog can open instantly after the first
   * load. Pass `filters` to constrain the result-set server-side; the
   * defaults mirror legacy spedy_form.php (sped_ckbox='S',
   * autosize='N', fisso='N').
   */
  list(
    filters: MasterSupplementsFilters = {},
  ): Promise<MasterSupplementsResponse> {
    return http<MasterSupplementsResponse>("/api_master_supplements", {
      query: filters as Record<string, string | number | undefined>,
    });
  },
};
