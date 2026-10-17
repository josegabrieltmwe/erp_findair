/**
 * Impresión de la carta de porte (LDV). Reutiliza el cliente de etiquetas de
 * expediciones (`ajax_tmwe_label`, nunca controladores html) y abre el PDF.
 */
import { labelsService } from "../shipment/services/labels.service";
import { base64ToBlob } from "./logic";

export async function printWaybill(shipmentId: number): Promise<number> {
  const res = await labelsService.tmweLabel(shipmentId, {
    output_format: "pdf",
  });
  const labels = res.shipment?.labels ?? [];
  if (!res.success || labels.length === 0) {
    const e = res.error;
    throw new Error(typeof e === "string" ? e : (e?.message ?? "no_label"));
  }
  for (const l of labels) {
    const mime =
      l.format === "pdf"
        ? "application/pdf"
        : l.format === "png"
          ? "image/png"
          : "image/jpeg";
    const url = URL.createObjectURL(base64ToBlob(l.base64, mime));
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
  return labels.length;
}

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
