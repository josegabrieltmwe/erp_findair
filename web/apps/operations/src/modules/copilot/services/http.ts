/**
 * Minimal HTTP client for the Copilot SPA.
 *
 * basePath comes from the PHP-injected bootstrap (window.__TMWE_OPERATIONS__),
 * falling back to the canonical ERP path. Requests are same-origin and carry
 * the session cookie (the copilot_chat endpoint uses hybrid auth).
 */
function basePath(): string {
  return (
    (typeof window !== "undefined" && window.__TMWE_OPERATIONS__?.basePath) ||
    "/bff/v1"
  );
}

export async function postJson<T>(action: string, body: unknown): Promise<T> {
  const url = `${basePath()}/${action}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    // Session expired → bounce to login (same pattern as other SPAs).
    window.location.href = "/erp/";
    throw new Error("unauthenticated");
  }

  const data = (await res.json()) as T;
  if (!res.ok) {
    const msg = (data as { message?: string })?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
