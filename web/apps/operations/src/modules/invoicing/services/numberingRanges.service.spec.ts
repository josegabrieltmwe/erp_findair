import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  buildCloseBody,
  buildCreateBody,
  buildListQuery,
  buildPreviewQuery,
  isOpenRange,
  numberingRangesService,
} from "./numberingRanges.service";

beforeEach(() => httpMock.mockReset());

describe("numberingRanges.service", () => {
  it("arma las consultas", () => {
    expect(buildListQuery()).toBe("op=list");
    expect(buildListQuery(7)).toBe("op=list&id_engine=7");
    expect(buildPreviewQuery(7, "2026-10-15", 3)).toBe(
      "op=preview&id_engine=7&fecha=2026-10-15&n=3",
    );
    expect(buildPreviewQuery(7)).toBe("op=preview&id_engine=7");
  });

  it("detecta rangos abiertos", () => {
    expect(isOpenRange({ data_fine: null })).toBe(true);
    expect(isOpenRange({ data_fine: "0000-00-00" })).toBe(true);
    expect(isOpenRange({ data_fine: "2026-12-31" })).toBe(false);
  });

  it("arma el cuerpo de creacion sin campos vacios", () => {
    expect(
      buildCreateBody(
        {
          id_engine: 3,
          formato: " INV-{anno}-{n:4} ",
          data_inizio: "2026-10-15",
          motivo: " alta ",
        },
        false,
      ),
    ).toEqual({
      id_engine: 3,
      formato: "INV-{anno}-{n:4}",
      data_inizio: "2026-10-15",
      motivo: "alta",
      confirmar: false,
    });
    const full = buildCreateBody(
      {
        id_engine: 3,
        formato: "X{n}",
        data_inizio: "2026-01-01",
        data_fine: "2026-12-31",
        reinicio: "ANUAL",
        valore_iniziale: 458,
        motivo: "m",
      },
      true,
    );
    expect(full).toMatchObject({
      data_fine: "2026-12-31",
      reinicio: "ANUAL",
      valore_iniziale: 458,
      confirmar: true,
    });
  });

  it("arma el cuerpo de cierre", () => {
    expect(buildCloseBody(3, 9, "2026-12-31", " fin ")).toEqual({
      op: "close",
      id_engine: 3,
      id: 9,
      data_fine: "2026-12-31",
      motivo: "fin",
    });
  });

  it("envia create y close por op=", async () => {
    httpMock.mockResolvedValue({ data: { guardado: false } });
    await numberingRangesService.create(
      { id_engine: 1, formato: "{n}", data_inizio: "2026-01-01", motivo: "m" },
      false,
    );
    expect(httpMock.mock.calls[0][0]).toBe("/api_invoice_numbering_ranges?op=create");
    expect(httpMock.mock.calls[0][1].method).toBe("POST");
    await numberingRangesService.close(1, 2, "2026-12-31", "m");
    expect(httpMock.mock.calls[1][0]).toBe("/api_invoice_numbering_ranges?op=close");
  });
});
