import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  cargoLabelsService,
  type TmweLabelItem,
} from "@cargo/services/labels.service";

/**
 * LDV interna TMWE de la EXPEDICIÓN cargo (paridad legacy "LDV .Ex"). Ofrece
 * abrir/descargar/imprimir en AMBOS formatos (PDF e imagen), reutilizando el
 * endpoint ajax_tmwe_label. Espejo de shipment/composables/useTmweLabels.
 */
export function useCargoLabels(cargoId: () => number) {
  const { t } = useI18n();
  const toasts = useToastStore();

  const pdfBusy = ref(false);
  const imgBusy = ref(false);
  const printBusy = ref(false);

  /**
   * Fuerza la descarga navegando a `url`. El servidor responde con
   * Content-Disposition: attachment, así que el navegador descarga el binario
   * (con la cookie de sesión) sin abandonar la SPA. Es la vía correcta para el
   * PDF/ZIP bundle, que pueden pesar varios MB.
   */
  function triggerNavDownload(url: string): void {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function fetchLabels(
    fmt: "image" | "pdf",
  ): Promise<TmweLabelItem[] | null> {
    const id = cargoId();
    if (!id) return null;
    const r = await cargoLabelsService.tmweLabel(id, { output_format: fmt });
    if (!r?.success || !r.shipment?.labels?.length) {
      const msg =
        typeof r?.error === "string"
          ? r.error
          : (r?.error?.message ?? t("cargo.azioni.doc_generate_failed"));
      toasts.push("error", msg);
      return null;
    }
    return r.shipment.labels;
  }

  /**
   * Abre en una pestaña nueva el PDF con TODAS las etiquetas (una por collo),
   * generado server-side (ajax_tmwe_label_bundle). Antes solo mostraba la
   * primera de N (bug multi-collo).
   */
  async function openPdf(): Promise<void> {
    const id = cargoId();
    if (!id || pdfBusy.value) return;
    window.open(
      cargoLabelsService.bundleUrl(id, "pdf"),
      "_blank",
      "noopener,noreferrer",
    );
  }

  /**
   * Descarga TODAS las etiquetas del cargo como un solo archivo, generado
   * server-side:
   *   - "pdf"   → un PDF con una etiqueta por página.
   *   - "image" → un ZIP con una JPG por collo (antes: N descargas separadas).
   * Se navega a la URL del bundle (descarga por cookie de sesión) en lugar de
   * traer los base64 al cliente.
   */
  async function download(fmt: "image" | "pdf"): Promise<void> {
    const id = cargoId();
    if (!id) return;
    const busy = fmt === "pdf" ? pdfBusy : imgBusy;
    if (busy.value) return;
    const bundle = fmt === "pdf" ? "pdf" : "zip";
    triggerNavDownload(cargoLabelsService.bundleUrl(id, bundle));
  }

  /** Genera las imágenes de la LDV y las manda a imprimir (auto-print). */
  async function print(): Promise<void> {
    if (printBusy.value) return;
    printBusy.value = true;
    try {
      const labels = await fetchLabels("image");
      if (!labels) return;
      const body = labels
        .map((lab) =>
          lab.format === "pdf"
            ? `<embed src="data:application/pdf;base64,${lab.base64}" type="application/pdf" />`
            : `<img src="data:image/${lab.format};base64,${lab.base64}" alt="LDV" />`,
        )
        .join("");
      const html =
        `<!doctype html><html><head><title>LDV ${cargoId()}</title>` +
        `<style>body{margin:0;padding:8px;font-family:sans-serif}` +
        `img,embed{max-width:100%;display:block;margin:0 0 8px}` +
        `@media print{body{padding:0}}</style></head>` +
        `<body onload="window.print()">${body}</body></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      printBusy.value = false;
    }
  }

  return { pdfBusy, imgBusy, printBusy, openPdf, download, print };
}
