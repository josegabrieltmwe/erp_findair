import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL(".", import.meta.url));

describe("render del chat: texto plano", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".vue"));

  it.each(files)("%s no usa v-html ni innerHTML", (file) => {
    const src = readFileSync(`${dir}${file}`, "utf8");
    expect(src).not.toMatch(/v-html|innerHTML|outerHTML|insertAdjacentHTML/);
  });

  it("la burbuja pinta la respuesta con v-text (textContent)", () => {
    const src = readFileSync(`${dir}ChatBubble.vue`, "utf8");
    expect(src).toContain('v-text="bubble.text"');
  });

  it("la etiqueta de herramientas pasa por i18n, nunca por tool.name crudo", () => {
    const src = readFileSync(`${dir}ChatBubble.vue`, "utf8");
    expect(src).toContain("toolLabelKeys");
    expect(src).not.toMatch(/tool\.name/);
  });

  it("la pagina no navega con window.location hacia el ERP legado", () => {
    const actions = readFileSync(`${dir}../services/actions.ts`, "utf8");
    expect(actions).not.toMatch(
      /window\.location|location\.href|\/erp\/tmwe_json/,
    );
  });
});
