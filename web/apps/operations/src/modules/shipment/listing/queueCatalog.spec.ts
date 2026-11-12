import { describe, expect, it, vi } from "vitest";

vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";
import { queuesForPage } from "@shared/listing/queueCatalog";
import { parseShipmentListQuery } from "@shipment/stores/shipment_list.store";

describe("selector de colas de expediciones", () => {
  const groups = queuesForPage(HOME_KPI_CATALOG, "shipment-list");
  const items = groups.flatMap((g) => g.items);

  it("trae las colas IN antes que las OUT", () => {
    expect(groups[0].section).toBe("operations_in");
  });

  it("incluye la cola por defecto del personal TMWE", () => {
    expect(items.map((i) => i.key)).toContain("dacontr");
  });

  it("solo ofrece colas que el servidor filtra (nunca una lista que no corresponde al número)", () => {
    const filtered = new Set(
      HOME_KPI_CATALOG.filter((k) => k.serverFiltered).map(
        (k) => k.link.query.type,
      ),
    );
    for (const i of items) expect(filtered.has(i.key)).toBe(true);
  });

  it("todas las colas las acepta el listado (si no, normalisedType las degradaría a «all»)", () => {
    for (const i of items) {
      expect(parseShipmentListQuery({ type: i.key }).type, i.key).toBe(i.key);
    }
  });

  it("no repite colas", () => {
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});
