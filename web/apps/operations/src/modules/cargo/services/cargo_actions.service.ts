import { http } from "./http";

/**
 * Cargo actions service — covers operational workflows triggered from
 * the v2 layout (cancel cargo, send MAWB email to client, pre-LDV
 * validation, print PDFs).
 *
 * Modern controllers (WS-1 paridad cargo):
 *   - POST  /api_cargo_cancel         Cancel_Controller
 *   - POST  /api_cargo_email_mawb     Email_Mawb_Controller (delegates to Awb_Email_Service)
 *   - GET   /api_cargo_validate_ldv   Validate_Ldv_Controller (structured issues)
 *
 * Print PDFs continue to go through window.open() on the legacy
 * /erp/spedyc_pdf_*.php endpoints — portar los templates TCPDF está
 * fuera de scope de WS-1 (ver plan_paridad_cargo_form.md §3 WS-3).
 */

export interface OperationResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}

export type EwbType = "FWB" | "FHL";
export type EwbState =
  | "pending"
  | "sent"
  | "ack"
  | "rejected"
  | "error"
  | "cancelled";

export interface EwbFma {
  state?: string;
  code?: string | null;
  errors?: string[];
}

export interface EwbStatus {
  id: number;
  awb: string;
  state: EwbState;
  http_status: number;
  transaction_id: string;
  fma_state: string;
  fma_code: string;
  fma_errors: string[];
  error_code: string;
  modif_datetime: string;
}

interface EwbStatusResponse {
  success?: boolean;
  message?: EwbStatus | null;
  error?: string;
}

interface EwbSendResponse {
  success?: boolean;
  state?: EwbState;
  awb?: string;
  fma?: EwbFma | null;
  transaction_id?: string | null;
  error?: string;
  error_code?: string;
}

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  success: boolean;
  ready: boolean;
  issues?: ValidationIssue[];
  raw?: string;
  error?: string;
}

interface CancelResponse {
  success: boolean;
  cargo_id: number;
  new_stato: string;
  message?: string;
  cascade?: {
    packages?: number;
    has_mawb?: boolean;
    has_handler?: boolean;
    has_links?: boolean;
    cascaded?: { giacenze?: boolean; crm?: boolean };
  };
  error?: string;
}

interface EmailMawbResponse {
  success: boolean;
  cargo_id?: number;
  request_id?: string;
  recipients_count?: number;
  attachments_count?: number;
  smtp_source?: string;
  message?: string;
  error?: string;
}

