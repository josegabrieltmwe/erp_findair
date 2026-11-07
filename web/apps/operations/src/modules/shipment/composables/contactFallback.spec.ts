import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contactFallbackText, fallbacksToIssues, isContactFallbackCode } from "./contactFallback";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const LOCALES = ["de", "en", "es", "it", "nl"] as const;
const loc = (l: string) => JSON.parse(readFileSync(here(`../../../locales/${l}.json`), "utf8")).errors.api as Record<string, string>;

function i18nFor(l: string) {
  const dict = loc(l);
  const fmt = (s: string, n?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(n?.[k] ?? ""));
  return {
    t: (key: string, n?: Record<string, unknown>) => fmt(dict[key.replace("errors.api.", "")] ?? key, n),
    te: (key: string) => key.replace("errors.api.", "") in dict,
  };
}

describe("respaldo de contacto: textos", () => {
  it("todas las claves existen en los 5 idiomas", () => {
    const keys = [
      "CONTACT_FALLBACK_PHONE", "CONTACT_FALLBACK_PHONE_NONE", "CONTACT_FALLBACK_NAME", "CONTACT_FALLBACK_CONTACT", "CONTACT_FALLBACK_EMAIL",
      "CONTACT_FALLBACK_SIDE_destination", "CONTACT_FALLBACK_SIDE_origin", "CONTACT_FALLBACK_SRC_sede", "CONTACT_FALLBACK_SRC_partner", "CONTACT_FALLBACK_SRC_tmwe",
    ];
    for (const l of LOCALES) for (const k of keys) expect(loc(l)[k], `${l}.${k}`).toBeTruthy();
  });

  it("traduce el teléfono del destinatario tomado de la sede, con el nombre de la sede", () => {
    const text = contactFallbackText("CONTACT_FALLBACK_PHONE", { side: "destination", source: "sede", source_name: "Madrid" }, i18nFor("es"));
    expect(text).toBe("Falta el teléfono del destinatario: se enviará el de la sede «Madrid».");
  });

  it("sin dato en ningún nivel usa el texto _NONE", () => {
    const text = contactFallbackText("CONTACT_FALLBACK_PHONE", { side: "origin", source: "none" }, i18nFor("en"));
    expect(text).toContain("generic number");
  });

  it("el mismo aviso sale distinto en cada idioma y sin llaves sin resolver", () => {
    const texts = LOCALES.map((l) => contactFallbackText("CONTACT_FALLBACK_EMAIL", { side: "origin", source: "tmwe" }, i18nFor(l)));
    expect(new Set(texts).size).toBe(LOCALES.length);
    for (const t of texts) expect(t).not.toMatch(/[{}]/);
  });

  it("ignora códigos que no son de contacto", () => {
    expect(contactFallbackText("COURIER_PACKAGE_OVERWEIGHT", {}, i18nFor("es"))).toBeNull();
    expect(isContactFallbackCode("CONTACT_FALLBACK_NAME")).toBe(true);
  });

  it("convierte contact_fallbacks en avisos", () => {
    const issues = fallbacksToIssues([{ code: "CONTACT_FALLBACK_NAME", side: "origin", source: "partner", source_name: "Acme" }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].category).toBe("sender");
    expect(fallbacksToIssues(undefined)).toEqual([]);
  });
});
