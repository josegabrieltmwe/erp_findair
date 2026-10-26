import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: [] };

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import {
  partnerSmtpAdmin,
  partnerSmtpSelf,
  smtpFieldErrors,
} from "@shared/partner_smtp/services/partnerSmtp.service";
import { ApiError } from "@shared/anagrafiche/services/api.types";

const payload = {
  purpose: "default" as const,
  environment: "production" as const,
  smtp_server: "smtp.x.com",
  smtp_port: 587,
  smtp_security: "TLS" as const,
  smtp_user: "u",
  from_email: "a@x.com",
};

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: [] };
});

describe("partnerSmtp.service", () => {
  it("el partner nunca envía anagrafica_id, aunque se le pase", async () => {
    await partnerSmtpSelf.create(payload, 123);
    await partnerSmtpSelf.effective(123);
    expect(calls[0].url).toBe("/api_partner_smtp");
    expect(calls[0].opts.body).not.toHaveProperty("anagrafica_id");
    expect(calls[1].opts.query).toEqual({ view: "effective" });
  });

  it("la administración indica el partner al crear, probar y diagnosticar", async () => {
    await partnerSmtpAdmin.create(payload, 9069);
    await partnerSmtpAdmin.test({ id: 4, test_recipient: "t@x.com" }, 9069);
    await partnerSmtpAdmin.resolve("billing", 9069);
    expect(calls[0].url).toBe("/api_admin_partner_smtp");
    expect(calls[0].opts.body).toMatchObject({ anagrafica_id: 9069, smtp_server: "smtp.x.com" });
    expect(calls[1].opts.body).toMatchObject({ action: "test", id: 4, anagrafica_id: 9069 });
    expect(calls[2].opts.query).toMatchObject({ view: "resolve", purpose: "billing", anagrafica_id: 9069 });
  });

  it("update y remove viajan por PUT y DELETE con el id", async () => {
    await partnerSmtpSelf.update({ ...payload, id: 7 });
    await partnerSmtpSelf.remove(7);
    expect(calls[0].opts.method).toBe("PUT");
    expect(calls[1]).toMatchObject({ opts: { method: "DELETE", body: { id: 7 } } });
  });

  it("un success:false se convierte en error con el mensaje del backend", async () => {
    reply = { success: false, error: "boom" };
    await expect(partnerSmtpSelf.list()).rejects.toThrow("boom");
  });

  it("extrae los errores por campo de error.details.fields", () => {
    const body = { error: { details: { fields: { smtp_port: "Puerto no válido", from_email: ["a", "b"] } } } };
    const err = new ApiError("x", 400, "VALIDATION_ERROR", body);
    expect(smtpFieldErrors(err)).toEqual({ smtp_port: "Puerto no válido", from_email: "a, b" });
    expect(smtpFieldErrors(new Error("x"))).toEqual({});
  });
});
