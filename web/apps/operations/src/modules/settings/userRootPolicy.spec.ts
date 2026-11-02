import { describe, expect, it } from "vitest";
import {
  formatRolesDenied,
  isRootUser,
  parseRolesDenied,
  rootActionBlocked,
} from "@shared/users/services/userRootPolicy";
import { usersService } from "@shared/users/services/users.service";
import { apiErrorCode } from "@shared/utils/apiError";
import { ApiError } from "@shared/anagrafiche/services/api.types";

describe("isRootUser", () => {
  it("detecta root en la lista separada por comas", () => {
    expect(isRootUser({ role_names: "findair_full, root" })).toBe(true);
    expect(isRootUser({ role_names: "ROOT" })).toBe(true);
    expect(isRootUser({ role_names: "rootless, account_admin" })).toBe(false);
    expect(isRootUser({ role_names: "" })).toBe(false);
    expect(isRootUser({})).toBe(false);
    expect(isRootUser(null)).toBe(false);
  });
});

describe("rootActionBlocked", () => {
  const root = { role_names: "root" };
  it("bloquea solo si el objetivo es root y sabemos que el actor no lo es", () => {
    expect(rootActionBlocked(root, { isRoot: false, known: true })).toBe(true);
  });
  it("no bloquea a un root", () => {
    expect(rootActionBlocked(root, { isRoot: true, known: true })).toBe(false);
  });
  it("sin perfil conocido no bloquea (lo decide el servidor)", () => {
    expect(rootActionBlocked(root, { isRoot: false, known: false })).toBe(false);
  });
  it("no bloquea si el objetivo no es root", () => {
    expect(rootActionBlocked({ role_names: "findair_basic" }, { isRoot: false, known: true })).toBe(false);
  });
});

describe("roles_denied (alta)", () => {
  const dict: Record<string, string> = { "errors.api.ROLE_ROOT_ONLY": "solo root" };
  const i18n = { t: (k: string) => dict[k], te: (k: string) => k in dict };
  it("parsea y descarta lo que no es una lista de objetos", () => {
    expect(parseRolesDenied("x")).toEqual([]);
    expect(parseRolesDenied([{ role_id: 1, role_name: "root", code: "ROLE_ROOT_ONLY" }, 3])).toEqual([
      { role_id: 1, role_name: "root", code: "ROLE_ROOT_ONLY" },
    ]);
  });
  it("formatea con el motivo traducido, o solo el nombre sin traducción", () => {
    expect(
      formatRolesDenied(
        [
          { role_name: "root", code: "ROLE_ROOT_ONLY" },
          { role_id: 7, code: "OTRO" },
        ],
        i18n,
      ),
    ).toBe("root (solo root), #7");
  });
});

describe("usersService con 403 ROLE_ROOT_ONLY", () => {
  const body = {
    success: false,
    error: { code: "ROLE_ROOT_ONLY", message: "Solo un usuario root puede modificar a otro usuario root" },
    error_code: "ROLE_ROOT_ONLY",
    message: "Solo un usuario root puede modificar a otro usuario root",
  };
  it("el código real se recupera aunque el cliente http ponga FORBIDDEN", () => {
    const e = new ApiError(body.message, 403, "FORBIDDEN", body);
    expect(apiErrorCode(e)).toBe("ROLE_ROOT_ONLY");
  });
  it("create devuelve roles_denied", async () => {
    const g = globalThis as unknown as { fetch: unknown };
    const prev = g.fetch;
    g.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          loginn: "u1",
          password: "p",
          roles_assigned: ["findair_basic"],
          roles_denied: [{ role_id: 1, role_name: "root", code: "ROLE_ROOT_ONLY" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      const c = await usersService.create({ nome: "x", id_anagrafica: 1, role_ids: [1] });
      expect(c.roles_denied).toEqual([{ role_id: 1, role_name: "root", code: "ROLE_ROOT_ONLY" }]);
    } finally {
      g.fetch = prev;
    }
  });
  it("bulkAssignRole cuenta las cuentas root rechazadas", async () => {
    const g = globalThis as unknown as { fetch: unknown };
    const prev = g.fetch;
    let n = 0;
    g.fetch = async () => {
      n += 1;
      return n === 1
        ? new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify(body), { status: 403, headers: { "content-type": "application/json" } });
    };
    try {
      const r = await usersService.bulkAssignRole([1, 2], 5, "revoke");
      expect(r).toEqual({ processed: 1, skipped: 1, rootDenied: 1 });
    } finally {
      g.fetch = prev;
    }
  });
});
