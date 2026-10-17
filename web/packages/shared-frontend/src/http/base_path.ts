/**
 * Shared base-path resolver for the modern SPAs.
 *
 * Historically each app shipped its own `http.ts` whose only per-app concern
 * was reading a different bootstrap global (`window.__TMWE_CARGO__`,
 * `window.__TMWE_SHIPMENT__`, …). That forced services depending on `http`
 * (chat, files, …) to be forked per app even when byte-identical.
 *
 * This resolver reads whichever `__TMWE_*__.basePath` the host page injected,
 * so a single shared http client works across every app. Apps that still want
 * an app-specific override can pass their own resolver to `createHttpClient`.
 */

/** Bootstrap globals injected by the host PHP page, in priority order. */
const KNOWN_GLOBALS = [
  '__TMWE_CARGO__',
  '__TMWE_SHIPMENT__',
  '__TMWE_ADMIN__',
  '__TMWE_HOME__',
  '__TMWE_APP__',
] as const;

export const DEFAULT_BASE_PATH = '/bff/v1';

interface BootstrapGlobal {
  basePath?: string;
  language?: string;
}

/**
 * Resolve the API base path from any known bootstrap global, falling back to
 * {@link DEFAULT_BASE_PATH}. Safe to call in non-browser contexts (SSR/tests).
 */
export function resolveBasePath(): string {
  if (typeof window === 'undefined') return DEFAULT_BASE_PATH;
  const w = window as unknown as Record<string, BootstrapGlobal | undefined>;
  for (const key of KNOWN_GLOBALS) {
    const bp = w[key]?.basePath;
    if (bp) return bp;
  }
  return DEFAULT_BASE_PATH;
}
