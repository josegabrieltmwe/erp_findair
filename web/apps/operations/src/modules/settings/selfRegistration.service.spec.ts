import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: {} };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import {
  diffCorrections,
  formatDateTime,
  hoursSince,
  normalizeConfig,
  parseUtc,
  selfRegistrationService,
} from "@shared/self_registration/services/selfRegistration.service";
import { selfRegistrationErrorText, selfRegistrationFieldErrors } from "@shared/self_registration/utils/errors";
import { ApiError } from "@shared/anagrafiche/services/api.types";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: {} };
});

describe("selfRegistration.service (P147)", () => {
  it("la cola solo manda los filtros con valor y acota per_page a 100", async () => {
    reply = { success: true, data: { items: [{ id: 7 }], total: 1, page: 1, per_page: 100 } };
    const res = await selfRegistrationService.list({ status: "verified", q: "  acme ", date_from: "", per_page: 500, page: 0 });
    expect(calls[0].url).toBe("/api_self_registration_admin");
    expect(calls[0].opts.query).toEqual({ status: "verified", q: "acme", page: 1, per_page: 100 });
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it("aprobar sin correcciones no manda `corrections`; rechazar manda notes y el mensaje solo si lo hay", async () => {
    await selfRegistrationService.approve(5, {}, "  ");
    expect(calls[0].opts).toMatchObject({ method: "POST", body: { action: "approve", id: 5 } });
    expect(calls[0].opts.body).not.toHaveProperty("corrections");
    expect(calls[0].opts.body).not.toHaveProperty("notes");

    await selfRegistrationService.reject(5, " duplicado ", " ");
    expect(calls[1].opts.body).toEqual({ action: "reject", id: 5, notes: "duplicado" });
    await selfRegistrationService.reject(5, "x", "Hola");
    expect(calls[2].opts.body).toEqual({ action: "reject", id: 5, notes: "x", customer_message: "Hola" });
  });

  it("la configuración de otro titular (TMWE) va por la query, también en el PUT", async () => {
    reply = { success: true, data: { id_anagr_titolare: 9, enabled: true, notify_emails: ["a@b.it"], id_pagam_met_card: 0 } };
    const cfg = await selfRegistrationService.getConfig(9);
    expect(calls[0].opts.query).toEqual({ id_anagr_titolare: 9 });
    expect(cfg.id_pagam_met_card).toBeNull();
    expect(cfg.daily_limit).toBe(200);
    await selfRegistrationService.saveConfig({ ...normalizeConfig(null) }, 9);
    expect(calls[1].opts).toMatchObject({ method: "PUT", query: { id_anagr_titolare: 9 } });
    await selfRegistrationService.getConfig(null);
    expect(calls[2].opts.query).toEqual({});
  });

  it("solo se corrige lo que cambia", () => {
    const current = {
      rag_soc: "Acme",
      pi_cf: "IT123",
      sede: { indirizzo: "Via 1", citta: "Roma", cap: "00100", prov: "RM", id_paese_iso: "IT" },
    };
    expect(diffCorrections(current, { rag_soc: "Acme", pi_cf: "IT123", sede: { ...current.sede } })).toEqual({});
    expect(
      diffCorrections(current, { rag_soc: " Acme Srl ", pi_cf: "", sede: { ...current.sede, cap: "00118" } }),
    ).toEqual({ rag_soc: "Acme Srl", sede: { cap: "00118" } });
  });

  it("las fechas del api son UTC sin zona", () => {
    expect(parseUtc("2026-11-25 10:00:00")?.toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(parseUtc("basura")).toBeNull();
    expect(formatDateTime(null, "es")).toBe("—");
    expect(hoursSince("2026-11-23 10:00:00", new Date("2026-11-25T10:30:00Z"))).toBe(48);
  });

  it("traduce los códigos propios y los errores por campo", () => {
    const i18n = {
      t: (k: string) => `T:${k}`,
      te: (k: string) => ["self_registration.errors.ALREADY_REVIEWED", "self_registration.field_error.required"].includes(k),
    };
    const e409 = new ApiError("x", 409, "ALREADY_REVIEWED", { success: false, error: { code: "ALREADY_REVIEWED", message: "x" } });
    expect(selfRegistrationErrorText(e409, i18n)).toBe("T:self_registration.errors.ALREADY_REVIEWED");
    const e422 = new ApiError("x", 422, "VALIDATION_ERROR", {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "x", details: { fields: { notes: "required", "sede.cap": "raro" } } },
    });
    expect(selfRegistrationFieldErrors(e422, i18n)).toEqual({ notes: "T:self_registration.field_error.required", "sede.cap": "raro" });
  });
});
