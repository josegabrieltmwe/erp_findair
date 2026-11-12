import { describe, expect, it } from "vitest";
import {
  actionAvailable,
  ageDays,
  canTakeRow,
  formatMoney,
  groupConversionSteps,
  legPayload,
  logActionI18nKey,
  projectGates,
  blockingWarnings,
  errorI18nKey,
  isViewMissing,
  housesWithoutShipment,
  profileFormFrom,
  profilePayload,
  normalizeApiError,
  shortDate,
  shipmentFormErrors,
  stateColor,
} from "./logic";

describe("normalizeApiError", () => {
  it("lee el cuerpo del API desde ApiError.details (VALIDATION_ERROR con campos)", () => {
    const e = normalizeApiError({
      message: "Request failed",
      status: 400,
      details: {
        success: false,
        error: "titolo: obbligatorio",
        code: "VALIDATION_ERROR",
        details: { fields: { "spedizione.peso": "deve essere > 0" } },
      },
    });
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.status).toBe(400);
    expect(e.fields["spedizione.peso"]).toBe("deve essere > 0");
  });

  it("un código conocido en details.code manda (ACCESS_DENIED + manual_price_staff_only)", () => {
    const e = normalizeApiError({
      status: 403,
      details: {
        success: false,
        error: "x",
        code: "ACCESS_DENIED",
        details: { code: "manual_price_staff_only" },
      },
    });
    expect(e.code).toBe("manual_price_staff_only");
    const other = normalizeApiError({
      status: 403,
      details: { code: "ACCESS_DENIED", details: { code: "algo_raro" } },
    });
    expect(other.code).toBe("ACCESS_DENIED");
  });

  it("conversion_blocked trae los avisos", () => {
    const avisos = [
      {
        codice: "NO_SHIPMENTS",
        severita: "error",
        id_prog_sped: null,
        messaggio: "x",
        ignorato: false,
      },
    ];
    const e = normalizeApiError({
      status: 409,
      details: { error: "no", code: "conversion_blocked", details: { avisos } },
    });
    expect(e.code).toBe("conversion_blocked");
    expect(e.avisos).toHaveLength(1);
  });

  it("invalid_state trae los estados admitidos", () => {
    const e = normalizeApiError({
      status: 409,
      details: {
        error: "x",
        code: "invalid_state",
        details: { stato: "A", ammessi: ["P"] },
      },
    });
    expect(e.allowedStates).toEqual(["P"]);
  });

  it("acepta un cuerpo {success:false} directo y entradas inválidas", () => {
    expect(
      normalizeApiError({ success: false, error: "m", code: "ACCESS_DENIED" })
        .code,
    ).toBe("ACCESS_DENIED");
    expect(normalizeApiError(null).code).toBe("UNKNOWN");
    expect(normalizeApiError(undefined).code).toBe("UNKNOWN");
  });
});

describe("helpers de presentación", () => {
  it("errorI18nKey cae en UNKNOWN para códigos no listados", () => {
    expect(errorI18nKey("already_assigned")).toBe(
      "consolidata.errors.already_assigned",
    );
    expect(errorI18nKey("zzz")).toBe("consolidata.errors.UNKNOWN");
  });

  it("stateColor", () => {
    expect(stateColor("P")).toBe("warning");
    expect(stateColor("?")).toBe("default");
  });

  it("actionAvailable lo decide el catálogo del API", () => {
    const actions = { close: { from: ["A", "P"] }, take: { from: null } };
    expect(actionAvailable(actions, "close", "P")).toBe(true);
    expect(actionAvailable(actions, "close", "C")).toBe(false);
    expect(actionAvailable(actions, "take", "C")).toBe(true);
    expect(actionAvailable(actions, "nope", "A")).toBe(false);
    expect(actionAvailable(null, "close", "A")).toBe(false);
  });

  it("blockingWarnings ignora los avisos ya ignorados y cuenta tarifa vencida", () => {
    const w = (
      codice: string,
      severita: "error" | "warn",
      ignorato = false,
    ) => ({ codice, severita, id_prog_sped: null, messaggio: "", ignorato });
    const res = blockingWarnings([
      w("A", "error"),
      w("B", "warn"),
      w("QUOTE_EXPIRED", "warn"),
      w("C", "error", true),
    ]);
    expect(res.map((x) => x.codice)).toEqual(["A", "QUOTE_EXPIRED"]);
  });

  it("shortDate", () => {
    expect(shortDate("2026-10-14 12:30:45")).toBe("2026-10-14 12:30");
    expect(shortDate("2026-10-14")).toBe("2026-10-14");
    expect(shortDate(null)).toBe("");
  });
});

