/**
 * Access layer for the COD assegni module.
 *
 *   POST api_cod_capture_session          open a batch, get its QR
 *   GET  api_cod_capture_session?id=      one batch
 *   GET  api_cod_capture_session?id_fornitore=   batches of a carrier
 *   GET  api_selectable_carriers          the carrier picker (already existed)
 *
 * Uses the shared http client — unlike the public capture SPA, this app runs
 * inside the ERP, with a session, and every endpoint here is a Web_* wrapper
 * (hybrid auth: session or Bearer).
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  ApiEnvelope,
  Carrier,
  CaptureSession,
  CreatedSession,
  ApplyReport,
  PendingSession,
  ReviewBatch,
  SuggestionResult,
} from "../types";

/** Carriers that may own a remittance batch.
 *
 *  There is no `fornitori` table: carriers are rows of `anagrafiche` with
 *  scelta_forn IN (BSI, BES). This endpoint already encodes that rule, so it is
 *  reused rather than re-derived. */
export async function fetchCarriers(): Promise<Carrier[]> {
  const response = await http<
    ApiEnvelope<{ carriers: Carrier[]; count: number }>
  >("/api_selectable_carriers");
  return response.data?.carriers ?? [];
}

export interface CreateSessionPayload {
  id_fornitore: number;
  bill_no?: string;
  bill_date?: string;
  descriz?: string;
}

/**
 * Open a batch and mint its QR.
 *
 * The QR round-trips through a BLOCKING RPC worker, so this can take a moment —
 * and if that worker is down the session is still created and the response
 * carries a `warning` plus a null QR. That is deliberate: the OTP is already
 * persisted, so the operator can retry the image without losing the batch.
 */
export async function createSession(
  payload: CreateSessionPayload,
): Promise<CreatedSession> {
  const response = await http<ApiEnvelope<CreatedSession>>(
    "/api_cod_capture_session",
    { method: "POST", body: payload },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not create the capture session");
  }

  return response.data;
}

export async function fetchSession(id: number): Promise<CaptureSession | null> {
  const response = await http<ApiEnvelope<CaptureSession>>(
    `/api_cod_capture_session?id=${id}`,
  );
  return response.success ? (response.data ?? null) : null;
}

/**
 * The work queue: batches that still need a person, across every carrier.
 *
 * The default view. Listing by carrier answers "what did TNT send us?", which
 * is a question you ask when you already know the answer you want; this one
 * answers "what needs me?", which is how a day actually starts.
 */
/**
 * Soft-delete a whole batch (admin only, enforced server-side).
 *
 * Hides the remittance and everything under it; does not revert cheques already
 * approved onto a shipment -- those are that shipment's record now.
 */
export async function deleteSession(idSession: number): Promise<void> {
  const response = await http<ApiEnvelope<{ deleted: number }>>(
    "/api_cod_capture_session",
    { method: "POST", body: { id: idSession, op: "delete" } },
  );
  if (!response.success) {
    throw new Error(response.error ?? "Could not delete the batch");
  }
}

/**
 * Pasa de `?action=<ruta>&...` (dispatcher de tmwe_json) a `/<ruta>?...` (BFF): el navegador
 * nunca ve app.php y el BFF no admite `action` desde el cliente.
 */
function bffRoute(params: URLSearchParams): string {
  const rest = new URLSearchParams(params);
  const action = rest.get("action") ?? "";
  rest.delete("action");
  const query = rest.toString();
  return `/${action}${query ? `?${query}` : ""}`;
}

export async function fetchPending(
  includeDone = false,
): Promise<PendingSession[]> {
  const params = new URLSearchParams({
    action: "api_cod_capture_session",
    op: "pending",
  });
  if (includeDone) {
    params.set("all", "true");
  }

  const response = await http<
    ApiEnvelope<{ sessions: PendingSession[]; count: number }>
  >(bffRoute(params));
  return response.data?.sessions ?? [];
}

export async function fetchSessionsByCarrier(
  idFornitore: number,
): Promise<CaptureSession[]> {
  const response = await http<
    ApiEnvelope<{ sessions: CaptureSession[]; count: number }>
  >(`/api_cod_capture_session?id_fornitore=${idFornitore}`);
  return response.data?.sessions ?? [];
}

// ---------------------------------------------------------------------------
// The specialist's side: api_cod_capture_review
//
// Everything below carries shipment data, which is exactly what the public
// capture endpoints refuse to serve. Same batch, a different job: the operator
// with the phone confirmed the READING; here someone decides what it MEANS.
// ---------------------------------------------------------------------------

/** Clients that take COD, for the export picker. */
export async function fetchCodClients(): Promise<Carrier[]> {
  const response = await http<ApiEnvelope<{ clients: Carrier[] }>>(
    "/api_cod_distinta_export?op=clients",
  );
  return response.data?.clients ?? [];
}

/**
 * Download the distinta CSV for a client + date range.
 *
 * A file download, not JSON: hits the endpoint, gets text/csv back, and hands
 * the browser a Blob to save. One row per cheque, the shape SIFARMA reconciles
 * against.
 */
export type DistintaFormat = "csv" | "xlsx";