export const cargoActionsService = {
  /**
   * Soft-cancel the cargo. Backend sets stato='O', appends a marker to
   * note_interne and cascades to giacenze + crm rows.
   */
  async cancel(cargoId: number, reason?: string): Promise<OperationResult> {
    try {
      const r = await http<CancelResponse>("/api_cargo_cancel", {
        method: "POST",
        body: { cargo_id: cargoId, reason: reason ?? "" },
      });
      if (!r?.success) {
        return { success: false, error: r?.error ?? "Cancel failed" };
      }
      return { success: true, message: r.message, data: r.cascade };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Send any AWB document email (mawb, hawb, manifest, pouch, mawb_colli,
   * hawb_colli). Routes to `/api_awb_email` which is the generic
   * counterpart of `/api_cargo_email_mawb` and accepts the `type`
   * parameter — both backends delegate to the same `Awb_Email_Service`
   * so the email pipeline (partner SMTP, RabbitMQ, signed B2B links)
   * stays identical regardless of which document is being shared.
   *
   * The `awbId` argument is REQUIRED when sending a specific HAWB
   * (`type=hawb` or `type=hawb_colli`); without it the backend rejects
   * the call with `VALIDATION_ERROR`.
   */
  async emailDocument(
    cargoId: number,
    type: AwbDocumentKind,
    recipients: string[],
    extras: {
      cc?: string[];
      subject?: string;
      bodyHtml?: string;
      mode?: "links" | "attachment";
      awbId?: number;
    } = {},
  ): Promise<OperationResult> {
    if (!recipients || recipients.length === 0) {
      return { success: false, error: "No recipients provided." };
    }
    try {
      const r = await http<EmailMawbResponse>("/api_awb_email", {
        method: "POST",
        body: {
          cargo_id: cargoId,
          type,
          awb_id: extras.awbId ?? null,
          recipients,
          cc: extras.cc ?? [],
          subject: extras.subject ?? "",
          body_html: extras.bodyHtml ?? "",
          mode: extras.mode ?? "links",
        },
      });
      if (!r?.success) {
        return { success: false, error: r?.error ?? "Email send failed" };
      }
      return {
        success: true,
        message: r.message ?? "Email queued.",
        data: {
          request_id: r.request_id,
          recipients_count: r.recipients_count,
          smtp_source: r.smtp_source,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  /**
   * Pre-LDV validation: returns a structured list of issues so the SPA
   * can render a real checklist UI.
   */
  async validateLdv(cargoId: number): Promise<ValidationResult> {
    try {
      const r = await http<ValidationResult>("/api_cargo_validate_ldv", {
        query: { cargo_id: cargoId },
      });
      return {
        success: Boolean(r?.success),
        ready: Boolean(r?.ready),
        issues: r?.issues ?? [],
      };
    } catch (e) {
      return { success: false, ready: false, error: (e as Error).message };
    }
  },

  /**
   * Open a print PDF — modern flow.
   *
   * Calls the REST endpoint `GET /api_awb_documents?cargo_id=X&type=KIND&format=pdf`
   * which is served by `Awb_Document_Controller` and delegates rendering
   * to `Awb_Document_Service`. The endpoint returns either:
   *   - `application/pdf` bytes (200) → we wrap as Blob, open a tab pointed
   *     at the object URL so the browser shows the PDF inline.
   *   - JSON error (`NO_MAWB`, `NO_HAWB`, `CARGO_NOT_FOUND`, ...) →
   *     resolves with `{ ok: false, error_code, error }` so the caller
   *     can render a toast in the operator's language.
   *
   * This replaces the legacy `spedyc_pdf_*.php` direct invocation. The
   * legacy endpoints called `Create_mrg_pdf()` (wkhtmltopdf) and were
   * coupled to `awb_cargo.otp` for anti-IDOR; the modern service shares
   * the same `Awb_Document_Service` rendering pipeline but enforces auth
   * via the standard session/Bearer of `Web_Awb_Document_Controller` so
   * no soft-token is needed (the user's anagrafica is the trust boundary).
   *
   * Document kinds map 1:1 to the legacy `AwbDocsDw('MAWB'|...|'HCOLLI')`
   * dispatcher, except names are normalized:
   *   - legacy `MNFST`  → modern `manifest`
   *   - legacy `MCOLLI` → modern `mawb_colli`
   *   - legacy `HCOLLI` → modern `hawb_colli`
   */
  openPdfMawb(cargoId: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "mawb");
  },
  openPdfHawb(cargoId: number, awbId?: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "hawb", awbId);
  },
  openPdfManifest(cargoId: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "manifest");
  },
  openPdfPouch(cargoId: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "pouch");
  },
  openPdfMcolli(cargoId: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "mawb_colli");
  },
  openPdfHcolli(cargoId: number, awbId?: number): Promise<PdfOpenResult> {
    return openModernPdf(cargoId, "hawb_colli", awbId);
  },

  /**
   * Read the latest e-AWB (FWB/FHL) transmission state for a cargo. Returns
   * the persisted Ewb_Message row (state + FMA), or null when never sent.
   * GET /unified_cargo_ewb_send?cargo_id=N&type=FWB
   */
  async getEwbStatus(
    cargoId: number,
    type: EwbType = "FWB",
  ): Promise<EwbStatus | null> {
    try {
      const r = await http<EwbStatusResponse>("/unified_cargo_ewb_send", {
        query: { cargo_id: cargoId, type },
      });
      if (!r?.success) return null;
      return r.message ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Transmit the e-AWB (FWB/FHL) for a cargo through the aggregator worker.
   * use_testing defaults to true (sandbox) — a production transmission needs
   * use_testing=false AND the worker's allow_production flag. The synchronous
   * RPC can take up to ~35s.
   * POST /unified_cargo_ewb_send
   */
  async sendEwb(
    cargoId: number,
    type: EwbType = "FWB",
    opts: { useTesting?: boolean; houseAwbId?: number } = {},
  ): Promise<OperationResult> {
    try {
      const body: Record<string, unknown> = {
        type,
        use_testing: opts.useTesting !== false, // default true
      };
      if (type === "FHL") body.house_awb_id = opts.houseAwbId ?? 0;
      else body.cargo_id = cargoId;

      const r = await http<EwbSendResponse>("/unified_cargo_ewb_send", {
        method: "POST",
        body,
      });
      if (!r?.success) {
        return {
          success: false,
          error: r?.error ?? "e-AWB transmission failed",
        };
      }
      return {
        success: true,
        message: r.state ? `e-AWB ${r.state}` : "e-AWB transmitted",
        data: {
          state: r.state,
          awb: r.awb,
          fma: r.fma,
          transaction_id: r.transaction_id,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};

/* ================================================================
   Modern PDF flow — mirrors `awb_docs_dw_override.js` (legacy override
   that already routes through the modern endpoint). The endpoint
   `/api_awb_documents` renders the HTML server-side and hands it to
   the image_converter RabbitMQ worker which runs wkhtmltopdf — this
   takes 2-8 seconds, so we expose a `loading` callback so the caller
   can show a spinner while the request is in flight.

   Behaviour:
     - 200 application/pdf → trigger native browser download via a
       transient `<a download>` (matches the legacy UX).
     - 401              → throw `SESSION_EXPIRED` so the caller can
                          react (typically a hard reload).
     - 4xx/5xx JSON     → resolve with `{ ok:false, error_code, error }`
                          carrying the structured payload so the UI
                          can render an actionable toast.
================================================================ */

export type AwbDocumentKind =
  | "mawb"
  | "hawb"
  | "manifest"
  | "pouch"
  | "mawb_colli"
  | "hawb_colli";

export interface PdfOpenResult {
  ok: boolean;
  error_code?: string;
  error?: string;
}

/** Per-error-code human-readable hint. Mirrors the legacy override map
 *  (`awb_docs_dw_override.js:69-80`). Kept in English to match the SPA. */
const ERROR_HINTS: Record<string, string> = {
  NO_HAWB:
    "No House AWB has been created for this shipment yet. Open the MAWB form and create the House AWB rows first.",
  NO_MAWB:
    "No Master AWB has been created for this shipment yet. Create the Master AWB before downloading {label}.",
  CARGO_NOT_FOUND:
    "Shipment not found. It may have been removed or you may not have access.",
  ACCESS_DENIED: "You do not have access to this shipment.",
  NO_DATA: "No data available to render {label}.",
  NO_TEMPLATE: "No template available for {label}. Contact support.",
  PDF_ERROR:
    "PDF generation failed for {label}. Please try again; if it persists, contact support.",
  INVALID_TYPE: "Invalid document type requested.",
};

const KIND_LABEL: Record<AwbDocumentKind, string> = {
  mawb: "Master AWB",
  hawb: "House AWB",
  manifest: "Manifest",
  pouch: "Pouch",
  mawb_colli: "Master AWB Packing List",
  hawb_colli: "House AWB Packing List",
};

function formatError(
  kind: AwbDocumentKind,
  body: { error?: string; error_code?: string } | null,
  status: number,
): { code: string; message: string } {
  const label = KIND_LABEL[kind];
  const code = body?.error_code ?? `HTTP_${status}`;
  const hint = ERROR_HINTS[code];
  if (hint) return { code, message: hint.replace(/\{label\}/g, label) };
  if (body?.error)
    return {
      code,
      message: `Failed to generate ${label}: ${body.error} [${code}]`,
    };
  return { code, message: `Failed to generate ${label} (HTTP ${status}).` };
}

async function openModernPdf(
  cargoId: number,
  kind: AwbDocumentKind,
  awbId?: number,
): Promise<PdfOpenResult> {
  const params = new URLSearchParams({
    cargo_id: String(cargoId),
    type: kind,
    format: "pdf",
  });
  if (awbId) params.set("awb_id", String(awbId));

  // Activate the global "PDF generation in flight" overlay. Lazy-imports
  // the store so this service stays loadable in non-SPA contexts (tests,
  // standalone Node scripts) where Pinia isn't initialised.
  let stopOverlay: (() => void) | null = null;
  try {
    const { usePdfLoadingStore } =
      await import("@cargo/stores/pdf_loading.store");
    const overlay = usePdfLoadingStore();
    overlay.start(`Generating ${KIND_LABEL[kind]}…`);
    stopOverlay = () => overlay.stop();
  } catch {
    /* Pinia not available — proceed without overlay. */
  }

  try {
    const res = await fetch(
      `/bff/v1/api_awb_documents?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/pdf, application/json" },
      },
    );

    if (res.status === 401) {
      // Surface as structured error; the caller can decide whether to
      // reload (matches legacy override behaviour).
      return {
        ok: false,
        error_code: "SESSION_EXPIRED",
        error: "Session expired — reload to sign in again.",
      };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && ct.startsWith("application/pdf")) {
      // Native browser download via a transient <a download> element.
      // The browser shows its native "Save As" dialog (or auto-saves)
      // and the filename comes from the type/cargo pair so it's easy
      // to grep on the operator's filesystem.
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${kind.toUpperCase()}_${cargoId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Free the object URL after the browser has had a chance to start
      // the download (immediate revoke aborts the download on some
      // browsers; one tick later is safe — matches legacy override).
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return { ok: true };
    }

    // JSON error envelope from Awb_Document_Controller::map_service_error.
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      error_code?: string;
    } | null;
    const fmt = formatError(kind, body, res.status);
    return { ok: false, error_code: fmt.code, error: fmt.message };
  } catch (e) {
    return {
      ok: false,
      error_code: "NETWORK_ERROR",
      error: (e as Error).message,
    };
  } finally {
    // Always release the spinner refcount, even on early returns above.
    if (stopOverlay) stopOverlay();
  }
}
