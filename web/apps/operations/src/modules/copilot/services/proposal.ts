/**
 * Write proposals of the Copilot (propose -> card -> confirm).
 *
 * Contract: tmwe_json Copilot_Write_Proposal_Controller. The server signs the sha256 of the payload JSON,
 * so the SPA must send `payload_override` EXACTLY as received (same keys, order, types; `weight` is a string).
 * Nothing here edits or reformats the payload. No i18n in this file: it returns keys and plain values.
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  ConfirmRequest,
  ConfirmResponse,
  CopilotProposal,
  ProposalAction,
  ProposalCost,
  ProposalView,
} from "../types";

export const CONFIRM_ENDPOINT = "/api_copilot_write_proposal";

const ACTIONS: readonly ProposalAction[] = [
  "create_shipment",
  "edit_cargo",
  "cancel_cargo",
  "cancel_express",
];

/** Maximum token life in seconds according to the contract (used to cap a bogus `expires_in`). */
export const MAX_EXPIRES_IN = 300;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v);
    }
  }
  return value;
}

function asCosts(raw: unknown): ProposalCost[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProposalCost[] = [];
  for (const c of raw) {
    if (
      isRecord(c) &&
      (typeof c.amount === "string" || typeof c.amount === "number")
    ) {
      out.push({
        amount: c.amount,
        label: typeof c.label === "string" ? c.label : undefined,
        currency: typeof c.currency === "string" ? c.currency : undefined,
      });
    }
  }
  return out.length ? out : undefined;
}

/**
 * Validate `proposals[0]`. Returns null for anything that does not match the contract
 * (the card is then not rendered: it is never built from partial data). The payload object is kept as is.
 */
