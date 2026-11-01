import { describe, expect, it } from "vitest";
import { toolLabelKey, toolLabelKeys } from "./toolLabels";
import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import it_ from "../locales/it.json";
import nl from "../locales/nl.json";

const CONTRACT_TOOLS = [
  "listShipments",
  "trackShipment",
  "searchAddressBook",
  "getShipment",
  "listCargo",
  "countShipments",
  "getTrackingEvents",
  "getShipmentDocuments",
  "navigateTo",
  "proposeCreateShipment",
  "proposeEditCargoShipment",
  "proposeCancelCargoShipment",
  "proposeCancelExpressShipment",
];
const LOCALES = { es, en, it: it_, de, nl } as Record<
  string,
  { copilot: { tools: Record<string, string>; errors: Record<string, string> } }
>;

describe("toolLabelKey", () => {
  it.each(CONTRACT_TOOLS)("%s tiene clave propia", (name) => {
    expect(toolLabelKey(name)).toBe(`copilot.tools.${name}`);
  });

  it("desconocidos y valores raros caen al texto generico, nunca al nombre crudo", () => {
    for (const raw of [
      "dropDatabase",
      "",
      "__proto__",
      "constructor",
      null,
      undefined,
      7,
      {},
    ]) {
      expect(toolLabelKey(raw)).toBe("copilot.tools.unknown");
    }
  });

  it("deduplica y conserva el orden", () => {
    expect(
      toolLabelKeys([
        { name: "proposeCancelCargoShipment" },
        { name: "x" },
        { name: "y" },
        { name: "proposeCancelCargoShipment" },
      ]),
    ).toEqual([
      "copilot.tools.proposeCancelCargoShipment",
      "copilot.tools.unknown",
    ]);
  });
});

describe("i18n de herramientas y errores de IA", () => {
  it.each(Object.keys(LOCALES))(
    "%s: todas las herramientas + unknown, sin nombre tecnico",
    (loc) => {
      const tools = LOCALES[loc].copilot.tools;
      expect(Object.keys(tools).sort()).toEqual(
        [...CONTRACT_TOOLS, "unknown"].sort(),
      );
      for (const name of CONTRACT_TOOLS) {
        expect(tools[name]).toBeTruthy();
        expect(tools[name]).not.toBe(name);
        expect(tools[name]).not.toMatch(
          /^(propose|get|list|count|track|search|navigate)[A-Z]/,
        );
      }
      expect(tools.unknown).toBeTruthy();
    },
  );

  it.each(Object.keys(LOCALES))("%s: mensajes de error de IA", (loc) => {
    const e = LOCALES[loc].copilot.errors;
    for (const k of ["ai_not_configured", "ai_unavailable", "ai_budget"]) {
      expect(e[k]).toBeTruthy();
    }
    expect(
      new Set([e.ai_not_configured, e.ai_unavailable, e.ai_budget]).size,
    ).toBe(3);
  });
});
