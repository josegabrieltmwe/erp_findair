import { http } from "@shared/anagrafiche/services/http";

/**
 * Tracking management (TMWE). Own SPA in the modern ERP (moved out of
 * admin_config).
 *
 * Backend: /admin_tracking_api (Web_Tracking_Management_Controller — hybrid auth).
 *   - GET  ?limit&offset&courier&search  → list + couriers + email_stats
 *   - GET  ?job_id=N                      → progress of an enqueued batch job
 *   - POST { action:'single', shipment_id } → track one, sync + PERSIST
 *   - POST { action:'batch_all', couriers } → enqueue a background batch job
 */

export interface TrackingShipment {
  id: number;
  AWB_forn: string;
  id_fornitore: number;
  id_cliente: number;
  courier: string;
  cliente?: string;
  data_corriere?: string;
  consegna_stato?: number | null;
  consegna_data?: string | null;
  consegna_firma?: string | null;
  stato_descr?: string;
  stato_tipo?: "D" | "T" | "P" | null;
  [k: string]: unknown;
}

export interface EmailStats {
  total: number;
  sent: number;
  queued: number;
  failed: number;
}

export interface TrackingListResult {
  shipments: TrackingShipment[];
  total: number;
  couriers: string[];
  emailStats: EmailStats;
}

export interface SingleTrackingResult {
  // The single track PERSISTS (consegna_stato, emails, giacenza, awb_reso_tnt)
  // and returns how many shipments were processed/errored (1 shipment → 1/0).
  success?: boolean;
  processed?: number;
  errors?: number;
}

export interface TrackingListParams {
  limit?: number;
  offset?: number;
  courier?: string;
  search?: string;
}

const ENDPOINT = "/admin_tracking_api";

interface RawListResponse {
  success?: boolean;
  error?: string;
  data?: TrackingShipment[];
  total?: number;
  couriers?: string[];
  email_stats?: EmailStats;
}

interface RawSingleResponse {
  success?: boolean;
  error?: string;
  processed?: number;
  errors?: number;
}

export interface JobStatus {
  id: number;
  job_type: string;
  status: "pending" | "running" | "done" | "failed";
  progress_done: number;
  progress_total: number;
  errors: number;
  result: {
    total?: number;
    prepared?: number;
    processed?: number;
    errors?: number;
  } | null;
  error_msg: string | null;
}

interface RawEnqueueResponse {
  success?: boolean;
  error?: string;
  job_id?: number;
  queued?: boolean;
}

interface RawJobStatusResponse {
  success?: boolean;
  error?: string;
  job?: JobStatus;
}

export const trackingManagementService = {
  async list(params: TrackingListParams = {}): Promise<TrackingListResult> {
    const query: Record<string, string | number> = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    };
    if (params.courier) query.courier = params.courier;
    if (params.search) query.search = params.search;
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false)
      throw new Error(raw.error || "Failed to load shipments");
    return {
      shipments: Array.isArray(raw?.data) ? raw!.data! : [],
      total: raw?.total ?? 0,
      couriers: Array.isArray(raw?.couriers) ? raw!.couriers! : [],
      emailStats: raw?.email_stats ?? {
        total: 0,
        sent: 0,
        queued: 0,
        failed: 0,
      },
    };
  },

  async trackSingle(shipmentId: number): Promise<SingleTrackingResult> {
    const raw = await http<RawSingleResponse>(ENDPOINT, {
      method: "POST",
      body: { action: "single", shipment_id: shipmentId },
    });
    if (raw?.success === false) throw new Error(raw.error || "Tracking failed");
    return {
      success: raw?.success,
      processed: raw?.processed,
      errors: raw?.errors,
    };
  },

  /**
   * Enqueue a batch tracking job (all pending, or restricted to the given
   * couriers). Returns the job id; the batch runs in the background — poll it
   * with pollJob().
   *
   * @param couriers courier names (e.g. ['mytnt','dhl']); empty = all pending
   */
  async runBatch(couriers: string[] = []): Promise<{ jobId: number }> {
    const raw = await http<RawEnqueueResponse>(ENDPOINT, {
      method: "POST",
      body: { action: "batch_all", couriers },
    });
    if (raw?.success === false) throw new Error(raw.error || "Batch failed");
    return { jobId: raw?.job_id ?? 0 };
  },

  /** Progress of an enqueued batch job (for polling). */
  async pollJob(jobId: number): Promise<JobStatus> {
    const raw = await http<RawJobStatusResponse>(ENDPOINT, {
      query: { job_id: jobId },
    });
    if (raw?.success === false || !raw?.job)
      throw new Error(raw?.error || "Job not found");
    return raw.job;
  },
};
