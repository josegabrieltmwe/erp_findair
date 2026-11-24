/**
 * Extracción por IA (`api_ai_extract` / `api_ai_extract_status`, tmwe_api), para prellenar una expedición
 * express o cargo a partir de texto, imagen, PDF o `.docx` — docs/plan-extraccion-ia-erp.md §2.1/§2.2.
 *
 * Contrato de ENTRADA confirmado contra `tmwe_api/docs/03-diseno/extraccion_ia_formatos/PLAN.md:22`:
 * `{text}` | `{content, mime_type, filename}` (base64 sin el prefijo `data:`), más `extraction_mode`.
 *
 * Contrato de SALIDA: no se verificó directamente contra `tmwe_api` en este cambio (sin acceso a un entorno
 * en ejecución). Los nombres de campo de abajo son la mejor hipótesis a partir de cómo los consume Findair,
 * otro cliente del mismo endpoint (`findair/frontend/v2/groups/ai/*`) — `parseResult()` es deliberadamente
 * tolerante (varias claves candidatas) para no romperse por un nombre exacto distinto, pero **hay que
 * confirmar el contrato real en sandbox (fase C2 del plan) antes de dar esta pieza por probada**.
 */
import { http } from "../anagrafiche/services/http";

export type AiExtractMode = "express" | "cargo";

export interface AiExtractFileInput {
  /** Base64 sin el prefijo `data:...;base64,`. */
  content: string;
  mimeType: string;
  filename: string;
}

export interface AiExtractInput {
  mode: AiExtractMode;
  /** Texto pegado por el usuario. Mutuamente excluyente con `file` (solo uno por extracción). */
  text?: string;
  file?: AiExtractFileInput;
  /** Si se aborta (p. ej. el usuario sale del chat), se deja de hacer polling; no cancela el job en el backend. */
  signal?: AbortSignal;
}

export interface AiExtractResult {
  /** Campos extraídos, forma libre (no tipada: cada módulo interpreta lo que le interesa). */
  extracted: Record<string, unknown>;
  confidence?: number;
  warnings: string[];
  missingFields: string[];
}

export type AiExtractErrorKind =
  | "budget_exhausted" // 429: presupuesto de IA (feature=extract) agotado
  | "unavailable" // 503/504: worker sin consumidor o tiempo agotado
  | "no_data" // 200/done sin nada útil que extraer
  | "unknown";

export class AiExtractError extends Error {
  constructor(
    message: string,
    readonly kind: AiExtractErrorKind,
  ) {
    super(message);
    this.name = "AiExtractError";
  }
}

interface AiExtractQueued {
  status: "waiting";
  request_id: number;
  poll_after_ms?: number;
}

interface AiExtractState {
  status: string;
  request_id: number;
  result?: unknown;
  error?: { code?: string; message?: string };
  poll_after_ms?: number;
}

/** Mismo orden de magnitud que el chat (COPILOT_ASYNC), pero más corto: aquí no hay conversación que seguir. */
const POLL = { maxDurationMs: 2 * 60_000, defaultPollMs: 1000, minPollMs: 300 };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isQueued(v: unknown): v is AiExtractQueued {
  const r = v as Partial<AiExtractQueued> | null;
  return !!r && r.status === "waiting" && typeof r.request_id === "number";
}

function firstRecord(r: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const k of keys) {
    if (isRecord(r[k])) return r[k] as Record<string, unknown>;
  }
  return {};
}

function firstStringArray(r: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = r[k];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function parseResult(raw: unknown): AiExtractResult {
  const r = isRecord(raw) ? raw : {};
  const extracted = firstRecord(r, ["extracted_data", "data", "fields", "mapped_data"]);
  if (Object.keys(extracted).length === 0) {
    throw new AiExtractError("La extracción no devolvió ningún campo utilizable.", "no_data");
  }
  const confidence =
    typeof r.confidence === "number"
      ? r.confidence
      : typeof r.score === "number"
        ? r.score
        : undefined;
  return {
    extracted,
    confidence,
    warnings: firstStringArray(r, ["warnings"]),
    missingFields: firstStringArray(r, ["missing_fields", "missing"]),
  };
}

/** Clasifica un error de red/HTTP del cliente `http` compartido en un ApiExtractErrorKind conocido. */
function classify(e: unknown): AiExtractError {
  const status = (e as { status?: unknown })?.status;
  if (status === 429) {
    return new AiExtractError(
      "Se ha agotado el presupuesto de IA para extracción.",
      "budget_exhausted",
    );
  }
  if (status === 503 || status === 504) {
    return new AiExtractError(
      "El servicio de extracción no está disponible. Inténtalo de nuevo en unos minutos.",
      "unavailable",
    );
  }
  return new AiExtractError(
    e instanceof Error ? e.message : "No se pudo extraer el documento.",
    "unknown",
  );
}

function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

async function awaitExtraction(queued: AiExtractQueued, signal?: AbortSignal): Promise<unknown> {
  const started = Date.now();
  let wait = queued.poll_after_ms ?? POLL.defaultPollMs;
  while (Date.now() - started < POLL.maxDurationMs) {
    if (signal?.aborted) throw abortError();
    await sleep(Math.max(POLL.minPollMs, wait));
    if (signal?.aborted) throw abortError();
    const st = await http<AiExtractState>("/api_ai_extract_status", {
      method: "GET",
      query: { request_id: queued.request_id },
      signal,
    });
    if (st.status === "done") return st.result;
    if (st.status !== "running") {
      throw new AiExtractError(
        st.error?.message ?? "La extracción no terminó correctamente.",
        "unavailable",
      );
    }
    wait = st.poll_after_ms ?? POLL.defaultPollMs;
  }
  throw new AiExtractError("La extracción no terminó a tiempo.", "unavailable");
}

/**
 * Extrae campos de expedición de un texto o de un fichero (imagen/PDF/docx ya en base64).
 * Nunca escribe nada: solo devuelve campos para que quien llama decida qué hacer con ellos.
 */
export async function extractShipment(input: AiExtractInput): Promise<AiExtractResult> {
  const body: Record<string, unknown> = { extraction_mode: input.mode, async: true };
  if (input.file) {
    body.content = input.file.content;
    body.mime_type = input.file.mimeType;
    body.filename = input.file.filename;
  } else if (input.text) {
    body.text = input.text;
  } else {
    throw new AiExtractError("Nada que extraer: falta texto o fichero.", "no_data");
  }

  try {
    const first = await http<unknown>("/api_ai_extract", {
      method: "POST",
      body,
      signal: input.signal,
    });
    const result = isQueued(first) ? await awaitExtraction(first, input.signal) : first;
    return parseResult(result);
  } catch (e) {
    if (e instanceof AiExtractError) throw e;
    if ((e as { name?: unknown })?.name === "AbortError") throw e;
    throw classify(e);
  }
}