export function parseProposal(raw: unknown): CopilotProposal | null {
  if (!isRecord(raw) || raw.type !== "confirm_proposal") return null;
  const { token, proposal_id: proposalId, action, ruta, risk, payload } = raw;
  if (typeof token !== "string" || token === "") return null;
  if (typeof proposalId !== "string" || proposalId === "") return null;
  if (typeof action !== "string" || !ACTIONS.includes(action as ProposalAction))
    return null;
  if (typeof ruta !== "string") return null;
  if (risk !== "medium" && risk !== "high") return null;
  if (!isRecord(payload)) return null;
  const target = isRecord(raw.target) ? raw.target : null;
  if (!target || (target.kind !== "express" && target.kind !== "cargo"))
    return null;
  const expiresIn = Number(raw.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  const confirm = isRecord(raw.confirm) ? raw.confirm : null;
  if (confirm && confirm.endpoint !== "api_copilot_write_proposal") return null;

  return {
    type: "confirm_proposal",
    proposal_id: proposalId,
    token,
    action: action as ProposalAction,
    ruta,
    risk,
    // A cancel is always reinforced, whatever the flag says (defense in depth).
    reinforced_confirmation:
      raw.reinforced_confirmation === true || action.startsWith("cancel_"),
    draft: raw.draft === true,
    target: {
      kind: target.kind,
      id:
        typeof target.id === "number" && Number.isInteger(target.id)
          ? target.id
          : null,
      awb: typeof target.awb === "string" && target.awb ? target.awb : null,
      reference:
        typeof target.reference === "string" && target.reference
          ? target.reference
          : null,
    },
    payload: deepFreeze(payload),
    expires_at: typeof raw.expires_at === "string" ? raw.expires_at : "",
    expires_in: Math.min(expiresIn, MAX_EXPIRES_IN),
    costs: asCosts(raw.costs),
  };
}

/** Seconds left (never negative). Relative to the moment the proposal reached the browser. */
export function remainingSeconds(
  receivedAt: number,
  expiresIn: number,
  now: number,
): number {
  return Math.max(0, Math.ceil(expiresIn - (now - receivedAt) / 1000));
}

/** "4:07" style countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Confirm ────────────────────────────────────────────────────────────────

/** Body of the confirm call. `payload_override` is the received payload, same reference. */
export function buildConfirmRequest(p: CopilotProposal): ConfirmRequest {
  return { op: "confirmar", token: p.token, payload_override: p.payload };
}

export async function confirmProposal(
  p: CopilotProposal,
): Promise<ConfirmResponse> {
  return http<ConfirmResponse>(CONFIRM_ENDPOINT, {
    method: "POST",
    body: buildConfirmRequest(p),
  });
}

export type OutcomeStatus = "verified" | "unverified" | "mismatch" | "rejected";

export interface Outcome {
  status: OutcomeStatus;
  httpStatus?: number;
  error?: string;
  notCompared: string[];
  createdId?: number;
}

function plainText(v: unknown): string | undefined {
  if (typeof v === "string") return v.slice(0, 300);
  if (typeof v === "number") return String(v);
  return undefined;
}

/**
 * Interpret a 200 answer. ONLY `executed === true` AND `readback.status === "verified"` is a confirmed write.
 * Anything else is reported as NOT confirmed with the real state:
 *  - executed:false          -> the ERP rejected it (the proposal is spent: propose again)
 *  - readback mismatch       -> the ERP said OK but what it holds differs from what was asked
 *  - readback unverified/…   -> executed, could not be checked
 */
export function interpretConfirmResponse(res: unknown): Outcome {
  const r = isRecord(res) ? (res as ConfirmResponse) : {};
  const result = isRecord(r.result) ? r.result : {};
  const readback = isRecord(r.readback) ? r.readback : {};
  const notCompared = Array.isArray(readback.not_compared)
    ? readback.not_compared.filter((x): x is string => typeof x === "string")
    : [];

  if (r.executed !== true || r.success === false) {
    return {
      status: "rejected",
      httpStatus:
        typeof result.http_status === "number" ? result.http_status : undefined,
      error: plainText(result.error),
      notCompared,
    };
  }

  let createdId: number | undefined;
  const data = isRecord(result.data) ? result.data : null;
  const inner = data && isRecord(data.data) ? data.data : null;
  if (inner && typeof inner.id === "number") createdId = inner.id;

  const status: OutcomeStatus =
    readback.status === "verified"
      ? "verified"
      : readback.status === "mismatch"
        ? "mismatch"
        : "unverified";
  return {
    status,
    httpStatus:
      typeof result.http_status === "number" ? result.http_status : undefined,
    notCompared,
    createdId,
  };
}

export type ConfirmErrorKind =
  | "payload_mismatch"
  | "operator_mismatch"
  | "expired"
  | "already_executed"
  | "invalid_token"
  | "bad_request"
  | "session"
  | "rate_limited"
  | "busy"
  | "unavailable"
  | "uncertain"
  | "forbidden"
  | "unknown";

export interface ConfirmError {
  kind: ConfirmErrorKind;
  /**
   * A new press of Confirm is safe: the request was rejected before reaching the ERP (BFF limits), so the
   * single-use token is not consumed. Never true when the outcome is unknown (`uncertain`).
   */
  retryable: boolean;
}

/** Lower-cased backend code carried by an ApiError (Problem Details `code`/`error`), or its message. */
export function backendCode(e: unknown): string {
  const err = e as { details?: unknown; code?: unknown; message?: unknown };
  const d = isRecord(err?.details) ? err.details : {};
  for (const c of [d.code, d.error, d.error_code, err?.message]) {
    if (typeof c === "string" && c !== "") return c.toLowerCase();
  }
  return "";
}

/** Map an ApiError (shared http client) to a known kind. Uses the status and the backend code carried by the Problem Details. */
export function classifyConfirmError(e: unknown): ConfirmError {
  const status = (e as { status?: unknown })?.status;
  const code = backendCode(e);
  const make = (kind: ConfirmErrorKind, retryable = false): ConfirmError => ({
    kind,
    retryable,
  });

  switch (code) {
    case "payload_mismatch":
      return make("payload_mismatch");
    case "operator_mismatch":
      return make("operator_mismatch");
    case "expired":
      return make("expired");
    case "already_executed_or_failed":
      return make("already_executed");
    case "invalid_signature":
    case "malformed_token":
      return make("invalid_token");
    case "missing_token_or_payload":
    case "invalid_op":
    case "ruta_no_habilitada":
    case "invalid_body":
      return make("bad_request");
    case "concurrency_limited":
      return make("busy", true);
    case "rate_limited":
      return make("rate_limited", true);
    case "capacity_exceeded":
    case "throttle_unavailable":
      return make("unavailable", true);
    default:
      break;
  }
  if (status === 401) return make("session");
  if (status === 429) return make("rate_limited", true);
  if (status === 403) return make("forbidden");
  // Network failure/timeout (0/undefined) or a 5xx without a pre-send code: the write MAY have happened and the
  // response was lost. A blind retry would burn the single-use token and report a false failure, so no retry:
  // the user must check the shipment list before asking for a new proposal.
  if (
    status === undefined ||
    (typeof status === "number" && (status === 0 || status >= 500))
  )
    return make("uncertain");
  return make("unknown");
}

// ── Human-readable description ────────────────────────────────────────────

export interface DescribedRow {
  /** i18n key under copilot.proposal.fields.*; when absent `label` is a raw field name. */
  labelKey?: string;
  label?: string;
  value: string;
}

const KNOWN_LABELS: Record<string, string> = {
  "destination.name": "name",
  "destination.address": "address",
  "destination.postal_code": "postal_code",
  "destination.city": "city",
  "destination.province": "province",
  "destination.country_code": "country",
  "destination.phone": "phone",
  "destination.email": "email",
  "destination.attention": "attention",
  "shipment.reference": "reference",
  "shipment.notes.courier": "note_courier",
  "parcels.count": "parcels",
  "parcels.weight": "weight",
  "fields.pickup_date": "pickup_date",
  "fields.peso": "weight",
  "fields.colli": "parcels",
  "fields.note": "note",
};

function leafString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "";
  return JSON.stringify(v);
}

