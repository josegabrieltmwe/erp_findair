import { packagesParam, type LabelSelection } from "./labelPackages";

/**
 * URLs de los binarios que genera el servidor (BFF → tmwe_api). `packages` solo reduce lo empaquetado; la
 * propiedad de la expedición la comprueba siempre el API. `inline` hace que el navegador lo muestre/imprima en
 * vez de descargarlo.
 */
function build(
  base: string,
  action: string,
  params: Record<string, string | number | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return `${base.replace(/\/+$/, "")}/${action}?${q.toString()}`;
}

export function tmweBundleUrl(
  base: string,
  shipmentId: number,
  sel: Pick<LabelSelection, "packages" | "format">,
  inline = false,
): string {
  return build(base, "api_label_tmwe_bundle", {
    shipment_id: shipmentId,
    bundle: sel.format,
    packages: packagesParam({
      scope: "all",
      packages: sel.packages,
      format: sel.format,
    }),
    disposition: inline ? "inline" : undefined,
  });
}

export function courierCombinedPdfUrl(
  base: string,
  shipmentId: number,
  packages: number[] | null,
  inline = false,
): string {
  return build(base, "api_label_combined_pdf", {
    shipment_id: shipmentId,
    packages: packagesParam({ scope: "all", packages, format: "pdf" }),
    disposition: inline ? "inline" : undefined,
  });
}

/** ZIP con una imagen por bulto de las etiquetas del courier (`api_label_combined_zip`). */
export function courierCombinedZipUrl(
  base: string,
  shipmentId: number,
  packages: number[] | null,
): string {
  return build(base, "api_label_combined_zip", {
    shipment_id: shipmentId,
    packages: packagesParam({ scope: "all", packages, format: "zip" }),
  });
}
