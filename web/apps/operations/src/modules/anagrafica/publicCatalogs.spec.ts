import { describe, expect, it } from "vitest";
import { countriesFromPublic, currenciesFromPublic } from "../../../../../packages/platform/anagrafiche/services/publicCatalogs";

describe("catálogo público de países", () => {
  const raw = [
    { iso: "NL", nome: "Paesi Bassi", name: "Netherlands" },
    { iso: "IT", nome: "Italia", name: "Italy" },
    { iso: "", nome: "Vacío", name: "Empty" },
    { iso: "USA", nome: "Largo", name: "Too long" },
  ];

  it("usa ISO como valor, descarta códigos que no son de 2 letras y ordena por nombre", () => {
    const r = countriesFromPublic(raw);
    expect(r.map((c) => c.ISO)).toEqual(["IT", "NL"]);
    expect(r[0]).toMatchObject({ ISO: "IT", ISO2: null, nome: "Italia", nomeEN: "Italy" });
  });

  it("acepta un envoltorio {data} y tolera respuestas vacías o inválidas", () => {
    expect(countriesFromPublic({ data: raw })).toHaveLength(2);
    expect(countriesFromPublic(null)).toEqual([]);
    expect(countriesFromPublic({ error: "x" })).toEqual([]);
  });

  it("conserva usa_cap/usa_prov (cap_enabled/prov_enabled) para validar direcciones", () => {
    const [c] = countriesFromPublic([{ iso: "it", nome: "Italia", name: "Italy", cap_enabled: "S", prov_enabled: "s" }]);
    expect(c).toMatchObject({ ISO: "IT", cap_enabled: "S", prov_enabled: "S" });
    expect(countriesFromPublic([{ iso: "IE", nome: "Irlanda" }])[0]).not.toHaveProperty("cap_enabled");
  });

  it("si falta el nombre local usa el inglés", () => {
    expect(countriesFromPublic([{ iso: "de", name: "Germany" }])[0]).toMatchObject({ ISO: "DE", nome: "Germany" });
  });
});

describe("catálogo público de monedas", () => {
  it("convierte el id a número, ordena por sigla y descarta AAA y filas sin id válido", () => {
    const r = currenciesFromPublic([
      { id: "2", sigla: "USD", nome: "US Dollars" },
      { id: "1", sigla: "EUR", nome: "Euro" },
      { id: "9", sigla: "AAA" },
      { id: "x", sigla: "BAD" },
      { id: "3", sigla: "" },
    ]);
    expect(r.map((c) => [c.id, c.sigla])).toEqual([
      [1, "EUR"],
      [2, "USD"],
    ]);
  });
});
