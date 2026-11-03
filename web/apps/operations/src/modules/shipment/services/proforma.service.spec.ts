import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => http(...a) }));

import { proformaService } from "./proforma.service";

// Contrato real de tmwe_api (Proforma_Crud_Controller / Proforma_Lookup_Controller / Proforma_File_Controller).
const LIST = {
  data: [{ id: "6806", id_spedizione: "1001084098" }],
  pagination: {},
};
const ONE = {
  success: true,
  data: {
    id: "6806",
    id_spedizione: "1001084098",
    motivo: "S",
    id_valuta: "1",
    items: [
      {
        descrizione: "X",
        qta: "2",
        valore: "3.5",
        peso_netto: "1",
        peso_lordo: "1.2",
      },
    ],
  },
};

describe("proformaService", () => {
  beforeEach(() => http.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("get: lista por expedición y luego ficha con items (antes leía {proforma} y salía vacío)", async () => {
    http.mockResolvedValueOnce(LIST).mockResolvedValueOnce(ONE);
    const r = await proformaService.get(1001084098);
    expect(http.mock.calls[0][1].query).toEqual({ id_spedizione: 1001084098 });
    expect(http.mock.calls[1][1].query).toEqual({ id: "6806" });
    expect(r.success).toBe(true);
    expect(r.proforma?.id_valuta).toBe(1);
    expect(r.proforma?.items[0]).toMatchObject({ qta: 2, valore: 3.5 });
  });

  it("get: sin proforma devuelve proforma null", async () => {
    http.mockResolvedValueOnce({ data: [], pagination: {} });
    expect(await proformaService.get(5)).toEqual({
      success: true,
      proforma: null,
    });
  });

  it("save: actualiza (PUT) si ya existe, para no chocar con PROFORMA_DUPLICATE", async () => {
    http.mockResolvedValueOnce(LIST).mockResolvedValueOnce(ONE);
    await proformaService.save(1001084098, { motivo: "S" }, []);
    expect(http.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: { id: "6806", motivo: "S", items: [] },
    });
  });

  it("save: crea (POST) si no existe", async () => {
    http.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce(ONE);
    await proformaService.save(7, {}, []);
    expect(http.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: { id_spedizione: 7 },
    });
  });

  it("lookup: normaliza filas {sigla_dhl, descriz}", async () => {
    http
      .mockResolvedValueOnce({
        success: true,
        data: [{ sigla_dhl: "S", descriz: "SAMPLE " }],
      })
      .mockResolvedValueOnce({ success: true, data: [{ sigla_dhl: "PCS" }] });
    const r = await proformaService.lookup();
    expect(r.motivi).toEqual([{ id: "S", descr: "SAMPLE" }]);
    expect(r.units).toEqual(["PCS"]);
  });

  it("generatePdf: el endpoint devuelve el binario; se abre como blob", async () => {
    const pdf = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(pdf, {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      ),
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => undefined,
    });
    expect(await proformaService.generatePdf(7)).toEqual({
      success: true,
      url: "blob:x",
    });
  });

  it("generatePdf: un error del BFF se devuelve con su detalle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "No proforma invoice" }), {
          status: 404,
          headers: { "content-type": "application/problem+json" },
        }),
      ),
    );
    expect(await proformaService.generatePdf(7)).toEqual({
      success: false,
      error: "No proforma invoice",
    });
  });

  it("duplicate: envía el id de la proforma origen y target_shipment_id", async () => {
    http.mockResolvedValueOnce(LIST).mockResolvedValueOnce({ success: true });
    expect(await proformaService.duplicate(1001084098, 7)).toEqual({
      success: true,
    });
    expect(http.mock.calls[1]).toEqual([
      "/api_proforma_duplicate",
      { method: "POST", body: { id: "6806", target_shipment_id: 7 } },
    ]);
  });

  it("duplicate: sin proforma en el origen no llama a la API", async () => {
    http.mockResolvedValueOnce({ data: [] });
    expect(await proformaService.duplicate(1, 7)).toEqual({
      success: false,
      error: "NO_SOURCE_PROFORMA",
    });
    expect(http).toHaveBeenCalledTimes(1);
  });
});
