/**
 * Labels & LDV REST client — uses **only `ajax_*` endpoints**.
 *
 * The constraint matters: the SPA must not hit `controller/html/*` or
 * `controller/api/*` directly for printing. Every call below routes through
 * an `ajax_*` controller in `controller/ajax/`.
 *
 * Available ajax endpoints relevant to LDV / labels:
 *   - ajax_get_label_courier_shipment  → metadata (list of labels + per-item urls)
 *   - ajax_get_label_file              → single label image/PDF binary
 *   - ajax_get_label_auxiliar_file     → auxiliary doc (CI, hazmat…) binary
 *   - ajax_validate_before_ldv         → pre-print validation
 *   - ajax_send_ldv_to_mittente        → email the LDV PDF to the sender
 *   - ajax_generate_proforma_file      → generate proforma PDF (separate file)
 *
 * Note: there is **no ajax endpoint that streams the internal TMWE House
 * Waybill (HVB) as HTML/PDF for printing**. The legacy `ldv_print` lives in
 * `controller/html/pdf/` and is forbidden by the current policy. For the
 * House Waybill the SPA can only:
 *   (a) trigger `ajax_send_ldv_to_mittente` to email it, or
 *   (b) inspect the underlying label metadata via `ajax_get_label_*`.
 */
import { http } from "./http";