export async function downloadDistinta(params: {
  idCliente: number;
  from?: string;
  to?: string;
  billNo?: string;
  /** csv (default) or a real .xlsx built by the Excel worker. */
  format?: DistintaFormat;
}): Promise<void> {
  const q = new URLSearchParams({
    action: "api_cod_distinta_export",
    id_cliente: String(params.idCliente),
  });
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.billNo) q.set("bill_no", params.billNo);
  if (params.format) q.set("format", params.format);

  const base = window.__TMWE_NAV__?.basePath ?? "/bff/v1";
  const res = await fetch(`${base}${bffRoute(q)}`, {
    credentials: "include",
  });

  if (!res.ok) {
    // The endpoint answers JSON on error; surface its message.
    let msg = "Could not generate the export";
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch {
      /* non-JSON body: keep the default */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const name = match?.[1] ?? `distinta_cod.${params.format ?? "csv"}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The batch with its shipment analysis attached. */
export async function fetchReview(idSession: number): Promise<ReviewBatch> {
  const response = await http<ApiEnvelope<ReviewBatch>>(
    `/api_cod_capture_review?id=${idSession}`,
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not load the batch");
  }

  return response.data;
}

/**
 * Shipments an AS cash return could belong to.
 *
 * It offers; it never picks. Even when exactly one shipment fits, a person
 * confirms — the whole reason these rows stop here is that no rule can resolve
 * them.
 */
export async function fetchSuggestions(
  idSession: number,
  checkId: number,
  idCliente?: number,
): Promise<SuggestionResult> {
  const params = new URLSearchParams({
    action: "api_cod_capture_review",
    id: String(idSession),
    op: "suggest",
    check_id: String(checkId),
  });
  if (idCliente) {
    params.set("id_cliente", String(idCliente));
  }

  const response = await http<ApiEnvelope<SuggestionResult>>(
    bffRoute(params),
  );
  return response.data ?? { candidates: [], total: 0, exact: false };
}

/**
 * Free-text shipment lookup, for when the candidate list does not hold the
 * answer and the specialist does.
 *
 * Scoped server-side to the batch's carrier: the same AWB can exist for another
 * one, and matching it there is how money lands on the wrong shipment.
 */
export async function searchShipments(
  idSession: number,
  query: string,
): Promise<SuggestionResult> {
  const params = new URLSearchParams({
    action: "api_cod_capture_review",
    id: String(idSession),
    op: "search",
    q: query,
  });

  const response = await http<ApiEnvelope<SuggestionResult>>(
    bffRoute(params),
  );
  return response.data ?? { candidates: [], total: 0, exact: false };
}

/**
 * Confirm several derived matches in one action.
 *
 * The batch a specialist actually works: nine return legs they trust, ticked and
 * confirmed together. The server skips any that has no shipment yet rather than
 * forcing one, and reports which went through.
 */
export async function confirmBulk(
  idSession: number,
  checkIds: number[],
): Promise<{ confirmed: number[]; skipped: number[]; count: number }> {
  const response = await http<
    ApiEnvelope<{ confirmed: number[]; skipped: number[]; count: number }>
  >("/api_cod_capture_review", {
    method: "POST",
    body: { id: idSession, op: "confirm_bulk", check_ids: checkIds },
  });

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not confirm the cheques");
  }

  return response.data;
}

/** Sign off a derived match (return leg): it becomes a person's decision. */
export async function confirmCheck(
  idSession: number,
  checkId: number,
): Promise<void> {
  const response = await http<ApiEnvelope<{ confirmed: number }>>(
    "/api_cod_capture_review",
    {
      method: "POST",
      body: { id: idSession, op: "confirm", check_id: checkId },
    },
  );

  if (!response.success) {
    throw new Error(response.error ?? "Could not confirm the cheque");
  }
}

/** Pin a cheque to a shipment by hand. Recorded as `manual`, permanently. */
export async function assignCheck(
  idSession: number,
  checkId: number,
  idSpedizione: number,
  note?: string,
): Promise<ReviewBatch> {
  const response = await http<ApiEnvelope<ReviewBatch>>(
    "/api_cod_capture_review",
    {
      method: "POST",
      body: {
        id: idSession,
        op: "assign",
        check_id: checkId,
        id_spedizione: idSpedizione,
        ...(note ? { note } : {}),
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not assign the shipment");
  }

  return response.data;
}

/**
 * Run the matching again over the batch.
 *
 * For when the operator corrected a misread document on the phone and it now
 * resolves. Rows a person already ruled on are left alone by the server.
 *
 * `idFornitore` re-runs it against a DIFFERENT carrier and repoints the batch.
 * Matching is scoped by carrier, so a batch opened under the wrong one returns
 * not_found on every document while the shipments sit there under the right
 * one — and re-running with the same carrier just asks the same question again.
 * Omit it to re-match against the carrier the batch already has.
 */
export async function rematchBatch(
  idSession: number,
  idFornitore?: number,
): Promise<ReviewBatch & { updated: number }> {
  const response = await http<ApiEnvelope<ReviewBatch & { updated: number }>>(
    "/api_cod_capture_review",
    {
      method: "POST",
      body: {
        id: idSession,
        op: "rematch",
        ...(idFornitore ? { id_fornitore: idFornitore } : {}),
      },
    },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not re-run the matching");
  }

  return response.data;
}

/**
 * Approve the batch: what a person ruled on becomes the shipments' record.
 *
 * Divergences come back rather than being fixed. A gap between the cheques and
 * the invoiced COD means the carrier settled a different amount — a business
 * conversation, not a number to quietly overwrite.
 */
export async function approveBatch(idSession: number): Promise<ApplyReport> {
  const response = await http<ApiEnvelope<ApplyReport>>(
    "/api_cod_capture_review",
    { method: "POST", body: { id: idSession, op: "approve" } },
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? "Could not approve the batch");
  }

  return response.data;
}
