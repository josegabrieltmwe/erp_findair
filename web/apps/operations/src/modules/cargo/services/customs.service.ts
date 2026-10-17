import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Customs / sdoganamento read-only view + mail-share recipients.
 *
 * Wraps two parity-v7 controllers:
 *   - api_cargo_customs_box           → Web_Sdoganamento_Controller
 *   - api_cargo_mawb_share_recipients → Web_Mawb_Share_Controller
 *
 * Used by CargoCustomsBox.vue (agency dropdowns + readonly flag) and
 * CargoMailAgenzieDialog.vue (contact picker).
 */

export interface AgencyOption {
  id: number;
  nome: string;
}

export interface CustomsBoxFields {
  id_ag_export: string | number | null;
  id_ag_import: string | number | null;
  export_ag_mail: string | null;
  import_ag_mail: string | null;
  sdoganam_E: string | null;
  sdoganam_I: string | null;
  acc_export: string | null;
  acc_import: string | null;
  data_mail_ag_export: string | null;
  data_mail_ag_import: string | null;
  terminal_part: string | null;
  terminal_dest: string | null;
}

export interface CustomsBoxPayload {
  cargo_id: number;
  readonly: boolean;
  fields: CustomsBoxFields;
  agencies: {
    export: AgencyOption[];
    import: AgencyOption[];
  };
  iso_from: string;
  iso_dest: string;
}

export interface ShareRecipient {
  id: number;
  email: string;
  name: string;
}

export interface ShareRecipientsPayload {
  cargo_id: number;
  recipients: ShareRecipient[];
  count: number;
}

export const customsService = {
  /** api_cargo_customs_box — read box state + agency dropdown options. */
  loadBox(cargo_id: number): Promise<ApiEnvelope<CustomsBoxPayload>> {
    return http<ApiEnvelope<CustomsBoxPayload>>("/api_cargo_customs_box", {
      query: { cargo_id },
    });
  },

  /**
   * api_cargo_mawb_share_recipients — contacts of the cargo's client,
   * filtered to those that have a non-empty email. Sorted by name ASC.
   */
  loadRecipients(
    cargo_id: number,
  ): Promise<ApiEnvelope<ShareRecipientsPayload>> {
    return http<ApiEnvelope<ShareRecipientsPayload>>(
      "/api_cargo_mawb_share_recipients",
      {
        query: { cargo_id },
      },
    );
  },
};
