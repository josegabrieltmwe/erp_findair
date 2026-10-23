import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@shared/anagrafiche/services/api.types";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

import {
  buildConfirmRequest,
  classifyConfirmError,
  confirmProposal,
  describeProposal,
  formatCountdown,
  interpretConfirmResponse,
  parseProposal,
  remainingSeconds,
} from "./proposal";
import { rawCancel, rawProposal } from "./fixtures";

describe("parseProposal", () => {
  it("acepta el descriptor del contrato y conserva el payload tal cual", () => {
    const raw = rawProposal();
    const p = parseProposal(raw);
    expect(p).not.toBeNull();
    expect(p!.action).toBe("create_shipment");
    expect(p!.draft).toBe(true);
    expect(JSON.stringify(p!.payload)).toBe(JSON.stringify(raw.payload));
    expect((p!.payload as { parcels: { weight: string } }).parcels.weight).toBe(
      "7.50",
    );
    expect(Object.isFrozen(p!.payload)).toBe(true);
    expect(Object.isFrozen((p!.payload as { parcels: object }).parcels)).toBe(
      true,
    );
  });

  it("un cancel es siempre confirmacion reforzada aunque el flag falte", () => {
    const p = parseProposal({ ...rawCancel(), reinforced_confirmation: false });
    expect(p!.reinforced_confirmation).toBe(true);
  });

  it.each([
    ["no es objeto", null],
    ["tipo distinto", { ...rawProposal(), type: "other" }],
    ["sin token", rawProposal({ token: "" })],
    ["accion fuera de lista", rawProposal({ action: "delete_everything" })],
    ["riesgo desconocido", rawProposal({ risk: "low" })],
    ["payload no objeto", rawProposal({ payload: "x" })],
    ["payload lista", rawProposal({ payload: [] })],
    ["target sin kind", rawProposal({ target: { id: 1 } })],
    ["sin caducidad", rawProposal({ expires_in: 0 })],
    [
      "endpoint de confirmacion ajeno",
      rawProposal({ confirm: { endpoint: "api_admin_users" } }),
    ],
  ])("descarta: %s", (_n, raw) => {
    expect(parseProposal(raw)).toBeNull();
  });

  it("limita expires_in a 300 s", () => {
    expect(parseProposal(rawProposal({ expires_in: 99999 }))!.expires_in).toBe(
      300,
    );
  });

  it("costes opcionales: solo lineas validas", () => {
    const p = parseProposal(
      rawProposal({
        costs: [
          { label: "Flete", amount: "12.30", currency: "EUR" },
          { amount: {} },
          "x",
        ],
      }),
    );
    expect(p!.costs).toEqual([
      { label: "Flete", amount: "12.30", currency: "EUR" },
    ]);
  });
});

