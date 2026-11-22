import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const listMock = vi.fn();
const supplierListMock = vi.fn();
vi.mock("../services/invoice.service", () => ({
  invoiceService: { list: (...a: unknown[]) => listMock(...a) },
}));
vi.mock("../services/supplierInvoice.service", () => ({
  supplierInvoiceApi: { list: (...a: unknown[]) => supplierListMock(...a) },
}));

import { useInvoiceListStore } from "./invoice_list.store";

beforeEach(() => {
  setActivePinia(createPinia());
  listMock.mockReset();
  supplierListMock.mockReset();
  listMock.mockResolvedValue({ items: [], total: 0, aggregates: undefined });
  supplierListMock.mockResolvedValue({ items: [], total: 0 });
});

// F9 (paridad visual legacy fatt_list.php): totales + "Riepilogo per cliente/agente".
describe("useInvoiceListStore — aggregates", () => {
  it("fetch pide los agregados junto con la primera página, en tab emitidas", async () => {
    listMock.mockResolvedValue({
      items: [],
      total: 0,
      aggregates: {
        summary: [{ valuta_sigla: "EUR", count: 2, costo_netto: 10, importo_netto: 20, importo_iva: 4, margine_pct: 100 }],
      },
    });
    const s = useInvoiceListStore();
    await s.fetch();

    expect(listMock).toHaveBeenCalledTimes(2);
    const aggCall = listMock.mock.calls.find(
      ([f]) => (f as Record<string, unknown>).include,
    );
    expect(aggCall?.[0]).toMatchObject({
      include: "summary,by_client,by_agent",
      per_page: 1,
    });
    expect(s.aggregates?.summary?.[0].count).toBe(2);
  });

  it("setFilters vuelve a pedir los agregados; loadPage/setSort no", async () => {
    const s = useInvoiceListStore();
    await s.fetch();
    listMock.mockClear();

    await s.loadPage(2);
    expect(listMock.mock.calls.every(([f]) => !(f as Record<string, unknown>).include)).toBe(true);

    listMock.mockClear();
    s.setSort("numero", "ASC");
    await new Promise((r) => setTimeout(r, 0));
    expect(listMock.mock.calls.every(([f]) => !(f as Record<string, unknown>).include)).toBe(true);

    listMock.mockClear();
    s.setFilters({ numero: "123" });
    await new Promise((r) => setTimeout(r, 0));
    expect(listMock.mock.calls.some(([f]) => (f as Record<string, unknown>).include)).toBe(true);
  });

  it("en la pestaña de recibidas (P) no se piden agregados", async () => {
    const s = useInvoiceListStore();
    s.setTab("P");
    await new Promise((r) => setTimeout(r, 0));

    expect(s.aggregates).toBeUndefined();
    expect(supplierListMock).toHaveBeenCalled();
    expect(listMock.mock.calls.some(([f]) => (f as Record<string, unknown>).include)).toBe(false);
  });

  it("un fallo al pedir agregados no rompe la carga de la página", async () => {
    listMock.mockImplementation((f: Record<string, unknown>) =>
      f.include
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ items: [{ id: 1 }], total: 1 }),
    );
    const s = useInvoiceListStore();
    await s.fetch();

    expect(s.rows).toHaveLength(1);
    expect(s.aggregates).toBeUndefined();
  });
});
