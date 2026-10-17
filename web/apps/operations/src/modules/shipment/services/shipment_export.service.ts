import { http } from "./http";

/**
 * Shipment export service.
 *
 * The export is a BACKGROUND JOB, not a request that returns a file: building a
 * 5000-row XLSX takes ~34s server-side, and FPM runs the ERP pool with
 * `pm.max_children = 5`. So the flow is enqueue → poll → download, the same
 * shape the tracking batch uses (see trackingManagement.service.ts).
 *
 * Filters are the listing's OWN params, forwarded verbatim: the backend runs
 * them through the same Shipments_List_Request_Handler the listing uses, so the
 * file matches what is on screen — all ~60 filters, not a subset.
 */

/** Grouping modes, same codes the legacy accepted in `?vrs=`. */
export type ShipmentExportGrouping = "0" | "S" | "C" | "R" | "U" | "N";

export type ShipmentExportFormat = "xlsx" | "csv";

export interface ShipmentExportRequest {
  /** Listing filter params, exactly as sent to the list endpoint. */
  params?: Record<string, unknown>;
  /** Explicit selection; wins over params when non-empty. */
  shipment_ids?: number[];
  type_export?: "express" | "cargo";
  format?: ShipmentExportFormat;
  grouping?: ShipmentExportGrouping;
}

export interface ShipmentExportJobResult {
  row_count: number;
  filename?: string;
  mime_type?: string;
  size?: number;
  token?: string;
  /** True when the export hit the 5000-row ceiling and was cut. */
  truncated?: boolean;
  max_rows?: number;
  empty?: boolean;
  message?: string;
}

export interface ShipmentExportJob {
  id: number;
  status: "pending" | "running" | "done" | "failed" | string;
  progress_done: number;
  progress_total: number;
  errors: number;
  result: ShipmentExportJobResult | null;
  error_msg: string | null;
}

interface EnqueueEnvelope {
  success?: boolean;
  error?: string;
  data?: { job_id?: number; queued?: boolean };
}

interface StatusEnvelope {
  success?: boolean;
  error?: string;
  data?: { job?: ShipmentExportJob };
}

/**
 * The hybrid-auth routes, not the plain `api_*` ones: those are OAuth-only and
 * answer `oauth_required` to the SPA's session cookie.
 */
const BASE = "/api_shipment_export_web";
const DOWNLOAD = "/api_shipment_export_download_web";

/** Params that belong to the export itself and are not listing filters. */
const EXPORT_KEYS = ["type_export", "format", "grouping", "shipment_ids"];

export const shipmentExportService = {
  /** Enqueue an export. Returns the job id to poll. */
  async enqueue(request: ShipmentExportRequest): Promise<number> {
    // Listing params first, export keys last: the export's own settings must
    // win if a filter ever happens to share a name with one of them.
    const params = { ...(request.params ?? {}) };
    for (const key of EXPORT_KEYS) delete params[key];

    const body: Record<string, unknown> = {
      ...params,
      type_export: request.type_export ?? "express",
      format: request.format ?? "xlsx",
      grouping: request.grouping ?? "0",
    };

    if (request.shipment_ids?.length) {
      body.shipment_ids = request.shipment_ids;
    }

    const res = await http<EnqueueEnvelope>(BASE, { method: "POST", body });
    const jobId = res?.data?.job_id ?? 0;
    if (res?.success === false || !jobId) {
      throw new Error(res?.error ?? "Could not queue the export");
    }
    return jobId;
  },

  /** Current state of an enqueued export. */
  async poll(jobId: number): Promise<ShipmentExportJob> {
    const res = await http<StatusEnvelope>(BASE, { query: { job_id: jobId } });
    const job = res?.data?.job;
    if (res?.success === false || !job) {
      throw new Error(res?.error ?? "Export job not found");
    }
    return job;
  },

  /**
   * Navigates to the download endpoint for a finished export.
   *
   * A plain navigation rather than fetch+Blob: the file is already on disk
   * server-side, so letting the browser stream it to its own download manager
   * avoids holding ~800KB (and growing) in JS memory for no benefit. The
   * endpoint sets Content-Disposition: attachment, so no page navigation
   * actually happens.
   */
  download(jobId: number): void {
    const base = window.__TMWE_SHIPMENT__?.basePath ?? "/bff/v1";
    const url = `${base}/api_shipment_export_download_web?job_id=${encodeURIComponent(String(jobId))}`;

    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  /** Endpoint path, exposed for tests/diagnostics. */
  downloadPath: DOWNLOAD,
};
