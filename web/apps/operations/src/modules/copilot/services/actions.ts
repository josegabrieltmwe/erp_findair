/**
 * Materializes UI actions emitted by the Copilot backend (actions[]).
 *
 * The Copilot SPA is a standalone screen; navigating to an ERP list/detail is a
 * full-page navigation (a different SPA), so we use window.location. List
 * filters are forwarded as query params; the target listing SPA reads them.
 *
 * Whitelisted action types only — anything unknown is ignored (defensive: the
 * LLM must not be able to drive arbitrary navigation).
 */
import type { CopilotAction } from "../types";

const ALLOWED_FILTER_KEYS = [
  "period",
  "date_from",
  "date_to",
  "status",
  "id_cliente",
];

/** Run the first navigation action (if any). Multiple navigations make no sense. */
export function runActions(actions: CopilotAction[]): void {
  const nav = actions.find((a) => a.type === "navigate");
  if (nav) {
    navigate(nav);
  }
}

function navigate(action: CopilotAction): void {
  const path = typeof action.path === "string" ? action.path : "";
  if (!path || !path.startsWith("/erp/tmwe_json/")) {
    return; // defensive: only same-app ERP paths
  }

  const filters = (action.filters ?? {}) as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const key of ALLOWED_FILTER_KEYS) {
    const v = filters[key];
    if (v !== undefined && v !== null && `${v}` !== "") {
      params.set(key, String(v));
    }
  }

  const qs = params.toString();
  // Small delay so the user sees the assistant's confirmation bubble first.
  window.setTimeout(() => {
    window.location.href = qs ? `${path}?${qs}` : path;
  }, 600);
}