describe("shipmentFormErrors (H20)", () => {
  it("rechaza bultos nulos, cero, negativos o decimales", () => {
    for (const colli of [null, 0, -2, 1.5]) {
      expect(shipmentFormErrors({ colli }).colli).toBe(
        "consolidata.shipments.colliInvalid",
      );
    }
  });

  it("acepta bultos enteros positivos", () => {
    expect(shipmentFormErrors({ colli: 3 })).toEqual({});
  });
});

describe("puertas de botones por meta (E2/E3)", () => {
  const actions = {
    take: { from: null },
    assign: { from: null },
    update_leg: { from: ["A", "P"] },
    override_price: { from: ["A", "P"] },
    remove_shipment: { from: ["A", "P"] },
    add_shipment: { from: ["A", "P"] },
    note_internal: { from: null },
    operate: { from: ["C"] },
    request_quote: { from: ["A"] },
  };

  it("cada botón por su acción", () => {
    const g = projectGates(actions, "P", null);
    expect(g.updateLeg).toBe(true);
    expect(g.overridePrice).toBe(true);
    expect(g.removeShipment).toBe(true);
    expect(g.note).toBe(true);
    expect(g.operate).toBe(false);
    expect(g.requestQuote).toBe(false);
    expect(g.removeLeg).toBe(false); // no está en el catálogo de la prueba
  });

  it("reabrir: no se ofrece si el proyecto ya está convertido", () => {
    const acts = { reopen: { from: ["P", "C"] } };
    expect(projectGates(acts, "C", null).reopen).toBe(true);
    expect(projectGates(acts, "C", null, "no").reopen).toBe(true);
    expect(projectGates(acts, "C", null, "parcial").reopen).toBe(false);
    expect(projectGates(acts, "C", null, "completo").reopen).toBe(false);
  });

  it("operar y convertir: no se ofrecen con la conversión completa; sí sin ella o a medias", () => {
    const acts = { operate: { from: ["C"] }, convert: { from: ["C"] } };
    expect(projectGates(acts, "C", null, "no").operate).toBe(true);
    expect(projectGates(acts, "C", null, null).convert).toBe(true);
    expect(projectGates(acts, "C", null, "parcial").operate).toBe(true);
    expect(projectGates(acts, "C", null, "parcial").convert).toBe(true);
    expect(projectGates(acts, "C", null, "completo").operate).toBe(false);
    expect(projectGates(acts, "C", null, "completo").convert).toBe(false);
  });

  it("isViewMissing: solo la ausencia de la vista, no los fallos reales", () => {
    for (const status of [400, 404, 405, 501]) {
      expect(isViewMissing({ status })).toBe(true);
    }
    for (const status of [0, 401, 403, 409, 500, 502, 504]) {
      expect(isViewMissing({ status })).toBe(false);
    }
  });

  it("tomar: solo A/P sin asignar y si el catálogo lo tiene", () => {
    expect(projectGates(actions, "A", null).take).toBe(true);
    expect(projectGates(actions, "A", 5).take).toBe(false);
    expect(projectGates(actions, "C", null).take).toBe(false);
    expect(projectGates(actions, "X", null).take).toBe(false);
    expect(projectGates({}, "A", null).take).toBe(false);
    expect(canTakeRow(actions, { stato: "P", assegnato_a: null })).toBe(true);
  });

  it("sin meta no hay botones", () => {
    const g = projectGates(null, "P", null);
    expect(Object.values(g).some(Boolean)).toBe(false);
  });
});

