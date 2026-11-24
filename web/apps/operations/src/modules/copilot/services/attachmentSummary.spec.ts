import { describe, expect, it } from "vitest";
import { summarizeExtraction } from "./attachmentSummary";

describe("summarizeExtraction", () => {
  it("vuelca los campos extraídos como una lista plana con su ruta", () => {
    const text = summarizeExtraction("factura.pdf", {
      extracted: {
        destination: { city: "Milano", postal_code: "20100" },
        parcels: { count: 3 },
      },
      warnings: [],
      missingFields: [],
    });
    expect(text).toContain("factura.pdf");
    expect(text).toContain("- destination.city: Milano");
    expect(text).toContain("- destination.postal_code: 20100");
    expect(text).toContain("- parcels.count: 3");
  });

  it("añade los campos sin leer y los avisos al final", () => {
    const text = summarizeExtraction("x.png", {
      extracted: { weight: 10 },
      warnings: ["peso aproximado"],
      missingFields: ["destination.address"],
    });
    expect(text).toContain(
      "Campos que no se pudieron leer: destination.address.",
    );
    expect(text).toContain("Avisos de la extracción: peso aproximado.");
  });

  it("omite valores vacíos", () => {
    const text = summarizeExtraction("x.png", {
      extracted: { note: "", city: "Roma" },
      warnings: [],
      missingFields: [],
    });
    expect(text).not.toContain("- note:");
    expect(text).toContain("- city: Roma");
  });
});
