import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  buildSupplierListQuery,
  canConfirmImport,
  classifyImportError,
  controlStateOf,
  defaultSupplier,
  MAX_XML_BYTES,
  parseShipmentIds,
  supplierInvoiceApi,
  validateNewSupplierInvoice,
  validateXmlFile,
  type ImportPreview,
} from "./supplierInvoice.service";

beforeEach(() => httpMock.mockReset());

describe("validateXmlFile", () => {
  it("acepta xml y p7m dentro del tamaño", () => {
    expect(validateXmlFile({ name: "IT01.XML", size: 100 })).toBe("ok");
    expect(validateXmlFile({ name: "a.xml.p7m", size: 100 })).toBe("ok");
  });
  it("rechaza tipo, tamaño y ausencia", () => {
    expect(validateXmlFile({ name: "a.pdf", size: 1 })).toBe("bad_type");
    expect(validateXmlFile({ name: "a.xml", size: MAX_XML_BYTES + 1 })).toBe(
      "too_big",
    );
    expect(validateXmlFile(null)).toBe("missing");
  });
});

describe("buildSupplierListQuery", () => {
  it("omite vacíos", () => {
    expect(
      buildSupplierListQuery({
        data_da: "2026-01-01",
        numero: "",
        controllo_stato: "R",
        page: 2,
        id_anagrafica: undefined,
      }),
    ).toEqual({ data_da: "2026-01-01", controllo_stato: "R", page: 2 });
  });
});

describe("classifyImportError", () => {
  it("distingue duplicada, XML no válido y otros", () => {
    expect(classifyImportError({ status: 409, message: "dup" }).kind).toBe(
      "duplicate",
    );
    expect(
      classifyImportError({
        status: 422,
        errorCode: "SUPPLIER_XML_INVALID",
        message: "mal",
      }),
    ).toEqual({ kind: "invalid", message: "mal" });
    expect(classifyImportError({ status: 500 }).kind).toBe("other");
  });
});

describe("canConfirmImport", () => {
  const base: ImportPreview = {
    supplier_candidates: [{ id: 5, rag_soc: "ACME" }],
    blocking: [],
  };
  it("exige proveedor elegido entre los candidatos", () => {
    expect(canConfirmImport(base, null)).toBe(false);
    expect(canConfirmImport(base, 9)).toBe(false);
    expect(canConfirmImport(base, 5)).toBe(true);
  });
  it("los bloqueos y el duplicado impiden confirmar", () => {
    expect(canConfirmImport({ ...base, blocking: ["x"] }, 5)).toBe(false);
    expect(canConfirmImport({ ...base, duplicate_id: 77 }, 5)).toBe(false);
    expect(canConfirmImport(null, 5)).toBe(false);
  });
  it("preselecciona solo si hay un candidato", () => {
    expect(defaultSupplier(base)).toBe(5);
    expect(
      defaultSupplier({
        supplier_candidates: [
          { id: 1, rag_soc: "a" },
          { id: 2, rag_soc: "b" },
        ],
      }),
    ).toBeNull();
    expect(defaultSupplier({ supplier_candidates: [] })).toBeNull();
  });
});

describe("controlStateOf", () => {
  it("cae a N con valores desconocidos", () => {
    expect(controlStateOf("S")).toBe("S");
    expect(controlStateOf("R")).toBe("R");
    expect(controlStateOf(null)).toBe("N");
    expect(controlStateOf("Z")).toBe("N");
  });
});

