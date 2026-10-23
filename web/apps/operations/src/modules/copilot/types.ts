/** Canonical message kept in the conversation history sent to the backend. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A tool the backend reported having executed for a turn. */
export interface ToolUsed {
  name: string;
  arguments: Record<string, unknown>;
}

/** A UI action emitted by the backend (`navigateTo`). `route` is a SPA route name from a closed list. */
export interface CopilotAction {
  type: string;
  [key: string]: unknown;
}

/** Write actions the backend can propose (closed list; anything else is dropped). */
export type ProposalAction =
  | "create_shipment"
  | "edit_cargo"
  | "cancel_cargo"
  | "cancel_express";

export type ProposalRisk = "medium" | "high";

/** Optional cost line. The current backend payloads carry no costs; shown if they ever do (partners see costs). */
export interface ProposalCost {
  label?: string;
  amount: string | number;
  currency?: string;
}

/**
 * `proposals[0]` of copilot_chat. `payload` is signed server-side (sha256 of its JSON):
 * it must be sent back EXACTLY as received, so it is kept untouched and deep-frozen.
 */
export interface CopilotProposal {
  type: "confirm_proposal";
  proposal_id: string;
  token: string;
  action: ProposalAction;
  ruta: string;
  risk: ProposalRisk;
  reinforced_confirmation: boolean;
  draft: boolean;
  target: {
    kind: "express" | "cargo";
    id: number | null;
    awb: string | null;
    reference: string | null;
  };
  payload: Readonly<Record<string, unknown>>;
  expires_at: string;
  expires_in: number;
  costs?: ProposalCost[];
}

/** Body of POST api_copilot_write_proposal (op=confirmar). */
export interface ConfirmRequest {
  op: "confirmar";
  token: string;
  payload_override: Readonly<Record<string, unknown>>;
}

export type ReadbackStatus = "verified" | "mismatch" | "unverified";

/** Response shape of POST api_copilot_write_proposal (HTTP 200). */
export interface ConfirmResponse {
  success?: boolean;
  executed?: boolean;
  result?: {
    success?: boolean;
    http_status?: number;
    error?: unknown;
    data?: unknown;
  };
  readback?: { status?: string; not_compared?: unknown };
}

/** Response shape of POST copilot_chat. */
export interface CopilotChatResponse {
  answer: string;
  actions: CopilotAction[];
  provider: string;
  model: string;
  tools_used: ToolUsed[];
  usage: { input: number; output: number };
  conversation: unknown[];
  /** 0 or 1 write proposal per turn; validate with parseProposal(). */
  proposals?: unknown[];
}

/** A bubble rendered in the chat transcript. */
export interface ChatBubble {
  id: number;
  role: "user" | "assistant";
  text: string;
  toolsUsed?: ToolUsed[];
  error?: boolean;
  /** i18n key for a known error (rate limit, busy…); `text` keeps the raw message as fallback. */
  errorKey?: string;
  pending?: boolean;
  /** Confirmation card state for this assistant turn. */
  proposal?: ProposalView;
}

export type ProposalStatus =
  | "pending"
  | "confirming"
  | "verified"
  | "unverified"
  | "mismatch"
  | "rejected"
  | "error"
  | "dismissed";

/** Reactive card state kept in the store (survives navigating away from the chat). */
export interface ProposalView {
  proposal: CopilotProposal;
  /** Date.now() when the proposal arrived: the countdown is relative to it (immune to clock skew). */
  receivedAt: number;
  status: ProposalStatus;
  /** Real outcome details once the backend answered. */
  outcome?: {
    httpStatus?: number;
    error?: string;
    notCompared: string[];
    createdId?: number;
  };
  /** Known error kind (see services/proposal.ts) when status === "error". */
  errorKind?: string;
  /** Whether the user can press Confirm again (transient errors only). */
  retryable?: boolean;
}
