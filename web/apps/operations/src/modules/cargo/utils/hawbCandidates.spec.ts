import { describe, expect, it } from "vitest";
import {
  candidateLabel,
  loadPickItems,
  typedShipmentNumber,
} from "./hawbCandidates";

const label = (id: number) => `Usar #${id}`;
const fila = { id: "100", RIF_cliente: "REF-1", peso: "2.5", colli: "3" };

describe("hawbCandidates (selector de «Nuevo HAWB»)", () => {
  it("typedShipmentNumber solo acepta dígitos", () => {
    expect(typedShipmentNumber(" 1001087611 ")).toBe(1001087611);
    expect(typedShipmentNumber("12ab")).toBe(0);
    expect(typedShipmentNumber("")).toBe(0);
  });

  it("candidateLabel pinta id, referencia, peso y bultos", () => {
    expect(candidateLabel(fila)).toBe("#100 · REF-1 · 2.5kg · 3c");
    expect(candidateLabel({ id: 7, peso: 0, colli: 1 })).toBe(
      "#7 · 0.0kg · 1c",
    );
  });

  it("con respuesta del API ofrece los candidatos", async () => {
    const r = await loadPickItems(async () => [fila], "", label);
    expect(r.failed).toBe(false);
    expect(r.items).toEqual([{ id: 100, label: "#100 · REF-1 · 2.5kg · 3c" }]);
  });

  it("añade el número tecleado si el API no lo trae (P59)", async () => {
    const r = await loadPickItems(async () => [fila], "555", label);
    expect(r.failed).toBe(false);
    expect(r.items.map((i) => i.id)).toEqual([100, 555]);
    expect(r.items[1].label).toBe("Usar #555");
  });

  it("no duplica el número tecleado si el API ya lo trae", async () => {
    const r = await loadPickItems(async () => [fila], "100", label);
    expect(r.items).toHaveLength(1);
  });

  it("si la búsqueda falla (504) sigue ofreciendo el número tecleado y lo marca como fallida", async () => {
    const r = await loadPickItems(
      () => Promise.reject(new Error("504")),
      "1001087611",
      label,
    );
    expect(r.failed).toBe(true);
    expect(r.items).toEqual([{ id: 1001087611, label: "Usar #1001087611" }]);
  });

  it("si la búsqueda falla y no hay número tecleado, la lista queda vacía y fallida", async () => {
    const r = await loadPickItems(
      () => Promise.reject(new Error("504")),
      "abc",
      label,
    );
    expect(r).toEqual({ items: [], failed: true });
  });
});