describe("perfil de la house (update_profile)", () => {
  it("profileFormFrom: todo texto, vacío si falta, países/EORI/incoterm en mayúsculas", () => {
    const f = profileFormFrom({
      esportatore_paese: " it ",
      esportatore_eori: "it 123 456",
      incoterm: "dap",
      mittente_tel: null,
      note: "  hola ",
    });
    expect(f.esportatore_paese).toBe("IT");
    expect(f.esportatore_eori).toBe("IT123456");
    expect(f.incoterm).toBe("DAP");
    expect(f.mittente_tel).toBe("");
    expect(f.note).toBe("hola");
    expect(f.hs_code).toBe("");
    expect(profileFormFrom(null).note).toBe("");
  });

  it("profilePayload: solo los campos que cambian; vaciar un campo manda cadena vacía", () => {
    const initial = profileFormFrom({
      mittente_tel: "123",
      destinatario_nome: "ACME",
    });
    const form = { ...initial };
    expect(profilePayload(form, initial)).toEqual({});
    form.mittente_tel = "456";
    form.destinatario_nome = "";
    form.esportatore_paese = "fr";
    expect(profilePayload(form, initial)).toEqual({
      mittente_tel: "456",
      destinatario_nome: "",
      esportatore_paese: "FR",
    });
  });

  it("profilePayload: espacios y mayúsculas sin efecto real no cuentan como cambio", () => {
    const initial = profileFormFrom({ incoterm: "DAP", note: "x" });
    const form = { ...initial, incoterm: " dap ", note: " x " };
    expect(profilePayload(form, initial)).toEqual({});
  });

  it("housesWithoutShipment: solo las houses sin spedizione", () => {
    const rows = [
      { ref: "A", id_spedizione: null },
      { ref: "B", id_spedizione: 5 },
      { ref: "C", id_spedizione: 0 },
    ];
    expect(housesWithoutShipment(rows).map((h) => h.ref)).toEqual(["A", "C"]);
    expect(housesWithoutShipment(null)).toEqual([]);
  });

  it("projectGates.updateProfile sigue el catálogo del API", () => {
    const acts = { update_profile: { from: ["A", "P", "C"] } };
    expect(projectGates(acts, "C", null).updateProfile).toBe(true);
    expect(projectGates(acts, "X", null).updateProfile).toBe(false);
    expect(projectGates({}, "C", null).updateProfile).toBe(false);
  });
});

describe("formato y otros", () => {
  it("formatMoney usa Intl con moneda", () => {
    expect(formatMoney(1234.5, "EUR", "es")).toBe(
      new Intl.NumberFormat("es", {
        style: "currency",
        currency: "EUR",
      }).format(1234.5),
    );
    expect(formatMoney(null, "EUR")).toBe("—");
    expect(formatMoney(3, "")).toMatch(/^3/);
  });

  it("logActionI18nKey solo para acciones conocidas", () => {
    expect(logActionI18nKey("take")).toBe("consolidata.history.actions.take");
    expect(logActionI18nKey("raro")).toBeNull();
  });

  it("groupConversionSteps: primero MAWB/camión, después por house en orden", () => {
    const g = groupConversionSteps([
      {
        passo: "casa",
        chiave: "H1",
        stato: "OK",
        tentativi: 1,
        risultato_id: 3,
      },
      {
        passo: "cargo",
        chiave: "4",
        stato: "OK",
        tentativi: 1,
        risultato_id: 77,
      },
      {
        passo: "spedizione",
        chiave: "H1",
        stato: "ERRORE",
        tentativi: 2,
        risultato_id: null,
      },
      {
        passo: "spedizione",
        chiave: "H2",
        stato: "OK",
        tentativi: 1,
        risultato_id: 9,
      },
    ]);
    expect(g.map((x) => (x.global ? "*" : x.key))).toEqual(["*", "H1", "H2"]);
    expect(g[1].steps.map((s) => s.passo)).toEqual(["spedizione", "casa"]);
  });

  it("legPayload usa claves inglesas y omite vacíos; precio manual solo si se pide", () => {
    const f = {
      tipo: "AIR" as const,
      origin: { country: "it", zip: "", city: "Milano", terminal: "mxp" },
      destination: { country: "us", zip: "10001", city: "", terminal: "" },
      weight: 100,
      value: null,
      goods: " ",
      note: "",
      prezzo: 50,
      fuel: null,
      supplementi: null,
    };
    expect(legPayload(f, false)).toEqual({
      tipo: "AIR",
      origin: { country: "IT", zip: "", city: "Milano", terminal: "MXP" },
      destination: { country: "US", zip: "10001", city: "" },
      weight: 100,
    });
    expect(legPayload(f, true).manual_price).toEqual({ prezzo: 50 });
    expect(legPayload(f, true).price_source).toBe("manuale");
  });

  it("ageDays", () => {
    expect(
      ageDays("2026-11-01 10:00:00", new Date("2026-11-03T12:00:00")),
    ).toBe(2);
    expect(ageDays(null)).toBeNull();
  });
});

describe("navTargets", () => {
  it("detailHref('consolidata', id) apunta siempre a la SPA operations", async () => {
    const { detailHref } = await import("@shared/platform/navTargets");
    expect(detailHref("consolidata", 12)).toBe("/ops/consolidata/12");
  });
});
