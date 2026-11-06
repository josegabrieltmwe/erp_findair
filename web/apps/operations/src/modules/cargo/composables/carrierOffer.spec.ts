import { describe, expect, it } from "vitest";
import { bannerFor, chargeAmount, chargeTypeKey, failureKeys, formatMoney, hasOwnValue, plainNote, shortDate } from "./carrierOffer";
import type { CarrierCharge } from "@cargo/services/carrier_offer.service";

describe("carrierOffer · avisos de estado", () => {
  it("abierta: sin aviso; respondida: se puede cambiar; revisada: cerrada", () => {
    expect(bannerFor({ state: "open" })).toBeNull();
    expect(bannerFor({ state: "answered" })).toEqual({ kind: "info", key: "banner_answered" });
    expect(bannerFor({ state: "locked" })).toEqual({ kind: "warning", key: "banner_locked" });
  });
});

describe("carrierOffer · importes", () => {
  it("el cero y el centinela de «sin máximo» no se muestran como importe", () => {
    expect(chargeAmount(0)).toBe("—");
    expect(chargeAmount("0.00")).toBe("—");
    expect(chargeAmount(null)).toBe("—");
    expect(chargeAmount("")).toBe("—");
    expect(chargeAmount("abc")).toBe("—");
    expect(chargeAmount(9999999, { maxSentinel: true })).toBe("—");
    expect(chargeAmount(9999999)).toBe("9,999,999.00");
  });

  it("formatea con dos decimales y la moneda de la oferta", () => {
    expect(chargeAmount("5.5")).toBe("5.50");
    expect(chargeAmount(1250)).toBe("1,250.00");
    expect(formatMoney(120.5, "USD")).toBe("120.50 USD");
  });

  it("reconoce el tipo de cargo y deja pasar los desconocidos", () => {
    expect(chargeTypeKey("kg")).toBe("type_kg");
    expect(chargeTypeKey("fix")).toBe("type_fix");
    expect(chargeTypeKey("box")).toBe("type_box");
    expect(chargeTypeKey("otro")).toBeNull();
    expect(chargeTypeKey(null)).toBeNull();
  });

  it("detecta si la aerolínea ya puso importe propio en la línea", () => {
    const base = { id: 1, tipo: "S", type: "fix", code: "A", nome: "A", costo_unit: 1, costo_min: 0, costo_max: 0, costo_unitV: 0, costo_minV: 0, costo_maxV: 0 } as CarrierCharge;
    expect(hasOwnValue(base)).toBe(false);
    expect(hasOwnValue({ ...base, costo_minV: "12.5" })).toBe(true);
  });
});

describe("carrierOffer · la nota del operador es texto, nunca HTML", () => {
  it("conserva los saltos de línea del legado (<br>) y descarta cualquier otra etiqueta", () => {
    expect(plainNote("Hola<br>Adiós<BR/>Fin")).toBe("Hola\nAdiós\nFin");
    expect(plainNote("<script>alert(1)</script>Urgent <b>quote</b>")).toBe("alert(1)Urgent quote");
    expect(plainNote('<img src=x onerror="alert(1)">ok')).toBe("ok");
  });

  it("nulos y entidades", () => {
    expect(plainNote(null)).toBe("");
    expect(plainNote(undefined)).toBe("");
    expect(plainNote("A&nbsp;&amp;&nbsp;B &lt;3")).toBe("A & B <3");
  });
});

describe("carrierOffer · fechas", () => {
  it("formatea la fecha del API y trata la fecha vacía de MySQL como ausente", () => {
    expect(shortDate("2026-11-05 10:00:00")).toBe("Nov 5, 2026");
    expect(shortDate("0000-00-00 00:00:00")).toBe("");
    expect(shortDate("")).toBe("");
    expect(shortDate(null)).toBe("");
    expect(shortDate("no es una fecha")).toBe("");
  });
});

describe("carrierOffer · por qué no hay vista", () => {
  it("un enlace inválido y una oferta que no existe dicen lo mismo (no hay oráculo)", () => {
    expect(failureKeys("invalid")).toEqual(failureKeys("not_found"));
    expect(failureKeys("invalid").retry).toBe(false);
  });

  it("solo «no se pudo comprobar» se puede reintentar", () => {
    expect(failureKeys("unavailable").retry).toBe(true);
    for (const r of ["invalid", "locked", "in_use", "expired", "session_lost", "not_found"] as const) {
      expect(failureKeys(r).retry).toBe(false);
    }
  });

  it("sesión perdida y sesión inexistente al recargar son lo mismo para la persona", () => {
    expect(failureKeys("session_lost")).toEqual(failureKeys("expired"));
  });
});