export interface ValidationIssue {
  category: string;
  field_id?: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidateBeforeLdvResponse {
  success: boolean;
  can_proceed?: boolean;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  error?: string;
}

/** One label or auxiliary doc as returned by `ajax_get_label_courier_shipment`. */
export interface CourierLabelItem {
  /** True for an actual label; false for an auxiliary doc (CI, hazmat, etc.) */
  is_label: boolean;
  /** Package sequence number this label belongs to. */
  package: number;
  /** Auxiliary index (1-based) when `is_label === false`. */
  auxiliar_number?: number;
  /** File extension hint: 'pdf', 'png', 'jpg', etc. */
  ext?: string;
  /** Stable URL of the binary content (PDF/PNG). May be served by an `api/`
   *  controller — the SPA only opens it in a new tab, doesn't call it from JS. */
  url?: string;
  /** Optional HTML preview wrapper URL (legacy `print_print_label_*`). */
  print_url?: string;
  /** Human-readable label description (courier name, package qty…). */
  description?: string;
  /** Rotation hint from the courier client: `false` = already upright,
   *  `true` / `'inverse'` = the label is landscape and must be turned 90° to
   *  read vertically (UPS = 'inverse', FedEx = true). */
  rotate?: boolean | string;
  [k: string]: unknown;
}

export interface CourierLabelMetadata {
  success: boolean;
  labels?: CourierLabelItem[];
  /** Single URL that prints all labels concatenated (legacy print-all). */
  print_all?: string;
  error?: string;
  errors?: Array<{ message: string }>;
}

export interface SendLdvToMittenteResponse {
  success: boolean;
  sent_to?: string;
  sent_at?: string;
  error?: string;
}

/** One LDV label as returned by `ajax_tmwe_label`. */
export interface TmweLabelItem {
  package_number: number;
  format: "jpg" | "pdf" | string;
  base64: string;
  master_tracking?: string | null;
  package_tracking?: string | null;
  is_label?: boolean;
  is_image?: boolean;
}

export interface TmweLabelResponse {
  success: boolean;
  metadata?: {
    provider?: string;
    master_tracking_number?: string;
    timestamp?: string;
    execution_time_ms?: number;
    driver_name?: string;
    delivery_round?: string;
  };
  shipment?: {
    shipment_id: number;
    master_tracking_number: string;
    packages_count: number;
    driver_name?: string;
    delivery_round?: string;
    labels: TmweLabelItem[];
  };
  error?: { message: string; code?: string } | string;
}

export const labelsService = {
  /** `ajax_validate_before_ldv` — pre-flight check before printing. */
  validate(shipment_id: number): Promise<ValidateBeforeLdvResponse> {
    return http<ValidateBeforeLdvResponse>("/ajax_validate_before_ldv", {
      query: { shipment_id },
    });
  },

  /**
   * `ajax_get_label_courier_shipment` — list of available courier labels
   * + auxiliary docs for the shipment. Each item carries its own `url`
   * (the binary) and `print_url` (the HTML preview wrapper) — the SPA
   * just opens those in a new tab; it never POSTs to them from JS so the
   * "ajax-only" rule is honoured (we only *consume* the metadata).
   */
  getCourierLabels(shipment_id: number): Promise<CourierLabelMetadata> {
    return http<CourierLabelMetadata>("/ajax_get_label_courier_shipment", {
      query: { shipment_id },
    });
  },

  /**
   * `ajax_send_ldv_to_mittente` — email the LDV travel-document PDF to the
   * shipment's sender. Replaces the legacy `spedy_ldv_mitt.php` call.
   */
  sendLdvToMittente(shipment_id: number): Promise<SendLdvToMittenteResponse> {
    return http<SendLdvToMittenteResponse>("/ajax_send_ldv_to_mittente", {
      query: { shipment_id },
    });
  },

  /**
   * `ajax_tmwe_label` — generate the internal TMWE House Waybill (LDV) and
   * return it base64-encoded inside JSON. The SPA can then render it via
   * `data:` URI (image) or `URL.createObjectURL` (PDF blob).
   *
   * The backend wraps `TMWE_Label_Generator` (RabbitMQ image pipeline), so
   * the first call takes ~3-5s (Chromium headless render). Subsequent calls
   * hit the on-disk persistence cache populated by `Label_Persistence_Service`.
   */
  tmweLabel(
    shipment_id: number,
    opts: {
      output_format?: "image" | "pdf";
      package_number?: number;
    } = {},
  ): Promise<TmweLabelResponse> {
    const query: Record<string, string | number> = { shipment_id };
    if (opts.output_format) query.output_format = opts.output_format;
    if (opts.package_number != null) query.package_number = opts.package_number;
    return http<TmweLabelResponse>("/ajax_tmwe_label", { query });
  },

  /**
   * `full_shipment_label_generator` — generate the real courier AWB (DHL,
   * UPS, FedEx, TNT, MyTNT) by publishing a RabbitMQ RPC message and
   * persisting the response into `spedizioni.AWB_forn` + per-collo labels.
   *
   * The endpoint already exists in `controller/web/courier/shipment/`
   * (`Web_Full_Shipment_Label_Generator_Controller`) and accepts session
   * cookies via the hybrid auth override. No new ajax wrapper is needed —
   * we just POST to it from the SPA.
   *
   * **WARNING**: this triggers a real booking with the courier — each call
   * generates an AWB that the courier bills. Always require an explicit
   * confirmation from the operator before invoking, and pass
   * `options.use_testing=true` when running outside production.
   *
   * Server-side persistence side-effects:
   *   - spedizioni.AWB_forn ← courier-issued tracking number
   *   - spedizioni.AWB_id_forn ← fornitore id (3=DHL, 5=FedEx, 7=UPS, 8107=TNT)
   *   - spedizioni.data_corriere ← today (hard-coded in Label_Persistence_Trait:218)
   *   - spedizioni_colli.AWB_forn ← per-package tracking
   *   - spedizioni_colli.ldv_stampata ← 'S'
   *   - /var/erplogs/ ← label files (jpg/pdf/gif)
   *
   * Date sent to the carrier: `spedizioni.data_sped0`, sanitised by
   * `validate_and_adjust_shipment_date()` (empty/invalid/past → tomorrow).
   */
  generateCourierLabel(
    shipment_id: number,
    opts: {
      force_courier?: boolean;
      use_testing?: boolean;
      convert_to_jpg?: boolean;
      auto_select_fornitore?: boolean;
    } = {},
  ): Promise<{
    success: boolean;
    data?: {
      shipment_id: number;
      label_type: "tmwe" | "courier";
      decision_reason?: string;
      courier?: string;
      master_tracking_number: string | null;
      labels: Array<{
        package_number: number;
        master_tracking?: string;
        package_tracking?: string;
        format: string;
        content?: string;
        base64?: string;
      }>;
      packages_count: number;
      execution_time_ms?: number;
      fornitore_selected?: boolean;
    };
    error?: string | { message: string; code?: string };
  }> {
    return http("/full_shipment_label_generator", {
      method: "POST",
      body: {
        shipment_id,
        options: {
          force_courier: opts.force_courier ?? true,
          use_testing: opts.use_testing ?? false,
          convert_to_jpg: opts.convert_to_jpg ?? true,
          auto_select_fornitore: opts.auto_select_fornitore ?? false,
        },
      },
    });
  },
};
