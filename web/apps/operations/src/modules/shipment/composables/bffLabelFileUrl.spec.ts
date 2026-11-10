import { describe, it, expect } from "vitest";
import { bffLabelFileUrl, absoluteUrl } from "./useCourierLabels";

// get_label_courier_shipment devuelve la URL absoluta del API; desde el ERP el navegador no lleva sesion a ese host
// (401, 1001084298). La etiqueta se pide por el BFF, conservando la query.
describe("bffLabelFileUrl", () => {
  it("pasa la etiqueta del API al BFF", () => {
    expect(
      bffLabelFileUrl(
        "https://sandbox.api.findair.it/erp/tmwe_json/get_label_file?shipment_id=1001084298&package_number=1",
        "/bff/v1",
      ),
    ).toBe("/bff/v1/get_label_file?shipment_id=1001084298&package_number=1");
  });

  it("tambien los documentos auxiliares y la forma ?action=", () => {
    expect(
      bffLabelFileUrl("/erp/tmwe_json/?action=get_label_auxiliar_file&shipment_id=5&package_number=1&auxiliar_number=2", "/bff/v1/"),
    ).toBe("/bff/v1/get_label_auxiliar_file?shipment_id=5&package_number=1&auxiliar_number=2");
  });

  it("deja igual otras URLs y la vacia", () => {
    const other = "https://cdn.example.com/label.pdf";
    expect(bffLabelFileUrl(other, "/bff/v1")).toBe(other);
    expect(bffLabelFileUrl("", "/bff/v1")).toBe("");
  });
});

// La impresion monta un documento blob: con las <img>; en un blob: una ruta relativa no tiene base y la imagen no se
// pide (pagina en blanco, 1001084298). labelUrl usa la URL absoluta.
describe("absoluteUrl", () => {
  it("antepone el origen a una ruta relativa", () => {
    expect(absoluteUrl("/bff/v1/get_label_file?shipment_id=1&package_number=1", "https://sandbox.erp.findair.it")).toBe(
      "https://sandbox.erp.findair.it/bff/v1/get_label_file?shipment_id=1&package_number=1",
    );
  });
  it("deja igual una URL absoluta y la vacia", () => {
    expect(absoluteUrl("https://cdn.example.com/a.pdf", "https://sandbox.erp.findair.it")).toBe("https://cdn.example.com/a.pdf");
    expect(absoluteUrl("", "https://sandbox.erp.findair.it")).toBe("");
  });
});

// Etiquetas apaisadas (FedEx 1400x950, UPS...) se giran 270° para verse en vertical; se decide por la imagen.