describe("supplierInvoiceApi", () => {
  it("list devuelve items y total", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [{ id: 1 }],
      pagination: { total: 9 },
    });
    const r = await supplierInvoiceApi.list({ page: 1 });
    expect(httpMock.mock.calls[0][0]).toBe("/api_supplier_invoices");
    expect(r).toEqual({ items: [{ id: 1 }], total: 9 });
  });
  it("setControlState hace PUT {id, controllo_stato}", async () => {
    httpMock.mockResolvedValue({ success: true });
    await supplierInvoiceApi.setControlState(4, "S");
    expect(httpMock.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: { id: 4, controllo_stato: "S" },
    });
  });
  it("importXml sube multipart con xml e id_anagrafica", async () => {
    httpMock.mockResolvedValue({ success: true, data: { id: 3 } });
    const file = new File(["<x/>"], "a.xml");
    await supplierInvoiceApi.importXml(file, 12);
    const [, opts] = httpMock.mock.calls[0];
    expect(opts.query).toEqual({ op: "import_xml" });
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get("id_anagrafica")).toBe("12");
    expect(opts.body.get("xml")).toBeInstanceOf(File);
  });
  it("importPreview usa la operación de previsualización", async () => {
    httpMock.mockResolvedValue({ success: true, data: { numero: "1" } });
    const r = await supplierInvoiceApi.importPreview(new File(["x"], "a.xml"));
    expect(httpMock.mock.calls[0][1].query).toEqual({
      op: "import_xml_preview",
    });
    expect(r.numero).toBe("1");
  });
});

describe("alta manual y vínculo de expediciones", () => {
  const ok = {
    id_anagrafica: 3,
    numero_alfanum: "F-1",
    data_fattura: "2026-10-14",
    importo_netto: 100,
    importo_iva: 0,
    valuta_sigla: "EUR",
  };
  it("valida el alta", () => {
    expect(validateNewSupplierInvoice(ok)).toBe("ok");
    expect(validateNewSupplierInvoice({ ...ok, id_anagrafica: 0 })).toBe(
      "supplier",
    );
    expect(validateNewSupplierInvoice({ ...ok, numero_alfanum: "  " })).toBe(
      "number",
    );
    expect(
      validateNewSupplierInvoice({ ...ok, data_fattura: "14/10/2026" }),
    ).toBe("date");
    expect(validateNewSupplierInvoice({ ...ok, importo_netto: 0 })).toBe(
      "amount",
    );
    expect(validateNewSupplierInvoice({ ...ok, importo_iva: -1 })).toBe(
      "amount",
    );
    expect(validateNewSupplierInvoice({ ...ok, valuta_sigla: "eur" })).toBe(
      "currency",
    );
  });
  it("interpreta la lista de ids sin repetidos ni basura", () => {
    expect(parseShipmentIds("101, 102 103\n104;101 x 0 -5 7a")).toEqual([
      101, 102, 103, 104,
    ]);
    expect(parseShipmentIds("")).toEqual([]);
  });
  it("busca proveedores con op=suppliers", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [{ id: 3, rag_soc: "DHL", pi_cf: "", tipo: "T" }],
    });
    const r = await supplierInvoiceApi.suppliers("  dhl ");
    expect(httpMock.mock.calls[0][1].query).toEqual({
      op: "suppliers",
      per_page: 25,
      search: "dhl",
    });
    expect(r).toHaveLength(1);
    httpMock.mockResolvedValue({ success: true, data: null });
    expect(await supplierInvoiceApi.suppliers("")).toEqual([]);
    expect(httpMock.mock.calls[1][1].query).toEqual({
      op: "suppliers",
      per_page: 25,
    });
  });
  it("crea la factura y devuelve su id", async () => {
    httpMock.mockResolvedValue({ success: true, data: { id: 55 } });
    expect(await supplierInvoiceApi.create(ok)).toBe(55);
    expect(httpMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: ok,
    });
  });
  it("vincula express o cargo con la clave que espera el servidor", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { linked: 1, already_linked: 0, total_requested: 2, errors: ["x"] },
    });
    const r = await supplierInvoiceApi.linkShipments(9, [1, 2], "express");
    expect(httpMock.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: { id: 9, shipment_ids: [1, 2] },
    });
    expect(r).toEqual({
      linked: 1,
      already_linked: 0,
      total_requested: 2,
      errors: ["x"],
    });
    await supplierInvoiceApi.linkShipments(9, [3], "cargo");
    expect(httpMock.mock.calls[1][1].body).toEqual({
      id: 9,
      cargo_shipment_ids: [3],
    });
  });
});