describe("cuenta atras", () => {
  it("300 s desde la recepcion, nunca negativa", () => {
    expect(remainingSeconds(1000, 300, 1000)).toBe(300);
    expect(remainingSeconds(1000, 300, 1000 + 61_500)).toBe(239);
    expect(remainingSeconds(1000, 300, 1000 + 300_000)).toBe(0);
    expect(remainingSeconds(1000, 300, 1000 + 999_999)).toBe(0);
  });
  it("formato m:ss", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});

describe("confirmacion", () => {
  beforeEach(() => httpMock.mockReset());

  it("payload_override es EXACTAMENTE el payload recibido (misma referencia y mismo JSON)", async () => {
    const raw = rawProposal();
    const sent = JSON.stringify(raw.payload);
    const p = parseProposal(raw)!;
    httpMock.mockResolvedValue({ success: true, executed: true });
    await confirmProposal(p);

    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe("/api_copilot_write_proposal");
    expect(options.method).toBe("POST");
    expect(options.body.op).toBe("confirmar");
    expect(options.body.token).toBe("TOKEN-SIGNED-BASE64");
    expect(options.body.payload_override).toBe(p.payload);
    expect(JSON.stringify(options.body.payload_override)).toBe(sent);
    expect(Object.keys(options.body).sort()).toEqual([
      "op",
      "payload_override",
      "token",
    ]);
  });

  it("buildConfirmRequest no cambia tipos (weight sigue siendo string con ceros)", () => {
    const body = buildConfirmRequest(parseProposal(rawProposal())!);
    expect(JSON.stringify(body.payload_override)).toContain('"weight":"7.50"');
  });

  it("solo executed:true + readback verified es hecho", () => {
    expect(
      interpretConfirmResponse({
        success: true,
        executed: true,
        result: {
          success: true,
          http_status: 201,
          data: { data: { id: 555 } },
        },
        readback: { status: "verified" },
      }),
    ).toMatchObject({ status: "verified", createdId: 555, httpStatus: 201 });
  });

  it("executed:false (200) es rechazo del ERP con su motivo", () => {
    expect(
      interpretConfirmResponse({
        success: true,
        executed: false,
        result: { success: false, http_status: 422, error: "ya controlada" },
      }),
    ).toMatchObject({
      status: "rejected",
      error: "ya controlada",
      httpStatus: 422,
    });
  });

  it.each([
    ["mismatch", "mismatch"],
    ["unverified", "unverified"],
    ["otra cosa", "unverified"],
    [undefined, "unverified"],
  ])("readback %s -> NO verificado (%s)", (rb, expected) => {
    const o = interpretConfirmResponse({
      success: true,
      executed: true,
      result: { success: true },
      readback: { status: rb, not_compared: ["pickup_date"] },
    });
    expect(o.status).toBe(expected);
    expect(o.status).not.toBe("verified");
    expect(o.notCompared).toEqual(["pickup_date"]);
  });

  it("respuestas raras nunca cuentan como hecho", () => {
    for (const bad of [
      null,
      undefined,
      "ok",
      [],
      {},
      { success: true },
      { executed: "true" },
      { success: false, executed: true },
    ]) {
      expect(interpretConfirmResponse(bad).status).not.toBe("verified");
    }
  });
});

describe("clasificacion de errores de confirmacion", () => {
  const apiErr = (status: number, details: unknown, message = "x") =>
    new ApiError(message, status, undefined, details);

  it.each([
    [
      409,
      { code: "payload_mismatch", error: "payload_mismatch" },
      "payload_mismatch",
      false,
    ],
    [403, { code: "operator_mismatch" }, "operator_mismatch", false],
    [409, { code: "expired" }, "expired", false],
    [409, { code: "already_executed_or_failed" }, "already_executed", false],
    [409, { code: "invalid_signature" }, "invalid_token", false],
    [409, { error: "malformed_token" }, "invalid_token", false],
    [400, { code: "missing_token_or_payload" }, "bad_request", false],
    [400, { code: "invalid_body" }, "bad_request", false],
    [400, { code: "invalid_op" }, "bad_request", false],
    [400, { code: "ruta_no_habilitada" }, "bad_request", false],
    [429, { code: "concurrency_limited" }, "busy", true],
    [429, { code: "rate_limited" }, "rate_limited", true],
    [429, {}, "rate_limited", true],
    [503, { code: "capacity_exceeded" }, "unavailable", true],
    [503, { code: "throttle_unavailable" }, "unavailable", true],
    [502, { code: "upstream_error" }, "uncertain", false],
    [502, { code: "effective_partner_mismatch" }, "uncertain", false],
    [500, {}, "uncertain", false],
    [504, { code: "upstream_unreachable" }, "uncertain", false],
    [401, { code: "session_expired" }, "session", false],
    [403, { code: "upstream_unauthorized" }, "forbidden", false],
    [418, {}, "unknown", false],
  ])("HTTP %i %j -> %s (retry=%s)", (status, details, kind, retryable) => {
    expect(classifyConfirmError(apiErr(status, details))).toEqual({
      kind,
      retryable,
    });
  });

  it("fallo de red (sin status): resultado incierto y SIN reintento ciego", () => {
    expect(classifyConfirmError(new Error("network"))).toEqual({
      kind: "uncertain",
      retryable: false,
    });
    expect(classifyConfirmError(new ApiError("net", 0))).toEqual({
      kind: "uncertain",
      retryable: false,
    });
  });
});

describe("descripcion legible", () => {
  it("muestra cada hoja del payload firmado; lo desconocido con su clave", () => {
    const p = parseProposal(
      rawProposal({
        payload: {
          destination: { name: "Mario", city: "Milano" },
          parcels: { weight: "7.5" },
          extra: { x: 1 },
          options: { auto_route: false },
        },
      }),
    )!;
    const rows = describeProposal(p);
    expect(rows).toContainEqual({ labelKey: "name", value: "Mario" });
    expect(rows).toContainEqual({ labelKey: "weight", value: "7.5" });
    expect(rows).toContainEqual({ label: "extra.x", value: "1" });
    expect(rows.find((r) => r.label === "options.auto_route")).toBeUndefined();
  });

  it("edit y cancel enseñan el destino (id/AWB/referencia)", () => {
    const rows = describeProposal(parseProposal(rawCancel())!);
    expect(rows.slice(0, 3)).toEqual([
      { labelKey: "target_id", value: "900" },
      { labelKey: "target_awb", value: "176-123" },
      { labelKey: "target_reference", value: "R9" },
    ]);
    expect(rows).toHaveLength(3); // el id del payload no se repite
  });

  it("edit_cargo etiqueta los campos", () => {
    const p = parseProposal(
      rawProposal({
        action: "edit_cargo",
        target: { kind: "cargo", id: 900, awb: "176-123", reference: null },
        payload: {
          id: 900,
          fields: {
            pickup_date: "2026-11-03",
            peso: "55",
            colli: 4,
            note: "n",
          },
        },
      }),
    )!;
    const labels = describeProposal(p).map((r) => r.labelKey);
    expect(labels).toEqual(
      expect.arrayContaining(["pickup_date", "weight", "parcels", "note"]),
    );
  });
});
