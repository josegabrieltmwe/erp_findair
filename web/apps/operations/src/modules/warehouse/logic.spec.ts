import { describe, expect, it } from "vitest";
import {
  alreadyLoaded,
  clampPendingDays,
  filterPendingClients,
  pendingNotComplete,
  pendingNotWeighed,
  pendingShipmentUnweighed,
  sortPendingClients,
  summarizePending,
  canPrintWaybill,
  createScanGuard,
  driverCounters,
  filterMultiparcel,
  formatDeliveryDate,
  groupOutcomes,
  isManifestSent,
  mapOutcomes,
  normalizeScan,
  parseIdList,
  unweighedCount,
  validateWeighing,
} from "./logic";
import type { CompletenessItem } from "./types";

describe("scan guard", () => {
  it("ignora vacíos y duplicados dentro de 500 ms", () => {
    let t = 1000;
    const g = createScanGuard(500, () => t);
    expect(g.accept("  ")).toBeNull();
    expect(g.accept(" ABC\n")).toBe("ABC");
    t += 200;
    expect(g.accept("ABC")).toBeNull();
    expect(g.accept("XYZ")).toBe("XYZ");
    t += 600;
    expect(g.accept("XYZ")).toBe("XYZ");
  });
  it("normalizeScan recorta", () => {
    expect(normalizeScan("\t 12 \r\n")).toBe("12");
    expect(normalizeScan(null)).toBe("");
  });
});

describe("validateWeighing", () => {
  it("paquete exige kg y 3 medidas > 0 (acepta coma)", () => {
    const r = validateWeighing({ mode: "parcel", kg: "1,5", width: "10", length: "20", height: "30" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ peso: 1.5, dim_a: 10, dim_l: 20, dim_p: 30 });
  });
  it("marca los campos inválidos", () => {
    const r = validateWeighing({ mode: "parcel", kg: "0", width: "", length: "-2", height: "5" });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(["kg", "width", "length"]);
  });
  it("documento solo necesita kg", () => {
    const r = validateWeighing({ mode: "document", kg: "0.3", width: "", length: "", height: "" });
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ peso: 0.3 });
  });
});

describe("impresión de emergencia", () => {
  it("bloquea con bultos sin pesar salvo emergencia", () => {
    const n = unweighedCount({ colli_total: 3, colli_weighed: 1 });
    expect(n).toBe(2);
    expect(canPrintWaybill(n, false)).toBe(false);
    expect(canPrintWaybill(n, true)).toBe(true);
    expect(canPrintWaybill(0, false)).toBe(true);
  });
});

function item(id: number, expected: number, total: number, weighed: number): CompletenessItem {
  return {
    id,
    completeness: {
      expected,
      colli_total: total,
      colli_weighed: weighed,
      colli_printed: 0,
      colli_with_driver: 0,
      status: "incomplete",
    },
  };
}

describe("filterMultiparcel", () => {
  const items = [item(1, 1, 1, 1), item(2, 3, 3, 3), item(3, 3, 3, 1), item(4, 2, 0, 0)];
  it("pesados", () => {
    expect(filterMultiparcel(items, "weighed").map((i) => i.id)).toEqual([2]);
  });
  it("sin pesar", () => {
    expect(filterMultiparcel(items, "unweighed").map((i) => i.id)).toEqual([3, 4]);
  });
});

describe("contadores del autista", () => {
  const parcels = [
    { id: 1, id_spedizione: 10, peso: "1.5", ldv_stampata: "S" },
    { id: 2, id_spedizione: 10, peso: 2, ldv_stampata: "N" },
    { id: 3, id_spedizione: 11, peso: "x" },
  ];
  it("cuenta bultos, envíos distintos, impresos y kg", () => {
    expect(driverCounters(parcels)).toEqual({ parcels: 3, shipments: 2, printed: 1, totalKg: 3.5 });
  });
  it("detecta ya cargados", () => {
    expect(alreadyLoaded(parcels, 2)).toBe(true);
    expect(alreadyLoaded(parcels, 9)).toBe(false);
  });
});

describe("mapOutcomes", () => {
  const statuses = [
    { id: 3, tipo: "T", descr_eng: "In transit" },
    { id: 4, tipo: "C", descr_eng: "Out for delivery" },
    { id: 19, tipo: "D", descr_eng: "Return of the customs declaration" },
    { id: 7, tipo: "D", descr_ita: "Consegnato", descr_eng: "Delivered" },
    { id: 9, tipo: "P", descr_eng: "Cancelled", stato: "O" },
    { id: 5, tipo: "P", apri_giac: "S", descr_eng: "Absent" },
    { id: 6, tipo: "P", apri_giac: "N", descr_eng: "Address closed" },
    { id: 8, tipo: "R", apri_giac: "S", descr_eng: "Return to sender" },
    { id: 11, tipo: "0", descr_eng: "Other" },
    { id: 12, descr_eng: "No tipo" },
  ];
  it("solo entregados y excepciones; entregado 7 primero; ordena por descripcion", () => {
    const out = mapOutcomes(statuses, "en");
    expect(out.map((o) => o.id)).toEqual(["7", "19", "5", "6", "8"]);
    expect(out[0]).toEqual({
      id: "7",
      label: "Delivered",
      delivered: true,
      group: "delivered",
      opensHold: false,
    });
  });
  it("marca opensHold solo en excepciones con apri_giac S", () => {
    const out = mapOutcomes(statuses, "en");
    const hold = Object.fromEntries(out.map((o) => [o.id, o.opensHold]));
    expect(hold).toEqual({ 7: false, 19: false, 6: false, 5: true, 8: true });
  });
  it("usa la descripcion del idioma", () => {
    expect(mapOutcomes(statuses, "it-IT")[0].label).toBe("Consegnato");
  });
});

