import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
}));

import {
  siteNoticesService, noticeState, validateNotice, sanitizeNoticeHtml,
  toInputValue, fromInputValue,
} from "@shared/site_notices/services/siteNotices.service";
import {
  b2bTextsService, buildListQuery, B2B_LANGUAGES, targetLanguages, ensureDistinctTarget,
  pairTexts, filterPairs, isUntranslated, searchPairs, pageSlice, buildPayload,
  type B2bText,
} from "@shared/b2b_texts/services/b2bTexts.service";

beforeEach(() => httpMock.mockReset());

describe("avvisi sito: estado", () => {
  const now = new Date("2026-06-15T12:00:00").getTime();
  it("calcula activo, programado y caducado", () => {
    expect(noticeState({ data_start: "2026-06-01 00:00:00", data_stop: "2026-06-30 00:00:00" }, now)).toBe("active");
    expect(noticeState({ data_start: "2026-07-01 00:00:00", data_stop: "2026-07-30 00:00:00" }, now)).toBe("scheduled");
    expect(noticeState({ data_start: "2026-05-01 00:00:00", data_stop: "2026-05-30 00:00:00" }, now)).toBe("expired");
    expect(noticeState({ data_start: null, data_stop: null }, now)).toBe("active");
    expect(noticeState({ data_start: "0000-00-00 00:00:00", data_stop: "2026-06-30 00:00:00" }, now)).toBe("active");
  });
});

describe("avvisi sito: validacion y fechas", () => {
  it("exige texto y fin posterior al inicio", () => {
    expect(validateNotice({ data_start: "", data_stop: "", testo: "<p> </p>" })).toBe("text_required");
    expect(validateNotice({ data_start: "2026-06-02 10:00:00", data_stop: "2026-06-01 10:00:00", testo: "Hola" })).toBe("stop_before_start");
    expect(validateNotice({ data_start: "2026-06-01 10:00:00", data_stop: "2026-06-02 10:00:00", testo: "Hola" })).toBeNull();
  });
  it("convierte entre datetime-local y backend", () => {
    expect(fromInputValue("2026-06-01T10:30")).toBe("2026-06-01 10:30:00");
    expect(toInputValue("2026-06-01 10:30:00")).toBe("2026-06-01T10:30");
    expect(fromInputValue("")).toBe("");
  });
  it("sanea el HTML como el backend", () => {
    const out = sanitizeNoticeHtml('<p onclick="x()">Hi <script>alert(1)</script><b>b</b><img src=x><a href="javascript:evil()">l</a><a href="https://a.it">ok</a></p>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("javascript");
    expect(out).toContain("<b>b</b>");
    expect(out).toContain('href="https://a.it"');
  });
});

describe("avvisi sito: servicio", () => {
  it("arma las peticiones", async () => {
    httpMock.mockResolvedValue({ success: true, data: [{ id: 1 }] });
    expect(await siteNoticesService.list()).toHaveLength(1);
    await siteNoticesService.create({ data_start: "a", data_stop: "b", testo: "t" });
    await siteNoticesService.update(4, { data_start: "a", data_stop: "b", testo: "t" });
    await siteNoticesService.remove(4);
    const calls = httpMock.mock.calls;
    expect(calls[1][1]).toEqual({ method: "POST", body: { data_start: "a", data_stop: "b", testo: "t" } });
    expect(calls[2][1]).toEqual({ method: "PUT", body: { id: 4, data_start: "a", data_stop: "b", testo: "t" } });
    expect(calls[3][1]).toEqual({ method: "DELETE", query: { id: "4" } });
    expect(calls[3][0]).toBe("/api_avviso_sito");
  });
  it("propaga el error del backend", async () => {
    httpMock.mockResolvedValue({ success: false, error: "nope" });
    await expect(siteNoticesService.remove(1)).rejects.toThrow("nope");
  });
});

const row = (p: Partial<B2bText>): B2bText => ({
  id: 1, tipo: "TX", gruppo: "Home", lingua: "ITA", chiave: "k1", label: "Ciao",
  helpc: null, commento: null, attiva_sito: null, ...p,
});

describe("traduzioni B2B: lingue y emparejado", () => {
  it("tiene 12 idiomas y el destino excluye la base", () => {
    expect(B2B_LANGUAGES).toHaveLength(12);
    expect(targetLanguages("ITA").map((l) => l.code)).not.toContain("ITA");
    expect(ensureDistinctTarget("ENG", "ENG")).not.toBe("ENG");
    expect(ensureDistinctTarget("ITA", "SPA")).toBe("SPA");
  });
  it("empareja por clave y filtra los no traducidos", () => {
    const pairs = pairTexts(
      [row({ chiave: "b" }), row({ chiave: "a", id: 2 }), row({ chiave: "c", id: 3 })],
      [row({ chiave: "a", lingua: "ENG", label: "Hi", id: 9 }), row({ chiave: "c", lingua: "ENG", label: "  ", id: 10 })],
    );
    expect(pairs.map((p) => p.chiave)).toEqual(["a", "b", "c"]);
    expect(isUntranslated(pairs[0])).toBe(false);
    expect(filterPairs(pairs, true).map((p) => p.chiave)).toEqual(["b", "c"]);
    expect(filterPairs(pairs, false)).toHaveLength(3);
    expect(searchPairs(pairs, "hi").map((p) => p.chiave)).toEqual(["a"]);
    expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
  });
});

describe("traduzioni B2B: servicio", () => {
  it("construye la consulta con idioma, grupo y orden", () => {
    expect(buildListQuery(2, { lingua: "ENG", gruppo: "Home", search: "x" }, 50)).toEqual({
      page: 2, limit: 50, lingua: "ENG", sort: "chiave", gruppo: "Home", search: "x",
    });
  });
  it("recorre las paginas de un grupo y guarda con PUT/DELETE", async () => {
    httpMock
      .mockResolvedValueOnce({ success: true, data: [row({ id: 1 })], total: 2, page: 1, pages: 2 })
      .mockResolvedValueOnce({ success: true, data: [row({ id: 2, chiave: "k2" })], total: 2, page: 2, pages: 2 });
    expect(await b2bTextsService.listGroup("Home", "ITA")).toHaveLength(2);
    httpMock.mockResolvedValue({ success: true });
    const payload = buildPayload(row({ helpc: "h" }), "Hi", null, "ENG");
    expect(payload).toMatchObject({ lingua: "ENG", chiave: "k1", label: "Hi", helpc: "h", gruppo: "Home" });
    await b2bTextsService.update(7, payload);
    await b2bTextsService.remove(7);
    const calls = httpMock.mock.calls;
    expect(calls[2][1]).toEqual({ method: "PUT", body: { id: 7, ...payload } });
    expect(calls[3][1]).toEqual({ method: "DELETE", query: { id: "7" } });
    expect(calls[3][0]).toBe("/api_master_texts");
  });
});
