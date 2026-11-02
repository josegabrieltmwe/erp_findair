import { describe, expect, it } from "vitest";
import {
  htmlToPlain,
  plainToHtml,
  safeLinkUrl,
} from "@shared/utils/html";

describe("plainToHtml / htmlToPlain", () => {
  it("escapa HTML y convierte saltos de línea", () => {
    expect(plainToHtml('<img src=x onerror=alert(1)>\nhola & adiós')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;<br>hola &amp; adiós",
    );
  });
  it("ida y vuelta conserva el texto", () => {
    const t = "a < b && c > d\nsegunda línea";
    expect(htmlToPlain(plainToHtml(t))).toBe(t);
  });
  it("&amp;lt; escrito por la persona no se convierte en <", () => {
    const t = "&lt;";
    expect(htmlToPlain(plainToHtml(t))).toBe(t);
  });
});

describe("safeLinkUrl", () => {
  it("acepta http, https y mailto", () => {
    expect(safeLinkUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeLinkUrl("HTTP://a.com")).toBe("HTTP://a.com");
    expect(safeLinkUrl("mailto:x@y.com")).toBe("mailto:x@y.com");
  });
  it("rechaza javascript: y data:", () => {
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(safeLinkUrl(" JavaScript:alert(1)")).toBeNull();
    expect(safeLinkUrl("data:text/html,x")).toBeNull();
  });
  it("sin esquema asume https y vacío da null", () => {
    expect(safeLinkUrl("ejemplo.com/ruta")).toBe("https://ejemplo.com/ruta");
    expect(safeLinkUrl("   ")).toBeNull();
  });
});
