import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: null };

vi.mock("@shared/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import {
  createDgrService,
  getPartnerDgrConfig,
  savePartnerDgrConfig,
} from "@shared/services/dgr.service";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: null };
});

describe("dgr.service — requisitos del courier y contacto de emergencia del partner", () => {
  it("pide los requisitos con op=requirements solo para courier express", async () => {
    reply = { success: true, data: { courier: "ups", dg: null, missing: [{ code: "declaration", message: "x" }], warnings: [], can_generate_label: false } };
    const r = await createDgrService("N").getRequirements(42);
    expect(calls[0].url).toBe("/api_shipment_dgr");
    expect(calls[0].opts.query).toEqual({ shipment_id: 42, is_cargo: "N", op: "requirements" });
    expect(r?.missing[0].code).toBe("declaration");

    calls.length = 0;
    expect(await createDgrService("S").getRequirements(42)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("el partner no manda anagrafica_id; TMWE sí, para otro partner", async () => {
    await getPartnerDgrConfig();
    expect(calls[0].url).toBe("/api_partner_dgr_config");
    expect(calls[0].opts.query).toEqual({});
    const cfg = { emergency_phone: "+39 02 1", emergency_contact: null, emergency_reference: null, signatory_name: null, signatory_title: null, signatory_place: null };
    await savePartnerDgrConfig(cfg, 77);
    expect(calls[1].opts.method).toBe("POST");
    expect(calls[1].opts.query).toEqual({ anagrafica_id: 77 });
    expect(calls[1].opts.body).toEqual(cfg);
  });
});
