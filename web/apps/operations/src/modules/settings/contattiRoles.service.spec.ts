import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = {};

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    return reply;
  }),
}));

import { ADDON_ROLE_NAMES, contattiService } from "@shared/anagrafiche/services/contatti.service";

beforeEach(() => {
  calls.length = 0;
  reply = {};
});

describe("roles múltiples del contacto", () => {
  it("lee el rol base, los aditivos y los roles que el llamante puede conceder", async () => {
    reply = {
      success: true,
      data: {
        enabled: true,
        role_id: 15,
        role_name: "partner_staff",
        addon_roles: ["account_admin"],
        addon_role_details: [{ id: 40, name: "account_admin", display_name: "Administrador de cuenta (aditivo)", addon: true }],
        grantable_roles: [
          { id: 41, name: "partner_mail_admin", display_name: "Correo saliente del partner (aditivo)", addon: true },
          { id: "x", name: "roto" },
        ],
      },
    };
    const state = await contattiService.getApiRole(9);
    expect(state.role_name).toBe("partner_staff");
    expect(state.addon_roles.map((r) => r.name)).toEqual(["account_admin"]);
    expect(state.grantable_roles).toHaveLength(1); // la fila inválida se descarta
    expect(state.grantable_roles[0].addon).toBe(true);
  });

  it("sin datos devuelve listas vacías, no undefined", async () => {
    reply = { success: true, data: { enabled: false } };
    const state = await contattiService.getApiRole(9);
    expect(state.addon_roles).toEqual([]);
    expect(state.grantable_roles).toEqual([]);
  });

  it("sumar o retirar un aditivo envía role_id y enabled, sin tocar el rol base", async () => {
    await contattiService.setAddonRole(9, 41, true);
    await contattiService.setAddonRole(9, 41, false);
    expect(calls[0].opts).toMatchObject({ method: "POST", body: { id: 9, enabled: true, role_id: 41 } });
    expect(calls[1].opts).toMatchObject({ method: "POST", body: { id: 9, enabled: false, role_id: 41 } });
  });

  it("revocar el rol base no lleva role_id (así no se confunde con un aditivo)", async () => {
    await contattiService.setApiRole(9, null);
    expect(calls[0].opts).toMatchObject({ body: { id: 9, enabled: false } });
    expect(calls[0].opts.body).not.toHaveProperty("role_id");
  });

  it("los roles de partner figuran entre los aditivos que no se ofrecen como base", () => {
    expect(ADDON_ROLE_NAMES).toContain("partner_mail_admin");
    expect(ADDON_ROLE_NAMES).toContain("partner_admin");
  });
});
