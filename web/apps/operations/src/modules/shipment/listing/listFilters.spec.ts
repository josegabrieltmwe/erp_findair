import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
vi.mock("@cargo/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
import {
  SHIPMENT_LIST_DEFAULTS,
  buildShipmentListQuery,
} from "@shipment/stores/shipment_list.store";
import {
  CARGO_LIST_DEFAULTS,
  buildCargoListQuery,
} from "@cargo/stores/cargo_list.store";
import { filterOptionLabel, toSelectItems } from "@shared/listing/filterOptions";
import {
  LOCATION_SCOPE_OPTIONS,
  SHIPMENT_FILTER_OPTIONS,
} from "./shipment-filter-options";
import { CARGO_FILTER_OPTIONS } from "@cargo/listing/cargo-filter-options";
import { isRealTmweUser, listViewMode } from "@shared/platform/tmweSession";
import {
  classifyDetailLoadError,
  errorCodeFromThrown,
  isPermanentDetailLoadError,
} from "@shared/detail/detailLoadError";

const t = (k: string) => `T(${k})`;

function setBootstrap(v: Record<string, unknown> | undefined): void {
  (globalThis as unknown as { window?: unknown }).window =
    v === undefined ? undefined : { __TMWE_OPERATIONS__: v };
}
afterEach(() => setBootstrap(undefined));

describe("location_type fantasma (express)", () => {
  it("sin dirección no envía location_type aunque el estado traiga 'D'", () => {
    const q = buildShipmentListQuery({ ...SHIPMENT_LIST_DEFAULTS, location_type: "D" });
    expect(q.location_type).toBeUndefined();
    expect(q.country_iso).toBeUndefined();
  });

  it("país sin lado: envía country_iso solo (origen o destino)", () => {
    const q = buildShipmentListQuery({ ...SHIPMENT_LIST_DEFAULTS, country_iso: "IT" });
    expect(q.country_iso).toBe("IT");
    expect(q.location_type).toBeUndefined();
  });

  it("país o ciudad con lado: envía el lado", () => {
    expect(
      buildShipmentListQuery({ ...SHIPMENT_LIST_DEFAULTS, country_iso: "IT", location_type: "P" })
        .location_type,
    ).toBe("P");
    expect(
      buildShipmentListQuery({ ...SHIPMENT_LIST_DEFAULTS, city: "MILANO", location_type: "D" })
        .location_type,
    ).toBe("D");
  });

  it("el selector de lado ofrece «Origen o destino» con valor ''", () => {
    expect(toSelectItems(LOCATION_SCOPE_OPTIONS, t)[0]).toEqual({
      title: "T(filters.value.any_side)",
      value: "",
    });
  });
});

describe("cerca_pd fantasma (cargo)", () => {
  it("sin país no envía cerca_pd; país sin lado se envía solo", () => {
    expect(buildCargoListQuery({ ...CARGO_LIST_DEFAULTS, cerca_pd: "D" }).cerca_pd).toBeUndefined();
    const q = buildCargoListQuery({ ...CARGO_LIST_DEFAULTS, paesex: "US" });
    expect(q.paesex).toBe("US");
    expect(q.cerca_pd).toBeUndefined();
  });
});

describe("chips de filtro con el texto de la opción", () => {
  it("«Controlada: S» pasa a la etiqueta de la opción", () => {
    expect(filterOptionLabel(SHIPMENT_FILTER_OPTIONS.controllata, "S", t)).toBe("T(common.yes)");
    expect(filterOptionLabel(SHIPMENT_FILTER_OPTIONS.controllata, "O", t)).toBe(
      "T(enums.controllata.offer)",
    );
    expect(filterOptionLabel(SHIPMENT_FILTER_OPTIONS.presa_stato, "W", t)).toBe(
      "T(enums.presa_stato.in_progress)",
    );
    expect(filterOptionLabel(CARGO_FILTER_OPTIONS.gestione, "F", t)).toBe("T(enums.gestione.quoting)");
  });

  it("valor desconocido o campo sin lista: se muestra tal cual", () => {
    expect(filterOptionLabel(SHIPMENT_FILTER_OPTIONS.stato_giac, "Z", t)).toBe("Z");
    expect(filterOptionLabel(undefined, "123", t)).toBe("123");
  });
});

describe("view_mode=erp para el personal TMWE", () => {
  it("TMWE sin suplantar: erp en express y cargo", () => {
    setBootstrap({ isTmwe: true });
    expect(listViewMode()).toBe("erp");
    expect(buildShipmentListQuery(SHIPMENT_LIST_DEFAULTS).view_mode).toBe("erp");
    expect(buildCargoListQuery(CARGO_LIST_DEFAULTS).view_mode).toBe("erp");
  });

  it("partner, sin bootstrap o TMWE suplantando: no se envía", () => {
    setBootstrap({ isTmwe: false });
    expect(buildShipmentListQuery(SHIPMENT_LIST_DEFAULTS).view_mode).toBeUndefined();
    setBootstrap(undefined);
    expect(listViewMode()).toBeUndefined();
    setBootstrap({ isTmwe: true, impersonating: true });
    expect(listViewMode()).toBeUndefined();
    // El selector de partner sigue disponible suplantando (usuario real TMWE).
    expect(isRealTmweUser()).toBe(true);
  });

  it("selector de partner: oculto para no-TMWE (sin GET /bff/impersonation)", () => {
    setBootstrap({ isTmwe: false });
    expect(isRealTmweUser()).toBe(false);
  });
});

describe("error al abrir el detalle", () => {
  it("clasifica por código", () => {
    for (const c of ["ACCESS_DENIED", "SHIPMENT_ACCESS_DENIED", "FORBIDDEN"]) {
      expect(classifyDetailLoadError(c)).toBe("access_denied");
    }
    expect(classifyDetailLoadError("NOT_FOUND")).toBe("not_found");
    expect(classifyDetailLoadError("SERVER_ERROR")).toBe("generic");
    expect(classifyDetailLoadError(null)).toBe("generic");
  });

  it("solo el genérico ofrece reintentar", () => {
    expect(isPermanentDetailLoadError("access_denied")).toBe(true);
    expect(isPermanentDetailLoadError("not_found")).toBe(true);
    expect(isPermanentDetailLoadError("generic")).toBe(false);
  });

  it("código desde la excepción del cliente http", () => {
    expect(errorCodeFromThrown({ status: 403, errorCode: "FORBIDDEN" })).toBe("FORBIDDEN");
    expect(errorCodeFromThrown({ status: 404 })).toBe("NOT_FOUND");
    expect(errorCodeFromThrown({ status: 500 })).toBeNull();
    expect(errorCodeFromThrown(new Error("net"))).toBeNull();
  });
});
