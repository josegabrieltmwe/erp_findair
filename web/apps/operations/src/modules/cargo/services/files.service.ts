import { http } from "./http";

/**
 * Cargo files service. Uses `/ajax_cargo_files` (Cargo_Files_Service), which
 * handles BOTH scopes for a cargo:
 *   - scope 'ext' → spedizioni_files  (external, role-visibility aware)
 *   - scope 'int' → spedizioni_files2 (internal, operator-only)
 *
 * The operator view lists every active file regardless of role visibility;
 * the `show_*` booleans drive the per-recipient visibility toggles (external
 * only). Replaces the legacy spedy_files.php / spedy_files2.php / shw flow.
 */

export type FileScope = "ext" | "int";
export type FileRecipient = "cliente" | "partner" | "agdogan" | "vettore";

export interface CargoFile {
  id: number;
  nome: string;
  descrizione: string;
  peso_kb: number;
  otp: string;
  scope: FileScope;
  created: string | null;
  // External files only:
  show_cliente?: boolean;
  show_partner?: boolean;
  show_agdogan?: boolean;
  show_vettore?: boolean;
}

interface FilesEnvelope {
  success: boolean;
  data?: { shipment_id: number; scope: FileScope; files: CargoFile[] };
  error?: string;
}

interface MutationEnvelope {
  success: boolean;
  data?: { success?: boolean; file?: CargoFile; error?: string };
  error?: string;
}

export const filesService = {
  async list(
    cargo_id: number,
    scope: FileScope = "ext",
  ): Promise<{ success: boolean; files: CargoFile[]; error?: string }> {
    const res = await http<FilesEnvelope>("/ajax_cargo_files", {
      query: { shipment_id: cargo_id, scope },
    });
    return {
      success: !!res.success,
      files: res.data?.files ?? [],
      error: res.error,
    };
  },

  async upload(
    cargo_id: number,
    file: File,
    descrizione = "",
    scope: FileScope = "ext",
  ): Promise<{ success: boolean; file?: CargoFile; error?: string }> {
    const form = new FormData();
    form.append("shipment_id", String(cargo_id));
    form.append("scope", scope);
    form.append("descrizione", descrizione);
    form.append("file", file);
    const res = await http<MutationEnvelope>("/ajax_cargo_files", {
      method: "POST",
      body: form,
    });
    return {
      success: !!res.success && (res.data?.success ?? true),
      file: res.data?.file,
      error: res.error ?? res.data?.error,
    };
  },

  async remove(
    cargo_id: number,
    file_id: number,
    scope: FileScope = "ext",
  ): Promise<{ success: boolean; error?: string }> {
    const res = await http<MutationEnvelope>("/ajax_cargo_files", {
      method: "POST",
      body: { action: "delete", shipment_id: cargo_id, scope, file_id },
    });
    return { success: !!res.success, error: res.error };
  },

  async setVisibility(
    cargo_id: number,
    file_id: number,
    recipient: FileRecipient,
    visible: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    const res = await http<MutationEnvelope>("/ajax_cargo_files", {
      method: "POST",
      body: {
        action: "visibility",
        shipment_id: cargo_id,
        file_id,
        recipient,
        visible,
      },
    });
    return {
      success: !!res.success && (res.data?.success ?? true),
      error: res.error ?? res.data?.error,
    };
  },

  /**
   * Download URL for a stored file. Modern endpoint
   * `ajax_cargo_files?action=download` (replaces legacy filedwspederp.php) —
   * served by id+otp+scope under the shipment access guard.
   */
  downloadUrl(
    cargo_id: number,
    file_id: number,
    otp: string,
    scope: FileScope = "ext",
  ): string {
    const base =
      (typeof window !== "undefined" && window.__TMWE_CARGO__?.basePath) ||
      "/bff/v1";
    // `op`, not `action`: the dispatcher reserves the `action` query key for the
    // route name (`ajax_cargo_files`), so the download verb travels as `op`.
    const q = new URLSearchParams({
      op: "download",
      shipment_id: String(cargo_id),
      file_id: String(file_id),
      otp,
      scope,
    });
    return `${base}/ajax_cargo_files?${q.toString()}`;
  },
};