function flatten(
  value: unknown,
  path: string,
  out: Array<[string, string]>,
): void {
  if (isRecord(value)) {
    for (const [k, v] of Object.entries(value))
      flatten(v, path ? `${path}.${k}` : k, out);
  } else {
    out.push([path, leafString(value)]);
  }
}

/**
 * Every leaf of the payload as a row: what is shown is what will be sent. Known fields get an i18n label,
 * unknown ones are shown with their raw key (nothing the server signed is hidden). The target (id/AWB/reference)
 * comes first for edits and cancels.
 */
export function describeProposal(p: CopilotProposal): DescribedRow[] {
  const rows: DescribedRow[] = [];
  const t = p.target;
  if (t.id !== null) rows.push({ labelKey: "target_id", value: String(t.id) });
  if (t.awb) rows.push({ labelKey: "target_awb", value: t.awb });
  if (t.reference)
    rows.push({ labelKey: "target_reference", value: t.reference });

  const leaves: Array<[string, string]> = [];
  flatten(p.payload, "", leaves);
  for (const [path, value] of leaves) {
    if (path === "id") continue; // already shown as target
    if (path === "options.auto_route") continue; // expressed by the draft badge
    if (value === "") continue;
    const key = KNOWN_LABELS[path];
    rows.push(key ? { labelKey: key, value } : { label: path, value });
  }
  return rows;
}

export function isCancel(p: CopilotProposal): boolean {
  return p.action === "cancel_cargo" || p.action === "cancel_express";
}

/** Short name of the thing a cancel would hit, for the acknowledgement checkbox. */
export function targetLabel(p: CopilotProposal): string {
  const t = p.target;
  return t.awb ?? t.reference ?? (t.id !== null ? `#${t.id}` : "");
}

export function newView(p: CopilotProposal, now: number): ProposalView {
  return { proposal: p, receivedAt: now, status: "pending" };
}
