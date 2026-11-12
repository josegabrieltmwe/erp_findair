/**
 * Store de «Da fare oggi»: contadores especiales (sin KPI propio) y último valor bueno.
 *
 * - Cada fuente se pide por separado y un fallo solo afecta a sus tarjetas (`null` = «n/d»).
 * - Todas son peticiones de conteo (ver `countRequests`): la home nunca pide listados.
 * - El último valor bueno de cada tarjeta se guarda en `localStorage` con su hora: al volver a
 *   la home (o recargar) se enseña de inmediato mientras llega el dato fresco.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { SPECIAL_SOURCES } from "./today_special.service";

const STORAGE_KEY = "tmwe_today_v1";
/** Cuánto vale un dato especial antes de volver a pedirlo al entrar en la home. */
const FRESH_MS = 3 * 60_000;
const SOURCE_TIMEOUT_MS = 60_000;

interface Stored {
  at: number;
  values: Record<string, number>;
}

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { at: 0, values: {} };
    const parsed = JSON.parse(raw) as Stored;
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed?.values ?? {}))
      if (typeof v === "number" && Number.isFinite(v)) values[k] = v;
    return { at: Number(parsed?.at) || 0, values };
  } catch {
    return { at: 0, values: {} };
  }
}

function writeStored(stored: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* modo privado o cuota llena: la home funciona igual sin memoria */
  }
}

export const useTodayStore = defineStore("today", () => {
  const initial = readStored();
  const special = ref<Record<string, number | null>>({});
  const cached = ref<Record<string, number>>(initial.values);
  /** Hora (ms) del último guardado de valores buenos; null si no hay. */
  const cachedAt = ref<number | null>(initial.at || null);
  const inFlight = new Set<string>();
  const lastLoadedAt = ref(0);
  const loadingSpecial = ref(0);
  const controllers = new Set<AbortController>();

  const busy = computed(() => loadingSpecial.value > 0);

  async function runSource(
    name: string,
    source: {
      keys: readonly string[];
      fetch: (s?: AbortSignal) => Promise<Record<string, number>>;
    },
  ): Promise<void> {
    if (inFlight.has(name)) return;
    inFlight.add(name);
    loadingSpecial.value += 1;
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    try {
      const values = await source.fetch(controller.signal);
      special.value = { ...special.value, ...values };
    } catch (error) {
      console.debug("[today] fuente sin respuesta", name, error);
      const failed: Record<string, null> = {};
      for (const key of source.keys) failed[key] = null;
      special.value = { ...special.value, ...failed };
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
      inFlight.delete(name);
      loadingSpecial.value -= 1;
    }
  }

  /**
   * Pide los contadores especiales de las tarjetas visibles. `wanted` son las claves de tarjeta;
   * una fuente solo se pide si alguna de sus claves está en `wanted`.
   */
  async function loadSpecial(
    wanted: ReadonlySet<string>,
    force = false,
  ): Promise<void> {
    if (!force && Date.now() - lastLoadedAt.value < FRESH_MS) return;
    lastLoadedAt.value = Date.now();
    // Todas son peticiones de conteo (una fila como mucho): salen a la vez, cada una aislada de las demás.
    await Promise.all(
      Object.entries(SPECIAL_SOURCES)
        .filter(([, source]) => source.keys.some((k) => wanted.has(k)))
        .map(([name, source]) => runSource(name, source)),
    );
  }

  /** Guarda los valores ya resueltos como «último valor bueno». */
  function remember(values: Record<string, number>): void {
    if (Object.keys(values).length === 0) return;
    const merged = { ...cached.value, ...values };
    const at = Date.now();
    cached.value = merged;
    cachedAt.value = at;
    writeStored({ at, values: merged });
  }

  function reset(): void {
    for (const c of controllers) c.abort();
    special.value = {};
    lastLoadedAt.value = 0;
  }

  return { special, cached, cachedAt, busy, loadSpecial, remember, reset };
});
