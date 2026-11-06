import { describe, expect, it } from "vitest";
import {
  allRatesWithoutMargin,
  isNoMarginReason,
  marginNotice,
  notSelectableMessage,
  NO_MARGIN_REASON,
} from "./marginNotice";

const t = (k: string) => `[${k}]`;

describe("marginNotice", () => {
  it("sin `margin` (API antiguo) o null no avisa", () => {
    expect(marginNotice(undefined)).toBeNull();
    expect(marginNotice(null)).toBeNull();
  });

  it("con margen configurado no avisa", () => {
    expect(marginNotice({ client_id: 7, cargo_configured: true, can_configure: true })).toBeNull();
  });

  it("sin margen avisa y ofrece configurar solo con can_configure", () => {
    expect(marginNotice({ client_id: 7, cargo_configured: false, can_configure: true })).toEqual({
      clientId: 7,
      canConfigure: true,
    });
    expect(marginNotice({ client_id: 7, cargo_configured: false, can_configure: false })).toEqual({
      clientId: 7,
      canConfigure: false,
    });
  });

  it("sin cliente válido no ofrece el enlace aunque pueda configurar", () => {
    expect(marginNotice({ client_id: 0, cargo_configured: false, can_configure: true })?.canConfigure).toBe(false);
  });
});

describe("razón no seleccionable", () => {
  it("reconoce la falta de margen, con o sin detalle", () => {
    expect(isNoMarginReason(NO_MARGIN_REASON)).toBe(true);
    expect(isNoMarginReason(`${NO_MARGIN_REASON}:A`)).toBe(true);
    expect(isNoMarginReason("pricing_incomplete:fx_missing")).toBe(false);
    expect(isNoMarginReason(null)).toBe(false);
  });

  it("mensaje comprensible para la falta de margen, sin invitar a relanzar", () => {
    const msg = notSelectableMessage(NO_MARGIN_REASON, t);
    expect(msg).toBe("[cargo.flight.no_margin_not_selectable]");
    expect(msg).not.toContain("relaunch_search");
  });

  it("conserva quote_on_request y el genérico", () => {
    expect(notSelectableMessage("quote_on_request", t)).toBe("[cargo.flight.quote_on_request]");
    expect(notSelectableMessage("quote_on_request:MANUAL_LOAD_CHECK", t)).toBe(
      "[cargo.flight.quote_manual_load_check]",
    );
    expect(notSelectableMessage("pricing_incomplete:fx_missing", t)).toBe(
      "[cargo.flight.rate_not_assignable] (pricing_incomplete:fx_missing). [cargo.flight.relaunch_search]",
    );
    expect(notSelectableMessage("", t)).toBe("[cargo.flight.rate_not_assignable]. [cargo.flight.relaunch_search]");
  });

  it("allRatesWithoutMargin: todas bloqueadas por margen, y nunca con lista vacía", () => {
    const blocked = { selectable: false, not_selectable_reason: NO_MARGIN_REASON };
    expect(allRatesWithoutMargin([])).toBe(false);
    expect(allRatesWithoutMargin([blocked, blocked])).toBe(true);
    expect(allRatesWithoutMargin([blocked, { selectable: true }])).toBe(false);
    expect(allRatesWithoutMargin([blocked, { selectable: false, not_selectable_reason: "quote_on_request" }])).toBe(
      false,
    );
  });
});
