import { describe, expect, it } from "vitest";
import {
  fornitoriAccntService,
  hasSecret,
} from "@shared/fornitori_accnt/services/fornitoriAccnt.service";

describe("hasSecret (P52)", () => {
  it("se fía solo de has_pw / has_chiave", () => {
    expect(hasSecret({ has_pw: true, has_chiave: false }, "pw")).toBe(true);
    expect(hasSecret({ has_pw: true, has_chiave: false }, "chiave")).toBe(false);
    expect(hasSecret({}, "pw")).toBe(false);
    expect(hasSecret(null, "chiave")).toBe(false);
  });
  it("ignora un pw/chiave en claro que llegue por error", () => {
    const row = { pw: "secreto", chiave: "k" } as unknown as {
      has_pw?: boolean;
      has_chiave?: boolean;
    };
    expect(hasSecret(row, "pw")).toBe(false);
    expect(hasSecret(row, "chiave")).toBe(false);
  });
});

describe("fornitoriAccntService.list", () => {
  it("devuelve las filas con has_* sin pw/chiave", async () => {
    const g = globalThis as unknown as { fetch: unknown };
    const prev = g.fetch;
    g.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [{ id: 1, id_fornitore: 3, id_partner: 9, id_account: "A", has_pw: true, has_chiave: false }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      const rows = await fornitoriAccntService.list(9);
      expect(hasSecret(rows[0], "pw")).toBe(true);
      expect("pw" in rows[0]).toBe(false);
    } finally {
      g.fetch = prev;
    }
  });
});
