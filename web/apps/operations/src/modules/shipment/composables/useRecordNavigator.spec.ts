import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, computed } from "vue";

/**
 * Dos regresiones del navegador prev/next de `.sdo-nav`:
 *
 *  1. `index` resolvía a -1 (flechas apagadas, sin contador) para
 *     cualquier registro fuera del primer bloque de `PAGE_SIZE` (50)
 *     filas cacheadas, porque `ensureLoaded` solo cargaba la página 1
 *     y nunca buscaba el registro en páginas posteriores.
 *  2. `goNext()` en el borde del bloque cacheado, mientras un prefetch
 *     en background seguía en vuelo, veía `loading=true` y retornaba
 *     al instante sin esperar nada: el click no hacía nada.
 */

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push, currentRoute: { value: { query: {} } } }),
}));

const httpMock = vi.fn();
vi.mock("@shipment/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

vi.mock("@shared/platform/tmweSession", () => ({
  listViewMode: () => null,
}));

vi.mock("@shipment/stores/shipment_list.store", () => ({
  parseShipmentListQuery: () => ({ type: "all" }),
  shipmentListHasActiveFilters: () => true,
}));

type Row = { id: number; cliente?: string };

function pageResponse(rows: Row[], total: number) {
  return { data: rows, pagination: { total } };
}

describe("useRecordNavigator (shipment)", () => {
  // Estado a nivel de módulo (cache, cacheKey…): cada test necesita el
  // módulo recién importado para no heredar el caché del test anterior.
  let useRecordNavigator: typeof import("./useRecordNavigator").useRecordNavigator;

  beforeEach(async () => {
    vi.resetModules();
    push.mockReset();
    httpMock.mockReset();
    ({ useRecordNavigator } = await import("./useRecordNavigator"));
  });

  it("localiza un registro fuera del primer bloque cacheado (página 2+)", async () => {
    // 50 filas en la página 1 (ids 1..50) + 4 más en la página 2 (51..54).
    const page1 = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    const page2 = [{ id: 51 }, { id: 52 }, { id: 53 }, { id: 54 }];
    httpMock
      .mockResolvedValueOnce(pageResponse(page1, 54))
      .mockResolvedValueOnce(pageResponse(page2, 54));

    const currentId = ref<number | null>(53);
    const navigator = useRecordNavigator(computed(() => currentId.value));

    // Antes del fix: index.value quedaba en -1 porque solo se cargaba
    // la página 1 y nunca se buscaba el id en páginas siguientes.
    await navigator.ensureLoaded({}, 53);

    expect(httpMock).toHaveBeenCalledTimes(2);
    expect(navigator.index.value).toBe(52); // posición 0-based del id 53
    expect(navigator.total.value).toBe(54);
    expect(navigator.hasPrev.value).toBe(true);
    expect(navigator.hasNext.value).toBe(true);
  });

  it("un Next explícito en el borde espera el prefetch en background en vez de no hacer nada", async () => {
    // 3 filas cacheadas (ids 1,2,3) de 5 totales: faltan 2 en la página 2.
    httpMock
      .mockResolvedValueOnce(
        pageResponse([{ id: 1 }, { id: 2 }, { id: 3 }], 5),
      )
      .mockResolvedValueOnce(pageResponse([{ id: 4 }, { id: 5 }], 5));

    const currentId = ref<number | null>(null);
    const navigator = useRecordNavigator(computed(() => currentId.value), {
      overlay: true,
    });

    await navigator.ensureLoaded({}, 1);
    currentId.value = 2; // index 1 de 3: a 2 del final → entra la condición de maybePrefetch

    // 1er click: el id 3 ya está cacheado, navega directo y dispara en
    // background (sin esperar) el prefetch de la página 2 — `loading`
    // queda en `true` mientras esa petición está en vuelo.
    navigator.goNext();
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ view: "3" }),
      }),
    );
    currentId.value = 3; // el operador ya está viendo la fila 3 (index 2, la última cacheada)

    // 2º click (explícito): la fila 4 todavía no está en caché y el
    // prefetch de la página 2 sigue en vuelo. Antes del fix, esto veía
    // `loading=true` y retornaba sin esperar ni navegar nunca a la 4.
    navigator.goNext();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Solo una petición de red para la página 2 (no se duplica el fetch
    // al encolar el 2º click detrás del prefetch en background).
    expect(httpMock).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ view: "4" }),
      }),
    );
  });
});
