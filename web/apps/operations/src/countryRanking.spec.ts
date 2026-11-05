import { describe, expect, it } from "vitest";
import { rankCountries } from "@shared/anagrafiche/utils/countryRanking";
import type { PaeseOption } from "@shared/anagrafiche/services/paesi.service";

// Catálogo como llega de get-api-countries: nombre italiano + inglés, ordenado por nombre italiano.
const CATALOG: PaeseOption[] = [
  { id: 1, ISO: "SA", nome: "Arabia Saudita", nomeEN: "Saudi Arabia" },
  { id: 2, ISO: "VA", nome: "Città del Vaticano", nomeEN: "Vatican City" },
  { id: 3, ISO: "EG", nome: "Egitto", nomeEN: "Egypt" },
  { id: 4, ISO: "DE", nome: "Germania", nomeEN: "Germany" },
  { id: 5, ISO: "IT", nome: "Italia", nomeEN: "Italy" },
  { id: 6, ISO: "IL", nome: "Israele", nomeEN: "Israel" },
  { id: 7, ISO: "ES", nome: "Spagna", nomeEN: "Spain" },
];

describe("rankCountries", () => {
  it("«IT» → Italia primero (ISO exacto)", () => {
    const r = rankCountries(CATALOG, "IT", "it");
    expect(r[0].iso).toBe("IT");
    expect(r[0].score).toBe(0);
  });

  it("«it» en minúsculas → IT primero", () => {
    expect(rankCountries(CATALOG, "it", "es")[0].iso).toBe("IT");
  });

  it("«ital» → Italia (nombre que empieza por)", () => {
    const r = rankCountries(CATALOG, "ital", "it");
    expect(r[0].iso).toBe("IT");
    expect(r[0].name).toBe("Italia");
  });

  it("locale es → nombres en español", () => {
    const r = rankCountries(CATALOG, "", "es");
    const byIso = Object.fromEntries(r.map((c) => [c.iso, c.name]));
    expect(byIso.IT).toBe("Italia");
    expect(byIso.SA).toBe("Arabia Saudí");
    expect(byIso.DE).toBe("Alemania");
  });

  it("sin búsqueda: todos, por nombre en el idioma de la UI", () => {
    const r = rankCountries(CATALOG, "", "es");
    expect(r).toHaveLength(CATALOG.length);
    expect(r[0].name).toBe("Alemania");
  });

  it("ignora acentos y busca también en el nombre del catálogo", () => {
    expect(rankCountries(CATALOG, "espana", "es")[0].iso).toBe("ES");
    expect(rankCountries(CATALOG, "germania", "es")[0].iso).toBe("DE");
  });

  it("subcadena queda detrás de los prefijos y excluye lo que no coincide", () => {
    const r = rankCountries(CATALOG, "it", "it");
    const isos = r.map((c) => c.iso);
    expect(isos[0]).toBe("IT");
    expect(isos).not.toContain("DE");
    // Città del Vaticano / Arabia Saudita contienen «it» solo como subcadena.
    expect(r.find((c) => c.iso === "VA")?.score).toBe(3);
  });
});