describe("groupOutcomes", () => {
  const labels = { delivered: "D", exceptions: "E", holdNote: "hold" };
  it("agrupa con cabeceras y nota de retencion", () => {
    const items = groupOutcomes(
      mapOutcomes(
        [
          { id: 7, tipo: "D", descr_eng: "Delivered" },
          { id: 5, tipo: "P", apri_giac: "S", descr_eng: "Absent" },
          { id: 6, tipo: "P", descr_eng: "Closed" },
        ],
        "en",
      ),
      labels,
    );
    expect(items).toEqual([
      { type: "subheader", title: "D" },
      { title: "Delivered", value: "7" },
      { type: "subheader", title: "E" },
      { title: "Absent (hold)", value: "5" },
      { title: "Closed", value: "6" },
    ]);
  });
  it("omite grupos vacios", () => {
    const items = groupOutcomes(
      mapOutcomes([{ id: 7, tipo: "D", descr_eng: "Delivered" }], "en"),
      labels,
    );
    expect(items.map((i) => i.title)).toEqual(["D", "Delivered"]);
  });
});

describe("utilidades", () => {
  it("formatDeliveryDate", () => {
    expect(formatDeliveryDate("2026-10-04", "09:05")).toBe("2026-10-04 09:05:00");
  });
  it("parseIdList deduplica y descarta basura", () => {
    expect(parseIdList("12, 13\n13 abc 0 14;15")).toEqual([12, 13, 14, 15]);
  });
  it("isManifestSent", () => {
    expect(isManifestSent(null)).toBe(false);
    expect(isManifestSent("0000-00-00 00:00:00")).toBe(false);
    expect(isManifestSent("2026-10-01 10:00:00")).toBe(true);
  });
});

describe("pendientes por cliente", () => {
  const c = (id: number, rag_soc: string, unweighed: number, unprinted = 0, shipments = 1) => ({
    id_cliente: id, rag_soc, shipments, parcels: 2, unweighed, unprinted,
  });
  const sh = (o: Partial<import("./types").PendingShipment> = {}) => ({
    id: 1, declared_parcels: 2, parcels: 2, weighed: 2, unprinted: 2,
    complete: true, all_weighed: true, ...o,
  });
  it("sortPendingClients: más sin pesar primero y no muta", () => {
    const src = [c(1, "B", 1), c(2, "A", 5), c(3, "C", 1, 4)];
    expect(sortPendingClients(src).map((x) => x.id_cliente)).toEqual([2, 3, 1]);
    expect(src[0].id_cliente).toBe(1);
  });
  it("filterPendingClients: sin acentos ni mayúsculas", () => {
    const src = [c(1, "Café Ñandú SL", 1), c(2, "Otro", 1)];
    expect(filterPendingClients(src, " CAFE ")).toHaveLength(1);
    expect(filterPendingClients(src, "")).toHaveLength(2);
  });
  it("summarizePending", () => {
    expect(summarizePending([c(1, "A", 2, 0, 3), c(2, "B", 1, 0, 4)])).toEqual({
      customers: 2, shipments: 7, unweighed: 3,
    });
    expect(summarizePending([])).toEqual({ customers: 0, shipments: 0, unweighed: 0 });
  });
  it("condiciones ámbar", () => {
    expect(pendingNotComplete(sh())).toBe(false);
    expect(pendingNotComplete(sh({ complete: false }))).toBe(true);
    expect(pendingNotComplete(sh({ parcels: 1 }))).toBe(true);
    expect(pendingNotWeighed(sh())).toBe(false);
    expect(pendingNotWeighed(sh({ all_weighed: false }))).toBe(true);
    expect(pendingNotWeighed(sh({ weighed: 1 }))).toBe(true);
    expect(pendingShipmentUnweighed(sh({ weighed: 1 }))).toBe(1);
    expect(pendingShipmentUnweighed(sh({ weighed: 5 }))).toBe(0);
  });
  it("clampPendingDays", () => {
    expect(clampPendingDays(0)).toBe(1);
    expect(clampPendingDays(99)).toBe(60);
    expect(clampPendingDays(NaN)).toBe(7);
    expect(clampPendingDays(14)).toBe(14);
  });
});
